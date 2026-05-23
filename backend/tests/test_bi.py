"""BI tests — super_admin BI overview, menu cost, recipe persistence, staff hourly_rate."""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_EMAIL = "admin@jollys.com"
ADMIN_PASSWORD = "Admin123!"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"Login failed: {r.status_code} {r.text}")
    return s


# ---------------- BI overview ----------------

class TestBIOverview:
    def test_super_admin_can_access(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/bi", timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert set(["period", "kpi", "by_location", "menu_recipe_summary"]).issubset(data.keys())
        for k in ["total_revenue", "total_labour", "total_hours", "labour_pct",
                  "est_food_cost", "food_cost_pct", "gross_margin",
                  "gross_margin_pct", "entries"]:
            assert k in data["kpi"], f"missing kpi key: {k}"

    def test_unauthenticated_blocked(self):
        r = requests.get(f"{BASE_URL}/api/admin/bi", timeout=20)
        assert r.status_code in (401, 403)

    def test_date_filtering_changes_entries(self, admin_session):
        all_r = admin_session.get(f"{BASE_URL}/api/admin/bi",
                                  params={"start_date": "2020-01-01", "end_date": "2030-12-31"}, timeout=20)
        empty_r = admin_session.get(f"{BASE_URL}/api/admin/bi",
                                    params={"start_date": "1999-01-01", "end_date": "1999-12-31"}, timeout=20)
        assert all_r.status_code == 200 and empty_r.status_code == 200
        assert empty_r.json()["kpi"]["entries"] == 0
        assert all_r.json()["kpi"]["entries"] >= empty_r.json()["kpi"]["entries"]

    def test_location_filtering(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/bi",
                              params={"start_date": "2020-01-01", "end_date": "2030-12-31",
                                      "location_id": "timperley-altrincham"}, timeout=20)
        assert r.status_code == 200
        for loc in r.json()["by_location"]:
            assert loc["location_id"] == "timperley-altrincham"


# ---------------- Menu cost ----------------

class TestBIMenuCost:
    def test_menu_cost_super_admin(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/bi/menu-cost", timeout=20)
        assert r.status_code == 200
        items = r.json().get("items", [])
        assert isinstance(items, list) and len(items) > 0
        sample = items[0]
        for k in ["id", "name", "price", "recipe_cost", "food_cost_pct", "margin", "has_recipe"]:
            assert k in sample, f"missing key {k}"


# ---------------- Recipe persistence on menu items ----------------

class TestRecipePersistence:
    def test_put_menu_item_with_recipe_persists_and_affects_bi(self, admin_session):
        # find an item
        items = admin_session.get(f"{BASE_URL}/api/admin/menu-items", timeout=20).json()
        assert isinstance(items, list) and len(items) > 0
        # Pick one in timperley
        target = next((it for it in items if it.get("location_id") == "timperley-altrincham"), items[0])
        item_id = target["id"]
        loc_id = target["location_id"]

        recipe = [
            {"ingredient": "TEST_flour", "qty": 0.2, "unit": "kg", "unit_cost": 1.50},
            {"ingredient": "TEST_cheese", "qty": 0.1, "unit": "kg", "unit_cost": 8.00},
        ]
        # PUT update
        r = admin_session.put(f"{BASE_URL}/api/admin/menu-items/{item_id}",
                              json={"recipe": recipe}, timeout=20)
        assert r.status_code == 200, r.text

        # Verify persisted
        items2 = admin_session.get(f"{BASE_URL}/api/admin/menu-items", timeout=20).json()
        updated = next((it for it in items2 if it["id"] == item_id), None)
        assert updated and len(updated.get("recipe") or []) == 2
        assert updated["recipe"][0]["ingredient"] == "TEST_flour"

        # menu-cost endpoint reflects cost
        mc = admin_session.get(f"{BASE_URL}/api/admin/bi/menu-cost",
                               params={"location_id": loc_id}, timeout=20).json()
        mc_item = next((m for m in mc["items"] if m["id"] == item_id), None)
        assert mc_item and mc_item["has_recipe"] is True
        assert mc_item["recipe_cost"] == pytest.approx(0.2 * 1.5 + 0.1 * 8.0, rel=0.01)


# ---------------- Staff hourly_rate ----------------

class TestStaffHourlyRate:
    def test_create_and_patch_staff_hourly_rate(self, admin_session):
        # Create
        r = admin_session.post(f"{BASE_URL}/api/admin/staff",
                               json={"name": "TEST_BIStaff", "hourly_rate": 12.5}, timeout=20)
        assert r.status_code == 200, r.text
        sid = r.json()["id"]
        assert r.json()["hourly_rate"] == 12.5

        # List should contain the staff with rate
        lst = admin_session.get(f"{BASE_URL}/api/admin/staff", timeout=20).json()
        found = next((s for s in lst if s["id"] == sid), None)
        assert found and found["hourly_rate"] == 12.5

        # Patch the rate
        r2 = admin_session.patch(f"{BASE_URL}/api/admin/staff/{sid}",
                                 json={"hourly_rate": 15.75}, timeout=20)
        assert r2.status_code == 200
        assert r2.json()["hourly_rate"] == 15.75

        # cleanup
        admin_session.delete(f"{BASE_URL}/api/admin/staff/{sid}", timeout=20)
