from pymongo import MongoClient
import os

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
