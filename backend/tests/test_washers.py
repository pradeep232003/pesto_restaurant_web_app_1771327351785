"""Washer Temps API tests — auth-gated CRUD + check pass/fail thresholds."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://jovial-hamilton-4.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@jollys.com"
ADMIN_PASSWORD = "Admin123!"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text}")
    token = r.json().get("access_token") or r.json().get("token")
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="module")
def location_id(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/admin/locations")
    if r.status_code != 200 or not r.json():
        # fallback to public locations endpoint
        r = admin_session.get(f"{BASE_URL}/api/locations")
    locs = r.json()
    assert locs, "No locations available"
    return locs[0]["id"]


@pytest.fixture(scope="module")
def created_washer(admin_session, location_id):
    payload = {"location_id": location_id, "name": "TEST_Washer_E2E", "info": "pytest"}
    r = admin_session.post(f"{BASE_URL}/api/admin/washers", json=payload)
    assert r.status_code == 200, f"create failed {r.status_code} {r.text}"
    data = r.json()
    assert "id" in data and data["name"] == "TEST_Washer_E2E"
    assert "_id" not in data
    yield data
    admin_session.delete(f"{BASE_URL}/api/admin/washers/{data['id']}")


# ============== AUTH GATE ==============
class TestAuthGate:
    def test_list_requires_auth(self, location_id):
        r = requests.get(f"{BASE_URL}/api/admin/washers?location_id={location_id}")
        assert r.status_code in (401, 403)

    def test_post_requires_auth(self, location_id):
        r = requests.post(f"{BASE_URL}/api/admin/washers",
                          json={"location_id": location_id, "name": "x"})
        assert r.status_code in (401, 403)


# ============== CRUD ==============
class TestWasherCrud:
    def test_list_includes_created(self, admin_session, location_id, created_washer):
        r = admin_session.get(f"{BASE_URL}/api/admin/washers?location_id={location_id}")
        assert r.status_code == 200
        ids = [w["id"] for w in r.json()]
        assert created_washer["id"] in ids
        for w in r.json():
            assert "_id" not in w

    def test_update_name(self, admin_session, created_washer):
        r = admin_session.patch(f"{BASE_URL}/api/admin/washers/{created_washer['id']}",
                                json={"name": "TEST_Washer_Renamed"})
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_Washer_Renamed"
        assert "_id" not in r.json()

    def test_update_404(self, admin_session):
        r = admin_session.patch(f"{BASE_URL}/api/admin/washers/nonexistent_id",
                                json={"name": "x"})
        assert r.status_code == 404

    def test_create_empty_name_400(self, admin_session, location_id):
        r = admin_session.post(f"{BASE_URL}/api/admin/washers",
                               json={"location_id": location_id, "name": "  "})
        assert r.status_code == 400


# ============== CHECKS / THRESHOLDS ==============
class TestWasherChecks:
    def test_check_pass_both(self, admin_session, location_id, created_washer):
        r = admin_session.post(f"{BASE_URL}/api/admin/washers/checks", json={
            "location_id": location_id, "washer_id": created_washer["id"],
            "wash_temp": 58.0, "rinse_temp": 83.0, "comment": "TEST_pass",
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["wash_pass"] is True
        assert d["rinse_pass"] is True
        assert d["passed"] is True
        assert d["washer_name"] == created_washer["name"] or d["washer_name"].startswith("TEST_")
        assert "_id" not in d

    def test_check_fail_wash(self, admin_session, location_id, created_washer):
        r = admin_session.post(f"{BASE_URL}/api/admin/washers/checks", json={
            "location_id": location_id, "washer_id": created_washer["id"],
            "wash_temp": 54.9, "rinse_temp": 82.0,
        })
        assert r.status_code == 200
        d = r.json()
        assert d["wash_pass"] is False
        assert d["rinse_pass"] is True
        assert d["passed"] is False

    def test_check_fail_rinse(self, admin_session, location_id, created_washer):
        r = admin_session.post(f"{BASE_URL}/api/admin/washers/checks", json={
            "location_id": location_id, "washer_id": created_washer["id"],
            "wash_temp": 55.0, "rinse_temp": 81.9,
        })
        assert r.status_code == 200
        d = r.json()
        assert d["wash_pass"] is True
        assert d["rinse_pass"] is False
        assert d["passed"] is False

    def test_check_unknown_washer_404(self, admin_session, location_id):
        r = admin_session.post(f"{BASE_URL}/api/admin/washers/checks", json={
            "location_id": location_id, "washer_id": "nonexistent_xyz",
            "wash_temp": 60.0, "rinse_temp": 85.0,
        })
        assert r.status_code == 404

    def test_list_checks_no_id_leak(self, admin_session, location_id, created_washer):
        r = admin_session.get(
            f"{BASE_URL}/api/admin/washers/checks?location_id={location_id}&washer_id={created_washer['id']}")
        assert r.status_code == 200
        for c in r.json():
            assert "_id" not in c

    def test_delete_check(self, admin_session, location_id, created_washer):
        # create and then delete
        r = admin_session.post(f"{BASE_URL}/api/admin/washers/checks", json={
            "location_id": location_id, "washer_id": created_washer["id"],
            "wash_temp": 60.0, "rinse_temp": 85.0, "comment": "TEST_del",
        })
        assert r.status_code == 200
        rid = r.json()["id"]
        d = admin_session.delete(f"{BASE_URL}/api/admin/washers/checks/{rid}")
        assert d.status_code == 200
        assert d.json().get("deleted") is True


# ============== DELETE WASHER ==============
class TestWasherDelete:
    def test_delete_404(self, admin_session):
        r = admin_session.delete(f"{BASE_URL}/api/admin/washers/nonexistent_xyz")
        assert r.status_code == 404
