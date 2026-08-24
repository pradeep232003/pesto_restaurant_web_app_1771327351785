"""
Payroll — computes what each staff member is owed for a given
window based on the actual hours logged on the Daily Sales page.

Data model:
  • Daily Sales entries hold `staff_hours: [{name, start_time, end_time}]`
    — the ground-truth clock-in/out figures written by the manager
    at the end of every trading day.
  • `staff_members.hourly_rate` provides the pay rate.
  • Match is by NAME (case-insensitive) because Daily Sales stores
    only a text name, not a staff_id.

Filters: location_id (single site or omit for every accessible site),
start_date / end_date (inclusive YYYY-MM-DD), staff_id (single person).

Endpoints:
  GET /api/admin/payroll               — JSON summary
  GET /api/admin/payroll/export.csv    — bookkeeper-friendly CSV
  GET /api/admin/payroll/staff         — staff dropdown, optionally
                                          filtered by location

All admin & super_admin only.
"""
from datetime import datetime, timezone
from typing import Optional
import csv
import io
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from db import db
from auth import get_admin_user

router = APIRouter(prefix="/api/admin/payroll", tags=["payroll"])

_log = logging.getLogger("payroll")
daily_sales_col = db["daily_sales"]
staff_col = db["staff_members"]
locations_col = db["locations"]


def _hours_between(start: str, end: str) -> float:
    """Compute hours between two HH:MM strings; 0 on any parse failure."""
    if not (start and end):
        return 0.0
    try:
        st = datetime.strptime(start, "%H:%M")
        et = datetime.strptime(end, "%H:%M")
        diff = (et - st).total_seconds() / 3600.0
        return round(diff, 2) if diff > 0 else 0.0
    except ValueError:
        return 0.0


def _load_staff():
    """Return list of staff dicts + a lowercase-name → record map."""
    rows = list(staff_col.find(
        {},
        {"_id": 0, "id": 1, "name": 1, "hourly_rate": 1,
         "employee_no": 1, "location_ids": 1, "active": 1},
    ).sort("name", 1))
    by_name = {(r.get("name") or "").strip().lower(): r for r in rows}
    return rows, by_name


def _staff_for_location(all_staff, location_id: Optional[str]):
    """Filter staff by permitted location — empty `location_ids` means
    "all sites" (legacy records)."""
    if not location_id:
        return all_staff
    return [
        s for s in all_staff
        if not s.get("location_ids") or location_id in s.get("location_ids", [])
    ]


def _summarise(entries, staff_by_name, staff_id_filter: Optional[str]):
    """Group Daily Sales staff_hours entries by staff member."""
    # If a staff_id filter is set, resolve their name once so we can
    # gate the loop by name (Daily Sales rows don't carry staff_id).
    target_name = None
    if staff_id_filter:
        for s in staff_by_name.values():
            if s.get("id") == staff_id_filter:
                target_name = (s.get("name") or "").strip().lower()
                break

    grouped: dict = {}
    for e in entries:
        loc = e.get("location_id", "")
        for sh in (e.get("staff_hours") or []):
            name = (sh.get("name") or "").strip()
            if not name:
                continue
            key = name.lower()
            if target_name and key != target_name:
                continue
            rec = staff_by_name.get(key) or {}
            row = grouped.setdefault(key, {
                "staff_id": rec.get("id") or "",
                "staff_name": rec.get("name") or name,
                "employee_no": rec.get("employee_no") or "",
                "hourly_rate": float(rec.get("hourly_rate") or 0),
                "hours": 0.0,
                "shift_count": 0,
                "locations": set(),
            })
            row["hours"] += _hours_between(sh.get("start_time"), sh.get("end_time"))
            row["shift_count"] += 1
            if loc:
                row["locations"].add(loc)

    results = []
    total_hours = 0.0
    total_gross = 0.0
    for r in grouped.values():
        gross = round(r["hours"] * r["hourly_rate"], 2)
        r["gross_pay"] = gross
        r["locations"] = sorted(r["locations"])
        r["hours"] = round(r["hours"], 2)
        results.append(r)
        total_hours += r["hours"]
        total_gross += gross
    results.sort(key=lambda x: x["staff_name"].lower())
    return results, round(total_hours, 2), round(total_gross, 2)


def _load_entries(location_id: Optional[str], start_date: str, end_date: str):
    q: dict = {"date": {"$gte": start_date, "$lte": end_date}}
    if location_id:
        q["location_id"] = location_id
    return list(daily_sales_col.find(q, {"_id": 0}))


@router.get("/staff")
async def payroll_staff(
    location_id: Optional[str] = Query(None),
    user: dict = Depends(get_admin_user),
):
    """Return the staff dropdown for the payroll page. Scoped to a
    site when `location_id` is passed; empty `location_ids` on a staff
    record is treated as 'permitted at all sites' (legacy behaviour)."""
    all_staff, _ = _load_staff()
    filtered = _staff_for_location(all_staff, location_id)
    active_only = [s for s in filtered if s.get("active") is not False]
    return {
        "items": [
            {"id": s.get("id"), "name": s.get("name"), "employee_no": s.get("employee_no") or ""}
            for s in active_only
        ]
    }


@router.get("")
async def payroll_summary(
    start_date: str = Query(...),
    end_date: str = Query(...),
    location_id: Optional[str] = Query(None, description="Omit for every site"),
    staff_id: Optional[str] = Query(None),
    user: dict = Depends(get_admin_user),
):
    """Return per-staff hours + gross-pay totals for the window."""
    if start_date > end_date:
        raise HTTPException(400, "start_date is after end_date")
    entries = _load_entries(location_id, start_date, end_date)
    _, staff_by_name = _load_staff()
    results, total_hours, total_gross = _summarise(entries, staff_by_name, staff_id)

    loc_name = None
    if location_id:
        loc = locations_col.find_one({"id": location_id}, {"_id": 0, "name": 1}) or {}
        loc_name = loc.get("name") or location_id

    return {
        "start_date": start_date,
        "end_date": end_date,
        "location_id": location_id,
        "location_name": loc_name,
        "staff_id": staff_id,
        "total_hours": total_hours,
        "total_gross": total_gross,
        "staff_count": len(results),
        "shift_count": sum(r["shift_count"] for r in results),
        "results": results,
    }


@router.get("/export.csv")
async def payroll_csv(
    start_date: str = Query(...),
    end_date: str = Query(...),
    location_id: Optional[str] = Query(None),
    staff_id: Optional[str] = Query(None),
    user: dict = Depends(get_admin_user),
):
    """CSV export suitable for handing to a bookkeeper or importing
    into external payroll software."""
    if start_date > end_date:
        raise HTTPException(400, "start_date is after end_date")
    entries = _load_entries(location_id, start_date, end_date)
    _, staff_by_name = _load_staff()
    results, total_hours, total_gross = _summarise(entries, staff_by_name, staff_id)

    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Payroll summary"])
    w.writerow(["Window", f"{start_date} to {end_date}"])
    w.writerow(["Site", location_id or "All sites"])
    w.writerow(["Source", "Daily Sales staff_hours"])
    w.writerow([])
    w.writerow(["Staff", "Employee no.", "Hours", "Rate £/h", "Gross £", "Shifts", "Sites"])
    for r in results:
        w.writerow([
            r["staff_name"], r["employee_no"], f"{r['hours']:.2f}",
            f"{r['hourly_rate']:.2f}", f"{r['gross_pay']:.2f}",
            r["shift_count"], ", ".join(r["locations"]),
        ])
    w.writerow([])
    w.writerow(["", "TOTAL", f"{total_hours:.2f}", "", f"{total_gross:.2f}", "", ""])
    buf.seek(0)

    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M")
    safe_loc = (location_id or "all")[:30].replace("/", "_")
    filename = f"payroll_{safe_loc}_{start_date}_to_{end_date}_{ts}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
