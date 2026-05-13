"""
Friday Feast — weekly bundle-or-single pre-order with Stripe Checkout.

Trial Click & Collect rollout: customer orders Sun→Wed for Friday pickup.
Admin builds a fresh menu each week (Starters / Mains / Desserts), sets
per-cafe stock, picks a pickup time, and toggles which sites participate.

Endpoints:
  GET    /api/friday-menu                       (public; ?location_id= optional)
  POST   /api/friday-menu/checkout              (public; creates Stripe session)
  GET    /api/friday-menu/status/{session_id}   (public; polls after redirect)
  POST   /api/webhook/stripe                    (stripe webhook)

Admin:
  GET    /api/admin/friday-menus
  POST   /api/admin/friday-menus
  PUT    /api/admin/friday-menus/{id}
  DELETE /api/admin/friday-menus/{id}
  POST   /api/admin/friday-menus/{id}/upload-image
  GET    /api/admin/friday-orders               (?week=YYYY-MM-DD&location_id=)
"""
import os
import uuid
import base64
import secrets
from datetime import datetime, timezone, date
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Request, File, UploadFile
from pydantic import BaseModel, Field

from db import db, images_collection
from auth import get_admin_user

router = APIRouter()
menus = db["friday_menus"]
orders_coll = db["friday_orders"]
payments = db["payment_transactions"]

COURSES = ("starter", "main", "dessert")


# ---- Models -----------------------------------------------------------------


class MenuItem(BaseModel):
    id: Optional[str] = None
    name: str
    description: str = ""
    image_url: str = ""
    price: float = 0.0      # individual à la carte price (£)
    allergens: List[str] = []
    stock_by_location: Dict[str, int] = {}  # {"timperley-altrincham": 20, ...}


class LocationPickup(BaseModel):
    location_id: str
    pickup_time: str = "15:00"  # HH:MM Friday local


class FridayMenuCreate(BaseModel):
    week_friday: str  # ISO date of the Friday this menu is for (YYYY-MM-DD)
    bundle_price: Optional[float] = None  # £; None = no bundle option
    bundle_enabled: bool = True
    order_window_start: str = ""  # ISO datetime; "" → derives Sun 00:00 of week
    order_window_end: str = ""    # ISO datetime; "" → derives Wed 23:59 of week
    starters: List[MenuItem] = []
    mains: List[MenuItem] = []
    desserts: List[MenuItem] = []
    location_pickups: List[LocationPickup] = []  # one entry per participating cafe
    is_published: bool = False


class FridayMenuUpdate(BaseModel):
    week_friday: Optional[str] = None
    bundle_price: Optional[float] = None
    bundle_enabled: Optional[bool] = None
    order_window_start: Optional[str] = None
    order_window_end: Optional[str] = None
    starters: Optional[List[MenuItem]] = None
    mains: Optional[List[MenuItem]] = None
    desserts: Optional[List[MenuItem]] = None
    location_pickups: Optional[List[LocationPickup]] = None
    is_published: Optional[bool] = None


class CartLine(BaseModel):
    item_id: str
    course: str  # "starter" | "main" | "dessert"


class CheckoutRequest(BaseModel):
    menu_id: str
    location_id: str
    bundle: bool = False           # if True the 3 lines form one bundle
    lines: List[CartLine]          # 1 item for à la carte, 3 (one per course) for bundle
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = ""
    notes: str = ""
    origin_url: str                # caller provides window.location.origin


# ---- Helpers ----------------------------------------------------------------


def _serialise(d: dict) -> dict:
    return {k: v for k, v in d.items() if k != "_id"}


def _ensure_item_ids(items: List[dict]) -> List[dict]:
    """Assign a stable short id to each item that doesn't have one."""
    for it in items:
        if not it.get("id"):
            it["id"] = uuid.uuid4().hex[:10]
    return items


def _menu_doc_for_save(data: FridayMenuCreate | dict, existing: Optional[dict] = None) -> dict:
    payload = data if isinstance(data, dict) else data.dict(exclude_unset=isinstance(data, FridayMenuUpdate))
    doc = dict(existing or {})
    doc.update(payload)
    for k in ("starters", "mains", "desserts"):
        if k in doc:
            doc[k] = _ensure_item_ids([i if isinstance(i, dict) else i.dict() for i in doc[k]])
    if "id" not in doc:
        doc["id"] = uuid.uuid4().hex[:10]
    doc["updated_at"] = datetime.now(timezone.utc).isoformat()
    return doc


def _find_item(menu: dict, item_id: str) -> tuple[Optional[dict], Optional[str]]:
    for course in COURSES:
        for it in menu.get(course + "s", []):
            if it["id"] == item_id:
                return it, course
    return None, None


def _order_window_open(menu: dict, now_iso: Optional[str] = None) -> bool:
    now = now_iso or datetime.now(timezone.utc).isoformat()
    s = (menu.get("order_window_start") or "").strip()
    e = (menu.get("order_window_end") or "").strip()
    if s and now < s:
        return False
    if e and now > e:
        return False
    return True


def _stock_left(menu: dict, item_id: str, location_id: str) -> int:
    """Return remaining stock for an item at a location."""
    item, _ = _find_item(menu, item_id)
    if not item:
        return 0
    initial = int(item.get("stock_by_location", {}).get(location_id, 0))
    # Subtract any paid orders for this item at this location for this menu week
    pipeline = [
        {"$match": {"menu_id": menu["id"], "location_id": location_id, "payment_status": "paid"}},
        {"$unwind": "$lines"},
        {"$match": {"lines.item_id": item_id}},
        {"$count": "n"},
    ]
    res = list(orders_coll.aggregate(pipeline))
    consumed = (res[0]["n"] if res else 0)
    return max(0, initial - consumed)


def _public_menu_view(menu: dict, location_id: Optional[str]) -> dict:
    """Strip stock counters into 'available' flags + remaining qty for the
    requested location only."""
    out = _serialise(menu)
    for k in ("starters", "mains", "desserts"):
        items = out.get(k, [])
        scrubbed = []
        for it in items:
            stock = it.get("stock_by_location", {})
            sub = {**it}
            sub.pop("stock_by_location", None)
            if location_id is not None:
                left = _stock_left(menu, it["id"], location_id)
                sub["remaining"] = left
                sub["sold_out"] = left <= 0
            else:
                sub["remaining"] = None
                sub["sold_out"] = False
                stock  # noqa: B018 (kept for readability)
            scrubbed.append(sub)
        out[k] = scrubbed
    out["window_open"] = _order_window_open(menu)
    if location_id:
        pickup = next((p for p in menu.get("location_pickups", []) if p.get("location_id") == location_id), None)
        out["pickup_time"] = pickup.get("pickup_time", "15:00") if pickup else None
        out["participates"] = pickup is not None
    return out


# ---- Public --------------------------------------------------------------


@router.get("/api/friday-menu")
async def get_current_menu(location_id: Optional[str] = None):
    """Return the next-upcoming published menu, optionally scoped to a cafe."""
    today_iso = date.today().isoformat()
    query: Dict[str, Any] = {"is_published": True, "week_friday": {"$gte": today_iso}}
    menu = menus.find_one(query, {"_id": 0}, sort=[("week_friday", 1)])
    if not menu:
        return None
    # Honour the participating-cafes list when a location is supplied
    if location_id:
        participating = [p["location_id"] for p in menu.get("location_pickups", [])]
        if participating and location_id not in participating:
            return None
    return _public_menu_view(menu, location_id)


# ---- Admin: menus --------------------------------------------------------


@router.get("/api/admin/friday-menus")
async def admin_list_menus(user: dict = Depends(get_admin_user)):
    return list(menus.find({}, {"_id": 0}).sort("week_friday", -1))


@router.post("/api/admin/friday-menus")
async def admin_create_menu(data: FridayMenuCreate, user: dict = Depends(get_admin_user)):
    doc = _menu_doc_for_save(data)
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    doc["created_by"] = user.get("email")
    menus.insert_one(doc)
    return _serialise(doc)


@router.put("/api/admin/friday-menus/{menu_id}")
async def admin_update_menu(menu_id: str, data: FridayMenuUpdate, user: dict = Depends(get_admin_user)):
    existing = menus.find_one({"id": menu_id})
    if not existing:
        raise HTTPException(404, "Menu not found")
    update = _menu_doc_for_save(data, existing=_serialise(existing))
    menus.update_one({"id": menu_id}, {"$set": update})
    return menus.find_one({"id": menu_id}, {"_id": 0})


@router.delete("/api/admin/friday-menus/{menu_id}")
async def admin_delete_menu(menu_id: str, user: dict = Depends(get_admin_user)):
    res = menus.delete_one({"id": menu_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Menu not found")
    return {"deleted": True}


@router.post("/api/admin/friday-menus/upload-image")
async def admin_upload_item_image(file: UploadFile = File(...), user: dict = Depends(get_admin_user)):
    allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    if file.content_type not in allowed:
        raise HTTPException(400, "Invalid file type")
    raw = await file.read()
    image_id = f"friday_{uuid.uuid4().hex[:12]}"
    images_collection.insert_one({
        "image_id": image_id,
        "content_type": file.content_type,
        "data": base64.b64encode(raw).decode("utf-8"),
        "type": "friday_menu",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"image_url": f"/api/images/{image_id}"}


# ---- Admin: orders -------------------------------------------------------


@router.get("/api/admin/friday-orders")
async def admin_list_orders(
    week: Optional[str] = None,
    location_id: Optional[str] = None,
    user: dict = Depends(get_admin_user),
):
    q: Dict[str, Any] = {"payment_status": "paid"}
    if week:
        q["week_friday"] = week
    if location_id:
        q["location_id"] = location_id
    rows = list(orders_coll.find(q, {"_id": 0}).sort("created_at", -1))
    return rows


# ---- Checkout ------------------------------------------------------------


def _calc_total(menu: dict, lines: List[dict], bundle: bool) -> float:
    if bundle:
        if not menu.get("bundle_enabled") or not menu.get("bundle_price"):
            raise HTTPException(400, "Bundle not available")
        if len(lines) != 3:
            raise HTTPException(400, "Bundle requires 3 items (starter + main + dessert)")
        courses = set()
        for ln in lines:
            it, c = _find_item(menu, ln["item_id"])
            if not it or not c:
                raise HTTPException(400, f"Unknown item {ln['item_id']}")
            courses.add(c)
        if courses != set(COURSES):
            raise HTTPException(400, "Bundle requires one of each course")
        return float(menu["bundle_price"])
    if len(lines) != 1:
        raise HTTPException(400, "À la carte requires exactly one item")
    it, _ = _find_item(menu, lines[0]["item_id"])
    if not it:
        raise HTTPException(400, "Unknown item")
    return float(it["price"])


@router.post("/api/friday-menu/checkout")
async def checkout(req: CheckoutRequest, http_request: Request):
    menu = menus.find_one({"id": req.menu_id})
    if not menu or not menu.get("is_published"):
        raise HTTPException(404, "Menu not available")
    if not _order_window_open(menu):
        raise HTTPException(400, "Order window is closed")

    # Validate cafe participation
    participating = [p["location_id"] for p in menu.get("location_pickups", [])]
    if participating and req.location_id not in participating:
        raise HTTPException(400, "This cafe is not participating this week")

    lines = [ln.dict() for ln in req.lines]

    # Validate stock
    for ln in lines:
        if _stock_left(menu, ln["item_id"], req.location_id) <= 0:
            raise HTTPException(400, "An item in your order has sold out — please refresh")

    # Server-defined total to prevent frontend price tampering
    amount = _calc_total(menu, lines, req.bundle)

    # Initialise Stripe (lazy import so the module loads even if dependency absent)
    from emergentintegrations.payments.stripe.checkout import (
        StripeCheckout, CheckoutSessionRequest,
    )
    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        raise HTTPException(500, "Payments not configured")
    origin = req.origin_url.rstrip("/")
    webhook_url = f"{origin}/api/webhook/stripe"
    sc = StripeCheckout(api_key=api_key, webhook_url=webhook_url)

    order_id = uuid.uuid4().hex[:10]
    collection_code = f"{secrets.randbelow(10000):04d}"

    success_url = f"{origin}/friday-feast/confirmed?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/friday-feast"

    metadata = {
        "order_id": order_id,
        "menu_id": req.menu_id,
        "location_id": req.location_id,
        "bundle": "1" if req.bundle else "0",
    }
    session = await sc.create_checkout_session(CheckoutSessionRequest(
        amount=float(amount), currency="gbp",
        success_url=success_url, cancel_url=cancel_url,
        metadata=metadata,
    ))

    # Write pending payment + order records BEFORE returning
    now = datetime.now(timezone.utc).isoformat()
    payments.insert_one({
        "session_id": session.session_id,
        "order_id": order_id,
        "amount": float(amount),
        "currency": "gbp",
        "metadata": metadata,
        "payment_status": "initiated",
        "created_at": now,
    })
    orders_coll.insert_one({
        "id": order_id,
        "menu_id": req.menu_id,
        "week_friday": menu["week_friday"],
        "location_id": req.location_id,
        "bundle": req.bundle,
        "lines": lines,
        "amount": float(amount),
        "currency": "gbp",
        "customer_name": req.customer_name,
        "customer_phone": req.customer_phone,
        "customer_email": req.customer_email or "",
        "notes": req.notes,
        "collection_code": collection_code,
        "status": "pending",          # pending → accepted → ready → collected
        "payment_status": "initiated", # initiated → paid → refunded
        "session_id": session.session_id,
        "created_at": now,
    })
    return {"url": session.url, "session_id": session.session_id, "order_id": order_id}


@router.get("/api/friday-menu/status/{session_id}")
async def checkout_status(session_id: str, http_request: Request):
    """Frontend polls this after Stripe redirect."""
    tx = payments.find_one({"session_id": session_id}, {"_id": 0})
    if not tx:
        raise HTTPException(404, "Session not found")
    # If we already marked it paid (via webhook or a prior poll), return what we have
    if tx.get("payment_status") == "paid":
        order = orders_coll.find_one({"session_id": session_id}, {"_id": 0})
        return {"payment_status": "paid", "status": "complete", "order": order}

    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    api_key = os.environ.get("STRIPE_API_KEY")
    origin = str(http_request.base_url).rstrip("/")
    sc = StripeCheckout(api_key=api_key, webhook_url=f"{origin}/api/webhook/stripe")
    status_res = await sc.get_checkout_status(session_id)
    pay_status = status_res.payment_status

    payments.update_one(
        {"session_id": session_id},
        {"$set": {"payment_status": pay_status, "checked_at": datetime.now(timezone.utc).isoformat()}},
    )

    if pay_status == "paid" and tx.get("payment_status") != "paid":
        orders_coll.update_one(
            {"session_id": session_id, "payment_status": {"$ne": "paid"}},
            {"$set": {
                "payment_status": "paid",
                "paid_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
    order = orders_coll.find_one({"session_id": session_id}, {"_id": 0})
    return {"payment_status": pay_status, "status": status_res.status, "order": order}


@router.post("/api/webhook/stripe")
async def stripe_webhook(request: Request):
    """Stripe → us. Idempotent: only marks paid once."""
    body = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    api_key = os.environ.get("STRIPE_API_KEY")
    origin = str(request.base_url).rstrip("/")
    sc = StripeCheckout(api_key=api_key, webhook_url=f"{origin}/api/webhook/stripe")
    try:
        evt = await sc.handle_webhook(body, sig)
    except Exception as e:
        raise HTTPException(400, f"Webhook verification failed: {e}")

    if evt.payment_status == "paid":
        payments.update_one(
            {"session_id": evt.session_id, "payment_status": {"$ne": "paid"}},
            {"$set": {"payment_status": "paid", "webhook_at": datetime.now(timezone.utc).isoformat()}},
        )
        orders_coll.update_one(
            {"session_id": evt.session_id, "payment_status": {"$ne": "paid"}},
            {"$set": {"payment_status": "paid", "paid_at": datetime.now(timezone.utc).isoformat()}},
        )
    return {"received": True}
