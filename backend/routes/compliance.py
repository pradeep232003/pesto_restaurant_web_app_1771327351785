"""
Food Safety Compliance aggregation endpoint.
Aggregates 9 check types across all sites for EHO compliance reporting.
"""
from fastapi import APIRouter, Depends, Query
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict
from db import (
    db,
    locations_collection,
    daily_checks_collection,
    kitchen_closedown_collection,
    temp_logs_collection,
    daily_cleaning_logs_collection,
    weekly_cleaning_logs_collection,
)
from auth import get_admin_user

router = APIRouter(prefix="/api/admin/compliance", tags=["compliance"])

# Mapping of check key -> (collection, date_field, cadence, label)
CHECK_CONFIG = {
    "temp_logs":        {"coll": temp_logs_collection,           "date": "date",         "cadence": "daily",  "label": "Fridge/Freezer Temperature"},
    "daily_checks":     {"coll": daily_checks_collection,        "date": "date",         "cadence": "daily",  "label": "Daily Checks"},
    "cooked_temp":      {"coll": db["cooked_temp_logs"],         "date": "date",         "cadence": "daily",  "label": "Cooked/Reheated Temperature"},
    "kitchen_closedown":{"coll": kitchen_closedown_collection,   "date": "date",         "cadence": "daily",  "label": "Kitchen Closedown"},
    "delivery_records": {"coll": db["delivery_records"],         "date": "date",         "cadence": "weekly", "label": "Delivery Records"},
    "probe_calibration":{"coll": db["probe_calibrations"],       "date": "date",         "cadence": "weekly", "label": "Probe Calibration"},
    "legionella":       {"coll": db["legionella_tests"],         "date": "date",         "cadence": "weekly", "label": "Legionella Water"},
    "daily_cleaning":   {"coll": daily_cleaning_logs_collection, "date": "week_ending",  "cadence": "weekly", "label": "Daily Cleaning"},
    "weekly_cleaning":  {"coll": weekly_cleaning_logs_collection,"date": "week_ending",  "cadence": "weekly", "label": "Weekly Deep Cleaning"},
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
    cadence = cfg["cadence"]

    entries = list(coll.find(
        {"location_id": location_id, date_field: {"$gte": start, "$lte": end}},
        {"_id": 0},
    ).sort(date_field, -1))

    start_d = date.fromisoformat(start)
    end_d = date.fromisoformat(end)
    expected = _daterange_days(start_d, end_d) if cadence == "daily" else _daterange_weeks(start_d, end_d)

    if not entries:
        return {
            "status": "missing", "count": 0, "expected": expected,
            "actual_periods": 0, "pct": 0, "last_date": None,
            "last_by": None, "last_passed": None,
        }

    # Count distinct coverage periods (unique dates for daily; unique iso-weeks for weekly)
    if cadence == "daily":
        periods = set(e[date_field] for e in entries if e.get(date_field))
    else:
        periods = set()
        for e in entries:
            v = e.get(date_field)
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
    last_date_str = last.get(date_field)
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
        "last_date": last_date_str, "last_by": last.get("completed_by_name") or last.get("created_by_name") or last.get("completed_by") or last.get("created_by"),
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
        for key, cfg in CHECK_CONFIG.items():
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
    entries = list(coll.find(
        {"location_id": location_id, date_field: {"$gte": start_date, "$lte": end_date}},
        {"_id": 0},
    ).sort(date_field, -1))
    return {"check_key": check_key, "label": cfg["label"], "entries": entries}
