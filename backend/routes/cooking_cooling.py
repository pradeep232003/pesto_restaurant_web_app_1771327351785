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
# `section` groups categories under the Fresh / Frozen / Dry / Prepared / Beverages
# tab bar in the JKHive ingredient picker (matches IMG_6688).
DEFAULT_CATALOG = {
    # ---------- FRESH ----------
    "Beef":            {"icon": "🐄", "section": "Fresh",    "items": ["Brisket", "Chuck", "Diced", "Fillet", "Flank", "Mince", "Ribeye", "Rump", "Sirloin", "Stewing"]},
    "Chicken":         {"icon": "🐔", "section": "Fresh",    "items": ["Breast", "Drum stick", "Fillet", "Fronts", "Gizzard", "Heart", "Leg", "Liver", "Supremes", "Thigh", "Wing", "Whole bird"]},
    "Eggs":            {"icon": "🥚", "section": "Fresh",    "items": ["Whole", "Yolks", "Whites"]},
    "Fish (other)":    {"icon": "🎣", "section": "Fresh",    "items": ["Anchovy", "Cod", "Haddock", "Sardine", "Tuna"]},
    "Flat Fish":       {"icon": "🐟", "section": "Fresh",    "items": ["Sole", "Plaice", "Halibut", "Turbot"]},
    "Game":            {"icon": "🦌", "section": "Fresh",    "items": ["Venison", "Pheasant", "Rabbit", "Duck (game)", "Partridge"]},
    "Lamb":            {"icon": "🐑", "section": "Fresh",    "items": ["Leg", "Shoulder", "Mince", "Chops", "Rack", "Diced"]},
    "Milk":            {"icon": "🥛", "section": "Fresh",    "items": ["Whole", "Semi-skimmed", "Cream", "Custard"]},
    "Molluscs":        {"icon": "🦑", "section": "Fresh",    "items": ["Squid", "Octopus", "Mussels", "Clams", "Oysters"]},
    "Pork":            {"icon": "🐷", "section": "Fresh",    "items": ["Belly", "Loin", "Mince", "Sausages", "Ribs", "Shoulder", "Bacon"]},
    "Round Fish":      {"icon": "🐠", "section": "Fresh",    "items": ["Salmon", "Sea bass", "Mackerel", "Trout"]},
    "Turkey":          {"icon": "🦃", "section": "Fresh",    "items": ["Breast", "Whole bird", "Mince", "Crown"]},

    # ---------- FROZEN ----------
    "Frozen Bread":               {"icon": "🥖", "section": "Frozen", "items": ["Bread loaves", "Bread rolls", "Brioche", "Pitta", "Naan", "Wraps"]},
    "Frozen Fish":                {"icon": "🐟", "section": "Frozen", "items": ["Cod fillet", "Salmon fillet", "Haddock", "Prawns", "Calamari rings", "Fish fingers"]},
    "Frozen Fruit And Vegetables":{"icon": "🥦", "section": "Frozen", "items": ["Mixed berries", "Peas", "Sweetcorn", "Mixed veg", "Spinach", "Broccoli", "Chips", "Hash browns"]},
    "Frozen Fruit Purée":         {"icon": "🍓", "section": "Frozen", "items": ["Mango", "Raspberry", "Strawberry", "Passion fruit", "Mixed berry"]},
    "Frozen Meat":                {"icon": "🥩", "section": "Frozen", "items": ["Mince", "Chicken breast", "Burgers", "Sausages", "Diced beef", "Diced lamb"]},
    "Frozen Meat Alternatives":   {"icon": "🌱", "section": "Frozen", "items": ["Quorn pieces", "Vegan burgers", "Vegan sausages", "Tofu", "Vegan mince"]},
    "Frozen Pastry":              {"icon": "🥐", "section": "Frozen", "items": ["Puff pastry", "Shortcrust pastry", "Filo", "Pizza dough"]},
    "Frozen Patisseries":         {"icon": "🥐", "section": "Frozen", "items": ["Croissants", "Pain au chocolat", "Danish pastries", "Donuts", "Eclairs"]},
    "Frozen Prepared":            {"icon": "🍕", "section": "Frozen", "items": ["Pizzas", "Lasagne", "Curry", "Pies", "Spring rolls", "Samosas"]},
    "Ice Cream And Sorbets":      {"icon": "🍦", "section": "Frozen", "items": ["Vanilla", "Chocolate", "Strawberry", "Mint", "Sorbet (lemon)", "Sorbet (mango)"]},

    # ---------- DRY ----------
    "Bakery":                  {"icon": "🍞", "section": "Dry", "items": ["Bread", "Rolls", "Crumpets", "Bagels", "Wraps", "Pitta"]},
    "Cereal":                  {"icon": "🥣", "section": "Dry", "items": ["Cornflakes", "Porridge oats", "Muesli", "Granola", "Weetabix"]},
    "Chocolate":               {"icon": "🍫", "section": "Dry", "items": ["Dark", "Milk", "White", "Cocoa powder", "Chocolate chips"]},
    "Crackers And Biscuits":   {"icon": "🍪", "section": "Dry", "items": ["Crackers", "Digestives", "Shortbread", "Rich tea", "Oatcakes"]},
    "Dried Beans And Peas":    {"icon": "🫘", "section": "Dry", "items": ["Chickpeas", "Kidney beans", "Black beans", "Lentils (red)", "Lentils (green)", "Split peas", "Cannellini"]},
    "Dried Fruit":             {"icon": "🍇", "section": "Dry", "items": ["Raisins", "Sultanas", "Apricots", "Cranberries", "Dates", "Figs", "Prunes"]},
    "Dried Herbs And Spices":  {"icon": "🌿", "section": "Dry", "items": ["Oregano", "Basil", "Thyme", "Rosemary", "Cumin", "Paprika", "Cinnamon", "Black pepper", "Salt"]},
    "Dried Other":             {"icon": "🥫", "section": "Dry", "items": ["Stock cubes", "Gelatin", "Yeast", "Baking powder", "Bicarbonate of soda"]},
    "Molecular":               {"icon": "⚗️", "section": "Dry", "items": ["Agar agar", "Xanthan gum", "Locust bean gum", "Sodium alginate", "Calcium chloride"]},
    "Nuts":                    {"icon": "🥜", "section": "Dry", "items": ["Almonds", "Cashews", "Walnuts", "Pistachios", "Hazelnuts", "Pine nuts", "Peanuts"]},
    "Pasta And Noodles":       {"icon": "🍝", "section": "Dry", "items": ["Spaghetti", "Penne", "Fusilli", "Rigatoni", "Lasagne sheets", "Egg noodles", "Rice noodles"]},
    "Rice And Grains":         {"icon": "🌾", "section": "Dry", "items": ["Rice (white)", "Rice (brown)", "Couscous", "Quinoa", "Bulgur", "Pearl barley"]},

    # ---------- PREPARED ----------
    "Bread And Baked Goods":   {"icon": "🥖", "section": "Prepared", "items": ["Sourdough", "Focaccia", "Ciabatta", "Brioche", "Bagels", "Crumpets", "Buns"]},
    "Condiments":              {"icon": "🧂", "section": "Prepared", "items": ["Ketchup", "Mayonnaise", "Mustard", "Brown sauce", "Soy sauce", "Vinegar", "Worcestershire"]},
    "Cured Meats":             {"icon": "🥓", "section": "Prepared", "items": ["Prosciutto", "Salami", "Chorizo", "Pancetta", "Bacon", "Ham", "Pastrami"]},
    "Deli Counter":            {"icon": "🧀", "section": "Prepared", "items": ["Cooked ham", "Turkey breast", "Roast beef", "Pâté", "Cheese (cut)", "Olives"]},
    "Dips":                    {"icon": "🥑", "section": "Prepared", "items": ["Hummus", "Guacamole", "Tzatziki", "Salsa", "Sour cream", "Tapenade"]},
    "Ferments And Pickles":    {"icon": "🥒", "section": "Prepared", "items": ["Sauerkraut", "Kimchi", "Pickled cucumber", "Pickled onions", "Pickled chillies", "Capers"]},
    "Garnish":                 {"icon": "🌿", "section": "Prepared", "items": ["Microgreens", "Edible flowers", "Cress", "Parsley", "Coriander", "Chives", "Lemon zest"]},
    "Jellies, Jams And Chutney": {"icon": "🍯", "section": "Prepared", "items": ["Strawberry jam", "Raspberry jam", "Marmalade", "Mango chutney", "Apple chutney", "Mint jelly", "Redcurrant jelly"]},
    "Oil And Dressing":        {"icon": "🫒", "section": "Prepared", "items": ["Olive oil", "Vegetable oil", "Rapeseed oil", "Vinaigrette", "Caesar dressing", "Honey mustard", "Balsamic dressing"]},
    "Pastry":                  {"icon": "🥐", "section": "Prepared", "items": ["Shortcrust", "Puff", "Filo", "Choux"]},
    "Prepared Crustaceans":    {"icon": "🦐", "section": "Prepared", "items": ["Cooked prawns", "King prawns", "Lobster (cooked)", "Crab meat", "Langoustine"]},
    "Salad":                   {"icon": "🥗", "section": "Prepared", "items": ["Mixed greens", "Coleslaw", "Pasta salad", "Potato salad"]},
    "General":                 {"icon": "🥘", "section": "Prepared", "items": ["Soup", "Sauce", "Stew", "Curry", "Casserole", "Stock", "Gravy"]},

    # ---------- BEVERAGES ----------
    "Alcopops":                {"icon": "🍾", "section": "Beverages", "items": ["WKD", "Smirnoff Ice", "Bacardi Breezer", "Hooch"]},
    "Ale":                     {"icon": "🍺", "section": "Beverages", "items": ["Bitter", "IPA", "Brown ale", "Pale ale", "Stout", "Porter"]},
    "Cider":                   {"icon": "🍎", "section": "Beverages", "items": ["Apple cider", "Pear cider", "Fruit cider", "Strong cider"]},
    "Coffee":                  {"icon": "☕", "section": "Beverages", "items": ["Espresso beans", "Filter coffee", "Instant coffee", "Decaf", "Ground coffee"]},
    "Gin":                     {"icon": "🍸", "section": "Beverages", "items": ["London dry", "Pink gin", "Sloe gin", "Flavoured gin"]},
    "Hot Drinks (other)":      {"icon": "🍵", "section": "Beverages", "items": ["Hot chocolate", "Tea (black)", "Tea (green)", "Tea (herbal)", "Chai"]},
    "Juices And Smoothies":    {"icon": "🥤", "section": "Beverages", "items": ["Orange", "Apple", "Pineapple", "Cranberry", "Tomato", "Smoothie (mixed berry)", "Smoothie (tropical)"]},
    "Lager":                   {"icon": "🍻", "section": "Beverages", "items": ["Standard lager", "Premium lager", "Light lager", "Strong lager"]},
    "Milkshakes":              {"icon": "🥤", "section": "Beverages", "items": ["Vanilla", "Chocolate", "Strawberry", "Banana"]},
    "Red Wine":                {"icon": "🍷", "section": "Beverages", "items": ["Merlot", "Cabernet", "Shiraz", "Pinot noir", "Malbec", "House red"]},
    "Rosé Wine":               {"icon": "🌸", "section": "Beverages", "items": ["Provence rosé", "Pinot rosé", "House rosé"]},
    "White Wine":              {"icon": "🍾", "section": "Beverages", "items": ["Chardonnay", "Sauvignon blanc", "Pinot grigio", "Riesling", "House white"]},
    "Sparkling Wine":          {"icon": "🥂", "section": "Beverages", "items": ["Prosecco", "Champagne", "Cava", "Crémant"]},
    "Soft Drinks":             {"icon": "🥤", "section": "Beverages", "items": ["Cola", "Diet cola", "Lemonade", "Tonic water", "Soda water", "Ginger ale", "Mixers"]},
    "Spirits":                 {"icon": "🥃", "section": "Beverages", "items": ["Vodka", "Rum (light)", "Rum (dark)", "Whisky", "Bourbon", "Tequila", "Brandy"]},
    "Water":                   {"icon": "💧", "section": "Beverages", "items": ["Still", "Sparkling", "Flavoured"]},
}

VALID_SECTIONS = ["Fresh", "Frozen", "Dry", "Prepared", "Beverages"]


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
    catalog = {cat: {"icon": meta["icon"], "section": meta.get("section", "Fresh"), "items": list(meta["items"])} for cat, meta in DEFAULT_CATALOG.items()}
    # Merge custom items for this location
    for c in custom_collection.find({"location_id": location_id}, {"_id": 0}):
        cat = c.get("category") or "General"
        if cat not in catalog:
            catalog[cat] = {"icon": "🥘", "section": c.get("section", "Fresh"), "items": []}
        if c["name"] not in catalog[cat]["items"]:
            catalog[cat]["items"].append(c["name"])
    return {"categories": [
        {"name": cat, "icon": meta["icon"], "section": meta["section"], "items": meta["items"]}
        for cat, meta in catalog.items()
    ], "sections": VALID_SECTIONS}


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
    # Allow re-submitting a completed record (staff opening "Today's record" to
    # correct an entry). We keep the original `completed_at` to preserve the
    # 90-min audit trail and overwrite the rest.
    upd = {
        "status": "complete",
        "end_temp_c": body.end_temp_c,
        "comment": body.comment or "",
        "completed_at": existing.get("completed_at") or datetime.now(timezone.utc).isoformat(),
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


# ============== SERVER-SIDE ALARM SCHEDULER ==============
# Runs every 60 s. For each in-progress cooling log:
#   • fires a "warn" push at 75 min if not already sent
#   • fires an "over" push at 90 min if not already sent
# Sent state is tracked in the log's `alerts_sent` array so notifications
# are never duplicated, even across server restarts.
import logging  # noqa: E402
from routes.push import send_push_to_location  # noqa: E402

_logger = logging.getLogger("cooling-alarms")


def run_cooling_alarm_sweep():
    try:
        now = datetime.now(timezone.utc)
        cursor = logs_collection.find({"status": "cooling"}, {"_id": 0})
        for log in cursor:
            try:
                started = datetime.fromisoformat(log["started_at"].replace("Z", "+00:00"))
            except Exception:
                continue
            age_min = (now - started).total_seconds() / 60.0
            sent = set(log.get("alerts_sent") or [])
            target = log.get("target_temp_c", 8)
            item = log.get("item_name", "Cooling item")
            url = "/jkhive/cooking-cooling"

            if age_min >= 75 and "warn" not in sent:
                send_push_to_location(log["location_id"], {
                    "title": f"{item} — 15 min left",
                    "body": f"Cool to {target}°C or lower in the next 15 minutes.",
                    "tag": f"cooling-{log['id']}-warn",
                    "url": url,
                })
                sent.add("warn")
            if age_min >= 90 and "over" not in sent:
                send_push_to_location(log["location_id"], {
                    "title": f"{item} OVERDUE",
                    "body": "Cooling has exceeded 90 min — record the temperature now.",
                    "tag": f"cooling-{log['id']}-over",
                    "url": url,
                })
                sent.add("over")

            if sent != set(log.get("alerts_sent") or []):
                logs_collection.update_one({"id": log["id"]}, {"$set": {"alerts_sent": list(sent)}})
    except Exception as e:
        _logger.exception("cooling alarm sweep failed: %s", e)
