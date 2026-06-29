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
    "7. Line items: capture EVERY printed product line. Skip subtotals / VAT / totals.\n\n"
    "RESPONSE SHAPE:\n"
    "{\n"
    "  \"supplier\": \"Bidfood\",\n"
    "  \"invoice_number\": \"INV-12345\",\n"
    "  \"invoice_date\": \"YYYY-MM-DD or '' if unknown\",\n"
    "  \"subtotal\": 142.30,\n"
    "  \"vat\": 28.46,\n"
    "  \"total\": 170.76,\n"
    "  \"items\": [\n"
    "    {\"description\": \"...\", \"qty\": 2.0, \"unit_price\": 4.50, \"line_total\": 9.00}\n"
    "  ]\n"
    "}"
)


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


async def _extract_invoice(image_bytes: bytes, media_type: str) -> dict:
    """Send the photo to Claude vision and return the parsed dict.
    Bubbles up a friendly HTTPException on any failure path so the UI can
    show the manager exactly what went wrong."""
    from routes.ai_settings import get_active_ai_key, get_active_ai_provider
    api_key = get_active_ai_key()
    if not api_key:
        raise HTTPException(
            500,
            "AI invoice scan unavailable: no API key configured. Open Admin → AI Settings to add one.",
        )
    provider = get_active_ai_provider()

    # Anthropic supports JPEG/PNG/WEBP/GIF for vision. PDFs need a different
    # content block ("document") — fall back to text-only extraction on PDF.
    is_pdf = media_type == "application/pdf"
    if is_pdf:
        content = [
            {"type": "document", "source": {"type": "base64", "media_type": "application/pdf",
                                              "data": base64.b64encode(image_bytes).decode("ascii")}},
            {"type": "text", "text": "Extract the invoice fields per the system instructions."},
        ]
    else:
        # Default to image/jpeg if a phone capture comes through with an
        # odd content-type ("image/heic" etc). Claude will still try.
        anth_media = media_type if media_type in ("image/jpeg", "image/png", "image/webp", "image/gif") else "image/jpeg"
        content = [
            {"type": "image", "source": {"type": "base64", "media_type": anth_media,
                                          "data": base64.b64encode(image_bytes).decode("ascii")}},
            {"type": "text", "text": "Extract the invoice fields per the system instructions."},
        ]

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
        async with httpx.AsyncClient(timeout=120.0) as client:
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
        "subtotal": _coerce_num(parsed.get("subtotal")),
        "vat": _coerce_num(parsed.get("vat")),
        "total": _coerce_num(parsed.get("total")),
        "items": items,
    }


# ---------------------------------------------------------------------------
# CRUD endpoints
# ---------------------------------------------------------------------------

@router.get("")
async def list_invoices(
    location_id: Optional[str] = Query(None),
    supplier: Optional[str] = Query(None),
    user: dict = Depends(get_staff_or_above),
):
    """Newest invoices first. Staff are auto-scoped to their assigned location
    list when their account is linked to a staff record."""
    q: dict = {}
    if location_id:
        q["location_id"] = location_id
    if supplier:
        # Case-insensitive substring match — supplier names vary in case.
        q["supplier"] = {"$regex": re.escape(supplier), "$options": "i"}
    rows = list(invoices.find(q).sort("uploaded_at", -1).limit(500))
    return [_strip(r) for r in rows]


@router.post("/scan")
async def scan_invoice(
    file: UploadFile = File(...),
    location_id: str = Form(...),
    note: str = Form(""),
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
        "subtotal": 0.0, "vat": 0.0, "total": 0.0, "items": [],
    }
    ai_error = ""
    try:
        extracted = await _extract_invoice(blob, content_type)
    except HTTPException as e:
        ai_error = str(e.detail)
    except Exception as e:  # noqa: BLE001
        ai_error = f"AI extraction failed: {e}"

    now_iso = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4())[:12],
        "location_id": location_id,
        "supplier": extracted["supplier"],
        "invoice_number": extracted["invoice_number"],
        "invoice_date": extracted["invoice_date"],
        "subtotal": extracted["subtotal"],
        "vat": extracted["vat"],
        "total": extracted["total"],
        "items": extracted["items"],
        "note": (note or "").strip(),
        "file_id": str(file_id),
        "filename": file.filename or "invoice",
        "content_type": content_type,
        "size": len(blob),
        "uploaded_at": now_iso,
        "uploaded_by": user.get("email", ""),
        "uploaded_by_name": user.get("name", ""),
        "ai_status": "ok" if not ai_error else "failed",
        "ai_error": ai_error,
    }
    invoices.insert_one(dict(doc))
    return _strip(doc)


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
    try:
        gridfs_id = rec["file_id"]
        if not isinstance(gridfs_id, ObjectId):
            gridfs_id = ObjectId(gridfs_id)
        _fs.delete(gridfs_id)
    except Exception:
        pass  # tolerate orphan GridFS — metadata removal is the priority
    invoices.delete_one({"id": invoice_id})
    return {"deleted": True}
