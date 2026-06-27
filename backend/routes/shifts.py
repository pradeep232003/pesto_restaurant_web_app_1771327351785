"""
Shift Management — schedule employees per site, per day.

Stores a flat list of shift documents; the UI groups them by location +
date range. Open/close times are HH:MM strings (24h); `hours` is derived
on read so we don't have to keep it in sync on every patch.

Admin gated (admin + super_admin) — staff can view their own shifts via
their account, but creating/editing requires manager privileges.
"""
import json
import uuid
from datetime import datetime, timezone, date as _date, timedelta as _td
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from db import db
from auth import get_admin_user, get_staff_or_above

router = APIRouter(prefix="/api/admin/shifts", tags=["shifts"])

shifts_collection = db["shifts"]
staff_collection = db["staff_members"]
daily_sales_collection = db["daily_sales"]


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



# ---------------------------------------------------------------------------
# AI-assisted rota suggestion
# ---------------------------------------------------------------------------
# Generates a draft week's worth of shifts using Claude Sonnet 4.5 based on
# recent sales footfall (peak days/days quiet), the staff roster (roles +
# hourly rate + optional weekly_hours_target) and the last 4 weeks of shifts
# (to learn each person's usual pattern). The endpoint returns proposed
# shifts WITHOUT inserting them — the UI then lets the manager preview and
# optionally bulk-apply them.

class AISuggestBody(BaseModel):
    location_id: str
    target_start: str  # Monday of the target week, YYYY-MM-DD


def _last_four_weeks_sales(location_id: str, target_start: _date) -> list:
    """Pull the four full weeks before `target_start` so we can detect a
    day-of-week footfall pattern. Returns a list of {date, weekday, sales}.
    """
    src_from = (target_start - _td(days=28)).isoformat()
    src_to = (target_start - _td(days=1)).isoformat()
    rows = list(daily_sales_collection.find(
        {"location_id": location_id, "date": {"$gte": src_from, "$lte": src_to}},
        {"_id": 0, "date": 1, "sales": 1},
    ).sort("date", 1))
    out = []
    for r in rows:
        try:
            d = _date.fromisoformat(r["date"])
        except Exception:
            continue
        out.append({
            "date": r["date"],
            "weekday": d.strftime("%a"),
            "sales": float(r.get("sales") or 0),
        })
    return out


def _recent_shift_pattern(location_id: str, target_start: _date) -> list:
    """Pull the prior 4 weeks of shifts so the LLM can see how individual
    staff are usually scheduled (e.g. Alice typically works Mon/Wed/Fri
    mornings)."""
    src_from = (target_start - _td(days=28)).isoformat()
    src_to = (target_start - _td(days=1)).isoformat()
    rows = list(shifts_collection.find(
        {"location_id": location_id, "date": {"$gte": src_from, "$lte": src_to}},
        {"_id": 0, "staff_id": 1, "staff_name": 1, "date": 1, "start_time": 1, "end_time": 1, "role": 1},
    ).sort("date", 1))
    out = []
    for r in rows:
        try:
            d = _date.fromisoformat(r["date"])
        except Exception:
            continue
        out.append({
            "staff_id": r.get("staff_id", ""),
            "staff_name": r.get("staff_name", ""),
            "weekday": d.strftime("%a"),
            "start": r.get("start_time", ""),
            "end": r.get("end_time", ""),
            "role": r.get("role", ""),
        })
    return out


_AI_ROTA_SYSTEM = (
    "You are the rota planner for Jolly's Kafe, a UK restaurant chain. "
    "You are given (a) the last 4 weeks of daily sales for a single site, "
    "(b) the current staff roster with their hourly rate and weekly hours "
    "target (0 = flexible), and (c) the last 4 weeks of historical shifts. "
    "Generate a DRAFT 7-day rota for the requested target week (Mon→Sun). "
    "Rules:\n"
    "1. Respect each staff member's weekly_hours_target if > 0 (±2h tolerance).\n"
    "2. Bias shift density to busier weekdays based on the sales footfall pattern.\n"
    "3. Honour each staff member's typical day-of-week/role pattern when present.\n"
    "4. Use HH:MM 24h times. Common patterns: 08:00-14:00, 09:00-17:00, 14:00-22:00, 17:00-23:00.\n"
    "5. Do NOT schedule the same staff member for two overlapping shifts on the same day.\n"
    "6. Output STRICT JSON with the shape:\n"
    "{\n"
    "  \"reasoning\": \"<1-2 sentence overview>\",\n"
    "  \"shifts\": [\n"
    "    {\"staff_id\": \"...\", \"date\": \"YYYY-MM-DD\", \"start_time\": \"HH:MM\", "
    "\"end_time\": \"HH:MM\", \"role\": \"\"}\n"
    "  ]\n"
    "}\n"
    "Return ONLY the JSON object. No markdown, no commentary."
)


@router.post("/ai-suggest-week")
async def ai_suggest_week(body: AISuggestBody, user: dict = Depends(get_admin_user)):
    """Ask Claude for a proposed rota for the given target week.
    Returns the proposed shifts WITHOUT inserting them. The frontend
    previews them and (optionally) calls /bulk-create to materialise."""
    try:
        target_start = _date.fromisoformat(body.target_start)
    except ValueError:
        raise HTTPException(400, "target_start must be YYYY-MM-DD")
    if target_start.weekday() != 0:
        # Normalise to Monday — defensive in case the UI passes a non-Mon date.
        target_start = target_start - _td(days=target_start.weekday())

    staff_rows = list(staff_collection.find(
        {},
        {"_id": 0, "id": 1, "name": 1, "hourly_rate": 1, "weekly_hours_target": 1},
    ))
    if not staff_rows:
        raise HTTPException(400, "No staff members configured — add staff before requesting an AI rota.")
    # Roster sent to Claude. Cap to first 30 to keep prompt size sane.
    roster = [
        {
            "staff_id": s.get("id", ""),
            "name": s.get("name", ""),
            "hourly_rate": float(s.get("hourly_rate") or 0),
            "weekly_hours_target": float(s.get("weekly_hours_target") or 0),
        }
        for s in staff_rows[:30]
    ]
    valid_ids = {s["staff_id"] for s in roster}

    sales_history = _last_four_weeks_sales(body.location_id, target_start)
    shift_history = _recent_shift_pattern(body.location_id, target_start)

    target_dates = [(target_start + _td(days=i)).isoformat() for i in range(7)]

    user_text = (
        "Build a draft rota for the week starting "
        f"{target_start.isoformat()} (Mon) through "
        f"{(target_start + _td(days=6)).isoformat()} (Sun).\n\n"
        f"TARGET_DATES: {target_dates}\n\n"
        f"ROSTER ({len(roster)} staff):\n{json.dumps(roster, indent=2)}\n\n"
        f"SALES_HISTORY (last 4 weeks, daily takings £):\n{json.dumps(sales_history, indent=2)}\n\n"
        f"RECENT_SHIFTS (last 4 weeks):\n{json.dumps(shift_history, indent=2)}"
    )

    # Reuse the active AI key/provider plumbing from the BI module so the
    # admin only ever has to configure one key. The call shape is identical
    # to bi.py's _generate_insights — Anthropic /v1/messages via httpx.
    from routes.ai_settings import get_active_ai_key, get_active_ai_provider
    api_key = get_active_ai_key()
    if not api_key:
        raise HTTPException(
            500,
            "AI rota unavailable: no API key configured. Open Admin → AI Settings to add one.",
        )
    provider = get_active_ai_provider()

    import httpx
    req = {
        "model": "claude-sonnet-4-5-20250929",
        "max_tokens": 3000,
        "system": _AI_ROTA_SYSTEM,
        "messages": [{"role": "user", "content": user_text}],
    }
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            resp = await client.post("https://api.anthropic.com/v1/messages", json=req, headers=headers)
    except Exception as e:  # noqa: BLE001
        import logging
        logging.exception("AI rota HTTP call failed")
        snippet = (str(e) or e.__class__.__name__).splitlines()[0][:240]
        # Use 500 (not 502) — the preview ingress rewrites 502 responses
        # to an HTML error page, swallowing our JSON detail.
        raise HTTPException(500, f"AI provider error ({provider}): {snippet}")

    if resp.status_code >= 400:
        try:
            err = resp.json().get("error", {}).get("message", resp.text)
        except Exception:
            err = resp.text
        raise HTTPException(500, f"AI provider error ({provider}, {resp.status_code}): {err[:240]}")

    data = resp.json()
    full = "".join(
        block.get("text", "") for block in (data.get("content") or [])
        if block.get("type") == "text"
    ).strip()
    if not full:
        raise HTTPException(500, "AI provider returned an empty response")

    # Strip ```json fences if Claude added them, then parse.
    import re
    s = full
    if s.startswith("```"):
        s = re.sub(r"^```[a-zA-Z]*\n?", "", s)
        s = re.sub(r"\n?```\s*$", "", s)
    if not s.lstrip().startswith("{"):
        m = re.search(r"\{.*\}", s, re.DOTALL)
        if m:
            s = m.group(0)
    try:
        parsed = json.loads(s)
    except json.JSONDecodeError as e:
        raise HTTPException(500, f"AI returned non-JSON response: {e}")

    raw_shifts = parsed.get("shifts") or []
    target_set = set(target_dates)
    # Build a name → id map so we can recover from Claude returning a name
    # instead of a UUID (it sometimes does despite the prompt).
    name_to_id = {(s["name"] or "").strip().lower(): s["staff_id"] for s in roster}

    cleaned = []
    for s in raw_shifts:
        sid = (s.get("staff_id") or "").strip()
        if sid not in valid_ids:
            sid = name_to_id.get((s.get("staff_name") or s.get("name") or "").strip().lower(), "")
        if sid not in valid_ids:
            continue
        d = (s.get("date") or "").strip()
        if d not in target_set:
            continue
        st = (s.get("start_time") or "").strip()
        en = (s.get("end_time") or "").strip()
        if not st or not en:
            continue
        cleaned.append({
            "staff_id": sid,
            "staff_name": next((r["name"] for r in roster if r["staff_id"] == sid), ""),
            "date": d,
            "start_time": st,
            "end_time": en,
            "role": (s.get("role") or "").strip(),
            "hours": _hours_between(st, en),
        })

    return {
        "reasoning": parsed.get("reasoning", ""),
        "target_start": target_start.isoformat(),
        "shifts": cleaned,
    }


class BulkCreateBody(BaseModel):
    location_id: str
    shifts: List[ShiftBody]
    skip_clashes: bool = True


@router.post("/bulk-create")
async def bulk_create(body: BulkCreateBody, user: dict = Depends(get_admin_user)):
    """Insert a batch of draft shifts in one round-trip. Used by the AI
    rota apply flow. Each shift is created as a draft so the manager can
    still tweak before Publish."""
    inserted = []
    skipped = 0
    seen = set()  # in-batch dedupe — (staff_id, date, start_time)
    now = datetime.now(timezone.utc).isoformat()
    docs = []
    for s in body.shifts:
        triple = (s.staff_id, s.date, s.start_time)
        if body.skip_clashes:
            if triple in seen:
                skipped += 1
                continue
            clash = shifts_collection.find_one({
                "location_id": body.location_id,
                "staff_id": s.staff_id,
                "date": s.date,
                "start_time": s.start_time,
            })
            if clash:
                skipped += 1
                continue
        seen.add(triple)
        doc = {
            "id": str(uuid.uuid4())[:12],
            "location_id": body.location_id,
            "staff_id": s.staff_id,
            "staff_name": _resolve_staff_name(s.staff_id),
            "date": s.date,
            "start_time": s.start_time,
            "end_time": s.end_time,
            "role": s.role,
            "notes": s.notes,
            "published": False,
            "created_at": now,
            "created_by": user.get("email", ""),
            "created_by_name": user.get("name", ""),
            "source": "ai-suggest",
        }
        docs.append(doc)
        inserted.append(_decorate(doc))
    if docs:
        shifts_collection.insert_many([dict(d) for d in docs])
    return {"created": len(inserted), "skipped": skipped, "shifts": inserted}
