from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timezone
from db import kitchen_closedown_collection, kitchen_closedown_items_collection
from auth import get_staff_or_above, get_admin_user
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import uuid

router = APIRouter(prefix="/api/admin/kitchen-closedown", tags=["kitchen-closedown"])

# Default seed list — mirrors the physical Kitchen Closedown Checks form.
DEFAULT_CLOSEDOWN_ITEMS = [
    ("weekly_cleaning_signoff", "All items of the weekly cleaning schedule have been completed and signed off"),
    ("food_covered_labelled", "All food is covered, labelled and put in the fridge/freezer (where appropriate)"),
    ("waste_removed_bins", "All waste has been removed, bins are clean and new bin liners placed inside"),
    ("fridge_temp_recorded", "All fridge/freezer units are working correctly and temperature have been recorded"),
    ("appliances_off", "All appliances and electrical items are switched off"),
    ("extraction_off", "The extraction system is switched off"),
    ("out_of_date_discarded", "All food in all fridge/freezer checked and out of date product is discarded"),
    ("prep_areas_disinfected", "Food preparation areas are clean and disinfected (work surfaces, equipment, utensils etc.)"),
    ("floors_swept_clean", "Floors are swept and clean"),
]


def seed_kitchen_closedown_items():
    """Seed default closedown items (global scope) on first boot."""
    if kitchen_closedown_items_collection.count_documents({}) == 0:
        for idx, (item_id, text) in enumerate(DEFAULT_CLOSEDOWN_ITEMS):
            kitchen_closedown_items_collection.insert_one({
                "id": item_id,
                "text": text,
                "location_id": None,
                "order": idx,
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        print(f"Seeded {len(DEFAULT_CLOSEDOWN_ITEMS)} default kitchen-closedown items")


def _active_items_for_location(location_id: Optional[str]) -> List[dict]:
    query = {"is_active": True, "$or": [{"location_id": None}, {"location_id": location_id}]} if location_id else {"is_active": True, "location_id": None}
    return list(kitchen_closedown_items_collection.find(query, {"_id": 0}).sort([("order", 1), ("created_at", 1)]))


class ClosedownSubmit(BaseModel):
    location_id: str
    date: str
    checks: Dict[str, bool]
    note: Optional[str] = ""


class ClosedownItemCreate(BaseModel):
    text: str = Field(..., min_length=3, max_length=500)
    location_id: Optional[str] = None


class ClosedownItemUpdate(BaseModel):
    text: Optional[str] = Field(None, min_length=3, max_length=500)
    location_id: Optional[str] = None
    scope: Optional[str] = None
    order: Optional[int] = None
    is_active: Optional[bool] = None


# ------------------------------- Items CRUD -------------------------------
@router.get("/items")
async def get_closedown_items(
    location_id: Optional[str] = Query(None),
    user: dict = Depends(get_staff_or_above),
):
    return _active_items_for_location(location_id)


@router.get("/items/all")
async def list_all_items(user: dict = Depends(get_admin_user)):
    return list(kitchen_closedown_items_collection.find({}, {"_id": 0}).sort([("location_id", 1), ("order", 1)]))


@router.post("/items")
async def create_closedown_item(body: ClosedownItemCreate, user: dict = Depends(get_admin_user)):
    scope_query = {"location_id": body.location_id}
    max_doc = kitchen_closedown_items_collection.find_one(scope_query, sort=[("order", -1)])
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
    kitchen_closedown_items_collection.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.patch("/items/{item_id}")
async def update_closedown_item(item_id: str, body: ClosedownItemUpdate, user: dict = Depends(get_admin_user)):
    existing = kitchen_closedown_items_collection.find_one({"id": item_id})
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
    kitchen_closedown_items_collection.update_one({"id": item_id}, {"$set": updates})
    return kitchen_closedown_items_collection.find_one({"id": item_id}, {"_id": 0})


@router.delete("/items/{item_id}")
async def delete_closedown_item(item_id: str, user: dict = Depends(get_admin_user)):
    result = kitchen_closedown_items_collection.delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Item deleted", "id": item_id}


# ------------------------------- Closedown submissions -------------------------------
@router.post("")
async def submit_closedown(body: ClosedownSubmit, user: dict = Depends(get_staff_or_above)):
    items = _active_items_for_location(body.location_id)
    total = len(items)
    passed = sum(1 for item in items if body.checks.get(item["id"], False))
    items_snapshot = [{"id": i["id"], "text": i["text"]} for i in items]

    existing = kitchen_closedown_collection.find_one({"location_id": body.location_id, "date": body.date})
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
        kitchen_closedown_collection.update_one({"id": existing["id"]}, {"$set": doc})
        return {"message": "Closedown updated", "id": existing["id"], "passed": passed, "total": total}
    else:
        doc["id"] = str(uuid.uuid4())[:12]
        doc["created_at"] = datetime.now(timezone.utc).isoformat()
        kitchen_closedown_collection.insert_one(doc)
        return {"message": "Closedown saved", "id": doc["id"], "passed": passed, "total": total}


@router.get("")
async def get_closedown(
    location_id: str = Query(...),
    date: str = Query(None),
    user: dict = Depends(get_staff_or_above),
):
    if date:
        return kitchen_closedown_collection.find_one({"location_id": location_id, "date": date}, {"_id": 0})
    return None


@router.get("/history")
async def get_closedown_history(
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
    return list(kitchen_closedown_collection.find(query, {"_id": 0}).sort("date", -1).limit(100))


@router.get("/completion")
async def get_closedown_completion(
    month: str = Query(..., description="YYYY-MM"),
    user: dict = Depends(get_admin_user),
):
    import calendar
    year, mo = int(month[:4]), int(month[5:7])
    days = calendar.monthrange(year, mo)[1]
    start = f"{month}-01"
    end = f"{month}-{days:02d}"
    entries = list(kitchen_closedown_collection.find(
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
