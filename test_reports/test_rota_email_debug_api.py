#!/usr/bin/env python3
"""Focused backend verification for rota email debug Resend transport."""
import json
import os
import sys
from pathlib import Path

import requests


def read_preview_url() -> str:
    env_path = Path("/app/frontend/.env")
    for line in env_path.read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            return line.split("=", 1)[1].strip().rstrip("/")
    raise RuntimeError("REACT_APP_BACKEND_URL not found")


API = os.environ.get("TEST_API_BASE", read_preview_url())
LOGIN = {"email": "admin@jollys.com", "password": "Admin123!"}
PAYLOAD = {
    "location_id": "timperley-altrincham",
    "start_date": "2026-06-20",
    "end_date": "2026-06-26",
}


def main() -> int:
    session = requests.Session()
    report = {"api_base": API, "steps": []}

    login_resp = session.post(f"{API}/api/auth/login", json=LOGIN, timeout=30)
    report["steps"].append({"step": "login", "status": login_resp.status_code})
    if login_resp.status_code != 200:
        report["error"] = login_resp.text[:500]
        print(json.dumps(report, indent=2))
        return 2
    token = login_resp.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"} if token else {}

    dry_payload = {**PAYLOAD, "dry_run": True}
    dry_resp = session.post(f"{API}/api/admin/shifts/debug-email", json=dry_payload, headers=headers, timeout=45)
    dry_json = dry_resp.json() if dry_resp.headers.get("content-type", "").startswith("application/json") else {"raw": dry_resp.text[:500]}
    report["steps"].append({"step": "dry_run", "status": dry_resp.status_code, "json": dry_json})

    dry_assertions = {
        "transport_resend": dry_json.get("transport") == "resend",
        "resend_configured_true": dry_json.get("resend_configured") is True,
        "reach_host_api_resend": dry_json.get("reach_host") == "api.resend.com",
        "reach_port_443": dry_json.get("reach_port") == 443,
        "smtp_reachable_true": dry_json.get("smtp_reachable") is True,
    }
    report["dry_assertions"] = dry_assertions

    live_payload = {**PAYLOAD, "dry_run": False, "override_to": "jpmanchesteruk@gmail.com"}
    live_resp = session.post(f"{API}/api/admin/shifts/debug-email", json=live_payload, headers=headers, timeout=90)
    live_json = live_resp.json() if live_resp.headers.get("content-type", "").startswith("application/json") else {"raw": live_resp.text[:500]}
    report["steps"].append({"step": "live_send", "status": live_resp.status_code, "json": live_json})
    live_results = live_json.get("results") or []
    report["live_assertions"] = {
        "has_sent_true_reason_sent": any(r.get("sent") is True and r.get("reason") == "sent" for r in live_results),
        "override_only_allowed_address": live_json.get("override_to") == "jpmanchesteruk@gmail.com",
    }

    out_path = Path("/app/test_reports/rota_email_debug_api_result.json")
    out_path.write_text(json.dumps(report, indent=2, default=str))
    print(json.dumps(report, indent=2, default=str))

    ok = dry_resp.status_code == 200 and live_resp.status_code == 200 and all(dry_assertions.values()) and all(report["live_assertions"].values())
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())