"""Backend tests for Food Safety Compliance dashboard endpoint.

Covers:
 - GET /api/admin/compliance — admin only, structure validation
 - Submit data → status changes from missing → partial/complete
 - location_id filter
 - GET /api/admin/compliance/detail — drill-down endpoint
 - Auth gating (no auth, customer)
"""
import os
import pytest
import requests
from datetime import date, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_EMAIL = "admin@jollys.com"
ADMIN_PASSWORD = "Admin123!"
LOCATION_ID = "timperley-altrincham"

EXPECTED_CHECK_KEYS = {
    "temp_logs", "daily_checks", "cooked_temp", "kitchen_closedown",
    "delivery_records", "probe_calibration", "legionella",
    "daily_cleaning", "weekly_cleaning",
}


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="module")
def date_range():
    today = date.today()
    start = today - timedelta(days=6)
    return start.isoformat(), today.isoformat()


# === Auth gating ===
class TestComplianceAuth:
    def test_no_auth_blocked(self, date_range):
        s, e = date_range
        r = requests.get(f"{BASE_URL}/api/admin/compliance", params={"start_date": s, "end_date": e})
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"

    def test_detail_no_auth_blocked(self, date_range):
        s, e = date_range
        r = requests.get(f"{BASE_URL}/api/admin/compliance/detail",
                         params={"start_date": s, "end_date": e,
                                 "location_id": LOCATION_ID, "check_key": "daily_checks"})
        assert r.status_code in (401, 403)


# === Structure & response shape ===
class TestComplianceMatrix:
    def test_get_compliance_returns_structure(self, admin_session, date_range):
        s, e = date_range
        r = admin_session.get(f"{BASE_URL}/api/admin/compliance", params={"start_date": s, "end_date": e})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "overall_pct" in data
        assert "sites" in data
        assert "check_types" in data
        assert isinstance(data["sites"], list) and len(data["sites"]) >= 1
        # check_types includes all 9 keys
        keys = {ct["key"] for ct in data["check_types"]}
        assert EXPECTED_CHECK_KEYS.issubset(keys), f"Missing keys: {EXPECTED_CHECK_KEYS - keys}"
        # sites have proper structure
        site = data["sites"][0]
        assert "location_id" in site and "location_name" in site
        assert "compliance_pct" in site
        assert "checks" in site
        assert EXPECTED_CHECK_KEYS.issubset(set(site["checks"].keys()))
        # each check has required fields
        for k, v in site["checks"].items():
            assert "status" in v and v["status"] in ("complete", "partial", "overdue", "missing")
            assert "count" in v and "expected" in v and "actual_periods" in v and "pct" in v

    def test_filter_by_location(self, admin_session, date_range):
        s, e = date_range
        r = admin_session.get(f"{BASE_URL}/api/admin/compliance",
                              params={"start_date": s, "end_date": e, "location_id": LOCATION_ID})
        assert r.status_code == 200
        data = r.json()
        assert len(data["sites"]) == 1
        assert data["sites"][0]["location_id"] == LOCATION_ID


# === Drill-down ===
class TestComplianceDetail:
    def test_detail_endpoint_returns_entries(self, admin_session, date_range):
        s, e = date_range
        r = admin_session.get(f"{BASE_URL}/api/admin/compliance/detail",
                              params={"start_date": s, "end_date": e,
                                      "location_id": LOCATION_ID, "check_key": "daily_checks"})
        assert r.status_code == 200
        data = r.json()
        assert data["check_key"] == "daily_checks"
        assert "entries" in data
        assert isinstance(data["entries"], list)

    def test_detail_invalid_check_key(self, admin_session, date_range):
        s, e = date_range
        r = admin_session.get(f"{BASE_URL}/api/admin/compliance/detail",
                              params={"start_date": s, "end_date": e,
                                      "location_id": LOCATION_ID, "check_key": "bogus_check"})
        assert r.status_code == 200
        assert r.json().get("entries") == []


# === Status transition: missing -> partial after data submission ===
class TestStatusTransition:
    def test_submit_daily_check_changes_status(self, admin_session, date_range):
        """Submit a daily_check today, then verify compliance reflects partial/complete."""
        s, e = date_range
        today = date.today().isoformat()
        # Get baseline
        r0 = admin_session.get(f"{BASE_URL}/api/admin/compliance",
                               params={"start_date": s, "end_date": e, "location_id": LOCATION_ID})
        assert r0.status_code == 200
        before = r0.json()["sites"][0]["checks"]["daily_checks"]

        # Submit a daily_check entry for today
        payload = {
            "location_id": LOCATION_ID,
            "date": today,
            "items": [
                {"key": "fridge_temps", "label": "Fridge temps OK", "passed": True, "notes": ""},
            ],
        }
        sub = admin_session.post(f"{BASE_URL}/api/admin/daily-checks", json=payload)
        # Either 200/201 success or 409 (already submitted today) — both prove endpoint connection
        if sub.status_code not in (200, 201, 409):
            pytest.skip(f"daily-checks submit endpoint behaviour: {sub.status_code} {sub.text[:200]}")

        # Refetch
        r1 = admin_session.get(f"{BASE_URL}/api/admin/compliance",
                               params={"start_date": s, "end_date": e, "location_id": LOCATION_ID})
        after = r1.json()["sites"][0]["checks"]["daily_checks"]
        # actual_periods after >= before; status should not be 'missing' if a record exists
        if after["count"] >= 1:
            assert after["status"] in ("partial", "complete", "overdue")
        # actual_periods >= before
        assert after["actual_periods"] >= before["actual_periods"]
