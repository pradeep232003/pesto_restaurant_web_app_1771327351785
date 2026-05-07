"""
Routine Temps — Opening / Closing fridge & freezer temperature wizard.
Stores one record per (location, date, period) where period ∈ {opening, closing}.
"""
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from db import db
from auth import get_staff_or_above

router = APIRouter(prefix="/api/admin/routine-temps", tags=["routine-temps"])

routine_temps_collection = db["routine_temps"]


class UnitReading(BaseModel):
    unit_id: str
    unit_name: str
    unit_type: str  # fridge | freezer | chiller
    temp_c: float


class RoutineTempSubmit(BaseModel):
    location_id: str
    date: str  # YYYY-MM-DD
    period: str = Field(..., pattern="^(opening|closing)$")
    readings: List[UnitReading]
    comment: Optional[str] = ""


@router.post("")
async def submit_routine_temp(body: RoutineTempSubmit, user: dict = Depends(get_staff_or_above)):
    """Upsert a single opening/closing record for a location/date."""
    key = {"location_id": body.location_id, "date": body.date, "period": body.period}
    doc = {
        **key,
        "readings": [r.dict() for r in body.readings],
        "comment": body.comment or "",
        "submitted_by": user.get("email", ""),
        "submitted_by_name": user.get("name", ""),
        "submitted_at": datetime.now(timezone.utc).isoformat(),
    }
    existing = routine_temps_collection.find_one(key)
    if existing:
        routine_temps_collection.update_one(key, {"$set": doc})
        doc["id"] = existing.get("id")
    else:
        doc["id"] = str(uuid.uuid4())[:12]
        routine_temps_collection.insert_one(dict(doc))
    return {k: v for k, v in doc.items() if k != "_id"}


@router.get("")
async def list_routine_temps(
    location_id: str = Query(None),
    period: str = Query(None),
    start_date: str = Query(None),
    end_date: str = Query(None),
    user: dict = Depends(get_staff_or_above),
):
    q = {}
    if location_id:
        q["location_id"] = location_id
    if period:
        q["period"] = period
    if start_date and end_date:
        q["date"] = {"$gte": start_date, "$lte": end_date}
    items = list(routine_temps_collection.find(q, {"_id": 0}).sort("date", -1))
    return items
