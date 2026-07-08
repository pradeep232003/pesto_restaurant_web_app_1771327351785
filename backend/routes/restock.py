"""
Restock — per-location shopping list of items running short.

Any staff member (or admin) can add items to their location's list; the
manager on shift ticks items off as they get bought or otherwise
sorted. Admins can also delete items outright. The tile lives under
Intelligence → Operate in the JKHive app.

Collection: `restock_items`
  { id, location_id, item, quantity, note,
    added_by, added_by_name, added_at,
    status: 'open' | 'done',
    done_by, done_by_name, done_at }
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from db import db
from auth import get_staff_or_above, get_admin_user

_log = logging.getLogger("restock")
router = APIRouter(prefix="/api/restock", tags=["restock"])

restock = db["restock_items"]
try:
    restock.create_index([("location_id", 1), ("status", 1), ("added_at", -1)])
except Exception:
    pass


class RestockCreate(BaseModel):
    location_id: str = Field(..., min_length=1)
    item: str = Field(..., min_length=1, max_length=200)
    quantity: Optional[str] = Field(None, max_length=80)
    note: Optional[str] = Field(None, max_length=500)


class RestockUpdate(BaseModel):
    item: Optional[str] = Field(None, max_length=200)
    quantity: Optional[str] = Field(None, max_length=80)
    note: Optional[str] = Field(None, max_length=500)
    status: Optional[Literal["open", "done"]] = None


def _clean(doc: dict) -> dict:
    if not doc:
        return doc
    doc.pop("_id", None)
    return doc


@router.get("")
async def list_items(
    location_id: str = Query(...),
    status: Literal["open", "done", "all"] = "open",
    user: dict = Depends(get_staff_or_above),
):
    q: dict = {"location_id": location_id}
    if status != "all":
        q["status"] = status
    rows = list(restock.find(q).sort([("status", 1), ("added_at", -1)]).limit(500))
    return {"items": [_clean(r) for r in rows]}


@router.post("")
async def create_item(
    payload: RestockCreate,
    user: dict = Depends(get_staff_or_above),
):
    now_iso = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "location_id": payload.location_id.strip(),
        "item": payload.item.strip(),
        "quantity": (payload.quantity or "").strip(),
        "note": (payload.note or "").strip(),
        "added_by": user.get("email", ""),
        "added_by_name": user.get("name") or user.get("email", ""),
        "added_at": now_iso,
        "status": "open",
    }
    restock.insert_one(doc)
    _log.info("restock: added item=%r qty=%r loc=%s by=%s",
              doc["item"], doc["quantity"], doc["location_id"], doc["added_by"])
    return _clean(doc)


@router.patch("/{item_id}")
async def update_item(
    item_id: str,
    payload: RestockUpdate,
    user: dict = Depends(get_staff_or_above),
):
    existing = restock.find_one({"id": item_id})
    if not existing:
        raise HTTPException(404, "Item not found")

    updates: dict = {}
    if payload.item is not None:
        updates["item"] = payload.item.strip()
    if payload.quantity is not None:
        updates["quantity"] = payload.quantity.strip()
    if payload.note is not None:
        updates["note"] = payload.note.strip()
    if payload.status is not None:
        updates["status"] = payload.status
        if payload.status == "done":
            updates["done_at"] = datetime.now(timezone.utc).isoformat()
            updates["done_by"] = user.get("email", "")
            updates["done_by_name"] = user.get("name") or user.get("email", "")
        else:
            # Re-opening — wipe the done metadata so the audit trail is clean.
            updates["done_at"] = ""
            updates["done_by"] = ""
            updates["done_by_name"] = ""

    if not updates:
        return _clean(existing)

    restock.update_one({"id": item_id}, {"$set": updates})
    _log.info("restock: patched id=%s fields=%s by=%s",
              item_id, list(updates.keys()), user.get("email"))
    return _clean(restock.find_one({"id": item_id}))


@router.delete("/{item_id}")
async def delete_item(
    item_id: str,
    user: dict = Depends(get_admin_user),
):
    """Only admins can delete an item outright — staff should mark
    items done instead so the audit trail is preserved.
    """
    res = restock.delete_one({"id": item_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Item not found")
    _log.info("restock: deleted id=%s by=%s", item_id, user.get("email"))
    return {"deleted": True}


@router.post("/{item_id}/reopen")
async def reopen_item(
    item_id: str,
    user: dict = Depends(get_staff_or_above),
):
    """Convenience — flips a `done` item back to `open` without needing
    a body. Useful for accidental ticks."""
    existing = restock.find_one({"id": item_id})
    if not existing:
        raise HTTPException(404, "Item not found")
    restock.update_one({"id": item_id}, {"$set": {
        "status": "open",
        "done_at": "",
        "done_by": "",
        "done_by_name": "",
    }})
    _log.info("restock: reopened id=%s by=%s", item_id, user.get("email"))
    return _clean(restock.find_one({"id": item_id}))


@router.get("/summary")
async def summary(
    location_ids: Optional[str] = Query(None, description="comma-separated"),
    user: dict = Depends(get_staff_or_above),
):
    """Cross-site open-count for the dashboard badge."""
    q: dict = {"status": "open"}
    if location_ids:
        ids = [x.strip() for x in location_ids.split(",") if x.strip()]
        if ids:
            q["location_id"] = {"$in": ids}
    pipeline: List[dict] = [
        {"$match": q},
        {"$group": {"_id": "$location_id", "open": {"$sum": 1}}},
    ]
    out = {r["_id"]: r["open"] for r in restock.aggregate(pipeline)}
    return {"by_location": out, "total_open": sum(out.values())}
