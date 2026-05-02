from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timezone
from db import daily_checks_collection
from auth import get_staff_or_above, get_admin_user
from pydantic import BaseModel
from typing import List, Optional, Dict
import uuid

router = APIRouter(prefix="/api/admin/daily-checks", tags=["daily-checks"])

CHECKLIST_ITEMS = [
    {"id": "staff_fit", "text": "Staff are fit to work i.e. no illness, cuts covered with blue plasters and uniforms are suitable and clean"},
    {"id": "sinks_clean", "text": "All sinks are clean, have hot and cold water. There are plenty of handwashing and cleaning materials (soaps, paper towels, sanitiser, etc.)"},
    {"id": "fridge_freezer_working", "text": "All fridge, freezer and chilled display units are working correctly, and temperature recorded"},
    {"id": "equipment_clean", "text": "All other bulk equipment (i.e. oven, stove tops, etc.) are clean and working properly"},
    {"id": "extraction_working", "text": "The extraction system on and working"},
    {"id": "lighting_ventilation", "text": "The lighting and ventilation to the kitchen and storage areas is suitable"},
    {"id": "areas_sanitised", "text": "All areas and equipment clean and sanitised and fit for food preparation"},
    {"id": "delivery_correct", "text": "Delivery all correct, all packaging still intact, in date and stored in fridge according to guidelines"},
    {"id": "defrosting_checked", "text": "All defrosting foods are checked and thoroughly thawed prior to cooking"},
    {"id": "pest_clear", "text": "The kitchen is clear of any signs of pest activity (if found, report and take action)"},
    {"id": "energy_saving", "text": "Equipment switched on according to energy saving procedure"},
    {"id": "fridge_layout", "text": "Fridge layout checked to avoid cross contamination"},
    {"id": "probe_thermometer", "text": "Probe thermometer is working, and probes are available"},
    {"id": "fridge_dates", "text": "Fridge/freezer dates checked"},
    {"id": "allergens_accurate", "text": "Allergens information is accurate for all items on sale"},
]


class DailyCheckSubmit(BaseModel):
    location_id: str
    date: str
    checks: Dict[str, bool]
    note: Optional[str] = ""


@router.get("/items")
async def get_checklist_items(user: dict = Depends(get_staff_or_above)):
    return CHECKLIST_ITEMS


@router.post("")
async def submit_daily_check(body: DailyCheckSubmit, user: dict = Depends(get_staff_or_above)):
    existing = daily_checks_collection.find_one({"location_id": body.location_id, "date": body.date})

    doc = {
        "location_id": body.location_id,
        "date": body.date,
        "checks": body.checks,
        "note": body.note or "",
        "completed_by": user.get("email", ""),
        "completed_by_name": user.get("name", ""),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    total = len(CHECKLIST_ITEMS)
    passed = sum(1 for item in CHECKLIST_ITEMS if body.checks.get(item["id"], False))
    doc["total_items"] = total
    doc["passed_items"] = passed

    if existing:
        daily_checks_collection.update_one({"id": existing["id"]}, {"$set": doc})
        return {"message": "Daily check updated", "id": existing["id"], "passed": passed, "total": total}
    else:
        doc["id"] = str(uuid.uuid4())[:12]
        doc["created_at"] = datetime.now(timezone.utc).isoformat()
        daily_checks_collection.insert_one(doc)
        return {"message": "Daily check saved", "id": doc["id"], "passed": passed, "total": total}


@router.get("")
async def get_daily_check(
    location_id: str = Query(...),
    date: str = Query(None),
    user: dict = Depends(get_staff_or_above),
):
    if date:
        entry = daily_checks_collection.find_one({"location_id": location_id, "date": date}, {"_id": 0})
        return entry
    return None


@router.get("/history")
async def get_checks_history(
    location_id: str = Query(None),
    start_date: str = Query(None),
    end_date: str = Query(None),
    user: dict = Depends(get_admin_user),
):
    query = {}
    if location_id:
        query["location_id"] = location_id
    if start_date:
        query.setdefault("date", {})["$gte"] = start_date
    if end_date:
        query.setdefault("date", {})["$lte"] = end_date
    entries = list(daily_checks_collection.find(query, {"_id": 0}).sort("date", -1).limit(100))
    return entries


@router.get("/completion")
async def get_checks_completion(
    month: str = Query(..., description="YYYY-MM"),
    user: dict = Depends(get_admin_user),
):
    """Completion grid for daily checks across locations"""
    import calendar
    from db import locations_collection
    year, mo = int(month[:4]), int(month[5:7])
    days = calendar.monthrange(year, mo)[1]
    start = f"{month}-01"
    end = f"{month}-{days:02d}"

    entries = list(daily_checks_collection.find(
        {"date": {"$gte": start, "$lte": end}},
        {"_id": 0, "location_id": 1, "date": 1, "passed_items": 1, "total_items": 1, "completed_by_name": 1},
    ))
    grid = {}
    for e in entries:
        key = f"{e['location_id']}|{e['date']}"
        grid[key] = {
            "passed": e.get("passed_items", 0),
            "total": e.get("total_items", 15),
            "by": e.get("completed_by_name", ""),
        }
    return {"month": month, "days_in_month": days, "grid": grid}
