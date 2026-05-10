"""
Sous Vide — JKHive specialist routine.

Lifecycle:
  POST  /api/admin/sous-vide                  — start a session (status='active')
  GET   /api/admin/sous-vide?status=active    — list active sessions for the
                                                 home dashboard's live timer cards
  PATCH /api/admin/sous-vide/{id}/complete    — finalise: capture final core
                                                 temp + served/cooled + comment
  DELETE /api/admin/sous-vide/{id}            — remove a session

UK FSA simplified pass logic (recorded at start):
  pre-cooked items: water bath ≥ 63 °C (hot-holding rule)
  raw items:        water bath ≥ 54 °C (sous-vide pasteurisation start)
  duration > 0
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
NextPhase = Literal["served", "cooled"]
Status = Literal["active", "complete"]

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


class CompleteBody(BaseModel):
    final_core_temp: float
    served_or_cooled: NextPhase
    comment: Optional[str] = ""


def _min_temp(raw_or_cooked: str) -> float:
    return MIN_TEMP_PRE_COOKED if raw_or_cooked == "pre-cooked" else MIN_TEMP_RAW


@router.get("")
async def list_records(
    location_id: str = Query(...),
    status: Optional[Status] = Query(None),
    limit: int = Query(100, le=200),
    user: dict = Depends(get_staff_or_above),
):
    q = {"location_id": location_id}
    if status:
        q["status"] = status
    return list(records.find(q, {"_id": 0}).sort("recorded_at", -1).limit(limit))


@router.post("")
async def add_record(body: RecordBody, user: dict = Depends(get_staff_or_above)):
    min_temp = _min_temp(body.raw_or_cooked)
    total_minutes = body.duration_hours * 60 + body.duration_minutes
    temp_pass = body.bath_temp >= min_temp
    time_pass = total_minutes > 0
    passed = temp_pass and time_pass
    now = datetime.now(timezone.utc).isoformat()
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
        "status": "active",
        "start_time": now,
        "recorded_at": now,
        "recorded_by": user.get("email", ""),
        "recorded_by_name": user.get("name", ""),
    }
    records.insert_one(dict(doc))
    return {k: v for k, v in doc.items() if k != "_id"}


@router.patch("/{record_id}/complete")
async def complete_record(record_id: str, body: CompleteBody, user: dict = Depends(get_staff_or_above)):
    rec = records.find_one({"id": record_id}, {"_id": 0})
    if not rec:
        raise HTTPException(404, "Not found")
    if rec.get("status") == "complete":
        raise HTTPException(400, "Already complete")
    update = {
        "status": "complete",
        "final_core_temp": body.final_core_temp,
        "served_or_cooled": body.served_or_cooled,
        "completion_comment": body.comment or "",
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "completed_by": user.get("email", ""),
        "completed_by_name": user.get("name", ""),
    }
    records.update_one({"id": record_id}, {"$set": update})
    return records.find_one({"id": record_id}, {"_id": 0})


@router.delete("/{record_id}")
async def delete_record(record_id: str, user: dict = Depends(get_staff_or_above)):
    res = records.delete_one({"id": record_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"deleted": True}
