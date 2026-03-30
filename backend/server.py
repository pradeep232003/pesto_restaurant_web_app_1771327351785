from dotenv import load_dotenv
load_dotenv()

import os
from pathlib import Path
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from db import (
    locations_collection, menu_items_collection, users_collection,
    customers_collection, orders_collection, site_settings_collection,
    login_attempts_collection,
)
from auth import hash_password, verify_password

# ============== APP INIT ==============

app = FastAPI(title="Pesto Restaurant API")

# Resend email configuration
import resend
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

# CORS middleware
_cors_env = os.environ.get("CORS_ORIGINS", "")
_frontend_url = os.environ.get("FRONTEND_URL", "")
CORS_ORIGINS = []
if _cors_env:
    CORS_ORIGINS = [o.strip() for o in _cors_env.split(",") if o.strip()]
if _frontend_url and _frontend_url not in CORS_ORIGINS:
    CORS_ORIGINS.append(_frontend_url.strip().rstrip("/"))

if CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# ============== REGISTER ROUTERS ==============

from routes.auth import router as auth_router
from routes.locations import router as locations_router
from routes.menu import router as menu_router
from routes.residents import router as residents_router
from routes.customers import router as customers_router
from routes.orders import router as orders_router
from routes.settings import router as settings_router
from routes.contact import router as contact_router

app.include_router(auth_router)
app.include_router(locations_router)
app.include_router(menu_router)
app.include_router(residents_router)
app.include_router(customers_router)
app.include_router(orders_router)
app.include_router(settings_router)
app.include_router(contact_router)

# ============== PUBLIC ENDPOINTS ==============

@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}

@app.get("/api/")
async def root():
    return {"message": "Pesto Restaurant API", "version": "2.0"}

# ============== STARTUP (SEED DATA) ==============

@app.on_event("startup")
async def startup_event():
    """Seed database with initial data if empty"""
    users_collection.create_index("email", unique=True)
    login_attempts_collection.create_index("identifier")
    customers_collection.create_index("email", unique=True)
    customers_collection.create_index("phone")
    orders_collection.create_index("order_number", unique=True)
    orders_collection.create_index("customer_id")
    orders_collection.create_index("location_id")
    site_settings_collection.create_index("location_id", unique=True)

    if locations_collection.count_documents({}) == 0:
        seed_data()

    seed_admin()
    seed_site_settings()

    # Migration: ensure all locations have new fields
    locations_collection.update_many({"wallet_enabled": {"$exists": False}}, {"$set": {"wallet_enabled": False}})
    locations_collection.update_many(
        {"id": {"$in": ["oakmere-handforth", "willowmere-middlewich"]}, "wallet_enabled": False},
        {"$set": {"wallet_enabled": True}},
    )
    locations_collection.update_many({"reservation_enabled": {"$exists": False}}, {"$set": {"reservation_enabled": False}})
    locations_collection.update_many(
        {"id": {"$in": ["oakmere-handforth", "willowmere-middlewich"]}},
        {"$set": {"reservation_enabled": True}},
    )
    locations_collection.update_many({"phone": {"$exists": False}}, {"$set": {"phone": ""}})
    phone_map = {
        "timperley-altrincham": "0161 883 3707",
        "howe-bridge-atherton": "0194 240 4322",
        "chaddesden-derby": "0133 246 0708",
        "oakmere-handforth": "0162 552 5168",
        "willowmere-middlewich": "0160 683 5413",
    }
    for loc_id, phone in phone_map.items():
        locations_collection.update_one({"id": loc_id}, {"$set": {"phone": phone}})
    locations_collection.update_many({"google_place_id": {"$exists": False}}, {"$set": {"google_place_id": ""}})
    locations_collection.update_many({"google_api_key": {"$exists": False}}, {"$set": {"google_api_key": ""}})


def seed_admin():
    """Seed admin user from environment variables"""
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@jollys.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin123!")

    existing = users_collection.find_one({"email": admin_email})
    if existing is None:
        hashed = hash_password(admin_password)
        users_collection.insert_one({
            "email": admin_email,
            "password_hash": hashed,
            "name": "Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc),
        })
        print(f"Admin user created: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        users_collection.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}},
        )
        print(f"Admin password updated: {admin_email}")

    os.makedirs("/app/memory", exist_ok=True)
    with open("/app/memory/test_credentials.md", "w") as f:
        f.write("# Test Credentials\n\n")
        f.write("## Admin Account\n")
        f.write(f"- Email: {admin_email}\n")
        f.write(f"- Password: {admin_password}\n")
        f.write("- Role: admin\n\n")
        f.write("## Auth Endpoints\n")
        f.write("- POST /api/auth/login\n")
        f.write("- POST /api/auth/logout\n")
        f.write("- GET /api/auth/me\n")
        f.write("- POST /api/auth/refresh\n")


def seed_site_settings():
    """Seed default site settings for all locations"""
    default_hours = {
        "monday": {"open": "08:00", "close": "17:00"},
        "tuesday": {"open": "08:00", "close": "17:00"},
        "wednesday": {"open": "08:00", "close": "17:00"},
        "thursday": {"open": "08:00", "close": "17:00"},
        "friday": {"open": "08:00", "close": "18:00"},
        "saturday": {"open": "09:00", "close": "16:00"},
        "sunday": {"open": "10:00", "close": "15:00"},
    }
    location_ids = ["timperley-altrincham", "howe-bridge-atherton", "chaddesden-derby", "oakmere-handforth", "willowmere-middlewich"]
    for loc_id in location_ids:
        if site_settings_collection.find_one({"location_id": loc_id}) is None:
            site_settings_collection.insert_one({
                "location_id": loc_id,
                "ordering_enabled": True,
                "manual_override": False,
                "opening_hours": default_hours,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })
    print("Site settings seeded")


def seed_data():
    """Seed the database with restaurant data"""
    locations = [
        {"id": "timperley-altrincham", "name": "Timperley, Altrincham", "slug": "timperley-altrincham", "address": "Timperley, Altrincham", "is_active": True, "sort_order": 1, "wallet_enabled": False},
        {"id": "howe-bridge-atherton", "name": "Howe Bridge, Atherton", "slug": "howe-bridge-atherton", "address": "Howe Bridge, Atherton", "is_active": True, "sort_order": 2, "wallet_enabled": False},
        {"id": "chaddesden-derby", "name": "Chaddesden, Derby", "slug": "chaddesden-derby", "address": "Chaddesden, Derby", "is_active": True, "sort_order": 3, "wallet_enabled": False},
        {"id": "oakmere-handforth", "name": "Oakmere, Handforth", "slug": "oakmere-handforth", "address": "Oakmere, Handforth", "is_active": True, "sort_order": 4, "wallet_enabled": True},
        {"id": "willowmere-middlewich", "name": "Willowmere, Middlewich", "slug": "willowmere-middlewich", "address": "Willowmere, Middlewich", "is_active": True, "sort_order": 5, "wallet_enabled": True},
    ]
    locations_collection.insert_many(locations)

    menu_items = [
        {"id": "1", "location_id": "timperley-altrincham", "name": "Truffle Mushroom Risotto", "subtitle": "Creamy Arborio rice with wild mushrooms", "description": "A rich and creamy risotto made with Arborio rice, wild mushrooms, truffle oil, and Parmesan cheese.", "price": 28.99, "original_price": 32.99, "image_url": "https://images.unsplash.com/photo-1692348023709-47ff577f7277", "image_alt": "Creamy mushroom risotto garnished with fresh herbs", "category": "mains", "categories": ["lunch", "dinner", "mains"], "dietary": ["vegetarian", "gluten-free"], "tags": ["signature", "premium"], "featured": True, "rating": 4.8, "review_count": 124, "prep_time": 25, "is_available": True},
        {"id": "2", "location_id": "timperley-altrincham", "name": "Grilled Atlantic Salmon", "subtitle": "Fresh salmon with lemon herb butter", "description": "Fresh Atlantic salmon grilled to perfection with seasonal vegetables and roasted potatoes.", "price": 34.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1722865382854-c2ac135189f5", "image_alt": "Grilled salmon fillet with roasted vegetables", "category": "mains", "categories": ["lunch", "dinner", "mains"], "dietary": ["gluten-free", "keto"], "tags": ["healthy", "protein-rich"], "featured": False, "rating": 4.6, "review_count": 89, "prep_time": 20, "is_available": True},
        {"id": "3", "location_id": "timperley-altrincham", "name": "Crispy Calamari Rings", "subtitle": "Golden fried squid with marinara", "description": "Fresh squid rings lightly battered and fried to golden perfection with house-made marinara sauce.", "price": 16.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1639024469010-44d77e559f7d", "image_alt": "Golden-brown crispy calamari rings with marinara", "category": "appetizers", "categories": ["lunch", "appetizer"], "dietary": [], "tags": ["crispy", "seafood"], "featured": True, "rating": 4.4, "review_count": 156, "prep_time": 12, "is_available": True},
        {"id": "4", "location_id": "timperley-altrincham", "name": "Classic Tiramisu", "subtitle": "Traditional Italian dessert", "description": "Layers of coffee-soaked ladyfingers and mascarpone cream, dusted with cocoa powder.", "price": 12.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1712262582604-4cbafeeca156", "image_alt": "Slice of tiramisu with distinct layers", "category": "desserts", "categories": ["dessert"], "dietary": ["vegetarian"], "tags": ["traditional", "coffee"], "featured": False, "rating": 4.7, "review_count": 203, "prep_time": 5, "is_available": True},
        {"id": "5", "location_id": "timperley-altrincham", "name": "Craft Beer Selection", "subtitle": "Local brewery favorites", "description": "Rotating selection of craft beers from local breweries.", "price": 8.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1565291133543-2c86c724f847", "image_alt": "Three different craft beer glasses", "category": "beverages", "categories": ["beverage"], "dietary": ["vegan"], "tags": ["local", "craft"], "featured": True, "rating": 4.3, "review_count": 67, "prep_time": 2, "is_available": True},
        {"id": "6", "location_id": "timperley-altrincham", "name": "Chocolate Lava Cake", "subtitle": "Warm cake with molten center", "description": "Decadent chocolate cake with a molten chocolate center, served with vanilla ice cream.", "price": 11.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1457823622778-ccdb4b7aa62d", "image_alt": "Chocolate lava cake with molten chocolate flowing out", "category": "desserts", "categories": ["dessert"], "dietary": ["vegetarian"], "tags": ["warm", "chocolate"], "featured": True, "rating": 4.9, "review_count": 287, "prep_time": 8, "is_available": True},
        {"id": "7", "location_id": "timperley-altrincham", "name": "Buffalo Chicken Wings", "subtitle": "Spicy wings with blue cheese", "description": "Crispy chicken wings tossed in our signature buffalo sauce with celery sticks.", "price": 15.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1624726175512-19b9baf9fbd1", "image_alt": "Golden-brown buffalo chicken wings", "category": "appetizers", "categories": ["lunch", "appetizer"], "dietary": ["gluten-free"], "tags": ["spicy", "wings"], "featured": False, "rating": 4.3, "review_count": 178, "prep_time": 15, "is_available": True},
        {"id": "8", "location_id": "timperley-altrincham", "name": "Fresh Fruit Smoothie", "subtitle": "Blend of seasonal fruits", "description": "Refreshing smoothie made with seasonal fresh fruits, yogurt, and honey.", "price": 7.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1662130187270-a4d52c700eb6", "image_alt": "Three colorful fruit smoothies in tall glasses", "category": "beverages", "categories": ["breakfast", "beverage"], "dietary": ["vegetarian", "gluten-free"], "tags": ["healthy", "fresh"], "featured": False, "rating": 4.1, "review_count": 45, "prep_time": 5, "is_available": True},
        {"id": "9", "location_id": "howe-bridge-atherton", "name": "BBQ Pulled Pork Sandwich", "subtitle": "Slow-cooked pork with house BBQ sauce", "description": "Tender pulled pork slow-cooked for 12 hours and tossed in our signature BBQ sauce on a brioche bun.", "price": 18.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1545196353-e431cf8d0803", "image_alt": "BBQ pulled pork sandwich on brioche bun", "category": "mains", "categories": ["lunch", "dinner", "mains"], "dietary": [], "tags": ["bbq", "comfort"], "featured": True, "rating": 4.4, "review_count": 112, "prep_time": 18, "is_available": True},
        {"id": "10", "location_id": "howe-bridge-atherton", "name": "Spinach & Artichoke Dip", "subtitle": "Creamy dip with tortilla chips", "description": "Our signature creamy spinach and artichoke dip served hot with crispy tortilla chips.", "price": 14.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1703219339970-98cd69cc896f", "image_alt": "Creamy spinach artichoke dip in cast iron skillet", "category": "appetizers", "categories": ["lunch", "appetizer"], "dietary": ["vegetarian"], "tags": ["sharing", "comfort"], "featured": False, "rating": 4.2, "review_count": 134, "prep_time": 10, "is_available": True},
        {"id": "11", "location_id": "howe-bridge-atherton", "name": "Mediterranean Quinoa Bowl", "subtitle": "Healthy grain bowl with fresh vegetables", "description": "Nutritious quinoa bowl topped with roasted vegetables, chickpeas, feta cheese, and tahini dressing.", "price": 19.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1623428187969-5da2dcea5ebf", "image_alt": "Colorful quinoa bowl with roasted vegetables", "category": "mains", "categories": ["lunch", "dinner", "mains"], "dietary": ["vegetarian", "gluten-free"], "tags": ["healthy", "mediterranean"], "featured": False, "rating": 4.5, "review_count": 91, "prep_time": 15, "is_available": True},
        {"id": "12", "location_id": "howe-bridge-atherton", "name": "Vanilla Bean Creme Brulee", "subtitle": "Classic French dessert", "description": "Rich vanilla custard topped with caramelized sugar, served with fresh seasonal berries.", "price": 13.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1607235780843-a196b94386b4", "image_alt": "Creme brulee in white ramekin with caramelized sugar", "category": "desserts", "categories": ["dessert"], "dietary": ["vegetarian", "gluten-free"], "tags": ["french", "classic"], "featured": False, "rating": 4.6, "review_count": 95, "prep_time": 3, "is_available": True},
        {"id": "13", "location_id": "howe-bridge-atherton", "name": "Grilled Chicken Burger", "subtitle": "Juicy chicken with house sauce", "description": "Tender grilled chicken breast with lettuce, tomato, and our signature house sauce on a toasted bun.", "price": 16.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd", "image_alt": "Grilled chicken burger with fresh toppings", "category": "mains", "categories": ["lunch", "dinner", "mains"], "dietary": [], "tags": ["grilled", "popular"], "featured": True, "rating": 4.5, "review_count": 201, "prep_time": 15, "is_available": True},
        {"id": "14", "location_id": "howe-bridge-atherton", "name": "Iced Latte", "subtitle": "Smooth cold coffee with milk", "description": "Freshly brewed espresso poured over ice with your choice of milk.", "price": 5.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1461023058943-07fcbe16d735", "image_alt": "Iced latte in tall glass with ice", "category": "beverages", "categories": ["breakfast", "beverage"], "dietary": ["vegetarian"], "tags": ["coffee", "cold"], "featured": True, "rating": 4.7, "review_count": 312, "prep_time": 3, "is_available": True},
        {"id": "15", "location_id": "chaddesden-derby", "name": "Fish and Chips", "subtitle": "Classic British favourite", "description": "Beer-battered cod fillet served with thick-cut chips, mushy peas, and tartar sauce.", "price": 17.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1579208570378-8c970854bc23", "image_alt": "Classic fish and chips with mushy peas", "category": "mains", "categories": ["lunch", "dinner", "mains"], "dietary": [], "tags": ["classic", "british"], "featured": True, "rating": 4.7, "review_count": 345, "prep_time": 20, "is_available": True},
        {"id": "16", "location_id": "chaddesden-derby", "name": "Chicken Tikka Masala", "subtitle": "Rich and creamy curry", "description": "Tender chicken pieces in a rich, creamy tomato-based sauce with aromatic spices. Served with basmati rice.", "price": 16.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1565557623262-b51c2513a641", "image_alt": "Chicken tikka masala with basmati rice", "category": "mains", "categories": ["lunch", "dinner", "mains"], "dietary": ["gluten-free"], "tags": ["curry", "spicy"], "featured": True, "rating": 4.8, "review_count": 289, "prep_time": 25, "is_available": True},
        {"id": "17", "location_id": "chaddesden-derby", "name": "Sticky Toffee Pudding", "subtitle": "Warm British classic", "description": "Moist sponge pudding drenched in warm toffee sauce, served with vanilla ice cream.", "price": 9.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e", "image_alt": "Sticky toffee pudding with toffee sauce", "category": "desserts", "categories": ["dessert"], "dietary": ["vegetarian"], "tags": ["british", "warm"], "featured": True, "rating": 4.9, "review_count": 198, "prep_time": 10, "is_available": True},
        {"id": "18", "location_id": "chaddesden-derby", "name": "English Breakfast Tea", "subtitle": "Traditional loose-leaf brew", "description": "A proper cup of English Breakfast tea served with milk and your choice of sweetener.", "price": 3.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1556679343-c7306c1976bc", "image_alt": "English breakfast tea in white ceramic cup", "category": "beverages", "categories": ["breakfast", "beverage"], "dietary": ["vegan", "gluten-free"], "tags": ["tea", "british"], "featured": False, "rating": 4.5, "review_count": 156, "prep_time": 5, "is_available": True},
        {"id": "19", "location_id": "oakmere-handforth", "name": "Avocado Toast", "subtitle": "Smashed avocado on sourdough", "description": "Creamy smashed avocado on toasted sourdough with cherry tomatoes, feta, and a poached egg.", "price": 13.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1541519227354-08fa5d50c820", "image_alt": "Avocado toast on sourdough with poached egg", "category": "appetizers", "categories": ["breakfast", "mains"], "dietary": ["vegetarian"], "tags": ["healthy", "brunch"], "featured": True, "rating": 4.6, "review_count": 234, "prep_time": 10, "is_available": True},
        {"id": "20", "location_id": "oakmere-handforth", "name": "Pesto Pasta", "subtitle": "Fresh basil pesto with linguine", "description": "Al dente linguine tossed in our house-made basil pesto with pine nuts and Parmesan shavings.", "price": 15.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1473093295043-cdd812d0e601", "image_alt": "Pesto pasta with pine nuts and parmesan", "category": "mains", "categories": ["lunch", "dinner", "mains"], "dietary": ["vegetarian"], "tags": ["pasta", "italian"], "featured": True, "rating": 4.5, "review_count": 167, "prep_time": 15, "is_available": True},
        {"id": "21", "location_id": "oakmere-handforth", "name": "Halloumi Fries", "subtitle": "Crispy fried halloumi with dip", "description": "Golden-fried halloumi sticks served with sweet chilli dipping sauce and fresh mint yoghurt.", "price": 11.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1601050690597-df0568f70950", "image_alt": "Crispy halloumi fries with dipping sauce", "category": "appetizers", "categories": ["lunch", "appetizer"], "dietary": ["vegetarian", "gluten-free"], "tags": ["crispy", "cheese"], "featured": True, "rating": 4.7, "review_count": 289, "prep_time": 10, "is_available": True},
        {"id": "22", "location_id": "oakmere-handforth", "name": "Matcha Latte", "subtitle": "Japanese green tea with steamed milk", "description": "Premium ceremonial grade matcha whisked with steamed oat milk. Available hot or iced.", "price": 5.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1536256263959-770b48d82b0a", "image_alt": "Matcha latte in ceramic cup with latte art", "category": "beverages", "categories": ["breakfast", "beverage"], "dietary": ["vegan"], "tags": ["matcha", "healthy"], "featured": False, "rating": 4.5, "review_count": 178, "prep_time": 5, "is_available": True},
        {"id": "23", "location_id": "oakmere-handforth", "name": "Lemon Tart", "subtitle": "Zesty French-style tart", "description": "Crisp pastry shell filled with silky smooth lemon curd, topped with fresh raspberries and icing sugar.", "price": 8.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1519915028121-7d3463d20b13", "image_alt": "Lemon tart with raspberries and icing sugar", "category": "desserts", "categories": ["dessert"], "dietary": ["vegetarian"], "tags": ["citrus", "french"], "featured": True, "rating": 4.8, "review_count": 156, "prep_time": 5, "is_available": True},
        {"id": "24", "location_id": "willowmere-middlewich", "name": "Sunday Roast", "subtitle": "Traditional roast with all the trimmings", "description": "Slow-roasted beef served with roast potatoes, Yorkshire pudding, seasonal vegetables, and rich gravy.", "price": 22.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1544025162-d76694265947", "image_alt": "Traditional Sunday roast with Yorkshire pudding", "category": "mains", "categories": ["lunch", "dinner", "mains"], "dietary": [], "tags": ["traditional", "sunday"], "featured": True, "rating": 4.9, "review_count": 412, "prep_time": 35, "is_available": True},
        {"id": "25", "location_id": "willowmere-middlewich", "name": "Homemade Soup of the Day", "subtitle": "Fresh seasonal soup", "description": "Our chef's daily soup made with fresh seasonal ingredients, served with crusty bread and butter.", "price": 8.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1547592180-85f173990554", "image_alt": "Bowl of homemade soup with crusty bread", "category": "appetizers", "categories": ["lunch", "dinner", "appetizer"], "dietary": ["vegetarian"], "tags": ["seasonal", "homemade"], "featured": False, "rating": 4.5, "review_count": 234, "prep_time": 10, "is_available": True},
        {"id": "26", "location_id": "willowmere-middlewich", "name": "Beef Lasagne", "subtitle": "Hearty Italian classic", "description": "Layers of slow-cooked beef ragu, bechamel sauce, and pasta sheets, topped with melted mozzarella.", "price": 17.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1574894709920-11b28e7367e3", "image_alt": "Beef lasagne with melted cheese on top", "category": "mains", "categories": ["lunch", "dinner", "mains"], "dietary": [], "tags": ["italian", "comfort"], "featured": True, "rating": 4.7, "review_count": 198, "prep_time": 25, "is_available": True},
        {"id": "27", "location_id": "willowmere-middlewich", "name": "Scones with Clotted Cream", "subtitle": "Traditional afternoon tea treat", "description": "Freshly baked plain and fruit scones served with clotted cream and strawberry jam.", "price": 7.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1558961363-fa8fdf82db35", "image_alt": "Freshly baked scones with clotted cream and jam", "category": "desserts", "categories": ["breakfast", "dessert"], "dietary": ["vegetarian"], "tags": ["afternoon-tea", "british"], "featured": True, "rating": 4.8, "review_count": 267, "prep_time": 5, "is_available": True},
        {"id": "28", "location_id": "willowmere-middlewich", "name": "Hot Chocolate", "subtitle": "Rich and indulgent", "description": "Velvety hot chocolate made with premium Belgian chocolate, topped with whipped cream and marshmallows.", "price": 4.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed", "image_alt": "Rich hot chocolate with whipped cream and marshmallows", "category": "beverages", "categories": ["breakfast", "beverage"], "dietary": ["vegetarian"], "tags": ["chocolate", "warm"], "featured": False, "rating": 4.6, "review_count": 189, "prep_time": 5, "is_available": True},
    ]
    menu_items_collection.insert_many(menu_items)
    print("Database seeded successfully!")


# ============== SERVE FRONTEND (PRODUCTION) ==============

FRONTEND_BUILD_DIR = Path(__file__).resolve().parent.parent / "frontend" / "build"
if not FRONTEND_BUILD_DIR.exists():
    FRONTEND_BUILD_DIR = Path(__file__).resolve().parent / "frontend" / "build"
if FRONTEND_BUILD_DIR.exists():
    from fastapi.responses import FileResponse
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_BUILD_DIR / "assets")), name="frontend_assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        """Serve React frontend for all non-API routes"""
        file_path = FRONTEND_BUILD_DIR / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(FRONTEND_BUILD_DIR / "index.html")
