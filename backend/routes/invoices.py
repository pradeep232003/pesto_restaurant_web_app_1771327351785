"""
Invoices module — supplier delivery invoice capture for JKHive.

Staff snap or upload a photo of a paper invoice. The image is stored in
GridFS and fed to Claude Sonnet 4.5's vision API which extracts the
itemised line items (product / qty / unit price / line total), supplier
name, VAT and grand total. The result is saved as a structured Mongo doc
so it can be searched, filtered, edited and reported on.

Admin + super_admin only get edit/delete; staff can read their own
location's invoices and create new ones.

Endpoints (all under /api/admin/invoices):
  GET    /             — list invoices (scoped to location for staff)
  POST   /scan         — upload an image, run AI extraction, persist
  GET    /{id}         — full record incl. line items
  GET    /{id}/file    — stream the underlying image (inline preview)
  PATCH  /{id}         — admin: change location, supplier, totals, items
  DELETE /{id}         — admin: remove invoice + image
"""
import base64
import json
import re
import uuid
from datetime import datetime, timezone
from typing import Any, List, Optional

import gridfs
import httpx
from bson import ObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from auth import get_admin_user, get_staff_or_above
from db import db

router = APIRouter(prefix="/api/admin/invoices", tags=["invoices"])

_fs = gridfs.GridFS(db, collection="invoices_files")
invoices = db["invoices"]

# Most receipts are well under 10 MB even at 12 MP; hard-cap keeps memory
# usage predictable in the FastAPI worker.
MAX_BYTES = 10 * 1024 * 1024

ALLOWED_CT = {"image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"}


def _strip(doc: dict) -> dict:
    out = {k: v for k, v in (doc or {}).items() if k != "_id"}
    if "file_id" in out and isinstance(out["file_id"], ObjectId):
        out["file_id"] = str(out["file_id"])
    if isinstance(out.get("pages"), list):
        clean_pages = []
        for p in out["pages"]:
            if isinstance(p, dict):
                pc = dict(p)
                if isinstance(pc.get("file_id"), ObjectId):
                    pc["file_id"] = str(pc["file_id"])
                clean_pages.append(pc)
        out["pages"] = clean_pages
    return out


# ---------------------------------------------------------------------------
# AI extraction — Claude Sonnet 4.5 vision via httpx (zero-SDK, Railway-safe)
# ---------------------------------------------------------------------------

_AI_SYSTEM = (
    "You are an invoice parser for Jolly's Kafe. You receive a single photo "
    "of a supplier delivery invoice. Extract structured data so the manager "
    "doesn't have to retype it.\n\n"
    "RULES:\n"
    "1. Output STRICT JSON, no markdown, no commentary.\n"
    "2. Numbers are floats with 2 decimal places (e.g. 4.50, not '£4.50' or 450).\n"
    "3. Quantities default to 1.0 if the row only lists a price.\n"
    "4. UK VAT is usually 20%. If the total VAT line is visible use it; "
    "otherwise leave vat: 0.\n"
    "5. If a field is not readable, return an empty string '' (or 0 for numbers) — never null.\n"
    "6. Currency is GBP for Jolly's. Strip £/$ from the numbers.\n"
    "7. Line items: capture EVERY printed product line. Skip subtotals / VAT / totals.\n"
    "8. Best-guess the spend CATEGORY from this fixed list — return the slug exactly:\n"
    "   - stock       (food, drink, coffee beans, packaging)\n"
    "   - rent        (lease, rent invoices)\n"
    "   - utilities   (electricity, gas, water, broadband, phone)\n"
    "   - software    (EPOS, ordering, subscriptions, SaaS)\n"
    "   - repairs     (repairs, maintenance, plumbing, electrician)\n"
    "   - marketing   (ads, social, print, branding)\n"
    "   - equipment   (machines, furniture, fittings)\n"
    "   - cleaning    (cleaning supplies, pest control, hygiene)\n"
    "   - insurance   (insurance, accountancy, legal, prof. fees)\n"
    "   - other       (when uncertain)\n\n"
    "RESPONSE SHAPE:\n"
    "{\n"
    "  \"supplier\": \"Bidfood\",\n"
    "  \"invoice_number\": \"INV-12345\",\n"
    "  \"invoice_date\": \"YYYY-MM-DD or '' if unknown\",\n"
    "  \"category\": \"stock\",\n"
    "  \"subtotal\": 142.30,\n"
    "  \"vat\": 28.46,\n"
    "  \"total\": 170.76,\n"
    "  \"items\": [\n"
    "    {\"description\": \"...\", \"qty\": 2.0, \"unit_price\": 4.50, \"line_total\": 9.00}\n"
    "  ]\n"
    "}"
)

# Allowed category slugs — mirror the frontend list. Any other value sent
# by the LLM or user is coerced to "other".
ALLOWED_CATEGORIES = {
    "stock", "rent", "utilities", "software", "repairs",
    "marketing", "equipment", "cleaning", "insurance", "other",
}


def _scrub_json(text: str) -> str:
    """Claude occasionally wraps JSON in ```json fences — strip those."""
    s = (text or "").strip()
    if s.startswith("```"):
        s = re.sub(r"^```[a-zA-Z]*\n?", "", s)
        s = re.sub(r"\n?```\s*$", "", s)
    if not s.lstrip().startswith("{"):
        m = re.search(r"\{.*\}", s, re.DOTALL)
        if m:
            s = m.group(0)
    return s


def _coerce_num(v: Any) -> float:
    """Coerce '£12.50' / '12.50' / 12.5 / '12,50' / '' into a clean float."""
    if v is None or v == "":
        return 0.0
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).replace("£", "").replace("$", "").replace(",", "").strip()
    try:
        return round(float(s), 2)
    except ValueError:
        return 0.0


async def _extract_invoice(pages: list) -> dict:
    """Send one or more invoice pages to Claude vision and return parsed dict.
    Each page is a tuple (bytes, media_type). Multiple pages are sent in a
    single Claude call so the model can merge line items across pages."""
    from routes.ai_settings import get_active_ai_key, get_active_ai_provider
    api_key = get_active_ai_key()
    if not api_key:
        raise HTTPException(
            500,
            "AI invoice scan unavailable: no API key configured. Open Admin → AI Settings to add one.",
        )
    provider = get_active_ai_provider()

    if not pages:
        raise HTTPException(400, "No pages supplied to AI extractor")

    # Build a single Claude message with all pages. PDFs go as 'document'
    # blocks, images as 'image' blocks. Anthropic supports up to 100 image
    # blocks per request — well above any realistic invoice page count.
    content = []
    for idx, (blob, media_type) in enumerate(pages, start=1):
        if media_type == "application/pdf":
            content.append({
                "type": "document",
                "source": {"type": "base64", "media_type": "application/pdf",
                           "data": base64.b64encode(blob).decode("ascii")},
            })
        else:
            anth_media = media_type if media_type in ("image/jpeg", "image/png", "image/webp", "image/gif") else "image/jpeg"
            content.append({
                "type": "image",
                "source": {"type": "base64", "media_type": anth_media,
                           "data": base64.b64encode(blob).decode("ascii")},
            })
        # Page label so the model knows the order.
        content.append({"type": "text", "text": f"--- Page {idx} of {len(pages)} ---"})

    instruction = (
        "Extract the invoice fields per the system instructions. "
        + ("All pages above belong to the SAME invoice — merge every line item "
           "into a single 'items' array, in printed order, and use totals from "
           "the final page (or sum them if no grand total is visible). "
           if len(pages) > 1 else "")
        + "Return strict JSON only."
    )
    content.append({"type": "text", "text": instruction})

    req = {
        "model": "claude-sonnet-4-5-20250929",
        "max_tokens": 4000,
        "system": _AI_SYSTEM,
        "messages": [{"role": "user", "content": content}],
    }
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
            resp = await client.post("https://api.anthropic.com/v1/messages", json=req, headers=headers)
    except Exception as e:  # noqa: BLE001
        snippet = (str(e) or e.__class__.__name__).splitlines()[0][:240]
        raise HTTPException(500, f"AI provider error ({provider}): {snippet}")

    if resp.status_code >= 400:
        try:
            err = resp.json().get("error", {}).get("message", resp.text)
        except Exception:
            err = resp.text
        raise HTTPException(500, f"AI provider error ({provider}, {resp.status_code}): {err[:240]}")

    data = resp.json()
    text = "".join(
        block.get("text", "") for block in (data.get("content") or [])
        if block.get("type") == "text"
    ).strip()
    if not text:
        raise HTTPException(500, "AI returned an empty response")

    try:
        parsed = json.loads(_scrub_json(text))
    except json.JSONDecodeError as e:
        raise HTTPException(500, f"AI returned non-JSON: {e}")

    # Normalise into our internal shape — clamp numerics and drop empty
    # rows. Manager can edit afterwards if anything looks off.
    items_raw = parsed.get("items") or []
    items = []
    for it in items_raw:
        desc = (it.get("description") or "").strip()
        if not desc:
            continue
        items.append({
            "description": desc,
            "qty": _coerce_num(it.get("qty") or 1),
            "unit_price": _coerce_num(it.get("unit_price")),
            "line_total": _coerce_num(it.get("line_total")),
        })

    return {
        "supplier": (parsed.get("supplier") or "").strip(),
        "invoice_number": (parsed.get("invoice_number") or "").strip(),
        "invoice_date": (parsed.get("invoice_date") or "").strip(),
        "category": _norm_category(parsed.get("category")),
        "subtotal": _coerce_num(parsed.get("subtotal")),
        "vat": _coerce_num(parsed.get("vat")),
        "total": _coerce_num(parsed.get("total")),
        "items": items,
    }


def _norm_category(v: Any) -> str:
    """Coerce any string into our fixed list. Unknown / empty → 'other'."""
    if not v:
        return "other"
    s = str(v).strip().lower()
    return s if s in ALLOWED_CATEGORIES else "other"


# ---------------------------------------------------------------------------
# CRUD endpoints
# ---------------------------------------------------------------------------

@router.get("")
async def list_invoices(
    location_id: Optional[str] = Query(None),
    supplier: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD — match invoice_date OR uploaded_at"),
    end_date: Optional[str] = Query(None),
    user: dict = Depends(get_staff_or_above),
):
    """Newest invoices first. Filters: location, supplier substring, an
    inclusive date range (matches either the printed invoice_date or the
    uploaded_at timestamp so scans without a parsed invoice_date still
    appear in their upload window), and category."""
    q: dict = {}
    if location_id:
        q["location_id"] = location_id
    if supplier:
        q["supplier"] = {"$regex": re.escape(supplier), "$options": "i"}
    if category:
        q["category"] = category
    if start_date or end_date:
        # Prefer the printed invoice_date when present so a March invoice
        # scanned in June stays in the March report. Only fall back to
        # uploaded_at for scans whose invoice_date is missing/blank.
        s = start_date or "0000-01-01"
        e = end_date or "9999-12-31"
        e_upload = e + "T23:59:59.999Z"
        missing_inv_date = {"$or": [{"invoice_date": ""}, {"invoice_date": {"$exists": False}}, {"invoice_date": None}]}
        q["$or"] = [
            {"invoice_date": {"$gte": s, "$lte": e}},
            {"$and": [missing_inv_date, {"uploaded_at": {"$gte": s, "$lte": e_upload}}]},
        ]
    rows = list(invoices.find(q).sort("uploaded_at", -1).limit(2000))
    return [_strip(r) for r in rows]


@router.post("/scan")
async def scan_invoice(
    file: UploadFile = File(...),
    location_id: str = Form(...),
    note: str = Form(""),
    category: str = Form(""),
    user: dict = Depends(get_staff_or_above),
):
    """Upload an invoice photo, run AI extraction, persist a draft record.
    Returns the saved record (incl. extracted line items) so the staff can
    confirm / amend before walking away."""
    content_type = (file.content_type or "image/jpeg").lower()
    if content_type not in ALLOWED_CT:
        # HEIC and other formats reach the server as image/* — coerce.
        if not content_type.startswith("image/"):
            raise HTTPException(415, f"Unsupported file type: {content_type}")
        content_type = "image/jpeg"

    blob = await file.read()
    if not blob:
        raise HTTPException(400, "Empty file")
    if len(blob) > MAX_BYTES:
        raise HTTPException(413, f"File exceeds {MAX_BYTES // (1024 * 1024)} MB limit")

    # 1. Persist the raw image first so we don't lose evidence even if the
    #    AI extraction blows up.
    file_id = _fs.put(
        blob,
        filename=file.filename or "invoice",
        content_type=content_type,
        metadata={"location_id": location_id},
    )

    # 2. Try the AI extraction. On failure we still keep the image and a
    #    draft record so the manager can fill it in by hand.
    extracted = {
        "supplier": "", "invoice_number": "", "invoice_date": "",
        "category": "other",
        "subtotal": 0.0, "vat": 0.0, "total": 0.0, "items": [],
    }
    ai_error = ""
    try:
        extracted = await _extract_invoice([(blob, content_type)])
    except HTTPException as e:
        ai_error = str(e.detail)
    except Exception as e:  # noqa: BLE001
        ai_error = f"AI extraction failed: {e}"

    # If the manager (or share-target) pre-tagged a category, honour it
    # over the AI guess.
    final_category = _norm_category(category) if category else extracted["category"]

    now_iso = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4())[:12],
        "location_id": location_id,
        "supplier": extracted["supplier"],
        "invoice_number": extracted["invoice_number"],
        "invoice_date": extracted["invoice_date"],
        "category": final_category,
        "subtotal": extracted["subtotal"],
        "vat": extracted["vat"],
        "total": extracted["total"],
        "items": extracted["items"],
        "note": (note or "").strip(),
        "file_id": str(file_id),
        "filename": file.filename or "invoice",
        "content_type": content_type,
        "size": len(blob),
        "pages": [{
            "file_id": str(file_id),
            "filename": file.filename or "invoice",
            "content_type": content_type,
            "size": len(blob),
        }],
        "page_count": 1,
        "uploaded_at": now_iso,
        "uploaded_by": user.get("email", ""),
        "uploaded_by_name": user.get("name", ""),
        "ai_status": "ok" if not ai_error else "failed",
        "ai_error": ai_error,
    }
    invoices.insert_one(dict(doc))
    return _strip(doc)


@router.post("/scan-multi")
async def scan_invoice_multi(
    files: List[UploadFile] = File(...),
    location_id: str = Form(...),
    note: str = Form(""),
    category: str = Form(""),
    user: dict = Depends(get_staff_or_above),
):
    """Multi-page invoice scan. Accepts 1..N pages of the SAME invoice;
    each page is persisted in GridFS individually so we can stream/display
    them one-by-one, but the AI sees them as a single document and merges
    line items into one extraction.
    """
    if not files:
        raise HTTPException(400, "At least one file required")
    if len(files) > 20:
        raise HTTPException(413, "Maximum 20 pages per invoice")

    # 1. Read + validate every page upfront. We persist the raw images
    #    before calling the AI so evidence is never lost on a flaky run.
    pages_data: list = []          # tuples (blob, content_type, filename)
    total_size = 0
    for f in files:
        ct = (f.content_type or "image/jpeg").lower()
        if ct not in ALLOWED_CT:
            if not ct.startswith("image/"):
                raise HTTPException(415, f"Unsupported file type: {ct}")
            ct = "image/jpeg"
        blob = await f.read()
        if not blob:
            raise HTTPException(400, f"Empty file: {f.filename or 'page'}")
        if len(blob) > MAX_BYTES:
            raise HTTPException(413, f"Page {f.filename or ''} exceeds {MAX_BYTES // (1024 * 1024)} MB limit")
        total_size += len(blob)
        pages_data.append((blob, ct, f.filename or "invoice"))

    # 2. Store every page in GridFS.
    page_entries = []
    for idx, (blob, ct, fname) in enumerate(pages_data):
        gid = _fs.put(
            blob,
            filename=fname,
            content_type=ct,
            metadata={"location_id": location_id, "page_index": idx},
        )
        page_entries.append({
            "file_id": str(gid),
            "filename": fname,
            "content_type": ct,
            "size": len(blob),
        })

    # 3. Single AI call with all pages merged.
    extracted = {
        "supplier": "", "invoice_number": "", "invoice_date": "",
        "category": "other",
        "subtotal": 0.0, "vat": 0.0, "total": 0.0, "items": [],
    }
    ai_error = ""
    try:
        extracted = await _extract_invoice([(b, ct) for (b, ct, _) in pages_data])
    except HTTPException as e:
        ai_error = str(e.detail)
    except Exception as e:  # noqa: BLE001
        ai_error = f"AI extraction failed: {e}"

    final_category = _norm_category(category) if category else extracted["category"]

    now_iso = datetime.now(timezone.utc).isoformat()
    first = page_entries[0]
    doc = {
        "id": str(uuid.uuid4())[:12],
        "location_id": location_id,
        "supplier": extracted["supplier"],
        "invoice_number": extracted["invoice_number"],
        "invoice_date": extracted["invoice_date"],
        "category": final_category,
        "subtotal": extracted["subtotal"],
        "vat": extracted["vat"],
        "total": extracted["total"],
        "items": extracted["items"],
        "note": (note or "").strip(),
        # Back-compat: top-level file_id stays as the first page so the
        # existing /file endpoint and legacy clients keep working.
        "file_id": first["file_id"],
        "filename": first["filename"],
        "content_type": first["content_type"],
        "size": first["size"],
        "pages": page_entries,
        "page_count": len(page_entries),
        "uploaded_at": now_iso,
        "uploaded_by": user.get("email", ""),
        "uploaded_by_name": user.get("name", ""),
        "ai_status": "ok" if not ai_error else "failed",
        "ai_error": ai_error,
    }
    invoices.insert_one(dict(doc))
    return _strip(doc)


@router.post("/{invoice_id}/append-pages")
async def append_invoice_pages(
    invoice_id: str,
    files: List[UploadFile] = File(...),
    reextract: bool = Form(True),
    user: dict = Depends(get_staff_or_above),
):
    """Attach additional pages to an existing invoice.

    Useful when a supplier emails the second sheet after the first was
    already scanned, or when staff snap an extra page out of order. We
    persist every new page to GridFS, append to `pages[]`, bump
    `page_count`, and (by default) re-run the AI across ALL pages so the
    line items and totals stay consistent.
    """
    rec = invoices.find_one({"id": invoice_id})
    if not rec:
        raise HTTPException(404, "Not found")

    if not files:
        raise HTTPException(400, "At least one page required")

    existing_pages = rec.get("pages") or [{
        "file_id": rec.get("file_id"),
        "filename": rec.get("filename", "invoice"),
        "content_type": rec.get("content_type", "image/jpeg"),
        "size": rec.get("size", 0),
    }]
    if len(existing_pages) + len(files) > 20:
        raise HTTPException(413, "Maximum 20 pages per invoice")

    # Read + validate every new page, store in GridFS.
    new_entries = []
    new_blobs = []  # (blob, content_type) for AI re-extraction
    for f in files:
        ct = (f.content_type or "image/jpeg").lower()
        if ct not in ALLOWED_CT:
            if not ct.startswith("image/"):
                raise HTTPException(415, f"Unsupported file type: {ct}")
            ct = "image/jpeg"
        blob = await f.read()
        if not blob:
            raise HTTPException(400, f"Empty file: {f.filename or 'page'}")
        if len(blob) > MAX_BYTES:
            raise HTTPException(413, f"Page {f.filename or ''} exceeds {MAX_BYTES // (1024 * 1024)} MB limit")
        gid = _fs.put(
            blob,
            filename=f.filename or "invoice",
            content_type=ct,
            metadata={"location_id": rec.get("location_id"), "page_index": len(existing_pages) + len(new_entries)},
        )
        new_entries.append({
            "file_id": str(gid),
            "filename": f.filename or "invoice",
            "content_type": ct,
            "size": len(blob),
        })
        new_blobs.append((blob, ct))

    all_pages = list(existing_pages) + new_entries

    update: dict = {
        "pages": all_pages,
        "page_count": len(all_pages),
        "edited_at": datetime.now(timezone.utc).isoformat(),
        "edited_by": user.get("email", ""),
        "edited_by_name": user.get("name", ""),
    }

    # Optional re-extraction across ALL pages (existing + new). On any
    # failure we still keep the appended pages — the manager can re-run
    # by hand from the modal.
    if reextract:
        # Pull existing page bytes back from GridFS.
        all_blobs: list = []
        try:
            for p in existing_pages:
                fid = p.get("file_id")
                if not fid:
                    continue
                oid = fid if isinstance(fid, ObjectId) else ObjectId(fid)
                blob = _fs.get(oid).read()
                all_blobs.append((blob, p.get("content_type", "image/jpeg")))
        except Exception as e:  # noqa: BLE001
            update["ai_error"] = f"Could not re-read existing pages: {e}"
            all_blobs = []

        all_blobs.extend(new_blobs)

        if all_blobs:
            try:
                extracted = await _extract_invoice(all_blobs)
                update.update({
                    "supplier": extracted["supplier"] or rec.get("supplier", ""),
                    "invoice_number": extracted["invoice_number"] or rec.get("invoice_number", ""),
                    "invoice_date": extracted["invoice_date"] or rec.get("invoice_date", ""),
                    "category": extracted["category"] if extracted["category"] != "other" else rec.get("category", "other"),
                    "subtotal": extracted["subtotal"] or rec.get("subtotal", 0.0),
                    "vat": extracted["vat"] or rec.get("vat", 0.0),
                    "total": extracted["total"] or rec.get("total", 0.0),
                    "items": extracted["items"],
                    "ai_status": "ok",
                    "ai_error": "",
                })
            except HTTPException as e:
                update["ai_status"] = "failed"
                update["ai_error"] = str(e.detail)
            except Exception as e:  # noqa: BLE001
                update["ai_status"] = "failed"
                update["ai_error"] = f"AI re-extraction failed: {e}"

    invoices.update_one({"id": invoice_id}, {"$set": update})
    return _strip(invoices.find_one({"id": invoice_id}))


@router.get("/{invoice_id}")
async def get_invoice(invoice_id: str, user: dict = Depends(get_staff_or_above)):
    rec = invoices.find_one({"id": invoice_id})
    if not rec:
        raise HTTPException(404, "Not found")
    return _strip(rec)


@router.get("/{invoice_id}/file")
async def download_invoice(invoice_id: str, user: dict = Depends(get_staff_or_above)):
    rec = invoices.find_one({"id": invoice_id})
    if not rec:
        raise HTTPException(404, "Not found")
    try:
        gridfs_id = rec["file_id"]
        if not isinstance(gridfs_id, ObjectId):
            gridfs_id = ObjectId(gridfs_id)
        gridout = _fs.get(gridfs_id)
    except Exception:
        raise HTTPException(404, "File missing in GridFS")
    return StreamingResponse(
        gridout,
        media_type=rec.get("content_type", "application/octet-stream"),
        headers={
            "Content-Disposition": f'inline; filename="{rec.get("filename", "invoice")}"',
            "Cache-Control": "private, max-age=300",
        },
    )


@router.get("/{invoice_id}/pages/{page_index}")
async def download_invoice_page(invoice_id: str, page_index: int, user: dict = Depends(get_staff_or_above)):
    """Stream a specific page of a multi-page invoice."""
    rec = invoices.find_one({"id": invoice_id})
    if not rec:
        raise HTTPException(404, "Not found")
    pages = rec.get("pages") or [{
        "file_id": rec.get("file_id"),
        "filename": rec.get("filename", "invoice"),
        "content_type": rec.get("content_type", "application/octet-stream"),
    }]
    if page_index < 0 or page_index >= len(pages):
        raise HTTPException(404, "Page not found")
    p = pages[page_index]
    try:
        gid = p["file_id"]
        if not isinstance(gid, ObjectId):
            gid = ObjectId(gid)
        gridout = _fs.get(gid)
    except Exception:
        raise HTTPException(404, "File missing in GridFS")
    return StreamingResponse(
        gridout,
        media_type=p.get("content_type", "application/octet-stream"),
        headers={
            "Content-Disposition": f'inline; filename="{p.get("filename", "invoice")}"',
            "Cache-Control": "private, max-age=300",
        },
    )


class InvoiceItem(BaseModel):
    description: str
    qty: float = 1.0
    unit_price: float = 0.0
    line_total: float = 0.0


class InvoicePatch(BaseModel):
    location_id: Optional[str] = None
    supplier: Optional[str] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[str] = None
    category: Optional[str] = None
    subtotal: Optional[float] = None
    vat: Optional[float] = None
    total: Optional[float] = None
    items: Optional[List[InvoiceItem]] = None
    note: Optional[str] = None


@router.patch("/{invoice_id}")
async def update_invoice(invoice_id: str, body: InvoicePatch, user: dict = Depends(get_admin_user)):
    rec = invoices.find_one({"id": invoice_id})
    if not rec:
        raise HTTPException(404, "Not found")
    update: dict = {}
    for field in ("location_id", "supplier", "invoice_number", "invoice_date", "note"):
        v = getattr(body, field)
        if v is not None:
            update[field] = (v or "").strip()
    if body.category is not None:
        update["category"] = _norm_category(body.category)
    for field in ("subtotal", "vat", "total"):
        v = getattr(body, field)
        if v is not None:
            update[field] = round(float(v), 2)
    if body.items is not None:
        update["items"] = [
            {
                "description": (it.description or "").strip(),
                "qty": round(float(it.qty or 0), 3),
                "unit_price": round(float(it.unit_price or 0), 2),
                "line_total": round(float(it.line_total or 0), 2),
            }
            for it in body.items if (it.description or "").strip()
        ]
    if update:
        update["edited_at"] = datetime.now(timezone.utc).isoformat()
        update["edited_by"] = user.get("email", "")
        update["edited_by_name"] = user.get("name", "")
        invoices.update_one({"id": invoice_id}, {"$set": update})
    return _strip(invoices.find_one({"id": invoice_id}))


@router.delete("/{invoice_id}")
async def delete_invoice(invoice_id: str, user: dict = Depends(get_admin_user)):
    rec = invoices.find_one({"id": invoice_id})
    if not rec:
        raise HTTPException(404, "Not found")
    # Collect all page file_ids (multi-page) plus legacy single file_id.
    file_ids = []
    for p in (rec.get("pages") or []):
        if p.get("file_id"):
            file_ids.append(p["file_id"])
    if rec.get("file_id") and rec["file_id"] not in file_ids:
        file_ids.append(rec["file_id"])
    for fid in file_ids:
        try:
            gid = fid if isinstance(fid, ObjectId) else ObjectId(fid)
            _fs.delete(gid)
        except Exception:
            pass  # tolerate orphan GridFS — metadata removal is the priority
    invoices.delete_one({"id": invoice_id})
    return {"deleted": True}
