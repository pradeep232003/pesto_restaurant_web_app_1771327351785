"""
Business Intelligence (BI) — super_admin only.

Aggregates Daily Sales + Staff Hours + Staff hourly_rate + Menu Recipes
into KPI metrics (Labour %, Food Cost %, Revenue) per location and overall.

Also exposes `/ai-insights` which sends the rollup to Claude Sonnet 4.5 and
returns a structured analysis (headline, strengths, risks, actions, anomalies).
Results are cached for 30 minutes per (period, location_id) to avoid burning
LLM credits on every page refresh.

Designed to be pure read-only — no mutations.
"""
import hashlib
import json
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from db import db, daily_sales_collection, menu_items_collection, locations_collection
from auth import get_super_admin

router = APIRouter(prefix="/api/admin/bi", tags=["bi"])

staff_collection = db["staff_members"]
ai_cache = db["bi_ai_insights_cache"]
AI_CACHE_TTL = timedelta(minutes=30)


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
    return _compute_overview(start_date, end_date, location_id)


def _compute_overview(start_date: Optional[str], end_date: Optional[str], location_id: Optional[str]) -> dict:
    """Internal: build the BI overview dict so other endpoints (AI insights)
    can reuse it without going through HTTP."""
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



# ---------------------------------------------------------------------------
# AI Insights — Claude Sonnet 4.5 analysis of the BI rollup.
# ---------------------------------------------------------------------------

_AI_SYSTEM_PROMPT = """You are a senior restaurant business analyst for a multi-site
quick-service food brand. You are given an aggregated BI dataset (revenue,
labour cost, labour %, estimated food cost, gross margin, hours per site, top
staff by cost) for a specific date window.

Industry benchmarks for QSR/cafes:
- Healthy labour cost: 25-30% of revenue (>35% = critical)
- Healthy food cost: 28-32% of revenue (>35% = critical)
- Healthy gross margin (revenue - labour - food): 35%+ (negative = critical)

Your job: return a JSON object with concise, actionable insights. NEVER invent
numbers — only reason from the data provided. Use British English (e.g. "labour"
not "labor", "£" for currency). Keep each bullet under 20 words.

Return ONLY valid JSON in this exact shape (no markdown, no prose):
{
  "headline": "One punchy sentence summarising overall business health",
  "health_score": 0-100,
  "health_label": "Excellent" | "Strong" | "Healthy" | "At risk" | "Critical",
  "strengths": ["...", "..."],
  "risks": ["...", "..."],
  "actions": [
    {"priority": "high" | "medium" | "low", "title": "...", "detail": "...", "impact": "..."}
  ],
  "anomalies": ["Specific outliers or surprising patterns, if any"]
}
"""


def _cache_key(start_date: str, end_date: str, location_id: Optional[str], overview_digest: str) -> str:
    base = f"{start_date}|{end_date}|{location_id or 'all'}|{overview_digest}"
    return hashlib.sha256(base.encode("utf-8")).hexdigest()[:24]


def _summarise_for_llm(overview: dict) -> dict:
    """Trim the overview to the fields Claude actually needs. Keeps the prompt
    small (cost) and the model focused (quality)."""
    locs = []
    for loc in overview.get("by_location", []):
        # Keep only top 3 staff per location by cost — anything below that is
        # noise for a high-level analysis.
        top_staff = sorted(loc.get("staff_breakdown", []), key=lambda s: -s.get("cost", 0))[:3]
        locs.append({
            "name": loc.get("location_name"),
            "revenue": loc.get("revenue"),
            "labour": loc.get("labour"),
            "labour_pct": loc.get("labour_pct"),
            "est_food_cost": loc.get("est_food_cost"),
            "food_cost_pct": loc.get("food_cost_pct"),
            "gross_margin": loc.get("gross_margin"),
            "gross_margin_pct": loc.get("gross_margin_pct"),
            "hours": loc.get("hours"),
            "days_traded": loc.get("days"),
            "menu_recipe_coverage": loc.get("menu_coverage"),
            "top_staff_cost": [{"name": s["name"], "hours": s["hours"], "cost": s["cost"]} for s in top_staff],
        })
    return {
        "period": overview.get("period"),
        "kpi": overview.get("kpi"),
        "locations": locs,
    }


def _extract_json(text: str) -> dict:
    """Tolerate model output wrapped in ```json fences or with leading prose
    by hunting for the first/last brace pair before parsing."""
    s = text.strip()
    # Strip code fences
    if s.startswith("```"):
        s = re.sub(r"^```(?:json)?\s*", "", s)
        s = re.sub(r"\s*```$", "", s)
    # If still not pure JSON, find the outermost braces.
    if not s.lstrip().startswith("{"):
        m = re.search(r"\{.*\}", s, re.DOTALL)
        if m:
            s = m.group(0)
    return json.loads(s)


async def _generate_insights(overview: dict) -> dict:
    """Call Claude Sonnet 4.5 directly via the official Anthropic SDK.

    We deliberately use the official `anthropic` package (PyPI) rather than
    `emergentintegrations` so production (Railway) — which doesn't have access
    to the private Emergent package index — works the same as the dev env."""
    from routes.ai_settings import get_active_ai_key, get_active_ai_provider
    api_key = get_active_ai_key()
    if not api_key:
        raise HTTPException(
            500,
            "AI insights unavailable: no API key configured. Open Admin → AI Settings to add one.",
        )
    provider = get_active_ai_provider()

    import anthropic
    client = anthropic.Anthropic(api_key=api_key)

    payload = _summarise_for_llm(overview)
    user_text = (
        "Analyse the following Jolly's Kafe BI data window and return your JSON. "
        "Focus on: where money is being made/lost, labour vs food-cost imbalance, "
        "underperforming sites, and the 3-5 highest-impact actions a manager can "
        "take this week.\n\n"
        f"DATA:\n{json.dumps(payload, indent=2)}"
    )

    # Catch every exception so the real cause (invalid key, rate limit, network)
    # is surfaced to the admin instead of a bare 500.
    try:
        msg = client.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=2048,
            system=_AI_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_text}],
        )
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        import logging
        logging.exception("BI AI insights LLM call failed")
        snippet = (str(e) or e.__class__.__name__).splitlines()[0][:240]
        raise HTTPException(502, f"AI provider error ({provider}): {snippet}")

    full = ""
    for block in (msg.content or []):
        if getattr(block, "type", "") == "text":
            full += getattr(block, "text", "")
    full = full.strip()
    if not full:
        raise HTTPException(502, "AI provider returned an empty response")

    try:
        return _extract_json(full)
    except json.JSONDecodeError as e:
        raise HTTPException(502, f"AI returned non-JSON response: {e}")


@router.get("/ai-insights")
async def bi_ai_insights(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    location_id: Optional[str] = Query(None),
    refresh: bool = Query(False, description="Bypass the 30-min cache"),
    user: dict = Depends(get_super_admin),
):
    overview = _compute_overview(start_date, end_date, location_id)

    # If there's literally no revenue in the window, skip the LLM call and
    # return a deterministic "no data" envelope so the page renders sanely.
    if not overview["kpi"]["total_revenue"]:
        return {
            "period": overview["period"],
            "insights": {
                "headline": "No sales data in this window.",
                "health_score": 0,
                "health_label": "No data",
                "strengths": [],
                "risks": ["No daily sales entries logged for this period."],
                "actions": [{
                    "priority": "high",
                    "title": "Log daily sales",
                    "detail": "Staff should be filling in Daily Sales each evening — empty windows make BI useless.",
                    "impact": "Unlocks BI, labour cost, and food cost analysis for this period.",
                }],
                "anomalies": [],
            },
            "cached": False,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    # Cache key derives from the overview digest so any data change busts it.
    digest = hashlib.sha256(
        json.dumps(_summarise_for_llm(overview), sort_keys=True).encode("utf-8")
    ).hexdigest()[:16]
    key = _cache_key(overview["period"]["start_date"], overview["period"]["end_date"], location_id, digest)

    if not refresh:
        cached = ai_cache.find_one({"key": key}, {"_id": 0})
        if cached:
            try:
                gen_at = datetime.fromisoformat(cached["generated_at"])
                if datetime.now(timezone.utc) - gen_at < AI_CACHE_TTL:
                    return {**cached, "cached": True}
            except Exception:
                pass

    insights = await _generate_insights(overview)
    record = {
        "key": key,
        "period": overview["period"],
        "location_id": location_id,
        "insights": insights,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    ai_cache.update_one({"key": key}, {"$set": record}, upsert=True)
    return {**{k: v for k, v in record.items() if k != "_id"}, "cached": False}
