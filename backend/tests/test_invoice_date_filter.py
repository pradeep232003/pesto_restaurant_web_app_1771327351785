"""Invoice date-window filter regression tests.

Reproduces the "March invoice scanned in June bled into June food cost"
bug and verifies that both:
  - routes.bi._stock_spend_by_location
  - GET /api/admin/invoices
only fall back to uploaded_at when invoice_date is missing/blank/null.

Seeds two TEST_DATEBUG_* docs directly into Mongo and cleans up on teardown.
"""
import os
import sys
import uuid

import pytest
import requests

# Make backend importable so we can call _stock_spend_by_location directly
sys.path.insert(0, "/app/backend")

from db import db  # noqa: E402
from routes.bi import _stock_spend_by_location  # noqa: E402

invoices_collection = db["invoices"]


def _load_base_url():
    u = os.environ.get("REACT_APP_BACKEND_URL", "").strip()
    if u:
        return u.rstrip("/")
    env_path = "/app/frontend/.env"
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip().rstrip("/")
    raise RuntimeError("REACT_APP_BACKEND_URL not set")


BASE_URL = _load_base_url()
SUPER_ADMIN = {"email": "admin@jollys.com", "password": "Admin123!"}
LOCATION_ID = "timperley-altrincham"
OTHER_LOC = "timperley-altrincham"  # same site; one is enough for this bug

# Marker prefix so we can blow our docs away in teardown without touching
# real data.
TAG = "TEST_DATEBUG_"


@pytest.fixture(scope="module")
def admin_headers():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN, timeout=10)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    tok = r.json().get("access_token") or r.json().get("token")
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def seeded_invoices():
    """Insert the four docs that exercise every branch of the filter."""
    docs = [
        # (A) printed March invoice, uploaded in June
        {
            "id": f"{TAG}A_{uuid.uuid4().hex[:8]}",
            "supplier": f"{TAG}MarchSupplier",
            "location_id": LOCATION_ID,
            "category": "stock",
            "invoice_date": "2026-03-15",
            "uploaded_at": "2026-06-10T12:00:00Z",
            "total": 100.0,
            "subtotal": 100.0, "vat": 0.0, "items": [],
            "file_id": "", "filename": "", "content_type": "image/png", "size": 1,
        },
        # (B) OCR-fail (blank invoice_date) uploaded in June → falls back to uploaded_at
        {
            "id": f"{TAG}B_{uuid.uuid4().hex[:8]}",
            "supplier": f"{TAG}NoDateSupplier",
            "location_id": LOCATION_ID,
            "category": "stock",
            "invoice_date": "",
            "uploaded_at": "2026-06-10T12:00:00Z",
            "total": 50.0,
            "subtotal": 50.0, "vat": 0.0, "items": [],
            "file_id": "", "filename": "", "content_type": "image/png", "size": 1,
        },
        # (C) invoice_date inside June window → must show up in June
        {
            "id": f"{TAG}C_{uuid.uuid4().hex[:8]}",
            "supplier": f"{TAG}JuneSupplier",
            "location_id": LOCATION_ID,
            "category": "stock",
            "invoice_date": "2026-06-15",
            "uploaded_at": "2026-07-02T09:00:00Z",  # uploaded later, irrelevant
            "total": 25.0,
            "subtotal": 25.0, "vat": 0.0, "items": [],
            "file_id": "", "filename": "", "content_type": "image/png", "size": 1,
        },
        # (D) invoice_date is None (missing key style) → falls back to uploaded_at (June)
        {
            "id": f"{TAG}D_{uuid.uuid4().hex[:8]}",
            "supplier": f"{TAG}NullDateSupplier",
            "location_id": LOCATION_ID,
            "category": "stock",
            "invoice_date": None,
            "uploaded_at": "2026-06-20T08:00:00Z",
            "total": 10.0,
            "subtotal": 10.0, "vat": 0.0, "items": [],
            "file_id": "", "filename": "", "content_type": "image/png", "size": 1,
        },
    ]
    # Clean any stragglers from previous runs first
    invoices_collection.delete_many({"supplier": {"$regex": f"^{TAG}"}})
    invoices_collection.insert_many([dict(d) for d in docs])
    yield docs
    # Teardown
    invoices_collection.delete_many({"supplier": {"$regex": f"^{TAG}"}})


# -------------------------------------------------------------------------
# Direct unit tests on _stock_spend_by_location
# -------------------------------------------------------------------------

class TestStockSpendHelper:
    def test_june_window_only_includes_blank_date_uploads(self, seeded_invoices):
        out = _stock_spend_by_location("2026-06-01", "2026-06-30", LOCATION_ID)
        # B (50) + C (25 invoice_date in window) + D (10, null date fallback) = 85
        # A (March invoice scanned in June) MUST NOT count
        assert LOCATION_ID in out
        assert round(out[LOCATION_ID], 2) == 85.0, f"got {out}"

    def test_march_window_includes_printed_march_invoice(self, seeded_invoices):
        out = _stock_spend_by_location("2026-03-01", "2026-03-31", LOCATION_ID)
        # Only A (100) qualifies
        assert LOCATION_ID in out
        assert round(out[LOCATION_ID], 2) == 100.0, f"got {out}"

    def test_july_window_excludes_all_seeds(self, seeded_invoices):
        out = _stock_spend_by_location("2026-07-01", "2026-07-31", LOCATION_ID)
        # None of our seeds have invoice_date in July (and the only July
        # uploaded_at is C, whose invoice_date is set → not a fallback hit)
        assert out.get(LOCATION_ID, 0.0) == 0.0, f"got {out}"


# -------------------------------------------------------------------------
# HTTP tests on GET /api/admin/invoices
# -------------------------------------------------------------------------

class TestInvoiceListDateFilter:
    def _supplier_set(self, rows):
        return {r.get("supplier") for r in rows if str(r.get("supplier", "")).startswith(TAG)}

    def test_june_filter_excludes_march_invoice(self, admin_headers, seeded_invoices):
        r = requests.get(
            f"{BASE_URL}/api/admin/invoices",
            headers=admin_headers,
            params={
                "start_date": "2026-06-01",
                "end_date": "2026-06-30",
                "location_id": LOCATION_ID,
            },
            timeout=10,
        )
        assert r.status_code == 200, r.text
        suppliers = self._supplier_set(r.json())
        assert f"{TAG}MarchSupplier" not in suppliers, (
            f"BUG: March invoice leaked into June window: {suppliers}"
        )
        assert f"{TAG}NoDateSupplier" in suppliers
        assert f"{TAG}JuneSupplier" in suppliers
        assert f"{TAG}NullDateSupplier" in suppliers

    def test_march_filter_includes_only_march_invoice(self, admin_headers, seeded_invoices):
        r = requests.get(
            f"{BASE_URL}/api/admin/invoices",
            headers=admin_headers,
            params={
                "start_date": "2026-03-01",
                "end_date": "2026-03-31",
                "location_id": LOCATION_ID,
            },
            timeout=10,
        )
        assert r.status_code == 200, r.text
        suppliers = self._supplier_set(r.json())
        assert f"{TAG}MarchSupplier" in suppliers
        assert f"{TAG}NoDateSupplier" not in suppliers
        assert f"{TAG}JuneSupplier" not in suppliers
        assert f"{TAG}NullDateSupplier" not in suppliers

    def test_july_filter_excludes_all_seeded(self, admin_headers, seeded_invoices):
        r = requests.get(
            f"{BASE_URL}/api/admin/invoices",
            headers=admin_headers,
            params={
                "start_date": "2026-07-01",
                "end_date": "2026-07-31",
                "location_id": LOCATION_ID,
            },
            timeout=10,
        )
        assert r.status_code == 200, r.text
        suppliers = self._supplier_set(r.json())
        assert suppliers == set(), f"July window should not match any seed, got {suppliers}"
