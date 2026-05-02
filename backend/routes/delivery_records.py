from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timezone
from db import db
from auth import get_staff_or_above, get_admin_user
from pydantic import BaseModel, Field
from typing import Optional
import uuid

router = APIRouter(prefix="/api/admin/delivery-records", tags=["delivery-records"])
collection = db["delivery_records"]


class EntryCreate(BaseModel):
    location_id: str
    date: str  # YYYY-MM-DD
    supplier: str = Field(..., min_length=1, max_length=200)
    invoice_number: Optional[str] = ""
    food_frozen_temp: Optional[float] = None
    food_chilled_temp: Optional[float] = None
    quality_comments: Optional[str] = ""


@router.post("")
async def create_entry(body: EntryCreate, user: dict = Depends(get_staff_or_above)):
    # A delivery is acceptable if frozen <= -15 and chilled <= +8 (food-safety defaults);
    # if either temp provided and out of range, flag as failed.
    passed = True
    if body.food_frozen_temp is not None and body.food_frozen_temp > -15:
        passed = False
    if body.food_chilled_temp is not None and body.food_chilled_temp > 8:
        passed = False

    doc = {
        "id": str(uuid.uuid4())[:12],
        "location_id": body.location_id,
        "date": body.date,
        "supplier": body.supplier.strip(),
        "invoice_number": (body.invoice_number or "").strip(),
        "food_frozen_temp": body.food_frozen_temp,
        "food_chilled_temp": body.food_chilled_temp,
        "quality_comments": (body.quality_comments or "").strip(),
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
