from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timezone
from db import db
from auth import get_staff_or_above, get_admin_user
from pydantic import BaseModel, Field
from typing import Optional
import uuid

router = APIRouter(prefix="/api/admin/legionella", tags=["legionella"])
collection = db["legionella_tests"]


class EntryCreate(BaseModel):
    location_id: str
    date: str  # YYYY-MM-DD
    test_time: Optional[str] = ""  # HH:MM
    hot_water_temp: Optional[float] = None  # should be > 50
    cold_water_temp: Optional[float] = None  # should be < 20
    name: Optional[str] = ""
    initials: Optional[str] = ""
    location_of_test: str = Field(..., min_length=1, max_length=200)
    action_taken: Optional[str] = ""


@router.post("")
async def create_entry(body: EntryCreate, user: dict = Depends(get_staff_or_above)):
    passed = True
    if body.hot_water_temp is None or body.hot_water_temp < 50:
        passed = False
    if body.cold_water_temp is None or body.cold_water_temp > 20:
        passed = False

    doc = {
        "id": str(uuid.uuid4())[:12],
        "location_id": body.location_id,
        "date": body.date,
        "test_time": body.test_time or "",
        "hot_water_temp": body.hot_water_temp,
        "cold_water_temp": body.cold_water_temp,
        "name": (body.name or "").strip(),
        "initials": (body.initials or "").strip(),
        "location_of_test": body.location_of_test.strip(),
        "action_taken": (body.action_taken or "").strip(),
        "passed": passed,
        "created_by": user.get("email", ""),
        "created_by_name": user.get("name", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    collection.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("")
async def list_entries(
    location_id: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    user: dict = Depends(get_staff_or_above),
):
    query = {}
    if location_id:
        query["location_id"] = location_id
    if start_date:
        query.setdefault("date", {})["$gte"] = start_date
    if end_date:
        query.setdefault("date", {})["$lte"] = end_date
    return list(collection.find(query, {"_id": 0}).sort("date", -1).limit(500))


@router.delete("/{entry_id}")
async def delete_entry(entry_id: str, user: dict = Depends(get_admin_user)):
    result = collection.delete_one({"id": entry_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"message": "Entry deleted", "id": entry_id}
