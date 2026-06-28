"""
Regression tests for the AI rota opening-hours bug fix.

Covers:
- _clamp_shift_to_hours pure-function behaviour (unit, no LLM)
- /api/admin/shifts/ai-suggest-week 400 when location has no opening_hours
- /api/admin/shifts/ai-suggest-week clamp/drop behaviour when Sunday is closed
  (xfail-friendly when the AI key isn't actually live in preview env)
"""
import os
import sys
import requests
import pytest

# Make backend importable for the unit test on _clamp_shift_to_hours.
sys.path.insert(0, "/app/backend")

from routes.shifts import _clamp_shift_to_hours  # noqa: E402
from db import site_settings_collection, locations_collection  # noqa: E402

def _read_frontend_env():
    """Fallback: REACT_APP_BACKEND_URL is set in frontend/.env, not in the
    backend process env. Source it from there if missing."""
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                line = line.strip()
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip()
    except FileNotFoundError:
        pass
    return ""


BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _read_frontend_env()).rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL must be set"
ADMIN_EMAIL = "admin@jollys.com"
ADMIN_PASSWORD = "Admin123!"


# --------- Fixtures ----------------------------------------------------------
@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    tok = r.json().get("token") or r.json().get("access_token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def location_id():
    loc = locations_collection.find_one({}, {"_id": 0, "id": 1})
    assert loc, "no locations seeded"
    return loc["id"]


@pytest.fixture
def original_hours(location_id):
    """Snapshot + restore opening_hours so tests don't leak state."""
    doc = site_settings_collection.find_one({"location_id": location_id}, {"_id": 0}) or {}
    saved = doc.get("opening_hours")
    yield saved
    # Restore exactly what we found.
    if saved is None:
        site_settings_collection.update_one(
            {"location_id": location_id},
            {"$unset": {"opening_hours": ""}},
        )
    else:
        site_settings_collection.update_one(
            {"location_id": location_id},
            {"$set": {"opening_hours": saved}},
            upsert=True,
        )


# --------- 1. Pure unit tests on _clamp_shift_to_hours -----------------------
class TestClampShiftToHours:
    DAY = {"open": "09:00", "close": "17:00"}

    def test_shift_inside_hours_unchanged(self):
        out = _clamp_shift_to_hours("10:00", "16:00", self.DAY)
        assert out == ("10:00", "16:00")

    def test_shift_starting_too_early_clamped_to_30min_before_open(self):
        # 06:00 with 09:00 open → 08:30 (30 min prep buffer)
        out = _clamp_shift_to_hours("06:00", "12:00", self.DAY)
        assert out == ("08:30", "12:00")

    def test_shift_ending_too_late_clamped_to_30min_after_close(self):
        out = _clamp_shift_to_hours("12:00", "22:00", self.DAY)
        assert out == ("12:00", "17:30")

    def test_closed_day_returns_none(self):
        assert _clamp_shift_to_hours("10:00", "14:00", {}) is None
        assert _clamp_shift_to_hours("10:00", "14:00", None) is None

    def test_close_le_open_rejected(self):
        assert _clamp_shift_to_hours("10:00", "14:00", {"open": "17:00", "close": "09:00"}) is None
        assert _clamp_shift_to_hours("10:00", "14:00", {"open": "10:00", "close": "10:00"}) is None

    def test_invalid_hhmm_returns_none(self):
        assert _clamp_shift_to_hours("not-a-time", "10:00", self.DAY) is None
        assert _clamp_shift_to_hours("09:00", "??:??", self.DAY) is None

    def test_clamped_window_below_30min_dropped(self):
        # Proposed 06:00–08:35 against 09:00–17:00 → clamps to 08:30–08:35 → 5 min → drop
        out = _clamp_shift_to_hours("06:00", "08:35", self.DAY)
        assert out is None

    def test_end_before_start_rejected(self):
        assert _clamp_shift_to_hours("17:00", "09:00", self.DAY) is None

    def test_both_sides_clamped(self):
        out = _clamp_shift_to_hours("06:00", "22:00", self.DAY)
        assert out == ("08:30", "17:30")


# --------- 2. API: empty opening_hours → HTTP 400 ----------------------------
class TestApiNoOpeningHours:
    def test_empty_hours_returns_400_not_500(self, session, location_id, original_hours):
        # Force opening_hours to {} for this location
        site_settings_collection.update_one(
            {"location_id": location_id},
            {"$set": {"opening_hours": {}}},
            upsert=True,
        )
        r = session.post(
            f"{BASE_URL}/api/admin/shifts/ai-suggest-week",
            json={"location_id": location_id, "target_start": "2026-01-05"},
            timeout=30,
        )
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:300]}"
        detail = r.json().get("detail", "")
        assert "opening hours" in detail.lower(), detail


# --------- 3. API: Sunday closed → no Sunday shifts in response --------------
class TestApiSundayClosed:
    def test_sunday_closed_results_in_no_sunday_shifts(self, session, location_id, original_hours):
        # Remove sunday key so that day is closed; keep the other six.
        new_hours = {k: v for k, v in (original_hours or {}).items() if k != "sunday"}
        if "sunday" not in (original_hours or {}):
            pytest.skip("location had no sunday in seeded hours — nothing to disable")
        site_settings_collection.update_one(
            {"location_id": location_id},
            {"$set": {"opening_hours": new_hours}},
            upsert=True,
        )

        target_monday = "2026-01-05"   # Monday
        sunday_date = "2026-01-11"     # Sunday of that week
        r = session.post(
            f"{BASE_URL}/api/admin/shifts/ai-suggest-week",
            json={"location_id": location_id, "target_start": target_monday},
            timeout=120,
        )
        # If the AI key isn't live, the call surfaces 500 — that's fine, the
        # opening_hours injection still happened pre-LLM. Just xfail in that case.
        if r.status_code in (500, 502):
            pytest.xfail(f"AI provider unavailable in preview env: {r.status_code} {r.text[:200]}")

        assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:300]}"
        body = r.json()
        assert "shifts" in body and isinstance(body["shifts"], list)
        sunday_shifts = [s for s in body["shifts"] if s.get("date") == sunday_date]
        assert sunday_shifts == [], f"sunday should be closed but got: {sunday_shifts}"
        # If we dropped any LLM-proposed shifts, reasoning should call it out.
        # Best-effort check — Claude may simply not have proposed Sunday at all.
        reasoning = body.get("reasoning", "") or ""
        if "Adjustments:" in reasoning:
            assert "dropped" in reasoning.lower() or "trimmed" in reasoning.lower(), reasoning

    def test_weekday_shifts_respect_buffer(self, session, location_id, original_hours):
        # weekday open 08:00 close 17:00 (Fri 18:00) → all start_time >= 07:30
        # and end_time <= close+30 for that weekday.
        r = session.post(
            f"{BASE_URL}/api/admin/shifts/ai-suggest-week",
            json={"location_id": location_id, "target_start": "2026-01-05"},
            timeout=120,
        )
        if r.status_code in (500, 502):
            pytest.xfail(f"AI provider unavailable: {r.status_code}")
        assert r.status_code == 200, r.text[:300]
        body = r.json()

        def _hhmm(s):
            h, m = s.split(":")
            return int(h) * 60 + int(m)

        # Map date → weekday key
        import datetime as _dt
        for s in body.get("shifts", []):
            d = _dt.date.fromisoformat(s["date"])
            wk = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"][d.weekday()]
            win = (original_hours or {}).get(wk)
            assert win, f"shift returned for closed day {s['date']}: {s}"
            earliest = _hhmm(win["open"]) - 30
            latest = _hhmm(win["close"]) + 30
            assert _hhmm(s["start_time"]) >= earliest, f"{s} starts before buffer {earliest}"
            assert _hhmm(s["end_time"]) <= latest, f"{s} ends after buffer {latest}"
