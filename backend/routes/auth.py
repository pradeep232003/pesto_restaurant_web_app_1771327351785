from fastapi import APIRouter, Request, Response, Depends, HTTPException
from bson import ObjectId
from db import users_collection
from auth import (
    hash_password, verify_password, create_access_token, create_refresh_token,
    decode_token, get_current_user, get_client_ip, check_brute_force,
    record_failed_attempt, clear_failed_attempts,
    COOKIE_SECURE, COOKIE_SAMESITE, ACCESS_TOKEN_EXPIRE_MINUTES,
)
from models import LoginRequest
from helpers import serialize_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login")
async def login(request: Request, response: Response, credentials: LoginRequest):
    """Admin login with brute force protection"""
    email = credentials.email.lower().strip()
    client_ip = get_client_ip(request)

    if check_brute_force(email) or check_brute_force(client_ip):
        raise HTTPException(status_code=429, detail="Too many failed attempts. Please try again later.")

    user = users_collection.find_one({"email": email})
    if not user or not verify_password(credentials.password, user["password_hash"]):
        record_failed_attempt(email)
        record_failed_attempt(client_ip)
        raise HTTPException(status_code=401, detail="Invalid email or password")

    clear_failed_attempts(email)
    clear_failed_attempts(client_ip)

    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email, user.get("role", "user"))
    refresh_token = create_refresh_token(user_id)

    response.set_cookie(
        key="access_token", value=access_token,
        httponly=True, secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60, path="/",
    )
    response.set_cookie(
        key="refresh_token", value=refresh_token,
        httponly=True, secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE,
        max_age=60 * 60 * 24 * 7, path="/",
    )

    user_data = serialize_user(user)
    user_data["access_token"] = access_token
    user_data["refresh_token"] = refresh_token
    return user_data


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return {"message": "Logged out successfully"}


@router.get("/me")
async def get_me(user: dict = Depends(get_current_user)):
    return {k: v for k, v in user.items() if k != "password_hash"}


@router.post("/refresh")
async def refresh_token(request: Request, response: Response):
    """Refresh access token using refresh token"""
    token = request.cookies.get("refresh_token")
    if not token:
        try:
            body = await request.json()
            token = body.get("refresh_token")
        except Exception:
            pass
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")

    payload = decode_token(token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")

    user = users_collection.find_one({"_id": ObjectId(payload["sub"])})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    access_token = create_access_token(str(user["_id"]), user["email"], user.get("role", "user"))

    response.set_cookie(
        key="access_token", value=access_token,
        httponly=True, secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60, path="/",
    )

    user_data = serialize_user(user)
    user_data["access_token"] = access_token
    return user_data


@router.post("/customer-elevate")
async def customer_elevate(request: Request, response: Response):
    """Elevate a customer token to admin access if they have staff/admin role"""
    import jwt as pyjwt
    from auth import JWT_SECRET, JWT_ALGORITHM
    from db import customers_collection

    # Get customer token
    token = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
    if not token:
        try:
            body = await request.json()
            token = body.get("customer_token")
        except Exception:
            pass
    if not token:
        raise HTTPException(status_code=401, detail="No customer token")

    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    if payload.get("type") != "customer_access":
        raise HTTPException(status_code=401, detail="Not a customer token")

    customer = customers_collection.find_one({"id": payload["sub"]})
    if not customer:
        raise HTTPException(status_code=401, detail="Customer not found")

    role = customer.get("role", "customer")
    if role not in ("staff", "admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    # Ensure user exists in users_collection for admin panel
    existing_user = users_collection.find_one({"email": customer["email"]})
    if not existing_user:
        from datetime import datetime, timezone
        users_collection.insert_one({
            "email": customer["email"],
            "password_hash": hash_password(str(__import__('uuid').uuid4())[:8]),
            "name": customer.get("name", ""),
            "role": role,
            "created_at": datetime.now(timezone.utc),
            "promoted_from_customer": True,
        })
        existing_user = users_collection.find_one({"email": customer["email"]})
    else:
        # Sync role
        if existing_user.get("role") != role:
            users_collection.update_one({"email": customer["email"]}, {"$set": {"role": role}})
            existing_user["role"] = role

    user_id = str(existing_user["_id"])
    access_token = create_access_token(user_id, customer["email"], role)
    refresh_token = create_refresh_token(user_id)

    response.set_cookie(
        key="access_token", value=access_token,
        httponly=True, secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60, path="/",
    )
    response.set_cookie(
        key="refresh_token", value=refresh_token,
        httponly=True, secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE,
        max_age=60 * 60 * 24 * 7, path="/",
    )

    user_data = serialize_user(existing_user)
    user_data["access_token"] = access_token
    user_data["refresh_token"] = refresh_token
    return user_data
