import os
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, Request
from bson import ObjectId
from db import users_collection, login_attempts_collection

# JWT Configuration
JWT_SECRET = os.environ.get("JWT_SECRET", "fallback-secret-change-in-production")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
REFRESH_TOKEN_EXPIRE_DAYS = 7

# Cookie settings
IS_PRODUCTION = bool(os.environ.get("CORS_ORIGINS") or os.environ.get("FRONTEND_URL"))
COOKIE_SECURE = IS_PRODUCTION
COOKIE_SAMESITE = "none" if IS_PRODUCTION else "lax"

# Brute force protection settings
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_MINUTES = 15


# ============== PASSWORD HELPERS ==============

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


# ============== JWT HELPERS ==============

def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        "type": "access"
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        "type": "refresh"
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ============== AUTH DEPENDENCIES ==============

async def get_current_user(request: Request) -> dict:
    """Get current user from token (cookie or header)"""
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    payload = decode_token(token)
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")

    user = users_collection.find_one({"_id": ObjectId(payload["sub"])})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    user["_id"] = str(user["_id"])
    user.pop("password_hash", None)
    return user

async def get_admin_user(request: Request) -> dict:
    """Get current user and verify they are admin or super_admin"""
    user = await get_current_user(request)
    if user.get("role") not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


async def get_staff_or_above(request: Request) -> dict:
    """Get current user and verify they are staff, admin, or super_admin"""
    user = await get_current_user(request)
    if user.get("role") not in ("staff", "admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Staff access required")
    return user


async def get_super_admin(request: Request) -> dict:
    """Get current user and verify they are super_admin"""
    user = await get_current_user(request)
    if user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    return user


# ============== BRUTE FORCE PROTECTION ==============

def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"

def check_brute_force(identifier: str) -> bool:
    """Check if account/IP is locked out. Returns True if locked."""
    attempt = login_attempts_collection.find_one({"identifier": identifier})
    if not attempt:
        return False

    if attempt.get("locked_until"):
        locked_until = attempt["locked_until"]
        if not hasattr(locked_until, 'tzinfo') or locked_until.tzinfo is None:
            locked_until = locked_until.replace(tzinfo=timezone.utc)

        if datetime.now(timezone.utc) < locked_until:
            return True
        login_attempts_collection.delete_one({"identifier": identifier})
    return False

def record_failed_attempt(identifier: str):
    """Record a failed login attempt"""
    attempt = login_attempts_collection.find_one({"identifier": identifier})
    if attempt:
        new_count = attempt.get("count", 0) + 1
        update = {"$set": {"count": new_count, "last_attempt": datetime.now(timezone.utc)}}
        if new_count >= MAX_LOGIN_ATTEMPTS:
            update["$set"]["locked_until"] = datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_MINUTES)
        login_attempts_collection.update_one({"identifier": identifier}, update)
    else:
        login_attempts_collection.insert_one({
            "identifier": identifier,
            "count": 1,
            "last_attempt": datetime.now(timezone.utc)
        })

def clear_failed_attempts(identifier: str):
    """Clear failed attempts on successful login"""
    login_attempts_collection.delete_one({"identifier": identifier})
