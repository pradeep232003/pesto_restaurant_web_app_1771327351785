"""
Routine Temps — Opening / Closing fridge & freezer temperature wizard.
Stores one record per (location, date, period) where period ∈ {opening, closing}.

On submit, out-of-range readings automatically raise "Open" rows in
the Corrective Actions log (idempotent per unit + date + period).
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from db import db
from auth import get_staff_or_above
from routes.corrective_actions import auto_log_failure

_log = logging.getLogger("routine_temps")

# FSA-guideline temperature thresholds. Anything ABOVE these limits
# fails the check and triggers a corrective action. Values chosen to
# match the JKHive routine catalog.
TEMP_LIMITS = {
    "fridge": 8.0,   # UK regulation says food must be at or below 8°C
    "chiller": 5.0,  # Chef/prep chillers held tighter
    "freezer": -18.0,  # Frozen storage
}

router = APIRouter(prefix="/api/admin/routine-temps", tags=["routine-temps"])

routine_temps_collection = db["routine_temps"]


class UnitReading(BaseModel):
    unit_id: str
    unit_name: str
    unit_type: str  # fridge | freezer | chiller
    temp_c: float


class RoutineTempSubmit(BaseModel):
    location_id: str
    date: str  # YYYY-MM-DD
    period: str = Field(..., pattern="^(opening|closing)$")
    readings: List[UnitReading]
    comment: Optional[str] = ""


@router.post("")
async def submit_routine_temp(body: RoutineTempSubmit, user: dict = Depends(get_staff_or_above)):
    """Upsert a single opening/closing record for a location/date."""
    key = {"location_id": body.location_id, "date": body.date, "period": body.period}
    doc = {
        **key,
        "readings": [r.dict() for r in body.readings],
        "comment": body.comment or "",
        "submitted_by": user.get("email", ""),
        "submitted_by_name": user.get("name", ""),
        "submitted_at": datetime.now(timezone.utc).isoformat(),
    }
    existing = routine_temps_collection.find_one(key)
    if existing:
        routine_temps_collection.update_one(key, {"$set": doc})
        doc["id"] = existing.get("id")
    else:
        doc["id"] = str(uuid.uuid4())[:12]
        routine_temps_collection.insert_one(dict(doc))

    # ---- Auto-log corrective actions for any out-of-range reading ----
    # Freezers fail if the temp is ABOVE -18°C; fridges / chillers fail
    # if ABOVE their upper limit. Each unit gets its own idempotent
    # corrective action row keyed by (location, date, period, unit).
    for r in body.readings:
        limit = TEMP_LIMITS.get((r.unit_type or "").lower())
        if limit is None:
            continue
        failed = r.temp_c > limit
        if not failed:
            continue
        source_key = f"routine_temp:{body.location_id}:{body.date}:{body.period}:{r.unit_id}"
        cat = "freezer_temp" if r.unit_type.lower() == "freezer" else "fridge_temp"
        try:
            auto_log_failure(
                location_id=body.location_id,
                category=cat,
                item=r.unit_name or r.unit_id,
                failure_description=(
                    f"{body.period.title()} check on {body.date}: "
                    f"{r.unit_name or r.unit_id} recorded {r.temp_c:.1f}°C "
                    f"(limit {limit:.1f}°C)."
                ),
                source_key=source_key,
                logged_by_email=user.get("email", "system"),
                logged_by_name=user.get("name") or "System (auto)",
            )
        except Exception as ex:  # pragma: no cover — never block the temp save
            _log.warning("routine_temps: auto-log corrective failed: %s", ex)

    return {k: v for k, v in doc.items() if k != "_id"}


@router.get("")
async def list_routine_temps(
    location_id: str = Query(None),
    period: str = Query(None),
    start_date: str = Query(None),
    end_date: str = Query(None),
    user: dict = Depends(get_staff_or_above),
):
    q = {}
    if location_id:
        q["location_id"] = location_id
    if period:
        q["period"] = period
    if start_date and end_date:
        q["date"] = {"$gte": start_date, "$lte": end_date}
    items = list(routine_temps_collection.find(q, {"_id": 0}).sort("date", -1))
    return items
