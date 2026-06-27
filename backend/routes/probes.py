"""
Probe Calibration — JKHive routine.

Two collections:
  probes               — per-location probe registry (name + optional info)
  probe_calibrations   — calibration runs against each probe (boiling + iced temps)
"""
import uuid
import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from db import db
from auth import get_staff_or_above, get_admin_user

router = APIRouter(prefix="/api/admin/probes", tags=["probes"])

probes = db["probes"]
calibrations = db["probe_calibrations"]
locations_coll = db["locations"]


class ProbeBody(BaseModel):
    location_id: str
    name: str
    info: Optional[str] = ""


class ProbeUpdate(BaseModel):
    name: Optional[str] = None
    info: Optional[str] = None


class CalibrationBody(BaseModel):
    location_id: str
    probe_id: str
    boiling_temp: float
    iced_temp: float
    comment: Optional[str] = ""


@router.get("")
async def list_probes(location_id: str = Query(...), user: dict = Depends(get_staff_or_above)):
    return list(probes.find({"location_id": location_id}, {"_id": 0}).sort("name", 1))


@router.post("")
async def add_probe(body: ProbeBody, user: dict = Depends(get_staff_or_above)):
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "Name required")
    # Names must be unique per location (case-insensitive). Two sites can each
    # have "Probe 1", but one site cannot have two "Probe 1" entries.
    existing = probes.find_one({
        "location_id": body.location_id,
        "name": {"$regex": f"^{re.escape(name)}$", "$options": "i"},
    })
    if existing:
        raise HTTPException(409, f"A probe named '{name}' already exists at this location")
    doc = {
        "id": str(uuid.uuid4())[:12],
        "location_id": body.location_id,
        "name": name,
        "info": body.info or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user.get("email", ""),
    }
    probes.insert_one(dict(doc))
    return {k: v for k, v in doc.items() if k != "_id"}


@router.patch("/{probe_id}")
async def update_probe(probe_id: str, body: ProbeUpdate, user: dict = Depends(get_admin_user)):
    existing = probes.find_one({"id": probe_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Not found")
    update = {}
    if body.name is not None:
        n = body.name.strip()
        if not n:
            raise HTTPException(400, "Name cannot be empty")
        # Reject rename collisions at the same site (case-insensitive,
        # excluding the row we're editing).
        clash = probes.find_one({
            "location_id": existing.get("location_id"),
            "id": {"$ne": probe_id},
            "name": {"$regex": f"^{re.escape(n)}$", "$options": "i"},
        })
        if clash:
            raise HTTPException(409, f"A probe named '{n}' already exists at this location")
        update["name"] = n
    if body.info is not None:
        update["info"] = body.info
    if update:
        update["updated_at"] = datetime.now(timezone.utc).isoformat()
        update["updated_by"] = user.get("email", "")
        update["updated_by_name"] = user.get("name", "")
        probes.update_one({"id": probe_id}, {"$set": update})
    return probes.find_one({"id": probe_id}, {"_id": 0})


@router.delete("/{probe_id}")
async def delete_probe(probe_id: str, user: dict = Depends(get_admin_user)):
    res = probes.delete_one({"id": probe_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"deleted": True}


@router.get("/calibrations")
async def list_calibrations(
    location_id: str = Query(...),
    probe_id: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    user: dict = Depends(get_staff_or_above),
):
    q = {"location_id": location_id}
    if probe_id:
        q["probe_id"] = probe_id
    return list(calibrations.find(q, {"_id": 0}).sort("recorded_at", -1).limit(limit))


@router.get("/calibrations/history")
async def calibrations_history(
    location_id: Optional[str] = Query(None, description="Filter to one site; omit for all"),
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD inclusive"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD inclusive"),
    limit: int = Query(500, le=2000),
    user: dict = Depends(get_admin_user),
):
    """Admin/super_admin only — cross-location calibration history with
    enriched location name. Supports optional date range and per-site filter.
    """
    q: dict = {}
    if location_id:
        q["location_id"] = location_id
    if start_date or end_date:
        date_q: dict = {}
        if start_date:
            date_q["$gte"] = start_date
        if end_date:
            date_q["$lte"] = end_date + "T23:59:59"
        q["recorded_at"] = date_q
    rows = list(calibrations.find(q, {"_id": 0}).sort("recorded_at", -1).limit(limit))
    name_by_id = {ldoc["id"]: ldoc.get("name", ldoc["id"]) for ldoc in locations_coll.find({}, {"_id": 0, "id": 1, "name": 1})}
    for r in rows:
        r["location_name"] = name_by_id.get(r.get("location_id"), r.get("location_id"))
    return {"entries": rows, "total": len(rows)}


@router.post("/calibrations")
async def record_calibration(body: CalibrationBody, user: dict = Depends(get_staff_or_above)):
    probe = probes.find_one({"id": body.probe_id}, {"_id": 0})
    if not probe:
        raise HTTPException(404, "Probe not found")
    boiling_pass = abs(body.boiling_temp - 100.0) <= 1.0
    iced_pass = abs(body.iced_temp - 0.0) <= 1.0
    doc = {
        "id": str(uuid.uuid4())[:12],
        "location_id": body.location_id,
        "probe_id": body.probe_id,
        "probe_name": probe.get("name", ""),
        "boiling_temp": body.boiling_temp,
        "iced_temp": body.iced_temp,
        "boiling_pass": boiling_pass,
        "iced_pass": iced_pass,
        "passed": boiling_pass and iced_pass,
        "comment": body.comment or "",
        "recorded_at": datetime.now(timezone.utc).isoformat(),
        "recorded_by": user.get("email", ""),
        "recorded_by_name": user.get("name", ""),
    }
    calibrations.insert_one(dict(doc))
    return {k: v for k, v in doc.items() if k != "_id"}


@router.delete("/calibrations/{record_id}")
async def delete_calibration(record_id: str, user: dict = Depends(get_admin_user)):
    res = calibrations.delete_one({"id": record_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"deleted": True}


class CalibrationUpdate(BaseModel):
    boiling_temp: Optional[float] = None
    iced_temp: Optional[float] = None
    comment: Optional[str] = None


@router.patch("/calibrations/{record_id}")
async def update_calibration(record_id: str, body: CalibrationUpdate, user: dict = Depends(get_admin_user)):
    """Admin/super_admin only — edit a historical calibration. Re-derives pass
    flags from the new temps so the BI / Compliance views stay accurate.
    """
    existing = calibrations.find_one({"id": record_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Not found")
    update: dict = {}
    boil = body.boiling_temp if body.boiling_temp is not None else existing.get("boiling_temp")
    iced = body.iced_temp    if body.iced_temp    is not None else existing.get("iced_temp")
    if body.boiling_temp is not None:
        update["boiling_temp"] = body.boiling_temp
    if body.iced_temp is not None:
        update["iced_temp"] = body.iced_temp
    if body.comment is not None:
        update["comment"] = body.comment
    if body.boiling_temp is not None or body.iced_temp is not None:
        boil_pass = boil is not None and abs(boil - 100.0) <= 1.0
        iced_pass = iced is not None and abs(iced - 0.0) <= 1.0
        update["boiling_pass"] = boil_pass
        update["iced_pass"]    = iced_pass
        update["passed"]       = bool(boil_pass and iced_pass)
    update["edited_at"]      = datetime.now(timezone.utc).isoformat()
    update["edited_by"]      = user.get("email", "")
    update["edited_by_name"] = user.get("name", "")
    calibrations.update_one({"id": record_id}, {"$set": update})
    return calibrations.find_one({"id": record_id}, {"_id": 0})
