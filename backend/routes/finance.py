from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timezone
from db import income_collection, expenses_collection, edit_log_collection
from auth import get_admin_user, get_staff_or_above
from models import IncomeCreate, ExpenseCreate
import uuid

router = APIRouter(prefix="/api/admin/finance", tags=["finance"])


def _can_modify(user, entry):
    """Only super_admin or the original creator can edit/delete"""
    role = user.get("role", "")
    email = user.get("email", "")
    return role == "super_admin" or email == entry.get("created_by", "")


def _log_edit(action, record_type, record_id, user, before, after=None):
    edit_log_collection.insert_one({
        "id": str(uuid.uuid4())[:12],
        "action": action,
        "record_type": record_type,
        "record_id": record_id,
        "edited_by": user.get("email", ""),
        "edited_by_name": user.get("name", ""),
        "role": user.get("role", ""),
        "before": before,
        "after": after,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })


# ============== INCOME ==============

@router.post("/income")
async def create_income(body: IncomeCreate, user: dict = Depends(get_admin_user)):
    doc = {
        "id": str(uuid.uuid4())[:12],
        "amount": body.amount,
        "description": body.description,
        "date": body.date,
        "location_id": body.location_id,
        "created_by": user.get("email", ""),
        "created_by_name": user.get("name", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    income_collection.insert_one(doc)
    _log_edit("create", "income", doc["id"], user, None, {
        "amount": doc["amount"], "description": doc["description"],
        "date": doc["date"], "location_id": doc["location_id"],
    })
    return {"message": "Income recorded", "id": doc["id"]}


@router.get("/income")
async def list_income(
    location_id: str = Query(None),
    start_date: str = Query(None),
    end_date: str = Query(None),
    created_by: str = Query(None),
    user: dict = Depends(get_admin_user),
):
    query = {}
    if location_id:
        query["location_id"] = location_id
    if start_date:
        query.setdefault("date", {})["$gte"] = start_date
    if end_date:
        query.setdefault("date", {})["$lte"] = end_date
    if created_by:
        query["created_by"] = created_by
    entries = list(income_collection.find(query, {"_id": 0}).sort("date", -1))
    total = sum(e.get("amount", 0) for e in entries)
    user_email = user.get("email", "")
    user_role = user.get("role", "")
    # Collect unique creators for filter dropdown
    creators = list(income_collection.distinct("created_by"))
    creator_names = {}
    for c in creators:
        doc = income_collection.find_one({"created_by": c}, {"created_by_name": 1, "_id": 0})
        creator_names[c] = doc.get("created_by_name", c) if doc else c
    for e in entries:
        e["can_modify"] = user_role == "super_admin" or user_email == e.get("created_by", "")
    return {"entries": entries, "total": round(total, 2), "creators": [{"email": k, "name": v} for k, v in creator_names.items()]}


@router.put("/income/{entry_id}")
async def update_income(entry_id: str, body: IncomeCreate, user: dict = Depends(get_admin_user)):
    entry = income_collection.find_one({"id": entry_id})
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    if not _can_modify(user, entry):
        raise HTTPException(status_code=403, detail="Only super admin or the original creator can edit")

    before = {"amount": entry.get("amount"), "description": entry.get("description"),
              "date": entry.get("date"), "location_id": entry.get("location_id")}
    after = {"amount": body.amount, "description": body.description,
             "date": body.date, "location_id": body.location_id}

    income_collection.update_one({"id": entry_id}, {"$set": {
        "amount": body.amount, "description": body.description,
        "date": body.date, "location_id": body.location_id,
        "updated_by": user.get("email", ""), "updated_at": datetime.now(timezone.utc).isoformat(),
    }})
    _log_edit("update", "income", entry_id, user, before, after)
    return {"message": "Income updated"}


@router.delete("/income/{entry_id}")
async def delete_income(entry_id: str, user: dict = Depends(get_admin_user)):
    entry = income_collection.find_one({"id": entry_id})
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    if not _can_modify(user, entry):
        raise HTTPException(status_code=403, detail="Only super admin or the original creator can delete")

    before = {"amount": entry.get("amount"), "description": entry.get("description"),
              "date": entry.get("date"), "location_id": entry.get("location_id")}
    income_collection.delete_one({"id": entry_id})
    _log_edit("delete", "income", entry_id, user, before)
    return {"message": "Income deleted"}


# ============== EXPENSES ==============

@router.post("/expenses")
async def create_expense(body: ExpenseCreate, user: dict = Depends(get_admin_user)):
    doc = {
        "id": str(uuid.uuid4())[:12],
        "amount": body.amount,
        "description": body.description,
        "category": body.category,
        "date": body.date,
        "location_id": body.location_id,
        "created_by": user.get("email", ""),
        "created_by_name": user.get("name", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    expenses_collection.insert_one(doc)
    _log_edit("create", "expense", doc["id"], user, None, {
        "amount": doc["amount"], "description": doc["description"],
        "category": doc["category"], "date": doc["date"], "location_id": doc["location_id"],
    })
    return {"message": "Expense recorded", "id": doc["id"]}


@router.get("/expenses")
async def list_expenses(
    location_id: str = Query(None),
    start_date: str = Query(None),
    end_date: str = Query(None),
    user: dict = Depends(get_admin_user),
):
    query = {}
    if location_id:
        query["location_id"] = location_id
    if start_date:
        query.setdefault("date", {})["$gte"] = start_date
    if end_date:
        query.setdefault("date", {})["$lte"] = end_date
    entries = list(expenses_collection.find(query, {"_id": 0}).sort("date", -1))
    total = sum(e.get("amount", 0) for e in entries)
    user_email = user.get("email", "")
    user_role = user.get("role", "")
    for e in entries:
        e["can_modify"] = user_role == "super_admin" or user_email == e.get("created_by", "")
    return {"entries": entries, "total": round(total, 2)}


@router.put("/expenses/{entry_id}")
async def update_expense(entry_id: str, body: ExpenseCreate, user: dict = Depends(get_admin_user)):
    entry = expenses_collection.find_one({"id": entry_id})
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    if not _can_modify(user, entry):
        raise HTTPException(status_code=403, detail="Only super admin or the original creator can edit")

    before = {"amount": entry.get("amount"), "description": entry.get("description"),
              "category": entry.get("category"), "date": entry.get("date"), "location_id": entry.get("location_id")}
    after = {"amount": body.amount, "description": body.description,
             "category": body.category, "date": body.date, "location_id": body.location_id}

    expenses_collection.update_one({"id": entry_id}, {"$set": {
        "amount": body.amount, "description": body.description,
        "category": body.category, "date": body.date, "location_id": body.location_id,
        "updated_by": user.get("email", ""), "updated_at": datetime.now(timezone.utc).isoformat(),
    }})
    _log_edit("update", "expense", entry_id, user, before, after)
    return {"message": "Expense updated"}


@router.delete("/expenses/{entry_id}")
async def delete_expense(entry_id: str, user: dict = Depends(get_admin_user)):
    entry = expenses_collection.find_one({"id": entry_id})
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    if not _can_modify(user, entry):
        raise HTTPException(status_code=403, detail="Only super admin or the original creator can delete")

    before = {"amount": entry.get("amount"), "description": entry.get("description"),
              "category": entry.get("category"), "date": entry.get("date"), "location_id": entry.get("location_id")}
    expenses_collection.delete_one({"id": entry_id})
    _log_edit("delete", "expense", entry_id, user, before)
    return {"message": "Expense deleted"}


# ============== EDIT LOG ==============

@router.get("/edit-log")
async def get_edit_log(
    record_type: str = Query(None),
    start_date: str = Query(None),
    end_date: str = Query(None),
    user: dict = Depends(get_admin_user),
):
    query = {}
    if record_type:
        query["record_type"] = record_type
    if start_date:
        query.setdefault("timestamp", {})["$gte"] = start_date
    if end_date:
        query.setdefault("timestamp", {})["$lte"] = end_date + "T23:59:59"
    entries = list(edit_log_collection.find(query, {"_id": 0}).sort("timestamp", -1).limit(200))
    return entries
