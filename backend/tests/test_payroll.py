"""Payroll endpoint tests — Daily Sales-sourced hours + staff dropdown."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://jovial-hamilton-4.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@jollys.com"
ADMIN_PASSWORD = "Admin123!"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s


def test_payroll_staff_no_filter(session):
    r = session.get(f"{BASE_URL}/api/admin/payroll/staff")
    assert r.status_code == 200, r.text
    body = r.json()
    assert "items" in body and isinstance(body["items"], list)
    assert len(body["items"]) >= 1


def test_payroll_staff_by_location(session):
    r = session.get(f"{BASE_URL}/api/admin/payroll/staff", params={"location_id": "timperley-altrincham"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert isinstance(body.get("items"), list)


def test_payroll_summary_hours_from_daily_sales(session):
    r = session.get(
        f"{BASE_URL}/api/admin/payroll",
        params={"start_date": "2025-01-01", "end_date": "2027-12-31"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert "include_drafts" not in body
    assert "any_draft" not in body
    assert body.get("total_hours", 0) > 0, f"expected total_hours>0 got {body.get('total_hours')}"
    results = body.get("results", [])
    assert any((r.get("hours") or 0) > 0 for r in results), "no result row has hours>0"


def test_payroll_csv_export(session):
    r = session.get(
        f"{BASE_URL}/api/admin/payroll/export.csv",
        params={"start_date": "2025-01-01", "end_date": "2027-12-31"},
    )
    assert r.status_code == 200, r.text
    ct = r.headers.get("content-type", "")
    assert "text/csv" in ct, f"unexpected content-type: {ct}"
    assert "Payroll summary" in r.text
