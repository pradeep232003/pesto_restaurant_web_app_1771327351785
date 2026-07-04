"""
Sales Training — AI-generated up-selling & cross-selling scripts for
front-of-house staff, tailored to each location's menu.

Admins hit the `/refresh` endpoint whenever the menu changes; staff get
read-only access to the latest saved playbook. Content is stored in
Mongo so staff can flick through it offline (once the SW caches it).
"""
import json
import re
import uuid
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query

from db import db, menu_items_collection
from auth import get_admin_user, get_current_user


router = APIRouter(prefix="/api/sales-training", tags=["sales-training"])

sales_training_collection = db["sales_training"]


_AI_SYSTEM = (
    "You are a hospitality trainer for Jolly's Kafe writing short, "
    "actionable server scripts. You will be given the menu for one site. "
    "Return STRICT JSON only, no markdown, no commentary.\n\n"
    "Produce TWO sections:\n"
    "1. upsells — take 6-10 popular-sounding dishes and suggest a small "
    "   uplift (bigger portion, premium add-on, side, drink pairing). Each "
    "   item must include a 1-2 sentence server_script the staff can say "
    "   verbatim, plus a short reason (why it works).\n"
    "2. cross_sells — 6-10 pairings of two dishes/items from the menu that "
    "   complement each other. Each with a server_script and reason.\n\n"
    "TONE: friendly, confident, never pushy. Never invent items that "
    "aren't on the supplied menu.\n\n"
    "RESPONSE SHAPE:\n"
    "{\n"
    "  \"upsells\": [\n"
    "    {\"item\": \"Chicken Katsu Curry\", \"suggestion\": \"Add prawn crackers\", \n"
    "     \"server_script\": \"Would you like to add prawn crackers for £1.50 — they go beautifully with the katsu sauce.\", \n"
    "     \"reason\": \"Low-effort attach, boosts ticket by ~10%\"}\n"
    "  ],\n"
    "  \"cross_sells\": [\n"
    "    {\"items\": [\"Vegan Buddha Bowl\", \"Ginger Lemonade\"], \n"
    "     \"server_script\": \"Try our house ginger lemonade with that — the zing balances the tahini.\", \n"
    "     \"reason\": \"Fresh + fresh, both vegan\"}\n"
    "  ]\n"
    "}"
)


def _scrub_json(text: str) -> str:
    """Extract the JSON object even if the model wraps it in ```json fences."""
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?", "", text, count=1).strip()
        if text.endswith("```"):
            text = text[:-3].strip()
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        text = text[start:end + 1]
    return text


def _load_menu(location_id: str) -> list:
    """Return a compact menu payload for the LLM — name, price, description
    and top ingredients per item, capped at 120 items to stay within a
    single Claude request."""
    rows = list(menu_items_collection.find(
        {"location_id": location_id, "is_available": {"$ne": False}},
        {"_id": 0, "name": 1, "price": 1, "description": 1, "category": 1, "recipe": 1},
    ).limit(200))
    menu = []
    for r in rows:
        recipe = r.get("recipe") or []
        ingredients = [ln.get("ingredient") for ln in recipe if isinstance(ln, dict) and ln.get("ingredient")][:6]
        menu.append({
            "name": (r.get("name") or "").strip(),
            "price": float(r.get("price") or 0),
            "category": (r.get("category") or "").strip(),
            "description": (r.get("description") or "").strip()[:180],
            "ingredients": ingredients,
        })
    return menu[:120]


@router.get("")
async def get_sales_training(
    location_id: str = Query(...),
    user: dict = Depends(get_current_user),
):
    """Latest saved training for a site. Any authenticated user can read
    so servers can revise on their phone."""
    doc = sales_training_collection.find_one(
        {"location_id": location_id},
        {"_id": 0},
        sort=[("generated_at", -1)],
    )
    if not doc:
        return {"exists": False, "location_id": location_id}
    doc["exists"] = True
    return doc


@router.post("/refresh")
async def refresh_sales_training(
    location_id: str = Query(...),
    user: dict = Depends(get_admin_user),
):
    """Admin/super_admin only. Rebuilds the training content from the
    current menu + saves it. Overwrites any previous version (only the
    latest is meaningful to staff)."""
    from routes.ai_settings import get_active_ai_key, get_active_ai_provider
    api_key = get_active_ai_key()
    if not api_key:
        raise HTTPException(
            500,
            "AI unavailable: no API key configured. Open Admin → AI Settings to add one.",
        )
    provider = get_active_ai_provider()

    menu = _load_menu(location_id)
    if not menu:
        raise HTTPException(400, "No menu items found for this location. Add items first.")

    user_text = (
        "Menu for this site (name, price GBP, category, description, key ingredients):\n\n"
        f"{json.dumps(menu, indent=2)}\n\n"
        "Return the JSON now."
    )

    req = {
        "model": "claude-sonnet-4-5-20250929",
        "max_tokens": 3000,
        "system": _AI_SYSTEM,
        "messages": [{"role": "user", "content": user_text}],
    }
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            resp = await client.post("https://api.anthropic.com/v1/messages", json=req, headers=headers)
    except Exception as e:  # noqa: BLE001
        snippet = (str(e) or e.__class__.__name__).splitlines()[0][:240]
        raise HTTPException(502, f"AI provider error ({provider}): {snippet}")

    if resp.status_code >= 400:
        try:
            err = resp.json().get("error", {}).get("message", resp.text)
        except Exception:
            err = resp.text
        raise HTTPException(502, f"AI provider error ({provider}, {resp.status_code}): {err[:240]}")

    data = resp.json()
    text = "".join(
        block.get("text", "") for block in (data.get("content") or [])
        if block.get("type") == "text"
    ).strip()
    if not text:
        raise HTTPException(502, "AI returned an empty response")

    try:
        parsed = json.loads(_scrub_json(text))
    except json.JSONDecodeError as e:
        raise HTTPException(502, f"AI returned non-JSON: {e}")

    upsells = [u for u in (parsed.get("upsells") or []) if isinstance(u, dict) and u.get("item")]
    cross_sells = [c for c in (parsed.get("cross_sells") or []) if isinstance(c, dict) and c.get("items")]

    doc = {
        "id": str(uuid.uuid4())[:12],
        "location_id": location_id,
        "upsells": upsells,
        "cross_sells": cross_sells,
        "dish_count": len(menu),
        "model": req["model"],
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "generated_by": user.get("email", ""),
        "generated_by_name": user.get("name", ""),
    }
    # Keep only the latest per location — history isn't useful here and it
    # keeps the read query trivial.
    sales_training_collection.delete_many({"location_id": location_id})
    sales_training_collection.insert_one(dict(doc))
    doc["exists"] = True
    return doc
