"""
Staff Table — HR roster of employees (admin/super_admin only).
Purely a record-keeping table; not linked to login accounts.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from db import db
from auth import get_admin_user

router = APIRouter(prefix="/api/admin/staff", tags=["staff"])

staff_collection = db["staff_members"]


class StaffMember(BaseModel):
    name: str = Field(..., min_length=1)
    forename: str = ""
    surname: str = ""
    ni_number: str = ""
    dob: str = ""           # YYYY-MM-DD
    address: str = ""
    employee_no: str = ""
    start_date: str = ""    # YYYY-MM-DD
    hourly_rate: float = 0.0
    # Optional target hours per week, used by AI rota auto-suggest to
    # balance schedules. 0 means "no preference".
    weekly_hours_target: float = 0.0
    # Sites the staff member is permitted to work at. Empty list = treated
    # as "all sites" so legacy records continue to appear in every
    # location's rota until a manager refines it.
    location_ids: list = []
    # Optional login link — when an account with this email logs in we can
    # automatically scope their view (e.g. /jkhive/shifts) to their own
    # rota. Lower-cased on write so comparisons are case-insensitive.
    account_email: str = ""


class StaffMemberUpdate(BaseModel):
    name: Optional[str] = None
    forename: Optional[str] = None
    surname: Optional[str] = None
    ni_number: Optional[str] = None
    dob: Optional[str] = None
    address: Optional[str] = None
    employee_no: Optional[str] = None
    start_date: Optional[str] = None
    hourly_rate: Optional[float] = None
    weekly_hours_target: Optional[float] = None
    location_ids: Optional[list] = None
    account_email: Optional[str] = None


@router.get("")
async def list_staff(user: dict = Depends(get_admin_user)):
    """List all staff members (admin + super_admin only)."""
    items = list(staff_collection.find({}, {"_id": 0}).sort("name", 1))
    return items


@router.post("")
async def create_staff(body: StaffMember, user: dict = Depends(get_admin_user)):
    """Create a new staff record."""
    doc = body.dict()
    # Normalise the optional login link so case differences don't break the
    # lookup later.
    if doc.get("account_email"):
        doc["account_email"] = doc["account_email"].strip().lower()
    doc["id"] = str(uuid.uuid4())[:12]
    doc["created_by"] = user.get("email", "")
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    staff_collection.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@router.patch("/{staff_id}")
async def update_staff(staff_id: str, body: StaffMemberUpdate, user: dict = Depends(get_admin_user)):
    """Update a staff record."""
    update = {k: v for k, v in body.dict().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")
    if "account_email" in update and update["account_email"]:
        update["account_email"] = update["account_email"].strip().lower()
    update["updated_by"] = user.get("email", "")
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = staff_collection.update_one({"id": staff_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Staff not found")
    doc = staff_collection.find_one({"id": staff_id}, {"_id": 0})
    return doc


@router.delete("/{staff_id}")
async def delete_staff(staff_id: str, user: dict = Depends(get_admin_user)):
    """Delete a staff record."""
    result = staff_collection.delete_one({"id": staff_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Staff not found")
    return {"message": "Deleted"}
