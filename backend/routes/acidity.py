"""
Food Acidity (pH) — JKHive specialist routine.

Records pH readings for acidified foods (pickles, ferments, dressings).
UK FSA acidified-foods rule: pH ≤ 4.6 inhibits Clostridium botulinum.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from db import db
from auth import get_staff_or_above

router = APIRouter(prefix="/api/admin/acidity", tags=["acidity"])

records = db["acidity_records"]

PH_TARGET = 4.6


class RecordBody(BaseModel):
    location_id: str
    item_name: str
    item_category: str
    item_icon: Optional[str] = ""
    ph_value: float
    target_ph: Optional[float] = PH_TARGET
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
    target = body.target_ph if body.target_ph is not None else PH_TARGET
    passed = body.ph_value <= target
    doc = {
        "id": str(uuid.uuid4())[:12],
        "location_id": body.location_id,
        "item_name": body.item_name,
        "item_category": body.item_category,
        "item_icon": body.item_icon or "",
        "ph_value": body.ph_value,
        "target_ph": target,
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
