from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timezone
from db import temp_logs_collection, temp_units_collection, locations_collection
from auth import get_staff_or_above, get_admin_user
from pydantic import BaseModel
from typing import List, Optional
import uuid

router = APIRouter(prefix="/api/admin/temp", tags=["temp-monitoring"])


# ============== MODELS ==============

class TempUnitCreate(BaseModel):
    name: str  # e.g. "Fridge 1", "Freezer", "Display Chiller"
    unit_type: str  # fridge, freezer, chiller
    location_id: str
    time_slots: Optional[List[str]] = None  # e.g. ["08:00", "13:00"]

class TempReading(BaseModel):
    unit_id: str
    temps: Optional[dict] = {}  # {"08:00": 4.2, "13:00": 4.8}

class TempLogSubmit(BaseModel):
    location_id: str
    date: str  # YYYY-MM-DD
    readings: List[TempReading]

class LocationTimeSlotsUpdate(BaseModel):
    location_id: str
    time_slots: List[str]  # ["08:00", "13:00"]


# ============== UNIT MANAGEMENT (Admin) ==============

@router.post("/units")
async def create_unit(body: TempUnitCreate, user: dict = Depends(get_admin_user)):
    doc = {
        "id": str(uuid.uuid4())[:12],
        "name": body.name,
        "unit_type": body.unit_type,
        "location_id": body.location_id,
        "time_slots": body.time_slots or ["08:00", "13:00"],
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    temp_units_collection.insert_one(doc)
    return {"message": "Unit created", "id": doc["id"]}


@router.get("/units")
async def list_units(location_id: str = Query(None), user: dict = Depends(get_staff_or_above)):
    query = {"is_active": True}
    if location_id:
        query["location_id"] = location_id
    units = list(temp_units_collection.find(query, {"_id": 0}).sort("name", 1))
    return units


@router.delete("/units/{unit_id}")
async def delete_unit(unit_id: str, user: dict = Depends(get_admin_user)):
    result = temp_units_collection.update_one({"id": unit_id}, {"$set": {"is_active": False}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Unit not found")
    return {"message": "Unit removed"}


@router.put("/time-slots")
async def update_location_time_slots(body: LocationTimeSlotsUpdate, user: dict = Depends(get_admin_user)):
    """Update recording time slots for all units at a location"""
    result = temp_units_collection.update_many(
        {"location_id": body.location_id, "is_active": True},
        {"$set": {"time_slots": body.time_slots}},
    )
    return {"message": f"Updated {result.modified_count} units", "time_slots": body.time_slots}


@router.get("/time-slots/{location_id}")
async def get_location_time_slots(location_id: str, user: dict = Depends(get_staff_or_above)):
    """Get recording time slots for a location"""
    unit = temp_units_collection.find_one({"location_id": location_id, "is_active": True}, {"_id": 0, "time_slots": 1})
    return {"time_slots": unit.get("time_slots", ["08:00", "13:00"]) if unit else ["08:00", "13:00"]}


# ============== TEMP LOGGING (Staff) ==============

@router.post("/log")
async def submit_temp_log(body: TempLogSubmit, user: dict = Depends(get_staff_or_above)):
    """Submit temperature readings for a location on a date"""
    for r in body.readings:
        existing = temp_logs_collection.find_one({
            "unit_id": r.unit_id, "date": body.date, "location_id": body.location_id,
        })
        update = {"updated_by": user.get("email", ""), "updated_by_name": user.get("name", ""), "updated_at": datetime.now(timezone.utc).isoformat()}
        # Merge temps into existing
        if r.temps:
            for slot, val in r.temps.items():
                if val is not None:
                    update[f"temp_{slot.replace(':', '')}"] = val

        if existing:
            temp_logs_collection.update_one({"id": existing["id"]}, {"$set": update})
        else:
            unit = temp_units_collection.find_one({"id": r.unit_id}, {"_id": 0})
            doc = {
                "id": str(uuid.uuid4())[:12],
                "unit_id": r.unit_id,
                "unit_name": unit.get("name", "") if unit else "",
                "unit_type": unit.get("unit_type", "") if unit else "",
                "location_id": body.location_id,
                "date": body.date,
                "created_by": user.get("email", ""),
                "created_by_name": user.get("name", ""),
                "created_at": datetime.now(timezone.utc).isoformat(),
                **update,
            }
            temp_logs_collection.insert_one(doc)

    return {"message": "Temperatures recorded"}


@router.get("/log")
async def get_temp_logs(
    location_id: str = Query(...),
    date: str = Query(None),
    month: str = Query(None),
    user: dict = Depends(get_staff_or_above),
):
    """Get temp logs for a location. Pass date=YYYY-MM-DD for single day or month=YYYY-MM for monthly view"""
    query = {"location_id": location_id}
    if date:
        query["date"] = date
    elif month:
        import calendar
        year, mo = int(month[:4]), int(month[5:7])
        days = calendar.monthrange(year, mo)[1]
        query["date"] = {"$gte": f"{month}-01", "$lte": f"{month}-{days:02d}"}
    logs = list(temp_logs_collection.find(query, {"_id": 0}).sort("date", 1))
    return logs


# ============== SEED DEFAULT UNITS ==============

@router.post("/seed-defaults")
async def seed_default_units(user: dict = Depends(get_admin_user)):
    """Seed default fridge/freezer/chiller units for all active locations"""
    locs = list(locations_collection.find({"is_active": True}, {"_id": 0, "id": 1, "name": 1}))
    defaults = [
        ("Fridge 1", "fridge"),
        ("Fridge 2", "fridge"),
        ("Freezer", "freezer"),
        ("Display Chiller", "chiller"),
    ]
    created = 0
    for loc in locs:
        for name, utype in defaults:
            existing = temp_units_collection.find_one({"location_id": loc["id"], "name": name, "is_active": True})
            if not existing:
                temp_units_collection.insert_one({
                    "id": str(uuid.uuid4())[:12],
                    "name": name,
                    "unit_type": utype,
                    "location_id": loc["id"],
                    "time_slots": ["08:00", "13:00"],
                    "is_active": True,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                })
                created += 1
    return {"message": f"Seeded {created} units across {len(locs)} locations"}
