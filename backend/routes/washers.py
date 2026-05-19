"""Washer Temps — track wash + rinse cycle temperatures per washer."""
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from db import db
from auth import get_staff_or_above

router = APIRouter(prefix="/api/admin/washers", tags=["washers"])

washers = db["washers"]
checks = db["washer_checks"]


class WasherBody(BaseModel):
    location_id: str
    name: str
    info: Optional[str] = ""


class WasherUpdate(BaseModel):
    name: Optional[str] = None
    info: Optional[str] = None


class CheckBody(BaseModel):
    location_id: str
    washer_id: str
    # Both temperatures are optional — different sites record different
    # cycles. We just require at least one to be provided (validated in the
    # endpoint). UK 1995 regs: wash ≥ 55°C, rinse ≥ 82°C.
    wash_temp: Optional[float] = None
    rinse_temp: Optional[float] = None
    comment: Optional[str] = ""


@router.get("")
async def list_washers(location_id: str = Query(...), user: dict = Depends(get_staff_or_above)):
    return list(washers.find({"location_id": location_id}, {"_id": 0}).sort("name", 1))


@router.post("")
async def add_washer(body: WasherBody, user: dict = Depends(get_staff_or_above)):
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
    washers.insert_one(dict(doc))
    return {k: v for k, v in doc.items() if k != "_id"}


@router.patch("/{washer_id}")
async def update_washer(washer_id: str, body: WasherUpdate, user: dict = Depends(get_staff_or_above)):
    if not washers.find_one({"id": washer_id}, {"_id": 0}):
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
        washers.update_one({"id": washer_id}, {"$set": update})
    return washers.find_one({"id": washer_id}, {"_id": 0})


@router.delete("/{washer_id}")
async def delete_washer(washer_id: str, user: dict = Depends(get_staff_or_above)):
    res = washers.delete_one({"id": washer_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"deleted": True}


@router.get("/checks")
async def list_checks(
    location_id: str = Query(...),
    washer_id: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    user: dict = Depends(get_staff_or_above),
):
    q = {"location_id": location_id}
    if washer_id:
        q["washer_id"] = washer_id
    return list(checks.find(q, {"_id": 0}).sort("recorded_at", -1).limit(limit))


@router.post("/checks")
async def record_check(body: CheckBody, user: dict = Depends(get_staff_or_above)):
    washer = washers.find_one({"id": body.washer_id}, {"_id": 0})
    if not washer:
        raise HTTPException(404, "Washer not found")
    if body.wash_temp is None and body.rinse_temp is None:
        raise HTTPException(400, "Provide at least one temperature (wash or rinse)")
    wash_pass = (body.wash_temp >= 55.0) if body.wash_temp is not None else None
    rinse_pass = (body.rinse_temp >= 81.0) if body.rinse_temp is not None else None
    # Overall pass requires every recorded cycle to have passed; cycles not
    # recorded at all don't count against the pass.
    relevant = [p for p in (wash_pass, rinse_pass) if p is not None]
    overall_pass = bool(relevant) and all(relevant)
    doc = {
        "id": str(uuid.uuid4())[:12],
        "location_id": body.location_id,
        "washer_id": body.washer_id,
        "washer_name": washer.get("name", ""),
        "wash_temp": body.wash_temp,
        "rinse_temp": body.rinse_temp,
        "wash_pass": wash_pass,
        "rinse_pass": rinse_pass,
        "passed": overall_pass,
        "comment": body.comment or "",
        "recorded_at": datetime.now(timezone.utc).isoformat(),
        "recorded_by": user.get("email", ""),
        "recorded_by_name": user.get("name", ""),
    }
    checks.insert_one(dict(doc))
    return {k: v for k, v in doc.items() if k != "_id"}


@router.delete("/checks/{record_id}")
async def delete_check(record_id: str, user: dict = Depends(get_staff_or_above)):
    res = checks.delete_one({"id": record_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"deleted": True}
