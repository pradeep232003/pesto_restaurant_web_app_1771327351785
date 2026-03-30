from fastapi import APIRouter, Request, HTTPException
from datetime import datetime, timezone

from db import db

router = APIRouter(tags=["contact"])


@router.post("/api/contact")
async def submit_contact(request: Request):
    body = await request.json()

    # Spam checks
    if body.get("_hp", ""):
        return {"success": True}

    ts = body.get("_ts", 0)
    if isinstance(ts, (int, float)) and ts < 3000:
        return {"success": True}

    name = body.get("name", "").strip()
    email = body.get("email", "").strip()
    message = body.get("message", "").strip()

    if not name or not email or not message:
        raise HTTPException(status_code=400, detail="Name, email, and message are required")
    if len(message) < 10:
        raise HTTPException(status_code=400, detail="Message must be at least 10 characters")

    contact_doc = {
        "name": name,
        "email": email,
        "phone": body.get("phone", "").strip(),
        "subject": body.get("subject", "").strip(),
        "message": message,
        "location_id": body.get("location_id", ""),
        "status": "new",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    db["contact_messages"].insert_one(contact_doc)
    return {"success": True, "message": "Thank you for your message. We'll get back to you soon."}
