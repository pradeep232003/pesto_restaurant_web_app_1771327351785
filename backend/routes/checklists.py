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


# ============== MODELS ==============

class TemplateBody(BaseModel):
    location_id: str
    title: str
    frequency: Frequency
    items: List[str] = Field(default_factory=list)


class TemplatePatch(BaseModel):
    title: Optional[str] = None
    frequency: Optional[Frequency] = None
    items: Optional[List[str]] = None


class RunBody(BaseModel):
    checked_items: List[int]   # indices of ticked items
    comment: Optional[str] = ""


# ============== TEMPLATES ==============

@router.get("")
async def list_templates(
    location_id: str = Query(...),
    frequency: Optional[Frequency] = Query(None),
    user: dict = Depends(get_staff_or_above),
):
    q = {"location_id": location_id}
    if frequency:
        q["frequency"] = frequency
    return list(templates.find(q, {"_id": 0}).sort("title", 1))


@router.post("")
async def create_template(body: TemplateBody, user: dict = Depends(get_admin_user)):
    if not body.title.strip():
        raise HTTPException(400, "Title is required")
    doc = {
        "id": str(uuid.uuid4())[:12],
        "location_id": body.location_id,
        "title": body.title.strip(),
        "frequency": body.frequency,
        "items": [s for s in (i.strip() for i in body.items) if s],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user.get("email", ""),
    }
    templates.insert_one(dict(doc))
    return {k: v for k, v in doc.items() if k != "_id"}


@router.get("/{tpl_id}")
async def get_template(tpl_id: str, user: dict = Depends(get_staff_or_above)):
    doc = templates.find_one({"id": tpl_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
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
        upd["items"] = [s for s in (i.strip() for i in upd["items"]) if s]
    templates.update_one({"id": tpl_id}, {"$set": upd})
    return templates.find_one({"id": tpl_id}, {"_id": 0})


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
    total = len(tpl.get("items") or [])
    checked = [i for i in body.checked_items if 0 <= i < total]
    doc = {
        "id": str(uuid.uuid4())[:12],
        "template_id": tpl_id,
        "location_id": tpl["location_id"],
        "title": tpl["title"],
        "frequency": tpl["frequency"],
        "total_items": total,
        "checked_items": checked,
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
