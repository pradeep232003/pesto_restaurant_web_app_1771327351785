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
daily_sales_collection = db["daily_sales"]
income_collection = db["income"]
expenses_collection = db["expenses"]
edit_log_collection = db["edit_log"]
loyalty_transactions_collection = db["loyalty_transactions"]
temp_logs_collection = db["temp_logs"]
temp_units_collection = db["temp_units"]
daily_checks_collection = db["daily_checks"]
daily_check_items_collection = db["daily_check_items"]
kitchen_closedown_collection = db["kitchen_closedown"]
kitchen_closedown_items_collection = db["kitchen_closedown_items"]
daily_cleaning_items_collection = db["daily_cleaning_items"]
daily_cleaning_logs_collection = db["daily_cleaning_logs"]
weekly_cleaning_items_collection = db["weekly_cleaning_items"]
weekly_cleaning_logs_collection = db["weekly_cleaning_logs"]
