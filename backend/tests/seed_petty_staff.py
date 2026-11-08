# Create (idempotently) two TEST staff users for petty cash role tests
import sys
sys.path.insert(0, "/app/backend")
from datetime import datetime, timezone
from db import users_collection
from auth import hash_password

for email in ("test_petty_staff1@jollys.com", "test_petty_staff2@jollys.com"):
    if not users_collection.find_one({"email": email}):
        users_collection.insert_one({
            "email": email, "password_hash": hash_password("TestStaff123!"),
            "name": "TEST_" + email.split("@")[0], "role": "staff",
            "created_at": datetime.now(timezone.utc),
        })
        print("created", email)
    else:
        print("exists", email)
