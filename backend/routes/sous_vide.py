"""
Sous Vide — JKHive specialist routine.

Records target temp/time programme + actual core temp/elapsed time for
sous-vide (low-temp long-time) cooks. Pass = actual ≥ target on both axes.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from db import db
from auth import get_staff_or_above

router = APIRouter(prefix="/api/admin/sous-vide", tags=["sous-vide"])

records = db["sousvide_records"]


class RecordBody(BaseModel):
    location_id: str
    item_name: str
    item_category: str
    item_icon: Optional[str] = ""
    target_temp: float
    target_minutes: float
    actual_temp: float
    actual_minutes: float
    comment: Optional[str] = ""


@router.get("")
async def list_records(
    location_id: str = Query(...),
    limit: int = Query(50, le=200),
    user: dict = Depends(get_staff_or_above),
):
    return list(records.find({"location_id": location_id}, {"_id": 0}).sort("recorded_at", -1).limit(limit))


@router.post("")
async def add_record(body: RecordBody, user: dict = Depends(get_staff_or_above)):
    temp_pass = body.actual_temp >= body.target_temp
    time_pass = body.actual_minutes >= body.target_minutes
    passed = temp_pass and time_pass
    doc = {
        "id": str(uuid.uuid4())[:12],
        "location_id": body.location_id,
        "item_name": body.item_name,
        "item_category": body.item_category,
        "item_icon": body.item_icon or "",
        "target_temp": body.target_temp,
        "target_minutes": body.target_minutes,
        "actual_temp": body.actual_temp,
        "actual_minutes": body.actual_minutes,
        "temp_pass": temp_pass,
        "time_pass": time_pass,
        "passed": passed,
        "comment": body.comment or "",
        "recorded_at": datetime.now(timezone.utc).isoformat(),
        "recorded_by": user.get("email", ""),
        "recorded_by_name": user.get("name", ""),
    }
    records.insert_one(dict(doc))
    return {k: v for k, v in doc.items() if k != "_id"}


@router.delete("/{record_id}")
async def delete_record(record_id: str, user: dict = Depends(get_staff_or_above)):
    res = records.delete_one({"id": record_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"deleted": True}
