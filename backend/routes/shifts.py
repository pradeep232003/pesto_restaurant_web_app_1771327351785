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
    # Non-admin staff users only see their own *published* shifts. Drafts
    # are management-only. Email match is case-insensitive.
    role = user.get("role", "")
    is_staff_only = role not in ("admin", "super_admin")
    if is_staff_only:
        email = (user.get("email") or "").strip().lower()
        if not email:
            return []
        rec = staff_collection.find_one({"account_email": email}, {"_id": 0, "id": 1})
        if not rec:
            return []
        q["staff_id"] = rec["id"]
        q["published"] = True
    if start_date or end_date:
        q["date"] = {}
        if start_date:
            q["date"]["$gte"] = start_date
        if end_date:
            q["date"]["$lte"] = end_date
    rows = list(shifts_collection.find(q, {"_id": 0}).sort([("date", 1), ("start_time", 1)]).limit(2000))
    return [_decorate(r) for r in rows]


class PublishWeekBody(BaseModel):
    location_id: str
    start_date: str  # YYYY-MM-DD inclusive
    end_date: str    # YYYY-MM-DD inclusive
    notify: bool = True


@router.post("/publish-week")
async def publish_week(body: PublishWeekBody, user: dict = Depends(get_admin_user)):
    """Mark every draft shift in the range as published, and (optionally)
    fire a push notification to each affected staff member's subscribed
    devices. Already-published shifts are left untouched."""
    res = shifts_collection.update_many(
        {
            "location_id": body.location_id,
            "date": {"$gte": body.start_date, "$lte": body.end_date},
            "published": {"$ne": True},
        },
        {"$set": {
            "published": True,
            "published_at": datetime.now(timezone.utc).isoformat(),
            "published_by": user.get("email", ""),
            "published_by_name": user.get("name", ""),
        }},
    )
    published_count = res.modified_count

    notified = 0
    if body.notify and published_count:
        # Group newly-published shifts by staff_id so each person gets one
        # push, not one per shift. We re-query the freshly-flagged rows.
        rows = list(shifts_collection.find(
            {
                "location_id": body.location_id,
                "date": {"$gte": body.start_date, "$lte": body.end_date},
                "published_at": {"$exists": True},
            },
            {"_id": 0, "staff_id": 1, "date": 1, "start_time": 1, "end_time": 1, "staff_name": 1},
        ))
        per_staff: dict = {}
        for r in rows:
            per_staff.setdefault(r.get("staff_id", ""), []).append(r)

        from routes.push import send_push_to_user
        for staff_id, shifts in per_staff.items():
            staff_rec = staff_collection.find_one(
                {"id": staff_id}, {"_id": 0, "account_email": 1, "name": 1},
            )
            if not staff_rec or not staff_rec.get("account_email"):
                continue
            count = len(shifts)
            first = min(shifts, key=lambda s: s.get("date", "9999"))
            body_text = (
                f"{count} shift{'s' if count != 1 else ''} published. "
                f"First: {first.get('date')} {first.get('start_time')}–{first.get('end_time')}."
            )
            if send_push_to_user(staff_rec["account_email"], {
                "title": "New rota published",
                "body": body_text,
                "tag": f"shift-publish-{body.start_date}",
                "url": "/jkhive/shifts",
            }):
                notified += 1

    return {"published": published_count, "notified": notified}


class CopyWeekBody(BaseModel):
    location_id: str
    source_start: str  # YYYY-MM-DD (Monday)
    target_start: str  # YYYY-MM-DD (Monday)
    overwrite: bool = False  # if True, wipe target week first


@router.post("/copy-week")
async def copy_week(body: CopyWeekBody, user: dict = Depends(get_admin_user)):
    """Duplicate every shift from a source week into a target week.
    Hugely useful when next week's rota is identical to last week's."""
    from datetime import date as _date, timedelta as _td

    try:
        src_start = _date.fromisoformat(body.source_start)
        tgt_start = _date.fromisoformat(body.target_start)
    except ValueError:
        raise HTTPException(400, "source_start and target_start must be YYYY-MM-DD")

    src_end = (src_start + _td(days=6)).isoformat()
    tgt_end = (tgt_start + _td(days=6)).isoformat()
    src_start_iso = src_start.isoformat()
    tgt_start_iso = tgt_start.isoformat()

    src_rows = list(shifts_collection.find(
        {"location_id": body.location_id, "date": {"$gte": src_start_iso, "$lte": src_end}},
        {"_id": 0},
    ))
    if not src_rows:
        return {"copied": 0, "skipped": 0, "message": "No source shifts found"}

    if body.overwrite:
        shifts_collection.delete_many({
            "location_id": body.location_id,
            "date": {"$gte": tgt_start_iso, "$lte": tgt_end},
        })

    day_delta = (tgt_start - src_start).days
    inserted: list = []
    skipped = 0
    for r in src_rows:
        try:
            new_date = (_date.fromisoformat(r["date"]) + _td(days=day_delta)).isoformat()
        except Exception:
            skipped += 1
            continue
        # Skip if a shift already exists for the same staff+date+start_time.
        clash = shifts_collection.find_one({
            "location_id": body.location_id,
            "staff_id": r.get("staff_id"),
            "date": new_date,
            "start_time": r.get("start_time"),
        })
        if clash and not body.overwrite:
            skipped += 1
            continue
        doc = {
            "id": str(uuid.uuid4())[:12],
            "location_id": body.location_id,
            "staff_id": r.get("staff_id", ""),
            "staff_name": r.get("staff_name", ""),
            "date": new_date,
            "start_time": r.get("start_time", ""),
            "end_time": r.get("end_time", ""),
            "role": r.get("role", ""),
            "notes": r.get("notes", ""),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": user.get("email", ""),
            "created_by_name": user.get("name", ""),
            "copied_from": r.get("id"),
        }
        inserted.append(doc)
    if inserted:
        shifts_collection.insert_many([dict(d) for d in inserted])
    return {"copied": len(inserted), "skipped": skipped}


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
        # New shifts start as drafts so the manager can edit freely before
        # alerting staff. They become visible to staff only after Publish.
        "published": False,
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
        # Any edit reverts the shift to "draft" so the manager has a chance
        # to re-review before notifying staff of the change.
        update.setdefault("published", False)
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
