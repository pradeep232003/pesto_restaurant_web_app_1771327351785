"""
AI settings — store / retrieve the LLM API key used for Business Intelligence.

The key is stored in the `app_settings` collection (singleton row keyed by
`name = "ai"`). Super admin only. The BI AI insights endpoint reads the key
from this collection first and falls back to the EMERGENT_LLM_KEY env var
for backwards compatibility.

We never return the raw key from the API — only a `has_key` boolean plus the
last 4 characters for confirmation. This avoids leaking the key in admin
browser memory / network logs.
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import get_super_admin
from db import db

router = APIRouter(prefix="/api/admin/ai-settings", tags=["ai-settings"])

app_settings = db["app_settings"]
KEY_NAME = "ai"


class AiKeyBody(BaseModel):
    # The actual API key. Plain string — no validation beyond stripping
    # whitespace because providers use very different key shapes
    # (`sk-emergent-…`, `sk-ant-…`, `sk-…`).
    api_key: str
    # 'emergent' (default, uses universal key) or 'anthropic' (raw Anthropic key)
    provider: str = "emergent"


def get_active_ai_key() -> Optional[str]:
    """Helper used by routes/bi.py. Returns the stored key or falls back to
    the env var. Never raises."""
    import os
    doc = app_settings.find_one({"name": KEY_NAME}, {"_id": 0})
    if doc and (doc.get("api_key") or "").strip():
        return doc["api_key"].strip()
    return os.environ.get("EMERGENT_LLM_KEY")


def get_active_ai_provider() -> str:
    doc = app_settings.find_one({"name": KEY_NAME}, {"_id": 0})
    return (doc or {}).get("provider", "emergent")


@router.get("")
async def get_ai_settings(user: dict = Depends(get_super_admin)):
    import os
    doc = app_settings.find_one({"name": KEY_NAME}, {"_id": 0}) or {}
    stored = (doc.get("api_key") or "").strip()
    env_key = os.environ.get("EMERGENT_LLM_KEY", "")
    effective = stored or env_key
    return {
        "has_key": bool(effective),
        "source": "database" if stored else ("env" if env_key else "none"),
        "provider": doc.get("provider", "emergent"),
        "last4": effective[-4:] if effective else "",
        "updated_at": doc.get("updated_at"),
        "updated_by": doc.get("updated_by_name") or doc.get("updated_by"),
    }


@router.put("")
async def set_ai_settings(body: AiKeyBody, user: dict = Depends(get_super_admin)):
    key = (body.api_key or "").strip()
    if not key:
        raise HTTPException(400, "api_key cannot be empty")
    if body.provider not in ("emergent", "anthropic"):
        raise HTTPException(400, "provider must be 'emergent' or 'anthropic'")
    app_settings.update_one(
        {"name": KEY_NAME},
        {"$set": {
            "name": KEY_NAME,
            "api_key": key,
            "provider": body.provider,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": user.get("email", ""),
            "updated_by_name": user.get("name", ""),
        }},
        upsert=True,
    )
    return {"saved": True, "provider": body.provider, "last4": key[-4:]}


@router.delete("")
async def clear_ai_settings(user: dict = Depends(get_super_admin)):
    """Clear the DB-stored key. Env var (if any) becomes the active source."""
    app_settings.delete_one({"name": KEY_NAME})
    return {"cleared": True}
