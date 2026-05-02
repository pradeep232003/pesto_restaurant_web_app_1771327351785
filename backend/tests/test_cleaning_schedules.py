"""Backend tests for Daily Cleaning & Weekly Deep Cleaning schedules.

Covers:
 - Seeded items (18 daily + 7 weekly)
 - Items CRUD (admin only)
 - Location-scoped filter
 - Weekly log submit (upsert), get, history
 - Collection independence (daily vs weekly)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_EMAIL = "admin@jollys.com"
ADMIN_PASSWORD = "Admin123!"
LOCATION_ID = "timperley-altrincham"
WEEK_ENDING = "2026-01-18"  # a Sunday


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
def unauth_session():
    return requests.Session()


# Parametrize across daily + weekly routers
KINDS = [
    ("daily-cleaning", 18, "FRIDGE"),
    ("weekly-cleaning", 7, "RUBBISH BIN"),
]


@pytest.mark.parametrize("kind,expected_count,first_name", KINDS)
class TestCleaningItems:
    def test_items_seeded(self, admin_session, kind, expected_count, first_name):
        r = admin_session.get(f"{BASE_URL}/api/admin/{kind}/items")
        assert r.status_code == 200, r.text
        items = r.json()
        assert isinstance(items, list)
        assert len(items) >= expected_count, f"expected ≥{expected_count} seeded {kind} items, got {len(items)}"
        # First item in order=0 should match
        ordered = sorted([i for i in items if i.get("location_id") is None], key=lambda x: x.get("order", 0))
        assert ordered[0]["name"] == first_name, f"first item expected {first_name}, got {ordered[0]['name']}"

    def test_items_with_location(self, admin_session, kind, expected_count, first_name):
        r = admin_session.get(f"{BASE_URL}/api/admin/{kind}/items", params={"location_id": LOCATION_ID})
        assert r.status_code == 200
        items = r.json()
        # Should include global items (location_id == None) at minimum
        assert len(items) >= expected_count

    def test_unauth_blocked(self, unauth_session, kind, expected_count, first_name):
        r = unauth_session.get(f"{BASE_URL}/api/admin/{kind}/items")
        assert r.status_code in (401, 403)


@pytest.mark.parametrize("kind", ["daily-cleaning", "weekly-cleaning"])
class TestCleaningItemsCRUD:
    def test_create_update_delete(self, admin_session, kind):
        # CREATE
        body = {"name": f"TEST_{kind}_item", "frequency": "EOS",
                "methods": "test method", "chemical": "test chem", "location_id": LOCATION_ID}
        r = admin_session.post(f"{BASE_URL}/api/admin/{kind}/items", json=body)
        assert r.status_code == 200, r.text
        created = r.json()
        assert created["name"] == f"TEST_{kind}_item"
        assert created["location_id"] == LOCATION_ID
        assert "id" in created
        item_id = created["id"]

        # Verify appears in list
        r = admin_session.get(f"{BASE_URL}/api/admin/{kind}/items", params={"location_id": LOCATION_ID})
        assert any(i["id"] == item_id for i in r.json())

        # UPDATE - change scope to global
        r = admin_session.patch(f"{BASE_URL}/api/admin/{kind}/items/{item_id}",
                                json={"scope": "global", "name": f"TEST_{kind}_global"})
        assert r.status_code == 200
        upd = r.json()
        assert upd["location_id"] is None
        assert upd["name"] == f"TEST_{kind}_global"

        # DELETE
        r = admin_session.delete(f"{BASE_URL}/api/admin/{kind}/items/{item_id}")
        assert r.status_code == 200

        # Verify gone
        r = admin_session.get(f"{BASE_URL}/api/admin/{kind}/items")
        assert not any(i["id"] == item_id for i in r.json())

    def test_delete_nonexistent_404(self, admin_session, kind):
        r = admin_session.delete(f"{BASE_URL}/api/admin/{kind}/items/nonexistent-id-xyz")
        assert r.status_code == 404


@pytest.mark.parametrize("kind,expected_count", [("daily-cleaning", 18), ("weekly-cleaning", 7)])
class TestCleaningLogs:
    def test_submit_get_upsert(self, admin_session, kind, expected_count):
        # Get items
        r = admin_session.get(f"{BASE_URL}/api/admin/{kind}/items", params={"location_id": LOCATION_ID})
        items = r.json()
        assert len(items) >= expected_count

        # Build ticks: mark 3 days for first item
        first = items[0]
        ticks = {first["id"]: {"mon": True, "tue": True, "wed": True,
                               "thu": False, "fri": False, "sat": False, "sun": False}}

        # Submit log
        body = {"location_id": LOCATION_ID, "week_ending": WEEK_ENDING, "ticks": ticks, "note": "TEST_log"}
        r = admin_session.post(f"{BASE_URL}/api/admin/{kind}", json=body)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["passed"] == 3
        expected_total = len(items) * 7
        assert d["total"] == expected_total
        log_id = d["id"]

        # GET log
        r = admin_session.get(f"{BASE_URL}/api/admin/{kind}",
                              params={"location_id": LOCATION_ID, "week_ending": WEEK_ENDING})
        assert r.status_code == 200
        log = r.json()
        assert log is not None
        assert log["id"] == log_id
        assert log["passed_cells"] == 3
        assert log["note"] == "TEST_log"
        assert "items_snapshot" in log
        assert len(log["items_snapshot"]) == len(items)

        # UPSERT: submit again for same (location, week_ending) -> should update not create new
        ticks2 = {first["id"]: {"mon": True, "tue": True, "wed": True,
                                "thu": True, "fri": True, "sat": False, "sun": False}}
        body2 = {"location_id": LOCATION_ID, "week_ending": WEEK_ENDING, "ticks": ticks2, "note": "TEST_log_updated"}
        r = admin_session.post(f"{BASE_URL}/api/admin/{kind}", json=body2)
        assert r.status_code == 200
        d2 = r.json()
        assert d2["id"] == log_id, "upsert should reuse same id"
        assert d2["passed"] == 5

        # History
        r = admin_session.get(f"{BASE_URL}/api/admin/{kind}/history",
                              params={"location_id": LOCATION_ID})
        assert r.status_code == 200
        history = r.json()
        assert any(h["id"] == log_id for h in history)

    def test_unauth_submit_blocked(self, unauth_session, kind, expected_count):
        r = unauth_session.post(f"{BASE_URL}/api/admin/{kind}",
                                json={"location_id": LOCATION_ID, "week_ending": WEEK_ENDING, "ticks": {}})
        assert r.status_code in (401, 403)


def test_daily_weekly_independent(admin_session):
    """Collections should be separate - creating item in daily shouldn't show in weekly."""
    body = {"name": "TEST_isolation_item", "frequency": "EOS",
            "methods": "m", "chemical": "c", "location_id": None}
    r = admin_session.post(f"{BASE_URL}/api/admin/daily-cleaning/items", json=body)
    assert r.status_code == 200
    daily_id = r.json()["id"]

    try:
        # Should NOT appear in weekly items
        r = admin_session.get(f"{BASE_URL}/api/admin/weekly-cleaning/items")
        assert not any(i["id"] == daily_id for i in r.json()), "daily item leaked into weekly collection"
    finally:
        admin_session.delete(f"{BASE_URL}/api/admin/daily-cleaning/items/{daily_id}")


@pytest.fixture(scope="module", autouse=True)
def cleanup_test_logs(admin_session):
    """Cleanup: remove TEST logs for the test week after all tests."""
    yield
    for kind in ("daily-cleaning", "weekly-cleaning"):
        try:
            # No delete endpoint for logs; just leave. Tests use TEST_ prefix in note for identification.
            pass
        except Exception:
            pass
