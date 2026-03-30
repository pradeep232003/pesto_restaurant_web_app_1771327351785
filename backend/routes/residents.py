from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from datetime import datetime, timezone
import os
import asyncio
import uuid
import resend

from db import residents_collection, transactions_collection
from auth import get_admin_user
from models import ResidentCreate, ResidentUpdate, TransactionCreate
from helpers import serialize_doc

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")

router = APIRouter(prefix="/api/admin", tags=["residents"])


# ============== RESIDENT ENDPOINTS ==============

@router.get("/residents")
async def get_residents(location: Optional[str] = None, user: dict = Depends(get_admin_user)):
    """Get all residents, optionally filtered by location"""
    query = {}
    if location:
        query["location"] = location
    residents = list(residents_collection.find(query).sort("residence_number", 1))
    return [serialize_doc(r) for r in residents]


@router.get("/residents/{resident_id}")
async def get_resident(resident_id: str, user: dict = Depends(get_admin_user)):
    """Get a single resident by ID"""
    resident = residents_collection.find_one({"id": resident_id})
    if not resident:
        raise HTTPException(status_code=404, detail="Resident not found")
    return serialize_doc(resident)


@router.post("/residents", status_code=201)
async def create_resident(resident: ResidentCreate, user: dict = Depends(get_admin_user)):
    """Create a new resident"""
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
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    residents_collection.insert_one(resident_dict)
    return serialize_doc(residents_collection.find_one({"id": resident_id}))


@router.put("/residents/{resident_id}")
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


@router.delete("/residents/{resident_id}")
async def delete_resident(resident_id: str, user: dict = Depends(get_admin_user)):
    """Delete a resident"""
    existing = residents_collection.find_one({"id": resident_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Resident not found")
    transactions_collection.delete_many({"resident_id": resident_id})
    residents_collection.delete_one({"id": resident_id})
    return {"message": "Resident deleted successfully", "id": resident_id}


# ============== TRANSACTION ENDPOINTS ==============

@router.post("/transactions", status_code=201)
async def create_transaction(transaction: TransactionCreate, user: dict = Depends(get_admin_user)):
    """Create a new transaction (top-up or purchase)"""
    resident = residents_collection.find_one({"id": transaction.resident_id})
    if not resident:
        raise HTTPException(status_code=404, detail="Resident not found")

    current_balance = resident.get("balance", 0.0)

    if transaction.transaction_type == "topup":
        amount = abs(transaction.amount)
        new_balance = current_balance + amount
    elif transaction.transaction_type == "purchase":
        amount = abs(transaction.amount)
        new_balance = current_balance - amount
        if new_balance < 0:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient balance. Current balance: \u00a3{current_balance:.2f}, Purchase amount: \u00a3{amount:.2f}",
            )
    else:
        raise HTTPException(status_code=400, detail="Invalid transaction type. Use 'topup' or 'purchase'")

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
        "receipt_sent": False,
    }
    transactions_collection.insert_one(transaction_dict)

    residents_collection.update_one(
        {"id": transaction.resident_id},
        {"$set": {"balance": new_balance, "updated_at": created_at.isoformat()}},
    )

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
                transaction_date=created_at,
            )
            if email_sent:
                transactions_collection.update_one(
                    {"id": transaction_id},
                    {"$set": {"receipt_sent": True, "receipt_sent_at": datetime.now(timezone.utc).isoformat()}},
                )
        except Exception as e:
            email_error = str(e)

    return {
        "transaction": serialize_doc(transactions_collection.find_one({"id": transaction_id})),
        "new_balance": new_balance,
        "receipt_sent": email_sent,
        "receipt_error": email_error,
    }


async def send_transaction_receipt(
    resident_email: str, resident_name: str, residence_number: str,
    transaction_type: str, amount: float, description: str,
    new_balance: float, transaction_date: datetime,
) -> bool:
    """Send email receipt for a transaction"""
    if not RESEND_API_KEY:
        return False

    is_topup = transaction_type == "topup"
    formatted_date = transaction_date.strftime("%d %B %Y at %H:%M")

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;font-family:Arial,sans-serif;background-color:#f5f5f5;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background-color:#ffffff;">
            <tr><td style="background:linear-gradient(135deg,{'#10b981' if is_topup else '#f43f5e'},{'#059669' if is_topup else '#e11d48'});padding:30px;text-align:center;">
                <h1 style="color:#ffffff;margin:0;font-size:24px;">{'Top Up Receipt' if is_topup else 'Purchase Receipt'}</h1>
                <p style="color:rgba(255,255,255,0.9);margin:10px 0 0;font-size:14px;">Jolly's Kafe - Prepaid Balance</p>
            </td></tr>
            <tr><td style="padding:30px;">
                <p style="color:#374151;font-size:16px;margin:0 0 20px;">Dear <strong>{resident_name}</strong>,</p>
                <p style="color:#6b7280;font-size:14px;margin:0 0 25px;">{'Your prepaid balance has been topped up.' if is_topup else 'A purchase has been made from your prepaid balance.'}</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f9fafb;border-radius:8px;margin-bottom:25px;">
                    <tr><td style="padding:20px;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                            <tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;"><span style="color:#6b7280;font-size:14px;">Date</span></td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;"><span style="color:#111827;font-size:14px;font-weight:600;">{formatted_date}</span></td></tr>
                            <tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;"><span style="color:#6b7280;font-size:14px;">Residence</span></td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;"><span style="color:#111827;font-size:14px;font-weight:600;">#{residence_number}</span></td></tr>
                            <tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;"><span style="color:#6b7280;font-size:14px;">Type</span></td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;"><span style="color:{'#10b981' if is_topup else '#f43f5e'};font-size:14px;font-weight:600;">{'Top Up' if is_topup else 'Purchase'}</span></td></tr>
                            {f'<tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;"><span style="color:#6b7280;font-size:14px;">Description</span></td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;"><span style="color:#111827;font-size:14px;">{description}</span></td></tr>' if description else ''}
                            <tr><td style="padding:12px 0;"><span style="color:#6b7280;font-size:16px;font-weight:600;">Amount</span></td><td style="padding:12px 0;text-align:right;"><span style="color:{'#10b981' if is_topup else '#f43f5e'};font-size:24px;font-weight:700;">{'+' if is_topup else '-'}\u00a3{amount:.2f}</span></td></tr>
                        </table>
                    </td></tr>
                </table>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#ecfdf5;border:2px solid #10b981;border-radius:8px;">
                    <tr><td style="padding:20px;text-align:center;">
                        <p style="color:#065f46;font-size:14px;margin:0 0 5px;text-transform:uppercase;letter-spacing:1px;">Current Balance</p>
                        <p style="color:#047857;font-size:32px;font-weight:700;margin:0;">\u00a3{new_balance:.2f}</p>
                    </td></tr>
                </table>
            </td></tr>
            <tr><td style="background-color:#f9fafb;padding:20px;text-align:center;border-top:1px solid #e5e7eb;">
                <p style="color:#9ca3af;font-size:12px;margin:0;">This is an automated receipt from Jolly's Kafe.<br>Please keep this email for your records.</p>
            </td></tr>
        </table>
    </body></html>
    """

    resend.api_key = RESEND_API_KEY
    params = {
        "from": SENDER_EMAIL,
        "to": [resident_email],
        "subject": f"{'Top Up' if is_topup else 'Purchase'} Receipt - \u00a3{amount:.2f} - Jolly's Kafe",
        "html": html_content,
    }

    try:
        await asyncio.to_thread(resend.Emails.send, params)
        return True
    except Exception as e:
        print(f"Failed to send receipt email: {e}")
        return False


@router.get("/transactions")
async def get_transactions(
    resident_id: Optional[str] = None,
    location: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    transaction_type: Optional[str] = None,
    user: dict = Depends(get_admin_user),
):
    """Get transactions with optional filters"""
    query = {}
    if resident_id:
        query["resident_id"] = resident_id
    if location:
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
            date_query["$lte"] = end_date + "T23:59:59"
        if date_query:
            query["created_at"] = date_query

    transactions = list(transactions_collection.find(query).sort("created_at", -1))

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


@router.get("/residents/{resident_id}/transactions")
async def get_resident_transactions(
    resident_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user: dict = Depends(get_admin_user),
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
    return {"resident": serialize_doc(resident), "transactions": [serialize_doc(t) for t in transactions]}


@router.get("/balance-summary")
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
        "location": location or "all",
    }
