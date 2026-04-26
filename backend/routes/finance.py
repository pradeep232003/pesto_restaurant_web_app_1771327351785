from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timezone
from db import income_collection, expenses_collection
from auth import get_admin_user
from models import IncomeCreate, ExpenseCreate
import uuid

router = APIRouter(prefix="/api/admin/finance", tags=["finance"])


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
    return {"message": "Income recorded", "id": doc["id"]}


@router.get("/income")
async def list_income(
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
    entries = list(income_collection.find(query, {"_id": 0}).sort("date", -1))
    total = sum(e.get("amount", 0) for e in entries)
    return {"entries": entries, "total": round(total, 2)}


@router.delete("/income/{entry_id}")
async def delete_income(entry_id: str, user: dict = Depends(get_admin_user)):
    result = income_collection.delete_one({"id": entry_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
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
    return {"entries": entries, "total": round(total, 2)}


@router.delete("/expenses/{entry_id}")
async def delete_expense(entry_id: str, user: dict = Depends(get_admin_user)):
    result = expenses_collection.delete_one({"id": entry_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"message": "Expense deleted"}
