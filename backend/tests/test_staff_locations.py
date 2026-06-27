"""Backend tests for staff `location_ids` field — create/get/update/delete cycle."""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://jovial-hamilton-4.preview.emergentagent.com").rstrip("/")
CREDS = {"email": "admin@jollys.com", "password": "Admin123!"}


@pytest.fixture(scope="module")
def auth_client():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=CREDS, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    token = r.json()["access_token"]
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def location_ids(auth_client):
    r = auth_client.get(f"{BASE_URL}/api/admin/locations", timeout=15)
    assert r.status_code == 200
    locs = r.json()
    assert len(locs) >= 2, "need at least 2 locations to test multi-select"
    return [locs[0]["id"], locs[1]["id"]]


class TestStaffLocationIds:
    """Verify location_ids persists, can be updated, and the row can be cleaned up."""

    def test_create_staff_with_two_locations(self, auth_client, location_ids):
        payload = {"name": "TEST_LocStaff", "location_ids": location_ids}
        r = auth_client.post(f"{BASE_URL}/api/admin/staff", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        created = r.json()
        assert created["name"] == "TEST_LocStaff"
        assert sorted(created["location_ids"]) == sorted(location_ids)
        # persistence check via GET list
        listed = auth_client.get(f"{BASE_URL}/api/admin/staff", timeout=15).json()
        match = next((s for s in listed if s["id"] == created["id"]), None)
        assert match is not None
        assert sorted(match["location_ids"]) == sorted(location_ids)
        pytest.staff_id = created["id"]  # share id with later tests

    def test_patch_remove_one_location(self, auth_client, location_ids):
        new_ids = [location_ids[0]]
        r = auth_client.patch(
            f"{BASE_URL}/api/admin/staff/{pytest.staff_id}",
            json={"location_ids": new_ids},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        updated = r.json()
        assert updated["location_ids"] == new_ids
        # confirm via list endpoint
        listed = auth_client.get(f"{BASE_URL}/api/admin/staff", timeout=15).json()
        match = next((s for s in listed if s["id"] == pytest.staff_id), None)
        assert match["location_ids"] == new_ids

    def test_patch_clear_all_locations(self, auth_client):
        r = auth_client.patch(
            f"{BASE_URL}/api/admin/staff/{pytest.staff_id}",
            json={"location_ids": []},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        assert r.json()["location_ids"] == []

    def test_delete_staff_cleanup(self, auth_client):
        r = auth_client.delete(f"{BASE_URL}/api/admin/staff/{pytest.staff_id}", timeout=15)
        assert r.status_code == 200
