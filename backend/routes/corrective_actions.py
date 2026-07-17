"""
Corrective Actions Log — per-location record of failed checks and the
remedial action taken. Read-only for staff, editable by admins.

Rooted at `/api/corrective-actions`. Collection: `corrective_actions`.
Doc shape:
  {
    id, location_id, category, item, failure_description,
    corrective_action, status: 'open' | 'resolved',
    logged_by, logged_by_name, logged_at,
    resolved_by, resolved_by_name, resolved_at,
    updated_at
  }
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from db import db
from auth import get_admin_user, get_staff_or_above

_log = logging.getLogger("corrective_actions")
router = APIRouter(prefix="/api/corrective-actions", tags=["corrective-actions"])

col = db["corrective_actions"]
try:
    col.create_index([("location_id", 1), ("status", 1), ("logged_at", -1)])
except Exception:
    pass


# Categories mirror the JKHive routine catalog so managers can filter
# corrective actions by the check that triggered them.
CATEGORIES = [
    "opening", "closing", "fridge_temp", "freezer_temp",
    "cooking_cooling", "reheating", "delivery", "cleaning",
    "checklist", "probe", "hygiene", "waste", "other",
]


class ActionCreate(BaseModel):
    location_id: str = Field(..., min_length=1)
    category: str = Field(..., min_length=1)
    item: str = Field("", max_length=200)
    failure_description: str = Field(..., min_length=1, max_length=1000)
    corrective_action: str = Field("", max_length=1000)
    status: Literal["open", "resolved"] = "open"


class ActionUpdate(BaseModel):
    category: Optional[str] = None
    item: Optional[str] = None
    failure_description: Optional[str] = Field(None, max_length=1000)
    corrective_action: Optional[str] = Field(None, max_length=1000)
    status: Optional[Literal["open", "resolved"]] = None


def _clean(doc: dict) -> dict:
    if not doc:
        return doc
    doc.pop("_id", None)
    return doc


@router.get("")
async def list_actions(
    location_id: str = Query(..., description="Site id — or 'all' for admin cross-site"),
    status: Literal["open", "resolved", "all"] = "all",
    limit: int = Query(500, ge=1, le=2000),
    user: dict = Depends(get_staff_or_above),
):
    """List corrective actions. Staff and above can read. Admins get an
    `'all'` shortcut for cross-site views."""
    is_admin = user.get("role") in ("admin", "super_admin")
    q: dict = {}
    if location_id and location_id != "all":
        q["location_id"] = location_id
    else:
        if not is_admin:
            raise HTTPException(400, "location_id is required for non-admin users")
    if status != "all":
        q["status"] = status
    rows = list(col.find(q).sort([("status", 1), ("logged_at", -1)]).limit(limit))
    return {"items": [_clean(r) for r in rows], "categories": CATEGORIES}


@router.post("")
async def create_action(
    payload: ActionCreate,
    user: dict = Depends(get_admin_user),
):
    """Admin-only create. Staff read but cannot mutate."""
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "location_id": payload.location_id.strip(),
        "category": payload.category.strip().lower() or "other",
        "item": payload.item.strip(),
        "failure_description": payload.failure_description.strip(),
        "corrective_action": payload.corrective_action.strip(),
        "status": payload.status,
        "logged_by": user.get("email", ""),
        "logged_by_name": user.get("name") or user.get("email", ""),
        "logged_at": now,
        "resolved_by": "",
        "resolved_by_name": "",
        "resolved_at": "",
        "updated_at": now,
    }
    # If it was raised as already-resolved, stamp the resolver metadata.
    if doc["status"] == "resolved":
        doc["resolved_by"] = user.get("email", "")
        doc["resolved_by_name"] = user.get("name") or user.get("email", "")
        doc["resolved_at"] = now

    col.insert_one(doc)
    _log.info("corrective_action: created id=%s category=%s status=%s loc=%s by=%s",
              doc["id"], doc["category"], doc["status"], doc["location_id"], doc["logged_by"])
    return _clean(doc)


@router.patch("/{action_id}")
async def update_action(
    action_id: str,
    payload: ActionUpdate,
    user: dict = Depends(get_admin_user),
):
    existing = col.find_one({"id": action_id})
    if not existing:
        raise HTTPException(404, "Not found")

    updates: dict = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if payload.category is not None:
        updates["category"] = payload.category.strip().lower() or "other"
    if payload.item is not None:
        updates["item"] = payload.item.strip()
    if payload.failure_description is not None:
        updates["failure_description"] = payload.failure_description.strip()
    if payload.corrective_action is not None:
        updates["corrective_action"] = payload.corrective_action.strip()
    if payload.status is not None and payload.status != existing.get("status"):
        updates["status"] = payload.status
        if payload.status == "resolved":
            updates["resolved_at"] = datetime.now(timezone.utc).isoformat()
            updates["resolved_by"] = user.get("email", "")
            updates["resolved_by_name"] = user.get("name") or user.get("email", "")
        else:
            # Re-opened — wipe resolver so the audit trail is honest.
            updates["resolved_at"] = ""
            updates["resolved_by"] = ""
            updates["resolved_by_name"] = ""

    col.update_one({"id": action_id}, {"$set": updates})
    _log.info("corrective_action: patched id=%s fields=%s by=%s",
              action_id, list(updates.keys()), user.get("email"))
    return _clean(col.find_one({"id": action_id}))


@router.delete("/{action_id}")
async def delete_action(
    action_id: str,
    user: dict = Depends(get_admin_user),
):
    res = col.delete_one({"id": action_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    _log.info("corrective_action: deleted id=%s by=%s", action_id, user.get("email"))
    return {"deleted": True}


@router.get("/summary")
async def summary(
    location_ids: Optional[str] = Query(None),
    user: dict = Depends(get_staff_or_above),
):
    """Cross-site open-count for dashboard badges."""
    q: dict = {"status": "open"}
    if location_ids:
        ids = [x.strip() for x in location_ids.split(",") if x.strip()]
        if ids:
            q["location_id"] = {"$in": ids}
    pipeline: List[dict] = [
        {"$match": q},
        {"$group": {"_id": "$location_id", "open": {"$sum": 1}}},
    ]
    out = {r["_id"]: r["open"] for r in col.aggregate(pipeline)}
    return {"by_location": out, "total_open": sum(out.values())}
