"""
Allergens — the 14 legally required FSA allergens (UK / EU).

- `CATALOG` is the immutable regulatory reference (categories + the
  named sub-items the user provided). We serve it from `/api/allergens/catalog`.
- Per menu item, we store an `allergens` dict on the `menu_items`
  document itself:
     `allergens = { category_id: [sub_item_id, ...] }`
  This keeps queries simple (one collection) and the public menu
  endpoint automatically returns the allergen data for allergen
  labelling on the customer-facing menu.
- The matrix endpoint returns every item for a location together with
  its current allergen selections so the frontend can render the grid
  in one round-trip.
"""
from typing import Dict, List, Optional
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from db import db, menu_items_collection
from auth import get_admin_user, get_staff_or_above

_log = logging.getLogger("allergens")

router = APIRouter(prefix="/api/allergens", tags=["allergens"])


# ------------------------ Regulatory catalog ------------------------
# Ordered as the FSA lists them. `id` is the stable machine key,
# `label` is user-facing, `items` are the named sub-items supplied by
# the operator (Jolly's Kafe) so managers can be precise about which
# sub-item is present in a dish (e.g. "wheat" vs "spelt" for gluten).
CATALOG: List[Dict] = [
    {"id": "gluten", "label": "Cereals containing gluten", "items": [
        "wheat", "rye", "barley", "oats", "spelt", "kamut",
        "durum", "emmer", "einkorn", "triticale",
    ]},
    {"id": "crustaceans", "label": "Crustaceans", "items": [
        "prawns", "shrimp", "crab", "lobster", "crayfish",
        "langoustine", "scampi", "krill",
    ]},
    {"id": "eggs", "label": "Eggs", "items": [
        "hen_eggs", "duck_eggs", "quail_eggs", "goose_eggs",
        "turkey_eggs", "egg_white", "egg_yolk",
    ]},
    {"id": "fish", "label": "Fish", "items": [
        "salmon", "tuna", "cod", "haddock", "mackerel",
        "sardines", "trout", "anchovies", "bass", "halibut",
    ]},
    {"id": "peanuts", "label": "Peanuts", "items": [
        "peanuts", "groundnuts", "monkey_nuts", "peanut_butter",
        "peanut_flour", "peanut_oil_unrefined",
    ]},
    {"id": "soybeans", "label": "Soybeans", "items": [
        "soybeans", "edamame", "tofu", "tempeh", "soy_milk",
        "soy_flour", "soy_protein", "soy_sauce", "miso", "natto",
    ]},
    {"id": "milk", "label": "Milk", "items": [
        "cow_milk", "goat_milk", "sheep_milk", "cream", "butter",
        "cheese", "yoghurt", "whey", "casein", "buttermilk",
    ]},
    {"id": "tree_nuts", "label": "Nuts (Tree nuts)", "items": [
        "almonds", "hazelnuts", "walnuts", "cashews", "pecans",
        "brazil_nuts", "pistachios", "macadamia_nuts", "queensland_nuts",
    ]},
    {"id": "celery", "label": "Celery", "items": [
        "celery_stalks", "celery_leaves", "celeriac",
        "celery_salt", "celery_seeds",
    ]},
    {"id": "mustard", "label": "Mustard", "items": [
        "mustard_seeds_yellow", "mustard_seeds_brown", "mustard_seeds_black",
        "mustard_powder", "dijon_mustard", "wholegrain_mustard", "english_mustard",
    ]},
    {"id": "sesame", "label": "Sesame seeds", "items": [
        "sesame_seeds", "tahini", "sesame_oil_unrefined",
        "sesame_paste", "gomasio",
    ]},
    {"id": "sulphites", "label": "Sulphur dioxide & sulphites (>10 mg/kg)", "items": [
        "e220_sulphur_dioxide", "e221_sodium_sulphite", "e222_sodium_bisulphite",
        "e223_sodium_metabisulphite", "e224_potassium_metabisulphite",
        "e226_calcium_sulphite", "e227_calcium_bisulphite",
        "e228_potassium_bisulphite",
    ]},
    {"id": "lupin", "label": "Lupin", "items": [
        "lupin_beans", "lupin_flour", "lupin_seeds", "lupin_protein",
    ]},
    {"id": "molluscs", "label": "Molluscs", "items": [
        "mussels", "oysters", "clams", "scallops", "cockles",
        "squid", "octopus", "cuttlefish", "snails", "whelks", "abalone",
    ]},
]

_VALID_IDS = {c["id"]: {s for s in c["items"]} for c in CATALOG}


def _sanitise(allergens: Dict[str, List[str]]) -> Dict[str, List[str]]:
    """Silently drop unknown category / sub-item ids so a stale UI can't
    poison the DB. Returns a new dict with only valid values."""
    out: Dict[str, List[str]] = {}
    for cat_id, subs in (allergens or {}).items():
        if cat_id not in _VALID_IDS:
            continue
        valid_subs = [s for s in (subs or []) if s in _VALID_IDS[cat_id]]
        # Only persist categories that actually apply.
        if valid_subs:
            out[cat_id] = valid_subs
    return out


# ------------------------ Endpoints ------------------------
@router.get("/catalog")
async def get_catalog(user: dict = Depends(get_staff_or_above)):
    """Static 14-allergen reference — safe to cache aggressively on the
    client."""
    return {"catalog": CATALOG}


class AllergenPayload(BaseModel):
    allergens: Dict[str, List[str]] = Field(default_factory=dict)


@router.put("/matrix/{item_id}")
async def set_item_allergens(
    item_id: str,
    payload: AllergenPayload,
    user: dict = Depends(get_admin_user),
):
    existing = menu_items_collection.find_one({"id": item_id})
    if not existing:
        raise HTTPException(404, "Menu item not found")
    clean = _sanitise(payload.allergens)
    menu_items_collection.update_one(
        {"id": item_id},
        {"$set": {"allergens": clean}},
    )
    _log.info(
        "allergens: item=%s (%s) categories=%d subitems=%d by=%s",
        item_id, existing.get("name", ""),
        len(clean), sum(len(v) for v in clean.values()), user.get("email"),
    )
    return {"id": item_id, "allergens": clean}


@router.get("/matrix")
async def get_matrix(
    location_id: str = Query(...),
    user: dict = Depends(get_staff_or_above),
):
    """Return every menu item for a location together with its current
    allergen selections — one round-trip powers the whole matrix."""
    rows = list(menu_items_collection.find(
        {"location_id": location_id},
        {"id": 1, "name": 1, "category": 1, "allergens": 1, "is_available": 1},
    ).sort([("category", 1), ("name", 1)]).limit(2000))
    items = []
    for r in rows:
        r.pop("_id", None)
        items.append({
            "id": r.get("id"),
            "name": r.get("name", ""),
            "category": r.get("category", ""),
            "is_available": bool(r.get("is_available", True)),
            "allergens": _sanitise(r.get("allergens") or {}),
        })
    return {"location_id": location_id, "items": items}
