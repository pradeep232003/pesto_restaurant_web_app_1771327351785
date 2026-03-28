from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
from bson import ObjectId
import os
from dotenv import load_dotenv
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime, timezone

load_dotenv()

app = FastAPI(title="Pesto Restaurant API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "pesto_restaurant")

client = MongoClient(MONGO_URL)
db = client[DB_NAME]

# Collections
locations_collection = db["locations"]
menu_items_collection = db["menu_items"]

# Pydantic models
class Location(BaseModel):
    id: str
    name: str
    slug: str
    address: str
    is_active: bool = True
    sort_order: int = 0

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

def serialize_doc(doc):
    """Convert MongoDB document to JSON-serializable dict"""
    if doc is None:
        return None
    doc["_id"] = str(doc["_id"]) if "_id" in doc else None
    return doc

@app.on_event("startup")
async def startup_event():
    """Seed database with initial data if empty"""
    if locations_collection.count_documents({}) == 0:
        seed_data()

def seed_data():
    """Seed the database with restaurant data"""
    
    # Locations
    locations = [
        {"id": "timperley-altrincham", "name": "Timperley, Altrincham", "slug": "timperley-altrincham", "address": "Timperley, Altrincham", "is_active": True, "sort_order": 1},
        {"id": "howe-bridge-atherton", "name": "Howe Bridge, Atherton", "slug": "howe-bridge-atherton", "address": "Howe Bridge, Atherton", "is_active": True, "sort_order": 2},
        {"id": "chaddesden-derby", "name": "Chaddesden, Derby", "slug": "chaddesden-derby", "address": "Chaddesden, Derby", "is_active": True, "sort_order": 3},
        {"id": "oakmere-handforth", "name": "Oakmere, Handforth", "slug": "oakmere-handforth", "address": "Oakmere, Handforth", "is_active": True, "sort_order": 4},
        {"id": "willowmere-middlewich", "name": "Willowmere, Middlewich", "slug": "willowmere-middlewich", "address": "Willowmere, Middlewich", "is_active": True, "sort_order": 5},
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

# API Endpoints
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
