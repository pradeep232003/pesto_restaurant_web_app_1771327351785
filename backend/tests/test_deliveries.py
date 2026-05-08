"""
Backend tests for JKHive Deliveries (Goods-In) workflow:
- Suppliers CRUD: list/create/delete with auth
- Records CRUD: list/create/delete with auto-pass logic + _id exclusion
- Auth gating (401 on unauthenticated)
"""
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
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"login failed {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    if token:
        s.headers["Authorization"] = f"Bearer {token}"
    return s


@pytest.fixture(scope="module")
def location_id(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/locations", timeout=15)
    assert r.status_code == 200
    locs = r.json()
    assert isinstance(locs, list) and len(locs) > 0
    return locs[0].get("id") or locs[0].get("slug")


# ---------- AUTH GATES ----------

class TestAuthGates:
    def test_suppliers_list_unauth(self):
        r = requests.get(f"{BASE_URL}/api/admin/deliveries/suppliers?location_id=x", timeout=10)
        assert r.status_code in (401, 403)

    def test_suppliers_post_unauth(self):
        r = requests.post(f"{BASE_URL}/api/admin/deliveries/suppliers",
                          json={"location_id": "x", "name": "X"}, timeout=10)
        assert r.status_code in (401, 403)

    def test_records_list_unauth(self):
        r = requests.get(f"{BASE_URL}/api/admin/deliveries?location_id=x", timeout=10)
        assert r.status_code in (401, 403)

    def test_records_post_unauth(self):
        r = requests.post(f"{BASE_URL}/api/admin/deliveries",
                          json={"location_id": "x", "supplier_id": "y", "item_name": "z",
                                "item_category": "z", "temp_c": 4.0}, timeout=10)
        assert r.status_code in (401, 403)


# ---------- SUPPLIERS ----------

class TestSuppliers:
    created_ids = []

    def test_list_returns_array(self, admin_session, location_id):
        r = admin_session.get(f"{BASE_URL}/api/admin/deliveries/suppliers",
                              params={"location_id": location_id}, timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_supplier(self, admin_session, location_id):
        body = {"location_id": location_id, "name": "TEST_Bidfood",
                "type": "general", "info": "test info"}
        r = admin_session.post(f"{BASE_URL}/api/admin/deliveries/suppliers",
                               json=body, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["name"] == "TEST_Bidfood"
        assert data["type"] == "general"
        assert data["location_id"] == location_id
        assert "id" in data
        assert "_id" not in data
        TestSuppliers.created_ids.append(data["id"])

    def test_create_supplier_empty_name_400(self, admin_session, location_id):
        r = admin_session.post(f"{BASE_URL}/api/admin/deliveries/suppliers",
                               json={"location_id": location_id, "name": "   ",
                                     "type": "general"}, timeout=10)
        assert r.status_code == 400

    def test_list_sorted_by_name(self, admin_session, location_id):
        # Create A and Z to test ordering
        for n in ["TEST_Zebra Foods", "TEST_Apple Co"]:
            r = admin_session.post(f"{BASE_URL}/api/admin/deliveries/suppliers",
                                   json={"location_id": location_id, "name": n,
                                         "type": "general"}, timeout=10)
            assert r.status_code == 200
            TestSuppliers.created_ids.append(r.json()["id"])
        r = admin_session.get(f"{BASE_URL}/api/admin/deliveries/suppliers",
                              params={"location_id": location_id}, timeout=10)
        assert r.status_code == 200
        names = [s["name"] for s in r.json()]
        assert names == sorted(names), f"not sorted: {names}"

    def test_delete_supplier_404(self, admin_session):
        r = admin_session.delete(f"{BASE_URL}/api/admin/deliveries/suppliers/nonexistent_zzz",
                                 timeout=10)
        assert r.status_code == 404

    def test_delete_supplier_ok(self, admin_session):
        for sid in list(TestSuppliers.created_ids):
            r = admin_session.delete(f"{BASE_URL}/api/admin/deliveries/suppliers/{sid}",
                                     timeout=10)
            # Some may be deleted later in record tests; allow 200 here
            assert r.status_code in (200, 404)
            if r.status_code == 200:
                assert r.json() == {"deleted": True}
        TestSuppliers.created_ids.clear()


# ---------- RECORDS ----------

class TestRecords:
    supplier_id = None
    record_ids = []

    @pytest.fixture(autouse=True, scope="class")
    def _supplier(self, admin_session, location_id):
        r = admin_session.post(f"{BASE_URL}/api/admin/deliveries/suppliers",
                               json={"location_id": location_id, "name": "TEST_Rec Supplier",
                                     "type": "fishmonger"}, timeout=10)
        assert r.status_code == 200
        TestRecords.supplier_id = r.json()["id"]
        yield
        # cleanup
        admin_session.delete(f"{BASE_URL}/api/admin/deliveries/suppliers/{TestRecords.supplier_id}",
                             timeout=10)

    def test_create_chilled_pass(self, admin_session, location_id):
        body = {"location_id": location_id, "supplier_id": TestRecords.supplier_id,
                "item_name": "TEST_Chicken", "item_category": "Meat",
                "temp_c": 4.0, "comment": "ok"}
        r = admin_session.post(f"{BASE_URL}/api/admin/deliveries", json=body, timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["chilled_pass"] is True
        assert d["frozen_pass"] is False
        assert d["temp_c"] == 4.0
        assert d["supplier_name"] == "TEST_Rec Supplier"
        assert "_id" not in d
        TestRecords.record_ids.append(d["id"])

    def test_create_frozen_pass(self, admin_session, location_id):
        body = {"location_id": location_id, "supplier_id": TestRecords.supplier_id,
                "item_name": "TEST_Frozen Peas", "item_category": "Vegetables",
                "temp_c": -19.0}
        r = admin_session.post(f"{BASE_URL}/api/admin/deliveries", json=body, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["chilled_pass"] is True
        assert d["frozen_pass"] is True
        TestRecords.record_ids.append(d["id"])

    def test_create_out_of_range(self, admin_session, location_id):
        body = {"location_id": location_id, "supplier_id": TestRecords.supplier_id,
                "item_name": "TEST_Warm Milk", "item_category": "Dairy",
                "temp_c": 12.0}
        r = admin_session.post(f"{BASE_URL}/api/admin/deliveries", json=body, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["chilled_pass"] is False
        assert d["frozen_pass"] is False
        TestRecords.record_ids.append(d["id"])

    def test_list_records_excludes_id_and_sorted_desc(self, admin_session, location_id):
        r = admin_session.get(f"{BASE_URL}/api/admin/deliveries",
                              params={"location_id": location_id}, timeout=10)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        for it in items:
            assert "_id" not in it
        # ours included
        ours = [it for it in items if it["id"] in TestRecords.record_ids]
        assert len(ours) == 3
        # Sorted by recorded_at desc
        ts = [it["recorded_at"] for it in items]
        assert ts == sorted(ts, reverse=True)

    def test_delete_record_404(self, admin_session):
        r = admin_session.delete(f"{BASE_URL}/api/admin/deliveries/nonexistent_zzz", timeout=10)
        assert r.status_code == 404

    def test_delete_records_ok(self, admin_session):
        for rid in TestRecords.record_ids:
            r = admin_session.delete(f"{BASE_URL}/api/admin/deliveries/{rid}", timeout=10)
            assert r.status_code == 200
            assert r.json() == {"deleted": True}
        TestRecords.record_ids.clear()
