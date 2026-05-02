"""Backend tests for Weekly Compliance Digest feature."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://jovial-hamilton-4.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@jollys.com"
ADMIN_PASSWORD = "Admin123!"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("access_token") or data.get("token")
    assert tok, f"No access_token in login response: {data}"
    return tok


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ----------------- Recipients endpoint -----------------
class TestRecipients:
    def test_recipients_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/compliance-digest/recipients", timeout=10)
        assert r.status_code in (401, 403), f"Unauthed should be 401/403, got {r.status_code}"

    def test_recipients_admin_ok(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/compliance-digest/recipients",
                         headers=admin_headers, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "recipients" in data
        recipients = data["recipients"]
        assert isinstance(recipients, list)
        # Should contain admin@jollys.com at least
        assert ADMIN_EMAIL in recipients, f"admin email missing from {recipients}"
        # Must be sorted ascending
        assert recipients == sorted(recipients), "recipients not sorted"
        # All unique
        assert len(recipients) == len(set(recipients)), "duplicates present"


# ----------------- Preview PDF endpoint -----------------
class TestPreviewPDF:
    def test_preview_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/compliance-digest/preview-pdf", timeout=30)
        assert r.status_code in (401, 403)

    def test_preview_admin_ok(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/compliance-digest/preview-pdf",
                         headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text[:500]
        ct = r.headers.get("content-type", "")
        assert ct.startswith("application/pdf"), f"content-type={ct}"
        assert r.content[:4] == b"%PDF", f"first bytes={r.content[:8]!r}"
        # PDF should be non-trivial size (>2KB) given our content
        assert len(r.content) > 2000, f"pdf too small: {len(r.content)}"
        # Extract text from PDF (reportlab compresses streams) using pypdf
        import io as _io
        from pypdf import PdfReader
        reader = PdfReader(_io.BytesIO(r.content))
        all_text = "\n".join((p.extract_text() or "") for p in reader.pages)
        assert "Food Safety Compliance" in all_text, f"Title missing. Extracted: {all_text[:400]}"
        assert "Weekly Digest" in all_text, "'Weekly Digest' missing from PDF"
        assert "Overall Compliance" in all_text, "Overall compliance heading missing"
        # Period date range format YYYY-MM-DD
        import re
        assert re.search(r"\d{4}-\d{2}-\d{2}\s*to\s*\d{4}-\d{2}-\d{2}", all_text), \
            f"Period date range missing. Got: {all_text[:400]}"
        # Per-site detail page header phrases
        assert "Check" in all_text and "Status" in all_text and "Coverage" in all_text, \
            "Per-site detail columns missing"
        # Multi-page (matrix + per-site pages)
        assert len(reader.pages) >= 2, f"Expected >=2 pages (matrix + per-site), got {len(reader.pages)}"


# ----------------- Send Now endpoint -----------------
class TestSendNow:
    def test_send_now_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/admin/compliance-digest/send-now", timeout=60)
        assert r.status_code in (401, 403)

    def test_send_now_admin_ok(self, admin_headers):
        # Only one live SMTP call in the suite
        r = requests.post(f"{BASE_URL}/api/admin/compliance-digest/send-now",
                          headers=admin_headers, timeout=60)
        assert r.status_code == 200, r.text[:500]
        data = r.json()
        assert data.get("sent") is True, f"sent flag false: {data}"
        assert isinstance(data.get("recipients"), list) and ADMIN_EMAIL in data["recipients"]
        assert "overall_pct" in data and isinstance(data["overall_pct"], int)
        assert data.get("pdf_size", 0) > 2000


# ----------------- run_weekly_digest_job callable + scheduler -----------------
class TestSchedulerAndJob:
    def test_job_import_and_callable(self):
        # Import directly from the backend module (tests run under /app/backend cwd in pytest config)
        import sys
        sys.path.insert(0, "/app/backend")
        from routes.compliance_digest import run_weekly_digest_job, _admin_recipients
        assert callable(run_weekly_digest_job)
        # Should run without raising. In test env SMTP is configured so it may actually send;
        # the requirement says it must return cleanly. Our function returns None after _send_digest.
        # Calling it would actually send email → skip actual execution to avoid flooding SMTP.
        # Verify the helper that it depends on runs fine instead.
        recipients = _admin_recipients()
        assert isinstance(recipients, list)
        assert ADMIN_EMAIL in recipients

    def test_scheduler_log_line_present(self):
        # Scheduler start line is printed to stdout → supervisor backend.out.log
        import subprocess
        out = subprocess.run(
            ["grep", "-cF", "[scheduler] Weekly compliance digest scheduled for Mondays 07:00 Europe/London",
             "/var/log/supervisor/backend.out.log"],
            capture_output=True, text=True
        )
        count = int(out.stdout.strip() or "0")
        if count < 1:
            # fallback to err.log
            out2 = subprocess.run(
                ["grep", "-cF", "[scheduler] Weekly compliance digest scheduled for Mondays 07:00 Europe/London",
                 "/var/log/supervisor/backend.err.log"],
                capture_output=True, text=True
            )
            count = int(out2.stdout.strip() or "0")
        assert count >= 1, "Scheduler startup log line not found in backend logs"


# ----------------- Regression: existing compliance matrix still works -----------------
class TestComplianceRegression:
    def test_compliance_matrix(self, admin_headers):
        from datetime import date, timedelta
        end = date.today()
        start = end - timedelta(days=6)
        r = requests.get(f"{BASE_URL}/api/admin/compliance",
                         params={"start_date": start.isoformat(), "end_date": end.isoformat()},
                         headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert "sites" in data and "check_types" in data and "overall_pct" in data
