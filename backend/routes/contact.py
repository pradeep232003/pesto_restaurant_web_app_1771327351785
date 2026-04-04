from fastapi import APIRouter, Request, HTTPException
from datetime import datetime, timezone
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os

from db import db

router = APIRouter(tags=["contact"])

SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_EMAIL = os.environ.get("SMTP_EMAIL", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
CONTACT_RECIPIENT = os.environ.get("CONTACT_RECIPIENT", "")


def send_contact_email(name: str, email: str, phone: str, subject: str, message: str, location_id: str):
    if not all([SMTP_HOST, SMTP_EMAIL, SMTP_PASSWORD, CONTACT_RECIPIENT]):
        print("SMTP not configured, skipping email")
        return False

    msg = MIMEMultipart()
    msg["From"] = f"Jolly's Kafe Website <{SMTP_EMAIL}>"
    msg["To"] = CONTACT_RECIPIENT
    msg["Subject"] = f"New Contact Form: {subject or 'General Enquiry'}"
    msg["Reply-To"] = email

    body = f"""New message from the Jolly's Kafe website contact form:

Name: {name}
Email: {email}
Phone: {phone or 'Not provided'}
Subject: {subject or 'General Enquiry'}
Location: {location_id or 'Not specified'}

Message:
{message}

---
This email was sent automatically from www.jollyskafe.com
"""
    msg.attach(MIMEText(body, "plain"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.send_message(msg)
        print(f"Contact email sent to {CONTACT_RECIPIENT}")
        return True
    except Exception as e:
        print(f"Failed to send contact email: {e}")
        return False


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

    phone = body.get("phone", "").strip()
    subject = body.get("subject", "").strip()
    location_id = body.get("location_id", "")

    contact_doc = {
        "name": name,
        "email": email,
        "phone": phone,
        "subject": subject,
        "message": message,
        "location_id": location_id,
        "status": "new",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    db["contact_messages"].insert_one(contact_doc)

    # Send email notification
    send_contact_email(name, email, phone, subject, message, location_id)

    return {"success": True, "message": "Thank you for your message. We'll get back to you soon."}
