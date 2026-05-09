"""
Pytest suite for JKHive specialist routes (Acidity, Vacuum Packing,
Food Washing, Sous Vide).

Validates: list/create/delete CRUD, pass/fail logic, _id exclusion,
401 unauth, 404 unknown delete.
"""
import os
from datetime import date, timedelta

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://jovial-hamilton-4.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@jollys.com"
ADMIN_PASSWORD = "Admin123!"
LOCATION_ID = "timperley-altrincham"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def auth_session():
    s = requests.Session()
    r = s.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    token = r.json().get("access_token")
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="session")
def anon_session():
    return requests.Session()


# ---------- Helpers ----------
ITEM = {
    "location_id": LOCATION_ID,
    "item_name": "TEST_pytest_item",
    "item_category": "Fresh",
    "item_icon": "",
}


def _assert_no_id(obj):
    if isinstance(obj, list):
        for o in obj:
            assert "_id" not in o, f"_id leaked: {o}"
    elif isinstance(obj, dict):
        assert "_id" not in obj, f"_id leaked: {obj}"


# ---------- Acidity ----------
class TestAcidity:
    base = "/api/admin/acidity"

    def test_unauth_get(self, anon_session):
        r = anon_session.get(f"{BASE_URL}{self.base}", params={"location_id": LOCATION_ID})
        assert r.status_code in (401, 403)

    def test_create_pass_then_get_then_delete(self, auth_session):
        body = {**ITEM, "ph_value": 4.0, "comment": "TEST_acid_pass"}
        r = auth_session.post(f"{BASE_URL}{self.base}", json=body)
        assert r.status_code == 200, r.text
        d = r.json()
        _assert_no_id(d)
        assert d["passed"] is True
        assert d["ph_value"] == 4.0
        rid = d["id"]

        # GET list and confirm presence
        lst = auth_session.get(f"{BASE_URL}{self.base}", params={"location_id": LOCATION_ID}).json()
        _assert_no_id(lst)
        assert any(x["id"] == rid for x in lst)

        # DELETE
        rd = auth_session.delete(f"{BASE_URL}{self.base}/{rid}")
        assert rd.status_code == 200
        # 404 on second delete
        rd2 = auth_session.delete(f"{BASE_URL}{self.base}/{rid}")
        assert rd2.status_code == 404

    def test_create_fail(self, auth_session):
        body = {**ITEM, "ph_value": 5.5, "comment": "TEST_acid_fail"}
        r = auth_session.post(f"{BASE_URL}{self.base}", json=body)
        assert r.status_code == 200
        assert r.json()["passed"] is False
        auth_session.delete(f"{BASE_URL}{self.base}/{r.json()['id']}")


# ---------- Vacuum ----------
class TestVacuum:
    base = "/api/admin/vacuum-packing"

    def test_unauth_get(self, anon_session):
        r = anon_session.get(f"{BASE_URL}{self.base}", params={"location_id": LOCATION_ID})
        assert r.status_code in (401, 403)

    def test_create_pass(self, auth_session):
        ub = (date.today() + timedelta(days=5)).isoformat()
        body = {**ITEM, "pack_temp": 3.0, "use_by_date": ub, "batch_label": "TEST_B1"}
        r = auth_session.post(f"{BASE_URL}{self.base}", json=body)
        assert r.status_code == 200, r.text
        d = r.json()
        _assert_no_id(d)
        assert d["passed"] is True
        assert d["pack_temp"] == 3.0
        rid = d["id"]
        # Persistence check
        lst = auth_session.get(f"{BASE_URL}{self.base}", params={"location_id": LOCATION_ID}).json()
        assert any(x["id"] == rid for x in lst)
        assert auth_session.delete(f"{BASE_URL}{self.base}/{rid}").status_code == 200

    def test_create_temp_fail(self, auth_session):
        ub = (date.today() + timedelta(days=5)).isoformat()
        body = {**ITEM, "pack_temp": 8.0, "use_by_date": ub}
        r = auth_session.post(f"{BASE_URL}{self.base}", json=body)
        assert r.status_code == 200
        assert r.json()["passed"] is False
        auth_session.delete(f"{BASE_URL}{self.base}/{r.json()['id']}")

    def test_empty_use_by_400(self, auth_session):
        body = {**ITEM, "pack_temp": 3.0, "use_by_date": ""}
        r = auth_session.post(f"{BASE_URL}{self.base}", json=body)
        assert r.status_code == 400

    def test_delete_unknown(self, auth_session):
        assert auth_session.delete(f"{BASE_URL}{self.base}/nope-xyz").status_code == 404


# ---------- Food Washing ----------
class TestWashing:
    base = "/api/admin/food-washing"

    def test_unauth_post(self, anon_session):
        r = anon_session.post(f"{BASE_URL}{self.base}", json={})
        assert r.status_code in (401, 403)

    def test_chlorine_pass(self, auth_session):
        body = {**ITEM, "sanitiser": "chlorine", "ppm": 100.0, "contact_minutes": 2.0}
        r = auth_session.post(f"{BASE_URL}{self.base}", json=body)
        assert r.status_code == 200, r.text
        d = r.json()
        _assert_no_id(d)
        assert d["passed"] is True
        auth_session.delete(f"{BASE_URL}{self.base}/{d['id']}")

    def test_chlorine_too_low_fail(self, auth_session):
        body = {**ITEM, "sanitiser": "chlorine", "ppm": 30.0, "contact_minutes": 2.0}
        r = auth_session.post(f"{BASE_URL}{self.base}", json=body)
        assert r.json()["passed"] is False
        auth_session.delete(f"{BASE_URL}{self.base}/{r.json()['id']}")

    def test_peracetic_pass(self, auth_session):
        body = {**ITEM, "sanitiser": "peracetic", "ppm": 100.0, "contact_minutes": 1.0}
        r = auth_session.post(f"{BASE_URL}{self.base}", json=body)
        assert r.json()["passed"] is True
        auth_session.delete(f"{BASE_URL}{self.base}/{r.json()['id']}")

    def test_other_zero_fail(self, auth_session):
        body = {**ITEM, "sanitiser": "other", "ppm": 0.0, "contact_minutes": 5.0}
        r = auth_session.post(f"{BASE_URL}{self.base}", json=body)
        assert r.json()["passed"] is False
        auth_session.delete(f"{BASE_URL}{self.base}/{r.json()['id']}")

    def test_contact_min_fail(self, auth_session):
        body = {**ITEM, "sanitiser": "chlorine", "ppm": 100.0, "contact_minutes": 0.5}
        r = auth_session.post(f"{BASE_URL}{self.base}", json=body)
        assert r.json()["passed"] is False
        auth_session.delete(f"{BASE_URL}{self.base}/{r.json()['id']}")


# ---------- Sous Vide ----------
class TestSousVide:
    base = "/api/admin/sous-vide"

    def test_unauth_get(self, anon_session):
        r = anon_session.get(f"{BASE_URL}{self.base}", params={"location_id": LOCATION_ID})
        assert r.status_code in (401, 403)

    def test_pass(self, auth_session):
        body = {**ITEM, "target_temp": 63, "target_minutes": 60, "actual_temp": 64.5, "actual_minutes": 62}
        r = auth_session.post(f"{BASE_URL}{self.base}", json=body)
        assert r.status_code == 200, r.text
        d = r.json()
        _assert_no_id(d)
        assert d["passed"] is True
        # GET persistence
        lst = auth_session.get(f"{BASE_URL}{self.base}", params={"location_id": LOCATION_ID}).json()
        _assert_no_id(lst)
        assert any(x["id"] == d["id"] for x in lst)
        assert auth_session.delete(f"{BASE_URL}{self.base}/{d['id']}").status_code == 200

    def test_temp_short_fail(self, auth_session):
        body = {**ITEM, "target_temp": 63, "target_minutes": 60, "actual_temp": 60.0, "actual_minutes": 65}
        r = auth_session.post(f"{BASE_URL}{self.base}", json=body)
        d = r.json()
        assert d["passed"] is False and d["temp_pass"] is False and d["time_pass"] is True
        auth_session.delete(f"{BASE_URL}{self.base}/{d['id']}")

    def test_time_short_fail(self, auth_session):
        body = {**ITEM, "target_temp": 63, "target_minutes": 60, "actual_temp": 65.0, "actual_minutes": 30}
        r = auth_session.post(f"{BASE_URL}{self.base}", json=body)
        d = r.json()
        assert d["passed"] is False and d["time_pass"] is False
        auth_session.delete(f"{BASE_URL}{self.base}/{d['id']}")
