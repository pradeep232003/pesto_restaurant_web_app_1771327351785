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
# Category rules — first match wins. Each rule has a human-friendly label
# that ends up in the "Rule fired" column of the download so you can see
# exactly which pattern classified each expense (invaluable for spotting
# rules that need updating).
# ---------------------------------------------------------------------------
# Tuple shape: (label, compiled pattern, txn_type, category_slug)
_CATEGORY_RULES: List[Tuple[str, re.Pattern, str, str]] = [
    # Wages / payroll
    ("wages: payroll/PAYE", re.compile(r"\b(PAYROLL|SALARY|WAGES|HMRC\s*PAYE|NI\s*CONTRIB|PENSION\s+CONTR)\b", re.I), "expense", "wages"),
    # Utilities
    ("utilities: energy/water", re.compile(r"\b(BRITISH\s*GAS|BULB|OCTOPUS|E\.?ON|EDF|OVO|SCOTTISH\s*POWER|NPOWER|SSE|SHELL\s*ENERGY|UNITED\s*UTIL|SEVERN\s*TRENT|THAMES\s*WATER|GAS|ELECTRIC|WATER\s*BILL)\b", re.I), "expense", "utilities"),
    # Rent
    ("rent/lease", re.compile(r"\b(RENT|LEASE|LANDLORD)\b", re.I), "expense", "rent"),
    # Software / SaaS
    ("software: SaaS/hosting", re.compile(r"\b(ADOBE|MICROSOFT|GOOGLE\s*WORKSPACE|GSUITE|SLACK|CANVA|XERO|QUICKBOOKS|SAGE|STRIPE\s*FEE|SHOPIFY|SQUARESPACE|NOTION|ATLASSIAN|LINEAR|CLOUDFLARE|VERCEL|RAILWAY|AWS|AZURE)\b", re.I), "expense", "software"),
    # Marketing / ads
    ("marketing/ads", re.compile(r"\b(FACEBOOK\s*ADS|META\s*ADS|GOOGLE\s*ADS|LINKEDIN\s*ADS|TIKTOK\s*ADS|MAILCHIMP|KLAVIYO|PRINT.*FLYER|MARKETING)\b", re.I), "expense", "marketing"),
    # Cleaning
    ("cleaning/laundry", re.compile(r"\b(JANITOR|CLEANING|LAUNDR)\b", re.I), "expense", "cleaning"),
    # Repairs / maintenance
    ("repairs/maintenance", re.compile(r"\b(REPAIR|MAINTENANCE|FIX|ENGINEER|PLUMB|ELECTRICIAN)\b", re.I), "expense", "repairs"),
    # Insurance
    ("insurance", re.compile(r"\b(INSURANCE|AXA|AVIVA|HISCOX|SIMPLYBUSINESS)\b", re.I), "expense", "insurance"),
    # Bank fees
    ("bank fees/charges", re.compile(r"\b(BANK\s*FEE|CHARGE|OVERDRAFT|INTEREST\s*CHARGE|SERVICE\s*FEE)\b", re.I), "expense", "bank_fees"),
    # Tax
    ("tax: HMRC/VAT/council", re.compile(r"\b(HMRC\s*(?!PAYE)|VAT\s*PAYM|CORPORATION\s*TAX|COUNCIL\s*TAX)\b", re.I), "expense", "tax"),
    # Suppliers (food & bev wholesalers common in UK hospitality)
    ("supplier: hospitality wholesalers", re.compile(r"\b(BIDFOOD|BIDVEST|BOOKER|BRAKES|SYSCO|COSTCO|AMAZON|EBAY|AMZN|MAKRO|COLES|JJ\s*FOOD|APOLLO|MATTHEW\s*CLARK|MOLSON|HEINEKEN|COCA\s*COLA|PEPSI|NESTLE|UNILEVER)\b", re.I), "expense", "supplier"),
    # Transfers between accounts
    ("internal transfer", re.compile(r"\b(TRANSFER|TFR|MOVE|INTERNAL)\b", re.I), "expense", "transfer"),

    # ------------------- Income ----------------------
    ("sales: card/POS", re.compile(r"\b(SUMUP|IZETTLE|SQUARE|STRIPE\s*PAYOUT|WORLDPAY|GLOBALPAY|CARD\s*PAYMENT|POS)\b", re.I), "income", "sales"),
    ("delivery platforms", re.compile(r"\b(DELIVEROO|UBER\s*EATS|JUST\s*EAT|FOOD\s*HUB|SLERP)\b", re.I), "income", "delivery"),
    ("grant/subsidy", re.compile(r"\b(GRANT|SUBSIDY|LOCAL\s*AUTHORITY|COUNCIL\s*GRANT)\b", re.I), "income", "grant"),
    ("refund received", re.compile(r"\b(REFUND\s*RECEIVED|REVERSAL)\b", re.I), "income", "refund_in"),
]


def get_builtin_rules() -> List[dict]:
    """Expose the immutable built-in rules so the Manager UI can show them
    alongside the user-added custom rules for context."""
    return [
        {"label": label, "pattern": pat.pattern, "type": rtype, "category": cat, "builtin": True}
        for label, pat, rtype, cat in _CATEGORY_RULES
    ]


def compile_custom_rule(pattern: str, mode: str = "simple") -> re.Pattern:
    """Turn a user-typed rule pattern into a compiled regex.

    * mode='simple' — treat the pattern as a keyword. Each whitespace
      run in the input becomes `\\s+`, everything else is regex-escaped,
      and the whole thing is wrapped in `\\b...\\b` so it matches whole
      words only. Case-insensitive.
    * mode='regex' — trust the user's regex as-is. Case-insensitive.
    """
    p = (pattern or "").strip()
    if not p:
        raise ValueError("Pattern is empty")
    if mode == "regex":
        return re.compile(p, re.I)
    # simple: keyword mode
    tokens = [re.escape(tok) for tok in p.split() if tok]
    if not tokens:
        raise ValueError("Pattern has no usable tokens")
    return re.compile(r"\b" + r"\s+".join(tokens) + r"\b", re.I)


def _categorise(description: str, txn_type: str, custom_rules: Optional[List[dict]] = None) -> Tuple[str, str]:
    """Return (category_slug, rule_label). Rule label is a human-friendly
    description of which pattern matched — surfaces in the download's
    'Rule fired' column so managers can see *why* each row landed where
    it did, and spot missing rules (rows with 'no match → other').

    Custom rules (from the Manager 'Bank Rules' screen) are checked
    FIRST so users can override built-in classifications for their own
    merchant idiosyncrasies.
    """
    if not description:
        return "other", "no match → other"
    # Custom rules first — user overrides win
    for r in (custom_rules or []):
        if r.get("type") != txn_type:
            continue
        pattern = r.get("_compiled")
        if pattern is None:
            continue
        try:
            if pattern.search(description):
                return r.get("category", "other"), f"custom: {r.get('label', 'unlabelled')}"
        except Exception:
            continue
    # Built-in rules
    for label, pattern, rule_type, cat in _CATEGORY_RULES:
        if rule_type != txn_type:
            continue
        if pattern.search(description):
            return cat, label
    return "other", "no match → other"


# ---------------------------------------------------------------------------
# Date normalisation — bank statements print dates in many formats.
# ---------------------------------------------------------------------------
_DATE_PATTERNS = [
    # DD/MM/YYYY HH:MM (Tide, Starling, some Barclays exports)
    ("%d/%m/%Y %H:%M", re.compile(r"\b(\d{1,2}/\d{1,2}/\d{4}\s+\d{1,2}:\d{2})\b")),
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
_HEADER_DESC = re.compile(r"\b(description|details|payee|reference|narrative|memo|transaction\s*description)\b", re.I)
_HEADER_TXN_TYPE = re.compile(r"\b(transaction\s*type|type|txn\s*type|tt|payment\s*type)\b", re.I)
_HEADER_CATEGORY = re.compile(r"\b(category\s*name|category|classification|nominal|account\s*type)\b", re.I)

# Common transaction-type codes UK banks print in a dedicated column.
# Stripping them keeps the categorised description free of noise like
# "BAC BIDFOOD" or "TFR BOOKER" (the codes distract rules and pivots).
_TXN_TYPE_TOKENS = {
    "BAC", "BACS", "DDR", "DD",  # Direct debits
    "TFR", "TFR.", "SO",         # Transfers / standing orders
    "FP", "FPI", "FPO", "FPS",   # Faster Payments
    "CHG", "CHQ",                # Charges / cheques
    "POS", "ATM", "CRD",         # Card / cash
    "BGC",                       # Bank giro credit
    "DR", "CR",                  # Debit / credit column markers
    # NOTE: We deliberately do NOT include "DEBIT", "CREDIT", "DEB",
    # "INT" or "COR" here — those words appear legitimately inside
    # merchant descriptions ("DIRECT DEBIT", "CREDIT UNION", etc.).
}

# Header / footer noise line patterns — matched line-wise BEFORE we
# start looking for transaction rows. Any line matching one of these is
# skipped, which means it also can't accidentally become part of a
# continuation-line description merge.
_SKIP_LINE_PATTERNS = [
    re.compile(r"^\s*Page\s+\d+", re.I),
    re.compile(r"^\s*Page\s+\d+\s+of\s+\d+", re.I),
    re.compile(r"^\s*Continued\s+overleaf", re.I),
    re.compile(r"^\s*Please\s+turn\s+over", re.I),
    re.compile(r"^\s*Statement\s+continues", re.I),
    re.compile(r"^\s*Sort\s+Code\s*[:.]?\s*\d", re.I),
    re.compile(r"^\s*Account\s+Number\s*[:.]?\s*\d", re.I),
    re.compile(r"^\s*Registered\s+office", re.I),
    re.compile(r"^\s*Authorised\s+and\s+regulated", re.I),
    re.compile(r"^\s*(www\.|http[s]?://)", re.I),
    re.compile(r"^\s*[A-Z][a-z]+\s+Bank\s+(plc|Ltd|Limited)", re.I),
    re.compile(r"^\s*Statement\s+date", re.I),
    re.compile(r"^\s*Opening\s+balance", re.I),
    re.compile(r"^\s*Closing\s+balance", re.I),
    re.compile(r"^\s*Balance\s+brought\s+forward", re.I),
    re.compile(r"^\s*Balance\s+carried\s+forward", re.I),
    re.compile(r"^\s*BALANCE\s+B/F", re.I),
    re.compile(r"^\s*BALANCE\s+C/F", re.I),
    re.compile(r"^\s*--- Page \d+", re.I),  # our own page markers
]

_TXN_TYPE_STRIP_RE = re.compile(
    r"\b(" + "|".join(sorted(_TXN_TYPE_TOKENS, key=len, reverse=True)) + r")\b(?:\s+|$)",
    re.I,
)


def _should_skip_line(line: str) -> bool:
    """True if the line is header/footer boilerplate — page numbers,
    bank contact details, opening/closing balance summaries, etc.
    Skipped lines are neither parsed as transactions NOR merged into
    another transaction's Details as continuation text."""
    if not line or not line.strip():
        return False  # blank lines handled separately elsewhere
    for pat in _SKIP_LINE_PATTERNS:
        if pat.match(line):
            return True
    return False


def _strip_txn_type_codes(desc: str) -> str:
    """Remove UK transaction-type codes (BAC, DDR, TFR, POS, FP, ATM,
    BGC, DR, CR, DD, SO, etc.) from the description so category rules
    match the actual merchant text and downloaded tabs stay readable."""
    if not desc:
        return desc
    # Strip codes from anywhere in the string, then collapse whitespace.
    cleaned = _TXN_TYPE_STRIP_RE.sub(" ", desc)
    return re.sub(r"\s{2,}", " ", cleaned).strip(" -|")


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
    if _HEADER_CATEGORY.search(c):
        return "category"
    if _HEADER_DESC.search(c):
        return "desc"
    if _HEADER_TXN_TYPE.search(c):
        return "txn_type"
    return ""


# ---------------------------------------------------------------------------
# CSV / XLSX row-based parsers.
# ---------------------------------------------------------------------------

def _normalise_category_slug(raw: str, txn_type: str) -> str:
    """Convert a free-text category from a CSV/XLSX 'Category name'
    column into one of our canonical slugs. Unknown values are stored
    as-is (lowercased, spaces → underscore) so the user's own naming
    survives the round-trip to the downloaded XLSX.
    """
    if not raw:
        return "other"
    key = raw.strip().lower()
    # Well-known aliases
    aliases = {
        "stock": "supplier",
        "stocks": "supplier",
        "inventory": "supplier",
        "suppliers": "supplier",
        "supplies": "supplier",
        "cost of sales": "supplier",
        "cogs": "supplier",
        "food": "supplier",
        "food & beverage": "supplier",
        "utilities": "utilities",
        "energy": "utilities",
        "gas & electric": "utilities",
        "water": "utilities",
        "rent": "rent",
        "wages": "wages",
        "salaries": "wages",
        "payroll": "wages",
        "staff": "wages",
        "software": "software",
        "subscriptions": "software",
        "saas": "software",
        "marketing": "marketing",
        "advertising": "marketing",
        "cleaning": "cleaning",
        "repairs": "repairs",
        "maintenance": "repairs",
        "insurance": "insurance",
        "bank fees": "bank_fees",
        "bankfees": "bank_fees",
        "bank charges": "bank_fees",
        "fees": "bank_fees",
        "tax": "tax",
        "vat": "tax",
        "hmrc": "tax",
        "transfer": "transfer",
        "sales": "sales",
        "revenue": "sales",
        "income": "sales" if txn_type == "income" else "other",
        "card sales": "sales",
        "cash sales": "sales",
        "delivery": "delivery",
        "grant": "grant",
        "refund": "refund_in",
    }
    if key in aliases:
        return aliases[key]
    # Fall back to a lowercase-underscore slug so user's own naming shows in reports.
    return re.sub(r"\s+", "_", key)[:32]


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
        # explicit description column exists. Excludes the txn_type
        # column since user asked to ignore it.
        if not desc_cell:
            known = set(col.values())
            desc_cell = " ".join(cells[i] for i in range(len(cells)) if i not in known).strip()
        desc_cell = _strip_txn_type_codes(desc_cell)

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

        # Capture the CSV 'Category name' column if present — will bypass
        # the rule engine downstream, since the user's accounting system
        # already knows what this row is.
        csv_cat = ""
        if "category" in col and col["category"] < len(cells):
            csv_cat = cells[col["category"]].strip()

        txns.append({
            "date": date_iso,
            "description": desc_cell,
            "amount": round(amt, 2),
            "type": ttype,
            "category": "",
            "matched_supplier": "",
            "_csv_category": csv_cat,
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
        # Skip header/footer boilerplate — page numbers, bank contact
        # lines, opening/closing balance summaries, etc.
        if _should_skip_line(line):
            continue
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
        desc = _strip_txn_type_codes(desc)

        if pin_val is not None:
            txns.append({
                "date": date_iso, "description": desc, "amount": round(pin_val, 2),
                "type": "income", "category": "", "matched_supplier": "",
                "_line_idx": i,
            })
        if pout_val is not None:
            txns.append({
                "date": date_iso, "description": desc, "amount": round(pout_val, 2),
                "type": "expense", "category": "", "matched_supplier": "",
                "_line_idx": i,
            })

    # ---- Merge continuation lines into the parent transaction ----
    # UK bank statements often print the merchant/reference on a second
    # (or third) indented line under the "Details" column — no date at
    # the start. Join those lines onto the preceding transaction's
    # description so category rules see the FULL detail (e.g. the AMZN
    # reference on the second line of an AMAZON EU row).
    if txns:
        for j, t in enumerate(txns):
            line_idx = t.pop("_line_idx")
            # Look ahead until the next transaction's line index (or EOF).
            next_line_idx = txns[j + 1]["_line_idx"] if j + 1 < len(txns) else len(lines)
            # Skip our own line, absorb intermediate continuation lines.
            extra_bits = []
            for cont_idx in range(line_idx + 1, next_line_idx):
                cont = lines[cont_idx]
                if not cont.strip():
                    continue
                # Skip lines that look like transaction rows (have a date
                # or a monetary amount + balance).
                if _LINE_STARTS_WITH_DATE.match(cont):
                    continue
                # Skip header/footer boilerplate — never merge into
                # description.
                if _should_skip_line(cont):
                    continue
                if _AMOUNT_RE.search(cont):
                    # Continuation lines can carry a running balance but
                    # usually they're reference codes. Only skip if the
                    # line is essentially JUST amounts.
                    non_amt = _AMOUNT_RE.sub("", cont).strip()
                    if len(non_amt) < 3:
                        continue
                    cont_text = non_amt
                else:
                    cont_text = cont.strip()
                cont_text = _strip_txn_type_codes(cont_text)
                if cont_text:
                    extra_bits.append(cont_text)
            if extra_bits:
                t["description"] = (t["description"] + " | " + " ".join(extra_bits)).strip()

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
    custom_rules: Optional[List[dict]] = None,
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

    # Enrich each row with category + rule label + supplier
    for t in txns:
        csv_cat = t.pop("_csv_category", "") or ""
        if csv_cat:
            # Trust the CSV's category column — user's accounting system
            # already categorised this row.
            t["category"] = _normalise_category_slug(csv_cat, t["type"])
            t["category_rule"] = f"from CSV column: {csv_cat}"
        else:
            cat, rule = _categorise(t["description"], t["type"], custom_rules=custom_rules)
            t["category"] = cat
            t["category_rule"] = rule
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
