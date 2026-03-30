from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from datetime import datetime, timezone, timedelta
import uuid
import httpx

from db import locations_collection, site_settings_collection
from auth import get_admin_user
from models import LocationCreate, LocationUpdate
from helpers import serialize_doc

router = APIRouter(tags=["locations"])


# ============== PUBLIC LOCATION ENDPOINTS ==============

@router.get("/api/locations")
async def get_locations():
    """Get all active locations"""
    locations = list(locations_collection.find({"is_active": True}).sort("sort_order", 1))
    result = []
    for loc in locations:
        doc = serialize_doc(loc)
        doc.pop("google_api_key", None)
        result.append(doc)
    return result


@router.get("/api/locations/{slug}")
async def get_location_by_slug(slug: str):
    """Get a single location by slug"""
    location = locations_collection.find_one({"slug": slug})
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    doc = serialize_doc(location)
    doc.pop("google_api_key", None)
    return doc


# ============== GOOGLE REVIEWS ==============

_reviews_cache = {}
REVIEWS_CACHE_TTL = timedelta(hours=6)

@router.get("/api/reviews")
async def get_google_reviews():
    """Fetch Google reviews for all locations with Place ID + API Key. Returns only 4+ star reviews."""
    now = datetime.now(timezone.utc)
    all_reviews = []

    locations = list(locations_collection.find({"is_active": True}).sort("sort_order", 1))

    async with httpx.AsyncClient(timeout=10) as client:
        for loc in locations:
            loc_id = loc.get("id", "")
            place_id = loc.get("google_place_id", "")
            api_key = loc.get("google_api_key", "")
            loc_name = loc.get("name", "")

            if not place_id or not api_key:
                continue

            cached = _reviews_cache.get(loc_id)
            if cached and (now - cached["fetched_at"]) < REVIEWS_CACHE_TTL:
                all_reviews.extend(cached["data"])
                continue

            try:
                resp = await client.get(
                    "https://maps.googleapis.com/maps/api/place/details/json",
                    params={"place_id": place_id, "fields": "reviews", "key": api_key},
                )
                data = resp.json()
                reviews_raw = data.get("result", {}).get("reviews", [])

                loc_reviews = []
                for r in reviews_raw:
                    rating = r.get("rating", 0)
                    if rating >= 4:
                        loc_reviews.append({
                            "author_name": r.get("author_name", ""),
                            "rating": rating,
                            "text": r.get("text", ""),
                            "time": r.get("time", 0),
                            "relative_time": r.get("relative_time_description", ""),
                            "profile_photo_url": r.get("profile_photo_url", ""),
                            "location_name": loc_name,
                            "location_id": loc_id,
                        })

                _reviews_cache[loc_id] = {"data": loc_reviews, "fetched_at": now}
                all_reviews.extend(loc_reviews)
            except Exception:
                if cached:
                    all_reviews.extend(cached["data"])

    all_reviews.sort(key=lambda r: r.get("time", 0), reverse=True)
    return all_reviews


# ============== ADMIN LOCATION CRUD ==============

@router.get("/api/admin/locations")
async def admin_get_all_locations(user: dict = Depends(get_admin_user)):
    """Admin: Get all locations including inactive"""
    locations = list(locations_collection.find().sort("sort_order", 1))
    return [serialize_doc(loc) for loc in locations]


@router.post("/api/admin/locations")
async def admin_create_location(data: LocationCreate, user: dict = Depends(get_admin_user)):
    """Admin: Create a new location"""
    slug = data.name.lower().replace(" ", "-").replace(",", "")
    slug = "-".join(slug.split())

    if locations_collection.find_one({"slug": slug}):
        raise HTTPException(status_code=400, detail="A location with this name already exists")

    max_sort = locations_collection.find_one(sort=[("sort_order", -1)])
    next_sort = (max_sort.get("sort_order", 0) + 1) if max_sort else 1

    location_doc = {
        "id": slug,
        "name": data.name,
        "slug": slug,
        "address": data.address or data.name,
        "is_active": True,
        "sort_order": next_sort,
        "wallet_enabled": data.wallet_enabled,
        "reservation_enabled": data.reservation_enabled,
        "phone": data.phone or "",
        "google_place_id": data.google_place_id or "",
        "google_api_key": data.google_api_key or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    locations_collection.insert_one(location_doc)

    default_hours = {
        "monday": {"open": "08:00", "close": "17:00"},
        "tuesday": {"open": "08:00", "close": "17:00"},
        "wednesday": {"open": "08:00", "close": "17:00"},
        "thursday": {"open": "08:00", "close": "17:00"},
        "friday": {"open": "08:00", "close": "18:00"},
        "saturday": {"open": "09:00", "close": "16:00"},
        "sunday": {"open": "10:00", "close": "15:00"},
    }
    if not site_settings_collection.find_one({"location_id": slug}):
        site_settings_collection.insert_one({
            "location_id": slug,
            "ordering_enabled": True,
            "manual_override": False,
            "opening_hours": default_hours,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })

    created = locations_collection.find_one({"id": slug})
    return serialize_doc(created)


@router.put("/api/admin/locations/{location_id}")
async def admin_update_location(location_id: str, data: LocationUpdate, user: dict = Depends(get_admin_user)):
    """Admin: Update an existing location"""
    existing = locations_collection.find_one({"id": location_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Location not found")

    update_fields = {}
    if data.name is not None:
        update_fields["name"] = data.name
    if data.address is not None:
        update_fields["address"] = data.address
    if data.is_active is not None:
        update_fields["is_active"] = data.is_active
    if data.sort_order is not None:
        update_fields["sort_order"] = data.sort_order
    if data.wallet_enabled is not None:
        update_fields["wallet_enabled"] = data.wallet_enabled
    if data.reservation_enabled is not None:
        update_fields["reservation_enabled"] = data.reservation_enabled
    if data.phone is not None:
        update_fields["phone"] = data.phone
    if data.google_place_id is not None:
        update_fields["google_place_id"] = data.google_place_id
    if data.google_api_key is not None:
        update_fields["google_api_key"] = data.google_api_key

    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    locations_collection.update_one({"id": location_id}, {"$set": update_fields})

    location = locations_collection.find_one({"id": location_id})
    return serialize_doc(location)


@router.delete("/api/admin/locations/{location_id}")
async def admin_delete_location(location_id: str, user: dict = Depends(get_admin_user)):
    """Admin: Delete a location"""
    existing = locations_collection.find_one({"id": location_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Location not found")

    locations_collection.delete_one({"id": location_id})
    site_settings_collection.delete_one({"location_id": location_id})
    return {"message": "Location deleted", "id": location_id}
