"""
Backend tests for iteration 27:
- Catalog includes section per category + sections array
- Suppliers sites scope (global/site-only/cross-site visibility)
- PATCH suppliers (name/type/info/sites; 400 empty name; 404 unknown id)
- Inventory: POST /stock create+accumulate+unit-mismatch reset, GET items, GET batches, DELETE batch
- Auth gates on inventory + new supplier endpoints
"""
import os
import pytest
import requests

def _get_base_url():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if url:
        return url.rstrip("/")
    # Fall back to frontend/.env (so test can run outside frontend container)
    try:
        with open("/app/frontend/.env") as fh:
            for line in fh:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip().rstrip("/")
    except Exception:
        pass
    raise RuntimeError("REACT_APP_BACKEND_URL not set")


BASE_URL = _get_base_url()
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
def locations(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/locations", timeout=15)
    assert r.status_code == 200
    locs = r.json()
    assert isinstance(locs, list) and len(locs) >= 2
    ids = [(l.get("id") or l.get("slug")) for l in locs]
    primary = "timperley-altrincham" if "timperley-altrincham" in ids else ids[0]
    secondary = "howe-bridge-atherton" if "howe-bridge-atherton" in ids else ids[1]
    return {"primary": primary, "secondary": secondary}


# -------- AUTH GATES --------

class TestAuthGates:
    def test_inventory_list_unauth(self):
        r = requests.get(f"{BASE_URL}/api/admin/inventory?location_id=x", timeout=10)
        assert r.status_code in (401, 403)

    def test_inventory_post_unauth(self):
        r = requests.post(f"{BASE_URL}/api/admin/inventory/stock",
                          json={"location_id": "x", "item_name": "y", "item_category": "z",
                                "unit": "kg", "amount": 1.0}, timeout=10)
        assert r.status_code in (401, 403)

    def test_inventory_batches_unauth(self):
        r = requests.get(f"{BASE_URL}/api/admin/inventory/batches?location_id=x", timeout=10)
        assert r.status_code in (401, 403)

    def test_inventory_batch_delete_unauth(self):
        r = requests.delete(f"{BASE_URL}/api/admin/inventory/batches/anything", timeout=10)
        assert r.status_code in (401, 403)

    def test_supplier_patch_unauth(self):
        r = requests.patch(f"{BASE_URL}/api/admin/deliveries/suppliers/anything",
                           json={"name": "x"}, timeout=10)
        assert r.status_code in (401, 403)


# -------- CATALOG SECTIONS --------

class TestCatalogSections:
    def test_catalog_has_sections_array(self, admin_session, locations):
        r = admin_session.get(f"{BASE_URL}/api/admin/cooking-cooling/catalog",
                              params={"location_id": locations["primary"]}, timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert "sections" in data
        assert data["sections"] == ["Fresh", "Frozen", "Dry", "Prepared", "Beverages"]

    def test_catalog_categories_have_section(self, admin_session, locations):
        r = admin_session.get(f"{BASE_URL}/api/admin/cooking-cooling/catalog",
                              params={"location_id": locations["primary"]}, timeout=10)
        data = r.json()
        cats = data["categories"]
        valid = set(data["sections"])
        for c in cats:
            assert "section" in c, f"missing section in {c['name']}"
            assert c["section"] in valid, f"invalid section {c['section']} for {c['name']}"

    def test_catalog_known_section_assignments(self, admin_session, locations):
        r = admin_session.get(f"{BASE_URL}/api/admin/cooking-cooling/catalog",
                              params={"location_id": locations["primary"]}, timeout=10)
        cats = {c["name"]: c["section"] for c in r.json()["categories"]}
        # spot-check
        assert cats.get("Beef") == "Fresh"
        assert cats.get("Eggs") == "Fresh"
        assert cats.get("Milk") == "Fresh"
        assert cats.get("Rice And Grains") == "Dry"
        assert cats.get("Salad") == "Prepared"
        assert cats.get("Pastry") == "Prepared"
        assert cats.get("General") == "Prepared"


# -------- SUPPLIER SITES + PATCH --------

class TestSupplierSitesAndPatch:
    created = []

    def test_create_supplier_global_sites_empty(self, admin_session, locations):
        r = admin_session.post(f"{BASE_URL}/api/admin/deliveries/suppliers",
                               json={"name": "TEST_Global Sup", "type": "general",
                                     "info": "global", "sites": []}, timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["sites"] == []
        assert "_id" not in d
        TestSupplierSitesAndPatch.created.append(d["id"])

    def test_create_supplier_site_scoped(self, admin_session, locations):
        r = admin_session.post(f"{BASE_URL}/api/admin/deliveries/suppliers",
                               json={"name": "TEST_Site Sup", "type": "butcher",
                                     "info": "primary only", "sites": [locations["primary"]]}, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["sites"] == [locations["primary"]]
        TestSupplierSitesAndPatch.created.append(d["id"])

    def test_global_visible_at_primary(self, admin_session, locations):
        r = admin_session.get(f"{BASE_URL}/api/admin/deliveries/suppliers",
                              params={"location_id": locations["primary"]}, timeout=10)
        assert r.status_code == 200
        names = [s["name"] for s in r.json()]
        assert "TEST_Global Sup" in names

    def test_global_visible_at_secondary(self, admin_session, locations):
        r = admin_session.get(f"{BASE_URL}/api/admin/deliveries/suppliers",
                              params={"location_id": locations["secondary"]}, timeout=10)
        assert r.status_code == 200
        names = [s["name"] for s in r.json()]
        assert "TEST_Global Sup" in names

    def test_site_only_visible_at_primary_only(self, admin_session, locations):
        r1 = admin_session.get(f"{BASE_URL}/api/admin/deliveries/suppliers",
                               params={"location_id": locations["primary"]}, timeout=10)
        r2 = admin_session.get(f"{BASE_URL}/api/admin/deliveries/suppliers",
                               params={"location_id": locations["secondary"]}, timeout=10)
        n1 = [s["name"] for s in r1.json()]
        n2 = [s["name"] for s in r2.json()]
        assert "TEST_Site Sup" in n1
        assert "TEST_Site Sup" not in n2

    def test_patch_update_name_type_info_sites(self, admin_session, locations):
        sid = TestSupplierSitesAndPatch.created[1]  # site-scoped one
        new_sites = [locations["primary"], locations["secondary"]]
        r = admin_session.patch(f"{BASE_URL}/api/admin/deliveries/suppliers/{sid}",
                                json={"name": "TEST_Site Sup Renamed", "type": "fishmonger",
                                      "info": "updated", "sites": new_sites}, timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["name"] == "TEST_Site Sup Renamed"
        assert d["type"] == "fishmonger"
        assert d["info"] == "updated"
        assert set(d["sites"]) == set(new_sites)

        # Re-list at secondary now should include it
        r2 = admin_session.get(f"{BASE_URL}/api/admin/deliveries/suppliers",
                               params={"location_id": locations["secondary"]}, timeout=10)
        names = [s["name"] for s in r2.json()]
        assert "TEST_Site Sup Renamed" in names

    def test_patch_empty_name_400(self, admin_session):
        sid = TestSupplierSitesAndPatch.created[0]
        r = admin_session.patch(f"{BASE_URL}/api/admin/deliveries/suppliers/{sid}",
                                json={"name": "   "}, timeout=10)
        assert r.status_code == 400

    def test_patch_unknown_404(self, admin_session):
        r = admin_session.patch(f"{BASE_URL}/api/admin/deliveries/suppliers/nonexistent_zz",
                                json={"name": "x"}, timeout=10)
        assert r.status_code == 404

    def test_cleanup_suppliers(self, admin_session):
        for sid in TestSupplierSitesAndPatch.created:
            admin_session.delete(f"{BASE_URL}/api/admin/deliveries/suppliers/{sid}", timeout=10)
        TestSupplierSitesAndPatch.created.clear()


# -------- INVENTORY --------

class TestInventory:
    item_id = None
    batch_ids = []

    def test_create_stock_new_item(self, admin_session, locations):
        body = {"location_id": locations["primary"], "item_name": "TEST_Brisket",
                "item_category": "Beef", "item_icon": "🐄", "unit": "kg", "amount": 5.0,
                "price_per_unit": 12.5, "batch_no": "B001", "use_by": "2026-02-15"}
        r = admin_session.post(f"{BASE_URL}/api/admin/inventory/stock", json=body, timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "item_id" in d
        assert "_id" not in d["batch"]
        assert d["batch"]["amount"] == 5.0
        assert d["batch"]["unit"] == "kg"
        TestInventory.item_id = d["item_id"]
        TestInventory.batch_ids.append(d["batch"]["id"])

    def test_create_stock_increments_when_unit_matches(self, admin_session, locations):
        body = {"location_id": locations["primary"], "item_name": "TEST_Brisket",
                "item_category": "Beef", "unit": "kg", "amount": 3.0, "batch_no": "B002"}
        r = admin_session.post(f"{BASE_URL}/api/admin/inventory/stock", json=body, timeout=10)
        assert r.status_code == 200
        TestInventory.batch_ids.append(r.json()["batch"]["id"])
        # Verify rolling total via list
        r2 = admin_session.get(f"{BASE_URL}/api/admin/inventory",
                               params={"location_id": locations["primary"]}, timeout=10)
        assert r2.status_code == 200
        items = r2.json()
        ours = [i for i in items if i["item_name"] == "TEST_Brisket"]
        assert len(ours) == 1
        assert ours[0]["current_amount"] == 8.0
        assert ours[0]["unit"] == "kg"
        assert "_id" not in ours[0]

    def test_create_stock_unit_mismatch_resets(self, admin_session, locations):
        body = {"location_id": locations["primary"], "item_name": "TEST_Brisket",
                "item_category": "Beef", "unit": "g", "amount": 250.0}
        r = admin_session.post(f"{BASE_URL}/api/admin/inventory/stock", json=body, timeout=10)
        assert r.status_code == 200
        TestInventory.batch_ids.append(r.json()["batch"]["id"])
        r2 = admin_session.get(f"{BASE_URL}/api/admin/inventory",
                               params={"location_id": locations["primary"]}, timeout=10)
        ours = [i for i in r2.json() if i["item_name"] == "TEST_Brisket"][0]
        assert ours["current_amount"] == 250.0  # reset to new batch amount
        assert ours["unit"] == "g"

    def test_inventory_list_sorted_by_name(self, admin_session, locations):
        # Add a 'A' item
        r = admin_session.post(f"{BASE_URL}/api/admin/inventory/stock",
                               json={"location_id": locations["primary"], "item_name": "TEST_Apple",
                                     "item_category": "Produce", "unit": "kg", "amount": 1.0},
                               timeout=10)
        TestInventory.batch_ids.append(r.json()["batch"]["id"])
        r2 = admin_session.get(f"{BASE_URL}/api/admin/inventory",
                               params={"location_id": locations["primary"]}, timeout=10)
        names = [i["item_name"] for i in r2.json()]
        assert names == sorted(names)

    def test_list_batches_filters_and_sort(self, admin_session, locations):
        r = admin_session.get(f"{BASE_URL}/api/admin/inventory/batches",
                              params={"location_id": locations["primary"], "item_id": TestInventory.item_id},
                              timeout=10)
        assert r.status_code == 200
        rows = r.json()
        for r0 in rows:
            assert "_id" not in r0
            assert r0["item_id"] == TestInventory.item_id
        # sorted by use_by asc, blanks last
        use_bys = [(r0.get("use_by") or "9999-12-31") for r0 in rows]
        assert use_bys == sorted(use_bys)

    def test_delete_batch_decrements_when_unit_matches(self, admin_session, locations):
        # Create a fresh item with two batches in same unit
        b1 = admin_session.post(f"{BASE_URL}/api/admin/inventory/stock",
                                json={"location_id": locations["primary"], "item_name": "TEST_Cheese",
                                      "item_category": "Dairy", "unit": "kg", "amount": 4.0},
                                timeout=10).json()
        b2 = admin_session.post(f"{BASE_URL}/api/admin/inventory/stock",
                                json={"location_id": locations["primary"], "item_name": "TEST_Cheese",
                                      "item_category": "Dairy", "unit": "kg", "amount": 2.0},
                                timeout=10).json()
        batch1_id = b1["batch"]["id"]
        batch2_id = b2["batch"]["id"]
        TestInventory.batch_ids.extend([batch1_id, batch2_id])
        item_id = b1["item_id"]
        # delete batch1 (4kg)
        r = admin_session.delete(f"{BASE_URL}/api/admin/inventory/batches/{batch1_id}", timeout=10)
        assert r.status_code == 200
        TestInventory.batch_ids.remove(batch1_id)
        # parent should now have 2.0 kg
        r2 = admin_session.get(f"{BASE_URL}/api/admin/inventory",
                               params={"location_id": locations["primary"]}, timeout=10)
        ours = [i for i in r2.json() if i["id"] == item_id][0]
        assert ours["current_amount"] == 2.0

    def test_delete_batch_404(self, admin_session):
        r = admin_session.delete(f"{BASE_URL}/api/admin/inventory/batches/nonexistent_zz", timeout=10)
        assert r.status_code == 404

    def test_cleanup(self, admin_session, locations):
        # delete all remaining test batches; items with 0 amount left behind are fine but tidy: leave parents,
        # since there's no item-delete endpoint. Just delete batches.
        r2 = admin_session.get(f"{BASE_URL}/api/admin/inventory/batches",
                               params={"location_id": locations["primary"]}, timeout=10)
        for b in r2.json():
            if b.get("item_name", "").startswith("TEST_"):
                admin_session.delete(f"{BASE_URL}/api/admin/inventory/batches/{b['id']}", timeout=10)
