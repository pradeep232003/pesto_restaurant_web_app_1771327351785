"""
Sous Vide — JKHive specialist routine.

Records a sous-vide cook programme: item, raw or pre-cooked, batch count,
water-bath temperature reading, and total duration (hours + minutes).
Pass logic uses simplified UK FSA minimums: pre-cooked items must hold at
≥ 63 °C (hot-holding rule); raw items must reach ≥ 54 °C (sous-vide
pasteurisation start). Duration must be > 0.
"""
import uuid
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from db import db
from auth import get_staff_or_above

router = APIRouter(prefix="/api/admin/sous-vide", tags=["sous-vide"])

records = db["sousvide_records"]

RawOrCooked = Literal["raw", "pre-cooked"]

MIN_TEMP_PRE_COOKED = 63.0
MIN_TEMP_RAW = 54.0


class RecordBody(BaseModel):
    location_id: str
    item_name: str
    item_category: str
    item_icon: Optional[str] = ""
    raw_or_cooked: RawOrCooked
    batch_count: int = Field(ge=1, le=999)
    bath_temp: float
    duration_hours: int = Field(ge=0, le=72)
    duration_minutes: int = Field(ge=0, le=59)
    comment: Optional[str] = ""


def _min_temp(raw_or_cooked: str) -> float:
    return MIN_TEMP_PRE_COOKED if raw_or_cooked == "pre-cooked" else MIN_TEMP_RAW


@router.get("")
async def list_records(
    location_id: str = Query(...),
    limit: int = Query(50, le=200),
    user: dict = Depends(get_staff_or_above),
):
    return list(records.find({"location_id": location_id}, {"_id": 0}).sort("recorded_at", -1).limit(limit))


@router.post("")
async def add_record(body: RecordBody, user: dict = Depends(get_staff_or_above)):
    min_temp = _min_temp(body.raw_or_cooked)
    total_minutes = body.duration_hours * 60 + body.duration_minutes
    temp_pass = body.bath_temp >= min_temp
    time_pass = total_minutes > 0
    passed = temp_pass and time_pass
    doc = {
        "id": str(uuid.uuid4())[:12],
        "location_id": body.location_id,
        "item_name": body.item_name,
        "item_category": body.item_category,
        "item_icon": body.item_icon or "",
        "raw_or_cooked": body.raw_or_cooked,
        "batch_count": body.batch_count,
        "bath_temp": body.bath_temp,
        "min_temp": min_temp,
        "duration_hours": body.duration_hours,
        "duration_minutes": body.duration_minutes,
        "duration_total_minutes": total_minutes,
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
