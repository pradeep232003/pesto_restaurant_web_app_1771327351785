"""
Cooking & Cooling — track items being cooled after cooking.

Two collections:
  cooking_cooling_logs    — one per cooling session (start → complete)
  cooking_cooling_custom  — per-location custom items added by staff

Catalog (category → items) is seeded with sensible defaults on startup.
Custom items are merged in at read time, scoped to the location that added them.
"""
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from db import db
from auth import get_staff_or_above

router = APIRouter(prefix="/api/admin/cooking-cooling", tags=["cooking-cooling"])

logs_collection = db["cooking_cooling_logs"]
custom_collection = db["cooking_cooling_custom"]

# Default master catalog. Categories are alphabetised (matches the screenshots).
# Each category has a single emoji icon used for every item card in that category.
DEFAULT_CATALOG = {
    "Beef":            {"icon": "🐄", "items": ["Brisket", "Chuck", "Diced", "Fillet", "Mince", "Ribeye", "Rump", "Sirloin", "Stewing"]},
    "Chicken":         {"icon": "🐔", "items": ["Breast", "Drum stick", "Fillet", "Fronts", "Gizzard", "Heart", "Leg", "Liver", "Supremes", "Thigh", "Wing", "Whole bird"]},
    "Eggs":            {"icon": "🥚", "items": ["Whole", "Yolks", "Whites"]},
    "Fish (other)":    {"icon": "🎣", "items": ["Anchovy", "Cod", "Haddock", "Sardine", "Tuna"]},
    "Flat Fish":       {"icon": "🐟", "items": ["Sole", "Plaice", "Halibut", "Turbot"]},
    "Game":            {"icon": "🦌", "items": ["Venison", "Pheasant", "Rabbit", "Duck (game)", "Partridge"]},
    "Lamb":            {"icon": "🐑", "items": ["Leg", "Shoulder", "Mince", "Chops", "Rack", "Diced"]},
    "Milk":            {"icon": "🥛", "items": ["Whole", "Semi-skimmed", "Cream", "Custard"]},
    "Molluscs":        {"icon": "🦑", "items": ["Squid", "Octopus", "Mussels", "Clams", "Oysters"]},
    "Pastry":          {"icon": "🥐", "items": ["Shortcrust", "Puff", "Filo", "Choux"]},
    "Pork":            {"icon": "🐷", "items": ["Belly", "Loin", "Mince", "Sausages", "Ribs", "Shoulder", "Bacon"]},
    "Rice And Grains": {"icon": "🌾", "items": ["Rice (white)", "Rice (brown)", "Pasta", "Couscous", "Quinoa", "Bulgur"]},
    "Round Fish":      {"icon": "🐠", "items": ["Salmon", "Sea bass", "Mackerel", "Trout"]},
    "Salad":           {"icon": "🥗", "items": ["Mixed greens", "Coleslaw", "Pasta salad", "Potato salad"]},
    "Turkey":          {"icon": "🦃", "items": ["Breast", "Whole bird", "Mince", "Crown"]},
    "General":         {"icon": "🥘", "items": ["Soup", "Sauce", "Stew", "Curry", "Casserole", "Stock", "Gravy"]},
}


# ============== MODELS ==============

class CustomItemCreate(BaseModel):
    location_id: str
    category: str
    name: str


class StartCoolingBody(BaseModel):
    location_id: str
    item_name: str        # display label, e.g. "Beef (Brisket)"
    item_category: str    # e.g. "Beef"
    start_temp_c: float
    target_temp_c: float = 8.0


class CompleteCoolingBody(BaseModel):
    end_temp_c: float
    comment: Optional[str] = ""


# ============== CATALOG ==============

@router.get("/catalog")
async def get_catalog(location_id: str = Query(...), user: dict = Depends(get_staff_or_above)):
    """Return the merged catalog: default categories + this-location's custom items."""
    # Start from defaults
    catalog = {cat: {"icon": meta["icon"], "items": list(meta["items"])} for cat, meta in DEFAULT_CATALOG.items()}
    # Merge custom items for this location
    for c in custom_collection.find({"location_id": location_id}, {"_id": 0}):
        cat = c.get("category") or "General"
        if cat not in catalog:
            catalog[cat] = {"icon": "🥘", "items": []}
        if c["name"] not in catalog[cat]["items"]:
            catalog[cat]["items"].append(c["name"])
    return {"categories": [
        {"name": cat, "icon": meta["icon"], "items": meta["items"]}
        for cat, meta in catalog.items()
    ]}


@router.post("/catalog")
async def add_custom_item(body: CustomItemCreate, user: dict = Depends(get_staff_or_above)):
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "Name is required")
    cat = (body.category or "General").strip() or "General"
    existing = custom_collection.find_one({"location_id": body.location_id, "category": cat, "name": name})
    if existing:
        return {"id": existing.get("id"), "category": cat, "name": name}
    doc = {
        "id": str(uuid.uuid4())[:12],
        "location_id": body.location_id,
        "category": cat,
        "name": name,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user.get("email", ""),
    }
    custom_collection.insert_one(dict(doc))
    return {k: v for k, v in doc.items() if k != "_id"}


# ============== COOLING LOGS ==============

@router.get("")
async def list_cooling(
    location_id: str = Query(...),
    status: str = Query(None, pattern="^(cooling|complete)$"),
    limit: int = Query(50, le=200),
    user: dict = Depends(get_staff_or_above),
):
    q = {"location_id": location_id}
    if status:
        q["status"] = status
    items = list(logs_collection.find(q, {"_id": 0}).sort("started_at", -1).limit(limit))
    return items


@router.get("/active-count")
async def active_count(location_id: str = Query(...), user: dict = Depends(get_staff_or_above)):
    """Count of items currently in 'cooling' status — used to badge the JKHive tile."""
    n = logs_collection.count_documents({"location_id": location_id, "status": "cooling"})
    return {"count": n}


@router.post("/start")
async def start_cooling(body: StartCoolingBody, user: dict = Depends(get_staff_or_above)):
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4())[:12],
        "location_id": body.location_id,
        "item_name": body.item_name,
        "item_category": body.item_category,
        "start_temp_c": body.start_temp_c,
        "target_temp_c": body.target_temp_c,
        "status": "cooling",
        "started_at": now,
        "started_by": user.get("email", ""),
        "started_by_name": user.get("name", ""),
        "end_temp_c": None,
        "comment": "",
        "completed_at": None,
        "completed_by": "",
        "completed_by_name": "",
    }
    logs_collection.insert_one(dict(doc))
    return {k: v for k, v in doc.items() if k != "_id"}


@router.get("/{log_id}")
async def get_cooling(log_id: str, user: dict = Depends(get_staff_or_above)):
    doc = logs_collection.find_one({"id": log_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    return doc


@router.patch("/{log_id}/complete")
async def complete_cooling(log_id: str, body: CompleteCoolingBody, user: dict = Depends(get_staff_or_above)):
    existing = logs_collection.find_one({"id": log_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Not found")
    if existing.get("status") == "complete":
        raise HTTPException(400, "Already completed")
    upd = {
        "status": "complete",
        "end_temp_c": body.end_temp_c,
        "comment": body.comment or "",
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "completed_by": user.get("email", ""),
        "completed_by_name": user.get("name", ""),
    }
    logs_collection.update_one({"id": log_id}, {"$set": upd})
    return {**existing, **upd}


@router.delete("/{log_id}")
async def cancel_cooling(log_id: str, user: dict = Depends(get_staff_or_above)):
    res = logs_collection.delete_one({"id": log_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"deleted": True}
