"""Backend regression: admin role can hit BI endpoints; ai-settings still super_admin."""
import os
import pytest
import requests
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://jovial-hamilton-4.preview.emergentagent.com').rstrip('/')

SUPER_EMAIL = "admin@jollys.com"
SUPER_PASS = "Admin123!"


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login {email} -> {r.status_code} {r.text[:200]}"
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="session")
def super_token():
    return _login(SUPER_EMAIL, SUPER_PASS)


@pytest.fixture(scope="session")
def admin_user(super_token):
    """Admin user is seeded directly in MongoDB (no public create endpoint)."""
    return {"email": "test_admin_bi@jollys.com", "password": "AdminBI123!"}


@pytest.fixture(scope="session")
def admin_token(admin_user):
    return _login(admin_user["email"], admin_user["password"])


# --- BI endpoints: admin should now get 200 (was 403) ---

def test_admin_can_get_bi_overview(admin_token):
    r = requests.get(f"{BASE_URL}/api/admin/bi",
                     params={"start_date": "2025-01-01", "end_date": "2026-01-31"},
                     headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
    data = r.json()
    assert "kpi" in data or "by_location" in data


def test_admin_can_get_bi_menu_cost(admin_token):
    r = requests.get(f"{BASE_URL}/api/admin/bi/menu-cost",
                     headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
    data = r.json()
    assert "items" in data


def test_admin_can_get_bi_ai_insights(admin_token):
    # may return 503 if no AI key, but should NOT be 403
    r = requests.get(f"{BASE_URL}/api/admin/bi/ai-insights",
                     params={"start_date": "2025-01-01", "end_date": "2026-01-31"},
                     headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code != 403, f"Admin got 403 on ai-insights: {r.text[:300]}"


# --- ai-settings: admin should still get 403 (super_admin only) ---

def test_admin_blocked_from_ai_settings(admin_token):
    r = requests.get(f"{BASE_URL}/api/admin/ai-settings",
                     headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text[:300]}"


# --- Super admin regression ---

def test_super_admin_bi_still_works(super_token):
    r = requests.get(f"{BASE_URL}/api/admin/bi",
                     params={"start_date": "2025-01-01", "end_date": "2026-01-31"},
                     headers={"Authorization": f"Bearer {super_token}"})
    assert r.status_code == 200


def test_super_admin_ai_settings_works(super_token):
    r = requests.get(f"{BASE_URL}/api/admin/ai-settings",
                     headers={"Authorization": f"Bearer {super_token}"})
    assert r.status_code == 200
