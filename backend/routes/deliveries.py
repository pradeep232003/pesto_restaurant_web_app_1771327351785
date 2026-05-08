"""
Goods-in / Deliveries log:
  • Suppliers per location (CRUD, admin-managed)
  • Delivery records: supplier × ingredient × temp + comment

Reuses the cooking_cooling catalog endpoint for ingredient picking.
"""
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from db import db
from auth import get_staff_or_above

router = APIRouter(prefix="/api/admin/deliveries", tags=["deliveries"])

suppliers = db["delivery_suppliers"]
records = db["delivery_records"]

SupplierType = Literal["general", "fishmonger", "butcher", "greengrocer",
                       "bakery", "wine merchant", "alcohol supplier", "other"]


# ============== MODELS ==============

class SupplierBody(BaseModel):
    location_id: str
    name: str
    type: SupplierType = "general"
    info: Optional[str] = ""


class RecordBody(BaseModel):
    location_id: str
    supplier_id: str
    item_name: str
    item_category: str
    temp_c: float
    comment: Optional[str] = ""


# ============== SUPPLIERS ==============

@router.get("/suppliers")
async def list_suppliers(location_id: str = Query(...), user: dict = Depends(get_staff_or_above)):
    return list(suppliers.find({"location_id": location_id}, {"_id": 0}).sort("name", 1))


@router.post("/suppliers")
async def add_supplier(body: SupplierBody, user: dict = Depends(get_staff_or_above)):
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "Name required")
    doc = {
        "id": str(uuid.uuid4())[:12],
        "location_id": body.location_id,
        "name": name,
        "type": body.type,
        "info": body.info or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user.get("email", ""),
    }
    suppliers.insert_one(dict(doc))
    return {k: v for k, v in doc.items() if k != "_id"}


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


@router.delete("/{record_id}")
async def delete_record(record_id: str, user: dict = Depends(get_staff_or_above)):
    res = records.delete_one({"id": record_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"deleted": True}
