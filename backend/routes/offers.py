"""
Customer-facing & admin-managed Offers/Promotions.

Each offer is a marketing poster shown on the home page Current Offers strip.
Admins can upload artwork, set a title/caption/price, optionally restrict
display to specific locations, and optionally set a start/end date range.
"""
import base64
import uuid
import io
from datetime import datetime, timezone, date
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

from db import db, images_collection
from auth import get_admin_user

router = APIRouter()
offers = db["offers"]

# ---- Models -----------------------------------------------------------------


class OfferCreate(BaseModel):
    title: str
    caption: Optional[str] = ""
    image_url: Optional[str] = ""
    price: Optional[str] = ""
    location_ids: Optional[List[str]] = None
    start_date: Optional[str] = ""  # YYYY-MM-DD inclusive; "" = no lower bound
    end_date: Optional[str] = ""    # YYYY-MM-DD inclusive; "" = no upper bound
    is_active: bool = True
    sort_order: Optional[int] = None


class OfferUpdate(BaseModel):
    title: Optional[str] = None
    caption: Optional[str] = None
    image_url: Optional[str] = None
    price: Optional[str] = None
    location_ids: Optional[List[str]] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


# ---- Helpers ----------------------------------------------------------------


def _serialise(doc: dict) -> dict:
    return {k: v for k, v in doc.items() if k != "_id"}


def _is_within_dates(o: dict, today_iso: str) -> bool:
    """Return True if today_iso is within the offer's optional date range."""
    s = (o.get("start_date") or "").strip()
    e = (o.get("end_date") or "").strip()
    if s and today_iso < s:
        return False
    if e and today_iso > e:
        return False
    return True


# ---- Public endpoint --------------------------------------------------------


@router.get("/api/offers")
async def list_public_offers(location_id: Optional[str] = None):
    """Public: list active, in-date offers; optionally filter by location."""
    today_iso = date.today().isoformat()
    rows = list(offers.find({"is_active": True}, {"_id": 0}).sort([("sort_order", 1), ("created_at", -1)]))
    out = []
    for o in rows:
        if not _is_within_dates(o, today_iso):
            continue
        # location_ids empty/missing = applies everywhere
        loc_ids = o.get("location_ids") or []
        if location_id and loc_ids and location_id not in loc_ids:
            continue
        out.append(o)
    return out


# ---- Admin endpoints --------------------------------------------------------


@router.get("/api/admin/offers")
async def admin_list_offers(user: dict = Depends(get_admin_user)):
    rows = list(offers.find({}, {"_id": 0}).sort([("sort_order", 1), ("created_at", -1)]))
    return rows


@router.post("/api/admin/offers")
async def admin_create_offer(data: OfferCreate, user: dict = Depends(get_admin_user)):
    if not data.title.strip():
        raise HTTPException(400, "Title is required")
    # Auto-assign sort_order at end if not provided
    if data.sort_order is None:
        last = list(offers.find({}, {"_id": 0, "sort_order": 1}).sort("sort_order", -1).limit(1))
        next_sort = (last[0].get("sort_order", 0) if last else 0) + 1
    else:
        next_sort = int(data.sort_order)
    doc = {
        "id": uuid.uuid4().hex[:10],
        "title": data.title.strip(),
        "caption": (data.caption or "").strip(),
        "image_url": (data.image_url or "").strip(),
        "price": (data.price or "").strip(),
        "location_ids": data.location_ids or [],
        "start_date": (data.start_date or "").strip(),
        "end_date": (data.end_date or "").strip(),
        "is_active": bool(data.is_active),
        "sort_order": next_sort,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    offers.insert_one(doc)
    return _serialise(doc)


@router.put("/api/admin/offers/{offer_id}")
async def admin_update_offer(offer_id: str, data: OfferUpdate, user: dict = Depends(get_admin_user)):
    update = {k: v for k, v in data.dict().items() if v is not None}
    if not update:
        raise HTTPException(400, "No fields to update")
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    res = offers.update_one({"id": offer_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Offer not found")
    doc = offers.find_one({"id": offer_id}, {"_id": 0})
    return doc


@router.delete("/api/admin/offers/{offer_id}")
async def admin_delete_offer(offer_id: str, user: dict = Depends(get_admin_user)):
    res = offers.delete_one({"id": offer_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Offer not found")
    return {"deleted": True}


# ---- Image upload (reuses the existing /api/images/{id} dispenser) ----------


@router.post("/api/admin/offers/upload-image")
async def admin_upload_offer_image(file: UploadFile = File(...), user: dict = Depends(get_admin_user)):
    """Returns the public URL of the saved image — caller should store it in
    the offer's `image_url` field via create/update."""
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    if file.content_type not in allowed_types:
        raise HTTPException(400, "Invalid file type. Allowed: JPEG, PNG, WebP, GIF")
    raw = await file.read()
    image_id = f"offer_{uuid.uuid4().hex[:12]}"
    images_collection.insert_one({
        "image_id": image_id,
        "content_type": file.content_type,
        "data": base64.b64encode(raw).decode("utf-8"),
        "type": "offer",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"image_url": f"/api/images/{image_id}"}
