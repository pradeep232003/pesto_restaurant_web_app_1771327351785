"""
Food Safety Compliance aggregation endpoint.
Aggregates the same routines surfaced on the JKHive Daily Check hub
(/jkhive/daily-check) so the compliance % directly mirrors what staff
are completing each day.
"""
from fastapi import APIRouter, Depends, Query
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict
from db import (
    db,
    locations_collection,
    daily_checks_collection,
    kitchen_closedown_collection,
)
from auth import get_admin_user

router = APIRouter(prefix="/api/admin/compliance", tags=["compliance"])

# Mapping of check key -> config.
# Each entry mirrors a row on the JKHive Daily Check hub (10 daily checks).
# `date_kind` is either "date" (YYYY-MM-DD string) or "timestamp" (ISO datetime
# with a "T"), which affects how the date-range query is built.
# `filter` (optional) is merged into the Mongo query — e.g. to scope to
# period=opening vs period=closing on the shared routine_temps collection.
CHECK_CONFIG = {
    "opening_checklist": {"coll": daily_checks_collection,    "date": "date",         "date_kind": "date",      "cadence": "daily", "label": "Opening checklist"},
    "opening_temps":     {"coll": db["routine_temps"],        "date": "date",         "date_kind": "date",      "cadence": "daily", "label": "Fridge/Freezer Opening Temps", "filter": {"period": "opening"}},
    "washer_temps":      {"coll": db["washer_checks"],        "date": "recorded_at",  "date_kind": "timestamp", "cadence": "daily", "label": "Washer Temps"},
    "hot_cold_holding":  {"coll": db["hot_cold_sessions"],    "date": "start_time",   "date_kind": "timestamp", "cadence": "daily", "label": "Hot/Cold Holding"},
    "reheating":         {"coll": db["reheating_logs"],       "date": "recorded_at",  "date_kind": "timestamp", "cadence": "daily", "label": "Cooking/Reheating"},
    "bulk_cooling":      {"coll": db["cooking_cooling_logs"], "date": "started_at",   "date_kind": "timestamp", "cadence": "daily", "label": "Bulk Cooking/Cooling"},
    "delivery_records":  {"coll": db["delivery_records"],     "date": "recorded_at",  "date_kind": "timestamp", "cadence": "daily", "label": "Deliveries"},
    "daily_cleaning":    {"coll": db["checklist_runs"],       "date": "submitted_at", "date_kind": "timestamp", "cadence": "daily", "label": "Daily Cleaning", "filter": {"frequency": "daily"}},
    "closing_temps":     {"coll": db["routine_temps"],        "date": "date",         "date_kind": "date",      "cadence": "daily", "label": "Fridge/Freezer Closing Temps", "filter": {"period": "closing"}},
    "closing_checklist": {"coll": kitchen_closedown_collection,"date": "date",        "date_kind": "date",      "cadence": "daily", "label": "Closing checklist"},
    # ----- Weekly cadence (rows under "Weekly Check" on /jkhive/weekly-check) -----
    "probe_calibration": {"coll": db["probe_calibrations"],   "date": "recorded_at",  "date_kind": "timestamp", "cadence": "weekly", "label": "Probe Calibration"},
    "legionella":        {"coll": db["legionella_tests"],     "date": "date",         "date_kind": "date",      "cadence": "weekly", "label": "Legionella"},
    "weekly_checklist":  {"coll": db["checklist_runs"],       "date": "submitted_at", "date_kind": "timestamp", "cadence": "weekly", "label": "Weekly Checklist", "filter": {"frequency": "weekly"}},
}


def _daterange_days(start: date, end: date) -> int:
    return max(0, (end - start).days + 1)


def _daterange_weeks(start: date, end: date) -> int:
    """Count distinct ISO weeks the range touches."""
    weeks = set()
    d = start
    while d <= end:
        y, w, _ = d.isocalendar()
        weeks.add((y, w))
        d += timedelta(days=1)
    return len(weeks)


def _assess_check(location_id: str, cfg: dict, start: str, end: str) -> dict:
    """Return per-check status summary for one site & check type."""
    coll = cfg["coll"]
    date_field = cfg["date"]
    date_kind = cfg.get("date_kind", "date")
    cadence = cfg["cadence"]

    # Build the Mongo query. Timestamp fields need an end-of-day cap because
    # ISO strings like "2026-05-04T11:23:45" alphabetically exceed "2026-05-04",
    # so `$lte: "2026-05-04"` would silently miss every record for that day.
    range_end = end + "T23:59:59" if date_kind == "timestamp" else end
    q = {"location_id": location_id, date_field: {"$gte": start, "$lte": range_end}}
    if cfg.get("filter"):
        q.update(cfg["filter"])

    entries = list(coll.find(q, {"_id": 0}).sort(date_field, -1))

    start_d = date.fromisoformat(start)
    end_d = date.fromisoformat(end)
    expected = _daterange_days(start_d, end_d) if cadence == "daily" else _daterange_weeks(start_d, end_d)

    if not entries:
        return {
            "status": "missing", "count": 0, "expected": expected,
            "actual_periods": 0, "pct": 0, "last_date": None,
            "last_by": None, "last_passed": None,
        }

    # Count distinct coverage periods (unique YYYY-MM-DD for daily; unique
    # iso-weeks for weekly). For timestamp fields we slice the ISO string.
    def _day_of(e):
        v = e.get(date_field) or ""
        return v[:10] if date_kind == "timestamp" else v

    if cadence == "daily":
        periods = set(_day_of(e) for e in entries if _day_of(e))
    else:
        periods = set()
        for e in entries:
            v = _day_of(e)
            if not v:
                continue
            try:
                y, w, _ = date.fromisoformat(v).isocalendar()
                periods.add((y, w))
            except Exception:
                pass

    actual_periods = len(periods)
    pct = round(100 * actual_periods / expected) if expected else 0
    last = entries[0]
    last_passed = None
    if "passed" in last:
        last_passed = bool(last["passed"])
    elif "passed_items" in last and "total_items" in last:
        last_passed = last.get("passed_items") == last.get("total_items")
    elif "passed_cells" in last and "total_cells" in last:
        last_passed = last.get("passed_cells") and last.get("passed_cells") == last.get("total_cells")

    # Overdue: nothing recorded in the last `threshold` days
    threshold = 2 if cadence == "daily" else 8
    today_d = date.today()
    last_date_raw = last.get(date_field) or ""
    last_date_str = last_date_raw[:10] if date_kind == "timestamp" else last_date_raw
    try:
        last_d = date.fromisoformat(last_date_str) if last_date_str else None
    except Exception:
        last_d = None
    overdue = bool(last_d and (today_d - last_d).days > threshold)

    # Determine status
    if actual_periods >= expected:
        status = "complete"
    elif overdue:
        status = "overdue"
    else:
        status = "partial"

    return {
        "status": status, "count": len(entries), "expected": expected,
        "actual_periods": actual_periods, "pct": pct,
        "last_date": last_date_str, "last_by": last.get("completed_by_name") or last.get("submitted_by_name") or last.get("recorded_by_name") or last.get("created_by_name") or last.get("completed_by") or last.get("created_by"),
        "last_passed": last_passed,
    }


@router.get("")
async def get_compliance(
    start_date: str = Query(...),
    end_date: str = Query(...),
    location_id: Optional[str] = Query(None),
    user: dict = Depends(get_admin_user),
):
    """Aggregated compliance matrix across all sites (or a single site) for a date range."""
    loc_query = {"is_active": True}
    if location_id:
        loc_query["id"] = location_id
    locs = list(locations_collection.find(loc_query, {"_id": 0}).sort("name", 1))

    site_rows = []
    status_weight = {"complete": 1, "partial": 0.5, "overdue": 0.0, "missing": 0.0, "not_required": None}

    for loc in locs:
        checks = {}
        per_site_scores = []
        applicable = loc.get("applicable_routines") or []  # empty = all routines apply
        for key, cfg in CHECK_CONFIG.items():
            if applicable and key not in applicable:
                continue  # this routine is not used at this site
            result = _assess_check(loc["id"], cfg, start_date, end_date)
            result["label"] = cfg["label"]
            result["cadence"] = cfg["cadence"]
            checks[key] = result
            w = status_weight.get(result["status"])
            if w is not None:
                per_site_scores.append(w)
        site_pct = round(100 * sum(per_site_scores) / len(per_site_scores)) if per_site_scores else 0
        site_rows.append({
            "location_id": loc["id"], "location_name": loc["name"],
            "applicable_routines": applicable,
            "compliance_pct": site_pct, "checks": checks,
        })

    overall_pct = round(sum(r["compliance_pct"] for r in site_rows) / len(site_rows)) if site_rows else 0
    return {
        "start_date": start_date, "end_date": end_date,
        "overall_pct": overall_pct, "sites": site_rows,
        "check_types": [{"key": k, "label": v["label"], "cadence": v["cadence"]} for k, v in CHECK_CONFIG.items()],
    }


@router.get("/detail")
async def get_compliance_detail(
    location_id: str = Query(...),
    check_key: str = Query(...),
    start_date: str = Query(...),
    end_date: str = Query(...),
    user: dict = Depends(get_admin_user),
):
    """Full entry list for one site+check within a range (for drill-down)."""
    cfg = CHECK_CONFIG.get(check_key)
    if not cfg:
        return {"entries": []}
    coll = cfg["coll"]
    date_field = cfg["date"]
    date_kind = cfg.get("date_kind", "date")
    range_end = end_date + "T23:59:59" if date_kind == "timestamp" else end_date
    q = {"location_id": location_id, date_field: {"$gte": start_date, "$lte": range_end}}
    if cfg.get("filter"):
        q.update(cfg["filter"])
    entries = list(coll.find(q, {"_id": 0}).sort(date_field, -1))
    return {"check_key": check_key, "label": cfg["label"], "entries": entries}
