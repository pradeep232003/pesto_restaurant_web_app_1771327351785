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

_AI_SYSTEM_MULTI = (
    "You are an invoice parser for Jolly's Kafe. The file you receive may "
    "contain ONE invoice or MANY invoices (e.g. a supplier statement bundle "
    "of reprinted invoices). Detect each distinct invoice and return them as "
    "an ARRAY.\n\n"
    "DETECT ONE-VS-MANY by looking for repeated 'Invoice #' / 'Cash Invoice' "
    "headers with different numbers or different Tax Point / Invoice dates. "
    "If the same supplier repeats on separate pages with different invoice "
    "numbers, they are SEPARATE invoices — do NOT merge them.\n\n"
    "RULES:\n"
    "1. Output STRICT JSON, no markdown, no commentary.\n"
    "2. Root is {\"invoices\": [ ... ]} — always an array, length >= 1.\n"
    "3. For each invoice: same fields as the single-invoice extractor, plus\n"
    "   page_start and page_end (1-indexed page numbers within the file).\n"
    "   If the file is a single image, use page_start=1, page_end=1.\n"
    "4. Numbers are floats with 2dp; blank strings for unknown text; 0 for unknown numbers.\n"
    "5. Currency GBP; strip £/$.\n"
    "6. Category slug from: stock, rent, utilities, software, repairs, marketing, equipment, cleaning, insurance, other.\n\n"
    "RESPONSE SHAPE:\n"
    "{\n"
    "  \"invoices\": [\n"
    "    {\n"
    "      \"supplier\": \"FCN Frozen Foods Ltd\",\n"
    "      \"invoice_number\": \"265735\",\n"
    "      \"invoice_date\": \"2026-05-01\",\n"
    "      \"category\": \"stock\",\n"
    "      \"subtotal\": 230.58,\n"
    "      \"vat\": 46.11,\n"
    "      \"total\": 276.69,\n"
    "      \"items\": [ {\"description\": \"...\", \"qty\": 2.0, \"unit_price\": 4.50, \"line_total\": 9.00} ],\n"
    "      \"page_start\": 1,\n"
    "      \"page_end\": 1\n"
    "    }\n"
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
        "invoice_date": _norm_iso_date(parsed.get("invoice_date")),
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


def _norm_iso_date(v: Any) -> str:
    """Best-effort coercion of any date-ish string into YYYY-MM-DD.

    We already ask the AI for ISO, but Claude occasionally mirrors the
    printed format (e.g. `03/07/2026`, `3/7/26`, `July 3, 2026`) — those
    non-ISO strings then break every date-range query downstream. It also
    occasionally emits a 2-digit year zero-padded to look ISO
    (`0026-07-03`), which passes the shape check but sorts before any
    real year. Fixing all this at write time is way cheaper than dealing
    with the fallout on read. Returns '' when we can't confidently parse."""
    if v is None:
        return ""
    s = str(v).strip()
    if not s:
        return ""
    # ISO shape — but sanity-check the year. If < 100 treat as 20xx/19xx,
    # if > 2999 give up (Claude sometimes hallucinates absurd values).
    m_iso = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", s)
    if m_iso:
        y, mo, d = map(int, m_iso.groups())
        if 1000 <= y <= 2999 and 1 <= mo <= 12 and 1 <= d <= 31:
            return s  # normal case — already correct
        if y < 100:
            # e.g. "0026-07-03" — 2-digit year zero-padded. Same rule
            # as UK dates: 00-49 → 2000s, 50-99 → 1900s.
            y = 2000 + y if y < 50 else 1900 + y
            try:
                return datetime(y, mo, d).strftime("%Y-%m-%d")
            except (ValueError, TypeError):
                return ""
        return ""  # anything else with an odd ISO year is unrecoverable
    # dd/mm/yyyy or dd/mm/yy — UK order (Jolly's is UK-based).
    m = re.match(r"^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$", s)
    if m:
        d, mo, y = m.groups()
        yi = int(y)
        if yi < 100:
            yi = 2000 + yi if yi < 50 else 1900 + yi
        try:
            dt = datetime(yi, int(mo), int(d))
            return dt.strftime("%Y-%m-%d")
        except (ValueError, TypeError):
            pass
    # Textual month e.g. "3 July 2026", "July 3, 2026".
    for fmt in ("%d %B %Y", "%d %b %Y", "%B %d, %Y", "%b %d, %Y", "%B %d %Y", "%b %d %Y"):
        try:
            return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except (ValueError, TypeError):
            continue
    return ""


def _find_duplicate(location_id: str, supplier: str, invoice_number: str,
                    exclude_id: Optional[str] = None) -> Optional[dict]:
    """Return an existing invoice for the same (site, supplier, invoice #)
    or None. Case-insensitive on both supplier + invoice_number, blank
    values are ignored (nothing to dedupe against). Excluding the current
    record's id keeps PATCH idempotent."""
    supp = (supplier or "").strip()
    num = (invoice_number or "").strip()
    if not supp or not num:
        return None
    query = {
        "location_id": location_id,
        "supplier": {"$regex": f"^{re.escape(supp)}$", "$options": "i"},
        "invoice_number": {"$regex": f"^{re.escape(num)}$", "$options": "i"},
    }
    if exclude_id:
        query["id"] = {"$ne": exclude_id}
    return invoices.find_one(query, {"_id": 0, "id": 1, "supplier": 1, "invoice_number": 1, "uploaded_at": 1, "uploaded_by_name": 1})


def _raise_if_duplicate(location_id: str, supplier: str, invoice_number: str,
                        exclude_id: Optional[str] = None) -> None:
    """Reject a save when a duplicate already exists. Include the offending
    record in the response so the UI can offer a "view existing" jump."""
    dup = _find_duplicate(location_id, supplier, invoice_number, exclude_id)
    if dup:
        who = dup.get("uploaded_by_name") or "someone"
        when = (dup.get("uploaded_at") or "")[:10]
        raise HTTPException(
            409,
            f"Duplicate invoice: {dup.get('supplier')} #{dup.get('invoice_number')} "
            f"was already saved by {who}{(' on ' + when) if when else ''}. "
            f"(id={dup.get('id')})",
        )


def _normalise_draft(raw: dict) -> dict:
    """Coerce one AI-detected invoice into our internal shape (items + ints)."""
    items_raw = raw.get("items") or []
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
    try:
        ps = int(raw.get("page_start") or 1)
    except (TypeError, ValueError):
        ps = 1
    try:
        pe = int(raw.get("page_end") or ps)
    except (TypeError, ValueError):
        pe = ps
    return {
        "supplier": (raw.get("supplier") or "").strip(),
        "invoice_number": (raw.get("invoice_number") or "").strip(),
        "invoice_date": _norm_iso_date(raw.get("invoice_date")),
        "category": _norm_category(raw.get("category")),
        "subtotal": _coerce_num(raw.get("subtotal")),
        "vat": _coerce_num(raw.get("vat")),
        "total": _coerce_num(raw.get("total")),
        "items": items,
        "page_start": ps,
        "page_end": pe,
    }


async def _detect_invoices(blob: bytes, media_type: str) -> list:
    """Send ONE file (PDF or image) to Claude and get back an ARRAY of
    detected invoices. Each element already normalised via `_normalise_draft`.
    Bubbles up HTTPException on failure paths so the UI can show a clean
    error message."""
    from routes.ai_settings import get_active_ai_key, get_active_ai_provider
    api_key = get_active_ai_key()
    if not api_key:
        raise HTTPException(
            500,
            "AI invoice scan unavailable: no API key configured. Open Admin → AI Settings to add one.",
        )
    provider = get_active_ai_provider()

    if media_type == "application/pdf":
        content_block = {
            "type": "document",
            "source": {"type": "base64", "media_type": "application/pdf",
                       "data": base64.b64encode(blob).decode("ascii")},
        }
    else:
        anth_media = media_type if media_type in ("image/jpeg", "image/png", "image/webp", "image/gif") else "image/jpeg"
        content_block = {
            "type": "image",
            "source": {"type": "base64", "media_type": anth_media,
                       "data": base64.b64encode(blob).decode("ascii")},
        }

    req = {
        "model": "claude-sonnet-4-5-20250929",
        "max_tokens": 8000,
        "system": _AI_SYSTEM_MULTI,
        "messages": [{"role": "user", "content": [
            content_block,
            {"type": "text", "text": "Detect every distinct invoice in the file and return the JSON array as specified."},
        ]}],
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

    invoices_raw = parsed.get("invoices")
    if not isinstance(invoices_raw, list) or not invoices_raw:
        raise HTTPException(500, "AI response missing 'invoices' array")

    return [_normalise_draft(r) for r in invoices_raw]


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
        # Prefer the printed invoice_date when it's an ISO YYYY-MM-DD (so a
        # March invoice scanned in June stays in the March report). For
        # everything else — blank, missing, or a free-form/misparsed date
        # like "03/07/2026" or "July 3 2026" — fall back to uploaded_at so
        # the record still lands in its upload window instead of vanishing.
        s = start_date or "0000-01-01"
        e = end_date or "9999-12-31"
        e_upload = e + "T23:59:59.999Z"
        iso_regex = {"$regex": r"^\d{4}-\d{2}-\d{2}$"}
        q["$or"] = [
            {"$and": [
                {"invoice_date": iso_regex},
                {"invoice_date": {"$gte": s, "$lte": e}},
            ]},
            {"$and": [
                {"$or": [
                    {"invoice_date": {"$exists": False}},
                    {"invoice_date": None},
                    {"invoice_date": {"$not": {"$regex": r"^\d{4}-\d{2}-\d{2}$"}}},
                ]},
                {"uploaded_at": {"$gte": s, "$lte": e_upload}},
            ]},
        ]
    # Sort by printed invoice_date (desc) then uploaded_at (desc) so the
    # accountant sees the newest supplier date at the top; scans without
    # a parsed invoice_date fall in wherever their upload timestamp lands.
    rows = list(invoices.find(q).sort([("invoice_date", -1), ("uploaded_at", -1)]).limit(2000))
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
    # Reject before insert if a same-site same-supplier same-invoice#
    # already exists. Skipped when supplier or invoice_number is blank
    # (AI failed to parse) so the manager can still land the record and
    # fill it in by hand.
    _raise_if_duplicate(location_id, doc["supplier"], doc["invoice_number"])
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
    _raise_if_duplicate(location_id, doc["supplier"], doc["invoice_number"])
    invoices.insert_one(dict(doc))
    return _strip(doc)


# ---------------------------------------------------------------------------
# Auto / Batch scan — detect 1..N invoices in a single file (e.g. a supplier
# statement bundle). If exactly one is found we persist it and return it in
# `single` mode so the UI opens the normal review modal. If multiple are
# found we return `batch` mode with UNPERSISTED drafts — the frontend
# shows a batch-review modal and calls `/scan-batch-commit` on save.
# ---------------------------------------------------------------------------

class BatchDraft(BaseModel):
    supplier: str = ""
    invoice_number: str = ""
    invoice_date: str = ""
    category: str = "other"
    subtotal: float = 0.0
    vat: float = 0.0
    total: float = 0.0
    items: List[dict] = []
    page_start: int = 1
    page_end: int = 1


class BatchCommit(BaseModel):
    location_id: str
    note: Optional[str] = ""
    source_file_id: str
    filename: Optional[str] = "invoice"
    content_type: Optional[str] = "application/pdf"
    size: Optional[int] = 0
    drafts: List[BatchDraft]


@router.post("/scan-auto")
async def scan_invoice_auto(
    file: UploadFile = File(...),
    location_id: str = Form(...),
    note: str = Form(""),
    category: str = Form(""),
    user: dict = Depends(get_staff_or_above),
):
    """Detect whether the file is one invoice or a bundle, then act.

    - 1 invoice → persist + return `{ mode: "single", invoice }`.
    - N invoices → persist the source file in GridFS ONCE, return
      `{ mode: "batch", drafts, source_file_id, ... }` (drafts NOT saved).
    """
    content_type = (file.content_type or "image/jpeg").lower()
    if content_type not in ALLOWED_CT:
        if not content_type.startswith("image/"):
            raise HTTPException(415, f"Unsupported file type: {content_type}")
        content_type = "image/jpeg"

    blob = await file.read()
    if not blob:
        raise HTTPException(400, "Empty file")
    if len(blob) > MAX_BYTES:
        raise HTTPException(413, f"File exceeds {MAX_BYTES // (1024 * 1024)} MB limit")

    # Store the source file exactly once. Both branches reference this ID.
    source_file_id = _fs.put(
        blob,
        filename=file.filename or "invoice",
        content_type=content_type,
        metadata={"location_id": location_id, "batch_source": True},
    )
    source_ref = {
        "file_id": str(source_file_id),
        "filename": file.filename or "invoice",
        "content_type": content_type,
        "size": len(blob),
    }

    # Detect invoices via AI.
    try:
        drafts = await _detect_invoices(blob, content_type)
    except HTTPException as e:
        # AI failure — fall back to a single stub so the manager can still
        # save the file and edit fields by hand.
        stub = {
            "supplier": "", "invoice_number": "", "invoice_date": "",
            "category": "other", "subtotal": 0.0, "vat": 0.0, "total": 0.0,
            "items": [], "page_start": 1, "page_end": 1,
        }
        drafts = [stub]
        ai_error = str(e.detail)
    else:
        ai_error = ""

    # Exactly one invoice → persist immediately and return `single`.
    if len(drafts) == 1:
        d = drafts[0]
        final_cat = _norm_category(category) if category else d["category"]
        now_iso = datetime.now(timezone.utc).isoformat()
        doc = {
            "id": str(uuid.uuid4())[:12],
            "location_id": location_id,
            "supplier": d["supplier"],
            "invoice_number": d["invoice_number"],
            "invoice_date": d["invoice_date"],
            "category": final_cat,
            "subtotal": d["subtotal"],
            "vat": d["vat"],
            "total": d["total"],
            "items": d["items"],
            "note": (note or "").strip(),
            "file_id": source_ref["file_id"],
            "filename": source_ref["filename"],
            "content_type": source_ref["content_type"],
            "size": source_ref["size"],
            "pages": [source_ref],
            "page_count": 1,
            "uploaded_at": now_iso,
            "uploaded_by": user.get("email", ""),
            "uploaded_by_name": user.get("name", ""),
            "ai_status": "ok" if not ai_error else "failed",
            "ai_error": ai_error,
        }
        _raise_if_duplicate(location_id, doc["supplier"], doc["invoice_number"])
        invoices.insert_one(dict(doc))
        return {"mode": "single", "invoice": _strip(doc)}

    # Multiple invoices detected — return drafts for review, source stays
    # in GridFS ready to be attached on commit.
    return {
        "mode": "batch",
        "drafts": drafts,
        "source_file_id": source_ref["file_id"],
        "filename": source_ref["filename"],
        "content_type": source_ref["content_type"],
        "size": source_ref["size"],
    }


@router.post("/scan-batch-commit")
async def scan_batch_commit(body: BatchCommit, user: dict = Depends(get_staff_or_above)):
    """Persist a set of drafts previously produced by `/scan-auto`.

    The manager may have edited supplier/date/total fields in the batch
    review modal; we trust the payload. Every created invoice references
    the same source GridFS file — the audit trail (the actual bundle
    PDF) is preserved verbatim.
    """
    if not body.drafts:
        raise HTTPException(400, "No drafts to commit")

    # Pre-flight — reject the whole batch if any draft would create a
    # duplicate, AND catch drafts that duplicate each other in the same
    # payload. This keeps commit atomic (no partial inserts).
    seen_pairs = set()
    for d in body.drafts:
        supp = (d.supplier or "").strip()
        num = (d.invoice_number or "").strip()
        if supp and num:
            key = (supp.lower(), num.lower())
            if key in seen_pairs:
                raise HTTPException(
                    409,
                    f"Batch contains a duplicate: {supp} #{num} appears twice. "
                    "Skip one of the rows and try again.",
                )
            seen_pairs.add(key)
            _raise_if_duplicate(body.location_id, supp, num)

    source_ref = {
        "file_id": body.source_file_id,
        "filename": body.filename or "invoice",
        "content_type": body.content_type or "application/pdf",
        "size": int(body.size or 0),
    }
    now_iso = datetime.now(timezone.utc).isoformat()
    created = []
    for d in body.drafts:
        # Coerce items to the internal shape and drop blanks.
        items = []
        for it in (d.items or []):
            desc = (it.get("description") or "").strip() if isinstance(it, dict) else ""
            if not desc:
                continue
            items.append({
                "description": desc,
                "qty": _coerce_num(it.get("qty") or 1),
                "unit_price": _coerce_num(it.get("unit_price")),
                "line_total": _coerce_num(it.get("line_total")),
            })
        doc = {
            "id": str(uuid.uuid4())[:12],
            "location_id": body.location_id,
            "supplier": (d.supplier or "").strip(),
            "invoice_number": (d.invoice_number or "").strip(),
            "invoice_date": _norm_iso_date(d.invoice_date),
            "category": _norm_category(d.category),
            "subtotal": _coerce_num(d.subtotal),
            "vat": _coerce_num(d.vat),
            "total": _coerce_num(d.total),
            "items": items,
            "note": (body.note or "").strip(),
            "file_id": source_ref["file_id"],
            "filename": source_ref["filename"],
            "content_type": source_ref["content_type"],
            "size": source_ref["size"],
            "pages": [source_ref],
            "page_count": 1,
            "source_page_start": int(d.page_start or 1),
            "source_page_end": int(d.page_end or d.page_start or 1),
            "batch_source_file_id": source_ref["file_id"],
            "uploaded_at": now_iso,
            "uploaded_by": user.get("email", ""),
            "uploaded_by_name": user.get("name", ""),
            "ai_status": "ok",
            "ai_error": "",
        }
        invoices.insert_one(dict(doc))
        created.append(_strip(doc))
    return {"created": len(created), "invoices": created}


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
    for field in ("location_id", "supplier", "invoice_number", "note"):
        v = getattr(body, field)
        if v is not None:
            update[field] = (v or "").strip()
    # invoice_date gets special handling — normalise to ISO YYYY-MM-DD so
    # date-range queries keep working even if the manager types a UK date.
    if body.invoice_date is not None:
        update["invoice_date"] = _norm_iso_date(body.invoice_date)
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
        # If the edit touches location / supplier / invoice_number, check
        # nothing on that new (site, supplier, #) triplet already exists.
        # Excludes the current record so a no-op save doesn't fight itself.
        loc_after = update.get("location_id", rec.get("location_id", ""))
        supp_after = update.get("supplier", rec.get("supplier", ""))
        num_after = update.get("invoice_number", rec.get("invoice_number", ""))
        _raise_if_duplicate(loc_after, supp_after, num_after, exclude_id=invoice_id)

        update["edited_at"] = datetime.now(timezone.utc).isoformat()
        update["edited_by"] = user.get("email", "")
        update["edited_by_name"] = user.get("name", "")
        invoices.update_one({"id": invoice_id}, {"$set": update})
    return _strip(invoices.find_one({"id": invoice_id}))


@router.post("/admin/normalise-dates")
async def normalise_invoice_dates(user: dict = Depends(get_admin_user)):
    """One-shot migration: coerce every `invoice_date` through
    `_norm_iso_date`. Also detects out-of-range years (AI hallucinations
    like `2028-07-03` or `2036-11-01`) and clears them, preserving the
    original guess in `invoice_date_raw` so the admin can review + edit.
    Cleared records fall back to `uploaded_at` for date-range queries,
    so they stop being invisible. Safe to run multiple times."""
    today_year = datetime.now(timezone.utc).year
    MAX_SANE_YEAR = today_year + 1     # allow next-year invoices (rare but real)
    MIN_SANE_YEAR = 2000

    updated = 0
    unchanged = 0
    cleared_hallucinations: list = []
    unfixable: list = []
    cursor = invoices.find(
        {},
        {"_id": 0, "id": 1, "invoice_date": 1, "supplier": 1,
         "invoice_number": 1, "uploaded_at": 1},
    )
    for rec in cursor:
        current = rec.get("invoice_date") or ""
        normalised = _norm_iso_date(current)

        # Sanity check the parsed year against uploaded_at (or today).
        suspect_year = None
        if normalised and re.match(r"^\d{4}-\d{2}-\d{2}$", normalised):
            y = int(normalised[:4])
            if y < MIN_SANE_YEAR or y > MAX_SANE_YEAR:
                suspect_year = y

        if suspect_year is not None:
            # Hallucinated year — clear the ISO date, preserve raw for review.
            invoices.update_one(
                {"id": rec["id"]},
                {"$set": {"invoice_date": "", "invoice_date_raw": current}},
            )
            cleared_hallucinations.append({
                "id": rec["id"],
                "supplier": rec.get("supplier", ""),
                "invoice_number": rec.get("invoice_number", ""),
                "raw_date": current,
                "suspect_year": suspect_year,
            })
            continue

        if normalised and normalised != current:
            invoices.update_one({"id": rec["id"]}, {"$set": {"invoice_date": normalised}})
            updated += 1
        elif normalised or not current:
            unchanged += 1
        else:
            unfixable.append({
                "id": rec["id"],
                "supplier": rec.get("supplier", ""),
                "invoice_number": rec.get("invoice_number", ""),
                "raw_date": current,
            })

    # Year distribution AFTER the migration.
    years_after: dict = {}
    for rec in invoices.find({}, {"_id": 0, "invoice_date": 1}):
        d = rec.get("invoice_date") or ""
        key = d[:4] if re.match(r"^\d{4}-\d{2}-\d{2}$", d) else "(blank)"
        years_after[key] = years_after.get(key, 0) + 1

    return {
        "scanned": updated + unchanged + len(unfixable) + len(cleared_hallucinations),
        "updated": updated,
        "unchanged": unchanged,
        "cleared_hallucinations": cleared_hallucinations[:50],
        "cleared_count": len(cleared_hallucinations),
        "unfixable": unfixable[:50],
        "unfixable_count": len(unfixable),
        "years_after": dict(sorted(years_after.items())),
    }


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
