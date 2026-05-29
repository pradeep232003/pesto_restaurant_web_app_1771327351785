"""
Hot/Cold Holding sessions — track service-line items with elapsed-time
checks at 2hr / 4hr / 6hr. UK FSA: hot ≥ 63°C, cold ≤ 8°C.
"""
import uuid
from datetime import datetime, timezone
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from db import db
from auth import get_staff_or_above

router = APIRouter(prefix="/api/admin/hot-cold", tags=["hot-cold"])

sessions = db["hot_cold_sessions"]

Mode = Literal["hot", "cold"]
Status = Literal["active", "complete"]


class StartBody(BaseModel):
    location_id: str
    mode: Mode
    item_name: str
    item_category: str
    item_icon: Optional[str] = ""
    start_temp: float


class CheckBody(BaseModel):
    label: str          # "2hr" | "4hr" | "6hr"
    temp: float


class CompleteBody(BaseModel):
    end_temp: Optional[float] = None
    comment: Optional[str] = ""


def _pass(mode: str, temp: float) -> bool:
    return temp >= 63.0 if mode == "hot" else temp <= 8.0


@router.get("/sessions")
async def list_sessions(
    location_id: str = Query(...),
    status: Optional[Status] = Query(None),
    limit: int = Query(50, le=200),
    user: dict = Depends(get_staff_or_above),
):
    q = {"location_id": location_id}
    if status:
        q["status"] = status
    return list(sessions.find(q, {"_id": 0}).sort("start_time", -1).limit(limit))


@router.post("/sessions")
async def start_session(body: StartBody, user: dict = Depends(get_staff_or_above)):
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4())[:12],
        "location_id": body.location_id,
        "mode": body.mode,
        "item_name": body.item_name,
        "item_category": body.item_category,
        "item_icon": body.item_icon or "",
        "start_temp": body.start_temp,
        "start_pass": _pass(body.mode, body.start_temp),
        "start_time": now,
        "status": "active",
        "checks": [],
        "started_by": user.get("email", ""),
        "started_by_name": user.get("name", ""),
    }
    sessions.insert_one(dict(doc))
    return {k: v for k, v in doc.items() if k != "_id"}


@router.post("/sessions/{session_id}/check")
async def add_check(session_id: str, body: CheckBody, user: dict = Depends(get_staff_or_above)):
    s = sessions.find_one({"id": session_id}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Not found")
    if s.get("status") != "active":
        raise HTTPException(400, "Session already completed")
    check = {
        "label": body.label,
        "temp": body.temp,
        "passed": _pass(s["mode"], body.temp),
        "at": datetime.now(timezone.utc).isoformat(),
        "by": user.get("email", ""),
    }
    sessions.update_one({"id": session_id}, {"$push": {"checks": check}})
    return sessions.find_one({"id": session_id}, {"_id": 0})


@router.post("/sessions/{session_id}/complete")
async def complete_session(session_id: str, body: CompleteBody, user: dict = Depends(get_staff_or_above)):
    s = sessions.find_one({"id": session_id}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Not found")
    update = {
        "status": "complete",
        "end_time": datetime.now(timezone.utc).isoformat(),
        "completed_by": user.get("email", ""),
        "comment": body.comment or "",
    }
    if body.end_temp is not None:
        update["end_temp"] = body.end_temp
        update["end_pass"] = _pass(s["mode"], body.end_temp)
    sessions.update_one({"id": session_id}, {"$set": update})
    return sessions.find_one({"id": session_id}, {"_id": 0})


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str, user: dict = Depends(get_staff_or_above)):
    res = sessions.delete_one({"id": session_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"deleted": True}


class NoModeBody(BaseModel):
    location_id: str
    mode: Mode   # 'hot' or 'cold'


@router.post("/no-mode")
async def log_no_holding(body: NoModeBody, user: dict = Depends(get_staff_or_above)):
    """
    Log an idempotent "no hot/cold holding today" entry so the daily-check
    hub can mark hot-cold as DONE without leaving an actual holding session.

    Idempotent per (location_id, mode, today). A second call returns the
    existing row instead of creating a duplicate.
    """
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    existing = sessions.find_one(
        {
            "location_id": body.location_id,
            "mode": body.mode,
            "kind": "no_holding",
            "start_time": {"$gte": today, "$lt": today + "T99"},
        },
        {"_id": 0},
    )
    if existing:
        return existing

    now = datetime.now(timezone.utc).isoformat()
    label = "No hot holding today" if body.mode == "hot" else "No cold holding today"
    doc = {
        "id": str(uuid.uuid4())[:12],
        "location_id": body.location_id,
        "mode": body.mode,
        "kind": "no_holding",
        "item_name": label,
        "item_category": "",
        "item_icon": "🚫",
        "start_temp": None,
        "start_pass": None,
        "start_time": now,
        "status": "complete",
        "end_time": now,
        "checks": [],
        "comment": "",
        "started_by": user.get("email", ""),
        "started_by_name": user.get("name", ""),
        "completed_by": user.get("email", ""),
    }
    sessions.insert_one(dict(doc))
    return {k: v for k, v in doc.items() if k != "_id"}
