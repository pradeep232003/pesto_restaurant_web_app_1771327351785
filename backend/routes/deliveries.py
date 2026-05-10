"""
Goods-in / Deliveries log:
  • Suppliers (CRUD, admin-managed) — each supplier is scoped to one or more
    site IDs via a `sites` array. An empty `sites` array means the supplier
    is global (visible at every location).
  • Delivery records: supplier × ingredient × temp + comment.

Reuses the cooking_cooling catalog endpoint for ingredient picking.
"""
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from db import db
from auth import get_staff_or_above

router = APIRouter(prefix="/api/admin/deliveries", tags=["deliveries"])

suppliers = db["delivery_suppliers"]
records = db["delivery_records"]

SupplierType = Literal["general", "fishmonger", "butcher", "greengrocer",
                       "bakery", "wine merchant", "alcohol supplier", "other"]


# ============== MODELS ==============

class SupplierBody(BaseModel):
    name: str
    type: SupplierType = "general"
    info: Optional[str] = ""
    # Empty list = global (visible at every site).
    sites: List[str] = Field(default_factory=list)


class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[SupplierType] = None
    info: Optional[str] = None
    sites: Optional[List[str]] = None


class RecordBody(BaseModel):
    location_id: str
    supplier_id: str
    item_name: str
    item_category: str
    temp_c: float
    comment: Optional[str] = ""


class NoDeliveryBody(BaseModel):
    location_id: str
    comment: Optional[str] = ""


def _migrate(doc: dict) -> dict:
    """Back-compat: legacy suppliers had a single `location_id`. Convert to sites array on read."""
    if "sites" not in doc:
        loc = doc.get("location_id")
        doc["sites"] = [loc] if loc else []
    return doc


# ============== SUPPLIERS ==============

@router.get("/suppliers")
async def list_suppliers(
    location_id: str = Query(...),
    user: dict = Depends(get_staff_or_above),
):
    """List suppliers visible at the given location.
    A supplier is visible if its sites array is empty (global) or includes location_id.
    Also includes legacy suppliers that still carry the old `location_id` field.
    """
    cursor = suppliers.find({
        "$or": [
            {"sites": {"$in": [location_id]}},
            {"sites": {"$size": 0}},
            {"sites": {"$exists": False}, "location_id": location_id},
        ]
    }, {"_id": 0}).sort("name", 1)
    return [_migrate(dict(d)) for d in cursor]


@router.post("/suppliers")
async def add_supplier(body: SupplierBody, user: dict = Depends(get_staff_or_above)):
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "Name required")
    doc = {
        "id": str(uuid.uuid4())[:12],
        "name": name,
        "type": body.type,
        "info": body.info or "",
        "sites": body.sites or [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user.get("email", ""),
    }
    suppliers.insert_one(dict(doc))
    return {k: v for k, v in doc.items() if k != "_id"}


@router.patch("/suppliers/{supplier_id}")
async def update_supplier(supplier_id: str, body: SupplierUpdate, user: dict = Depends(get_staff_or_above)):
    existing = suppliers.find_one({"id": supplier_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Not found")
    update = {}
    if body.name is not None:
        n = body.name.strip()
        if not n:
            raise HTTPException(400, "Name cannot be empty")
        update["name"] = n
    if body.type is not None:
        update["type"] = body.type
    if body.info is not None:
        update["info"] = body.info
    if body.sites is not None:
        update["sites"] = body.sites
    if update:
        update["updated_at"] = datetime.now(timezone.utc).isoformat()
        suppliers.update_one({"id": supplier_id}, {"$set": update})
    fresh = suppliers.find_one({"id": supplier_id}, {"_id": 0})
    return _migrate(dict(fresh))


@router.delete("/suppliers/{supplier_id}")
async def delete_supplier(supplier_id: str, user: dict = Depends(get_staff_or_above)):
    res = suppliers.delete_one({"id": supplier_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"deleted": True}


# ============== DELIVERY RECORDS ==============

@router.get("")
async def list_records(location_id: str = Query(...), limit: int = Query(50, le=200),
                       user: dict = Depends(get_staff_or_above)):
    return list(records.find({"location_id": location_id}, {"_id": 0}).sort("recorded_at", -1).limit(limit))


@router.post("")
async def record_delivery(body: RecordBody, user: dict = Depends(get_staff_or_above)):
    sup = suppliers.find_one({"id": body.supplier_id}, {"_id": 0})
    chilled_pass = body.temp_c <= 8
    frozen_pass = body.temp_c <= -18
    doc = {
        "id": str(uuid.uuid4())[:12],
        "location_id": body.location_id,
        "kind": "delivery",
        "supplier_id": body.supplier_id,
        "supplier_name": (sup or {}).get("name", "Unknown"),
        "item_name": body.item_name,
        "item_category": body.item_category,
        "temp_c": body.temp_c,
        "chilled_pass": chilled_pass,
        "frozen_pass": frozen_pass,
        "comment": body.comment or "",
        "recorded_at": datetime.now(timezone.utc).isoformat(),
        "recorded_by": user.get("email", ""),
        "recorded_by_name": user.get("name", ""),
    }
    records.insert_one(dict(doc))
    return {k: v for k, v in doc.items() if k != "_id"}


@router.post("/no-delivery")
async def record_no_delivery(body: NoDeliveryBody, user: dict = Depends(get_staff_or_above)):
    """Log that no goods-in delivery was received today (HACCP audit trail).

    Idempotent per location per day — returns the existing record if one already
    exists for today rather than creating a duplicate.
    """
    today_str = datetime.now(timezone.utc).date().isoformat()
    existing = records.find_one({
        "location_id": body.location_id,
        "kind": "no_delivery",
        "recorded_at": {"$gte": today_str + "T00:00:00", "$lt": today_str + "T23:59:59"},
    }, {"_id": 0})
    if existing:
        return existing
    doc = {
        "id": str(uuid.uuid4())[:12],
        "location_id": body.location_id,
        "kind": "no_delivery",
        "supplier_id": "",
        "supplier_name": "—",
        "item_name": "No deliveries received",
        "item_category": "",
        "temp_c": None,
        "chilled_pass": None,
        "frozen_pass": None,
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
