"""Regression for:
   1) BI key gating - admin role still 403 on POST /api/admin/ai-settings
   2) Labour % chart - /api/admin/daily-sales/summary now includes
      labour_hours and labour_cost per location, computed from
      staff_members.hourly_rate.
"""
import os
import pytest
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv('/app/backend/.env')
load_dotenv('/app/frontend/.env')

BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/')
SUPER_EMAIL = "admin@jollys.com"
SUPER_PASS = "Admin123!"
ADMIN_EMAIL = "test_admin_bi@jollys.com"
ADMIN_PASS = "AdminBI123!"

mongo = MongoClient(os.environ['MONGO_URL'])
db = mongo[os.environ['DB_NAME']]


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login {email}->{r.status_code} {r.text[:200]}"
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="module")
def super_token():
    return _login(SUPER_EMAIL, SUPER_PASS)


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASS)


# --- 1) BI key gating: admin still 403 on POST /api/admin/ai-settings ---

def test_admin_put_ai_settings_forbidden(admin_token):
    r = requests.put(f"{BASE_URL}/api/admin/ai-settings",
                     headers={"Authorization": f"Bearer {admin_token}"},
                     json={"provider": "anthropic", "api_key": "sk-test"},
                     timeout=15)
    assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text[:200]}"


def test_super_admin_get_ai_settings_ok(super_token):
    r = requests.get(f"{BASE_URL}/api/admin/ai-settings",
                     headers={"Authorization": f"Bearer {super_token}"}, timeout=15)
    assert r.status_code == 200, f"super_admin GET ai-settings -> {r.status_code}"
    data = r.json()
    # response shape check - either has provider or empty
    assert isinstance(data, dict)


# --- 2) Labour summary endpoint shape and computation ---

def test_summary_includes_labour_keys(super_token):
    """by_location entries must always include labour_hours and labour_cost
    (even if 0). Hours regress to prior behaviour; cost is new."""
    r = requests.get(f"{BASE_URL}/api/admin/daily-sales/summary?period=month",
                     headers={"Authorization": f"Bearer {super_token}"}, timeout=20)
    assert r.status_code == 200, f"{r.status_code} {r.text[:200]}"
    data = r.json()
    assert "by_location" in data
    # By_location may be a dict; verify each loc has the fields
    locs = data["by_location"]
    assert isinstance(locs, dict)
    for loc_id, loc in locs.items():
        assert "sales" in loc
        assert "labour_hours" in loc, f"{loc_id} missing labour_hours"
        assert "labour_cost" in loc, f"{loc_id} missing labour_cost"
        assert isinstance(loc["labour_hours"], (int, float))
        assert isinstance(loc["labour_cost"], (int, float))


# --- 3) Seed staff with hourly_rate matching a daily_sales staff name,
#        then verify labour_cost > 0 in summary ---

@pytest.fixture
def seeded_rate():
    """Inject hourly_rate on a staff_member whose name appears in daily_sales.
    Cleans up after the test."""
    # pick a name actually present in staff_hours entries
    names = set()
    for e in db.daily_sales.find({}, {"_id": 0, "staff_hours": 1}):
        for sh in (e.get("staff_hours") or []):
            n = (sh.get("name") or "").strip()
            if n:
                names.add(n)
    if not names:
        pytest.skip("no staff_hours in daily_sales to drive labour cost")
    target = sorted(names)[0]
    # check existing
    existing = db.staff_members.find_one({"name": target})
    if existing:
        db.staff_members.update_one(
            {"_id": existing["_id"]},
            {"$set": {"hourly_rate": 12.5}},
        )
        cleanup = ("update", existing["_id"], existing.get("hourly_rate"))
    else:
        inserted = db.staff_members.insert_one({
            "id": "TEST_labour_rate_seed",
            "name": target,
            "hourly_rate": 12.5,
            "created_by": "test",
        })
        cleanup = ("delete", inserted.inserted_id, None)
    yield target
    if cleanup[0] == "update":
        if cleanup[2] is None:
            db.staff_members.update_one({"_id": cleanup[1]},
                                        {"$unset": {"hourly_rate": ""}})
        else:
            db.staff_members.update_one({"_id": cleanup[1]},
                                        {"$set": {"hourly_rate": cleanup[2]}})
    else:
        db.staff_members.delete_one({"_id": cleanup[1]})


def test_labour_cost_populated_when_rate_set(super_token, seeded_rate):
    r = requests.get(f"{BASE_URL}/api/admin/daily-sales/summary?period=year",
                     headers={"Authorization": f"Bearer {super_token}"}, timeout=20)
    assert r.status_code == 200
    data = r.json()
    total_cost = sum((loc.get("labour_cost") or 0) for loc in data["by_location"].values())
    total_hours = sum((loc.get("labour_hours") or 0) for loc in data["by_location"].values())
    assert total_hours > 0, "expected labour_hours > 0 with seeded data"
    assert total_cost > 0, f"expected labour_cost > 0 with hourly_rate=12.5 on '{seeded_rate}'"
    # cost = hours * 12.5 for the seeded staff; sanity: cost <= hours * 12.5
    assert total_cost <= total_hours * 12.5 + 0.5, \
        f"cost {total_cost} should not exceed total_hours*12.5 = {total_hours * 12.5}"


# --- 4) Regression: admin can still GET BI overview (was the previous fix) ---

def test_admin_can_get_bi(admin_token):
    r = requests.get(f"{BASE_URL}/api/admin/bi",
                     params={"start_date": "2025-01-01", "end_date": "2026-12-31"},
                     headers={"Authorization": f"Bearer {admin_token}"}, timeout=20)
    assert r.status_code == 200, f"{r.status_code} {r.text[:200]}"
