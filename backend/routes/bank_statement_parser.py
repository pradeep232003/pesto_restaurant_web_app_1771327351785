"""
Python-based bank-statement parser — free of AI tokens.

Strategy per file type:

* CSV  → pandas.read_csv, look for Paid In / Paid Out / Money In / Money Out
        / Credit / Debit / Amount columns by header keyword. Deterministic.
* XLSX → openpyxl, same header-keyword approach as CSV.
* PDF  → try `pypdf` layout mode + regex parsing first (cheap, no deps
         beyond what we already ship). If it yields no transactions on a
         page, fall back to `pdfplumber` table extraction per page.

Every extracted row is then run through a small keyword-based
categoriser (see `_CATEGORY_RULES`) and — if no supplier tagged — the
existing fuzzy `_match_supplier()` helper from `bank_statements.py`.

Public API:
    parse_locally(blob: bytes, content_type: str, filename: str,
                  suppliers: List[str]) -> dict

Returned dict shape mirrors what the AI classifier used to return:
    { period_start, period_end, account_ref, currency, transactions[] }
    each transaction: { date, description, amount, type, category,
                        matched_supplier }
"""
from __future__ import annotations

import csv
import io
import logging
import re
from datetime import datetime
from typing import Callable, List, Optional, Tuple

_log = logging.getLogger("bank_statements.parser")


# ---------------------------------------------------------------------------
# Category rules — first match wins. Add more here or via a future admin UI.
# ---------------------------------------------------------------------------
# We store patterns pre-compiled for speed on large statements.
_CATEGORY_RULES: List[Tuple[re.Pattern, str, str]] = [
    # Wages / payroll
    (re.compile(r"\b(PAYROLL|SALARY|WAGES|HMRC\s*PAYE|NI\s*CONTRIB|PENSION\s+CONTR)\b", re.I), "expense", "wages"),
    # Utilities
    (re.compile(r"\b(BRITISH\s*GAS|BULB|OCTOPUS|E\.?ON|EDF|OVO|SCOTTISH\s*POWER|NPOWER|SSE|SHELL\s*ENERGY|UNITED\s*UTIL|SEVERN\s*TRENT|THAMES\s*WATER|GAS|ELECTRIC|WATER\s*BILL)\b", re.I), "expense", "utilities"),
    # Rent
    (re.compile(r"\b(RENT|LEASE|LANDLORD)\b", re.I), "expense", "rent"),
    # Software / SaaS
    (re.compile(r"\b(ADOBE|MICROSOFT|GOOGLE\s*WORKSPACE|GSUITE|SLACK|CANVA|XERO|QUICKBOOKS|SAGE|STRIPE\s*FEE|SHOPIFY|SQUARESPACE|NOTION|ATLASSIAN|LINEAR|CLOUDFLARE|VERCEL|RAILWAY|AWS|AZURE)\b", re.I), "expense", "software"),
    # Marketing / ads
    (re.compile(r"\b(FACEBOOK\s*ADS|META\s*ADS|GOOGLE\s*ADS|LINKEDIN\s*ADS|TIKTOK\s*ADS|MAILCHIMP|KLAVIYO|PRINT.*FLYER|MARKETING)\b", re.I), "expense", "marketing"),
    # Cleaning
    (re.compile(r"\b(JANITOR|CLEANING|LAUNDR)\b", re.I), "expense", "cleaning"),
    # Repairs / maintenance
    (re.compile(r"\b(REPAIR|MAINTENANCE|FIX|ENGINEER|PLUMB|ELECTRICIAN)\b", re.I), "expense", "repairs"),
    # Insurance
    (re.compile(r"\b(INSURANCE|AXA|AVIVA|HISCOX|SIMPLYBUSINESS)\b", re.I), "expense", "insurance"),
    # Bank fees
    (re.compile(r"\b(BANK\s*FEE|CHARGE|OVERDRAFT|INTEREST\s*CHARGE|SERVICE\s*FEE)\b", re.I), "expense", "bank_fees"),
    # Tax
    (re.compile(r"\b(HMRC\s*(?!PAYE)|VAT\s*PAYM|CORPORATION\s*TAX|COUNCIL\s*TAX)\b", re.I), "expense", "tax"),
    # Suppliers (food & bev wholesalers common in UK hospitality)
    (re.compile(r"\b(BIDFOOD|BIDVEST|BOOKER|BRAKES|SYSCO|COSTCO|AMAZON|EBAY|AMZN|MAKRO|COLES|JJ\s*FOOD|APOLLO|MATTHEW\s*CLARK|MOLSON|HEINEKEN|COCA\s*COLA|PEPSI|NESTLE|UNILEVER)\b", re.I), "expense", "supplier"),
    # Transfers between accounts
    (re.compile(r"\b(TRANSFER|TFR|MOVE|INTERNAL)\b", re.I), "expense", "transfer"),

    # ------------------- Income ----------------------
    (re.compile(r"\b(SUMUP|IZETTLE|SQUARE|STRIPE\s*PAYOUT|WORLDPAY|GLOBALPAY|CARD\s*PAYMENT|POS)\b", re.I), "income", "sales"),
    (re.compile(r"\b(DELIVEROO|UBER\s*EATS|JUST\s*EAT|FOOD\s*HUB|SLERP)\b", re.I), "income", "delivery"),
    (re.compile(r"\b(GRANT|SUBSIDY|LOCAL\s*AUTHORITY|COUNCIL\s*GRANT)\b", re.I), "income", "grant"),
    (re.compile(r"\b(REFUND\s*RECEIVED|REVERSAL)\b", re.I), "income", "refund_in"),
]


def _categorise(description: str, txn_type: str) -> str:
    """Return a category slug for a transaction description. Rules are
    typed (income vs expense) so a "HMRC PAYE" credit doesn't get
    mis-tagged as an income-side category and vice-versa."""
    if not description:
        return "other"
    for pattern, rule_type, cat in _CATEGORY_RULES:
        if rule_type != txn_type:
            continue
        if pattern.search(description):
            return cat
    return "other"


# ---------------------------------------------------------------------------
# Date normalisation — bank statements print dates in many formats.
# ---------------------------------------------------------------------------
_DATE_PATTERNS = [
    # ISO
    ("%Y-%m-%d", re.compile(r"\b(\d{4}-\d{2}-\d{2})\b")),
    # UK dd/mm/yyyy or dd/mm/yy
    ("%d/%m/%Y", re.compile(r"\b(\d{1,2}/\d{1,2}/\d{4})\b")),
    ("%d/%m/%y", re.compile(r"\b(\d{1,2}/\d{1,2}/\d{2})\b")),
    # UK dd-mm-yyyy
    ("%d-%m-%Y", re.compile(r"\b(\d{1,2}-\d{1,2}-\d{4})\b")),
    # dd MMM yyyy or dd Mmm yy
    ("%d %b %Y", re.compile(r"\b(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\b")),
    ("%d %b %y", re.compile(r"\b(\d{1,2}\s+[A-Za-z]{3}\s+\d{2})\b")),
    # dd Mmm (no year) — will patch year later using statement period
    ("%d %b", re.compile(r"\b(\d{1,2}\s+[A-Za-z]{3})\b")),
]


def _parse_date(raw: str, fallback_year: Optional[int] = None) -> str:
    """Return ISO YYYY-MM-DD or '' if the string doesn't look like a date."""
    if not raw:
        return ""
    raw = raw.strip()
    for fmt, pat in _DATE_PATTERNS:
        m = pat.search(raw)
        if not m:
            continue
        try:
            dt = datetime.strptime(m.group(1), fmt)
            if fmt == "%d %b" and fallback_year:
                dt = dt.replace(year=fallback_year)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue
    return ""


# ---------------------------------------------------------------------------
# Amount parsing — strip £/,/CR/DR/+/- and return (value, direction).
# ---------------------------------------------------------------------------
_AMOUNT_RE = re.compile(r"[\-+]?[\d,]+\.\d{2}")


def _parse_amount(raw: str) -> Optional[float]:
    """Parse a UK-style amount string to float, or None if not a number."""
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    s = s.replace("£", "").replace(",", "").replace(" ", "")
    # Handle bracketed negatives "(12.34)"
    negative = False
    if s.startswith("(") and s.endswith(")"):
        s = s[1:-1]
        negative = True
    if s.upper().endswith("CR"):
        s = s[:-2]
    elif s.upper().endswith("DR"):
        s = s[:-2]
        negative = True
    if s.startswith("-"):
        s = s[1:]
        negative = True
    elif s.startswith("+"):
        s = s[1:]
    try:
        v = float(s)
    except ValueError:
        return None
    return -v if negative else v


# ---------------------------------------------------------------------------
# Header keyword detection — used by CSV/XLSX and PDF parsers alike.
# ---------------------------------------------------------------------------
_HEADER_PAID_IN = re.compile(r"\b(paid\s*in|money\s*in|credit|receipts?|\bin\b)\b", re.I)
_HEADER_PAID_OUT = re.compile(r"\b(paid\s*out|money\s*out|debit|payments?|withdraw|\bout\b)\b", re.I)
_HEADER_AMOUNT = re.compile(r"\b(amount|value)\b", re.I)
_HEADER_BALANCE = re.compile(r"\b(balance|running\s*balance)\b", re.I)
_HEADER_DATE = re.compile(r"\b(date|posting|transaction\s*date)\b", re.I)
_HEADER_DESC = re.compile(r"\b(description|details|payee|reference|narrative|memo)\b", re.I)


def _classify_header_cell(cell: str) -> str:
    """Return a canonical column tag for a header cell text.
    Returns one of 'date', 'desc', 'paid_in', 'paid_out', 'amount',
    'balance', or '' (unknown)."""
    if not cell:
        return ""
    c = cell.strip()
    if _HEADER_BALANCE.search(c):
        return "balance"
    if _HEADER_PAID_IN.search(c) and "out" not in c.lower():
        return "paid_in"
    if _HEADER_PAID_OUT.search(c):
        return "paid_out"
    if _HEADER_AMOUNT.search(c):
        return "amount"
    if _HEADER_DATE.search(c):
        return "date"
    if _HEADER_DESC.search(c):
        return "desc"
    return ""


# ---------------------------------------------------------------------------
# CSV / XLSX row-based parsers.
# ---------------------------------------------------------------------------

def _rows_to_txns(rows: List[List[str]]) -> List[dict]:
    """Turn a list of CSV/XLSX rows into transaction dicts.

    Finds the header row (first row containing at least two of
    date/desc/paid_in/paid_out/amount/balance tags), then parses every
    subsequent row using the same column tags.
    """
    if not rows:
        return []

    # Locate the header row
    header_idx = None
    header_tags: List[str] = []
    for i, row in enumerate(rows[:30]):  # only look in first 30 rows
        tags = [_classify_header_cell(str(c) if c is not None else "") for c in row]
        hits = sum(1 for t in tags if t)
        # Need at least two recognised header columns to be confident
        if hits >= 2 and (
            "date" in tags or "amount" in tags or "paid_in" in tags or "paid_out" in tags
        ):
            header_idx = i
            header_tags = tags
            break
    if header_idx is None:
        return []

    # Column indices for each tag
    col = {tag: header_tags.index(tag) for tag in set(header_tags) if tag}

    txns: List[dict] = []
    for raw in rows[header_idx + 1:]:
        if not any((c not in (None, "")) for c in raw):
            continue
        cells = [str(c).strip() if c is not None else "" for c in raw]

        # Skip rows that don't look like transactions (e.g. sub-totals)
        date_cell = cells[col["date"]] if "date" in col and col["date"] < len(cells) else ""
        date_iso = _parse_date(date_cell)
        if not date_iso:
            continue
        desc_cell = cells[col["desc"]] if "desc" in col and col["desc"] < len(cells) else ""
        # Combine remaining unclassified cells into description if no
        # explicit description column exists.
        if not desc_cell:
            known = set(col.values())
            desc_cell = " ".join(cells[i] for i in range(len(cells)) if i not in known).strip()

        pin = _parse_amount(cells[col["paid_in"]]) if "paid_in" in col and col["paid_in"] < len(cells) else None
        pout = _parse_amount(cells[col["paid_out"]]) if "paid_out" in col and col["paid_out"] < len(cells) else None
        amt_raw = _parse_amount(cells[col["amount"]]) if "amount" in col and col["amount"] < len(cells) else None

        ttype = None
        amt = 0.0
        if pin is not None and pin > 0:
            ttype, amt = "income", pin
        elif pout is not None and pout > 0:
            ttype, amt = "expense", pout
        elif amt_raw is not None:
            # Single-column amount — sign carries direction.
            ttype = "income" if amt_raw > 0 else "expense"
            amt = abs(amt_raw)
        if not ttype or amt <= 0:
            continue

        txns.append({
            "date": date_iso,
            "description": desc_cell,
            "amount": round(amt, 2),
            "type": ttype,
            "category": "",
            "matched_supplier": "",
        })
    return txns


def parse_csv(blob: bytes) -> List[dict]:
    for enc in ("utf-8-sig", "utf-8", "latin-1", "cp1252"):
        try:
            text = blob.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:
        return []
    reader = csv.reader(io.StringIO(text))
    rows = [row for row in reader]
    return _rows_to_txns(rows)


def parse_xlsx(blob: bytes) -> List[dict]:
    import openpyxl
    wb = openpyxl.load_workbook(io.BytesIO(blob), read_only=True, data_only=True)
    all_txns: List[dict] = []
    for sheet in wb.worksheets:
        rows = [list(r) for r in sheet.iter_rows(values_only=True)]
        all_txns.extend(_rows_to_txns(rows))
    return all_txns


# ---------------------------------------------------------------------------
# PDF parsing.  Two strategies:
#   1. pypdf layout-mode text → column-position regex parse (fast, no deps)
#   2. pdfplumber table extraction (accurate, slower, needs pdfplumber)
# ---------------------------------------------------------------------------

_LINE_STARTS_WITH_DATE = re.compile(
    r"^\s*(\d{1,2}[\s/\-][A-Za-z]{3}(?:[\s/\-]\d{2,4})?|\d{1,2}/\d{1,2}/\d{2,4}|\d{4}-\d{2}-\d{2})\b"
)


def _parse_pdf_layout_text(text: str) -> List[dict]:
    """Parse pypdf-layout-mode text into transactions.

    Strategy: scan for a header row (contains "Paid in" and "Paid out",
    or "Money in"/"Money out", or "Credit"+"Debit"+"Balance").
    Record the CHARACTER positions of each column header. Then for every
    following line that starts with a date, slice by those char positions
    to extract the amounts.
    """
    lines = text.split("\n")
    txns: List[dict] = []
    header_positions: Optional[dict] = None
    fallback_year: Optional[int] = None

    # Detect fallback year from the top of the doc (e.g. "Statement 2026-03-01")
    for line in lines[:40]:
        m = re.search(r"\b(20\d{2})\b", line)
        if m:
            fallback_year = int(m.group(1))
            break

    def _find_header(line: str) -> Optional[dict]:
        low = line.lower()
        # Different bank templates
        signals = [
            ("paid in", "paid out"),
            ("money in", "money out"),
            ("credit", "debit"),
        ]
        for pin_lbl, pout_lbl in signals:
            if pin_lbl in low and pout_lbl in low:
                pos_in = low.find(pin_lbl)
                pos_out = low.find(pout_lbl)
                pos_bal = low.find("balance") if "balance" in low else -1
                return {"in": pos_in, "out": pos_out, "bal": pos_bal, "labels": (pin_lbl, pout_lbl)}
        return None

    for i, line in enumerate(lines):
        if header_positions is None:
            hp = _find_header(line)
            if hp:
                header_positions = hp
            continue

        if not _LINE_STARTS_WITH_DATE.match(line):
            continue

        # Extract all "amount-shaped" numbers on the line with their
        # character positions. Amounts must have 2 decimals to distinguish
        # from account numbers, reference IDs, etc.
        matches = list(_AMOUNT_RE.finditer(line))
        if not matches:
            continue

        # Determine which amount is Paid In vs Paid Out vs Balance by
        # nearest-column-position matching.
        pos_in = header_positions["in"]
        pos_out = header_positions["out"]
        pos_bal = header_positions["bal"]

        pin_val: Optional[float] = None
        pout_val: Optional[float] = None
        for m in matches:
            v = _parse_amount(m.group(0))
            if v is None:
                continue
            center = (m.start() + m.end()) // 2
            # Distance to each header column
            d_in = abs(center - pos_in) if pos_in >= 0 else 10_000
            d_out = abs(center - pos_out) if pos_out >= 0 else 10_000
            d_bal = abs(center - pos_bal) if pos_bal >= 0 else 10_000
            nearest = min([("in", d_in), ("out", d_out), ("bal", d_bal)], key=lambda x: x[1])
            if nearest[1] > 15:  # not clearly aligned to any header
                continue
            if nearest[0] == "in" and pin_val is None:
                pin_val = abs(v)
            elif nearest[0] == "out" and pout_val is None:
                pout_val = abs(v)
            # bal is ignored — running balance is not a transaction.

        if pin_val is None and pout_val is None:
            continue

        # Date + description
        date_m = _LINE_STARTS_WITH_DATE.match(line)
        date_raw = date_m.group(0).strip() if date_m else ""
        date_iso = _parse_date(date_raw, fallback_year=fallback_year)
        if not date_iso:
            continue
        # Description = text after the date, up to the first amount
        after_date = line[len(date_m.group(0)):] if date_m else line
        first_amt_pos = matches[0].start() - (len(line) - len(after_date))
        if first_amt_pos < 0:
            first_amt_pos = None
        desc = (after_date[:first_amt_pos] if first_amt_pos else after_date).strip()

        if pin_val is not None:
            txns.append({
                "date": date_iso, "description": desc, "amount": round(pin_val, 2),
                "type": "income", "category": "", "matched_supplier": "",
            })
        if pout_val is not None:
            txns.append({
                "date": date_iso, "description": desc, "amount": round(pout_val, 2),
                "type": "expense", "category": "", "matched_supplier": "",
            })

    return txns


def _parse_pdf_pypdf(blob: bytes) -> List[dict]:
    """First-pass PDF parser: pypdf layout mode + column-position slice."""
    try:
        from pypdf import PdfReader
    except ImportError:
        return []
    reader = PdfReader(io.BytesIO(blob))
    all_txns: List[dict] = []
    for page in reader.pages:
        try:
            text = page.extract_text(extraction_mode="layout") or ""
        except Exception:
            try:
                text = page.extract_text() or ""
            except Exception:
                text = ""
        if text.strip():
            all_txns.extend(_parse_pdf_layout_text(text))
    return all_txns


def _parse_pdf_pdfplumber(blob: bytes) -> List[dict]:
    """Fallback: pdfplumber table extraction. Runs per-page so we can
    salvage what we can even if some pages have unusual layouts."""
    try:
        import pdfplumber
    except ImportError:
        return []

    all_txns: List[dict] = []
    with pdfplumber.open(io.BytesIO(blob)) as pdf:
        for page in pdf.pages:
            try:
                tables = page.extract_tables() or []
            except Exception:
                tables = []
            for table in tables:
                # Each table is a list of rows; treat rows as CSV rows
                all_txns.extend(_rows_to_txns(table))
    return all_txns


def parse_pdf(blob: bytes) -> Tuple[List[dict], str]:
    """Return (transactions, strategy_used). Strategy is 'pypdf' or
    'pdfplumber' — mostly for logging."""
    txns = _parse_pdf_pypdf(blob)
    if len(txns) >= 3:  # sanity threshold — 3+ txns = real statement
        return txns, "pypdf"
    _log.info("parser: pypdf yielded only %d txns, trying pdfplumber", len(txns))
    txns2 = _parse_pdf_pdfplumber(blob)
    if len(txns2) > len(txns):
        return txns2, "pdfplumber"
    return txns, "pypdf-thin"


# ---------------------------------------------------------------------------
# Public entrypoint.
# ---------------------------------------------------------------------------

def parse_locally(
    blob: bytes,
    content_type: str,
    filename: str,
    suppliers: List[str],
    supplier_matcher: Optional[Callable[[str, List[str]], str]] = None,
) -> dict:
    """Parse a statement file into a canonical dict. Falls back across
    strategies. Raises ValueError if nothing could be extracted.

    `supplier_matcher` — pass in bank_statements._match_supplier so we
    don't create a circular import.
    """
    ct = (content_type or "").lower()
    name = (filename or "").lower()
    strategy = ""

    if ct == "application/pdf" or name.endswith(".pdf"):
        txns, strategy = parse_pdf(blob)
    elif name.endswith(".csv") or ct in ("text/csv", "application/csv", "text/plain"):
        txns = parse_csv(blob)
        strategy = "csv"
    elif (
        name.endswith(".xlsx") or name.endswith(".xls")
        or "spreadsheet" in ct or "excel" in ct
    ):
        txns = parse_xlsx(blob)
        strategy = "xlsx"
    else:
        # Try each in turn
        txns, strategy = parse_pdf(blob)
        if not txns:
            txns = parse_csv(blob)
            strategy = "csv-fallback"
        if not txns:
            txns = parse_xlsx(blob)
            strategy = "xlsx-fallback"

    if not txns:
        raise ValueError(
            "Couldn't find any transactions in this file. If it's an "
            "unusual PDF, try uploading a CSV/XLSX export from your "
            "online banking, or click 'Re-classify with AI' after upload."
        )

    # Enrich each row with category + supplier
    for t in txns:
        t["category"] = _categorise(t["description"], t["type"])
        if t["type"] == "expense" and not t["matched_supplier"] and suppliers and supplier_matcher:
            t["matched_supplier"] = supplier_matcher(t["description"], suppliers)

    # Deduplicate — same (date, description, amount, type) can appear twice
    # from two overlapping strategies.
    seen = set()
    deduped: List[dict] = []
    for t in txns:
        k = (t["date"], t["description"], t["amount"], t["type"])
        if k in seen:
            continue
        seen.add(k)
        deduped.append(t)

    # Statement metadata: infer period from txn date range.
    dates = sorted({t["date"] for t in deduped if t.get("date")})
    period_start = dates[0] if dates else ""
    period_end = dates[-1] if dates else ""

    _log.info("parser: %s → %d txns (%s)", strategy, len(deduped), filename)

    return {
        "period_start": period_start,
        "period_end": period_end,
        "account_ref": "",
        "currency": "GBP",
        "transactions": deduped,
        "_strategy": strategy,
    }
