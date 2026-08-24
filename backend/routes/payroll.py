"""
Payroll — computes what each staff member is owed for a given
window based on their scheduled shifts × their hourly_rate.

Read-only aggregation: pay data comes from `staff_members.hourly_rate`
(kept editable on /admin/staff), hours from `shifts.hours` in the
range. Only published shifts are counted so drafts don't inflate
figures accidentally. Admins can pass `include_drafts=true` to
preview forecast pay for a draft week.

Filters: location_id (single site or omit for every accessible site),
start_date / end_date (inclusive YYYY-MM-DD), staff_id (single person).

Endpoint: GET /api/admin/payroll — admin & super_admin only.
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
shifts_col = db["shifts"]
staff_col = db["staff_members"]
locations_col = db["locations"]


def _load_data(location_id: Optional[str], start_date: str, end_date: str,
               staff_id: Optional[str], include_drafts: bool):
    q: dict = {"date": {"$gte": start_date, "$lte": end_date}}
    if location_id:
        q["location_id"] = location_id
    if staff_id:
        q["staff_id"] = staff_id
    if not include_drafts:
        q["published"] = True
    shifts = list(shifts_col.find(q, {"_id": 0}))

    # Rate lookup — join by staff_id. Cache each staff record once.
    staff_ids = {s.get("staff_id") for s in shifts if s.get("staff_id")}
    staff_map = {
        s["id"]: s for s in staff_col.find(
            {"id": {"$in": list(staff_ids)}} if staff_ids else {"id": None},
            {"_id": 0, "id": 1, "name": 1, "hourly_rate": 1, "employee_no": 1, "ni_number": 1},
        )
    }
    return shifts, staff_map


def _summarise(shifts, staff_map):
    """Group shifts by staff_id and compute hours + gross pay."""
    grouped: dict = {}
    for s in shifts:
        sid = s.get("staff_id") or "_unknown"
        row = grouped.setdefault(sid, {
            "staff_id": sid,
            "staff_name": (staff_map.get(sid) or {}).get("name") or s.get("staff_name") or "Unassigned",
            "employee_no": (staff_map.get(sid) or {}).get("employee_no") or "",
            "hourly_rate": float((staff_map.get(sid) or {}).get("hourly_rate") or 0),
            "hours": 0.0,
            "shift_count": 0,
            "any_draft": False,
            "locations": set(),
        })
        row["hours"] += float(s.get("hours") or 0)
        row["shift_count"] += 1
        if not s.get("published"):
            row["any_draft"] = True
        if s.get("location_id"):
            row["locations"].add(s["location_id"])

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


@router.get("")
async def payroll_summary(
    start_date: str = Query(...),
    end_date: str = Query(...),
    location_id: Optional[str] = Query(None, description="Omit for every site"),
    staff_id: Optional[str] = Query(None),
    include_drafts: bool = Query(False),
    user: dict = Depends(get_admin_user),
):
    """Return per-staff hours + gross-pay totals for the window."""
    if start_date > end_date:
        raise HTTPException(400, "start_date is after end_date")
    shifts, staff_map = _load_data(location_id, start_date, end_date, staff_id, include_drafts)
    results, total_hours, total_gross = _summarise(shifts, staff_map)

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
        "include_drafts": include_drafts,
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
    include_drafts: bool = Query(False),
    user: dict = Depends(get_admin_user),
):
    """CSV export suitable for handing to a bookkeeper or importing
    into external payroll software."""
    if start_date > end_date:
        raise HTTPException(400, "start_date is after end_date")
    shifts, staff_map = _load_data(location_id, start_date, end_date, staff_id, include_drafts)
    results, total_hours, total_gross = _summarise(shifts, staff_map)

    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Payroll summary"])
    w.writerow(["Window", f"{start_date} to {end_date}"])
    w.writerow(["Site", location_id or "All sites"])
    w.writerow(["Includes drafts", "yes" if include_drafts else "no"])
    w.writerow([])
    w.writerow(["Staff", "Employee no.", "Hours", "Rate £/h", "Gross £", "Shifts", "Sites", "Has draft?"])
    for r in results:
        w.writerow([
            r["staff_name"], r["employee_no"], f"{r['hours']:.2f}",
            f"{r['hourly_rate']:.2f}", f"{r['gross_pay']:.2f}",
            r["shift_count"], ", ".join(r["locations"]),
            "yes" if r["any_draft"] else "",
        ])
    w.writerow([])
    w.writerow(["", "TOTAL", f"{total_hours:.2f}", "", f"{total_gross:.2f}", "", "", ""])
    buf.seek(0)

    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M")
    safe_loc = (location_id or "all")[:30].replace("/", "_")
    filename = f"payroll_{safe_loc}_{start_date}_to_{end_date}_{ts}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
