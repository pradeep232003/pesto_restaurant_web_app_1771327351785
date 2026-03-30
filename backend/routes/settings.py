from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone

from db import locations_collection, site_settings_collection
from auth import get_admin_user
from models import SiteSettingsUpdate
from helpers import serialize_doc

router = APIRouter(prefix="/api/admin/site-settings", tags=["settings"])


@router.get("")
async def admin_get_site_settings(user: dict = Depends(get_admin_user)):
    """Admin: Get all site settings for active locations"""
    active_ids = [loc["id"] for loc in locations_collection.find({"is_active": True}, {"id": 1, "_id": 0})]
    settings = list(site_settings_collection.find({"location_id": {"$in": active_ids}}))
    return [serialize_doc(s) for s in settings]


@router.put("/{location_id}")
async def admin_update_site_settings(location_id: str, data: SiteSettingsUpdate, user: dict = Depends(get_admin_user)):
    """Admin: Update site settings for a location"""
    existing = site_settings_collection.find_one({"location_id": location_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Site settings not found for this location")

    update_fields = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if data.ordering_enabled is not None:
        update_fields["ordering_enabled"] = data.ordering_enabled
    if data.manual_override is not None:
        update_fields["manual_override"] = data.manual_override
    if data.opening_hours is not None:
        update_fields["opening_hours"] = data.opening_hours

    site_settings_collection.update_one({"location_id": location_id}, {"$set": update_fields})
    updated = site_settings_collection.find_one({"location_id": location_id})
    return serialize_doc(updated)


@router.patch("/{location_id}/toggle")
async def admin_toggle_ordering(location_id: str, user: dict = Depends(get_admin_user)):
    """Admin: Quick toggle ordering on/off for a location"""
    existing = site_settings_collection.find_one({"location_id": location_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Site settings not found")

    new_enabled = not existing.get("ordering_enabled", True)
    site_settings_collection.update_one(
        {"location_id": location_id},
        {"$set": {"ordering_enabled": new_enabled, "manual_override": True, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    updated = site_settings_collection.find_one({"location_id": location_id})
    return serialize_doc(updated)
