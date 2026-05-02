from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timezone
from db import db
from auth import get_staff_or_above, get_admin_user
from pydantic import BaseModel, Field
from typing import Optional
import uuid

router = APIRouter(prefix="/api/admin/cooked-temp", tags=["cooked-temp"])
collection = db["cooked_temp_logs"]

COOKING_METHODS = ["Combi", "Grill", "Microwave", "Oven", "Stove", "Fryer", "Bain-Marie", "Other"]


class EntryCreate(BaseModel):
    location_id: str
    date: str  # YYYY-MM-DD
    food_item: str = Field(..., min_length=1, max_length=200)
    cooking_method: str
    temp_c: float = Field(..., ge=-10, le=300)
    time: Optional[str] = ""  # HH:MM
    initials: Optional[str] = ""


@router.get("/methods")
async def get_methods(user: dict = Depends(get_staff_or_above)):
    return COOKING_METHODS


@router.post("")
async def create_entry(body: EntryCreate, user: dict = Depends(get_staff_or_above)):
    doc = {
        "id": str(uuid.uuid4())[:12],
        "location_id": body.location_id,
        "date": body.date,
        "food_item": body.food_item.strip(),
        "cooking_method": body.cooking_method,
        "temp_c": body.temp_c,
        "time": body.time or "",
        "initials": body.initials or "",
        "passed": body.temp_c >= 75,
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
    return list(collection.find(query, {"_id": 0}).sort([("date", -1), ("time", -1)]).limit(500))


@router.delete("/{entry_id}")
async def delete_entry(entry_id: str, user: dict = Depends(get_admin_user)):
    result = collection.delete_one({"id": entry_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"message": "Entry deleted", "id": entry_id}
