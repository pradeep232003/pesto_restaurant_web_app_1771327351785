from fastapi import APIRouter, Depends, HTTPException
from db import customers_collection, users_collection
from auth import get_super_admin
from models import UserRoleUpdate

router = APIRouter(prefix="/api/admin/users", tags=["users"])

VALID_ROLES = {"customer", "staff", "admin"}


@router.get("")
async def list_customers(user: dict = Depends(get_super_admin)):
    """List all registered customers (super_admin only)"""
    customers = list(customers_collection.find({}, {"_id": 0}))
    return customers


@router.put("/{customer_id}/role")
async def update_customer_role(customer_id: str, body: UserRoleUpdate, user: dict = Depends(get_super_admin)):
    """Change a customer's role (super_admin only)"""
    if body.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(VALID_ROLES)}")

    customer = customers_collection.find_one({"id": customer_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    customers_collection.update_one(
        {"id": customer_id},
        {"$set": {"role": body.role}},
    )

    # If promoting to staff or admin, ensure they have an entry in users_collection
    # so they can log into the admin panel
    if body.role in ("staff", "admin"):
        existing_user = users_collection.find_one({"email": customer["email"]})
        if not existing_user:
            from auth import hash_password
            from datetime import datetime, timezone
            import uuid
            temp_password = str(uuid.uuid4())[:8]
            users_collection.insert_one({
                "email": customer["email"],
                "password_hash": hash_password(temp_password),
                "name": customer.get("name", ""),
                "role": body.role,
                "created_at": datetime.now(timezone.utc),
                "promoted_from_customer": True,
            })
        else:
            users_collection.update_one(
                {"email": customer["email"]},
                {"$set": {"role": body.role}},
            )
    elif body.role == "customer":
        # Demoting: remove admin panel access (but keep super_admin entries)
        users_collection.delete_one({"email": customer["email"], "role": {"$in": ["staff", "admin"]}})

    return {"message": f"Role updated to {body.role}", "customer_id": customer_id, "role": body.role}


@router.get("/staff-list")
async def get_staff_list(user: dict = Depends(get_super_admin)):
    """Get list of all staff and admin users"""
    admin_users = list(users_collection.find({}, {"_id": 0, "password_hash": 0}))
    return admin_users
