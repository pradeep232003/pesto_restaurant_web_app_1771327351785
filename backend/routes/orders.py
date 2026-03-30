from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from datetime import datetime, timezone
import os
import uuid
import resend

from db import orders_collection, site_settings_collection
from auth import get_admin_user
from models import OrderCreate, OrderStatusUpdate
from helpers import serialize_doc
from routes.customers import get_customer

router = APIRouter(tags=["orders"])

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")


def _generate_order_number():
    return f"JK-{uuid.uuid4().hex[:6].upper()}"


def is_site_open(location_id: str) -> dict:
    """Check if a site is currently open for ordering"""
    settings = site_settings_collection.find_one({"location_id": location_id})
    if not settings:
        return {"is_open": False, "reason": "Site not configured"}

    if settings.get("manual_override"):
        return {"is_open": settings.get("ordering_enabled", False), "reason": "manual_override"}

    if not settings.get("ordering_enabled", True):
        return {"is_open": False, "reason": "ordering_disabled"}

    now = datetime.now(timezone.utc)
    day_name = now.strftime("%A").lower()
    hours = settings.get("opening_hours", {}).get(day_name)
    if not hours:
        return {"is_open": False, "reason": "closed_today"}

    try:
        open_time = datetime.strptime(hours["open"], "%H:%M").time()
        close_time = datetime.strptime(hours["close"], "%H:%M").time()
        current_time = now.time()
        if open_time <= current_time <= close_time:
            return {"is_open": True, "reason": "within_hours", "closes_at": hours["close"]}
        else:
            return {"is_open": False, "reason": "outside_hours", "opens_at": hours["open"], "closes_at": hours["close"]}
    except (KeyError, ValueError):
        return {"is_open": False, "reason": "invalid_hours"}


# ============== PUBLIC ENDPOINTS ==============

@router.get("/api/site-status/{location_id}")
async def get_site_status(location_id: str):
    """Public: Check if a site is open for ordering"""
    status = is_site_open(location_id)
    settings = site_settings_collection.find_one({"location_id": location_id})
    hours = settings.get("opening_hours", {}) if settings else {}
    return {**status, "location_id": location_id, "opening_hours": hours}


@router.get("/api/orders/track/{order_number}")
async def track_order(order_number: str):
    """Public: Track order by order number"""
    order = orders_collection.find_one({"order_number": order_number.upper()})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    safe = {k: v for k, v in order.items() if k != "_id"}
    return safe


# ============== CUSTOMER ORDER ENDPOINTS ==============
# Note: get_customer dependency is imported at inclusion time from customers router

@router.post("/api/orders")
async def create_order(order_data: OrderCreate, customer: dict = Depends(get_customer)):
    """Create a new order (collection only)"""
    if not customer.get("email_verified") or not customer.get("phone_verified"):
        raise HTTPException(status_code=403, detail="Please verify your email and phone before ordering")

    status = is_site_open(order_data.location_id)
    if not status["is_open"]:
        raise HTTPException(status_code=400, detail="Ordering is currently closed for this location")

    if not order_data.items or len(order_data.items) == 0:
        raise HTTPException(status_code=400, detail="Order must have at least one item")

    total = sum(item.price * item.quantity for item in order_data.items)

    order = {
        "id": str(uuid.uuid4()),
        "order_number": _generate_order_number(),
        "customer_id": customer["id"],
        "customer_name": customer.get("name", ""),
        "customer_email": customer.get("email", ""),
        "customer_phone": customer.get("phone", ""),
        "location_id": order_data.location_id,
        "items": [item.dict() for item in order_data.items],
        "total": round(total, 2),
        "status": "pending",
        "special_instructions": order_data.special_instructions,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "status_history": [{"status": "pending", "timestamp": datetime.now(timezone.utc).isoformat()}],
    }
    orders_collection.insert_one(order)
    safe_order = {k: v for k, v in order.items() if k != "_id"}
    return {"message": "Order placed successfully! Please collect when ready.", "order": safe_order}


@router.get("/api/customer/orders")
async def customer_orders(customer: dict = Depends(get_customer)):
    """Get all orders for current customer"""
    orders = list(orders_collection.find({"customer_id": customer["id"]}).sort("created_at", -1))
    return [serialize_doc(o) for o in orders]


# ============== ADMIN ORDER ENDPOINTS ==============

@router.get("/api/admin/orders")
async def admin_list_orders(location_id: Optional[str] = None, status: Optional[str] = None, user: dict = Depends(get_admin_user)):
    """Admin: List all orders with filters"""
    query = {}
    if location_id:
        query["location_id"] = location_id
    if status:
        query["status"] = status
    orders = list(orders_collection.find(query).sort("created_at", -1).limit(100))
    return [serialize_doc(o) for o in orders]


@router.patch("/api/admin/orders/{order_id}/status")
async def admin_update_order_status(order_id: str, data: OrderStatusUpdate, user: dict = Depends(get_admin_user)):
    """Admin: Update order status and notify customer when ready"""
    valid_statuses = ["pending", "confirmed", "preparing", "ready", "collected", "cancelled"]
    if data.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}")

    order = orders_collection.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    now = datetime.now(timezone.utc).isoformat()
    history_entry = {"status": data.status, "timestamp": now, "updated_by": user.get("email")}

    orders_collection.update_one(
        {"id": order_id},
        {"$set": {"status": data.status, "updated_at": now}, "$push": {"status_history": history_entry}},
    )

    if data.status == "ready":
        customer_email = order.get("customer_email")
        order_number = order.get("order_number")

        resend_key = os.environ.get("RESEND_API_KEY")
        if resend_key and customer_email:
            try:
                resend.api_key = resend_key
                resend.Emails.send({
                    "from": "Jolly's Kafe <onboarding@resend.dev>",
                    "to": [customer_email],
                    "subject": f"Your order {order_number} is ready for collection!",
                    "html": f"<h2>Your order is ready!</h2><p>Order <strong>{order_number}</strong> is ready for collection.</p>",
                })
            except Exception:
                pass

        twilio_sid = os.environ.get("TWILIO_ACCOUNT_SID")
        twilio_token = os.environ.get("TWILIO_AUTH_TOKEN")
        twilio_from = os.environ.get("TWILIO_PHONE_NUMBER")
        customer_phone = order.get("customer_phone")
        if twilio_sid and twilio_token and twilio_from and customer_phone:
            try:
                from twilio.rest import Client as TwilioClient
                twilio_client = TwilioClient(twilio_sid, twilio_token)
                twilio_client.messages.create(
                    body=f"Jolly's Kafe: Your order {order_number} is ready for collection!",
                    from_=twilio_from, to=customer_phone,
                )
            except Exception:
                pass

    updated = orders_collection.find_one({"id": order_id})
    return serialize_doc(updated)
