"""Tests for User Management (super_admin) and Daily Sales endpoints."""
import os
import pytest
import requests
from datetime import datetime, timezone

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://jovial-hamilton-4.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@jollys.com"
ADMIN_PASSWORD = "Admin123!"


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text}")
    data = r.json()
    return data.get("access_token")


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def first_location(admin_headers):
    r = requests.get(f"{BASE_URL}/api/admin/locations", headers=admin_headers)
    if r.status_code != 200 or not r.json():
        pytest.skip("No locations available")
    return r.json()[0]


# ============== AUTH SANITY ==============

class TestAuthSanity:
    def test_login_success_returns_super_admin(self, admin_token):
        assert admin_token and isinstance(admin_token, str)

    def test_me_returns_super_admin_role(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert data.get("role") == "super_admin", f"Expected super_admin, got {data.get('role')}"


# ============== USER MANAGEMENT ==============

class TestUserManagement:
    def test_list_customers_super_admin(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/users", headers=admin_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        # Each item should have required fields if present
        for c in data:
            assert "id" in c or "email" in c

    def test_list_customers_unauthenticated(self):
        r = requests.get(f"{BASE_URL}/api/admin/users")
        assert r.status_code == 401

    def test_update_role_invalid_role(self, admin_headers):
        # Get a customer first
        r = requests.get(f"{BASE_URL}/api/admin/users", headers=admin_headers)
        customers = r.json()
        if not customers:
            pytest.skip("No customers to test role update")
        cust_id = customers[0]["id"]
        r = requests.put(
            f"{BASE_URL}/api/admin/users/{cust_id}/role",
            headers=admin_headers,
            json={"role": "ceo"},
        )
        assert r.status_code == 400

    def test_update_role_unknown_customer(self, admin_headers):
        r = requests.put(
            f"{BASE_URL}/api/admin/users/nonexistent-id-123/role",
            headers=admin_headers,
            json={"role": "staff"},
        )
        assert r.status_code == 404

    def test_update_role_round_trip(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/users", headers=admin_headers)
        customers = r.json()
        if not customers:
            pytest.skip("No customers to test role update")
        cust = customers[0]
        cust_id = cust["id"]
        original_role = cust.get("role", "customer")

        # Set staff
        r = requests.put(
            f"{BASE_URL}/api/admin/users/{cust_id}/role",
            headers=admin_headers,
            json={"role": "staff"},
        )
        assert r.status_code == 200
        assert r.json()["role"] == "staff"

        # Verify via GET list
        r2 = requests.get(f"{BASE_URL}/api/admin/users", headers=admin_headers)
        found = next((c for c in r2.json() if c["id"] == cust_id), None)
        assert found and found["role"] == "staff"

        # Restore original
        requests.put(
            f"{BASE_URL}/api/admin/users/{cust_id}/role",
            headers=admin_headers,
            json={"role": original_role},
        )


# ============== DAILY SALES ==============

class TestDailySales:
    test_entry_id = None
    test_date = "2026-01-15"  # TEST_ date

    def test_create_daily_sales(self, admin_headers, first_location):
        payload = {
            "location_id": first_location["id"],
            "date": self.test_date,
            "sales": 500.50,
            "float_amount": 100.0,
            "cash_taken": 200.0,
            "cash_taken_by": "TEST_Admin",
            "staff_hours": [
                {"name": "TEST_Alice", "start_time": "09:00", "end_time": "17:00"},
                {"name": "TEST_Bob", "start_time": "10:00", "end_time": "18:00"},
            ],
        }
        r = requests.post(f"{BASE_URL}/api/admin/daily-sales", headers=admin_headers, json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "id" in data
        TestDailySales.test_entry_id = data["id"]

    def test_update_existing_entry_same_location_date(self, admin_headers, first_location):
        # Same location + date should update, not create
        payload = {
            "location_id": first_location["id"],
            "date": self.test_date,
            "sales": 750.0,
            "float_amount": 100.0,
            "cash_taken": 250.0,
            "cash_taken_by": "TEST_Admin_Updated",
            "staff_hours": [],
        }
        r = requests.post(f"{BASE_URL}/api/admin/daily-sales", headers=admin_headers, json=payload)
        assert r.status_code == 200
        # Verify update via GET list
        r2 = requests.get(
            f"{BASE_URL}/api/admin/daily-sales",
            headers=admin_headers,
            params={"location_id": first_location["id"], "start_date": self.test_date, "end_date": self.test_date},
        )
        assert r2.status_code == 200
        entries = r2.json()
        match = next((e for e in entries if e["date"] == self.test_date), None)
        assert match is not None
        assert match["sales"] == 750.0
        assert match["cash_taken_by"] == "TEST_Admin_Updated"

    def test_list_with_filters(self, admin_headers, first_location):
        r = requests.get(
            f"{BASE_URL}/api/admin/daily-sales",
            headers=admin_headers,
            params={"location_id": first_location["id"]},
        )
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        for e in data:
            assert e["location_id"] == first_location["id"]

    def test_list_unauthenticated(self):
        r = requests.get(f"{BASE_URL}/api/admin/daily-sales")
        assert r.status_code == 401

    def test_today_endpoint(self, admin_headers, first_location):
        r = requests.get(
            f"{BASE_URL}/api/admin/daily-sales/today/{first_location['id']}",
            headers=admin_headers,
        )
        assert r.status_code == 200
        # Returns null/None or entry dict — both valid
        data = r.json()
        assert data is None or isinstance(data, dict)

    def test_staff_names_endpoint(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/daily-sales/staff-names", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)

    def test_delete_entry(self, admin_headers):
        if not TestDailySales.test_entry_id:
            pytest.skip("No entry to delete")
        r = requests.delete(
            f"{BASE_URL}/api/admin/daily-sales/{TestDailySales.test_entry_id}",
            headers=admin_headers,
        )
        assert r.status_code == 200

    def test_delete_nonexistent(self, admin_headers):
        r = requests.delete(
            f"{BASE_URL}/api/admin/daily-sales/nonexistent-id-xyz",
            headers=admin_headers,
        )
        assert r.status_code == 404
