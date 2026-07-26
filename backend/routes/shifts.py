"""
Shift Management — schedule employees per site, per day.

Stores a flat list of shift documents; the UI groups them by location +
date range. Open/close times are HH:MM strings (24h); `hours` is derived
on read so we don't have to keep it in sync on every patch.

Admin gated (admin + super_admin) — staff can view their own shifts via
their account, but creating/editing requires manager privileges.
"""
import json
import os
import logging
import smtplib
import socket
import uuid
from datetime import datetime, timezone, date as _date, timedelta as _td
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from typing import Optional, List

import resend
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from db import db
from auth import get_admin_user, get_staff_or_above

router = APIRouter(prefix="/api/admin/shifts", tags=["shifts"])

_log = logging.getLogger("shifts")

SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_EMAIL = os.environ.get("SMTP_EMAIL", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")

# Resend (primary transport — HTTPS on port 443, always open on PaaS).
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
RESEND_FROM = os.environ.get("RESEND_FROM", "Jolly's Kafe Rotas <onboarding@resend.dev>")
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

shifts_collection = db["shifts"]
staff_collection = db["staff_members"]
daily_sales_collection = db["daily_sales"]
site_settings_collection = db["site_settings"]
shift_budgets_collection = db["shift_budgets"]
locations_collection = db["locations"]


# Default wage-to-revenue target. Keep in sync with the frontend label.
DEFAULT_WAGE_TARGET_PCT = 30.0


def _hours_between(start: str, end: str) -> float:
    """Compute decimal hours between HH:MM strings. Handles overnight shifts
    by adding 24h when end < start."""
    try:
        sh, sm = (int(p) for p in start.split(":"))
        eh, em = (int(p) for p in end.split(":"))
        mins = (eh * 60 + em) - (sh * 60 + sm)
        if mins < 0:
            mins += 24 * 60
        return round(mins / 60.0, 2)
    except Exception:
        return 0.0


def _decorate(doc: dict) -> dict:
    """Strip Mongo internals + compute display fields."""
    out = {k: v for k, v in doc.items() if k != "_id"}
    if out.get("start_time") and out.get("end_time"):
        out["hours"] = _hours_between(out["start_time"], out["end_time"])
    return out


class ShiftBody(BaseModel):
    location_id: str
    staff_id: str
    date: str = Field(..., description="YYYY-MM-DD")
    start_time: str = Field(..., description="HH:MM 24h")
    end_time: str = Field(..., description="HH:MM 24h")
    role: str = ""
    notes: str = ""


class ShiftPatch(BaseModel):
    staff_id: Optional[str] = None
    date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    role: Optional[str] = None
    notes: Optional[str] = None


def _resolve_staff_name(staff_id: str) -> str:
    rec = staff_collection.find_one({"id": staff_id}, {"_id": 0, "name": 1})
    return (rec or {}).get("name") or "Unknown"


@router.get("")
async def list_shifts(
    location_id: str = Query(...),
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD inclusive"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD inclusive"),
    user: dict = Depends(get_staff_or_above),
):
    q: dict = {"location_id": location_id}
    # Non-admin staff users only see their own *published* shifts. Drafts
    # are management-only. Email match is case-insensitive.
    role = user.get("role", "")
    is_staff_only = role not in ("admin", "super_admin")
    if is_staff_only:
        email = (user.get("email") or "").strip().lower()
        if not email:
            return []
        rec = staff_collection.find_one({"account_email": email}, {"_id": 0, "id": 1})
        if not rec:
            return []
        q["staff_id"] = rec["id"]
        q["published"] = True
    if start_date or end_date:
        q["date"] = {}
        if start_date:
            q["date"]["$gte"] = start_date
        if end_date:
            q["date"]["$lte"] = end_date
    rows = list(shifts_collection.find(q, {"_id": 0}).sort([("date", 1), ("start_time", 1)]).limit(2000))
    return [_decorate(r) for r in rows]


class PublishWeekBody(BaseModel):
    location_id: str
    start_date: str  # YYYY-MM-DD inclusive
    end_date: str    # YYYY-MM-DD inclusive
    notify: bool = True


def _fmt_date_long(iso: str) -> str:
    """`2026-02-10` → `Tue 10 Feb`. Falls back to raw string on parse fail."""
    try:
        d = _date.fromisoformat(iso)
        return d.strftime("%a %d %b")
    except Exception:
        return iso


def _send_rota_email(
    *, to_email: str, staff_name: str, location_name: str,
    start_date: str, end_date: str, shifts: List[dict],
) -> bool:
    """Send one staff member a summary of their published rota for the week.

    Prefers Resend (HTTPS, works everywhere) then falls back to SMTP.
    Returns True on success, False on any failure (logged, never raised)."""
    if not to_email or not shifts:
        return False
    if not (RESEND_API_KEY or (SMTP_HOST and SMTP_EMAIL and SMTP_PASSWORD)):
        _log.info("shifts.email: no transport configured; skipping email to %s", to_email)
        return False

    ordered = sorted(shifts, key=lambda s: (s.get("date", ""), s.get("start_time", "")))

    rows_html = "".join(
        f"<tr>"
        f"<td style='padding:8px 12px;border-bottom:1px solid #EEE;font-size:14px'>{_fmt_date_long(s.get('date',''))}</td>"
        f"<td style='padding:8px 12px;border-bottom:1px solid #EEE;font-size:14px;font-variant-numeric:tabular-nums'>{s.get('start_time','')}–{s.get('end_time','')}</td>"
        f"<td style='padding:8px 12px;border-bottom:1px solid #EEE;font-size:14px;color:#86868B'>{s.get('role') or ''}</td>"
        f"</tr>"
        for s in ordered
    )
    rows_text = "\n".join(
        f"  • {_fmt_date_long(s.get('date',''))} {s.get('start_time','')}-{s.get('end_time','')}"
        + (f" · {s.get('role')}" if s.get('role') else "")
        for s in ordered
    )

    subject = f"Your rota {_fmt_date_long(start_date)} — {_fmt_date_long(end_date)} · {location_name}"

    text_body = (
        f"Hi {staff_name or 'there'},\n\n"
        f"Your shifts have been published for the week of {start_date} to {end_date} at {location_name}.\n\n"
        f"{rows_text}\n\n"
        f"View your full rota: https://jollyskafe.com/jkhive/shifts\n\n"
        f"— Jolly's Kafe"
    )

    html_body = f"""\
<html><body style="font-family:'Outfit',-apple-system,sans-serif;background:#F5F5F7;padding:24px;color:#1D1D1F">
  <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:16px;padding:28px;box-shadow:0 1px 3px rgba(0,0,0,0.05)">
    <p style="font-size:12px;color:#86868B;text-transform:uppercase;letter-spacing:0.6px;margin:0 0 4px">New rota published</p>
    <h1 style="font-size:22px;margin:0 0 4px;font-weight:700">Hi {staff_name or 'there'},</h1>
    <p style="font-size:14px;color:#3A3A3C;margin:0 0 20px">
      Your shifts for <strong>{_fmt_date_long(start_date)} — {_fmt_date_long(end_date)}</strong>
      at <strong>{location_name}</strong> are ready.
    </p>
    <table style="width:100%;border-collapse:collapse;border-radius:10px;overflow:hidden;background:#FBFBFD">
      <thead>
        <tr style="background:#F5F5F7">
          <th style="text-align:left;padding:8px 12px;font-size:11px;color:#86868B;text-transform:uppercase;letter-spacing:0.5px">Date</th>
          <th style="text-align:left;padding:8px 12px;font-size:11px;color:#86868B;text-transform:uppercase;letter-spacing:0.5px">Time</th>
          <th style="text-align:left;padding:8px 12px;font-size:11px;color:#86868B;text-transform:uppercase;letter-spacing:0.5px">Role</th>
        </tr>
      </thead>
      <tbody>{rows_html}</tbody>
    </table>
    <p style="margin:24px 0 0">
      <a href="https://jollyskafe.com/jkhive/shifts"
         style="display:inline-block;background:#1D1D1F;color:#FFFFFF;padding:10px 18px;border-radius:999px;text-decoration:none;font-size:13px;font-weight:600">
        View full rota
      </a>
    </p>
    <p style="font-size:11px;color:#86868B;margin:24px 0 0">— Jolly's Kafe</p>
  </div>
</body></html>"""

    # 1) Prefer Resend — HTTPS on 443, always open on PaaS.
    if RESEND_API_KEY:
        try:
            res = resend.Emails.send({
                "from": RESEND_FROM,
                "to": [to_email],
                "subject": subject,
                "html": html_body,
                "text": text_body,
            })
            _log.info("shifts.email: sent via Resend to %s (id=%s)",
                      to_email, (res or {}).get("id"))
            return True
        except Exception as ex:
            _log.warning("shifts.email: Resend send failed to %s: %s — falling back to SMTP",
                         to_email, ex)

    # 2) SMTP fallback. 465 → implicit SSL, else STARTTLS. 20s timeout.
    if not (SMTP_HOST and SMTP_EMAIL and SMTP_PASSWORD):
        return False
    msg = MIMEMultipart("alternative")
    msg["From"] = f"Jolly's Kafe Rotas <{SMTP_EMAIL}>"
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))
    try:
        if SMTP_PORT == 465:
            with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=20) as server:
                server.login(SMTP_EMAIL, SMTP_PASSWORD)
                server.send_message(msg)
        else:
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as server:
                server.starttls()
                server.login(SMTP_EMAIL, SMTP_PASSWORD)
                server.send_message(msg)
        _log.info("shifts.email: sent via SMTP to %s (%d shift(s))", to_email, len(ordered))
        return True
    except Exception as ex:  # pragma: no cover — never break publish
        _log.warning("shifts.email: SMTP send failed to %s (host=%s port=%s): %s",
                     to_email, SMTP_HOST, SMTP_PORT, ex)
        return False


@router.post("/publish-week")
async def publish_week(body: PublishWeekBody, user: dict = Depends(get_admin_user)):
    """Mark every draft shift in the range as published, and (optionally)
    fire a push notification to each affected staff member's subscribed
    devices. Already-published shifts are left untouched."""
    res = shifts_collection.update_many(
        {
            "location_id": body.location_id,
            "date": {"$gte": body.start_date, "$lte": body.end_date},
            "published": {"$ne": True},
        },
        {"$set": {
            "published": True,
            "published_at": datetime.now(timezone.utc).isoformat(),
            "published_by": user.get("email", ""),
            "published_by_name": user.get("name", ""),
        }},
    )
    published_count = res.modified_count

    notified = 0
    emailed = 0
    if body.notify and published_count:
        # Group newly-published shifts by staff_id so each person gets one
        # push + one email, not one per shift. We re-query the freshly-flagged rows.
        rows = list(shifts_collection.find(
            {
                "location_id": body.location_id,
                "date": {"$gte": body.start_date, "$lte": body.end_date},
                "published_at": {"$exists": True},
            },
            {"_id": 0, "staff_id": 1, "date": 1, "start_time": 1, "end_time": 1,
             "staff_name": 1, "role": 1, "notes": 1, "hours": 1},
        ))
        per_staff: dict = {}
        for r in rows:
            per_staff.setdefault(r.get("staff_id", ""), []).append(r)

        loc_rec = locations_collection.find_one(
            {"id": body.location_id}, {"_id": 0, "name": 1},
        ) or {}
        loc_name = loc_rec.get("name") or body.location_id

        from routes.push import send_push_to_user
        for staff_id, shifts in per_staff.items():
            staff_rec = staff_collection.find_one(
                {"id": staff_id}, {"_id": 0, "account_email": 1, "name": 1, "email": 1},
            )
            if not staff_rec:
                continue
            count = len(shifts)
            first = min(shifts, key=lambda s: s.get("date", "9999"))
            body_text = (
                f"{count} shift{'s' if count != 1 else ''} published. "
                f"First: {first.get('date')} {first.get('start_time')}–{first.get('end_time')}."
            )
            # Push (existing)
            if staff_rec.get("account_email") and send_push_to_user(
                staff_rec["account_email"], {
                    "title": "New rota published",
                    "body": body_text,
                    "tag": f"shift-publish-{body.start_date}",
                    "url": "/jkhive/shifts",
                },
            ):
                notified += 1
            # Email — send to `email` (personal) if present, else `account_email`.
            recipient = (staff_rec.get("email") or staff_rec.get("account_email") or "").strip()
            if recipient and _send_rota_email(
                to_email=recipient,
                staff_name=staff_rec.get("name") or "",
                location_name=loc_name,
                start_date=body.start_date,
                end_date=body.end_date,
                shifts=shifts,
            ):
                emailed += 1

    return {"published": published_count, "notified": notified, "emailed": emailed}


class DebugEmailBody(BaseModel):
    location_id: str
    start_date: str
    end_date: str
    dry_run: bool = False  # when True, don't actually send — just return the plan
    override_to: Optional[str] = None  # if set, route every email to this address for testing


@router.post("/debug-email")
async def debug_email(body: DebugEmailBody, user: dict = Depends(get_admin_user)):
    """Diagnose the shift-publish email path. Returns SMTP config status,
    every staff member scheduled in the week, and per-recipient send
    result so admins can see exactly why emails did or didn't go out.

    Set `dry_run=true` for a look-only run; set `override_to` to route
    all attempts to a single mailbox for safe end-to-end testing."""
    smtp_ok = bool(SMTP_HOST and SMTP_EMAIL and SMTP_PASSWORD)
    resend_ok = bool(RESEND_API_KEY)
    transport = "resend" if resend_ok else ("smtp" if smtp_ok else "none")

    # Live TCP reachability check for the transport that WILL be used —
    # api.resend.com:443 for Resend, SMTP host:port otherwise. 5s timeout.
    smtp_reachable = None
    smtp_reach_error: Optional[str] = None
    reach_host, reach_port = (None, None)
    if resend_ok:
        reach_host, reach_port = "api.resend.com", 443
    elif SMTP_HOST:
        reach_host, reach_port = SMTP_HOST, SMTP_PORT
    if reach_host:
        try:
            with socket.create_connection((reach_host, reach_port), timeout=5):
                smtp_reachable = True
        except Exception as ex:
            smtp_reachable = False
            smtp_reach_error = f"{type(ex).__name__}: {ex}"

    loc_rec = locations_collection.find_one(
        {"id": body.location_id}, {"_id": 0, "name": 1},
    ) or {}
    loc_name = loc_rec.get("name") or body.location_id

    rows = list(shifts_collection.find(
        {
            "location_id": body.location_id,
            "date": {"$gte": body.start_date, "$lte": body.end_date},
        },
        {"_id": 0, "staff_id": 1, "date": 1, "start_time": 1, "end_time": 1,
         "staff_name": 1, "role": 1, "hours": 1, "published": 1},
    ))
    per_staff: dict = {}
    for r in rows:
        per_staff.setdefault(r.get("staff_id", ""), []).append(r)

    results: List[dict] = []
    sent_count = 0
    for staff_id, shifts in per_staff.items():
        staff_rec = staff_collection.find_one(
            {"id": staff_id},
            {"_id": 0, "name": 1, "email": 1, "account_email": 1},
        ) or {}
        personal = (staff_rec.get("email") or "").strip()
        account = (staff_rec.get("account_email") or "").strip()
        recipient = body.override_to or personal or account
        entry: dict = {
            "staff_id": staff_id,
            "staff_name": staff_rec.get("name") or (shifts[0].get("staff_name") if shifts else ""),
            "personal_email": personal or None,
            "account_email": account or None,
            "resolved_recipient": recipient or None,
            "shift_count": len(shifts),
            "sent": False,
            "reason": None,
        }
        if not recipient:
            entry["reason"] = "no email address on staff record"
        elif transport == "none":
            entry["reason"] = "no email transport configured (RESEND_API_KEY or SMTP_*)"
        elif body.dry_run:
            entry["reason"] = "dry_run"
        else:
            ok = _send_rota_email(
                to_email=recipient,
                staff_name=entry["staff_name"] or "",
                location_name=loc_name,
                start_date=body.start_date,
                end_date=body.end_date,
                shifts=shifts,
            )
            entry["sent"] = ok
            if ok:
                entry["reason"] = "sent"
                sent_count += 1
            else:
                # Transport-aware message so we never show "SMTP" wording
                # when Resend is the active transport.
                entry["reason"] = (
                    "Resend send failed (check backend logs — likely testing-mode "
                    "restriction or unverified domain)"
                    if transport == "resend"
                    else "SMTP send failed (check backend logs)"
                )
        results.append(entry)

    return {
        "smtp_configured": smtp_ok,
        "smtp_host": SMTP_HOST or None,
        "smtp_port": SMTP_PORT,
        "smtp_email": SMTP_EMAIL or None,
        "resend_configured": resend_ok,
        "resend_from": RESEND_FROM if resend_ok else None,
        "transport": transport,
        "reach_host": reach_host,
        "reach_port": reach_port,
        "smtp_reachable": smtp_reachable,
        "smtp_reach_error": smtp_reach_error,
        "location_name": loc_name,
        "shifts_in_window": len(rows),
        "staff_scheduled": len(per_staff),
        "sent": sent_count,
        "dry_run": body.dry_run,
        "override_to": body.override_to,
        "results": sorted(results, key=lambda r: (r.get("staff_name") or "").lower()),
    }


@router.get("/print")
async def print_rota(
    location_id: str = Query(..., description="Site id"),
    start_date: str = Query(..., description="Week start (YYYY-MM-DD)"),
    end_date: str = Query(..., description="Week end (YYYY-MM-DD)"),
    include_drafts: bool = Query(True, description="Include unpublished drafts"),
    user: dict = Depends(get_admin_user),
):
    """Return a landscape A4 PDF of the weekly rota — one row per staff
    member, one column per day, times printed inside each cell. Suitable
    for pinning up in the kitchen."""
    import io
    from fastapi.responses import StreamingResponse
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.lib.enums import TA_CENTER, TA_LEFT
    from reportlab.platypus import (
        SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer,
    )

    # Load week window
    try:
        d0 = _date.fromisoformat(start_date)
        d1 = _date.fromisoformat(end_date)
    except ValueError:
        raise HTTPException(400, "Invalid date format; expected YYYY-MM-DD")
    if d1 < d0:
        raise HTTPException(400, "end_date is before start_date")
    days = []
    d = d0
    while d <= d1:
        days.append(d)
        d += _td(days=1)

    # Location + shifts
    loc_rec = locations_collection.find_one(
        {"id": location_id}, {"_id": 0, "name": 1},
    ) or {}
    loc_name = loc_rec.get("name") or location_id

    q: dict = {
        "location_id": location_id,
        "date": {"$gte": start_date, "$lte": end_date},
    }
    if not include_drafts:
        q["published"] = True
    rows = list(shifts_collection.find(q, {"_id": 0}))

    # Group: staff_id → {name, per-day list of shifts, total_hours}
    grouped: dict = {}
    for r in rows:
        sid = r.get("staff_id") or "_unassigned"
        entry = grouped.setdefault(sid, {
            "staff_name": r.get("staff_name") or "Unassigned",
            "cells": {d.isoformat(): [] for d in days},
            "total_hours": 0.0,
            "any_draft": False,
        })
        dt = r.get("date")
        if dt in entry["cells"]:
            entry["cells"][dt].append(r)
            entry["total_hours"] += float(r.get("hours") or 0)
            if not r.get("published"):
                entry["any_draft"] = True

    ordered = sorted(grouped.values(), key=lambda e: e["staff_name"].lower())

    # PDF build
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=landscape(A4),
        leftMargin=12*mm, rightMargin=12*mm, topMargin=14*mm, bottomMargin=12*mm,
        title=f"Rota — {loc_name} {start_date} to {end_date}",
    )
    styles = getSampleStyleSheet()
    hdr_style = ParagraphStyle(
        name="hdr", parent=styles["Normal"], fontName="Helvetica-Bold",
        fontSize=9, textColor=colors.white, alignment=TA_CENTER, leading=11,
    )
    hdr_left = ParagraphStyle(name="hdrL", parent=hdr_style, alignment=TA_LEFT)
    cell_style = ParagraphStyle(
        name="cell", parent=styles["Normal"], fontName="Helvetica",
        fontSize=8, leading=10, alignment=TA_CENTER,
    )
    name_style = ParagraphStyle(
        name="name", parent=styles["Normal"], fontName="Helvetica-Bold",
        fontSize=9, leading=11, alignment=TA_LEFT,
    )

    story: list = []
    story.append(Paragraph(
        f"<font size=16><b>Rota — {loc_name}</b></font>", styles["Normal"],
    ))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        f"<font size=10 color='#86868B'>"
        f"{d0.strftime('%a %d %b %Y')} — {d1.strftime('%a %d %b %Y')} · "
        f"Generated {datetime.now().strftime('%d %b %Y %H:%M')}"
        f"</font>",
        styles["Normal"],
    ))
    story.append(Spacer(1, 12))

    # Header row: Staff / each day (Total column removed per request)
    header = [Paragraph("Staff", hdr_left)]
    for d in days:
        header.append(Paragraph(d.strftime("%a<br/>%d %b"), hdr_style))

    table_rows = [header]
    for entry in ordered:
        row = [Paragraph(
            entry["staff_name"] + (" *" if entry["any_draft"] else ""),
            name_style,
        )]
        for d in days:
            cell_shifts = entry["cells"][d.isoformat()]
            if not cell_shifts:
                row.append(Paragraph("<font color='#C7C7CC'>—</font>", cell_style))
                continue
            parts = []
            for s in sorted(cell_shifts, key=lambda x: x.get("start_time", "")):
                bit = f"{s.get('start_time','')}–{s.get('end_time','')}"
                if s.get("role"):
                    bit += f"<br/><font size=7 color='#86868B'>{s['role']}</font>"
                if not s.get("published"):
                    bit += "<br/><font size=6 color='#A35E00'>DRAFT</font>"
                parts.append(bit)
            row.append(Paragraph("<br/>".join(parts), cell_style))
        table_rows.append(row)

    if not ordered:
        table_rows.append([
            Paragraph("<i>No shifts scheduled for this week.</i>", cell_style),
            *[Paragraph("", cell_style) for _ in days],
        ])

    # Column widths — staff col wider, day cols share the rest (Total col removed).
    n_days = len(days)
    page_w = landscape(A4)[0] - 24*mm  # minus margins
    staff_w = 38*mm
    day_w = max(20*mm, (page_w - staff_w) / n_days)
    col_widths = [staff_w] + [day_w] * n_days

    table = Table(table_rows, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1D1D1F")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E5E5EA")),
        ("BACKGROUND", (0, 1), (0, -1), colors.HexColor("#FAFAFC")),
        ("ROWBACKGROUNDS", (1, 1), (-1, -1), [colors.white, colors.HexColor("#FBFBFD")]),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(table)

    # Footnote if any drafts present
    if any(e["any_draft"] for e in ordered):
        story.append(Spacer(1, 6))
        story.append(Paragraph(
            "<font size=8 color='#86868B'>* indicates the staff member has at least one DRAFT shift in this window "
            "(not yet published to staff).</font>",
            styles["Normal"],
        ))

    doc.build(story)
    buf.seek(0)

    safe_loc = "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in location_id)[:40]
    filename = f"rota_{safe_loc}_{start_date}_to_{end_date}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


class CopyWeekBody(BaseModel):
    location_id: str
    source_start: str  # YYYY-MM-DD (Monday)
    target_start: str  # YYYY-MM-DD (Monday)
    overwrite: bool = False  # if True, wipe target week first


@router.post("/copy-week")
async def copy_week(body: CopyWeekBody, user: dict = Depends(get_admin_user)):
    """Duplicate every shift from a source week into a target week.
    Hugely useful when next week's rota is identical to last week's."""
    from datetime import date as _date, timedelta as _td

    try:
        src_start = _date.fromisoformat(body.source_start)
        tgt_start = _date.fromisoformat(body.target_start)
    except ValueError:
        raise HTTPException(400, "source_start and target_start must be YYYY-MM-DD")

    src_end = (src_start + _td(days=6)).isoformat()
    tgt_end = (tgt_start + _td(days=6)).isoformat()
    src_start_iso = src_start.isoformat()
    tgt_start_iso = tgt_start.isoformat()

    src_rows = list(shifts_collection.find(
        {"location_id": body.location_id, "date": {"$gte": src_start_iso, "$lte": src_end}},
        {"_id": 0},
    ))
    if not src_rows:
        return {"copied": 0, "skipped": 0, "message": "No source shifts found"}

    if body.overwrite:
        shifts_collection.delete_many({
            "location_id": body.location_id,
            "date": {"$gte": tgt_start_iso, "$lte": tgt_end},
        })

    day_delta = (tgt_start - src_start).days
    inserted: list = []
    skipped = 0
    for r in src_rows:
        try:
            new_date = (_date.fromisoformat(r["date"]) + _td(days=day_delta)).isoformat()
        except Exception:
            skipped += 1
            continue
        # Skip if a shift already exists for the same staff+date+start_time.
        clash = shifts_collection.find_one({
            "location_id": body.location_id,
            "staff_id": r.get("staff_id"),
            "date": new_date,
            "start_time": r.get("start_time"),
        })
        if clash and not body.overwrite:
            skipped += 1
            continue
        doc = {
            "id": str(uuid.uuid4())[:12],
            "location_id": body.location_id,
            "staff_id": r.get("staff_id", ""),
            "staff_name": r.get("staff_name", ""),
            "date": new_date,
            "start_time": r.get("start_time", ""),
            "end_time": r.get("end_time", ""),
            "role": r.get("role", ""),
            "notes": r.get("notes", ""),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": user.get("email", ""),
            "created_by_name": user.get("name", ""),
            "copied_from": r.get("id"),
        }
        inserted.append(doc)
    if inserted:
        shifts_collection.insert_many([dict(d) for d in inserted])
    return {"copied": len(inserted), "skipped": skipped}


@router.post("")
async def add_shift(body: ShiftBody, user: dict = Depends(get_admin_user)):
    doc = {
        "id": str(uuid.uuid4())[:12],
        "location_id": body.location_id,
        "staff_id": body.staff_id,
        "staff_name": _resolve_staff_name(body.staff_id),
        "date": body.date,
        "start_time": body.start_time,
        "end_time": body.end_time,
        "role": body.role,
        "notes": body.notes,
        # New shifts start as drafts so the manager can edit freely before
        # alerting staff. They become visible to staff only after Publish.
        "published": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user.get("email", ""),
        "created_by_name": user.get("name", ""),
    }
    shifts_collection.insert_one(dict(doc))
    return _decorate(doc)


@router.patch("/{shift_id}")
async def update_shift(shift_id: str, body: ShiftPatch, user: dict = Depends(get_admin_user)):
    rec = shifts_collection.find_one({"id": shift_id}, {"_id": 0})
    if not rec:
        raise HTTPException(404, "Not found")
    update = {k: v for k, v in body.dict(exclude_unset=True).items() if v is not None}
    if "staff_id" in update:
        update["staff_name"] = _resolve_staff_name(update["staff_id"])
    if update:
        # Any edit reverts the shift to "draft" so the manager has a chance
        # to re-review before notifying staff of the change.
        update.setdefault("published", False)
        update["updated_at"] = datetime.now(timezone.utc).isoformat()
        update["updated_by"] = user.get("email", "")
        update["updated_by_name"] = user.get("name", "")
        shifts_collection.update_one({"id": shift_id}, {"$set": update})
    return _decorate(shifts_collection.find_one({"id": shift_id}, {"_id": 0}))


@router.delete("/{shift_id}")
async def delete_shift(shift_id: str, user: dict = Depends(get_admin_user)):
    res = shifts_collection.delete_one({"id": shift_id})
    if not res.deleted_count:
        raise HTTPException(404, "Not found")
    return {"deleted": True}



# ---------------------------------------------------------------------------
# AI-assisted rota suggestion
# ---------------------------------------------------------------------------
# Generates a draft week's worth of shifts using Claude Sonnet 4.5 based on
# recent sales footfall (peak days/days quiet), the staff roster (roles +
# hourly rate + optional weekly_hours_target) and the last 4 weeks of shifts
# (to learn each person's usual pattern). The endpoint returns proposed
# shifts WITHOUT inserting them — the UI then lets the manager preview and
# optionally bulk-apply them.

class AISuggestBody(BaseModel):
    location_id: str
    target_start: str  # Monday of the target week, YYYY-MM-DD


def _last_four_weeks_sales(location_id: str, target_start: _date) -> list:
    """Pull the four full weeks before `target_start` so we can detect a
    day-of-week footfall pattern. Returns a list of {date, weekday, sales}.
    """
    src_from = (target_start - _td(days=28)).isoformat()
    src_to = (target_start - _td(days=1)).isoformat()
    rows = list(daily_sales_collection.find(
        {"location_id": location_id, "date": {"$gte": src_from, "$lte": src_to}},
        {"_id": 0, "date": 1, "sales": 1},
    ).sort("date", 1))
    out = []
    for r in rows:
        try:
            d = _date.fromisoformat(r["date"])
        except Exception:
            continue
        out.append({
            "date": r["date"],
            "weekday": d.strftime("%a"),
            "sales": float(r.get("sales") or 0),
        })
    return out


def _recent_shift_pattern(location_id: str, target_start: _date) -> list:
    """Pull the prior 4 weeks of shifts so the LLM can see how individual
    staff are usually scheduled (e.g. Alice typically works Mon/Wed/Fri
    mornings)."""
    src_from = (target_start - _td(days=28)).isoformat()
    src_to = (target_start - _td(days=1)).isoformat()
    rows = list(shifts_collection.find(
        {"location_id": location_id, "date": {"$gte": src_from, "$lte": src_to}},
        {"_id": 0, "staff_id": 1, "staff_name": 1, "date": 1, "start_time": 1, "end_time": 1, "role": 1},
    ).sort("date", 1))
    out = []
    for r in rows:
        try:
            d = _date.fromisoformat(r["date"])
        except Exception:
            continue
        out.append({
            "staff_id": r.get("staff_id", ""),
            "staff_name": r.get("staff_name", ""),
            "weekday": d.strftime("%a"),
            "start": r.get("start_time", ""),
            "end": r.get("end_time", ""),
            "role": r.get("role", ""),
        })
    return out


_AI_ROTA_SYSTEM = (
    "You are the rota planner for Jolly's Kafe, a UK restaurant chain. "
    "You are given (a) the SITE OPENING HOURS for each day of the week, "
    "(b) the last 4 weeks of daily sales for the site, "
    "(c) the current staff roster with their hourly rate and weekly hours "
    "target (0 = flexible), and (d) the last 4 weeks of historical shifts. "
    "Generate a DRAFT 7-day rota for the requested target week (Mon→Sun). "
    "Rules:\n"
    "1. NEVER schedule a shift outside the site's opening window for that "
    "weekday. If the site is closed (no open/close time), do not schedule "
    "anyone for that day. Allow up to 30 min before open for prep and up "
    "to 30 min after close for clean-down — never more.\n"
    "2. Respect each staff member's weekly_hours_target if > 0 (±2h tolerance).\n"
    "3. Bias shift density to busier weekdays based on the sales footfall pattern.\n"
    "4. Honour each staff member's typical day-of-week/role pattern when present.\n"
    "5. Use HH:MM 24h times. Pick patterns that fit inside the opening "
    "window (e.g. for a 09:00-17:00 day you could use 08:30-13:00, "
    "12:00-17:30 — never 06:00 or 22:00).\n"
    "6. Do NOT schedule the same staff member for two overlapping shifts on the same day.\n"
    "7. Output STRICT JSON with the shape:\n"
    "{\n"
    "  \"reasoning\": \"<1-2 sentence overview>\",\n"
    "  \"shifts\": [\n"
    "    {\"staff_id\": \"...\", \"date\": \"YYYY-MM-DD\", \"start_time\": \"HH:MM\", "
    "\"end_time\": \"HH:MM\", \"role\": \"\"}\n"
    "  ]\n"
    "}\n"
    "Return ONLY the JSON object. No markdown, no commentary."
)


# UK weekday → opening_hours dict key. Locations store hours as
# {"monday": {"open": "08:00", "close": "17:00"}, ...}.
_WEEKDAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


def _hhmm_to_min(s: str) -> int:
    """Parse 'HH:MM' → minutes-since-midnight. Returns -1 if invalid so callers
    can drop the row instead of crashing."""
    try:
        h, m = s.split(":")
        return int(h) * 60 + int(m)
    except Exception:  # noqa: BLE001
        return -1


def _location_opening_hours(location_id: str) -> dict:
    """Returns the {weekday: {open, close}} dict, or an empty dict if the
    site has none configured (which means we shouldn't AI-suggest anything)."""
    settings = site_settings_collection.find_one({"location_id": location_id}) or {}
    return settings.get("opening_hours") or {}


def _clamp_shift_to_hours(shift_start: str, shift_end: str, day_hours: dict) -> Optional[tuple]:
    """Clamp a proposed shift into the site's opening window for that day,
    with a 30-min prep buffer either side. Returns (start, end) HH:MM or
    None if the day is closed / the shift cannot fit at all."""
    if not day_hours:
        return None
    open_t = _hhmm_to_min(day_hours.get("open", ""))
    close_t = _hhmm_to_min(day_hours.get("close", ""))
    if open_t < 0 or close_t < 0 or close_t <= open_t:
        return None
    earliest = max(0, open_t - 30)   # 30 min prep before open
    latest = min(24 * 60, close_t + 30)  # 30 min wrap-up after close
    s = _hhmm_to_min(shift_start)
    e = _hhmm_to_min(shift_end)
    if s < 0 or e < 0 or e <= s:
        return None
    s = max(s, earliest)
    e = min(e, latest)
    if e - s < 30:  # too short to be useful after clamping
        return None
    return (f"{s // 60:02d}:{s % 60:02d}", f"{e // 60:02d}:{e % 60:02d}")


@router.post("/ai-suggest-week")
async def ai_suggest_week(body: AISuggestBody, user: dict = Depends(get_admin_user)):
    """Ask Claude for a proposed rota for the given target week.
    Returns the proposed shifts WITHOUT inserting them. The frontend
    previews them and (optionally) calls /bulk-create to materialise."""
    try:
        target_start = _date.fromisoformat(body.target_start)
    except ValueError:
        raise HTTPException(400, "target_start must be YYYY-MM-DD")
    if target_start.weekday() != 0:
        # Normalise to Monday — defensive in case the UI passes a non-Mon date.
        target_start = target_start - _td(days=target_start.weekday())

    staff_rows = list(staff_collection.find(
        {},
        {"_id": 0, "id": 1, "name": 1, "hourly_rate": 1, "weekly_hours_target": 1, "location_ids": 1, "active": 1},
    ))
    if not staff_rows:
        raise HTTPException(400, "No staff members configured — add staff before requesting an AI rota.")
    # Filter to active staff who work at this location. Empty/missing
    # location_ids = legacy record assumed to work anywhere; missing
    # `active` defaults to True.
    staff_rows = [
        s for s in staff_rows
        if s.get("active", True) is not False
        and (not s.get("location_ids") or body.location_id in (s.get("location_ids") or []))
    ]
    if not staff_rows:
        raise HTTPException(400, "No active staff are assigned to this location. Add or re-activate staff first.")
    # Roster sent to Claude. Cap to first 30 to keep prompt size sane.
    roster = [
        {
            "staff_id": s.get("id", ""),
            "name": s.get("name", ""),
            "hourly_rate": float(s.get("hourly_rate") or 0),
            "weekly_hours_target": float(s.get("weekly_hours_target") or 0),
        }
        for s in staff_rows[:30]
    ]
    valid_ids = {s["staff_id"] for s in roster}

    sales_history = _last_four_weeks_sales(body.location_id, target_start)
    shift_history = _recent_shift_pattern(body.location_id, target_start)
    opening_hours = _location_opening_hours(body.location_id)
    if not opening_hours:
        raise HTTPException(
            400,
            "This location has no opening hours configured. Set them in Admin → Locations before running AI Suggest.",
        )

    target_dates = [(target_start + _td(days=i)).isoformat() for i in range(7)]
    # Map each target date to its opening window so Claude can't pick times
    # outside hours and so we can clamp anything weird it returns.
    target_hours = {
        d: opening_hours.get(_WEEKDAY_KEYS[(target_start + _td(days=i)).weekday()]) or {}
        for i, d in enumerate(target_dates)
    }

    user_text = (
        "Build a draft rota for the week starting "
        f"{target_start.isoformat()} (Mon) through "
        f"{(target_start + _td(days=6)).isoformat()} (Sun).\n\n"
        f"TARGET_DATES: {target_dates}\n\n"
        f"SITE_OPENING_HOURS (date → open/close window, empty = CLOSED that day, "
        f"do NOT schedule anyone):\n{json.dumps(target_hours, indent=2)}\n\n"
        f"ROSTER ({len(roster)} staff):\n{json.dumps(roster, indent=2)}\n\n"
        f"SALES_HISTORY (last 4 weeks, daily takings £):\n{json.dumps(sales_history, indent=2)}\n\n"
        f"RECENT_SHIFTS (last 4 weeks):\n{json.dumps(shift_history, indent=2)}"
    )

    # Reuse the active AI key/provider plumbing from the BI module so the
    # admin only ever has to configure one key. The call shape is identical
    # to bi.py's _generate_insights — Anthropic /v1/messages via httpx.
    from routes.ai_settings import get_active_ai_key, get_active_ai_provider
    api_key = get_active_ai_key()
    if not api_key:
        raise HTTPException(
            500,
            "AI rota unavailable: no API key configured. Open Admin → AI Settings to add one.",
        )
    provider = get_active_ai_provider()

    import httpx
    req = {
        "model": "claude-sonnet-4-5-20250929",
        "max_tokens": 3000,
        "system": _AI_ROTA_SYSTEM,
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
        import logging
        logging.exception("AI rota HTTP call failed")
        snippet = (str(e) or e.__class__.__name__).splitlines()[0][:240]
        # Use 500 (not 502) — the preview ingress rewrites 502 responses
        # to an HTML error page, swallowing our JSON detail.
        raise HTTPException(500, f"AI provider error ({provider}): {snippet}")

    if resp.status_code >= 400:
        try:
            err = resp.json().get("error", {}).get("message", resp.text)
        except Exception:
            err = resp.text
        raise HTTPException(500, f"AI provider error ({provider}, {resp.status_code}): {err[:240]}")

    data = resp.json()
    full = "".join(
        block.get("text", "") for block in (data.get("content") or [])
        if block.get("type") == "text"
    ).strip()
    if not full:
        raise HTTPException(500, "AI provider returned an empty response")

    # Strip ```json fences if Claude added them, then parse.
    import re
    s = full
    if s.startswith("```"):
        s = re.sub(r"^```[a-zA-Z]*\n?", "", s)
        s = re.sub(r"\n?```\s*$", "", s)
    if not s.lstrip().startswith("{"):
        m = re.search(r"\{.*\}", s, re.DOTALL)
        if m:
            s = m.group(0)
    try:
        parsed = json.loads(s)
    except json.JSONDecodeError as e:
        raise HTTPException(500, f"AI returned non-JSON response: {e}")

    raw_shifts = parsed.get("shifts") or []
    target_set = set(target_dates)
    # Build a name → id map so we can recover from Claude returning a name
    # instead of a UUID (it sometimes does despite the prompt).
    name_to_id = {(s["name"] or "").strip().lower(): s["staff_id"] for s in roster}

    cleaned = []
    dropped_closed = 0
    clamped = 0
    for s in raw_shifts:
        sid = (s.get("staff_id") or "").strip()
        if sid not in valid_ids:
            sid = name_to_id.get((s.get("staff_name") or s.get("name") or "").strip().lower(), "")
        if sid not in valid_ids:
            continue
        d = (s.get("date") or "").strip()
        if d not in target_set:
            continue
        st = (s.get("start_time") or "").strip()
        en = (s.get("end_time") or "").strip()
        if not st or not en:
            continue
        # Enforce opening hours: clamp to window (with the prep buffer) or
        # drop the shift entirely if the site is closed that day.
        clamped_pair = _clamp_shift_to_hours(st, en, target_hours.get(d) or {})
        if clamped_pair is None:
            dropped_closed += 1
            continue
        new_st, new_en = clamped_pair
        if (new_st, new_en) != (st, en):
            clamped += 1
            st, en = new_st, new_en
        cleaned.append({
            "staff_id": sid,
            "staff_name": next((r["name"] for r in roster if r["staff_id"] == sid), ""),
            "date": d,
            "start_time": st,
            "end_time": en,
            "role": (s.get("role") or "").strip(),
            "hours": _hours_between(st, en),
        })

    # Append a note when we had to override the LLM so the manager sees
    # what happened — opening hours always win.
    reasoning = parsed.get("reasoning", "") or ""
    if dropped_closed or clamped:
        note_bits = []
        if dropped_closed:
            note_bits.append(f"{dropped_closed} shift{'s' if dropped_closed != 1 else ''} dropped (site closed)")
        if clamped:
            note_bits.append(f"{clamped} shift{'s' if clamped != 1 else ''} trimmed to opening hours")
        reasoning = (reasoning + " " if reasoning else "") + "Adjustments: " + ", ".join(note_bits) + "."

    return {
        "reasoning": reasoning,
        "target_start": target_start.isoformat(),
        "shifts": cleaned,
    }


class BulkCreateBody(BaseModel):
    location_id: str
    shifts: List[ShiftBody]
    skip_clashes: bool = True


@router.post("/bulk-create")
async def bulk_create(body: BulkCreateBody, user: dict = Depends(get_admin_user)):
    """Insert a batch of draft shifts in one round-trip. Used by the AI
    rota apply flow. Each shift is created as a draft so the manager can
    still tweak before Publish."""
    inserted = []
    skipped = 0
    seen = set()  # in-batch dedupe — (staff_id, date, start_time)
    now = datetime.now(timezone.utc).isoformat()
    docs = []
    for s in body.shifts:
        triple = (s.staff_id, s.date, s.start_time)
        if body.skip_clashes:
            if triple in seen:
                skipped += 1
                continue
            clash = shifts_collection.find_one({
                "location_id": body.location_id,
                "staff_id": s.staff_id,
                "date": s.date,
                "start_time": s.start_time,
            })
            if clash:
                skipped += 1
                continue
        seen.add(triple)
        doc = {
            "id": str(uuid.uuid4())[:12],
            "location_id": body.location_id,
            "staff_id": s.staff_id,
            "staff_name": _resolve_staff_name(s.staff_id),
            "date": s.date,
            "start_time": s.start_time,
            "end_time": s.end_time,
            "role": s.role,
            "notes": s.notes,
            "published": False,
            "created_at": now,
            "created_by": user.get("email", ""),
            "created_by_name": user.get("name", ""),
            "source": "ai-suggest",
        }
        docs.append(doc)
        inserted.append(_decorate(doc))
    if docs:
        shifts_collection.insert_many([dict(d) for d in docs])
    return {"created": len(inserted), "skipped": skipped, "shifts": inserted}


# ---------------------------------------------------------------------------
# Wage Budget — labour cost optimisation widget on /jkhive/shifts.
#
# Workflow:
#   1. Look up last week's revenue from `daily_sales` for the location.
#   2. Forecast = manager override (if set) OR last_week_revenue.
#   3. Wage budget = forecast * target_pct (default 30%).
#   4. wage_used is computed client-side from the visible shifts so it
#      ticks down live as the rota fills in.
# ---------------------------------------------------------------------------

def _iso_minus(d_iso: str, days: int) -> str:
    """Return YYYY-MM-DD shifted by `days` (positive or negative)."""
    d = datetime.strptime(d_iso, "%Y-%m-%d").date()
    return (d + _td(days=days)).isoformat()


def _sum_revenue(location_id: str, start_iso: str, end_iso: str) -> float:
    """Sum daily_sales.sales for one location inside [start, end] inclusive."""
    rows = daily_sales_collection.find(
        {"location_id": location_id, "date": {"$gte": start_iso, "$lte": end_iso}},
        {"_id": 0, "sales": 1},
    )
    return round(sum(float(r.get("sales") or 0) for r in rows), 2)


class WageBudgetPut(BaseModel):
    location_id: str
    week_start: str  # YYYY-MM-DD (Monday)
    forecast_override: Optional[float] = None  # null clears the override
    target_pct: Optional[float] = None


@router.get("/week-budget")
async def get_week_budget(
    location_id: str = Query(...),
    week_start: str = Query(..., description="YYYY-MM-DD Monday"),
    user: dict = Depends(get_admin_user),
):
    """Wage budget snapshot for one site & week.

    `wage_used` is intentionally NOT computed here — the frontend already
    knows the visible shifts × hourly_rate breakdown and ticks the figure
    down in real time as the manager edits the grid. Returning a stale
    server value would just confuse things.
    """
    week_end = _iso_minus(week_start, 6)
    last_week_start = _iso_minus(week_start, -7)
    last_week_end = _iso_minus(week_start, -1)

    last_week_revenue = _sum_revenue(location_id, last_week_start, last_week_end)

    saved = shift_budgets_collection.find_one(
        {"location_id": location_id, "week_start": week_start}, {"_id": 0},
    ) or {}
    forecast_override = saved.get("forecast_override")
    target_pct = float(saved.get("target_pct") or DEFAULT_WAGE_TARGET_PCT)
    forecast = float(forecast_override) if forecast_override is not None else last_week_revenue
    wage_budget = round(forecast * target_pct / 100.0, 2)

    return {
        "location_id": location_id,
        "week_start": week_start,
        "week_end": week_end,
        "last_week_start": last_week_start,
        "last_week_end": last_week_end,
        "last_week_revenue": last_week_revenue,
        "forecast": round(forecast, 2),
        "forecast_overridden": forecast_override is not None,
        "target_pct": target_pct,
        "wage_budget": wage_budget,
    }


@router.put("/week-budget")
async def put_week_budget(body: WageBudgetPut, user: dict = Depends(get_admin_user)):
    """Set/clear the forecast override and target % for a (site, week).
    Passing `forecast_override: null` clears the override so the widget
    falls back to last week's revenue."""
    update = {
        "location_id": body.location_id,
        "week_start": body.week_start,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": user.get("email", ""),
        "updated_by_name": user.get("name", ""),
    }
    if body.forecast_override is not None:
        update["forecast_override"] = round(float(body.forecast_override), 2)
    else:
        # Explicit None on the wire clears the override.
        update["forecast_override"] = None
    if body.target_pct is not None:
        pct = float(body.target_pct)
        if pct < 0 or pct > 100:
            raise HTTPException(400, "target_pct must be between 0 and 100")
        update["target_pct"] = round(pct, 2)

    shift_budgets_collection.update_one(
        {"location_id": body.location_id, "week_start": body.week_start},
        {"$set": update},
        upsert=True,
    )
    return await get_week_budget(
        location_id=body.location_id, week_start=body.week_start, user=user,
    )
