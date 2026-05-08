"""
JKHive Inventory — track stock per location with per-batch metadata.

Two collections:
  inventory_items   — one doc per (location_id, item_name) holding rolling current_amount + unit
  inventory_batches — one doc per goods-in batch (links delivery_id, supplier, batch_no, use_by)

Stock writes are append-only via /stock; the parent item's current_amount is incremented
on each batch insert. FIFO ordering is enforced at read time via use_by ascending sort
(items without a use_by date sort to the end).
"""
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from db import db
from auth import get_staff_or_above

router = APIRouter(prefix="/api/admin/inventory", tags=["inventory"])

items_collection = db["inventory_items"]
batches_collection = db["inventory_batches"]


class StockBody(BaseModel):
    location_id: str
    item_name: str
    item_category: str
    item_icon: Optional[str] = None
    unit: str
    amount: float
    price_per_unit: Optional[float] = None
    batch_no: Optional[str] = ""
    use_by: Optional[str] = ""           # ISO date string (yyyy-mm-dd)
    supplier_id: Optional[str] = ""
    supplier_name: Optional[str] = ""
    delivery_id: Optional[str] = ""


def _key(item_name: str) -> str:
    return item_name.strip().lower()


@router.post("/stock")
async def add_stock(body: StockBody, user: dict = Depends(get_staff_or_above)):
    if body.amount <= 0:
        raise HTTPException(400, "Amount must be positive")
    if not body.unit:
        raise HTTPException(400, "Unit is required")
    if not body.item_name.strip():
        raise HTTPException(400, "Item name is required")

    item_key = _key(body.item_name)
    now = datetime.now(timezone.utc).isoformat()

    # Upsert the parent item, accumulating amount only when units match.
    existing = items_collection.find_one({"location_id": body.location_id, "item_key": item_key}, {"_id": 0})
    if existing:
        # If unit changes, we keep the new unit + reset rolling amount to this batch.
        # (Mixing units in a single rolling total would be wrong.)
        if existing.get("unit") == body.unit:
            new_amount = float(existing.get("current_amount", 0)) + body.amount
        else:
            new_amount = body.amount
        items_collection.update_one(
            {"location_id": body.location_id, "item_key": item_key},
            {"$set": {
                "current_amount": new_amount,
                "unit": body.unit,
                "item_category": body.item_category,
                "item_icon": body.item_icon or existing.get("item_icon"),
                "updated_at": now,
            }},
        )
        item_id = existing["id"]
    else:
        item_id = str(uuid.uuid4())[:12]
        items_collection.insert_one({
            "id": item_id,
            "location_id": body.location_id,
            "item_key": item_key,
            "item_name": body.item_name.strip(),
            "item_category": body.item_category,
            "item_icon": body.item_icon or "",
            "unit": body.unit,
            "current_amount": body.amount,
            "created_at": now,
            "updated_at": now,
        })

    batch_id = str(uuid.uuid4())[:12]
    batch = {
        "id": batch_id,
        "item_id": item_id,
        "item_key": item_key,
        "item_name": body.item_name.strip(),
        "item_category": body.item_category,
        "item_icon": body.item_icon or "",
        "location_id": body.location_id,
        "unit": body.unit,
        "amount": body.amount,
        "price_per_unit": body.price_per_unit,
        "batch_no": (body.batch_no or "").strip(),
        "use_by": (body.use_by or "").strip(),
        "supplier_id": body.supplier_id or "",
        "supplier_name": body.supplier_name or "",
        "delivery_id": body.delivery_id or "",
        "added_at": now,
        "added_by": user.get("email", ""),
        "added_by_name": user.get("name", ""),
    }
    batches_collection.insert_one(dict(batch))
    return {"item_id": item_id, "batch": {k: v for k, v in batch.items() if k != "_id"}}


@router.get("")
async def list_inventory(location_id: str = Query(...), user: dict = Depends(get_staff_or_above)):
    out = list(items_collection.find({"location_id": location_id}, {"_id": 0}).sort("item_name", 1))
    return out


@router.get("/batches")
async def list_batches(
    location_id: str = Query(...),
    item_id: Optional[str] = Query(None),
    delivery_id: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    user: dict = Depends(get_staff_or_above),
):
    q = {"location_id": location_id}
    if item_id:
        q["item_id"] = item_id
    if delivery_id:
        q["delivery_id"] = delivery_id
    # FIFO: use_by ascending, blanks last (we sort blanks to bottom by remapping).
    rows = list(batches_collection.find(q, {"_id": 0}).limit(limit))
    rows.sort(key=lambda r: (r.get("use_by") or "9999-12-31", r.get("added_at") or ""))
    return rows


@router.delete("/batches/{batch_id}")
async def delete_batch(batch_id: str, user: dict = Depends(get_staff_or_above)):
    """Remove a single batch (e.g. mistaken entry). Decrements parent item amount."""
    b = batches_collection.find_one({"id": batch_id}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Batch not found")
    parent = items_collection.find_one({"id": b["item_id"]}, {"_id": 0})
    if parent and parent.get("unit") == b.get("unit"):
        new_amount = max(0.0, float(parent.get("current_amount", 0)) - float(b.get("amount", 0)))
        items_collection.update_one(
            {"id": b["item_id"]},
            {"$set": {"current_amount": new_amount, "updated_at": datetime.now(timezone.utc).isoformat()}},
        )
    batches_collection.delete_one({"id": batch_id})
    return {"deleted": True}
