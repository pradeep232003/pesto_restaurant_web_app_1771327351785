from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timezone
from db import daily_checks_collection, daily_check_items_collection
from auth import get_staff_or_above, get_admin_user
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import uuid

router = APIRouter(prefix="/api/admin/daily-checks", tags=["daily-checks"])

# Default seed list — used only on first boot when the collection is empty.
# Fixed IDs preserve compatibility with any previously-saved daily_checks entries
# that reference item IDs in their `checks` dict.
DEFAULT_CHECKLIST_ITEMS = [
    ("staff_fit", "Staff are fit to work i.e. no illness, cuts covered with blue plasters and uniforms are suitable and clean"),
    ("sinks_clean", "All sinks are clean, have hot and cold water. There are plenty of handwashing and cleaning materials (soaps, paper towels, sanitiser, etc.)"),
    ("fridge_freezer_working", "All fridge, freezer and chilled display units are working correctly, and temperature recorded"),
    ("equipment_clean", "All other bulk equipment (i.e. oven, stove tops, etc.) are clean and working properly"),
    ("extraction_working", "The extraction system on and working"),
    ("lighting_ventilation", "The lighting and ventilation to the kitchen and storage areas is suitable"),
    ("areas_sanitised", "All areas and equipment clean and sanitised and fit for food preparation"),
    ("delivery_correct", "Delivery all correct, all packaging still intact, in date and stored in fridge according to guidelines"),
    ("defrosting_checked", "All defrosting foods are checked and thoroughly thawed prior to cooking"),
    ("pest_clear", "The kitchen is clear of any signs of pest activity (if found, report and take action)"),
    ("energy_saving", "Equipment switched on according to energy saving procedure"),
    ("fridge_layout", "Fridge layout checked to avoid cross contamination"),
    ("probe_thermometer", "Probe thermometer is working, and probes are available"),
    ("fridge_dates", "Fridge/freezer dates checked"),
    ("allergens_accurate", "Allergens information is accurate for all items on sale"),
]


def seed_daily_check_items():
    """Seed default checklist items (global scope) on first boot."""
    if daily_check_items_collection.count_documents({}) == 0:
        for idx, (item_id, text) in enumerate(DEFAULT_CHECKLIST_ITEMS):
            daily_check_items_collection.insert_one({
                "id": item_id,
                "text": text,
                "location_id": None,  # None = global / applies to all locations
                "order": idx,
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        print(f"Seeded {len(DEFAULT_CHECKLIST_ITEMS)} default daily-check items")


def _active_items_for_location(location_id: Optional[str]) -> List[dict]:
    """Items visible to a location = global items + items scoped to that location."""
    query = {"is_active": True, "$or": [{"location_id": None}, {"location_id": location_id}]} if location_id else {"is_active": True, "location_id": None}
    items = list(daily_check_items_collection.find(query, {"_id": 0}).sort([("order", 1), ("created_at", 1)]))
    return items


# ------------------------------- Schemas -------------------------------
class DailyCheckSubmit(BaseModel):
    location_id: str
    date: str
    checks: Dict[str, bool]
    note: Optional[str] = ""


class ChecklistItemCreate(BaseModel):
    text: str = Field(..., min_length=3, max_length=500)
    location_id: Optional[str] = None  # None = global


class ChecklistItemUpdate(BaseModel):
    text: Optional[str] = Field(None, min_length=3, max_length=500)
    location_id: Optional[str] = None
    scope: Optional[str] = None  # "global" or "location" — helps clear location_id
    order: Optional[int] = None
    is_active: Optional[bool] = None


# ------------------------------- Items CRUD -------------------------------
@router.get("/items")
async def get_checklist_items(
    location_id: Optional[str] = Query(None),
    user: dict = Depends(get_staff_or_above),
):
    return _active_items_for_location(location_id)


@router.get("/items/all")
async def list_all_items(user: dict = Depends(get_admin_user)):
    """Admin management view — returns every item (active or not) with scope info."""
    items = list(daily_check_items_collection.find({}, {"_id": 0}).sort([("location_id", 1), ("order", 1)]))
    return items


@router.post("/items")
async def create_checklist_item(body: ChecklistItemCreate, user: dict = Depends(get_admin_user)):
    # compute next order within the same scope
    scope_query = {"location_id": body.location_id}
    max_doc = daily_check_items_collection.find_one(scope_query, sort=[("order", -1)])
    next_order = (max_doc.get("order", 0) + 1) if max_doc else 0

    doc = {
        "id": str(uuid.uuid4())[:12],
        "text": body.text.strip(),
        "location_id": body.location_id,
        "order": next_order,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user.get("email", ""),
    }
    daily_check_items_collection.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.patch("/items/{item_id}")
async def update_checklist_item(item_id: str, body: ChecklistItemUpdate, user: dict = Depends(get_admin_user)):
    existing = daily_check_items_collection.find_one({"id": item_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Item not found")

    updates = {}
    if body.text is not None:
        updates["text"] = body.text.strip()
    if body.scope == "global":
        updates["location_id"] = None
    elif body.scope == "location" and body.location_id:
        updates["location_id"] = body.location_id
    elif body.location_id is not None and body.scope is None:
        updates["location_id"] = body.location_id
    if body.order is not None:
        updates["order"] = body.order
    if body.is_active is not None:
        updates["is_active"] = body.is_active

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    updates["updated_by"] = user.get("email", "")
    daily_check_items_collection.update_one({"id": item_id}, {"$set": updates})
    updated = daily_check_items_collection.find_one({"id": item_id}, {"_id": 0})
    return updated


@router.delete("/items/{item_id}")
async def delete_checklist_item(item_id: str, user: dict = Depends(get_admin_user)):
    result = daily_check_items_collection.delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Item deleted", "id": item_id}


# ------------------------------- Daily Check submissions -------------------------------
@router.post("")
async def submit_daily_check(body: DailyCheckSubmit, user: dict = Depends(get_staff_or_above)):
    items = _active_items_for_location(body.location_id)
    total = len(items)
    passed = sum(1 for item in items if body.checks.get(item["id"], False))
    items_snapshot = [{"id": i["id"], "text": i["text"]} for i in items]

    existing = daily_checks_collection.find_one({"location_id": body.location_id, "date": body.date})

    doc = {
        "location_id": body.location_id,
        "date": body.date,
        "checks": body.checks,
        "note": body.note or "",
        "completed_by": user.get("email", ""),
        "completed_by_name": user.get("name", ""),
        "total_items": total,
        "passed_items": passed,
        "items_snapshot": items_snapshot,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

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
            "total": e.get("total_items", 0),
            "by": e.get("completed_by_name", ""),
        }
    return {"month": month, "days_in_month": days, "grid": grid}
