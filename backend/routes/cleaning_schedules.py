"""
Shared cleaning-schedule backend for Daily Cleaning and Weekly Deep Cleaning pages.
Each page has:
  - Items CRUD (admin only) with per-location or global scope
  - Weekly log records (week_ending date) storing per-item tick boxes for Mon-Sun
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timezone
from db import (
    daily_cleaning_items_collection, daily_cleaning_logs_collection,
    weekly_cleaning_items_collection, weekly_cleaning_logs_collection,
)
from auth import get_staff_or_above, get_admin_user
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import uuid

DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


DAILY_DEFAULTS = [
    ("fridge", "FRIDGE", "EOS", "Pull out sanitise in/out and seal", "SANITISER"),
    ("freezer", "FREEZER", "EOS", "Pull out sanitise in/out and seal", "SANITISER"),
    ("surfaces", "SURFACES", "EOS", "Remove debris, wipe clean", "SANITISER"),
    ("grill", "GRILL", "EOS", "Wipe clean", "N/A"),
    ("fryer", "FRYER", "AM", "Drain and wipe clean", "SANITIZER"),
    ("microwave", "MICROWAVE", "EOS", "Clean inside and out including handles", "SANITISER"),
    ("coffee_syrup", "COFFEE MACHINE/SYRUP PUMP", "EOS", "Rinse/cleaning", "CLEANING TAB + SANITIZER"),
    ("oven_hob", "OVEN/HOB", "EOS", "Pull out, clean burners, sanitise", "DEGREASER"),
    ("pots_pans", "POTS/PANS/TRAYS", "CAYG", "Remove food debris, clean in dishwasher", "N/A"),
    ("hand_contact", "HAND CONTACT", "CAYG/EOS", "Remove debris and wipe clean", "SANITIZER"),
    ("sinks", "SINKS", "EOS", "Remove debris and wipe clean", "SANITISER"),
    ("taps_dispensers", "TAPS & DISPENSERS", "EOS", "Sanitise", "SANITISER"),
    ("rubbish_bin", "RUBBISH BIN", "EOS", "Empty & replace liners. Wipe inside & outside", "SANITISER"),
    ("floor", "FLOOR", "EOS", "Brush and then mop", "FLOOR CLEANER"),
    ("dustpan_mops", "DUST PAN, BRUSH & MOPS", "EOS", "Wash and store", "SANITISER"),
    ("tin_openers", "TIN OPENERS", "CAYG", "Wipe base clean", "SANITISER"),
    ("stools_fan", "STOOLS/FLOOR FAN", "EOS", "Wipe and clean", "SANITIZER"),
    ("stairs_floor", "STAIRS/FLOOR", "EOS", "Brush and mop", "FLOOR CLEANING GEL"),
]

WEEKLY_DEFAULTS = [
    ("rubbish_bin_wk", "RUBBISH BIN", "WEEKLY", "Clean outside and inside", "SANITISER"),
    ("fridge_freezer_wk", "FRIDGE/FREEZER", "WEEKLY", "Pull out, clean sides, legs, & floor", "SANITISER"),
    ("shelves_wall_wk", "SHELVES/WALL", "WEEKLY", "Remove all items and wipe shelves and walls", "SANITISER"),
    ("fryer_wk", "FRYER", "WEEKLY AM", "Drain and clean, replace oil", "SANITIZER"),
    ("microwave_wk", "MICROWAVE", "WEEKLY", "Clean inside and filters", "SANITISER"),
    ("oven_hob_wk", "OVEN/HOB", "WEEKLY", "Pull out, clean surround, legs and floor", "DEGREASER"),
    ("ceiling_wk", "CEILING", "WEEKLY", "Wipe clean. Clean extract filters, if any", "SANITISER"),
]


def _seed(items_coll, defaults, label):
    if items_coll.count_documents({}) == 0:
        for idx, (item_id, name, freq, method, chem) in enumerate(defaults):
            items_coll.insert_one({
                "id": item_id, "name": name, "frequency": freq,
                "methods": method, "chemical": chem,
                "location_id": None, "order": idx, "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        print(f"Seeded {len(defaults)} default {label} items")


def seed_cleaning_schedules():
    _seed(daily_cleaning_items_collection, DAILY_DEFAULTS, "daily-cleaning")
    _seed(weekly_cleaning_items_collection, WEEKLY_DEFAULTS, "weekly-cleaning")


class ItemCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    frequency: Optional[str] = ""
    methods: Optional[str] = ""
    chemical: Optional[str] = ""
    location_id: Optional[str] = None


class ItemUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    frequency: Optional[str] = None
    methods: Optional[str] = None
    chemical: Optional[str] = None
    location_id: Optional[str] = None
    scope: Optional[str] = None
    order: Optional[int] = None
    is_active: Optional[bool] = None


class LogSubmit(BaseModel):
    location_id: str
    week_ending: str  # YYYY-MM-DD (Sunday)
    ticks: Dict[str, Dict[str, bool]]  # { item_id: { mon: bool, ... sun: bool } }
    note: Optional[str] = ""


def _active_items(items_coll, location_id: Optional[str]) -> List[dict]:
    query = {"is_active": True, "$or": [{"location_id": None}, {"location_id": location_id}]} if location_id else {"is_active": True, "location_id": None}
    return list(items_coll.find(query, {"_id": 0}).sort([("order", 1), ("created_at", 1)]))


def build_cleaning_router(prefix: str, items_coll, logs_coll, tag: str):
    router = APIRouter(prefix=prefix, tags=[tag])

    # ---------- Items ----------
    @router.get("/items")
    async def get_items(location_id: Optional[str] = Query(None), user: dict = Depends(get_staff_or_above)):
        return _active_items(items_coll, location_id)

    @router.get("/items/all")
    async def list_all_items(user: dict = Depends(get_admin_user)):
        return list(items_coll.find({}, {"_id": 0}).sort([("location_id", 1), ("order", 1)]))

    @router.post("/items")
    async def create_item(body: ItemCreate, user: dict = Depends(get_admin_user)):
        max_doc = items_coll.find_one({"location_id": body.location_id}, sort=[("order", -1)])
        next_order = (max_doc.get("order", 0) + 1) if max_doc else 0
        doc = {
            "id": str(uuid.uuid4())[:12],
            "name": body.name.strip(),
            "frequency": (body.frequency or "").strip(),
            "methods": (body.methods or "").strip(),
            "chemical": (body.chemical or "").strip(),
            "location_id": body.location_id,
            "order": next_order,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": user.get("email", ""),
        }
        items_coll.insert_one(doc)
        doc.pop("_id", None)
        return doc

    @router.patch("/items/{item_id}")
    async def update_item(item_id: str, body: ItemUpdate, user: dict = Depends(get_admin_user)):
        existing = items_coll.find_one({"id": item_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Item not found")
        updates = {}
        for f in ("name", "frequency", "methods", "chemical"):
            v = getattr(body, f)
            if v is not None:
                updates[f] = v.strip()
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
        items_coll.update_one({"id": item_id}, {"$set": updates})
        return items_coll.find_one({"id": item_id}, {"_id": 0})

    @router.delete("/items/{item_id}")
    async def delete_item(item_id: str, user: dict = Depends(get_admin_user)):
        result = items_coll.delete_one({"id": item_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Item not found")
        return {"message": "Item deleted", "id": item_id}

    # ---------- Logs (weekly tick-box record) ----------
    @router.post("")
    async def submit_log(body: LogSubmit, user: dict = Depends(get_staff_or_above)):
        items = _active_items(items_coll, body.location_id)
        items_snapshot = [{"id": i["id"], "name": i["name"], "frequency": i.get("frequency", ""),
                           "methods": i.get("methods", ""), "chemical": i.get("chemical", "")} for i in items]
        total_cells = len(items) * 7
        passed_cells = 0
        for i in items:
            row = body.ticks.get(i["id"], {})
            for d in DAYS:
                if row.get(d):
                    passed_cells += 1

        existing = logs_coll.find_one({"location_id": body.location_id, "week_ending": body.week_ending})
        doc = {
            "location_id": body.location_id,
            "week_ending": body.week_ending,
            "ticks": body.ticks,
            "note": body.note or "",
            "items_snapshot": items_snapshot,
            "total_cells": total_cells,
            "passed_cells": passed_cells,
            "completed_by": user.get("email", ""),
            "completed_by_name": user.get("name", ""),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if existing:
            logs_coll.update_one({"id": existing["id"]}, {"$set": doc})
            return {"message": "Log updated", "id": existing["id"], "passed": passed_cells, "total": total_cells}
        doc["id"] = str(uuid.uuid4())[:12]
        doc["created_at"] = datetime.now(timezone.utc).isoformat()
        logs_coll.insert_one(doc)
        return {"message": "Log saved", "id": doc["id"], "passed": passed_cells, "total": total_cells}

    @router.get("")
    async def get_log(
        location_id: str = Query(...),
        week_ending: str = Query(...),
        user: dict = Depends(get_staff_or_above),
    ):
        return logs_coll.find_one({"location_id": location_id, "week_ending": week_ending}, {"_id": 0})

    @router.get("/history")
    async def get_history(
        location_id: Optional[str] = Query(None),
        start_date: Optional[str] = Query(None),
        end_date: Optional[str] = Query(None),
        user: dict = Depends(get_admin_user),
    ):
        query = {}
        if location_id:
            query["location_id"] = location_id
        if start_date:
            query.setdefault("week_ending", {})["$gte"] = start_date
        if end_date:
            query.setdefault("week_ending", {})["$lte"] = end_date
        return list(logs_coll.find(query, {"_id": 0}).sort("week_ending", -1).limit(100))

    return router


daily_cleaning_router = build_cleaning_router(
    "/api/admin/daily-cleaning",
    daily_cleaning_items_collection, daily_cleaning_logs_collection,
    "daily-cleaning",
)
weekly_cleaning_router = build_cleaning_router(
    "/api/admin/weekly-cleaning",
    weekly_cleaning_items_collection, weekly_cleaning_logs_collection,
    "weekly-cleaning",
)
