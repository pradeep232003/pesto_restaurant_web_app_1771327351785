"""
Shift Management — schedule employees per site, per day.

Stores a flat list of shift documents; the UI groups them by location +
date range. Open/close times are HH:MM strings (24h); `hours` is derived
on read so we don't have to keep it in sync on every patch.

Admin gated (admin + super_admin) — staff can view their own shifts via
their account, but creating/editing requires manager privileges.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from db import db
from auth import get_admin_user, get_staff_or_above

router = APIRouter(prefix="/api/admin/shifts", tags=["shifts"])

shifts_collection = db["shifts"]
staff_collection = db["staff_members"]


def _hours_between(start: str, end: str) -> float:
    """Compute decimal hours between HH:MM strings. Handles overnight shifts
    by adding 24h when end < start."""
    try:
        sh, sm = (int(p) for p in start.split(":"))
        eh, em = (int(p) for p in end.split(":"))
        mins = (eh * 60 + em) - (sh * 60 + sm)
        if mins < 0:
            mins += 24 * 60
        return round(mins / 60.0, 2)
    except Exception:
        return 0.0


def _decorate(doc: dict) -> dict:
    """Strip Mongo internals + compute display fields."""
    out = {k: v for k, v in doc.items() if k != "_id"}
    if out.get("start_time") and out.get("end_time"):
        out["hours"] = _hours_between(out["start_time"], out["end_time"])
    return out


class ShiftBody(BaseModel):
    location_id: str
    staff_id: str
    date: str = Field(..., description="YYYY-MM-DD")
    start_time: str = Field(..., description="HH:MM 24h")
    end_time: str = Field(..., description="HH:MM 24h")
    role: str = ""
    notes: str = ""


class ShiftPatch(BaseModel):
    staff_id: Optional[str] = None
    date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    role: Optional[str] = None
    notes: Optional[str] = None


def _resolve_staff_name(staff_id: str) -> str:
    rec = staff_collection.find_one({"id": staff_id}, {"_id": 0, "name": 1})
    return (rec or {}).get("name") or "Unknown"


@router.get("")
async def list_shifts(
    location_id: str = Query(...),
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD inclusive"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD inclusive"),
    user: dict = Depends(get_staff_or_above),
):
    q: dict = {"location_id": location_id}
    if start_date or end_date:
        q["date"] = {}
        if start_date:
            q["date"]["$gte"] = start_date
        if end_date:
            q["date"]["$lte"] = end_date
    rows = list(shifts_collection.find(q, {"_id": 0}).sort([("date", 1), ("start_time", 1)]).limit(2000))
    return [_decorate(r) for r in rows]


@router.post("")
async def add_shift(body: ShiftBody, user: dict = Depends(get_admin_user)):
    doc = {
        "id": str(uuid.uuid4())[:12],
        "location_id": body.location_id,
        "staff_id": body.staff_id,
        "staff_name": _resolve_staff_name(body.staff_id),
        "date": body.date,
        "start_time": body.start_time,
        "end_time": body.end_time,
        "role": body.role,
        "notes": body.notes,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user.get("email", ""),
        "created_by_name": user.get("name", ""),
    }
    shifts_collection.insert_one(dict(doc))
    return _decorate(doc)


@router.patch("/{shift_id}")
async def update_shift(shift_id: str, body: ShiftPatch, user: dict = Depends(get_admin_user)):
    rec = shifts_collection.find_one({"id": shift_id}, {"_id": 0})
    if not rec:
        raise HTTPException(404, "Not found")
    update = {k: v for k, v in body.dict(exclude_unset=True).items() if v is not None}
    if "staff_id" in update:
        update["staff_name"] = _resolve_staff_name(update["staff_id"])
    if update:
        update["updated_at"] = datetime.now(timezone.utc).isoformat()
        update["updated_by"] = user.get("email", "")
        update["updated_by_name"] = user.get("name", "")
        shifts_collection.update_one({"id": shift_id}, {"$set": update})
    return _decorate(shifts_collection.find_one({"id": shift_id}, {"_id": 0}))


@router.delete("/{shift_id}")
async def delete_shift(shift_id: str, user: dict = Depends(get_admin_user)):
    res = shifts_collection.delete_one({"id": shift_id})
    if not res.deleted_count:
        raise HTTPException(404, "Not found")
    return {"deleted": True}
