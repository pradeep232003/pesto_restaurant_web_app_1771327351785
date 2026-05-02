"""Backend tests for Kitchen Closedown feature (mirrors Daily Checks but with separate collection)."""
import os
import requests
import pytest

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
ADMIN_EMAIL = "admin@jollys.com"
ADMIN_PASSWORD = "Admin123!"

EXPECTED_DEFAULT_IDS = {
    "weekly_cleaning_signoff", "food_covered_labelled", "waste_removed_bins",
    "fridge_temp_recorded", "appliances_off", "extraction_off",
    "out_of_date_discarded", "prep_areas_disinfected", "floors_swept_clean",
}


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json().get("access_token")


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def first_location():
    r = requests.get(f"{BASE_URL}/api/locations")
    assert r.status_code == 200
    locs = [loc for loc in r.json() if loc.get("is_active", True)]
    assert len(locs) > 0
    return locs[0]


# ---------- Default seed (9 items with fixed IDs) ----------
def test_get_closedown_items_returns_9_defaults(admin_headers):
    r = requests.get(f"{BASE_URL}/api/admin/kitchen-closedown/items", headers=admin_headers)
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list)
    # at least 9 default seed (allow leftover TEST items? Filter active globals)
    default_ids = {it["id"] for it in items if it.get("location_id") in (None,)}
    # endpoint already filters by global when no location_id passed
    seed_ids = {it["id"] for it in items}
    assert EXPECTED_DEFAULT_IDS.issubset(seed_ids), f"Missing default IDs. Got: {seed_ids}"


def test_get_items_unauthenticated():
    r = requests.get(f"{BASE_URL}/api/admin/kitchen-closedown/items")
    assert r.status_code in (401, 403)


def test_get_items_with_location_returns_global_plus_location(admin_headers, first_location):
    r = requests.get(
        f"{BASE_URL}/api/admin/kitchen-closedown/items",
        headers=admin_headers,
        params={"location_id": first_location["id"]},
    )
    assert r.status_code == 200
    items = r.json()
    seed_ids = {it["id"] for it in items}
    assert EXPECTED_DEFAULT_IDS.issubset(seed_ids)


def test_items_all_admin_only(admin_headers):
    r_no = requests.get(f"{BASE_URL}/api/admin/kitchen-closedown/items/all")
    assert r_no.status_code in (401, 403)
    r = requests.get(f"{BASE_URL}/api/admin/kitchen-closedown/items/all", headers=admin_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)
    assert len(r.json()) >= 9


# ---------- Submit / Get / Upsert ----------
def test_submit_get_upsert_history(admin_headers, first_location):
    loc_id = first_location["id"]
    date = "2026-04-15"
    checks = {"weekly_cleaning_signoff": True, "appliances_off": True, "floors_swept_clean": False}
    r = requests.post(
        f"{BASE_URL}/api/admin/kitchen-closedown",
        headers=admin_headers,
        json={"location_id": loc_id, "date": date, "checks": checks, "note": "TEST_closedown"},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["passed"] == 2
    assert data["total"] == 9
    first_id = data["id"]

    # GET
    r2 = requests.get(
        f"{BASE_URL}/api/admin/kitchen-closedown",
        headers=admin_headers,
        params={"location_id": loc_id, "date": date},
    )
    assert r2.status_code == 200
    saved = r2.json()
    assert saved is not None
    assert saved["location_id"] == loc_id
    assert saved["date"] == date
    assert saved["checks"]["weekly_cleaning_signoff"] is True
    assert saved["passed_items"] == 2
    assert saved["note"] == "TEST_closedown"
    assert "items_snapshot" in saved and isinstance(saved["items_snapshot"], list)
    assert len(saved["items_snapshot"]) == 9

    # Upsert (same loc+date should not duplicate)
    all_checks = {it_id: True for it_id in EXPECTED_DEFAULT_IDS}
    r3 = requests.post(
        f"{BASE_URL}/api/admin/kitchen-closedown",
        headers=admin_headers,
        json={"location_id": loc_id, "date": date, "checks": all_checks, "note": "TEST_updated"},
    )
    assert r3.status_code == 200
    assert r3.json()["id"] == first_id, "upsert should keep same id"
    assert r3.json()["passed"] == 9


# ---------- History (admin only) ----------
def test_history_and_completion_admin_only(admin_headers, first_location):
    r_no = requests.get(f"{BASE_URL}/api/admin/kitchen-closedown/history")
    assert r_no.status_code in (401, 403)
    r_no2 = requests.get(f"{BASE_URL}/api/admin/kitchen-closedown/completion?month=2026-04")
    assert r_no2.status_code in (401, 403)

    r = requests.get(
        f"{BASE_URL}/api/admin/kitchen-closedown/history",
        headers=admin_headers,
        params={"location_id": first_location["id"]},
    )
    assert r.status_code == 200
    assert isinstance(r.json(), list)

    rc = requests.get(
        f"{BASE_URL}/api/admin/kitchen-closedown/completion",
        headers=admin_headers,
        params={"month": "2026-04"},
    )
    assert rc.status_code == 200
    data = rc.json()
    assert data["month"] == "2026-04"
    assert data["days_in_month"] == 30
    assert isinstance(data.get("grid"), dict)


# ---------- Items CRUD + scope ----------
def test_items_crud_and_scope(admin_headers, first_location):
    loc_id = first_location["id"]

    # CREATE location-specific
    r_c = requests.post(
        f"{BASE_URL}/api/admin/kitchen-closedown/items",
        headers=admin_headers,
        json={"text": "TEST_closedown_loc_item", "location_id": loc_id},
    )
    assert r_c.status_code == 200, r_c.text
    created = r_c.json()
    assert created["text"] == "TEST_closedown_loc_item"
    assert created["location_id"] == loc_id
    new_id = created["id"]

    # Visible for that location only
    r_loc = requests.get(
        f"{BASE_URL}/api/admin/kitchen-closedown/items",
        headers=admin_headers, params={"location_id": loc_id},
    )
    assert any(i["id"] == new_id for i in r_loc.json())

    r_glob = requests.get(f"{BASE_URL}/api/admin/kitchen-closedown/items", headers=admin_headers)
    assert not any(i["id"] == new_id for i in r_glob.json())

    # PATCH: text + scope→global
    r_u = requests.patch(
        f"{BASE_URL}/api/admin/kitchen-closedown/items/{new_id}",
        headers=admin_headers,
        json={"text": "TEST_closedown_updated_global", "scope": "global"},
    )
    assert r_u.status_code == 200
    assert r_u.json()["text"] == "TEST_closedown_updated_global"
    assert r_u.json()["location_id"] is None

    # Flip back to location
    r_u2 = requests.patch(
        f"{BASE_URL}/api/admin/kitchen-closedown/items/{new_id}",
        headers=admin_headers,
        json={"scope": "location", "location_id": loc_id},
    )
    assert r_u2.status_code == 200
    assert r_u2.json()["location_id"] == loc_id

    # DELETE
    r_d = requests.delete(
        f"{BASE_URL}/api/admin/kitchen-closedown/items/{new_id}",
        headers=admin_headers,
    )
    assert r_d.status_code == 200


def test_items_admin_only_gating():
    r = requests.post(f"{BASE_URL}/api/admin/kitchen-closedown/items", json={"text": "should fail"})
    assert r.status_code in (401, 403)
    r2 = requests.patch(f"{BASE_URL}/api/admin/kitchen-closedown/items/fakeid", json={"text": "no"})
    assert r2.status_code in (401, 403)
    r3 = requests.delete(f"{BASE_URL}/api/admin/kitchen-closedown/items/fakeid")
    assert r3.status_code in (401, 403)


def test_update_nonexistent_item_returns_404(admin_headers):
    r = requests.patch(
        f"{BASE_URL}/api/admin/kitchen-closedown/items/nonexistent_id_xyz",
        headers=admin_headers,
        json={"text": "TEST_notfound"},
    )
    assert r.status_code == 404


def test_delete_nonexistent_item_returns_404(admin_headers):
    r = requests.delete(
        f"{BASE_URL}/api/admin/kitchen-closedown/items/nonexistent_id_xyz",
        headers=admin_headers,
    )
    assert r.status_code == 404


def test_create_item_validation_short_text(admin_headers):
    r = requests.post(
        f"{BASE_URL}/api/admin/kitchen-closedown/items",
        headers=admin_headers,
        json={"text": "a"},
    )
    assert r.status_code == 422


# ---------- Independence regression: closedown vs daily-checks separate collections ----------
def test_closedown_independent_from_daily_checks(admin_headers, first_location):
    """Creating an item in closedown must NOT appear in daily-checks and vice versa."""
    loc_id = first_location["id"]

    # baseline daily checks count
    r_dc_before = requests.get(f"{BASE_URL}/api/admin/daily-checks/items", headers=admin_headers,
                               params={"location_id": loc_id})
    assert r_dc_before.status_code == 200
    dc_count_before = len(r_dc_before.json())

    # Create a closedown item
    r_c = requests.post(
        f"{BASE_URL}/api/admin/kitchen-closedown/items",
        headers=admin_headers,
        json={"text": "TEST_closedown_independence", "location_id": loc_id},
    )
    assert r_c.status_code == 200
    new_id = r_c.json()["id"]

    # daily checks must be unchanged
    r_dc_after = requests.get(f"{BASE_URL}/api/admin/daily-checks/items", headers=admin_headers,
                              params={"location_id": loc_id})
    assert r_dc_after.status_code == 200
    assert len(r_dc_after.json()) == dc_count_before
    assert not any(i["id"] == new_id for i in r_dc_after.json())
    assert not any(i.get("text", "") == "TEST_closedown_independence" for i in r_dc_after.json())

    # Reverse: daily-checks item should not appear in closedown
    r_dcc = requests.post(
        f"{BASE_URL}/api/admin/daily-checks/items",
        headers=admin_headers,
        json={"text": "TEST_dailycheck_independence", "location_id": loc_id},
    )
    assert r_dcc.status_code == 200
    dc_id = r_dcc.json()["id"]

    r_cd = requests.get(f"{BASE_URL}/api/admin/kitchen-closedown/items", headers=admin_headers,
                        params={"location_id": loc_id})
    assert not any(i["id"] == dc_id for i in r_cd.json())
    assert not any(i.get("text", "") == "TEST_dailycheck_independence" for i in r_cd.json())

    # Cleanup both
    requests.delete(f"{BASE_URL}/api/admin/kitchen-closedown/items/{new_id}", headers=admin_headers)
    requests.delete(f"{BASE_URL}/api/admin/daily-checks/items/{dc_id}", headers=admin_headers)


# ---------- Cleanup ----------
@pytest.fixture(scope="module", autouse=True)
def cleanup(admin_headers):
    yield
    try:
        r = requests.get(f"{BASE_URL}/api/admin/kitchen-closedown/items/all", headers=admin_headers)
        if r.status_code == 200:
            for i in r.json():
                if str(i.get("text", "")).startswith("TEST_"):
                    requests.delete(
                        f"{BASE_URL}/api/admin/kitchen-closedown/items/{i['id']}",
                        headers=admin_headers,
                    )
    except Exception:
        pass
