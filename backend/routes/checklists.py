"""
Operational checklists per location, grouped by frequency (daily/weekly/monthly).

Two collections:
  checklist_templates  — admin-managed: title, frequency, items[] (string list)
  checklist_runs       — staff submissions: which items ticked, when, by whom

CRUD on templates is admin/super-admin only; staff can only execute runs.
"""
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from db import db
from auth import get_staff_or_above, get_admin_user

router = APIRouter(prefix="/api/admin/checklists", tags=["checklists"])

templates = db["checklist_templates"]
runs = db["checklist_runs"]

Frequency = Literal["daily", "weekly", "monthly"]
Scope = Literal["global", "location"]


# An item can be a plain string (legacy) or an {"text", "sites"} dict.
# `sites` is the list of location_ids it applies to; an empty list means
# "all sites" (the default).
def _normalize_items(raw):
    out = []
    for it in raw or []:
        if isinstance(it, str):
            t = it.strip()
            if t:
                out.append({"text": t, "sites": []})
        elif isinstance(it, dict):
            t = (it.get("text") or "").strip()
            if not t:
                continue
            sites = it.get("sites") or []
            if not isinstance(sites, list):
                sites = []
            sites = [str(s) for s in sites if s]
            out.append({"text": t, "sites": sites})
    return out


def _filter_items_for_site(items, location_id):
    """Keep items whose `sites` is empty OR contains `location_id`."""
    out = []
    for it in items or []:
        sites = (it or {}).get("sites") or []
        if not sites or location_id in sites:
            out.append(it)
    return out


# ============== MODELS ==============

class ChecklistItem(BaseModel):
    text: str
    sites: List[str] = Field(default_factory=list)


class TemplateBody(BaseModel):
    location_id: str             # site id used when scope='location'; ignored otherwise
    title: str
    frequency: Frequency
    items: List = Field(default_factory=list)   # accepts strings OR {text,sites}
    scope: Scope = "location"    # 'global' = shared with every site


class TemplatePatch(BaseModel):
    title: Optional[str] = None
    frequency: Optional[Frequency] = None
    items: Optional[List] = None
    scope: Optional[Scope] = None
    location_id: Optional[str] = None  # only meaningful if scope flips to 'location'


class RunBody(BaseModel):
    checked_items: List[int]   # indices of ticked items (within visible-at-this-site list)
    comment: Optional[str] = ""
    location_id: Optional[str] = None  # site running the checklist (for global templates)


# ============== TEMPLATES ==============

@router.get("")
async def list_templates(
    location_id: str = Query(...),
    frequency: Optional[Frequency] = Query(None),
    user: dict = Depends(get_staff_or_above),
):
    # Site-specific OR global templates.
    base = {"$or": [
        {"scope": "global"},
        {"scope": "location", "location_id": location_id},
        # Backward compat: rows created before `scope` existed.
        {"scope": {"$exists": False}, "location_id": location_id},
    ]}
    if frequency:
        base["frequency"] = frequency
    # Pre-load the most recent run per template at this location so the
    # Daily Check hub & home tile can detect "ran today" without an N+1.
    latest_runs = {}
    for r in runs.find({"location_id": location_id}, {"_id": 0, "template_id": 1, "submitted_at": 1}).sort("submitted_at", -1):
        tid = r.get("template_id")
        if tid and tid not in latest_runs:
            latest_runs[tid] = r.get("submitted_at", "")
    out = []
    for tpl in templates.find(base, {"_id": 0}).sort("title", 1):
        items = _normalize_items(tpl.get("items"))
        # For run-wizard purposes the list view also returns the
        # already-filtered count so the card label is accurate.
        tpl["items"] = items
        tpl["visible_items_count"] = len(_filter_items_for_site(items, location_id))
        tpl["last_run_at"] = latest_runs.get(tpl.get("id"), "")
        out.append(tpl)
    return out


@router.post("")
async def create_template(body: TemplateBody, user: dict = Depends(get_admin_user)):
    if not body.title.strip():
        raise HTTPException(400, "Title is required")
    doc = {
        "id": str(uuid.uuid4())[:12],
        # Global templates carry an empty location_id so they show on every site.
        "location_id": "" if body.scope == "global" else body.location_id,
        "scope": body.scope,
        "title": body.title.strip(),
        "frequency": body.frequency,
        "items": _normalize_items(body.items),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user.get("email", ""),
    }
    templates.insert_one(dict(doc))
    return {k: v for k, v in doc.items() if k != "_id"}


@router.get("/{tpl_id}")
async def get_template(
    tpl_id: str,
    location_id: Optional[str] = Query(None),
    user: dict = Depends(get_staff_or_above),
):
    doc = templates.find_one({"id": tpl_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    items = _normalize_items(doc.get("items"))
    doc["items_all"] = items  # raw list for the editor
    doc["items"] = _filter_items_for_site(items, location_id) if location_id else items
    return doc


@router.patch("/{tpl_id}")
async def update_template(tpl_id: str, body: TemplatePatch, user: dict = Depends(get_admin_user)):
    existing = templates.find_one({"id": tpl_id})
    if not existing:
        raise HTTPException(404, "Not found")
    upd = {k: v for k, v in body.dict(exclude_unset=True).items() if v is not None}
    if "title" in upd:
        upd["title"] = upd["title"].strip()
        if not upd["title"]:
            raise HTTPException(400, "Title is required")
    if "items" in upd:
        upd["items"] = _normalize_items(upd["items"])
    # Scope flip: if going global, blank the location_id; if going location and
    # no new location_id was supplied, fall back to the existing one.
    if upd.get("scope") == "global":
        upd["location_id"] = ""
    elif upd.get("scope") == "location" and not upd.get("location_id"):
        upd["location_id"] = existing.get("location_id") or ""
    templates.update_one({"id": tpl_id}, {"$set": upd})
    return templates.find_one({"id": tpl_id}, {"_id": 0})


@router.post("/{tpl_id}/duplicate")
async def duplicate_template(
    tpl_id: str,
    location_id: str = Query(...),
    user: dict = Depends(get_admin_user),
):
    """Fork a global template into a site-specific copy so this one location can
    customise items without affecting the global one."""
    existing = templates.find_one({"id": tpl_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Not found")
    doc = {
        "id": str(uuid.uuid4())[:12],
        "location_id": location_id,
        "scope": "location",
        "title": existing.get("title", ""),
        "frequency": existing.get("frequency", "daily"),
        "items": list(existing.get("items") or []),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user.get("email", ""),
        "forked_from": tpl_id,
    }
    templates.insert_one(dict(doc))
    return {k: v for k, v in doc.items() if k != "_id"}


@router.delete("/{tpl_id}")
async def delete_template(tpl_id: str, user: dict = Depends(get_admin_user)):
    res = templates.delete_one({"id": tpl_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    runs.delete_many({"template_id": tpl_id})
    return {"deleted": True}


# ============== RUNS ==============

@router.get("/{tpl_id}/runs")
async def list_runs(tpl_id: str, limit: int = Query(50, le=200), user: dict = Depends(get_staff_or_above)):
    return list(runs.find({"template_id": tpl_id}, {"_id": 0}).sort("submitted_at", -1).limit(limit))


@router.post("/{tpl_id}/runs")
async def submit_run(tpl_id: str, body: RunBody, user: dict = Depends(get_staff_or_above)):
    tpl = templates.find_one({"id": tpl_id}, {"_id": 0})
    if not tpl:
        raise HTTPException(404, "Template not found")
    site = body.location_id or tpl.get("location_id") or ""
    raw_items = _normalize_items(tpl.get("items"))
    visible_items = _filter_items_for_site(raw_items, site)
    total = len(visible_items)
    checked = [i for i in body.checked_items if 0 <= i < total]
    # Capture the actual item TEXTS the user ticked off so the audit trail is
    # legible even after the template gets edited later.
    ticked_texts = [visible_items[i]["text"] for i in checked]
    doc = {
        "id": str(uuid.uuid4())[:12],
        "template_id": tpl_id,
        "location_id": site,
        "title": tpl["title"],
        "frequency": tpl["frequency"],
        "total_items": total,
        "checked_items": checked,
        "ticked_texts": ticked_texts,
        "completed": len(checked) == total,
        "comment": body.comment or "",
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "submitted_by": user.get("email", ""),
        "submitted_by_name": user.get("name", ""),
    }
    runs.insert_one(dict(doc))
    return {k: v for k, v in doc.items() if k != "_id"}


@router.delete("/runs/{run_id}")
async def delete_run(run_id: str, user: dict = Depends(get_admin_user)):
    res = runs.delete_one({"id": run_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"deleted": True}
