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
    "Beef":                {"icon": "🐄", "section": "Fresh", "items": ["Brisket", "Chuck", "Diced", "Fillet", "Flank", "Mince", "Ribeye", "Rump", "Sirloin", "Stewing"]},
    "Berries":             {"icon": "🫐", "section": "Fresh", "items": ["Strawberries", "Raspberries", "Blueberries", "Blackberries", "Redcurrants", "Gooseberries"]},
    "Butter & Creams":     {"icon": "🧈", "section": "Fresh", "items": ["Salted butter", "Unsalted butter", "Clarified butter", "Single cream", "Double cream", "Whipping cream", "Crème fraîche", "Sour cream"]},
    "Cheese":              {"icon": "🧀", "section": "Fresh", "items": ["Cheddar", "Mozzarella", "Parmesan", "Feta", "Halloumi", "Brie", "Goat's cheese", "Stilton", "Cream cheese"]},
    "Chicken":             {"icon": "🐔", "section": "Fresh", "items": ["Breast", "Drum stick", "Fillet", "Fronts", "Gizzard", "Heart", "Leg", "Liver", "Supremes", "Thigh", "Wing", "Whole bird"]},
    "Citrus":              {"icon": "🍊", "section": "Fresh", "items": ["Lemons", "Limes", "Oranges", "Grapefruit", "Mandarins", "Clementines", "Kumquats"]},
    "Crustaceans":         {"icon": "🦞", "section": "Fresh", "items": ["Prawns", "King prawns", "Langoustine", "Lobster", "Crab", "Crayfish"]},
    "Eggs":                {"icon": "🥚", "section": "Fresh", "items": ["Whole", "Yolks", "Whites"]},
    "Fish (other)":        {"icon": "🎣", "section": "Fresh", "items": ["Anchovy", "Cod", "Haddock", "Sardine", "Tuna"]},
    "Flat Fish":           {"icon": "🐟", "section": "Fresh", "items": ["Sole", "Plaice", "Halibut", "Turbot"]},
    "Fresh Herbs":         {"icon": "🌿", "section": "Fresh", "items": ["Parsley", "Coriander", "Basil", "Mint", "Chives", "Dill", "Thyme", "Rosemary", "Tarragon"]},
    "Fruit (other)":       {"icon": "🍐", "section": "Fresh", "items": ["Apples", "Pears", "Grapes", "Pomegranate", "Figs", "Cherries", "Quince"]},
    "Game":                {"icon": "🦌", "section": "Fresh", "items": ["Venison", "Pheasant", "Rabbit", "Duck (game)", "Partridge"]},
    "Greens":              {"icon": "🥬", "section": "Fresh", "items": ["Spinach", "Kale", "Cabbage", "Pak choi", "Chard", "Lettuce", "Rocket", "Broccoli", "Cauliflower"]},
    "Lamb":                {"icon": "🐑", "section": "Fresh", "items": ["Leg", "Shoulder", "Mince", "Chops", "Rack", "Diced"]},
    "Meat Alternatives":   {"icon": "🌱", "section": "Fresh", "items": ["Tofu", "Tempeh", "Seitan", "Quorn", "Vegan mince", "Vegan sausages"]},
    "Melons":              {"icon": "🍈", "section": "Fresh", "items": ["Watermelon", "Cantaloupe", "Honeydew", "Galia", "Charentais"]},
    "Milk":                {"icon": "🥛", "section": "Fresh", "items": ["Whole", "Semi-skimmed", "Skimmed", "Buttermilk", "Oat milk", "Almond milk", "Soy milk"]},
    "Molluscs":            {"icon": "🦑", "section": "Fresh", "items": ["Squid", "Octopus", "Mussels", "Clams", "Oysters", "Scallops", "Whelks"]},
    "Mushrooms":           {"icon": "🍄", "section": "Fresh", "items": ["Button", "Chestnut", "Portobello", "Oyster", "Shiitake", "Wild", "Truffle"]},
    "Pork":                {"icon": "🐷", "section": "Fresh", "items": ["Belly", "Loin", "Mince", "Sausages", "Ribs", "Shoulder", "Bacon"]},
    "Roots":               {"icon": "🥕", "section": "Fresh", "items": ["Carrots", "Parsnips", "Potatoes", "Sweet potatoes", "Beetroot", "Celeriac", "Turnip", "Swede", "Radish", "Ginger"]},
    "Round Fish":          {"icon": "🐠", "section": "Fresh", "items": ["Salmon", "Sea bass", "Mackerel", "Trout"]},
    "Salad":               {"icon": "🥗", "section": "Fresh", "items": ["Mixed leaves", "Cos", "Iceberg", "Watercress", "Spinach (baby)", "Tomatoes", "Cucumber", "Peppers"]},
    "Stone Fruit":         {"icon": "🍑", "section": "Fresh", "items": ["Peaches", "Nectarines", "Plums", "Apricots", "Cherries", "Mangoes", "Avocado"]},
    "Tropical Fruit":      {"icon": "🍍", "section": "Fresh", "items": ["Pineapple", "Mango", "Papaya", "Banana", "Passion fruit", "Lychee", "Dragon fruit", "Coconut"]},
    "Turkey":              {"icon": "🦃", "section": "Fresh", "items": ["Breast", "Whole bird", "Mince", "Crown"]},
    "Yoghurt":             {"icon": "🥛", "section": "Fresh", "items": ["Natural", "Greek", "Greek-style", "Low-fat", "Coconut", "Soya"]},

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
    "Snacks":                  {"icon": "🍿", "section": "Dry", "items": ["Crisps", "Tortilla chips", "Popcorn", "Pretzels", "Snack bars", "Rice cakes", "Bombay mix"]},
    "Tinned":                  {"icon": "🥫", "section": "Dry", "items": ["Chopped tomatoes", "Plum tomatoes", "Tomato purée", "Beans (baked)", "Beans (kidney)", "Chickpeas", "Tuna", "Sweetcorn", "Coconut milk", "Soup"]},

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
    "Prepared Fish":           {"icon": "🐟", "section": "Prepared", "items": ["Smoked salmon", "Smoked mackerel", "Smoked haddock", "Cured salmon (gravlax)", "Marinated anchovies", "Pickled herring", "Tuna (cooked)"]},
    "Prepared Shellfish":      {"icon": "🦪", "section": "Prepared", "items": ["Cooked mussels", "Cooked clams", "Cooked oysters", "Cooked scallops", "Cooked squid", "Cooked octopus"]},
    "Prepped Vegetables":      {"icon": "🥗", "section": "Prepared", "items": ["Diced onion", "Sliced peppers", "Roasted vegetables", "Mashed potato", "Blanched greens", "Shredded carrot", "Stir-fry mix"]},
    "Purees and Gels":         {"icon": "🧪", "section": "Prepared", "items": ["Pea purée", "Carrot purée", "Beetroot purée", "Cauliflower purée", "Fruit gel", "Reduction gel", "Coulis"]},
    "Salad":                   {"icon": "🥗", "section": "Prepared", "items": ["Coleslaw", "Pasta salad", "Potato salad", "Caesar salad", "Greek salad", "Quinoa salad", "Couscous salad"]},
    "Sauces":                  {"icon": "🥫", "section": "Prepared", "items": ["Tomato sauce", "Béchamel", "Hollandaise", "Bolognese", "Curry sauce", "Pesto", "Gravy", "Bbq sauce"]},
    "Sides":                   {"icon": "🍟", "section": "Prepared", "items": ["Chips", "Roast potatoes", "Mash", "Rice (cooked)", "Pasta (cooked)", "Bread basket", "Garlic bread", "Onion rings"]},
    "Soups":                   {"icon": "🍲", "section": "Prepared", "items": ["Tomato soup", "Chicken soup", "Vegetable soup", "Lentil soup", "Mushroom soup", "Minestrone", "Bisque", "Broth"]},
    "Spreads":                 {"icon": "🍯", "section": "Prepared", "items": ["Butter (whipped)", "Pâté", "Hummus", "Tapenade", "Cream cheese spread", "Peanut butter", "Nut butter", "Chocolate spread"]},
    "Stocks":                  {"icon": "🥣", "section": "Prepared", "items": ["Chicken stock", "Beef stock", "Vegetable stock", "Fish stock", "Lamb stock", "Mushroom stock", "Demi-glace"]},
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
    "Squash and Cordials":     {"icon": "🧃", "section": "Beverages", "items": ["Orange squash", "Blackcurrant squash", "Lemon squash", "Apple squash", "Elderflower cordial", "Lime cordial", "Ginger cordial"]},
    "Tea":                     {"icon": "🫖", "section": "Beverages", "items": ["English breakfast", "Earl grey", "Green tea", "Peppermint", "Chamomile", "Rooibos", "Fruit tea", "Chai"]},
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

    # Auto-log a corrective action if this cooling failed either the
    # target temperature or the 90-minute FSA rule.
    try:
        from routes.corrective_actions import auto_log_failure
        target = existing.get("target_temp_c", 8.0)
        started_iso = existing.get("started_at") or ""
        completed_iso = upd["completed_at"]
        elapsed_min = None
        try:
            started_dt = datetime.fromisoformat(started_iso.replace("Z", "+00:00"))
            completed_dt = datetime.fromisoformat(completed_iso.replace("Z", "+00:00"))
            elapsed_min = (completed_dt - started_dt).total_seconds() / 60.0
        except Exception:
            elapsed_min = None
        failures = []
        if body.end_temp_c > target:
            failures.append(f"end temp {body.end_temp_c:.1f}°C (target ≤ {target:.1f}°C)")
        if elapsed_min is not None and elapsed_min > 90:
            failures.append(f"cooled in {elapsed_min:.0f} min (FSA limit 90 min)")
        if failures:
            auto_log_failure(
                location_id=existing["location_id"],
                category="cooking_cooling",
                item=existing.get("item_name", ""),
                failure_description=(
                    f"Cooling of \"{existing.get('item_name', '')}\": {', '.join(failures)}."
                    + (f" Comment: {body.comment}" if body.comment else "")
                ),
                source_key=f"cooling:{log_id}",
                logged_by_email=user.get("email", "system"),
                logged_by_name=user.get("name") or "System (auto)",
            )
    except Exception as ex:  # pragma: no cover
        import logging as _l
        _l.getLogger("cooking_cooling").warning("auto-log corrective failed: %s", ex)

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



class NoBulkPrepBody(BaseModel):
    location_id: str
    comment: Optional[str] = ""


@router.post("/no-bulk-prep")
async def record_no_bulk_prep(body: NoBulkPrepBody, user: dict = Depends(get_staff_or_above)):
    """Log that no bulk prep / cooking happened today (HACCP audit trail).

    Idempotent per location per day — returns the existing record if one
    already exists rather than creating a duplicate.
    """
    today_str = datetime.now(timezone.utc).date().isoformat()
    existing = logs_collection.find_one({
        "location_id": body.location_id,
        "kind": "no_bulk_prep",
        "started_at": {"$gte": today_str + "T00:00:00", "$lt": today_str + "T23:59:59"},
    }, {"_id": 0})
    if existing:
        return existing
    doc = {
        "id": str(uuid.uuid4())[:12],
        "location_id": body.location_id,
        "kind": "no_bulk_prep",
        "item_name": "No bulk prep today",
        "item_category": "",
        "status": "complete",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "comment": body.comment or "",
        "recorded_by": user.get("email", ""),
        "recorded_by_name": user.get("name", ""),
    }
    logs_collection.insert_one(dict(doc))
    return {k: v for k, v in doc.items() if k != "_id"}
