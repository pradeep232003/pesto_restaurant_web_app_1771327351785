"""
Wastage logging — kitchen prep / in-service / general food.

Single collection `wastage_records` with a `type` discriminator so
all three (in_prep, in_service, food) share the same endpoints.
"""
import uuid
from datetime import datetime, timezone, timedelta
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from db import db
from auth import get_staff_or_above

router = APIRouter(prefix="/api/admin/wastage", tags=["wastage"])

records = db["wastage_records"]

WastageType = Literal["in_prep", "in_service", "food"]


class WastageBody(BaseModel):
    location_id: str
    type: WastageType = "in_prep"
    item_name: str
    item_category: str
    item_icon: Optional[str] = ""
    amount: float
    unit: str
    comment: Optional[str] = ""


@router.get("")
async def list_wastage(
    location_id: str = Query(...),
    type: WastageType = Query("in_prep"),
    limit: int = Query(50, le=200),
    user: dict = Depends(get_staff_or_above),
):
    return list(records.find({"location_id": location_id, "type": type}, {"_id": 0}).sort("recorded_at", -1).limit(limit))


@router.get("/summary")
async def summary(
    location_id: str = Query(...),
    type: WastageType = Query("in_prep"),
    user: dict = Depends(get_staff_or_above),
):
    """Today + last-7-days stats. `kg_today` normalises mass-ish units to kg."""
    now = datetime.now(timezone.utc)
    today = now.date().isoformat()
    week_ago = (now - timedelta(days=7)).isoformat()

    rows = list(records.find(
        {"location_id": location_id, "type": type, "recorded_at": {"$gte": week_ago}},
        {"_id": 0},
    ))

    def to_kg(amount: float, unit: str) -> Optional[float]:
        u = (unit or "").lower()
        if u == "kg":
            return amount
        if u == "g":
            return amount / 1000.0
        if u == "mg":
            return amount / 1_000_000.0
        if u == "lb":
            return amount * 0.453592
        if u == "oz":
            return amount * 0.0283495
        return None  # unknown / volume / count — excluded from kg total

    kg_today = 0.0
    count_today = 0
    for r in rows:
        if (r.get("recorded_at") or "").startswith(today):
            count_today += 1
            kg = to_kg(float(r.get("amount", 0)), r.get("unit", ""))
            if kg is not None:
                kg_today += kg
    return {"kg_today": round(kg_today, 2), "count_today": count_today, "count_7d": len(rows)}


@router.post("")
async def record_wastage(body: WastageBody, user: dict = Depends(get_staff_or_above)):
    if body.amount <= 0:
        raise HTTPException(400, "Amount must be positive")
    if not body.unit:
        raise HTTPException(400, "Unit is required")
    doc = {
        "id": str(uuid.uuid4())[:12],
        "location_id": body.location_id,
        "type": body.type,
        "item_name": body.item_name,
        "item_category": body.item_category,
        "item_icon": body.item_icon or "",
        "amount": body.amount,
        "unit": body.unit,
        "comment": body.comment or "",
        "recorded_at": datetime.now(timezone.utc).isoformat(),
        "recorded_by": user.get("email", ""),
        "recorded_by_name": user.get("name", ""),
    }
    records.insert_one(dict(doc))
    return {k: v for k, v in doc.items() if k != "_id"}


@router.delete("/{record_id}")
async def delete_wastage(record_id: str, user: dict = Depends(get_staff_or_above)):
    res = records.delete_one({"id": record_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"deleted": True}
