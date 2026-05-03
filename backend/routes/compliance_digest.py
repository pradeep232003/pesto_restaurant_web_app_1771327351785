"""
Weekly compliance digest — generates PDF of last-7-day compliance matrix
and emails it to every admin / super_admin every Monday 07:00 Europe/London.
"""
import os
import io
import smtplib
from datetime import date, timedelta, datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak

from db import customers_collection, users_collection
from auth import get_admin_user
from routes.compliance import CHECK_CONFIG, _assess_check, locations_collection

SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_EMAIL = os.environ.get("SMTP_EMAIL", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")

router = APIRouter(prefix="/api/admin/compliance-digest", tags=["compliance-digest"])

STATUS_COLOURS = {
    "complete": colors.HexColor("#34C759"),
    "partial": colors.HexColor("#FF9500"),
    "overdue": colors.HexColor("#FF3B30"),
    "missing": colors.HexColor("#9E9E9E"),
}
STATUS_LABELS = {"complete": "Complete", "partial": "Partial", "overdue": "Overdue", "missing": "Missing"}


def _collect_matrix(start_date: str, end_date: str) -> dict:
    locs = list(locations_collection.find({"is_active": True}, {"_id": 0}).sort("name", 1))
    status_weight = {"complete": 1, "partial": 0.5, "overdue": 0, "missing": 0}
    site_rows = []
    for loc in locs:
        checks = {}
        scores = []
        for key, cfg in CHECK_CONFIG.items():
            r = _assess_check(loc["id"], cfg, start_date, end_date)
            r["label"] = cfg["label"]
            checks[key] = r
            scores.append(status_weight.get(r["status"], 0))
        pct = round(100 * sum(scores) / len(scores)) if scores else 0
        site_rows.append({"location_name": loc["name"], "compliance_pct": pct, "checks": checks})
    overall = round(sum(r["compliance_pct"] for r in site_rows) / len(site_rows)) if site_rows else 0
    return {"start_date": start_date, "end_date": end_date, "overall_pct": overall, "sites": site_rows,
            "check_types": [{"key": k, "label": v["label"]} for k, v in CHECK_CONFIG.items()]}


def _build_pdf(matrix: dict) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4), leftMargin=15*mm, rightMargin=15*mm, topMargin=32*mm, bottomMargin=18*mm)
    styles = getSampleStyleSheet()
    story = []

    story.append(Paragraph("<b>Food Safety Compliance Report</b>", styles["Title"]))
    story.append(Paragraph(f"Jolly's Kafe &middot; Period: {matrix['start_date']} to {matrix['end_date']}", styles["Normal"]))
    story.append(Paragraph(f"Generated: {datetime.now().strftime('%d %b %Y %H:%M')}", styles["Normal"]))
    story.append(Spacer(1, 8))
    pct = matrix["overall_pct"]
    colour = "#34C759" if pct >= 90 else "#FF9500" if pct >= 60 else "#FF3B30"
    story.append(Paragraph(f"<font size=18 color='{colour}'><b>Overall Compliance: {pct}%</b></font>", styles["Normal"]))
    story.append(Spacer(1, 10))

    # Matrix table: site × 9 checks
    check_types = matrix["check_types"]
    # Wrap header labels in Paragraphs so long names (e.g. "Cooked/Reheated Temperature",
    # "Weekly Deep Cleaning") word-wrap within their column instead of overflowing.
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.enums import TA_CENTER, TA_LEFT
    hdr_style = ParagraphStyle(name="hdr", parent=styles["Normal"], fontName="Helvetica-Bold",
                               fontSize=7, textColor=colors.white, alignment=TA_CENTER, leading=8)
    hdr_left = ParagraphStyle(name="hdrL", parent=hdr_style, alignment=TA_LEFT)
    header = [Paragraph("Site", hdr_left), Paragraph("Score", hdr_style)] + \
             [Paragraph(c["label"], hdr_style) for c in check_types]
    rows = [header]
    for s in matrix["sites"]:
        row = [s["location_name"], f"{s['compliance_pct']}%"]
        for c in check_types:
            ch = s["checks"][c["key"]]
            row.append(f"{STATUS_LABELS.get(ch['status'], ch['status'])}\n{ch['actual_periods']}/{ch['expected']}")
        rows.append(row)

    # Compute column widths
    available = landscape(A4)[0] - 30*mm
    col_widths = [38*mm, 14*mm] + [(available - 52*mm) / len(check_types)] * len(check_types)
    tbl = Table(rows, colWidths=col_widths, repeatRows=1)
    style = TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1D1D1F")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 7),
        ("ALIGN", (1, 0), (-1, -1), "CENTER"),
        ("ALIGN", (0, 0), (0, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#E8E8ED")),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ])
    # Colour status cells
    for r_idx, s in enumerate(matrix["sites"], start=1):
        for c_idx, c in enumerate(check_types):
            ch = s["checks"][c["key"]]
            bg = STATUS_COLOURS.get(ch["status"], colors.HexColor("#E8E8ED"))
            style.add("BACKGROUND", (c_idx + 2, r_idx), (c_idx + 2, r_idx), bg)
            style.add("TEXTCOLOR", (c_idx + 2, r_idx), (c_idx + 2, r_idx), colors.white if ch["status"] != "missing" else colors.HexColor("#1D1D1F"))
    tbl.setStyle(style)
    story.append(tbl)

    # Per-site detailed breakdown (new page) — Status & Coverage only (Last Record / Completed By removed per request)
    for s in matrix["sites"]:
        story.append(PageBreak())
        story.append(Paragraph(f"<b>{s['location_name']}</b> — {s['compliance_pct']}%", styles["Heading2"]))
        story.append(Paragraph(f"Period: {matrix['start_date']} to {matrix['end_date']}", styles["Normal"]))
        story.append(Spacer(1, 4))
        detail_rows = [["Check", "Status", "Coverage"]]
        for c in check_types:
            ch = s["checks"][c["key"]]
            detail_rows.append([
                c["label"],
                STATUS_LABELS.get(ch["status"], ch["status"]),
                f"{ch['actual_periods']}/{ch['expected']} ({ch['pct']}%)",
            ])
        det = Table(detail_rows, colWidths=[80*mm, 40*mm, 60*mm], repeatRows=1)
        det.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1D1D1F")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#E8E8ED")),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        for r_idx, c in enumerate(check_types, start=1):
            ch = s["checks"][c["key"]]
            bg = STATUS_COLOURS.get(ch["status"], colors.HexColor("#E8E8ED"))
            det.setStyle(TableStyle([("TEXTCOLOR", (1, r_idx), (1, r_idx), bg), ("FONTNAME", (1, r_idx), (1, r_idx), "Helvetica-Bold")]))
        story.append(det)

    # Running header "Food Safety Compliance Report" on every page.
    # Page number ("Page X of Y") is drawn by NumberedCanvas in a 2-pass build.
    page_w, page_h = landscape(A4)
    logo_path = os.path.join(os.path.dirname(__file__), "..", "assets", "jollys_logo.png")
    logo_path = os.path.normpath(logo_path)
    logo_size_mm = 14  # logo edge length
    logo_top_offset_mm = 8  # gap from page top to top of logo (safe print margin)

    def _on_page(canv, _doc):
        canv.saveState()
        # Logo (top-left) — square 14mm, with ~8mm safe margin from page edge
        if os.path.exists(logo_path):
            try:
                canv.drawImage(logo_path, 15*mm, page_h - (logo_size_mm + logo_top_offset_mm)*mm,
                               width=logo_size_mm*mm, height=logo_size_mm*mm,
                               mask='auto', preserveAspectRatio=True)
            except Exception as logo_err:
                # Surface the failure in logs so it's debuggable in prod
                import logging
                logging.getLogger(__name__).warning(
                    "Compliance PDF logo render failed: %s", logo_err,
                )
        # Header text vertically centered next to the logo
        text_x = (15 + logo_size_mm + 4) * mm
        title_y = page_h - (logo_top_offset_mm + 6) * mm   # ~14mm from top
        subtitle_y = title_y - 4.5 * mm
        canv.setFont("Helvetica-Bold", 12)
        canv.setFillColor(colors.HexColor("#1D1D1F"))
        canv.drawString(text_x, title_y, "Food Safety Compliance Report")
        canv.setFont("Helvetica", 8)
        canv.setFillColor(colors.HexColor("#86868B"))
        canv.drawString(text_x, subtitle_y, "Jolly's Kafe")
        canv.drawRightString(page_w - 15*mm, title_y,
                             f"{matrix['start_date']} to {matrix['end_date']}")
        canv.setStrokeColor(colors.HexColor("#E8E8ED"))
        canv.setLineWidth(0.4)
        # Divider line below the logo
        canv.line(15*mm, page_h - (logo_size_mm + logo_top_offset_mm + 2)*mm,
                  page_w - 15*mm, page_h - (logo_size_mm + logo_top_offset_mm + 2)*mm)
        canv.restoreState()

    from reportlab.pdfgen import canvas as _pdfcanvas

    class NumberedCanvas(_pdfcanvas.Canvas):
        """Captures every page state so on save() we can stamp 'Page X of Y'."""
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self._saved_pages = []

        def showPage(self):
            self._saved_pages.append(dict(self.__dict__))
            self._startPage()

        def save(self):
            total = len(self._saved_pages)
            for state in self._saved_pages:
                self.__dict__.update(state)
                self._draw_page_number(total)
                super().showPage()
            super().save()

        def _draw_page_number(self, total):
            self.saveState()
            self.setFont("Helvetica-Bold", 10)
            self.setFillColor(colors.HexColor("#1D1D1F"))
            self.drawCentredString(page_w / 2, 8*mm, f"Page {self._pageNumber} of {total}")
            self.restoreState()

    doc.build(story, onFirstPage=_on_page, onLaterPages=_on_page, canvasmaker=NumberedCanvas)
    return buf.getvalue()


def _admin_recipients() -> List[str]:
    """All admins + super_admins who have an email (from both users and customers collections)."""
    emails = set()
    for coll in (users_collection, customers_collection):
        for u in coll.find({"role": {"$in": ["admin", "super_admin"]}, "email": {"$ne": None}}, {"_id": 0, "email": 1}):
            if u.get("email"):
                emails.add(u["email"])
    return sorted(emails)


def _send_digest(start_date: str, end_date: str, recipients: List[str]) -> dict:
    if not all([SMTP_HOST, SMTP_EMAIL, SMTP_PASSWORD]):
        return {"sent": False, "reason": "SMTP not configured"}
    if not recipients:
        return {"sent": False, "reason": "No admin recipients"}

    matrix = _collect_matrix(start_date, end_date)
    pdf_bytes = _build_pdf(matrix)

    msg = MIMEMultipart()
    msg["From"] = f"Jolly's Kafe Compliance <{SMTP_EMAIL}>"
    msg["To"] = ", ".join(recipients)
    msg["Subject"] = f"Weekly Compliance Digest — {matrix['overall_pct']}% ({start_date} to {end_date})"

    body = f"""Hi team,

Your weekly Food Safety Compliance digest is attached.

Overall compliance this week: {matrix['overall_pct']}%
Sites covered: {len(matrix['sites'])}
Period: {start_date} — {end_date}

The PDF includes:
  • Site × 9-check compliance matrix
  • Per-site detailed breakdown (Check / Status / Coverage / Last Record / Completed By)
  • Suitable for EHO audit inspections

View live matrix: https://jollyskafe.com/admin/compliance

—
Automated weekly digest · Jolly's Kafe
"""
    msg.attach(MIMEText(body, "plain"))

    attach = MIMEApplication(pdf_bytes, _subtype="pdf")
    attach.add_header("Content-Disposition", "attachment", filename=f"compliance-digest_{start_date}_to_{end_date}.pdf")
    msg.attach(attach)

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.send_message(msg)
        print(f"[compliance-digest] Sent to {len(recipients)} admins · overall={matrix['overall_pct']}%")
        return {"sent": True, "recipients": recipients, "overall_pct": matrix["overall_pct"], "pdf_size": len(pdf_bytes)}
    except Exception as e:
        print(f"[compliance-digest] Send failed: {e}")
        return {"sent": False, "reason": str(e)}


def run_weekly_digest_job():
    """Scheduled job — runs every Monday 07:00 London. Covers previous Mon-Sun."""
    today = date.today()
    # End date = yesterday (Sunday if today is Mon), start = 6 days prior
    end = today - timedelta(days=1)
    start = end - timedelta(days=6)
    recipients = _admin_recipients()
    _send_digest(start.isoformat(), end.isoformat(), recipients)


# ---------- Manual trigger (admin only) ----------
@router.post("/send-now")
async def send_digest_now(user: dict = Depends(get_admin_user)):
    """Manually trigger the digest (useful for admins to preview or resend)."""
    today = date.today()
    end = today - timedelta(days=1)
    start = end - timedelta(days=6)
    recipients = _admin_recipients()
    result = _send_digest(start.isoformat(), end.isoformat(), recipients)
    if not result.get("sent"):
        raise HTTPException(status_code=400, detail=result.get("reason", "Send failed"))
    return result


@router.get("/recipients")
async def get_recipients(user: dict = Depends(get_admin_user)):
    return {"recipients": _admin_recipients()}


@router.get("/preview-pdf")
async def preview_pdf(
    start_date: str | None = None,
    end_date: str | None = None,
    user: dict = Depends(get_admin_user),
):
    """Return the PDF inline for preview. Defaults to last 7 days when no range is supplied."""
    from fastapi.responses import Response
    if not (start_date and end_date):
        today = date.today()
        end_d = today - timedelta(days=1)
        start_d = end_d - timedelta(days=6)
        start_date = start_d.isoformat()
        end_date = end_d.isoformat()
    matrix = _collect_matrix(start_date, end_date)
    pdf = _build_pdf(matrix)
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f"inline; filename=compliance-report_{start_date}_to_{end_date}.pdf"})
