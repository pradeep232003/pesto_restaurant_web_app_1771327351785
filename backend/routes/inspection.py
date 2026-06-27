"""
Inspection Mode — "EHO-ready audit pack" aggregator.

Returns a single bundle containing everything an Environmental Health Officer
typically asks for during an inspection: site identity, compliance % matrix
over a date range, probe registry & recent calibrations, recent legionella
tests, staff roster, and a summary of operational templates (checklists).

Endpoint is admin-gated. The page is read-only; no writes happen here.
"""
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query

from auth import get_admin_user
from db import db, locations_collection
from routes.compliance import CHECK_CONFIG, _assess_check

router = APIRouter(prefix="/api/admin/inspection", tags=["inspection"])


@router.get("/pack")
async def get_pack(
    location_id: str = Query(...),
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD; defaults to today-30d"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD; defaults to today"),
    user: dict = Depends(get_admin_user),
):
    end = end_date or date.today().isoformat()
    start = start_date or (date.today() - timedelta(days=30)).isoformat()

    loc = locations_collection.find_one({"id": location_id}, {"_id": 0}) or {}

    # --- Compliance matrix for this site, mirroring /api/admin/compliance.
    applicable = loc.get("applicable_routines") or []
    checks: dict = {}
    per_site_scores: list = []
    status_weight = {"complete": 1, "partial": 0.5, "overdue": 0.0, "missing": 0.0, "not_applicable": None}
    for key, cfg in CHECK_CONFIG.items():
        if applicable and key not in applicable:
            continue
        result = _assess_check(location_id, cfg, start, end, check_key=key)
        result["label"] = cfg["label"]
        result["cadence"] = cfg["cadence"]
        checks[key] = result
        w = status_weight.get(result["status"])
        if w is not None:
            per_site_scores.append(w)
    compliance_pct = round(100 * sum(per_site_scores) / len(per_site_scores)) if per_site_scores else 0

    # --- Probes registry + last 10 calibrations
    probes = list(db["probes"].find({"location_id": location_id}, {"_id": 0}).sort("name", 1))
    recent_calibrations = list(
        db["probe_calibrations"].find({"location_id": location_id}, {"_id": 0}).sort("recorded_at", -1).limit(10)
    )

    # --- Legionella (last 12 weeks)
    leg_start = (date.today() - timedelta(days=84)).isoformat()
    legionella = list(
        db["legionella_tests"]
        .find({"location_id": location_id, "date": {"$gte": leg_start}}, {"_id": 0})
        .sort("date", -1)
        .limit(20)
    )

    # --- Staff roster (active at this site)
    staff = list(
        db["staff"]
        .find(
            {"$or": [{"location_id": location_id}, {"location_ids": location_id}], "is_active": {"$ne": False}},
            {"_id": 0, "hourly_rate": 0},  # don't leak pay info into the audit pack
        )
        .sort("name", 1)
    )

    # --- Documents on file at this site, with expiry tracking. Anything
    # expiring within 60 days or already expired is highlighted for the EHO.
    docs_rows = list(db["documents"].find({"location_id": location_id}, {"_id": 0}).sort("uploaded_at", -1).limit(200))
    today = date.today().isoformat()
    soon = (date.today() + timedelta(days=60)).isoformat()
    expiring_soon = [d for d in docs_rows if d.get("expires_at") and today <= d["expires_at"] <= soon]
    expired = [d for d in docs_rows if d.get("expires_at") and d["expires_at"] < today]
    documents_summary = {
        "total": len(docs_rows),
        "with_expiry": sum(1 for d in docs_rows if d.get("expires_at")),
        "expired": expired,
        "expiring_soon": expiring_soon,
    }

    # --- Templates summary (count by cadence)
    tpl_q = {
        "$or": [
            {"scope": "global"},
            {"scope": "location", "location_id": location_id},
            {"scope": {"$exists": False}, "location_id": location_id},
        ]
    }
    tpls = list(db["checklist_templates"].find(tpl_q, {"_id": 0, "id": 1, "title": 1, "frequency": 1, "items": 1}))
    templates_summary = {
        "daily":   [{"id": t["id"], "title": t["title"], "items": len(t.get("items") or [])} for t in tpls if t.get("frequency") == "daily"],
        "weekly":  [{"id": t["id"], "title": t["title"], "items": len(t.get("items") or [])} for t in tpls if t.get("frequency") == "weekly"],
        "monthly": [{"id": t["id"], "title": t["title"], "items": len(t.get("items") or [])} for t in tpls if t.get("frequency") == "monthly"],
    }

    return {
        "location": {
            "id": loc.get("id", location_id),
            "name": loc.get("name", ""),
            "address": loc.get("address", ""),
            "phone": loc.get("phone", ""),
        },
        "range": {"start_date": start, "end_date": end},
        "compliance": {
            "overall_pct": compliance_pct,
            "checks": checks,
        },
        "probes": probes,
        "recent_calibrations": recent_calibrations,
        "legionella": legionella,
        "staff": staff,
        "documents": documents_summary,
        "templates": templates_summary,
    }
