"""
Business Intelligence (BI) — super_admin only.

Aggregates Daily Sales + Staff Hours + Staff hourly_rate + Menu Recipes
into KPI metrics (Labour %, Food Cost %, Revenue) per location and overall.

Designed to be pure read-only — no mutations.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query

from db import db, daily_sales_collection, menu_items_collection, locations_collection
from auth import get_super_admin

router = APIRouter(prefix="/api/admin/bi", tags=["bi"])

staff_collection = db["staff_members"]


def _hours_between(start: str, end: str) -> float:
    if not start or not end:
        return 0.0
    try:
        st = datetime.strptime(start, "%H:%M")
        et = datetime.strptime(end, "%H:%M")
        diff = (et - st).total_seconds() / 3600.0
        # Handle overnight shifts (end < start)
        if diff < 0:
            diff += 24
        return round(diff, 2)
    except ValueError:
        return 0.0


def _build_rate_lookup() -> dict:
    """Build lowercase-name → hourly_rate map from staff_members collection."""
    rates = {}
    for s in staff_collection.find({}, {"_id": 0, "name": 1, "hourly_rate": 1}):
        nm = (s.get("name") or "").strip().lower()
        if nm:
            rates[nm] = float(s.get("hourly_rate") or 0)
    return rates


def _avg_recipe_cost_by_location() -> dict:
    """
    Compute the average recipe cost per menu item, grouped by location.
    Returns: {location_id: {"avg_cost": x, "avg_price": y, "items_with_recipe": n, "total_items": m}}
    Only includes items with at least one recipe line that has cost > 0.
    """
    result = {}
    cursor = menu_items_collection.find(
        {},
        {"_id": 0, "location_id": 1, "price": 1, "recipe": 1, "is_available": 1},
    )
    for it in cursor:
        loc = it.get("location_id") or "unknown"
        bucket = result.setdefault(loc, {
            "items_with_recipe": 0,
            "total_items": 0,
            "sum_cost": 0.0,
            "sum_price": 0.0,
        })
        bucket["total_items"] += 1
        recipe = it.get("recipe") or []
        cost = 0.0
        for line in recipe:
            qty = float(line.get("qty") or 0)
            uc = float(line.get("unit_cost") or 0)
            cost += qty * uc
        if cost > 0:
            bucket["items_with_recipe"] += 1
            bucket["sum_cost"] += cost
            bucket["sum_price"] += float(it.get("price") or 0)

    out = {}
    for loc, b in result.items():
        n = b["items_with_recipe"]
        out[loc] = {
            "avg_cost": round(b["sum_cost"] / n, 2) if n else 0.0,
            "avg_price": round(b["sum_price"] / n, 2) if n else 0.0,
            "items_with_recipe": n,
            "total_items": b["total_items"],
            # avg recipe-cost-to-price ratio (food cost %), only over items with recipes
            "avg_food_cost_pct": round((b["sum_cost"] / b["sum_price"]) * 100, 1) if b["sum_price"] > 0 else 0.0,
        }
    return out


@router.get("")
async def bi_overview(
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD inclusive"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD inclusive"),
    location_id: Optional[str] = Query(None),
    user: dict = Depends(get_super_admin),
):
    """
    Returns BI overview:
    - kpi: { total_revenue, total_labour, labour_pct, est_food_cost_pct, total_hours }
    - by_location: list of per-location rollups
    - menu: avg food cost % per location (recipe-based)
    - period: { start_date, end_date, days }
    """
    # Default to last 7 days inclusive
    if not start_date or not end_date:
        today = datetime.now(timezone.utc).date()
        end_date = end_date or today.isoformat()
        start_date = start_date or (today - timedelta(days=6)).isoformat()

    sales_query: dict = {"date": {"$gte": start_date, "$lte": end_date}}
    if location_id:
        sales_query["location_id"] = location_id

    entries = list(daily_sales_collection.find(sales_query, {"_id": 0}))
    rates = _build_rate_lookup()
    menu_rollup = _avg_recipe_cost_by_location()

    # Per-location accumulators
    per_loc: dict = {}
    total_revenue = 0.0
    total_labour = 0.0
    total_hours = 0.0

    for e in entries:
        loc = e.get("location_id") or "unknown"
        bucket = per_loc.setdefault(loc, {
            "location_id": loc,
            "revenue": 0.0,
            "labour": 0.0,
            "hours": 0.0,
            "days": 0,
            "staff_breakdown": {},  # name -> {hours, cost}
        })

        rev = float(e.get("sales") or 0)
        bucket["revenue"] += rev
        bucket["days"] += 1
        total_revenue += rev

        for sh in (e.get("staff_hours") or []):
            name = (sh.get("name") or "").strip()
            if not name:
                continue
            hrs = _hours_between(sh.get("start_time", ""), sh.get("end_time", ""))
            rate = rates.get(name.lower(), 0.0)
            cost = round(hrs * rate, 2)
            bucket["hours"] += hrs
            bucket["labour"] += cost
            sb = bucket["staff_breakdown"].setdefault(name, {"hours": 0.0, "cost": 0.0, "rate": rate})
            sb["hours"] = round(sb["hours"] + hrs, 2)
            sb["cost"] = round(sb["cost"] + cost, 2)
            total_hours += hrs
            total_labour += cost

    # Finalise per-location records
    by_location = []
    loc_names = {ldoc["id"]: ldoc.get("name", ldoc["id"]) for ldoc in locations_collection.find({}, {"_id": 0, "id": 1, "name": 1})}
    for loc, b in per_loc.items():
        rev = b["revenue"]
        lab = b["labour"]
        labour_pct = round((lab / rev) * 100, 1) if rev > 0 else 0.0
        menu = menu_rollup.get(loc, {"avg_food_cost_pct": 0.0, "items_with_recipe": 0, "total_items": 0})
        est_food_cost = round((rev * menu["avg_food_cost_pct"] / 100), 2) if menu["avg_food_cost_pct"] > 0 else 0.0
        gross_margin = round(rev - lab - est_food_cost, 2)
        by_location.append({
            "location_id": loc,
            "location_name": loc_names.get(loc, loc),
            "revenue": round(rev, 2),
            "labour": round(lab, 2),
            "labour_pct": labour_pct,
            "hours": round(b["hours"], 2),
            "days": b["days"],
            "food_cost_pct": menu["avg_food_cost_pct"],
            "est_food_cost": est_food_cost,
            "gross_margin": gross_margin,
            "gross_margin_pct": round((gross_margin / rev) * 100, 1) if rev > 0 else 0.0,
            "menu_coverage": {
                "items_with_recipe": menu["items_with_recipe"],
                "total_items": menu["total_items"],
            },
            "staff_breakdown": sorted(
                [{"name": n, **v} for n, v in b["staff_breakdown"].items()],
                key=lambda x: x["cost"], reverse=True,
            ),
        })
    by_location.sort(key=lambda x: x["revenue"], reverse=True)

    # Overall food cost % = weighted average across locations
    total_food_cost = sum(loc["est_food_cost"] for loc in by_location)
    overall_food_cost_pct = round((total_food_cost / total_revenue) * 100, 1) if total_revenue > 0 else 0.0
    overall_labour_pct = round((total_labour / total_revenue) * 100, 1) if total_revenue > 0 else 0.0
    overall_gross = round(total_revenue - total_labour - total_food_cost, 2)

    # Period length in days
    try:
        sd = datetime.strptime(start_date, "%Y-%m-%d").date()
        ed = datetime.strptime(end_date, "%Y-%m-%d").date()
        days = (ed - sd).days + 1
    except ValueError:
        days = len({e.get("date") for e in entries})

    return {
        "period": {"start_date": start_date, "end_date": end_date, "days": days},
        "kpi": {
            "total_revenue": round(total_revenue, 2),
            "total_labour": round(total_labour, 2),
            "total_hours": round(total_hours, 2),
            "labour_pct": overall_labour_pct,
            "est_food_cost": round(total_food_cost, 2),
            "food_cost_pct": overall_food_cost_pct,
            "gross_margin": overall_gross,
            "gross_margin_pct": round((overall_gross / total_revenue) * 100, 1) if total_revenue > 0 else 0.0,
            "entries": len(entries),
        },
        "by_location": by_location,
        "menu_recipe_summary": menu_rollup,
    }


@router.get("/menu-cost")
async def menu_cost_breakdown(
    location_id: Optional[str] = Query(None),
    user: dict = Depends(get_super_admin),
):
    """
    Per-menu-item recipe cost & margin breakdown — super_admin only.
    Returns list of items with computed cost, margin £, margin %.
    """
    query: dict = {}
    if location_id:
        query["location_id"] = location_id

    items_out = []
    for it in menu_items_collection.find(query, {"_id": 0}):
        recipe = it.get("recipe") or []
        cost = 0.0
        for line in recipe:
            qty = float(line.get("qty") or 0)
            uc = float(line.get("unit_cost") or 0)
            cost += qty * uc
        price = float(it.get("price") or 0)
        margin = price - cost
        items_out.append({
            "id": it.get("id"),
            "name": it.get("name"),
            "location_id": it.get("location_id"),
            "category": it.get("category"),
            "price": round(price, 2),
            "recipe_cost": round(cost, 2),
            "margin": round(margin, 2),
            "food_cost_pct": round((cost / price) * 100, 1) if price > 0 else 0.0,
            "margin_pct": round((margin / price) * 100, 1) if price > 0 else 0.0,
            "recipe_lines": len(recipe),
            "has_recipe": cost > 0,
        })

    items_out.sort(key=lambda x: (not x["has_recipe"], -x["margin"]))
    return {"items": items_out}
