"""
Reheating temperature log — UK FSA requires reheated food to reach ≥ 75°C.

Reuses the cooking_cooling catalog endpoint for item selection (same items
appear under "Reheating"). Records are simple: item + reheat-temp + optional
comment.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from db import db
from auth import get_staff_or_above

router = APIRouter(prefix="/api/admin/reheating", tags=["reheating"])

logs = db["reheating_logs"]

TARGET_C = 75.0  # FSA minimum reheat temperature


class RecordBody(BaseModel):
    location_id: str
    item_name: str
    item_category: str
    temp_c: float
    comment: Optional[str] = ""


@router.get("")
async def list_today(
    location_id: str = Query(...),
    limit: int = Query(50, le=200),
    user: dict = Depends(get_staff_or_above),
):
    items = list(logs.find({"location_id": location_id}, {"_id": 0}).sort("recorded_at", -1).limit(limit))
    return items


@router.post("")
async def record(body: RecordBody, user: dict = Depends(get_staff_or_above)):
    doc = {
        "id": str(uuid.uuid4())[:12],
        "location_id": body.location_id,
        "item_name": body.item_name,
        "item_category": body.item_category,
        "temp_c": body.temp_c,
        "target_temp_c": TARGET_C,
        "passed": body.temp_c >= TARGET_C,
        "comment": body.comment or "",
        "recorded_at": datetime.now(timezone.utc).isoformat(),
        "recorded_by": user.get("email", ""),
        "recorded_by_name": user.get("name", ""),
    }
    logs.insert_one(dict(doc))
    return {k: v for k, v in doc.items() if k != "_id"}


@router.delete("/{log_id}")
async def delete(log_id: str, user: dict = Depends(get_staff_or_above)):
    res = logs.delete_one({"id": log_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"deleted": True}
