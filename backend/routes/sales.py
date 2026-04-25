from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timezone
from db import daily_sales_collection, customers_collection
from auth import get_staff_or_above, get_admin_user
from models import DailySalesCreate
import uuid

router = APIRouter(prefix="/api/admin/daily-sales", tags=["daily-sales"])


@router.post("")
async def create_or_update_daily_sales(body: DailySalesCreate, user: dict = Depends(get_staff_or_above)):
    """Create or update daily sales entry (staff, admin, super_admin)"""
    existing = daily_sales_collection.find_one({
        "location_id": body.location_id,
        "date": body.date,
    })

    doc = {
        "location_id": body.location_id,
        "date": body.date,
        "sales": body.sales,
        "float_amount": body.float_amount,
        "cash_taken": body.cash_taken,
        "cash_taken_by": body.cash_taken_by,
        "staff_hours": [sh.dict() for sh in body.staff_hours],
        "updated_by": user.get("email", ""),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    if existing:
        daily_sales_collection.update_one(
            {"id": existing["id"]},
            {"$set": doc},
        )
        return {"message": "Daily sales updated", "id": existing["id"]}
    else:
        doc["id"] = str(uuid.uuid4())[:12]
        doc["created_by"] = user.get("email", "")
        doc["created_at"] = datetime.now(timezone.utc).isoformat()
        daily_sales_collection.insert_one(doc)
        return {"message": "Daily sales created", "id": doc["id"]}


@router.get("")
async def list_daily_sales(
    location_id: str = Query(None),
    start_date: str = Query(None),
    end_date: str = Query(None),
    user: dict = Depends(get_admin_user),
):
    """List daily sales entries with filters (admin, super_admin only)"""
    query = {}
    if location_id:
        query["location_id"] = location_id
    if start_date:
        query.setdefault("date", {})["$gte"] = start_date
    if end_date:
        query.setdefault("date", {})["$lte"] = end_date

    entries = list(daily_sales_collection.find(query, {"_id": 0}).sort("date", -1))
    return entries


@router.get("/today/{location_id}")
async def get_sales_by_date(location_id: str, date: str = None, user: dict = Depends(get_staff_or_above)):
    """Get sales entry for a location on a specific date (defaults to today)"""
    if not date:
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    entry = daily_sales_collection.find_one(
        {"location_id": location_id, "date": date},
        {"_id": 0},
    )
    return entry


@router.get("/staff-names")
async def get_staff_names(user: dict = Depends(get_staff_or_above)):
    """Get list of staff/admin names for the staff hours dropdown"""
    # Get from customers with staff/admin role
    staff_customers = list(customers_collection.find(
        {"role": {"$in": ["staff", "admin"]}},
        {"_id": 0, "name": 1},
    ))
    # Get from users collection (staff, admin, super_admin only)
    from db import users_collection
    admin_users = list(users_collection.find(
        {"role": {"$in": ["staff", "admin", "super_admin"]}},
        {"_id": 0, "name": 1},
    ))
    names = set()
    for c in staff_customers:
        if c.get("name"):
            names.add(c["name"])
    for u in admin_users:
        if u.get("name"):
            names.add(u["name"])
    return sorted(names)


@router.delete("/{entry_id}")
async def delete_daily_sales(entry_id: str, user: dict = Depends(get_admin_user)):
    """Delete a daily sales entry (admin, super_admin only)"""
    result = daily_sales_collection.delete_one({"id": entry_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"message": "Entry deleted"}
