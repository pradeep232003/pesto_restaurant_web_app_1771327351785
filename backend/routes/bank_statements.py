"""
Bank Statement splitter — Manager tool.

Managers upload a bank statement (PDF / CSV / XLSX). The file is stored
in GridFS, the raw text/rows are extracted locally, and Claude Sonnet
4.5 is asked to classify each transaction as Income vs Expense, tag a
category, and (for expenses) best-match the counter-party to a known
supplier already recorded in the invoices collection.

The parsed record is persisted per location and can be downloaded as an
XLSX with **two tabs** (Income + Expenses). All endpoints are admin
gated.

Endpoints (all under /api/admin/bank-statements):
  GET    /                — list statements for a location
  POST   /upload          — upload + AI split (returns the saved record)
  GET    /{id}            — full record incl. transactions
  GET    /{id}/xlsx       — download 2-tab XLSX
  GET    /{id}/file       — stream the raw uploaded file
  DELETE /{id}            — remove statement + file
"""
import base64
import csv
import io
import json
import logging
import re
import time
import uuid
from datetime import datetime, timezone
from typing import Any, List, Optional

import gridfs
import httpx
from bson import ObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from auth import get_admin_user
from db import db

router = APIRouter(prefix="/api/admin/bank-statements", tags=["bank-statements"])
_log = logging.getLogger("bank_statements")
_log.setLevel(logging.INFO)

_fs = gridfs.GridFS(db, collection="bank_statement_files")
statements = db["bank_statements"]
invoices_col = db["invoices"]

MAX_BYTES = 15 * 1024 * 1024  # 15 MB — bank statements are usually text-heavy

ALLOWED_CT = {
    "application/pdf",
    "text/csv",
    "application/csv",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    # some browsers send octet-stream for CSVs; we fall back on file extension
    "application/octet-stream",
    "text/plain",
}

EXPENSE_CATEGORIES = [
    "supplier", "wages", "rent", "utilities", "software",
    "repairs", "marketing", "equipment", "cleaning", "insurance",
    "bank_fees", "tax", "transfer", "other",
]

INCOME_CATEGORIES = [
    "sales", "delivery", "loyalty_topup", "refund_in",
    "grant", "transfer", "other",
]


def _strip(doc: dict) -> dict:
    out = {k: v for k, v in (doc or {}).items() if k != "_id"}
    if isinstance(out.get("file_id"), ObjectId):
        out["file_id"] = str(out["file_id"])
    return out


# ---------------------------------------------------------------------------
# File → text extraction
# ---------------------------------------------------------------------------

def _extract_text_pdf(blob: bytes) -> str:
    try:
        from pypdf import PdfReader
    except ImportError as e:
        raise HTTPException(
            500,
            f"PDF support unavailable on this server: {e}. Ask the developer to add "
            "'pypdf' to backend/requirements.txt and redeploy.",
        )
    reader = PdfReader(io.BytesIO(blob))
    pages = []
    for i, page in enumerate(reader.pages):
        try:
            txt = page.extract_text() or ""
        except Exception:
            txt = ""
        if txt.strip():
            pages.append(f"--- Page {i + 1} ---\n{txt}")
    return "\n\n".join(pages)


def _extract_text_csv(blob: bytes) -> str:
    # Try common encodings — bank exports are messy.
    for enc in ("utf-8-sig", "utf-8", "latin-1", "cp1252"):
        try:
            text = blob.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:
        raise HTTPException(400, "Could not decode CSV file")

    # Normalise to a plain TSV-ish string for the model — cheaper tokens
    # than raw CSV with random quoting.
    reader = csv.reader(io.StringIO(text))
    rows = list(reader)
    if not rows:
        return ""
    # Keep the first 800 rows only — anything more is very unusual for a
    # month's statement and blows the model context budget.
    rows = rows[:800]
    return "\n".join(["\t".join(str(c).strip() for c in r) for r in rows])


def _extract_text_xlsx(blob: bytes) -> str:
    import openpyxl
    wb = openpyxl.load_workbook(io.BytesIO(blob), read_only=True, data_only=True)
    parts = []
    for sheet in wb.worksheets:
        parts.append(f"--- Sheet: {sheet.title} ---")
        for i, row in enumerate(sheet.iter_rows(values_only=True)):
            if i > 800:
                parts.append("... (rows truncated)")
                break
            if any(c not in (None, "") for c in row):
                parts.append("\t".join("" if c is None else str(c).strip() for c in row))
    return "\n".join(parts)


def _extract_text(blob: bytes, content_type: str, filename: str) -> str:
    ct = (content_type or "").lower()
    name = (filename or "").lower()
    if ct == "application/pdf" or name.endswith(".pdf"):
        return _extract_text_pdf(blob)
    if name.endswith(".csv") or ct in ("text/csv", "application/csv", "text/plain"):
        return _extract_text_csv(blob)
    if name.endswith(".xlsx") or name.endswith(".xls") or "spreadsheet" in ct or "excel" in ct:
        return _extract_text_xlsx(blob)
    # Last-ditch: try PDF then CSV.
    try:
        return _extract_text_pdf(blob)
    except Exception:
        return _extract_text_csv(blob)


# ---------------------------------------------------------------------------
# AI classifier — Claude Sonnet 4.5 via raw httpx (Railway-safe)
# ---------------------------------------------------------------------------

_AI_SYSTEM = (
    "You are a UK bank-statement analyst for Jolly's Kafe, a hospitality "
    "business. You receive raw text extracted from a bank statement (PDF, "
    "CSV or XLSX). Your job is to identify EVERY financial transaction and "
    "return a strict JSON split of income vs expense.\n\n"
    "RULES:\n"
    "1. Output STRICT JSON, no markdown, no commentary.\n"
    "2. One row per transaction — never combine credits and debits into one "
    "row.\n"
    "3. Ignore running-balance rows and opening/closing balance summaries.\n"
    "4. Dates: return ISO YYYY-MM-DD. If year is missing, infer from the "
    "statement period; if impossible, use empty string ''.\n"
    "5. Amounts are positive floats with 2 decimals — the row's `type` field "
    "carries the direction ('income' or 'expense'). Strip currency symbols.\n"
    "6. `description` = the counterparty / merchant / reference line as "
    "printed. Trim whitespace but do NOT paraphrase.\n"
    "7. Best-guess a category slug (see lists below). If uncertain use "
    "'other'.\n"
    "8. For EXPENSES only: if the description clearly matches one of the "
    "KNOWN_SUPPLIERS list provided in the user message, copy that supplier "
    "name (verbatim) into `matched_supplier`. Otherwise return "
    "matched_supplier: ''.\n"
    "9. Currency defaults to GBP. Detect the statement's currency if visible "
    "and put it in the top-level `currency` field.\n\n"
    "EXPENSE CATEGORIES (slugs): supplier, wages, rent, utilities, software, "
    "repairs, marketing, equipment, cleaning, insurance, bank_fees, tax, "
    "transfer, other.\n"
    "INCOME CATEGORIES (slugs): sales, delivery, loyalty_topup, refund_in, "
    "grant, transfer, other.\n\n"
    "RESPONSE SHAPE:\n"
    "{\n"
    "  \"period_start\": \"YYYY-MM-DD or ''\",\n"
    "  \"period_end\":   \"YYYY-MM-DD or ''\",\n"
    "  \"account_ref\":  \"account name / number if visible, else ''\",\n"
    "  \"currency\":     \"GBP\",\n"
    "  \"transactions\": [\n"
    "    {\n"
    "      \"date\": \"YYYY-MM-DD\",\n"
    "      \"description\": \"AMAZON UK MARKETPL\",\n"
    "      \"amount\": 24.99,\n"
    "      \"type\": \"expense\",\n"
    "      \"category\": \"supplier\",\n"
    "      \"matched_supplier\": \"\"\n"
    "    }\n"
    "  ]\n"
    "}\n"
)


def _scrub_json(text: str) -> str:
    """Peel markdown fences off Claude's response so json.loads works."""
    text = text.strip()
    if text.startswith("```"):
        # ```json\n...\n``` or ```\n...\n```
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _known_suppliers(location_id: str) -> List[str]:
    """Distinct supplier names seen on invoices for this location."""
    try:
        names = invoices_col.distinct("supplier", {"location_id": location_id})
    except Exception:
        return []
    return sorted({(n or "").strip() for n in names if n and str(n).strip()})[:200]


def _chunk_text(text: str, target_size: int = 15_000) -> List[str]:
    """Split extracted statement text into ~15 kB chunks along natural
    page boundaries (`--- Page N ---` markers). Falls back to line-based
    chunking if no page markers are present (CSV/XLSX). Each chunk keeps
    the AI response well under the 8 000-token cap, and parallel calls
    stay comfortably under Cloudflare's 100 s ingress timeout.
    """
    if len(text) <= target_size:
        return [text]

    # Prefer page-marker splits — cleanest for PDFs.
    page_split = re.split(r"(?=--- Page \d+)", text)
    page_split = [p for p in page_split if p.strip()]

    # Fallback: split by lines if no markers detected.
    if len(page_split) <= 1:
        lines = text.splitlines()
        page_split = []
        cur: list = []
        cur_len = 0
        for ln in lines:
            cur.append(ln)
            cur_len += len(ln) + 1
            if cur_len >= target_size:
                page_split.append("\n".join(cur))
                cur, cur_len = [], 0
        if cur:
            page_split.append("\n".join(cur))

    # Now pack consecutive small pages together up to target_size.
    chunks: List[str] = []
    buf: list = []
    buf_len = 0
    for piece in page_split:
        piece_len = len(piece)
        if buf and buf_len + piece_len > target_size:
            chunks.append("".join(buf) if not buf[0].startswith("--- Page") else "\n".join(buf))
            buf, buf_len = [], 0
        buf.append(piece)
        buf_len += piece_len
    if buf:
        chunks.append("".join(buf) if not buf[0].startswith("--- Page") else "\n".join(buf))
    return [c.strip() for c in chunks if c.strip()]


async def _classify_chunk(chunk_text: str, chunk_idx: int, total_chunks: int,
                          supplier_hint: str, api_key: str, provider: str) -> dict:
    """Send a single chunk to Claude and return the parsed transactions
    (+ optional meta fields). Isolated in its own coroutine so multiple
    chunks can run in parallel via asyncio.gather().
    """
    import asyncio  # noqa: F401 — imported for context
    part_note = (
        f"NOTE: This is chunk {chunk_idx} of {total_chunks} from a larger bank "
        f"statement. Return transactions ONLY from THIS chunk. If period_start "
        f"/ period_end / account_ref / currency are visible in this chunk, "
        f"include them; otherwise return empty strings.\n\n"
        if total_chunks > 1 else ""
    )
    user_msg = (
        supplier_hint
        + part_note
        + "BANK STATEMENT TEXT:\n"
        + chunk_text
        + "\n\nReturn strict JSON per the system schema. No prose."
    )
    req = {
        "model": "claude-sonnet-4-5-20250929",
        "max_tokens": 8000,
        "system": _AI_SYSTEM,
        "messages": [{"role": "user", "content": user_msg}],
    }
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post("https://api.anthropic.com/v1/messages", json=req, headers=headers)

    if resp.status_code >= 400:
        try:
            err = resp.json().get("error", {}).get("message", resp.text)
        except Exception:
            err = resp.text
        raise HTTPException(500, f"AI provider error ({provider}, {resp.status_code}) on chunk {chunk_idx}: {err[:240]}")

    data = resp.json()
    out = "".join(
        block.get("text", "") for block in (data.get("content") or [])
        if block.get("type") == "text"
    ).strip()
    if not out:
        raise HTTPException(500, f"AI returned an empty response for chunk {chunk_idx}")
    try:
        return json.loads(_scrub_json(out))
    except json.JSONDecodeError as e:
        raise HTTPException(500, f"AI returned non-JSON on chunk {chunk_idx}: {e}")


async def _classify(text: str, location_id: str) -> dict:
    import asyncio
    from routes.ai_settings import get_active_ai_key, get_active_ai_provider
    api_key = get_active_ai_key()
    if not api_key:
        raise HTTPException(
            500,
            "AI bank-statement splitter unavailable: no API key configured. "
            "Open Admin → AI Settings to add one.",
        )
    provider = get_active_ai_provider()

    if not text or not text.strip():
        raise HTTPException(400, "Could not extract any text from the file")

    # Hard-cap total input at ~250 k chars (~60k tokens) — covers a full
    # year of transactions. Anything beyond is very unusual and would
    # bust the 200 k context anyway.
    if len(text) > 250_000:
        text = text[:250_000] + "\n\n... (truncated by server)"

    suppliers = _known_suppliers(location_id)
    supplier_hint = ""
    if suppliers:
        supplier_hint = (
            "KNOWN_SUPPLIERS (use exact match if the description clearly "
            "references one of these — expense rows only):\n- "
            + "\n- ".join(suppliers)
            + "\n\n"
        )

    chunks = _chunk_text(text, target_size=15_000)
    total = len(chunks)
    _log.info(
        "classify: text=%d chars, suppliers=%d, chunks=%d",
        len(text), len(suppliers), total,
    )

    # Bounded concurrency — 4 chunks in parallel keeps us under
    # Anthropic's per-tier rate limits while still finishing a 20-page
    # statement in ~30-40 s wall-clock.
    sem = asyncio.Semaphore(4)

    async def _one(idx_text):
        idx, chunk = idx_text
        async with sem:
            t0 = time.monotonic()
            try:
                res = await _classify_chunk(chunk, idx, total, supplier_hint, api_key, provider)
                dur = time.monotonic() - t0
                n = len(res.get("transactions") or []) if isinstance(res, dict) else 0
                _log.info("classify: chunk %d/%d OK in %.1fs · %d txns", idx, total, dur, n)
                return res
            except HTTPException as he:
                dur = time.monotonic() - t0
                _log.warning("classify: chunk %d/%d FAILED in %.1fs · %s", idx, total, dur, he.detail)
                raise
            except Exception as e:  # noqa: BLE001
                dur = time.monotonic() - t0
                snippet = (str(e) or e.__class__.__name__).splitlines()[0][:240]
                _log.exception("classify: chunk %d/%d CRASHED in %.1fs · %s", idx, total, dur, snippet)
                raise HTTPException(500, f"AI provider error ({provider}) on chunk {idx}: {snippet}")

    t_start = time.monotonic()
    try:
        parts = await asyncio.gather(*[_one((i + 1, c)) for i, c in enumerate(chunks)])
    except HTTPException:
        raise
    _log.info("classify: all %d chunks done in %.1fs", total, time.monotonic() - t_start)

    # Merge — first non-empty meta wins; concatenate transactions.
    merged: dict = {
        "period_start": "",
        "period_end": "",
        "account_ref": "",
        "currency": "GBP",
        "transactions": [],
    }
    for p in parts:
        if not isinstance(p, dict):
            continue
        for k in ("period_start", "period_end", "account_ref", "currency"):
            if not merged[k] and (p.get(k) or "").strip():
                merged[k] = (p.get(k) or "").strip()
        txns = p.get("transactions") or []
        if isinstance(txns, list):
            merged["transactions"].extend(txns)

    txns_raw = merged["transactions"]
    if not isinstance(txns_raw, list):
        raise HTTPException(500, "AI response missing 'transactions' array")

    txns: List[dict] = []
    for t in txns_raw:
        if not isinstance(t, dict):
            continue
        desc = (t.get("description") or "").strip()
        if not desc:
            continue
        try:
            amt = round(abs(float(t.get("amount") or 0)), 2)
        except (TypeError, ValueError):
            amt = 0.0
        if amt <= 0:
            continue
        ttype = (t.get("type") or "").strip().lower()
        if ttype not in ("income", "expense"):
            # Default to expense — safer for hospitality where most rows
            # are outgoings; manager can flip if needed.
            ttype = "expense"
        cat = (t.get("category") or "").strip().lower() or "other"
        if ttype == "expense" and cat not in EXPENSE_CATEGORIES:
            cat = "other"
        if ttype == "income" and cat not in INCOME_CATEGORIES:
            cat = "other"
        supplier = (t.get("matched_supplier") or "").strip() if ttype == "expense" else ""
        txns.append({
            "date": (t.get("date") or "").strip(),
            "description": desc,
            "amount": amt,
            "type": ttype,
            "category": cat,
            "matched_supplier": supplier,
        })

    # Deduplicate — parallel chunks with overlapping page splits could
    # theoretically emit the same row twice. Cheap fingerprint on
    # (date, description, amount, type).
    seen: set = set()
    deduped: List[dict] = []
    for t in txns:
        key = (t["date"], t["description"], t["amount"], t["type"])
        if key in seen:
            continue
        seen.add(key)
        deduped.append(t)

    return {
        "period_start": merged["period_start"],
        "period_end": merged["period_end"],
        "account_ref": merged["account_ref"],
        "currency": merged["currency"] or "GBP",
        "transactions": deduped,
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("")
async def list_statements(
    location_id: Optional[str] = None,
    user: dict = Depends(get_admin_user),
):
    q: dict = {}
    if location_id:
        q["location_id"] = location_id
    rows = list(statements.find(q, {"transactions": 0}).sort("uploaded_at", -1).limit(100))
    return {"items": [_strip(r) for r in rows]}


@router.post("/upload")
async def upload_statement(
    file: UploadFile = File(...),
    location_id: str = Form(...),
    user: dict = Depends(get_admin_user),
):
    if not location_id:
        raise HTTPException(400, "location_id is required")

    upload_t0 = time.monotonic()
    blob = await file.read()
    if not blob:
        raise HTTPException(400, "Empty file")
    if len(blob) > MAX_BYTES:
        raise HTTPException(400, f"File too large (max {MAX_BYTES // (1024 * 1024)} MB)")

    ct = file.content_type or "application/octet-stream"
    fname = file.filename or "statement"
    _log.info(
        "upload: user=%s file=%r size=%d ct=%s loc=%s",
        user.get("email", "?"), fname, len(blob), ct, location_id,
    )
    if ct not in ALLOWED_CT and not any(fname.lower().endswith(x) for x in (".pdf", ".csv", ".xlsx", ".xls")):
        raise HTTPException(400, f"Unsupported file type: {ct}. Upload PDF, CSV or XLSX.")

    # Extract raw text FIRST — cheapest failure to surface early.
    try:
        t_extract = time.monotonic()
        text = _extract_text(blob, ct, fname)
        _log.info("upload: extracted %d chars in %.1fs", len(text), time.monotonic() - t_extract)
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        _log.exception("upload: text extraction failed")
        raise HTTPException(400, f"Could not read the file — {e.__class__.__name__}: {str(e)[:200]}")

    if not text or not text.strip():
        raise HTTPException(
            400,
            "The file contained no readable text. Scanned/image-only PDFs "
            "aren't supported yet — please export a text-based PDF or CSV "
            "from your online banking.",
        )

    # Persist the file in GridFS so the manager can re-download the
    # original later if audit requires it.
    file_id = _fs.put(blob, filename=fname, content_type=ct)

    # AI split — this can take 30-60s for large statements.
    try:
        parsed = await _classify(text, location_id)
    except HTTPException as he:
        # Roll back the file so we don't leave orphan bytes when AI errors.
        try:
            _fs.delete(file_id)
        except Exception:
            pass
        _log.warning("upload: classify failed after %.1fs · %s", time.monotonic() - upload_t0, he.detail)
        raise
    except Exception as e:  # noqa: BLE001 — anything else we haven't anticipated
        try:
            _fs.delete(file_id)
        except Exception:
            pass
        _log.exception("upload: unexpected classify error")
        raise HTTPException(500, f"Unexpected AI error: {e.__class__.__name__}: {str(e)[:200]}")

    txns = parsed["transactions"]
    total_income = round(sum(t["amount"] for t in txns if t["type"] == "income"), 2)
    total_expense = round(sum(t["amount"] for t in txns if t["type"] == "expense"), 2)

    doc = {
        "id": str(uuid.uuid4())[:12],
        "location_id": location_id,
        "filename": fname,
        "content_type": ct,
        "size": len(blob),
        "file_id": file_id,
        "period_start": parsed["period_start"],
        "period_end": parsed["period_end"],
        "account_ref": parsed["account_ref"],
        "currency": parsed["currency"],
        "transactions": txns,
        "income_count": sum(1 for t in txns if t["type"] == "income"),
        "expense_count": sum(1 for t in txns if t["type"] == "expense"),
        "total_income": total_income,
        "total_expense": total_expense,
        "net": round(total_income - total_expense, 2),
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "uploaded_by": user.get("email", ""),
        "uploaded_by_name": user.get("name", ""),
    }
    statements.insert_one(dict(doc))
    _log.info(
        "upload: OK in %.1fs · %d income (£%.2f) · %d expense (£%.2f) · net £%.2f",
        time.monotonic() - upload_t0,
        doc["income_count"], doc["total_income"],
        doc["expense_count"], doc["total_expense"], doc["net"],
    )
    return _strip(doc)


@router.get("/{sid}")
async def get_statement(sid: str, user: dict = Depends(get_admin_user)):
    rec = statements.find_one({"id": sid})
    if not rec:
        raise HTTPException(404, "Not found")
    return _strip(rec)


@router.get("/{sid}/xlsx")
async def download_xlsx(sid: str, user: dict = Depends(get_admin_user)):
    rec = statements.find_one({"id": sid})
    if not rec:
        raise HTTPException(404, "Not found")

    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment

    wb = openpyxl.Workbook()

    header_font = Font(bold=True, color="FFFFFF")
    income_fill = PatternFill("solid", fgColor="34C759")
    expense_fill = PatternFill("solid", fgColor="FF3B30")
    center = Alignment(horizontal="center")

    def _write_sheet(ws, title, txns, fill):
        ws.title = title
        headers = ["Date", "Description", "Category", "Matched Supplier", "Amount"]
        for c, h in enumerate(headers, start=1):
            cell = ws.cell(row=1, column=c, value=h)
            cell.font = header_font
            cell.fill = fill
            cell.alignment = center
        # Column widths — description gets the widest slot.
        widths = [14, 60, 18, 30, 14]
        for i, w in enumerate(widths, start=1):
            ws.column_dimensions[openpyxl.utils.get_column_letter(i)].width = w
        for r, t in enumerate(txns, start=2):
            ws.cell(row=r, column=1, value=t.get("date", ""))
            ws.cell(row=r, column=2, value=t.get("description", ""))
            ws.cell(row=r, column=3, value=t.get("category", ""))
            ws.cell(row=r, column=4, value=t.get("matched_supplier", ""))
            amt_cell = ws.cell(row=r, column=5, value=float(t.get("amount") or 0))
            amt_cell.number_format = '"£"#,##0.00'
        # Totals row
        if txns:
            total_row = len(txns) + 2
            ws.cell(row=total_row, column=4, value="Total").font = Font(bold=True)
            total_cell = ws.cell(row=total_row, column=5, value=sum(float(t.get("amount") or 0) for t in txns))
            total_cell.font = Font(bold=True)
            total_cell.number_format = '"£"#,##0.00'
        ws.freeze_panes = "A2"

    income_txns = [t for t in rec.get("transactions", []) if t.get("type") == "income"]
    expense_txns = [t for t in rec.get("transactions", []) if t.get("type") == "expense"]

    ws1 = wb.active
    _write_sheet(ws1, "Income", income_txns, income_fill)

    ws2 = wb.create_sheet(title="Expenses")
    _write_sheet(ws2, "Expenses", expense_txns, expense_fill)

    # Optional summary sheet
    ws3 = wb.create_sheet(title="Summary")
    ws3.column_dimensions["A"].width = 24
    ws3.column_dimensions["B"].width = 28
    summary_rows = [
        ("File", rec.get("filename", "")),
        ("Location", rec.get("location_id", "")),
        ("Period start", rec.get("period_start", "")),
        ("Period end", rec.get("period_end", "")),
        ("Account", rec.get("account_ref", "")),
        ("Currency", rec.get("currency", "GBP")),
        ("Income transactions", rec.get("income_count", 0)),
        ("Expense transactions", rec.get("expense_count", 0)),
        ("Total income", float(rec.get("total_income") or 0)),
        ("Total expense", float(rec.get("total_expense") or 0)),
        ("Net", float(rec.get("net") or 0)),
        ("Uploaded at", rec.get("uploaded_at", "")),
        ("Uploaded by", rec.get("uploaded_by_name") or rec.get("uploaded_by", "")),
    ]
    for r, (label, val) in enumerate(summary_rows, start=1):
        ws3.cell(row=r, column=1, value=label).font = Font(bold=True)
        ws3.cell(row=r, column=2, value=val)
        if label in ("Total income", "Total expense", "Net"):
            ws3.cell(row=r, column=2).number_format = '"£"#,##0.00'

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    # Filename — human-friendly, no spaces.
    stem = re.sub(r"[^A-Za-z0-9._-]+", "_", (rec.get("filename") or "statement").rsplit(".", 1)[0])[:60]
    out_name = f"{stem}_split.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{out_name}"'},
    )


@router.get("/{sid}/file")
async def download_original(sid: str, user: dict = Depends(get_admin_user)):
    rec = statements.find_one({"id": sid})
    if not rec:
        raise HTTPException(404, "Not found")
    fid = rec.get("file_id")
    if not fid:
        raise HTTPException(404, "File missing")
    try:
        gf = _fs.get(fid if isinstance(fid, ObjectId) else ObjectId(str(fid)))
    except Exception:
        raise HTTPException(404, "File missing")
    return StreamingResponse(
        io.BytesIO(gf.read()),
        media_type=rec.get("content_type") or "application/octet-stream",
        headers={"Content-Disposition": f'inline; filename="{rec.get("filename") or "statement"}"'},
    )


@router.delete("/{sid}")
async def delete_statement(sid: str, user: dict = Depends(get_admin_user)):
    rec = statements.find_one({"id": sid})
    if not rec:
        raise HTTPException(404, "Not found")
    fid = rec.get("file_id")
    if fid:
        try:
            _fs.delete(fid if isinstance(fid, ObjectId) else ObjectId(str(fid)))
        except Exception:
            pass
    statements.delete_one({"id": sid})
    return {"deleted": True}
