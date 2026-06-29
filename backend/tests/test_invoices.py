"""Invoices module — supplier delivery invoice scanning.

Covers:
- POST /api/admin/invoices/scan — graceful AI fallback (ai_status='failed')
- GET  /api/admin/invoices       — list with location filter
- GET  /api/admin/invoices/{id}/file — raw image streaming
- PATCH /api/admin/invoices/{id} — admin-only
- DELETE /api/admin/invoices/{id} — admin-only
"""
import io
import os
import struct
import zlib

import pytest
import requests

def _load_base_url():
    u = os.environ.get("REACT_APP_BACKEND_URL", "").strip()
    if u:
        return u.rstrip("/")
    # Fallback: read from frontend/.env so pytest works without explicit env injection
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


def _png_bytes() -> bytes:
    """Tiny 2x2 red PNG. Smaller than a fixture file; keeps test self-contained."""
    sig = b"\x89PNG\r\n\x1a\n"
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d))
    ihdr = struct.pack(">IIBBBBB", 2, 2, 8, 2, 0, 0, 0)
    raw = b"\x00\xff\x00\x00\xff\x00\x00\x00\xff\x00\xff\x00\x00\xff"
    idat = zlib.compress(raw)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN, timeout=10)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def scanned_invoice(admin_headers):
    files = {"file": ("test.png", _png_bytes(), "image/png")}
    data = {"location_id": LOCATION_ID, "note": "TEST_pytest"}
    r = requests.post(
        f"{BASE_URL}/api/admin/invoices/scan",
        headers=admin_headers,
        files=files,
        data=data,
        timeout=30,
    )
    assert r.status_code == 200, f"scan failed: {r.status_code} {r.text}"
    return r.json()


class TestInvoiceScanFallback:
    def test_scan_returns_200_with_ai_failed(self, scanned_invoice):
        d = scanned_invoice
        assert "id" in d
        assert d["location_id"] == LOCATION_ID
        # Preview env has invalid Anthropic key — must gracefully degrade
        assert d["ai_status"] == "failed", f"expected failed, got {d}"
        assert d.get("ai_error", ""), "ai_error must be populated"
        # raw image still saved
        assert d.get("file_id")
        assert d.get("uploaded_by")
        assert d.get("content_type") == "image/png"
        assert d.get("size", 0) > 0


class TestInvoiceList:
    def test_list_includes_scan(self, admin_headers, scanned_invoice):
        r = requests.get(
            f"{BASE_URL}/api/admin/invoices?location_id={LOCATION_ID}",
            headers=admin_headers,
            timeout=10,
        )
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        ids = [x.get("id") for x in rows]
        assert scanned_invoice["id"] in ids


class TestInvoiceFile:
    def test_file_streams_png(self, admin_headers, scanned_invoice):
        r = requests.get(
            f"{BASE_URL}/api/admin/invoices/{scanned_invoice['id']}/file",
            headers=admin_headers,
            timeout=10,
        )
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("image/png")
        assert r.content.startswith(b"\x89PNG"), "should be a PNG byte stream"


class TestInvoicePatch:
    def test_admin_patch_persists(self, admin_headers, scanned_invoice):
        patch = {
            "supplier": "TEST_Bidfood",
            "location_id": LOCATION_ID,
            "items": [{"description": "Eggs (12)", "qty": 2.0, "unit_price": 3.5, "line_total": 7.0}],
            "subtotal": 7.0,
            "vat": 1.4,
            "total": 8.4,
            "note": "TEST_amended",
        }
        r = requests.patch(
            f"{BASE_URL}/api/admin/invoices/{scanned_invoice['id']}",
            headers=admin_headers,
            json=patch,
            timeout=10,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["supplier"] == "TEST_Bidfood"
        assert d["total"] == 8.4
        assert len(d["items"]) == 1
        assert d["items"][0]["description"] == "Eggs (12)"
        assert d["items"][0]["qty"] == 2.0
        # GET to verify persistence
        g = requests.get(
            f"{BASE_URL}/api/admin/invoices/{scanned_invoice['id']}",
            headers=admin_headers,
            timeout=10,
        )
        assert g.status_code == 200
        gj = g.json()
        assert gj["supplier"] == "TEST_Bidfood"
        assert gj["vat"] == 1.4
        assert gj.get("edited_by") == SUPER_ADMIN["email"]


class TestInvoiceUnauth:
    def test_patch_without_auth_is_401(self, scanned_invoice):
        r = requests.patch(
            f"{BASE_URL}/api/admin/invoices/{scanned_invoice['id']}",
            json={"supplier": "X"},
            timeout=10,
        )
        # Either 401 (no auth) is acceptable — admin gate is verified separately
        assert r.status_code in (401, 403)

    def test_delete_without_auth_is_401(self, scanned_invoice):
        r = requests.delete(
            f"{BASE_URL}/api/admin/invoices/{scanned_invoice['id']}",
            timeout=10,
        )
        assert r.status_code in (401, 403)


class TestInvoiceDelete:
    """Last in the suite — burns the scanned doc."""

    def test_admin_delete_and_verify_404(self, admin_headers, scanned_invoice):
        r = requests.delete(
            f"{BASE_URL}/api/admin/invoices/{scanned_invoice['id']}",
            headers=admin_headers,
            timeout=10,
        )
        assert r.status_code == 200
        assert r.json() == {"deleted": True}
        # Verify gone
        g = requests.get(
            f"{BASE_URL}/api/admin/invoices/{scanned_invoice['id']}",
            headers=admin_headers,
            timeout=10,
        )
        assert g.status_code == 404
