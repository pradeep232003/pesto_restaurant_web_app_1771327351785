from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException, Request, Response, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pymongo import MongoClient
from bson import ObjectId
import os
import asyncio
import resend
from pathlib import Path
from typing import List, Optional
from pydantic import BaseModel, EmailStr
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import uuid
from PIL import Image as PILImage
import io

app = FastAPI(title="Pesto Restaurant API")

# Resend email configuration
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

# CORS middleware - allow frontend origins with credentials
_cors_env = os.environ.get("CORS_ORIGINS", "")
if _cors_env:
    CORS_ORIGINS = [o.strip() for o in _cors_env.split(",") if o.strip()]
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
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# MongoDB connection
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "pesto_restaurant")

client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)
db = client[DB_NAME]

# Collections
locations_collection = db["locations"]
menu_items_collection = db["menu_items"]
users_collection = db["users"]
login_attempts_collection = db["login_attempts"]
residents_collection = db["residents"]
transactions_collection = db["transactions"]
customers_collection = db["customers"]
orders_collection = db["orders"]
site_settings_collection = db["site_settings"]
images_collection = db["images"]

# JWT Configuration
JWT_SECRET = os.environ.get("JWT_SECRET", "fallback-secret-change-in-production")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
REFRESH_TOKEN_EXPIRE_DAYS = 7

# Cookie settings - cross-origin safe when CORS_ORIGINS is set (production)
IS_PRODUCTION = bool(os.environ.get("CORS_ORIGINS"))
COOKIE_SECURE = IS_PRODUCTION
COOKIE_SAMESITE = "none" if IS_PRODUCTION else "lax"

# Brute force protection settings
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_MINUTES = 15

# ============== PASSWORD HELPERS ==============

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

# ============== JWT HELPERS ==============

def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        "type": "access"
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        "type": "refresh"
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ============== AUTH DEPENDENCY ==============

async def get_current_user(request: Request) -> dict:
    """Get current user from token (cookie or header)"""
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    payload = decode_token(token)
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")
    
    user = users_collection.find_one({"_id": ObjectId(payload["sub"])})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    user["_id"] = str(user["_id"])
    user.pop("password_hash", None)
    return user

async def get_admin_user(request: Request) -> dict:
    """Get current user and verify they are admin"""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# ============== BRUTE FORCE PROTECTION ==============

def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"

def check_brute_force(identifier: str) -> bool:
    """Check if account/IP is locked out. Returns True if locked."""
    attempt = login_attempts_collection.find_one({"identifier": identifier})
    if not attempt:
        return False
    
    if attempt.get("locked_until"):
        # Ensure both datetimes are timezone-aware for comparison
        locked_until = attempt["locked_until"]
        if not hasattr(locked_until, 'tzinfo') or locked_until.tzinfo is None:
            # If stored datetime is naive, assume it's UTC
            locked_until = locked_until.replace(tzinfo=timezone.utc)
        
        if datetime.now(timezone.utc) < locked_until:
            return True
        # Lockout expired, reset
        login_attempts_collection.delete_one({"identifier": identifier})
    return False

def record_failed_attempt(identifier: str):
    """Record a failed login attempt"""
    attempt = login_attempts_collection.find_one({"identifier": identifier})
    if attempt:
        new_count = attempt.get("count", 0) + 1
        update = {"$set": {"count": new_count, "last_attempt": datetime.now(timezone.utc)}}
        if new_count >= MAX_LOGIN_ATTEMPTS:
            update["$set"]["locked_until"] = datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_MINUTES)
        login_attempts_collection.update_one({"identifier": identifier}, update)
    else:
        login_attempts_collection.insert_one({
            "identifier": identifier,
            "count": 1,
            "last_attempt": datetime.now(timezone.utc)
        })

def clear_failed_attempts(identifier: str):
    """Clear failed attempts on successful login"""
    login_attempts_collection.delete_one({"identifier": identifier})

# ============== PYDANTIC MODELS ==============

class Location(BaseModel):
    id: str
    name: str
    slug: str
    address: str
    is_active: bool = True
    sort_order: int = 0
    wallet_enabled: bool = False

class LocationCreate(BaseModel):
    name: str
    address: Optional[str] = ""
    wallet_enabled: bool = False

class LocationUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None
    wallet_enabled: Optional[bool] = None

class MenuItem(BaseModel):
    id: str
    location_id: str
    name: str
    subtitle: Optional[str] = None
    description: Optional[str] = None
    price: float
    original_price: Optional[float] = None
    image_url: Optional[str] = None
    image_alt: Optional[str] = None
    category: str
    categories: List[str] = []
    dietary: List[str] = []
    tags: List[str] = []
    featured: bool = False
    rating: float = 4.0
    review_count: int = 0
    prep_time: int = 15
    is_available: bool = True

class MenuItemCreate(BaseModel):
    location_id: str
    name: str
    subtitle: Optional[str] = None
    description: Optional[str] = None
    price: float
    visitor_price: Optional[float] = None
    original_price: Optional[float] = None
    image_url: Optional[str] = None
    image_alt: Optional[str] = None
    show_image: bool = True
    category: str = "mains"
    categories: List[str] = []
    dietary: List[str] = []
    tags: List[str] = []
    featured: bool = False
    prep_time: int = 15
    is_available: bool = True

class MenuItemUpdate(BaseModel):
    name: Optional[str] = None
    subtitle: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    visitor_price: Optional[float] = None
    original_price: Optional[float] = None
    image_url: Optional[str] = None
    image_alt: Optional[str] = None
    show_image: Optional[bool] = None
    category: Optional[str] = None
    categories: Optional[List[str]] = None
    dietary: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    featured: Optional[bool] = None
    prep_time: Optional[int] = None
    is_available: Optional[bool] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str

# ============== CUSTOMER & ORDER MODELS ==============

class CustomerRegister(BaseModel):
    name: str
    email: EmailStr
    phone: str

class CustomerLogin(BaseModel):
    email: EmailStr
    password: str

class OrderItem(BaseModel):
    menu_item_id: str
    name: str
    price: float
    quantity: int

class OrderCreate(BaseModel):
    location_id: str
    items: List[OrderItem]
    special_instructions: Optional[str] = None

class OrderStatusUpdate(BaseModel):
    status: str  # pending, confirmed, preparing, ready, collected, cancelled

class SiteSettingsUpdate(BaseModel):
    ordering_enabled: Optional[bool] = None
    manual_override: Optional[bool] = None
    opening_hours: Optional[dict] = None  # {"monday": {"open": "08:00", "close": "17:00"}, ...}

# ============== HELPERS ==============

def serialize_doc(doc):
    """Convert MongoDB document to JSON-serializable dict, removing _id"""
    if doc is None:
        return None
    doc.pop("_id", None)
    return doc

def serialize_user(user):
    """Serialize user document for response"""
    return {
        "id": str(user["_id"]),
        "email": user["email"],
        "name": user.get("name", "Admin"),
        "role": user.get("role", "user")
    }

# ============== STARTUP ==============

@app.on_event("startup")
async def startup_event():
    """Seed database with initial data if empty"""
    # Create indexes
    users_collection.create_index("email", unique=True)
    login_attempts_collection.create_index("identifier")
    customers_collection.create_index("email", unique=True)
    customers_collection.create_index("phone")
    orders_collection.create_index("order_number", unique=True)
    orders_collection.create_index("customer_id")
    orders_collection.create_index("location_id")
    site_settings_collection.create_index("location_id", unique=True)
    
    # Seed locations and menu if empty
    if locations_collection.count_documents({}) == 0:
        seed_data()
    
    # Seed admin user
    seed_admin()
    
    # Seed default site settings
    seed_site_settings()
    
    # Ensure all locations have wallet_enabled field
    locations_collection.update_many(
        {"wallet_enabled": {"$exists": False}},
        {"$set": {"wallet_enabled": False}}
    )
    # Set correct wallet_enabled for known wallet locations
    locations_collection.update_many(
        {"id": {"$in": ["oakmere-handforth", "willowmere-middlewich"]}, "wallet_enabled": False},
        {"$set": {"wallet_enabled": True}}
    )

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
            "created_at": datetime.now(timezone.utc)
        })
        print(f"Admin user created: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        # Password changed in env, update it
        users_collection.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}}
        )
        print(f"Admin password updated: {admin_email}")
    
    # Write credentials to test file
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
                "updated_at": datetime.now(timezone.utc).isoformat()
            })
    print("Site settings seeded")

def seed_data():
    """Seed the database with restaurant data"""
    
    # Locations
    locations = [
        {"id": "timperley-altrincham", "name": "Timperley, Altrincham", "slug": "timperley-altrincham", "address": "Timperley, Altrincham", "is_active": True, "sort_order": 1, "wallet_enabled": False},
        {"id": "howe-bridge-atherton", "name": "Howe Bridge, Atherton", "slug": "howe-bridge-atherton", "address": "Howe Bridge, Atherton", "is_active": True, "sort_order": 2, "wallet_enabled": False},
        {"id": "chaddesden-derby", "name": "Chaddesden, Derby", "slug": "chaddesden-derby", "address": "Chaddesden, Derby", "is_active": True, "sort_order": 3, "wallet_enabled": False},
        {"id": "oakmere-handforth", "name": "Oakmere, Handforth", "slug": "oakmere-handforth", "address": "Oakmere, Handforth", "is_active": True, "sort_order": 4, "wallet_enabled": True},
        {"id": "willowmere-middlewich", "name": "Willowmere, Middlewich", "slug": "willowmere-middlewich", "address": "Willowmere, Middlewich", "is_active": True, "sort_order": 5, "wallet_enabled": True},
    ]
    
    locations_collection.insert_many(locations)
    
    # Menu items
    menu_items = [
        # Timperley, Altrincham
        {"id": "1", "location_id": "timperley-altrincham", "name": "Truffle Mushroom Risotto", "subtitle": "Creamy Arborio rice with wild mushrooms", "description": "A rich and creamy risotto made with Arborio rice, wild mushrooms, truffle oil, and Parmesan cheese.", "price": 28.99, "original_price": 32.99, "image_url": "https://images.unsplash.com/photo-1692348023709-47ff577f7277", "image_alt": "Creamy mushroom risotto garnished with fresh herbs", "category": "mains", "categories": ["lunch", "dinner", "mains"], "dietary": ["vegetarian", "gluten-free"], "tags": ["signature", "premium"], "featured": True, "rating": 4.8, "review_count": 124, "prep_time": 25, "is_available": True},
        {"id": "2", "location_id": "timperley-altrincham", "name": "Grilled Atlantic Salmon", "subtitle": "Fresh salmon with lemon herb butter", "description": "Fresh Atlantic salmon grilled to perfection with seasonal vegetables and roasted potatoes.", "price": 34.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1722865382854-c2ac135189f5", "image_alt": "Grilled salmon fillet with roasted vegetables", "category": "mains", "categories": ["lunch", "dinner", "mains"], "dietary": ["gluten-free", "keto"], "tags": ["healthy", "protein-rich"], "featured": False, "rating": 4.6, "review_count": 89, "prep_time": 20, "is_available": True},
        {"id": "3", "location_id": "timperley-altrincham", "name": "Crispy Calamari Rings", "subtitle": "Golden fried squid with marinara", "description": "Fresh squid rings lightly battered and fried to golden perfection with house-made marinara sauce.", "price": 16.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1639024469010-44d77e559f7d", "image_alt": "Golden-brown crispy calamari rings with marinara", "category": "appetizers", "categories": ["lunch", "appetizer"], "dietary": [], "tags": ["crispy", "seafood"], "featured": True, "rating": 4.4, "review_count": 156, "prep_time": 12, "is_available": True},
        {"id": "4", "location_id": "timperley-altrincham", "name": "Classic Tiramisu", "subtitle": "Traditional Italian dessert", "description": "Layers of coffee-soaked ladyfingers and mascarpone cream, dusted with cocoa powder.", "price": 12.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1712262582604-4cbafeeca156", "image_alt": "Slice of tiramisu with distinct layers", "category": "desserts", "categories": ["dessert"], "dietary": ["vegetarian"], "tags": ["traditional", "coffee"], "featured": False, "rating": 4.7, "review_count": 203, "prep_time": 5, "is_available": True},
        {"id": "5", "location_id": "timperley-altrincham", "name": "Craft Beer Selection", "subtitle": "Local brewery favorites", "description": "Rotating selection of craft beers from local breweries.", "price": 8.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1565291133543-2c86c724f847", "image_alt": "Three different craft beer glasses", "category": "beverages", "categories": ["beverage"], "dietary": ["vegan"], "tags": ["local", "craft"], "featured": True, "rating": 4.3, "review_count": 67, "prep_time": 2, "is_available": True},
        {"id": "6", "location_id": "timperley-altrincham", "name": "Chocolate Lava Cake", "subtitle": "Warm cake with molten center", "description": "Decadent chocolate cake with a molten chocolate center, served with vanilla ice cream.", "price": 11.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1457823622778-ccdb4b7aa62d", "image_alt": "Chocolate lava cake with molten chocolate flowing out", "category": "desserts", "categories": ["dessert"], "dietary": ["vegetarian"], "tags": ["warm", "chocolate"], "featured": True, "rating": 4.9, "review_count": 287, "prep_time": 8, "is_available": True},
        {"id": "7", "location_id": "timperley-altrincham", "name": "Buffalo Chicken Wings", "subtitle": "Spicy wings with blue cheese", "description": "Crispy chicken wings tossed in our signature buffalo sauce with celery sticks.", "price": 15.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1624726175512-19b9baf9fbd1", "image_alt": "Golden-brown buffalo chicken wings", "category": "appetizers", "categories": ["lunch", "appetizer"], "dietary": ["gluten-free"], "tags": ["spicy", "wings"], "featured": False, "rating": 4.3, "review_count": 178, "prep_time": 15, "is_available": True},
        {"id": "8", "location_id": "timperley-altrincham", "name": "Fresh Fruit Smoothie", "subtitle": "Blend of seasonal fruits", "description": "Refreshing smoothie made with seasonal fresh fruits, yogurt, and honey.", "price": 7.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1662130187270-a4d52c700eb6", "image_alt": "Three colorful fruit smoothies in tall glasses", "category": "beverages", "categories": ["breakfast", "beverage"], "dietary": ["vegetarian", "gluten-free"], "tags": ["healthy", "fresh"], "featured": False, "rating": 4.1, "review_count": 45, "prep_time": 5, "is_available": True},
        # Howe Bridge, Atherton
        {"id": "9", "location_id": "howe-bridge-atherton", "name": "BBQ Pulled Pork Sandwich", "subtitle": "Slow-cooked pork with house BBQ sauce", "description": "Tender pulled pork slow-cooked for 12 hours and tossed in our signature BBQ sauce on a brioche bun.", "price": 18.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1545196353-e431cf8d0803", "image_alt": "BBQ pulled pork sandwich on brioche bun", "category": "mains", "categories": ["lunch", "dinner", "mains"], "dietary": [], "tags": ["bbq", "comfort"], "featured": True, "rating": 4.4, "review_count": 112, "prep_time": 18, "is_available": True},
        {"id": "10", "location_id": "howe-bridge-atherton", "name": "Spinach & Artichoke Dip", "subtitle": "Creamy dip with tortilla chips", "description": "Our signature creamy spinach and artichoke dip served hot with crispy tortilla chips.", "price": 14.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1703219339970-98cd69cc896f", "image_alt": "Creamy spinach artichoke dip in cast iron skillet", "category": "appetizers", "categories": ["lunch", "appetizer"], "dietary": ["vegetarian"], "tags": ["sharing", "comfort"], "featured": False, "rating": 4.2, "review_count": 134, "prep_time": 10, "is_available": True},
        {"id": "11", "location_id": "howe-bridge-atherton", "name": "Mediterranean Quinoa Bowl", "subtitle": "Healthy grain bowl with fresh vegetables", "description": "Nutritious quinoa bowl topped with roasted vegetables, chickpeas, feta cheese, and tahini dressing.", "price": 19.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1623428187969-5da2dcea5ebf", "image_alt": "Colorful quinoa bowl with roasted vegetables", "category": "mains", "categories": ["lunch", "dinner", "mains"], "dietary": ["vegetarian", "gluten-free"], "tags": ["healthy", "mediterranean"], "featured": False, "rating": 4.5, "review_count": 91, "prep_time": 15, "is_available": True},
        {"id": "12", "location_id": "howe-bridge-atherton", "name": "Vanilla Bean Creme Brulee", "subtitle": "Classic French dessert", "description": "Rich vanilla custard topped with caramelized sugar, served with fresh seasonal berries.", "price": 13.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1607235780843-a196b94386b4", "image_alt": "Creme brulee in white ramekin with caramelized sugar", "category": "desserts", "categories": ["dessert"], "dietary": ["vegetarian", "gluten-free"], "tags": ["french", "classic"], "featured": False, "rating": 4.6, "review_count": 95, "prep_time": 3, "is_available": True},
        {"id": "13", "location_id": "howe-bridge-atherton", "name": "Grilled Chicken Burger", "subtitle": "Juicy chicken with house sauce", "description": "Tender grilled chicken breast with lettuce, tomato, and our signature house sauce on a toasted bun.", "price": 16.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd", "image_alt": "Grilled chicken burger with fresh toppings", "category": "mains", "categories": ["lunch", "dinner", "mains"], "dietary": [], "tags": ["grilled", "popular"], "featured": True, "rating": 4.5, "review_count": 201, "prep_time": 15, "is_available": True},
        {"id": "14", "location_id": "howe-bridge-atherton", "name": "Iced Latte", "subtitle": "Smooth cold coffee with milk", "description": "Freshly brewed espresso poured over ice with your choice of milk.", "price": 5.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1461023058943-07fcbe16d735", "image_alt": "Iced latte in tall glass with ice", "category": "beverages", "categories": ["breakfast", "beverage"], "dietary": ["vegetarian"], "tags": ["coffee", "cold"], "featured": True, "rating": 4.7, "review_count": 312, "prep_time": 3, "is_available": True},
        # Chaddesden, Derby
        {"id": "15", "location_id": "chaddesden-derby", "name": "Fish and Chips", "subtitle": "Classic British favourite", "description": "Beer-battered cod fillet served with thick-cut chips, mushy peas, and tartar sauce.", "price": 17.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1579208570378-8c970854bc23", "image_alt": "Classic fish and chips with mushy peas", "category": "mains", "categories": ["lunch", "dinner", "mains"], "dietary": [], "tags": ["classic", "british"], "featured": True, "rating": 4.7, "review_count": 345, "prep_time": 20, "is_available": True},
        {"id": "16", "location_id": "chaddesden-derby", "name": "Chicken Tikka Masala", "subtitle": "Rich and creamy curry", "description": "Tender chicken pieces in a rich, creamy tomato-based sauce with aromatic spices. Served with basmati rice.", "price": 16.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1565557623262-b51c2513a641", "image_alt": "Chicken tikka masala with basmati rice", "category": "mains", "categories": ["lunch", "dinner", "mains"], "dietary": ["gluten-free"], "tags": ["curry", "spicy"], "featured": True, "rating": 4.8, "review_count": 289, "prep_time": 25, "is_available": True},
        {"id": "17", "location_id": "chaddesden-derby", "name": "Sticky Toffee Pudding", "subtitle": "Warm British classic", "description": "Moist sponge pudding drenched in warm toffee sauce, served with vanilla ice cream.", "price": 9.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e", "image_alt": "Sticky toffee pudding with toffee sauce", "category": "desserts", "categories": ["dessert"], "dietary": ["vegetarian"], "tags": ["british", "warm"], "featured": True, "rating": 4.9, "review_count": 198, "prep_time": 10, "is_available": True},
        {"id": "18", "location_id": "chaddesden-derby", "name": "English Breakfast Tea", "subtitle": "Traditional loose-leaf brew", "description": "A proper cup of English Breakfast tea served with milk and your choice of sweetener.", "price": 3.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1556679343-c7306c1976bc", "image_alt": "English breakfast tea in white ceramic cup", "category": "beverages", "categories": ["breakfast", "beverage"], "dietary": ["vegan", "gluten-free"], "tags": ["tea", "british"], "featured": False, "rating": 4.5, "review_count": 156, "prep_time": 5, "is_available": True},
        # Oakmere, Handforth
        {"id": "19", "location_id": "oakmere-handforth", "name": "Avocado Toast", "subtitle": "Smashed avocado on sourdough", "description": "Creamy smashed avocado on toasted sourdough with cherry tomatoes, feta, and a poached egg.", "price": 13.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1541519227354-08fa5d50c820", "image_alt": "Avocado toast on sourdough with poached egg", "category": "appetizers", "categories": ["breakfast", "mains"], "dietary": ["vegetarian"], "tags": ["healthy", "brunch"], "featured": True, "rating": 4.6, "review_count": 234, "prep_time": 10, "is_available": True},
        {"id": "20", "location_id": "oakmere-handforth", "name": "Pesto Pasta", "subtitle": "Fresh basil pesto with linguine", "description": "Al dente linguine tossed in our house-made basil pesto with pine nuts and Parmesan shavings.", "price": 15.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1473093295043-cdd812d0e601", "image_alt": "Pesto pasta with pine nuts and parmesan", "category": "mains", "categories": ["lunch", "dinner", "mains"], "dietary": ["vegetarian"], "tags": ["pasta", "italian"], "featured": True, "rating": 4.5, "review_count": 167, "prep_time": 15, "is_available": True},
        {"id": "21", "location_id": "oakmere-handforth", "name": "Halloumi Fries", "subtitle": "Crispy fried halloumi with dip", "description": "Golden-fried halloumi sticks served with sweet chilli dipping sauce and fresh mint yoghurt.", "price": 11.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1601050690597-df0568f70950", "image_alt": "Crispy halloumi fries with dipping sauce", "category": "appetizers", "categories": ["lunch", "appetizer"], "dietary": ["vegetarian", "gluten-free"], "tags": ["crispy", "cheese"], "featured": True, "rating": 4.7, "review_count": 289, "prep_time": 10, "is_available": True},
        {"id": "22", "location_id": "oakmere-handforth", "name": "Matcha Latte", "subtitle": "Japanese green tea with steamed milk", "description": "Premium ceremonial grade matcha whisked with steamed oat milk. Available hot or iced.", "price": 5.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1536256263959-770b48d82b0a", "image_alt": "Matcha latte in ceramic cup with latte art", "category": "beverages", "categories": ["breakfast", "beverage"], "dietary": ["vegan"], "tags": ["matcha", "healthy"], "featured": False, "rating": 4.5, "review_count": 178, "prep_time": 5, "is_available": True},
        {"id": "23", "location_id": "oakmere-handforth", "name": "Lemon Tart", "subtitle": "Zesty French-style tart", "description": "Crisp pastry shell filled with silky smooth lemon curd, topped with fresh raspberries and icing sugar.", "price": 8.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1519915028121-7d3463d20b13", "image_alt": "Lemon tart with raspberries and icing sugar", "category": "desserts", "categories": ["dessert"], "dietary": ["vegetarian"], "tags": ["citrus", "french"], "featured": True, "rating": 4.8, "review_count": 156, "prep_time": 5, "is_available": True},
        # Willowmere, Middlewich
        {"id": "24", "location_id": "willowmere-middlewich", "name": "Sunday Roast", "subtitle": "Traditional roast with all the trimmings", "description": "Slow-roasted beef served with roast potatoes, Yorkshire pudding, seasonal vegetables, and rich gravy.", "price": 22.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1544025162-d76694265947", "image_alt": "Traditional Sunday roast with Yorkshire pudding", "category": "mains", "categories": ["lunch", "dinner", "mains"], "dietary": [], "tags": ["traditional", "sunday"], "featured": True, "rating": 4.9, "review_count": 412, "prep_time": 35, "is_available": True},
        {"id": "25", "location_id": "willowmere-middlewich", "name": "Homemade Soup of the Day", "subtitle": "Fresh seasonal soup", "description": "Our chef's daily soup made with fresh seasonal ingredients, served with crusty bread and butter.", "price": 8.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1547592180-85f173990554", "image_alt": "Bowl of homemade soup with crusty bread", "category": "appetizers", "categories": ["lunch", "dinner", "appetizer"], "dietary": ["vegetarian"], "tags": ["seasonal", "homemade"], "featured": False, "rating": 4.5, "review_count": 234, "prep_time": 10, "is_available": True},
        {"id": "26", "location_id": "willowmere-middlewich", "name": "Beef Lasagne", "subtitle": "Hearty Italian classic", "description": "Layers of slow-cooked beef ragu, bechamel sauce, and pasta sheets, topped with melted mozzarella.", "price": 17.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1574894709920-11b28e7367e3", "image_alt": "Beef lasagne with melted cheese on top", "category": "mains", "categories": ["lunch", "dinner", "mains"], "dietary": [], "tags": ["italian", "comfort"], "featured": True, "rating": 4.7, "review_count": 198, "prep_time": 25, "is_available": True},
        {"id": "27", "location_id": "willowmere-middlewich", "name": "Scones with Clotted Cream", "subtitle": "Traditional afternoon tea treat", "description": "Freshly baked plain and fruit scones served with clotted cream and strawberry jam.", "price": 7.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1558961363-fa8fdf82db35", "image_alt": "Freshly baked scones with clotted cream and jam", "category": "desserts", "categories": ["breakfast", "dessert"], "dietary": ["vegetarian"], "tags": ["afternoon-tea", "british"], "featured": True, "rating": 4.8, "review_count": 267, "prep_time": 5, "is_available": True},
        {"id": "28", "location_id": "willowmere-middlewich", "name": "Hot Chocolate", "subtitle": "Rich and indulgent", "description": "Velvety hot chocolate made with premium Belgian chocolate, topped with whipped cream and marshmallows.", "price": 4.99, "original_price": None, "image_url": "https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed", "image_alt": "Rich hot chocolate with whipped cream and marshmallows", "category": "beverages", "categories": ["breakfast", "beverage"], "dietary": ["vegetarian"], "tags": ["chocolate", "warm"], "featured": False, "rating": 4.6, "review_count": 189, "prep_time": 5, "is_available": True},
    ]
    
    menu_items_collection.insert_many(menu_items)
    print("Database seeded successfully!")

# ============== AUTH ENDPOINTS ==============

@app.post("/api/auth/login")
async def login(request: Request, response: Response, credentials: LoginRequest):
    """Admin login endpoint"""
    email = credentials.email.lower()
    client_ip = get_client_ip(request)
    identifier = f"{client_ip}:{email}"
    
    # Check brute force lockout
    if check_brute_force(identifier):
        raise HTTPException(status_code=429, detail="Too many failed attempts. Please try again later.")
    
    # Find user
    user = users_collection.find_one({"email": email})
    if not user:
        record_failed_attempt(identifier)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Verify password
    if not verify_password(credentials.password, user["password_hash"]):
        record_failed_attempt(identifier)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Clear failed attempts on success
    clear_failed_attempts(identifier)
    
    # Create tokens
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, user["email"], user.get("role", "user"))
    refresh_token = create_refresh_token(user_id)
    
    # Set cookies
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/"
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path="/"
    )
    
    return serialize_user(user)

@app.post("/api/auth/logout")
async def logout(response: Response):
    """Logout and clear cookies"""
    response.delete_cookie("access_token", path="/", samesite=COOKIE_SAMESITE, secure=COOKIE_SECURE)
    response.delete_cookie("refresh_token", path="/", samesite=COOKIE_SAMESITE, secure=COOKIE_SECURE)
    return {"message": "Logged out successfully"}

@app.get("/api/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    """Get current authenticated user"""
    return user

@app.post("/api/auth/refresh")
async def refresh_token(request: Request, response: Response):
    """Refresh access token using refresh token"""
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    
    payload = decode_token(token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")
    
    user = users_collection.find_one({"_id": ObjectId(payload["sub"])})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    # Create new access token
    access_token = create_access_token(str(user["_id"]), user["email"], user.get("role", "user"))
    
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/"
    )
    
    return serialize_user(user)

# ============== PUBLIC API ENDPOINTS ==============

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "app": "Pesto Restaurant API", "database": "MongoDB"}

@app.get("/api/")
async def root():
    return {"message": "Welcome to Pesto Restaurant API"}

@app.get("/api/locations")
async def get_locations():
    """Get all active locations"""
    locations = list(locations_collection.find({"is_active": True}).sort("sort_order", 1))
    return [serialize_doc(loc) for loc in locations]

@app.get("/api/locations/{slug}")
async def get_location_by_slug(slug: str):
    """Get a single location by slug"""
    location = locations_collection.find_one({"slug": slug})
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    return serialize_doc(location)


# ============== ADMIN LOCATION CRUD ==============

@app.get("/api/admin/locations")
async def admin_get_all_locations(user: dict = Depends(get_admin_user)):
    """Admin: Get all locations including inactive"""
    locations = list(locations_collection.find({}).sort("sort_order", 1))
    return [serialize_doc(loc) for loc in locations]


@app.post("/api/admin/locations")
async def admin_create_location(data: LocationCreate, user: dict = Depends(get_admin_user)):
    """Admin: Create a new location"""
    import re
    slug = re.sub(r'[^a-z0-9]+', '-', data.name.lower()).strip('-')
    # Ensure slug is unique
    if locations_collection.find_one({"slug": slug}):
        raise HTTPException(status_code=400, detail="A location with a similar name already exists")

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
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    locations_collection.insert_one(location_doc)

    # Auto-create site settings for the new location
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


@app.put("/api/admin/locations/{location_id}")
async def admin_update_location(location_id: str, data: LocationUpdate, user: dict = Depends(get_admin_user)):
    """Admin: Update a location"""
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

    if update_fields:
        locations_collection.update_one({"id": location_id}, {"$set": update_fields})

    updated = locations_collection.find_one({"id": location_id})
    return serialize_doc(updated)


@app.delete("/api/admin/locations/{location_id}")
async def admin_delete_location(location_id: str, user: dict = Depends(get_admin_user)):
    """Admin: Soft-delete a location (set is_active=False)"""
    existing = locations_collection.find_one({"id": location_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Location not found")

    locations_collection.update_one({"id": location_id}, {"$set": {"is_active": False}})
    return {"message": "Location deactivated", "id": location_id}


@app.get("/api/menu-items")
async def get_menu_items(location_id: Optional[str] = None, category: Optional[str] = None):
    """Get menu items, optionally filtered by location and category"""
    query = {"is_available": True}
    
    if location_id:
        query["location_id"] = location_id
    
    if category and category != "all":
        query["$or"] = [
            {"category": category},
            {"categories": category}
        ]
    
    items = list(menu_items_collection.find(query).sort("name", 1))
    return [serialize_doc(item) for item in items]

@app.get("/api/menu-items/{item_id}")
async def get_menu_item(item_id: str):
    """Get a single menu item by ID"""
    item = menu_items_collection.find_one({"id": item_id})
    if not item:
        raise HTTPException(status_code=404, detail="Menu item not found")
    return serialize_doc(item)

@app.get("/api/featured-items")
async def get_featured_items(location_id: Optional[str] = None, limit: int = 8):
    """Get featured menu items"""
    query = {"is_available": True, "featured": True}
    if location_id:
        query["location_id"] = location_id
    
    items = list(menu_items_collection.find(query).limit(limit))
    return [serialize_doc(item) for item in items]

# ============== ADMIN CRUD ENDPOINTS (PROTECTED) ==============

@app.get("/api/admin/menu-items")
async def admin_get_menu_items(location_id: Optional[str] = None, user: dict = Depends(get_admin_user)):
    """Admin: Get all menu items (including unavailable) for a location"""
    query = {}
    if location_id:
        query["location_id"] = location_id
    
    items = list(menu_items_collection.find(query).sort("name", 1))
    return [serialize_doc(item) for item in items]

@app.post("/api/admin/menu-items", status_code=201)
async def admin_create_menu_item(item: MenuItemCreate, user: dict = Depends(get_admin_user)):
    """Admin: Create a new menu item"""
    item_id = str(uuid.uuid4())[:8]
    
    item_dict = item.model_dump()
    item_dict["id"] = item_id
    item_dict["rating"] = 4.0
    item_dict["review_count"] = 0
    item_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    
    result = menu_items_collection.insert_one(item_dict)
    
    created_item = menu_items_collection.find_one({"_id": result.inserted_id})
    return serialize_doc(created_item)

@app.put("/api/admin/menu-items/{item_id}")
async def admin_update_menu_item(item_id: str, item: MenuItemUpdate, user: dict = Depends(get_admin_user)):
    """Admin: Update an existing menu item"""
    existing = menu_items_collection.find_one({"id": item_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    update_data = {k: v for k, v in item.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    menu_items_collection.update_one(
        {"id": item_id},
        {"$set": update_data}
    )
    
    updated_item = menu_items_collection.find_one({"id": item_id})
    return serialize_doc(updated_item)

@app.patch("/api/admin/menu-items/{item_id}/availability")
async def admin_toggle_availability(item_id: str, user: dict = Depends(get_admin_user)):
    """Admin: Toggle menu item availability"""
    existing = menu_items_collection.find_one({"id": item_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    new_availability = not existing.get("is_available", True)
    
    menu_items_collection.update_one(
        {"id": item_id},
        {"$set": {"is_available": new_availability, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    updated_item = menu_items_collection.find_one({"id": item_id})
    return serialize_doc(updated_item)

@app.delete("/api/admin/menu-items/{item_id}")
async def admin_delete_menu_item(item_id: str, user: dict = Depends(get_admin_user)):
    """Admin: Delete a menu item"""
    existing = menu_items_collection.find_one({"id": item_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    menu_items_collection.delete_one({"id": item_id})
    return {"message": "Menu item deleted successfully", "id": item_id}

import base64

def generate_thumbnail_bytes(image_bytes, size=(400, 400)):
    """Generate a consistent square thumbnail from image bytes. Returns JPEG bytes."""
    try:
        with PILImage.open(io.BytesIO(image_bytes)) as img:
            img = img.convert("RGB")
            w, h = img.size
            min_dim = min(w, h)
            left = (w - min_dim) // 2
            top = (h - min_dim) // 2
            img = img.crop((left, top, left + min_dim, top + min_dim))
            img = img.resize(size, PILImage.LANCZOS)
            buf = io.BytesIO()
            img.save(buf, "JPEG", quality=85, optimize=True)
            return buf.getvalue()
    except Exception:
        return None


@app.post("/api/admin/menu-items/{item_id}/upload-image")
async def admin_upload_menu_image(item_id: str, file: UploadFile = File(...), user: dict = Depends(get_admin_user)):
    """Admin: Upload an image for a menu item, stores in MongoDB"""
    existing = menu_items_collection.find_one({"id": item_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Allowed: JPEG, PNG, WebP, GIF")
    
    # Read file bytes
    file_bytes = await file.read()
    
    # Generate thumbnail
    thumb_bytes = generate_thumbnail_bytes(file_bytes)
    
    # Store in MongoDB
    image_id = f"{item_id}_{uuid.uuid4().hex[:8]}"
    thumb_id = f"{image_id}_thumb"
    
    # Remove old images for this item
    images_collection.delete_many({"item_id": item_id})
    
    # Store original
    images_collection.insert_one({
        "image_id": image_id,
        "item_id": item_id,
        "content_type": file.content_type,
        "data": base64.b64encode(file_bytes).decode("utf-8"),
        "type": "original",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    
    # Store thumbnail
    if thumb_bytes:
        images_collection.insert_one({
            "image_id": thumb_id,
            "item_id": item_id,
            "content_type": "image/jpeg",
            "data": base64.b64encode(thumb_bytes).decode("utf-8"),
            "type": "thumbnail",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    
    image_url = f"/api/images/{image_id}"
    thumb_url = f"/api/images/{thumb_id}" if thumb_bytes else image_url
    
    update_fields = {
        "image_url": image_url,
        "thumbnail_url": thumb_url,
        "show_image": True,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    menu_items_collection.update_one({"id": item_id}, {"$set": update_fields})
    
    updated_item = menu_items_collection.find_one({"id": item_id})
    return {
        "message": "Image uploaded successfully",
        "image_url": image_url,
        "thumbnail_url": thumb_url,
        "item": serialize_doc(updated_item)
    }

@app.patch("/api/admin/menu-items/{item_id}/toggle-image")
async def admin_toggle_image_visibility(item_id: str, user: dict = Depends(get_admin_user)):
    """Admin: Toggle show/hide image for a menu item"""
    existing = menu_items_collection.find_one({"id": item_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    current_show = existing.get("show_image", True)
    new_show = not current_show
    
    menu_items_collection.update_one(
        {"id": item_id},
        {"$set": {"show_image": new_show, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    updated_item = menu_items_collection.find_one({"id": item_id})
    return serialize_doc(updated_item)

# Serve images from MongoDB
@app.get("/api/images/{image_id}")
async def get_image(image_id: str):
    """Serve an image stored in MongoDB"""
    from fastapi.responses import Response
    doc = images_collection.find_one({"image_id": image_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Image not found")
    image_bytes = base64.b64decode(doc["data"])
    return Response(content=image_bytes, media_type=doc.get("content_type", "image/jpeg"), headers={"Cache-Control": "public, max-age=31536000"})


# ============== RESIDENT PREPAID BALANCE SYSTEM ==============

# Pydantic models for Residents
class ResidentCreate(BaseModel):
    residence_number: str
    name: str
    location: str  # "oakmere-handforth" or "willowmere-middlewich"
    email: Optional[str] = None
    about: Optional[str] = None

class ResidentUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    email: Optional[str] = None
    about: Optional[str] = None

class TransactionCreate(BaseModel):
    resident_id: str
    transaction_type: str  # "topup" or "purchase"
    amount: float
    description: Optional[str] = None
    send_receipt: bool = False

# Resident Endpoints
@app.get("/api/admin/residents")
async def get_residents(location: Optional[str] = None, user: dict = Depends(get_admin_user)):
    """Get all residents, optionally filtered by location"""
    query = {}
    if location:
        query["location"] = location
    
    residents = list(residents_collection.find(query).sort("residence_number", 1))
    return [serialize_doc(r) for r in residents]

@app.get("/api/admin/residents/{resident_id}")
async def get_resident(resident_id: str, user: dict = Depends(get_admin_user)):
    """Get a single resident by ID"""
    resident = residents_collection.find_one({"id": resident_id})
    if not resident:
        raise HTTPException(status_code=404, detail="Resident not found")
    return serialize_doc(resident)

@app.post("/api/admin/residents", status_code=201)
async def create_resident(resident: ResidentCreate, user: dict = Depends(get_admin_user)):
    """Create a new resident"""
    # Check if residence number already exists
    existing = residents_collection.find_one({"residence_number": resident.residence_number})
    if existing:
        raise HTTPException(status_code=400, detail="Residence number already exists")
    
    resident_id = str(uuid.uuid4())[:8]
    resident_dict = {
        "id": resident_id,
        "residence_number": resident.residence_number,
        "name": resident.name,
        "location": resident.location,
        "email": resident.email,
        "about": resident.about,
        "balance": 0.0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    residents_collection.insert_one(resident_dict)
    return serialize_doc(residents_collection.find_one({"id": resident_id}))

@app.put("/api/admin/residents/{resident_id}")
async def update_resident(resident_id: str, resident: ResidentUpdate, user: dict = Depends(get_admin_user)):
    """Update an existing resident"""
    existing = residents_collection.find_one({"id": resident_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Resident not found")
    
    update_data = {k: v for k, v in resident.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    residents_collection.update_one({"id": resident_id}, {"$set": update_data})
    return serialize_doc(residents_collection.find_one({"id": resident_id}))

@app.delete("/api/admin/residents/{resident_id}")
async def delete_resident(resident_id: str, user: dict = Depends(get_admin_user)):
    """Delete a resident"""
    existing = residents_collection.find_one({"id": resident_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Resident not found")
    
    # Also delete all transactions for this resident
    transactions_collection.delete_many({"resident_id": resident_id})
    residents_collection.delete_one({"id": resident_id})
    return {"message": "Resident deleted successfully", "id": resident_id}

# Transaction Endpoints
@app.post("/api/admin/transactions", status_code=201)
async def create_transaction(transaction: TransactionCreate, user: dict = Depends(get_admin_user)):
    """Create a new transaction (top-up or purchase)"""
    # Get resident
    resident = residents_collection.find_one({"id": transaction.resident_id})
    if not resident:
        raise HTTPException(status_code=404, detail="Resident not found")
    
    current_balance = resident.get("balance", 0.0)
    
    # Calculate new balance
    if transaction.transaction_type == "topup":
        amount = abs(transaction.amount)
        new_balance = current_balance + amount
    elif transaction.transaction_type == "purchase":
        amount = abs(transaction.amount)
        new_balance = current_balance - amount
        if new_balance < 0:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient balance. Current balance: £{current_balance:.2f}, Purchase amount: £{amount:.2f}"
            )
    else:
        raise HTTPException(status_code=400, detail="Invalid transaction type. Use 'topup' or 'purchase'")
    
    # Create transaction record
    transaction_id = str(uuid.uuid4())[:8]
    created_at = datetime.now(timezone.utc)
    transaction_dict = {
        "id": transaction_id,
        "resident_id": transaction.resident_id,
        "transaction_type": transaction.transaction_type,
        "amount": amount if transaction.transaction_type == "topup" else -amount,
        "balance_before": current_balance,
        "balance_after": new_balance,
        "description": transaction.description,
        "created_at": created_at.isoformat(),
        "created_by": user.get("email", "admin"),
        "receipt_sent": False
    }
    
    transactions_collection.insert_one(transaction_dict)
    
    # Update resident balance
    residents_collection.update_one(
        {"id": transaction.resident_id},
        {"$set": {"balance": new_balance, "updated_at": created_at.isoformat()}}
    )
    
    # Send email receipt if requested
    email_sent = False
    email_error = None
    if transaction.send_receipt and resident.get("email"):
        try:
            email_sent = await send_transaction_receipt(
                resident_email=resident["email"],
                resident_name=resident["name"],
                residence_number=resident["residence_number"],
                transaction_type=transaction.transaction_type,
                amount=amount,
                description=transaction.description,
                new_balance=new_balance,
                transaction_date=created_at
            )
            if email_sent:
                transactions_collection.update_one(
                    {"id": transaction_id},
                    {"$set": {"receipt_sent": True, "receipt_sent_at": datetime.now(timezone.utc).isoformat()}}
                )
        except Exception as e:
            email_error = str(e)
    
    return {
        "transaction": serialize_doc(transactions_collection.find_one({"id": transaction_id})),
        "new_balance": new_balance,
        "receipt_sent": email_sent,
        "receipt_error": email_error
    }

# Email receipt helper
async def send_transaction_receipt(
    resident_email: str,
    resident_name: str,
    residence_number: str,
    transaction_type: str,
    amount: float,
    description: str,
    new_balance: float,
    transaction_date: datetime
) -> bool:
    """Send email receipt for a transaction"""
    if not RESEND_API_KEY:
        return False
    
    is_topup = transaction_type == "topup"
    formatted_date = transaction_date.strftime("%d %B %Y at %H:%M")
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <!-- Header -->
            <tr>
                <td style="background: linear-gradient(135deg, {'#10b981' if is_topup else '#f43f5e'}, {'#059669' if is_topup else '#e11d48'}); padding: 30px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px;">
                        {'💰 Top Up Receipt' if is_topup else '🛒 Purchase Receipt'}
                    </h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">
                        Jolly's Kafe - Prepaid Balance
                    </p>
                </td>
            </tr>
            
            <!-- Content -->
            <tr>
                <td style="padding: 30px;">
                    <p style="color: #374151; font-size: 16px; margin: 0 0 20px 0;">
                        Dear <strong>{resident_name}</strong>,
                    </p>
                    <p style="color: #6b7280; font-size: 14px; margin: 0 0 25px 0;">
                        {'Your prepaid balance has been topped up.' if is_topup else 'A purchase has been made from your prepaid balance.'}
                    </p>
                    
                    <!-- Transaction Details Box -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f9fafb; border-radius: 8px; margin-bottom: 25px;">
                        <tr>
                            <td style="padding: 20px;">
                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                    <tr>
                                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                                            <span style="color: #6b7280; font-size: 14px;">Date</span>
                                        </td>
                                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">
                                            <span style="color: #111827; font-size: 14px; font-weight: 600;">{formatted_date}</span>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                                            <span style="color: #6b7280; font-size: 14px;">Residence</span>
                                        </td>
                                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">
                                            <span style="color: #111827; font-size: 14px; font-weight: 600;">#{residence_number}</span>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                                            <span style="color: #6b7280; font-size: 14px;">Type</span>
                                        </td>
                                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">
                                            <span style="color: {'#10b981' if is_topup else '#f43f5e'}; font-size: 14px; font-weight: 600;">
                                                {'Top Up' if is_topup else 'Purchase'}
                                            </span>
                                        </td>
                                    </tr>
                                    {f'''<tr>
                                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                                            <span style="color: #6b7280; font-size: 14px;">Description</span>
                                        </td>
                                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">
                                            <span style="color: #111827; font-size: 14px;">{description}</span>
                                        </td>
                                    </tr>''' if description else ''}
                                    <tr>
                                        <td style="padding: 12px 0;">
                                            <span style="color: #6b7280; font-size: 16px; font-weight: 600;">Amount</span>
                                        </td>
                                        <td style="padding: 12px 0; text-align: right;">
                                            <span style="color: {'#10b981' if is_topup else '#f43f5e'}; font-size: 24px; font-weight: 700;">
                                                {'+' if is_topup else '-'}£{amount:.2f}
                                            </span>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                    
                    <!-- New Balance Box -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #ecfdf5; border: 2px solid #10b981; border-radius: 8px;">
                        <tr>
                            <td style="padding: 20px; text-align: center;">
                                <p style="color: #065f46; font-size: 14px; margin: 0 0 5px 0; text-transform: uppercase; letter-spacing: 1px;">
                                    Current Balance
                                </p>
                                <p style="color: #047857; font-size: 32px; font-weight: 700; margin: 0;">
                                    £{new_balance:.2f}
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
            
            <!-- Footer -->
            <tr>
                <td style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
                    <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                        This is an automated receipt from Jolly's Kafe.<br>
                        Please keep this email for your records.
                    </p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    
    params = {
        "from": SENDER_EMAIL,
        "to": [resident_email],
        "subject": f"{'Top Up' if is_topup else 'Purchase'} Receipt - £{amount:.2f} - Jolly's Kafe",
        "html": html_content
    }
    
    try:
        await asyncio.to_thread(resend.Emails.send, params)
        return True
    except Exception as e:
        print(f"Failed to send receipt email: {e}")
        return False

@app.get("/api/admin/transactions")
async def get_transactions(
    resident_id: Optional[str] = None,
    location: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    transaction_type: Optional[str] = None,
    user: dict = Depends(get_admin_user)
):
    """Get transactions with optional filters"""
    query = {}
    
    if resident_id:
        query["resident_id"] = resident_id
    
    if location:
        # Get all resident IDs for this location
        residents_at_location = list(residents_collection.find({"location": location}, {"id": 1}))
        resident_ids = [r["id"] for r in residents_at_location]
        if resident_ids:
            query["resident_id"] = {"$in": resident_ids}
        else:
            return []
    
    if transaction_type:
        query["transaction_type"] = transaction_type
    
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query["$gte"] = start_date
        if end_date:
            # Add end of day to include the entire end date
            date_query["$lte"] = end_date + "T23:59:59"
        if date_query:
            query["created_at"] = date_query
    
    transactions = list(transactions_collection.find(query).sort("created_at", -1))
    
    # Enrich with resident info
    result = []
    for t in transactions:
        resident = residents_collection.find_one({"id": t["resident_id"]})
        t_serialized = serialize_doc(t)
        if resident:
            t_serialized["resident_name"] = resident.get("name", "Unknown")
            t_serialized["residence_number"] = resident.get("residence_number", "Unknown")
            t_serialized["resident_location"] = resident.get("location", "Unknown")
        result.append(t_serialized)
    
    return result

@app.get("/api/admin/residents/{resident_id}/transactions")
async def get_resident_transactions(
    resident_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user: dict = Depends(get_admin_user)
):
    """Get all transactions for a specific resident"""
    resident = residents_collection.find_one({"id": resident_id})
    if not resident:
        raise HTTPException(status_code=404, detail="Resident not found")
    
    query = {"resident_id": resident_id}
    
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query["$gte"] = start_date
        if end_date:
            date_query["$lte"] = end_date + "T23:59:59"
        if date_query:
            query["created_at"] = date_query
    
    transactions = list(transactions_collection.find(query).sort("created_at", -1))
    
    return {
        "resident": serialize_doc(resident),
        "transactions": [serialize_doc(t) for t in transactions]
    }

@app.get("/api/admin/balance-summary")
async def get_balance_summary(location: Optional[str] = None, user: dict = Depends(get_admin_user)):
    """Get summary of all balances"""
    query = {}
    if location:
        query["location"] = location
    
    residents = list(residents_collection.find(query))
    
    total_balance = sum(r.get("balance", 0) for r in residents)
    total_residents = len(residents)
    residents_with_balance = len([r for r in residents if r.get("balance", 0) > 0])
    residents_zero_balance = len([r for r in residents if r.get("balance", 0) == 0])
    
    return {
        "total_balance": round(total_balance, 2),
        "total_residents": total_residents,
        "residents_with_balance": residents_with_balance,
        "residents_zero_balance": residents_zero_balance,
        "location": location or "all"
    }


# ============== CUSTOMER AUTH SYSTEM ==============

import random
import string

def generate_otp():
    return ''.join(random.choices(string.digits, k=6))

def generate_order_number():
    return f"JK-{uuid.uuid4().hex[:6].upper()}"

async def get_customer(request: Request) -> dict:
    """Get current customer from token"""
    token = request.cookies.get("customer_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    if payload.get("type") != "customer_access":
        raise HTTPException(status_code=401, detail="Invalid token type")
    customer = customers_collection.find_one({"id": payload["sub"]})
    if not customer:
        raise HTTPException(status_code=401, detail="Customer not found")
    return serialize_doc(customer)

def is_site_open(location_id: str) -> dict:
    """Check if a site is currently open for ordering"""
    settings = site_settings_collection.find_one({"location_id": location_id})
    if not settings:
        return {"is_open": False, "reason": "Site not configured"}
    
    # Manual override takes priority
    if settings.get("manual_override"):
        return {"is_open": settings.get("ordering_enabled", False), "reason": "manual_override"}
    
    if not settings.get("ordering_enabled", True):
        return {"is_open": False, "reason": "ordering_disabled"}
    
    # Check schedule
    now = datetime.now(timezone.utc)
    day_name = now.strftime("%A").lower()
    hours = settings.get("opening_hours", {}).get(day_name)
    if not hours:
        return {"is_open": False, "reason": "closed_today"}
    
    try:
        open_time = datetime.strptime(hours["open"], "%H:%M").time()
        close_time = datetime.strptime(hours["close"], "%H:%M").time()
        current_time = now.time()
        if open_time <= current_time <= close_time:
            return {"is_open": True, "reason": "within_hours", "closes_at": hours["close"]}
        else:
            return {"is_open": False, "reason": "outside_hours", "opens_at": hours["open"], "closes_at": hours["close"]}
    except (KeyError, ValueError):
        return {"is_open": False, "reason": "invalid_hours"}


@app.post("/api/customer/register")
async def customer_register(data: CustomerRegister, response: Response):
    """Register a new customer"""
    email = data.email.lower().strip()
    phone = data.phone.strip()
    
    if customers_collection.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered. Please login.")
    
    otp_email = generate_otp()
    otp_phone = generate_otp()
    password_raw = uuid.uuid4().hex[:12]
    
    customer_id = str(uuid.uuid4())
    customer = {
        "id": customer_id,
        "name": data.name.strip(),
        "email": email,
        "phone": phone,
        "password_hash": hash_password(password_raw),
        "email_verified": False,
        "phone_verified": False,
        "otp_email": otp_email,
        "otp_phone": otp_phone,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    customers_collection.insert_one(customer)
    
    # Try to send verification email
    email_sent = False
    resend_key = os.environ.get("RESEND_API_KEY")
    if resend_key:
        try:
            resend.api_key = resend_key
            resend.Emails.send({
                "from": "Jolly's Kafe <onboarding@resend.dev>",
                "to": [email],
                "subject": "Verify your email - Jolly's Kafe",
                "html": f"<h2>Welcome to Jolly's Kafe!</h2><p>Your email verification code is: <strong>{otp_email}</strong></p>"
            })
            email_sent = True
        except Exception:
            pass
    
    # Auto-verify if no keys available (dev mode)
    if not resend_key:
        customers_collection.update_one({"id": customer_id}, {"$set": {"email_verified": True, "phone_verified": True}})
    
    # Create token
    token = jwt.encode({"sub": customer_id, "email": email, "type": "customer_access", "exp": datetime.now(timezone.utc) + timedelta(days=30)}, JWT_SECRET, algorithm=JWT_ALGORITHM)
    response.set_cookie("customer_token", token, httponly=True, secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE, max_age=60*60*24*30)
    
    return {
        "message": "Registration successful",
        "customer_id": customer_id,
        "token": token,
        "password": password_raw,
        "email_sent": email_sent,
        "auto_verified": not resend_key,
        "needs_verification": bool(resend_key),
    }


@app.post("/api/customer/verify")
async def customer_verify(request: Request):
    """Verify customer email or phone OTP"""
    body = await request.json()
    customer_id = body.get("customer_id")
    otp = body.get("otp")
    verify_type = body.get("type", "email")  # "email" or "phone"
    
    customer = customers_collection.find_one({"id": customer_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    field = f"otp_{verify_type}"
    if customer.get(field) != otp:
        raise HTTPException(status_code=400, detail="Invalid verification code")
    
    verified_field = f"{verify_type}_verified"
    customers_collection.update_one({"id": customer_id}, {"$set": {verified_field: True, field: None}})
    
    return {"message": f"{verify_type.capitalize()} verified successfully"}


@app.post("/api/customer/login")
async def customer_login(data: CustomerLogin, response: Response):
    """Customer login"""
    email = data.email.lower().strip()
    customer = customers_collection.find_one({"email": email})
    if not customer:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not verify_password(data.password, customer["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = jwt.encode({"sub": customer["id"], "email": email, "type": "customer_access", "exp": datetime.now(timezone.utc) + timedelta(days=30)}, JWT_SECRET, algorithm=JWT_ALGORITHM)
    response.set_cookie("customer_token", token, httponly=True, secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE, max_age=60*60*24*30)
    
    safe = {k: v for k, v in customer.items() if k not in ("_id", "password_hash", "otp_email", "otp_phone")}
    return {"message": "Login successful", "token": token, "customer": safe}


@app.get("/api/customer/me")
async def customer_me(customer: dict = Depends(get_customer)):
    """Get current customer profile"""
    safe = {k: v for k, v in customer.items() if k not in ("_id", "password_hash", "otp_email", "otp_phone")}
    return safe


@app.post("/api/customer/logout")
async def customer_logout(response: Response):
    response.delete_cookie("customer_token")
    return {"message": "Logged out"}


# ============== GOOGLE OAUTH (EMERGENT AUTH) ==============

@app.post("/api/customer/auth/google-session")
async def customer_google_session(request: Request, response: Response):
    """Exchange Emergent Auth session_id for a customer session"""
    import httpx
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")

    # Call Emergent Auth to get user data
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id},
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    google_data = resp.json()
    email = google_data["email"].lower().strip()
    name = google_data.get("name", email.split("@")[0])
    picture = google_data.get("picture", "")

    # Find or create customer
    existing = customers_collection.find_one({"email": email})
    if existing:
        # Update name/picture if changed
        customers_collection.update_one(
            {"email": email},
            {"$set": {"name": name, "picture": picture, "google_linked": True}},
        )
        customer_id = existing["id"]
    else:
        customer_id = str(uuid.uuid4())
        customers_collection.insert_one({
            "id": customer_id,
            "name": name,
            "email": email,
            "phone": "",
            "password_hash": "",
            "email_verified": True,
            "phone_verified": False,
            "google_linked": True,
            "picture": picture,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    # Issue JWT
    token = jwt.encode(
        {"sub": customer_id, "email": email, "type": "customer_access",
         "exp": datetime.now(timezone.utc) + timedelta(days=30)},
        JWT_SECRET, algorithm=JWT_ALGORITHM,
    )
    response.set_cookie(
        "customer_token", token,
        httponly=True, secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE, max_age=60*60*24*30,
    )

    customer = customers_collection.find_one({"id": customer_id})
    safe = {k: v for k, v in customer.items() if k not in ("_id", "password_hash", "otp_email", "otp_phone")}
    return {"message": "Google login successful", "token": token, "customer": safe}


# ============== ORDER SYSTEM ==============

@app.get("/api/site-status/{location_id}")
async def get_site_status(location_id: str):
    """Public: Check if a site is open for ordering"""
    status = is_site_open(location_id)
    settings = site_settings_collection.find_one({"location_id": location_id})
    hours = settings.get("opening_hours", {}) if settings else {}
    return {**status, "location_id": location_id, "opening_hours": hours}


@app.post("/api/orders")
async def create_order(order_data: OrderCreate, customer: dict = Depends(get_customer)):
    """Create a new order (collection only)"""
    # Check customer is verified
    if not customer.get("email_verified") or not customer.get("phone_verified"):
        raise HTTPException(status_code=403, detail="Please verify your email and phone before ordering")
    
    # Check site is open
    status = is_site_open(order_data.location_id)
    if not status["is_open"]:
        raise HTTPException(status_code=400, detail="Ordering is currently closed for this location")
    
    # Validate items
    if not order_data.items or len(order_data.items) == 0:
        raise HTTPException(status_code=400, detail="Order must have at least one item")
    
    total = sum(item.price * item.quantity for item in order_data.items)
    
    order = {
        "id": str(uuid.uuid4()),
        "order_number": generate_order_number(),
        "customer_id": customer["id"],
        "customer_name": customer.get("name", ""),
        "customer_email": customer.get("email", ""),
        "customer_phone": customer.get("phone", ""),
        "location_id": order_data.location_id,
        "items": [item.dict() for item in order_data.items],
        "total": round(total, 2),
        "status": "pending",
        "special_instructions": order_data.special_instructions,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "status_history": [{"status": "pending", "timestamp": datetime.now(timezone.utc).isoformat()}],
    }
    orders_collection.insert_one(order)
    
    safe_order = {k: v for k, v in order.items() if k != "_id"}
    return {"message": "Order placed successfully! Please collect when ready.", "order": safe_order}


@app.get("/api/orders/track/{order_number}")
async def track_order(order_number: str):
    """Public: Track order by order number"""
    order = orders_collection.find_one({"order_number": order_number.upper()})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    safe = {k: v for k, v in order.items() if k != "_id"}
    return safe


@app.get("/api/customer/orders")
async def customer_orders(customer: dict = Depends(get_customer)):
    """Get all orders for current customer"""
    orders = list(orders_collection.find({"customer_id": customer["id"]}).sort("created_at", -1))
    return [serialize_doc(o) for o in orders]


@app.get("/api/admin/orders")
async def admin_list_orders(location_id: Optional[str] = None, status: Optional[str] = None, user: dict = Depends(get_admin_user)):
    """Admin: List all orders with filters"""
    query = {}
    if location_id:
        query["location_id"] = location_id
    if status:
        query["status"] = status
    orders = list(orders_collection.find(query).sort("created_at", -1).limit(100))
    return [serialize_doc(o) for o in orders]


@app.patch("/api/admin/orders/{order_id}/status")
async def admin_update_order_status(order_id: str, data: OrderStatusUpdate, user: dict = Depends(get_admin_user)):
    """Admin: Update order status and notify customer when ready"""
    valid_statuses = ["pending", "confirmed", "preparing", "ready", "collected", "cancelled"]
    if data.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}")
    
    order = orders_collection.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    now = datetime.now(timezone.utc).isoformat()
    history_entry = {"status": data.status, "timestamp": now, "updated_by": user.get("email")}
    
    orders_collection.update_one(
        {"id": order_id},
        {"$set": {"status": data.status, "updated_at": now}, "$push": {"status_history": history_entry}}
    )
    
    # Send notifications when order is ready
    if data.status == "ready":
        customer_email = order.get("customer_email")
        customer_phone = order.get("customer_phone")
        order_number = order.get("order_number")
        
        # Email notification
        resend_key = os.environ.get("RESEND_API_KEY")
        if resend_key and customer_email:
            try:
                resend.api_key = resend_key
                resend.Emails.send({
                    "from": "Jolly's Kafe <onboarding@resend.dev>",
                    "to": [customer_email],
                    "subject": f"Your order {order_number} is ready for collection!",
                    "html": f"<h2>Your order is ready!</h2><p>Order <strong>{order_number}</strong> is ready for collection at our location.</p><p>Please come and pick it up at your earliest convenience.</p>"
                })
            except Exception:
                pass
        
        # SMS notification (Twilio)
        twilio_sid = os.environ.get("TWILIO_ACCOUNT_SID")
        twilio_token = os.environ.get("TWILIO_AUTH_TOKEN")
        twilio_from = os.environ.get("TWILIO_PHONE_NUMBER")
        if twilio_sid and twilio_token and twilio_from and customer_phone:
            try:
                from twilio.rest import Client as TwilioClient
                twilio_client = TwilioClient(twilio_sid, twilio_token)
                twilio_client.messages.create(
                    body=f"Jolly's Kafe: Your order {order_number} is ready for collection!",
                    from_=twilio_from,
                    to=customer_phone
                )
            except Exception:
                pass
    
    updated = orders_collection.find_one({"id": order_id})
    return serialize_doc(updated)


# ============== SITE SETTINGS ==============

@app.get("/api/admin/site-settings")
async def admin_get_site_settings(user: dict = Depends(get_admin_user)):
    """Admin: Get all site settings for active locations"""
    active_ids = [loc["id"] for loc in locations_collection.find({"is_active": True}, {"id": 1, "_id": 0})]
    settings = list(site_settings_collection.find({"location_id": {"$in": active_ids}}))
    return [serialize_doc(s) for s in settings]


@app.put("/api/admin/site-settings/{location_id}")
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


@app.patch("/api/admin/site-settings/{location_id}/toggle")
async def admin_toggle_ordering(location_id: str, user: dict = Depends(get_admin_user)):
    """Admin: Quick toggle ordering on/off for a location"""
    existing = site_settings_collection.find_one({"location_id": location_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Site settings not found")
    
    new_enabled = not existing.get("ordering_enabled", True)
    site_settings_collection.update_one(
        {"location_id": location_id},
        {"$set": {"ordering_enabled": new_enabled, "manual_override": True, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    updated = site_settings_collection.find_one({"location_id": location_id})
    return serialize_doc(updated)



# ============== SERVE FRONTEND (PRODUCTION) ==============
# In production (Docker/Railway), serve the built React frontend if available
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
