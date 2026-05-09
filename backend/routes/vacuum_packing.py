"""
Vacuum Packing — JKHive specialist routine.

Records core temp at packing + use-by date for vacuum-sealed batches.
UK FSA: chilled product must be ≤ 5°C at point of pack to keep MAP/sous-vide
shelf life predictions valid.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from db import db
from auth import get_staff_or_above

router = APIRouter(prefix="/api/admin/vacuum-packing", tags=["vacuum-packing"])

records = db["vacuum_records"]

PACK_TEMP_MAX = 5.0


class RecordBody(BaseModel):
    location_id: str
    item_name: str
    item_category: str
    item_icon: Optional[str] = ""
    pack_temp: float
    use_by_date: str    # YYYY-MM-DD
    batch_label: Optional[str] = ""
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
    if not body.use_by_date.strip():
        raise HTTPException(400, "use_by_date is required")
    temp_pass = body.pack_temp <= PACK_TEMP_MAX
    passed = temp_pass and bool(body.use_by_date.strip())
    doc = {
        "id": str(uuid.uuid4())[:12],
        "location_id": body.location_id,
        "item_name": body.item_name,
        "item_category": body.item_category,
        "item_icon": body.item_icon or "",
        "pack_temp": body.pack_temp,
        "use_by_date": body.use_by_date.strip(),
        "batch_label": body.batch_label or "",
        "temp_pass": temp_pass,
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
