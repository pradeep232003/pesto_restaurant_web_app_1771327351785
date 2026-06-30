"""
Clock In / Out — geofenced time tracking.

Staff clock in/out from a JKHive tile. The browser must supply GPS
coordinates; we compute the haversine distance to the location's
configured centre and either accept (within radius), or mark the event
as `verified: false` when GPS was denied/unavailable so admins can
review.

Events are stored as flat documents per clock action. We derive the
"current" status by finding the latest open shift per user.
"""
import math
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from db import db
from auth import get_current_user, get_admin_user

router = APIRouter(prefix="/api/clock", tags=["clock"])

clock_events_collection = db["clock_events"]
locations_collection = db["locations"]
staff_collection = db["staff_members"]


# ---------- Models ----------

class ClockPayload(BaseModel):
    location_id: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    accuracy_m: Optional[float] = None
    gps_error: Optional[str] = None  # "denied", "unavailable", "timeout"


# ---------- Helpers ----------

def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two points in metres."""
    R = 6371000.0  # Earth radius in metres
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlmb / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def _strip(doc: dict) -> dict:
    return {k: v for k, v in (doc or {}).items() if k != "_id"}


def _evaluate_geofence(loc: dict, lat: Optional[float], lng: Optional[float]):
    """Returns (within: bool, distance_m: float|None, radius_m: int, verified: bool)."""
    radius = int(loc.get("geofence_radius_m") or 200)
    loc_lat = loc.get("latitude")
    loc_lng = loc.get("longitude")

    if loc_lat is None or loc_lng is None:
        # No fence configured — allow but flag for admin review.
        return True, None, radius, False

    if lat is None or lng is None:
        # GPS denied/unavailable — allow but flag.
        return True, None, radius, False

    dist = _haversine_m(float(loc_lat), float(loc_lng), float(lat), float(lng))
    return (dist <= radius), dist, radius, True


def _staff_for(user: dict) -> Optional[dict]:
    email = (user.get("email") or "").strip().lower()
    if not email:
        return None
    return staff_collection.find_one({"account_email": email})


# ---------- Endpoints ----------

@router.get("/status")
async def clock_status(user: dict = Depends(get_current_user)):
    """Current open shift (if any) for the logged-in user."""
    email = (user.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="No email on account")

    open_evt = clock_events_collection.find_one(
        {"account_email": email, "type": "in", "closed": False},
        sort=[("created_at", -1)],
    )
    return {
        "clocked_in": bool(open_evt),
        "event": _strip(open_evt) if open_evt else None,
    }


@router.post("/in")
async def clock_in(payload: ClockPayload, user: dict = Depends(get_current_user)):
    email = (user.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="No email on account")

    # Block double clock-in for the same user
    existing = clock_events_collection.find_one(
        {"account_email": email, "type": "in", "closed": False}
    )
    if existing:
        raise HTTPException(status_code=409, detail="Already clocked in")

    loc = locations_collection.find_one({"id": payload.location_id})
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")

    # Staff permission check: if staff record has assigned location_ids, enforce.
    staff = _staff_for(user)
    if staff:
        allowed = staff.get("location_ids") or []
        if allowed and payload.location_id not in allowed:
            raise HTTPException(status_code=403, detail="Not assigned to this location")

    within, distance, radius, verified = _evaluate_geofence(
        loc, payload.latitude, payload.longitude
    )

    if verified and not within:
        # Hard block when we have a real fix and they're outside.
        raise HTTPException(
            status_code=403,
            detail=f"Outside geofence: {int(distance or 0)}m from {loc.get('name','site')} "
                   f"(allowed {radius}m). Move closer and try again.",
        )

    now = datetime.now(timezone.utc)
    event = {
        "id": str(uuid.uuid4()),
        "account_email": email,
        "user_name": user.get("name") or user.get("email"),
        "staff_id": (staff or {}).get("id"),
        "type": "in",
        "location_id": payload.location_id,
        "location_name": loc.get("name", ""),
        "latitude": payload.latitude,
        "longitude": payload.longitude,
        "accuracy_m": payload.accuracy_m,
        "gps_error": payload.gps_error,
        "distance_m": distance,
        "radius_m": radius,
        "verified": verified,           # GPS available + fence configured
        "within_geofence": within,
        "closed": False,
        "created_at": now.isoformat(),
    }
    clock_events_collection.insert_one(event)
    return {"ok": True, "event": _strip(event)}


@router.post("/out")
async def clock_out(payload: ClockPayload, user: dict = Depends(get_current_user)):
    email = (user.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="No email on account")

    open_evt = clock_events_collection.find_one(
        {"account_email": email, "type": "in", "closed": False},
        sort=[("created_at", -1)],
    )
    if not open_evt:
        raise HTTPException(status_code=409, detail="Not currently clocked in")

    loc = locations_collection.find_one({"id": payload.location_id or open_evt.get("location_id")})
    within, distance, radius, verified = _evaluate_geofence(
        loc or {}, payload.latitude, payload.longitude
    )

    now = datetime.now(timezone.utc)
    start_iso = open_evt.get("created_at")
    try:
        start_dt = datetime.fromisoformat(start_iso.replace("Z", "+00:00"))
        hours = round((now - start_dt).total_seconds() / 3600.0, 3)
    except Exception:
        hours = 0.0

    out_event = {
        "id": str(uuid.uuid4()),
        "account_email": email,
        "user_name": user.get("name") or user.get("email"),
        "staff_id": open_evt.get("staff_id"),
        "type": "out",
        "location_id": open_evt.get("location_id"),
        "location_name": open_evt.get("location_name", ""),
        "latitude": payload.latitude,
        "longitude": payload.longitude,
        "accuracy_m": payload.accuracy_m,
        "gps_error": payload.gps_error,
        "distance_m": distance,
        "radius_m": radius,
        "verified": verified,
        "within_geofence": within,
        "paired_in_id": open_evt.get("id"),
        "hours": hours,
        "closed": True,
        "created_at": now.isoformat(),
    }
    clock_events_collection.insert_one(out_event)
    clock_events_collection.update_one(
        {"id": open_evt.get("id")},
        {"$set": {"closed": True, "closed_at": now.isoformat(), "hours": hours,
                  "paired_out_id": out_event["id"]}},
    )

    return {"ok": True, "event": _strip(out_event), "hours": hours}


@router.get("/history")
async def my_clock_history(limit: int = 50, user: dict = Depends(get_current_user)):
    """Last N events for the logged-in user."""
    email = (user.get("email") or "").strip().lower()
    if not email:
        return []
    docs = list(
        clock_events_collection.find({"account_email": email})
        .sort("created_at", -1)
        .limit(min(limit, 200))
    )
    return [_strip(d) for d in docs]


# ---------- Admin ----------

@router.get("/admin/events")
async def admin_clock_events(
    location_id: Optional[str] = None,
    days: int = 7,
    user: dict = Depends(get_admin_user),
):
    """Admin: list recent clock events for review."""
    from datetime import timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(days=max(1, min(days, 90)))).isoformat()
    query = {"created_at": {"$gte": cutoff}}
    if location_id:
        query["location_id"] = location_id
    docs = list(clock_events_collection.find(query).sort("created_at", -1).limit(500))
    return [_strip(d) for d in docs]
