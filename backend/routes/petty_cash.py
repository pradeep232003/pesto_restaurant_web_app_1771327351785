"""Petty Cash — staff log small cash spends (milk, cleaning etc.) per site.

Staff add and see their own entries; admins see, edit and delete everything.
Collection: `petty_cash`
"""
import base64
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, Literal, Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from pydantic import BaseModel, Field, StringConstraints

from db import db, images_collection, locations_collection
from auth import get_staff_or_above

Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=300)]

_log = logging.getLogger("petty_cash")
router = APIRouter(prefix="/api/petty-cash", tags=["petty-cash"])

petty = db["petty_cash"]
try:
    petty.create_index([("location_id", 1), ("date", -1)])
except Exception:
    pass

CATEGORIES = ["Milk & Dairy", "Food & Groceries", "Cleaning", "Supplies", "Maintenance", "Travel", "Other"]
Category = Literal["Milk & Dairy", "Food & Groceries", "Cleaning", "Supplies", "Maintenance", "Travel", "Other"]
DATE_RE = r"^\d{4}-\d{2}-\d{2}$"


class PettyCreate(BaseModel):
    location_id: str = Field(..., min_length=1)
    date: str = Field(..., pattern=DATE_RE)
    amount: float = Field(..., gt=0, le=10000)
    category: Category
    description: Text
    receipt_url: Optional[str] = Field(None, max_length=300)


class PettyUpdate(BaseModel):
    location_id: Optional[str] = Field(None, min_length=1)
    date: Optional[str] = Field(None, pattern=DATE_RE)
    amount: Optional[float] = Field(None, gt=0, le=10000)
    category: Optional[Category] = None
    description: Optional[Text] = None
    receipt_url: Optional[str] = Field(None, max_length=300)


def _is_admin(user: dict) -> bool:
    return user.get("role") in ("admin", "super_admin")


def _check_location(location_id: str) -> None:
    if not locations_collection.find_one({"id": location_id.strip()}, {"_id": 1}):
        raise HTTPException(400, "Unknown site")


def _get_editable(entry_id: str, user: dict) -> dict:
    doc = petty.find_one({"id": entry_id, "deleted": {"$ne": True}}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Entry not found")
    if not _is_admin(user) and doc.get("added_by") != user.get("email"):
        raise HTTPException(403, "You can only change your own entries")
    return doc


@router.get("/categories")
async def categories(user: dict = Depends(get_staff_or_above)):
    return {"categories": CATEGORIES}


@router.get("")
async def list_entries(
    location_id: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None, pattern=DATE_RE),
    date_to: Optional[str] = Query(None, pattern=DATE_RE),
    category: Optional[str] = Query(None),
    user: dict = Depends(get_staff_or_above),
):
    q: dict = {"deleted": {"$ne": True}}
    if not _is_admin(user):
        q["added_by"] = user.get("email")
    if location_id and location_id != "all":
        q["location_id"] = location_id
    if date_from or date_to:
        q["date"] = {}
        if date_from:
            q["date"]["$gte"] = date_from
        if date_to:
            q["date"]["$lte"] = date_to
    if category and category != "all":
        q["category"] = category
    rows = list(petty.find(q, {"_id": 0}).sort([("date", -1), ("created_at", -1)]).limit(2000))
    by_category: dict = {}
    by_location: dict = {}
    for r in rows:
        by_category[r["category"]] = round(by_category.get(r["category"], 0) + r["amount"], 2)
        by_location[r["location_id"]] = round(by_location.get(r["location_id"], 0) + r["amount"], 2)
    return {
        "items": rows,
        "total": round(sum(r["amount"] for r in rows), 2),
        "count": len(rows),
        "by_category": by_category,
        "by_location": by_location,
    }


@router.post("")
async def create_entry(payload: PettyCreate, user: dict = Depends(get_staff_or_above)):
    _check_location(payload.location_id)
    doc = {
        "id": str(uuid.uuid4()),
        "location_id": payload.location_id.strip(),
        "date": payload.date,
        "amount": round(payload.amount, 2),
        "category": payload.category,
        "description": payload.description.strip(),
        "receipt_url": (payload.receipt_url or "").strip(),
        "added_by": user.get("email", ""),
        "added_by_name": user.get("name") or user.get("email", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    petty.insert_one(doc)
    doc.pop("_id", None)
    _log.info("petty_cash: added £%.2f loc=%s by=%s", doc["amount"], doc["location_id"], doc["added_by"])
    return doc


@router.patch("/{entry_id}")
async def update_entry(entry_id: str, payload: PettyUpdate, user: dict = Depends(get_staff_or_above)):
    _get_editable(entry_id, user)
    if payload.location_id:
        _check_location(payload.location_id)
    updates = {k: (v.strip() if isinstance(v, str) else v) for k, v in payload.model_dump(exclude_none=True).items()}
    if "amount" in updates:
        updates["amount"] = round(updates["amount"], 2)
    if updates:
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        updates["updated_by"] = user.get("email", "")
        petty.update_one({"id": entry_id}, {"$set": updates})
    return petty.find_one({"id": entry_id}, {"_id": 0})


@router.delete("/{entry_id}")
async def delete_entry(entry_id: str, user: dict = Depends(get_staff_or_above)):
    _get_editable(entry_id, user)
    petty.update_one({"id": entry_id}, {"$set": {
        "deleted": True,
        "deleted_by": user.get("email", ""),
        "deleted_at": datetime.now(timezone.utc).isoformat(),
    }})
    _log.info("petty_cash: deleted id=%s by=%s", entry_id, user.get("email"))
    return {"deleted": True}


@router.post("/upload-receipt")
async def upload_receipt(file: UploadFile = File(...), user: dict = Depends(get_staff_or_above)):
    if file.content_type not in ("image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"):
        raise HTTPException(400, "Invalid file type")
    raw = await file.read()
    if len(raw) > 8 * 1024 * 1024:
        raise HTTPException(400, "Receipt photo must be under 8MB")
    image_id = f"receipt_{uuid.uuid4().hex[:12]}"
    images_collection.insert_one({
        "image_id": image_id,
        "content_type": file.content_type,
        "data": base64.b64encode(raw).decode("utf-8"),
        "type": "petty_cash_receipt",
        "uploaded_by": user.get("email", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"image_url": f"/api/images/{image_id}"}
