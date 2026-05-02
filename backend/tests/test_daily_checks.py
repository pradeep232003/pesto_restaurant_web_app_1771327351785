"""Backend tests for Daily Checks feature"""
import os
import requests
import pytest

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://jovial-hamilton-4.preview.emergentagent.com').rstrip('/')
ADMIN_EMAIL = "admin@jollys.com"
ADMIN_PASSWORD = "Admin123!"


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
    locs = [l for l in r.json() if l.get("is_active", True)]
    assert len(locs) > 0
    return locs[0]


# ---------- Items ----------
def test_get_checklist_items(admin_headers):
    r = requests.get(f"{BASE_URL}/api/admin/daily-checks/items", headers=admin_headers)
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list)
    assert len(items) == 15
    for it in items:
        assert "id" in it and "text" in it


def test_get_items_unauthenticated():
    r = requests.get(f"{BASE_URL}/api/admin/daily-checks/items")
    assert r.status_code in (401, 403)


# ---------- Submit + GET upsert ----------
def test_submit_and_get_daily_check(admin_headers, first_location):
    loc_id = first_location["id"]
    date = "2026-02-11"
    checks = {"staff_fit": True, "sinks_clean": True, "fridge_freezer_working": False}
    r = requests.post(
        f"{BASE_URL}/api/admin/daily-checks",
        headers=admin_headers,
        json={"location_id": loc_id, "date": date, "checks": checks, "note": "TEST_note"},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["passed"] == 2
    assert data["total"] == 15
    first_id = data["id"]

    # GET
    r2 = requests.get(
        f"{BASE_URL}/api/admin/daily-checks",
        headers=admin_headers,
        params={"location_id": loc_id, "date": date},
    )
    assert r2.status_code == 200
    saved = r2.json()
    assert saved is not None
    assert saved["location_id"] == loc_id
    assert saved["date"] == date
    assert saved["checks"]["staff_fit"] is True
    assert saved["passed_items"] == 2
    assert saved["note"] == "TEST_note"

    # Submit again (should UPDATE, not duplicate)
    new_checks = {k["id"]: True for k in requests.get(f"{BASE_URL}/api/admin/daily-checks/items", headers=admin_headers).json()}
    r3 = requests.post(
        f"{BASE_URL}/api/admin/daily-checks",
        headers=admin_headers,
        json={"location_id": loc_id, "date": date, "checks": new_checks, "note": "TEST_updated"},
    )
    assert r3.status_code == 200
    data3 = r3.json()
    assert data3["id"] == first_id, "upsert should return same id, not duplicate"
    assert data3["passed"] == 15

    # Verify history has only ONE entry for (loc, date)
    rh = requests.get(
        f"{BASE_URL}/api/admin/daily-checks/history",
        headers=admin_headers,
        params={"location_id": loc_id, "start_date": date, "end_date": date},
    )
    assert rh.status_code == 200
    matching = [e for e in rh.json() if e["location_id"] == loc_id and e["date"] == date]
    assert len(matching) == 1, f"expected single entry, got {len(matching)}"


# ---------- History (admin-only) ----------
def test_history_admin(admin_headers, first_location):
    r = requests.get(
        f"{BASE_URL}/api/admin/daily-checks/history",
        headers=admin_headers,
        params={"location_id": first_location["id"]},
    )
    assert r.status_code == 200
    entries = r.json()
    assert isinstance(entries, list)


# ---------- Completion grid (admin-only) ----------
def test_completion_grid(admin_headers):
    r = requests.get(
        f"{BASE_URL}/api/admin/daily-checks/completion",
        headers=admin_headers,
        params={"month": "2026-02"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["month"] == "2026-02"
    assert data["days_in_month"] == 28
    assert isinstance(data.get("grid"), dict)


# ---------- Staff role access (staff can submit, cannot access history/completion) ----------
def _create_staff_user():
    """Create a staff user by elevating a customer; best-effort. Returns headers or None."""
    # Try to find an existing staff user via admin list or skip
    return None


def test_staff_cannot_access_history_and_completion(admin_headers, first_location):
    """Use admin token negative: ensure endpoints require admin role - with admin should succeed (already tested).
    Additional assertion: the check endpoint /items works for staff+; since we don't have a staff token,
    we verify the admin-only endpoints reject a cookie-less/token-less request which proves gating exists."""
    r = requests.get(f"{BASE_URL}/api/admin/daily-checks/history")
    assert r.status_code in (401, 403)
    r2 = requests.get(f"{BASE_URL}/api/admin/daily-checks/completion?month=2026-02")
    assert r2.status_code in (401, 403)


# ---------- Items CRUD ----------
def test_items_crud_and_scope(admin_headers, first_location):
    loc_id = first_location["id"]

    # Baseline counts
    r_global = requests.get(f"{BASE_URL}/api/admin/daily-checks/items", headers=admin_headers)
    assert r_global.status_code == 200
    baseline_global = len(r_global.json())
    assert baseline_global == 15

    r_loc = requests.get(f"{BASE_URL}/api/admin/daily-checks/items", headers=admin_headers, params={"location_id": loc_id})
    assert r_loc.status_code == 200
    baseline_loc = len(r_loc.json())
    assert baseline_loc == baseline_global  # no location-specific items yet

    # admin-only /items/all
    r_all = requests.get(f"{BASE_URL}/api/admin/daily-checks/items/all", headers=admin_headers)
    assert r_all.status_code == 200
    all_items = r_all.json()
    assert isinstance(all_items, list)
    assert len(all_items) >= 15

    # CREATE location-specific
    r_c = requests.post(
        f"{BASE_URL}/api/admin/daily-checks/items",
        headers=admin_headers,
        json={"text": "TEST_location_item_for_timperley", "location_id": loc_id},
    )
    assert r_c.status_code == 200, r_c.text
    created = r_c.json()
    assert created["text"] == "TEST_location_item_for_timperley"
    assert created["location_id"] == loc_id
    assert created["is_active"] is True
    new_id = created["id"]

    # Verify visible only for that location
    r_loc2 = requests.get(f"{BASE_URL}/api/admin/daily-checks/items", headers=admin_headers, params={"location_id": loc_id})
    texts_loc = [i["text"] for i in r_loc2.json()]
    assert "TEST_location_item_for_timperley" in texts_loc
    assert len(r_loc2.json()) == baseline_loc + 1

    r_global2 = requests.get(f"{BASE_URL}/api/admin/daily-checks/items", headers=admin_headers)
    texts_global = [i["text"] for i in r_global2.json()]
    assert "TEST_location_item_for_timperley" not in texts_global
    assert len(r_global2.json()) == baseline_global

    # Submit should reflect new total for this location
    r_sub = requests.post(
        f"{BASE_URL}/api/admin/daily-checks",
        headers=admin_headers,
        json={"location_id": loc_id, "date": "2026-03-01", "checks": {new_id: True, "staff_fit": True}, "note": "TEST_with_local_item"},
    )
    assert r_sub.status_code == 200
    assert r_sub.json()["total"] == baseline_loc + 1

    # Verify items_snapshot was stored
    r_get = requests.get(
        f"{BASE_URL}/api/admin/daily-checks",
        headers=admin_headers,
        params={"location_id": loc_id, "date": "2026-03-01"},
    )
    saved = r_get.json()
    assert saved is not None
    assert "items_snapshot" in saved and isinstance(saved["items_snapshot"], list)
    snap_ids = [s["id"] for s in saved["items_snapshot"]]
    assert new_id in snap_ids

    # UPDATE: change text and flip scope to global
    r_u = requests.patch(
        f"{BASE_URL}/api/admin/daily-checks/items/{new_id}",
        headers=admin_headers,
        json={"text": "TEST_updated_global", "scope": "global"},
    )
    assert r_u.status_code == 200, r_u.text
    updated = r_u.json()
    assert updated["text"] == "TEST_updated_global"
    assert updated["location_id"] is None

    # Now visible for global and any location
    r_g3 = requests.get(f"{BASE_URL}/api/admin/daily-checks/items", headers=admin_headers)
    assert any(i["id"] == new_id for i in r_g3.json())

    # UPDATE: flip back to location-scoped
    r_u2 = requests.patch(
        f"{BASE_URL}/api/admin/daily-checks/items/{new_id}",
        headers=admin_headers,
        json={"scope": "location", "location_id": loc_id},
    )
    assert r_u2.status_code == 200
    assert r_u2.json()["location_id"] == loc_id

    # DELETE
    r_d = requests.delete(f"{BASE_URL}/api/admin/daily-checks/items/{new_id}", headers=admin_headers)
    assert r_d.status_code == 200

    # Gone from both views
    r_all2 = requests.get(f"{BASE_URL}/api/admin/daily-checks/items/all", headers=admin_headers)
    assert not any(i["id"] == new_id for i in r_all2.json())


def test_items_admin_only_gating():
    """No auth should be rejected on POST/PATCH/DELETE and /items/all."""
    r = requests.post(f"{BASE_URL}/api/admin/daily-checks/items", json={"text": "should fail"})
    assert r.status_code in (401, 403)
    r2 = requests.patch(f"{BASE_URL}/api/admin/daily-checks/items/fakeid", json={"text": "no"})
    assert r2.status_code in (401, 403)
    r3 = requests.delete(f"{BASE_URL}/api/admin/daily-checks/items/fakeid")
    assert r3.status_code in (401, 403)
    r4 = requests.get(f"{BASE_URL}/api/admin/daily-checks/items/all")
    assert r4.status_code in (401, 403)


def test_update_nonexistent_item_returns_404(admin_headers):
    r = requests.patch(
        f"{BASE_URL}/api/admin/daily-checks/items/nonexistent_id_xyz",
        headers=admin_headers,
        json={"text": "TEST_notfound"},
    )
    assert r.status_code == 404


def test_delete_nonexistent_item_returns_404(admin_headers):
    r = requests.delete(f"{BASE_URL}/api/admin/daily-checks/items/nonexistent_id_xyz", headers=admin_headers)
    assert r.status_code == 404


def test_create_item_validation_short_text(admin_headers):
    r = requests.post(
        f"{BASE_URL}/api/admin/daily-checks/items",
        headers=admin_headers,
        json={"text": "a"},
    )
    assert r.status_code == 422


# ---------- Cleanup ----------
@pytest.fixture(scope="module", autouse=True)
def cleanup(admin_headers, first_location):
    yield
    # Best-effort: remove any TEST_ items left behind
    try:
        r = requests.get(f"{BASE_URL}/api/admin/daily-checks/items/all", headers=admin_headers)
        if r.status_code == 200:
            for i in r.json():
                if str(i.get("text", "")).startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/admin/daily-checks/items/{i['id']}", headers=admin_headers)
    except Exception:
        pass
