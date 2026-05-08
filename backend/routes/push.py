"""
Web Push subscription management + dispatcher.

Stores PushSubscription objects from the browser and exposes a small helper
(`send_push_to_location`) used by the Cooking & Cooling scheduler to fire
real push notifications even when the JKHive PWA is closed.

Requires the following env vars (auto-generated once and stored in backend/.env):
  VAPID_PUBLIC_KEY   urlsafe-base64 raw EC public key (65 bytes uncompressed)
  VAPID_PRIVATE_KEY  urlsafe-base64 raw EC private key (32 bytes)
  VAPID_SUBJECT      mailto:… contact for push services
"""
import os
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from pywebpush import webpush, WebPushException

from db import db
from auth import get_staff_or_above

logger = logging.getLogger("push")

router = APIRouter(tags=["push"])

subscriptions = db["push_subscriptions"]

VAPID_PUBLIC = os.environ.get("VAPID_PUBLIC_KEY", "")
VAPID_PRIVATE = os.environ.get("VAPID_PRIVATE_KEY", "")
VAPID_SUBJECT = os.environ.get("VAPID_SUBJECT", "mailto:admin@example.com")


# ============== MODELS ==============

class PushKeys(BaseModel):
    p256dh: str
    auth: str


class PushSubscription(BaseModel):
    endpoint: str
    keys: PushKeys
    expirationTime: Optional[int] = None


class SubscribeBody(BaseModel):
    location_id: str
    subscription: PushSubscription
    user_agent: Optional[str] = ""


class UnsubscribeBody(BaseModel):
    endpoint: str


# ============== ENDPOINTS ==============

@router.get("/api/push/vapid-public-key")
async def get_public_key():
    return {"public_key": VAPID_PUBLIC}


@router.post("/api/push/subscribe")
async def subscribe(body: SubscribeBody, user: dict = Depends(get_staff_or_above)):
    """Upsert a push subscription, keyed by endpoint."""
    if not VAPID_PUBLIC:
        raise HTTPException(503, "Push not configured on server")
    sub_doc = {
        "id": str(uuid.uuid4())[:12],
        "location_id": body.location_id,
        "endpoint": body.subscription.endpoint,
        "keys": body.subscription.keys.dict(),
        "user_agent": body.user_agent or "",
        "user_email": user.get("email", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    existing = subscriptions.find_one({"endpoint": body.subscription.endpoint})
    if existing:
        subscriptions.update_one(
            {"endpoint": body.subscription.endpoint},
            {"$set": {"location_id": body.location_id, "keys": sub_doc["keys"], "user_email": sub_doc["user_email"]}},
        )
        return {"updated": True, "id": existing.get("id")}
    subscriptions.insert_one(dict(sub_doc))
    return {"created": True, "id": sub_doc["id"]}


@router.post("/api/push/unsubscribe")
async def unsubscribe(body: UnsubscribeBody, user: dict = Depends(get_staff_or_above)):
    res = subscriptions.delete_one({"endpoint": body.endpoint})
    return {"deleted": res.deleted_count}


@router.post("/api/admin/push/test")
async def test_push(user: dict = Depends(get_staff_or_above)):
    """Send a test push to every subscription for the calling user."""
    sent = send_push_to_user(user.get("email", ""), {
        "title": "JKHive test push",
        "body": "If you can read this on the lock-screen, push is working.",
        "tag": "jkhive-test",
        "url": "/jkhive/cooking-cooling",
    })
    return {"sent": sent}


# ============== DISPATCHER ==============

def _send(sub_doc: dict, payload: dict) -> bool:
    try:
        webpush(
            subscription_info={
                "endpoint": sub_doc["endpoint"],
                "keys": sub_doc["keys"],
            },
            data=json.dumps(payload),
            vapid_private_key=VAPID_PRIVATE,
            vapid_claims={"sub": VAPID_SUBJECT},
            ttl=300,
        )
        return True
    except WebPushException as e:
        # 404/410 means the subscription is dead — purge it.
        status = getattr(getattr(e, "response", None), "status_code", None)
        if status in (404, 410):
            subscriptions.delete_one({"endpoint": sub_doc["endpoint"]})
            logger.info("push: purged dead subscription endpoint=%s", sub_doc["endpoint"][:60])
        else:
            logger.warning("push: webpush failed status=%s err=%s", status, e)
        return False
    except Exception as e:
        logger.exception("push: unexpected error: %s", e)
        return False


def send_push_to_location(location_id: str, payload: dict) -> int:
    """Fire `payload` to every subscription registered under `location_id`. Returns count delivered."""
    if not (VAPID_PUBLIC and VAPID_PRIVATE):
        return 0
    sent = 0
    for sub in list(subscriptions.find({"location_id": location_id})):
        if _send(sub, payload):
            sent += 1
    return sent


def send_push_to_user(email: str, payload: dict) -> int:
    if not (VAPID_PUBLIC and VAPID_PRIVATE) or not email:
        return 0
    sent = 0
    for sub in list(subscriptions.find({"user_email": email})):
        if _send(sub, payload):
            sent += 1
    return sent
