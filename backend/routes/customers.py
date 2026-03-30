from fastapi import APIRouter, Request, Response, Depends, HTTPException
from datetime import datetime, timezone, timedelta
import os
import uuid
import jwt
import httpx

from db import customers_collection
from auth import (
    hash_password, verify_password,
    JWT_SECRET, JWT_ALGORITHM, COOKIE_SECURE, COOKIE_SAMESITE,
)
from models import CustomerRegister, CustomerLogin
from helpers import serialize_doc

router = APIRouter(prefix="/api/customer", tags=["customers"])

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")


def _generate_otp():
    import random
    import string
    return ''.join(random.choices(string.digits, k=6))


async def get_customer(request: Request) -> dict:
    """Get current customer from token"""
    token = request.cookies.get("customer_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    if payload.get("type") != "customer_access":
        raise HTTPException(status_code=401, detail="Invalid token type")
    customer = customers_collection.find_one({"id": payload["sub"]})
    if not customer:
        raise HTTPException(status_code=401, detail="Customer not found")
    return serialize_doc(customer)


@router.post("/register")
async def customer_register(data: CustomerRegister, response: Response):
    """Register a new customer"""
    email = data.email.lower().strip()
    phone = data.phone.strip()

    if customers_collection.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered. Please login.")

    otp_email = _generate_otp()
    otp_phone = _generate_otp()
    password_raw = uuid.uuid4().hex[:12]

    customer_id = str(uuid.uuid4())
    customer = {
        "id": customer_id,
        "name": data.name.strip(),
        "email": email,
        "phone": phone,
        "password_hash": hash_password(password_raw),
        "email_verified": False,
        "phone_verified": False,
        "otp_email": otp_email,
        "otp_phone": otp_phone,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    customers_collection.insert_one(customer)

    email_sent = False
    resend_key = os.environ.get("RESEND_API_KEY")
    if resend_key:
        try:
            import resend
            resend.api_key = resend_key
            resend.Emails.send({
                "from": "Jolly's Kafe <onboarding@resend.dev>",
                "to": [email],
                "subject": "Verify your email - Jolly's Kafe",
                "html": f"<h2>Welcome to Jolly's Kafe!</h2><p>Your email verification code is: <strong>{otp_email}</strong></p>",
            })
            email_sent = True
        except Exception:
            pass

    return {
        "message": "Registration successful. Please verify your email.",
        "customer_id": customer_id,
        "password": password_raw,
        "email_sent": email_sent,
        "needs_verification": True,
        "verification_code": otp_email if not email_sent else None,
    }


@router.post("/verify")
async def customer_verify(request: Request, response: Response):
    """Verify customer email OTP and issue JWT"""
    body = await request.json()
    customer_id = body.get("customer_id")
    otp = body.get("otp")
    verify_type = body.get("type", "email")

    customer = customers_collection.find_one({"id": customer_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    field = f"otp_{verify_type}"
    if customer.get(field) != otp:
        raise HTTPException(status_code=400, detail="Invalid verification code")

    verified_field = f"{verify_type}_verified"
    customers_collection.update_one(
        {"id": customer_id},
        {"$set": {verified_field: True, "phone_verified": True, field: None}},
    )

    token = jwt.encode(
        {"sub": customer_id, "email": customer["email"], "type": "customer_access",
         "exp": datetime.now(timezone.utc) + timedelta(days=30)},
        JWT_SECRET, algorithm=JWT_ALGORITHM,
    )
    response.set_cookie(
        "customer_token", token,
        httponly=True, secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE, max_age=60 * 60 * 24 * 30,
    )

    safe = {k: v for k, v in customer.items() if k not in ("_id", "password_hash", "otp_email", "otp_phone")}
    safe["email_verified"] = True
    safe["phone_verified"] = True
    return {"message": "Email verified successfully", "token": token, "customer": safe}


@router.post("/login")
async def customer_login(data: CustomerLogin, response: Response):
    """Customer login"""
    email = data.email.lower().strip()
    customer = customers_collection.find_one({"email": email})
    if not customer:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not verify_password(data.password, customer["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = jwt.encode(
        {"sub": customer["id"], "email": email, "type": "customer_access",
         "exp": datetime.now(timezone.utc) + timedelta(days=30)},
        JWT_SECRET, algorithm=JWT_ALGORITHM,
    )
    response.set_cookie(
        "customer_token", token,
        httponly=True, secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE, max_age=60 * 60 * 24 * 30,
    )

    safe = {k: v for k, v in customer.items() if k not in ("_id", "password_hash", "otp_email", "otp_phone")}
    return {"message": "Login successful", "token": token, "customer": safe}


@router.get("/me")
async def customer_me(customer: dict = Depends(get_customer)):
    """Get current customer profile"""
    safe = {k: v for k, v in customer.items() if k not in ("_id", "password_hash", "otp_email", "otp_phone")}
    return safe


@router.post("/logout")
async def customer_logout(response: Response):
    response.delete_cookie("customer_token")
    return {"message": "Logged out"}


# ============== GOOGLE OAUTH (EMERGENT AUTH) ==============

@router.post("/auth/google-session")
async def customer_google_session(request: Request, response: Response):
    """Exchange Emergent Auth session_id for a customer session"""
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id},
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    google_data = resp.json()
    email = google_data["email"].lower().strip()
    name = google_data.get("name", email.split("@")[0])
    picture = google_data.get("picture", "")

    existing = customers_collection.find_one({"email": email})
    if existing:
        customers_collection.update_one(
            {"email": email},
            {"$set": {"name": name, "picture": picture, "google_linked": True}},
        )
        customer_id = existing["id"]
    else:
        customer_id = str(uuid.uuid4())
        customers_collection.insert_one({
            "id": customer_id, "name": name, "email": email, "phone": "",
            "password_hash": "", "email_verified": True, "phone_verified": False,
            "google_linked": True, "picture": picture,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    token = jwt.encode(
        {"sub": customer_id, "email": email, "type": "customer_access",
         "exp": datetime.now(timezone.utc) + timedelta(days=30)},
        JWT_SECRET, algorithm=JWT_ALGORITHM,
    )
    response.set_cookie(
        "customer_token", token,
        httponly=True, secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE, max_age=60 * 60 * 24 * 30,
    )

    customer = customers_collection.find_one({"id": customer_id})
    safe = {k: v for k, v in customer.items() if k not in ("_id", "password_hash", "otp_email", "otp_phone")}
    return {"message": "Google login successful", "token": token, "customer": safe}
