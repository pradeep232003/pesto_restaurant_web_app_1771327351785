"""Backend tests for 4 log-style forms: cooked-temp, delivery-records, probe-calibration, legionella."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://jovial-hamilton-4.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@jollys.com"
ADMIN_PASSWORD = "Admin123!"
LOCATION_ID = "timperley-altrincham"
TODAY = "2026-01-15"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    # Cookie-based; also store token if returned
    data = r.json()
    token = data.get("access_token") or data.get("token")
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="module")
def unauth_session():
    return requests.Session()


# ==================== COOKED TEMP ====================
class TestCookedTemp:
    created_ids = []

    def test_get_methods(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/cooked-temp/methods")
        assert r.status_code == 200
        methods = r.json()
        assert "Combi" in methods and "Oven" in methods and "Bain-Marie" in methods

    def test_create_pass(self, admin_session):
        body = {"location_id": LOCATION_ID, "date": TODAY, "food_item": "TEST_Chicken curry",
                "cooking_method": "Oven", "temp_c": 82.0, "initials": "TT"}
        r = admin_session.post(f"{BASE_URL}/api/admin/cooked-temp", json=body)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["passed"] is True
        assert d["temp_c"] == 82.0
        assert d["food_item"] == "TEST_Chicken curry"
        assert "id" in d
        TestCookedTemp.created_ids.append(d["id"])

    def test_create_fail(self, admin_session):
        body = {"location_id": LOCATION_ID, "date": TODAY, "food_item": "TEST_Underdone",
                "cooking_method": "Grill", "temp_c": 60.0}
        r = admin_session.post(f"{BASE_URL}/api/admin/cooked-temp", json=body)
        assert r.status_code == 200
        d = r.json()
        assert d["passed"] is False
        TestCookedTemp.created_ids.append(d["id"])

    def test_list_with_filter(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/cooked-temp",
                              params={"location_id": LOCATION_ID, "start_date": TODAY, "end_date": TODAY})
        assert r.status_code == 200
        items = r.json()
        ids = [i["id"] for i in items]
        for cid in TestCookedTemp.created_ids:
            assert cid in ids

    def test_unauth_blocked(self, unauth_session):
        r = unauth_session.get(f"{BASE_URL}/api/admin/cooked-temp")
        assert r.status_code in (401, 403)

    def test_delete(self, admin_session):
        for cid in TestCookedTemp.created_ids:
            r = admin_session.delete(f"{BASE_URL}/api/admin/cooked-temp/{cid}")
            assert r.status_code == 200
        TestCookedTemp.created_ids.clear()


# ==================== DELIVERY RECORDS ====================
class TestDeliveryRecords:
    created_ids = []

    def test_create_pass(self, admin_session):
        body = {"location_id": LOCATION_ID, "date": TODAY, "supplier": "TEST_Brakes",
                "invoice_number": "INV001", "food_frozen_temp": -18, "food_chilled_temp": 4}
        r = admin_session.post(f"{BASE_URL}/api/admin/delivery-records", json=body)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["passed"] is True
        assert d["supplier"] == "TEST_Brakes"
        TestDeliveryRecords.created_ids.append(d["id"])

    def test_create_chilled_fail(self, admin_session):
        body = {"location_id": LOCATION_ID, "date": TODAY, "supplier": "TEST_Bidfood",
                "food_chilled_temp": 12, "quality_comments": "Warm box"}
        r = admin_session.post(f"{BASE_URL}/api/admin/delivery-records", json=body)
        assert r.status_code == 200
        d = r.json()
        assert d["passed"] is False
        TestDeliveryRecords.created_ids.append(d["id"])

    def test_list(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/delivery-records",
                              params={"location_id": LOCATION_ID})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_delete(self, admin_session):
        for cid in TestDeliveryRecords.created_ids:
            r = admin_session.delete(f"{BASE_URL}/api/admin/delivery-records/{cid}")
            assert r.status_code == 200
        TestDeliveryRecords.created_ids.clear()


# ==================== PROBE CALIBRATION ====================
class TestProbeCalibration:
    created_ids = []

    def test_create_pass(self, admin_session):
        body = {"location_id": LOCATION_ID, "date": TODAY, "probe_no": "TEST_P01",
                "cold_temp": 0.5, "hot_temp": 99.8, "tested_by": "TT"}
        r = admin_session.post(f"{BASE_URL}/api/admin/probe-calibration", json=body)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["passed"] is True
        TestProbeCalibration.created_ids.append(d["id"])

    def test_create_fail(self, admin_session):
        # cold_temp=3.0 → out of 0±1 → fail
        body = {"location_id": LOCATION_ID, "date": TODAY, "probe_no": "TEST_P02",
                "cold_temp": 3.0, "hot_temp": 95.0}
        r = admin_session.post(f"{BASE_URL}/api/admin/probe-calibration", json=body)
        assert r.status_code == 200
        d = r.json()
        assert d["passed"] is False
        TestProbeCalibration.created_ids.append(d["id"])

    def test_list(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/probe-calibration",
                              params={"location_id": LOCATION_ID})
        assert r.status_code == 200

    def test_delete(self, admin_session):
        for cid in TestProbeCalibration.created_ids:
            r = admin_session.delete(f"{BASE_URL}/api/admin/probe-calibration/{cid}")
            assert r.status_code == 200
        TestProbeCalibration.created_ids.clear()


# ==================== LEGIONELLA ====================
class TestLegionella:
    created_ids = []

    def test_create_pass(self, admin_session):
        body = {"location_id": LOCATION_ID, "date": TODAY, "location_of_test": "TEST_Kitchen tap",
                "hot_water_temp": 55, "cold_water_temp": 15}
        r = admin_session.post(f"{BASE_URL}/api/admin/legionella", json=body)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["passed"] is True
        TestLegionella.created_ids.append(d["id"])

    def test_create_hot_fail(self, admin_session):
        body = {"location_id": LOCATION_ID, "date": TODAY, "location_of_test": "TEST_Bathroom",
                "hot_water_temp": 40, "cold_water_temp": 15}
        r = admin_session.post(f"{BASE_URL}/api/admin/legionella", json=body)
        assert r.status_code == 200
        d = r.json()
        assert d["passed"] is False
        TestLegionella.created_ids.append(d["id"])

    def test_list_filter(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/legionella",
                              params={"location_id": LOCATION_ID, "start_date": TODAY})
        assert r.status_code == 200

    def test_delete(self, admin_session):
        for cid in TestLegionella.created_ids:
            r = admin_session.delete(f"{BASE_URL}/api/admin/legionella/{cid}")
            assert r.status_code == 200
        TestLegionella.created_ids.clear()
