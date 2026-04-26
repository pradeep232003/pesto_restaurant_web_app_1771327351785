from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import Response
from datetime import datetime, timezone
from db import customers_collection, loyalty_transactions_collection
from auth import get_staff_or_above, get_admin_user
from pydantic import BaseModel
import uuid
import qrcode
import io
import base64
import json

router = APIRouter(tags=["loyalty"])


# ============== CUSTOMER ENDPOINTS ==============

@router.get("/api/customer/loyalty-card")
async def get_loyalty_card(request: Request):
    """Get customer's loyalty QR code as base64 PNG"""
    from routes.customers import get_customer
    customer = await get_customer(request)
    customer_id = customer["id"]

    # QR data is a JSON payload with customer ID
    qr_data = json.dumps({"type": "jollys_loyalty", "cid": customer_id})

    qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=10, border=2)
    qr.add_data(qr_data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

    # Get total spend
    pipeline = [
        {"$match": {"customer_id": customer_id}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "visits": {"$sum": 1}}},
    ]
    agg = list(loyalty_transactions_collection.aggregate(pipeline))
    total_spend = round(agg[0]["total"], 2) if agg else 0
    visits = agg[0]["visits"] if agg else 0

    return {
        "qr_image": f"data:image/png;base64,{b64}",
        "customer_id": customer_id,
        "customer_name": customer.get("name", ""),
        "total_spend": total_spend,
        "visits": visits,
    }


@router.get("/api/customer/loyalty-card/image")
async def get_loyalty_card_image(request: Request):
    """Get QR code as raw PNG image (for download/save)"""
    from routes.customers import get_customer
    customer = await get_customer(request)
    customer_id = customer["id"]

    qr_data = json.dumps({"type": "jollys_loyalty", "cid": customer_id})
    qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=12, border=3)
    qr.add_data(qr_data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)

    return Response(content=buf.getvalue(), media_type="image/png",
                    headers={"Content-Disposition": f'attachment; filename="jollys-loyalty-{customer_id[:8]}.png"'})


# ============== STAFF/ADMIN ENDPOINTS ==============

class LoyaltyScanRequest(BaseModel):
    customer_id: str
    amount: float
    location_id: str = ""
    note: str = ""


@router.post("/api/admin/loyalty/scan")
async def record_loyalty_scan(body: LoyaltyScanRequest, user: dict = Depends(get_staff_or_above)):
    """Staff scans QR and records spend amount"""
    customer = customers_collection.find_one({"id": body.customer_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    doc = {
        "id": str(uuid.uuid4())[:12],
        "customer_id": body.customer_id,
        "customer_name": customer.get("name", ""),
        "customer_email": customer.get("email", ""),
        "amount": body.amount,
        "location_id": body.location_id,
        "note": body.note,
        "scanned_by": user.get("email", ""),
        "scanned_by_name": user.get("name", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    loyalty_transactions_collection.insert_one(doc)

    # Get updated total
    pipeline = [
        {"$match": {"customer_id": body.customer_id}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "visits": {"$sum": 1}}},
    ]
    agg = list(loyalty_transactions_collection.aggregate(pipeline))
    total_spend = round(agg[0]["total"], 2) if agg else 0
    visits = agg[0]["visits"] if agg else 0

    return {
        "message": "Spend recorded",
        "customer_name": customer.get("name", ""),
        "amount": body.amount,
        "total_spend": total_spend,
        "visits": visits,
    }


@router.get("/api/admin/loyalty/customers")
async def list_loyalty_customers(user: dict = Depends(get_admin_user)):
    """Get all customers with their total spend (admin only)"""
    pipeline = [
        {"$group": {
            "_id": "$customer_id",
            "total_spend": {"$sum": "$amount"},
            "visits": {"$sum": 1},
            "customer_name": {"$first": "$customer_name"},
            "customer_email": {"$first": "$customer_email"},
            "last_visit": {"$max": "$created_at"},
        }},
        {"$sort": {"total_spend": -1}},
    ]
    results = list(loyalty_transactions_collection.aggregate(pipeline))
    return [
        {
            "customer_id": r["_id"],
            "customer_name": r.get("customer_name", ""),
            "customer_email": r.get("customer_email", ""),
            "total_spend": round(r["total_spend"], 2),
            "visits": r["visits"],
            "last_visit": r.get("last_visit", ""),
        }
        for r in results
    ]


@router.get("/api/admin/loyalty/customer/{customer_id}")
async def get_customer_loyalty_detail(customer_id: str, user: dict = Depends(get_admin_user)):
    """Get detailed loyalty history for a customer (admin only)"""
    transactions = list(loyalty_transactions_collection.find(
        {"customer_id": customer_id}, {"_id": 0}
    ).sort("created_at", -1))
    total = sum(t.get("amount", 0) for t in transactions)
    customer = customers_collection.find_one({"id": customer_id}, {"_id": 0, "password_hash": 0})
    return {
        "customer": customer,
        "transactions": transactions,
        "total_spend": round(total, 2),
        "visits": len(transactions),
    }
