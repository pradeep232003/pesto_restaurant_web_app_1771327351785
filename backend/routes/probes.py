"""
Probe Calibration — JKHive routine.

Two collections:
  probes               — per-location probe registry (name + optional info)
  probe_calibrations   — calibration runs against each probe (boiling + iced temps)
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from db import db
from auth import get_staff_or_above

router = APIRouter(prefix="/api/admin/probes", tags=["probes"])

probes = db["probes"]
calibrations = db["probe_calibrations"]


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
async def update_probe(probe_id: str, body: ProbeUpdate, user: dict = Depends(get_staff_or_above)):
    existing = probes.find_one({"id": probe_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Not found")
    update = {}
    if body.name is not None:
        n = body.name.strip()
        if not n:
            raise HTTPException(400, "Name cannot be empty")
        update["name"] = n
    if body.info is not None:
        update["info"] = body.info
    if update:
        update["updated_at"] = datetime.now(timezone.utc).isoformat()
        probes.update_one({"id": probe_id}, {"$set": update})
    return probes.find_one({"id": probe_id}, {"_id": 0})


@router.delete("/{probe_id}")
async def delete_probe(probe_id: str, user: dict = Depends(get_staff_or_above)):
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
async def delete_calibration(record_id: str, user: dict = Depends(get_staff_or_above)):
    res = calibrations.delete_one({"id": record_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"deleted": True}
