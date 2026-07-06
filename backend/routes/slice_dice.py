"""
Slice & Dice — one-page operational + compliance drilldown across sites.

Admins pick one or many locations and a date window; we hit every
collection that matters and return a matrix keyed by (location, metric)
so the frontend can render a sortable pivot table without any extra
round-trips. Everything is READ-ONLY.
"""
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, Query

from db import (
    db, locations_collection, daily_sales_collection,
    daily_checks_collection, kitchen_closedown_collection,
    temp_logs_collection, daily_cleaning_logs_collection,
    daily_cleaning_items_collection, weekly_cleaning_logs_collection,
    weekly_cleaning_items_collection,
)
from auth import get_admin_user


router = APIRouter(prefix="/api/admin/slice-and-dice", tags=["slice-and-dice"])

invoices_collection = db["invoices"]
orders_collection = db["orders"]
shifts_collection = db["shifts"]
staff_collection = db["staff_members"]


def _num_days(start: str, end: str) -> int:
    try:
        s = datetime.strptime(start, "%Y-%m-%d")
        e = datetime.strptime(end, "%Y-%m-%d")
        return max(1, (e - s).days + 1)
    except Exception:
        return 1


def _date_iso(days_back: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days_back)).strftime("%Y-%m-%d")


@router.get("")
async def slice_and_dice(
    locations: Optional[str] = Query(None, description="Comma-separated location ids; blank = all active"),
    start: Optional[str] = Query(None, description="YYYY-MM-DD"),
    end: Optional[str] = Query(None, description="YYYY-MM-DD"),
    user: dict = Depends(get_admin_user),
):
    """Return one row per requested location with ops + compliance KPIs."""
    end_iso = end or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    start_iso = start or _date_iso(30)
    days = _num_days(start_iso, end_iso)

    # Location list
    loc_ids: List[str] = []
    if locations:
        loc_ids = [x.strip() for x in locations.split(",") if x.strip()]
    if not loc_ids:
        loc_ids = [doc["id"] for doc in locations_collection.find({"is_active": {"$ne": False}}, {"_id": 0, "id": 1})]

    loc_names = {
        doc["id"]: doc.get("name", doc["id"])
        for doc in locations_collection.find({"id": {"$in": loc_ids}}, {"_id": 0, "id": 1, "name": 1})
    }

    # Per-location aggregate. Small dataset — do one query per collection per site.
    rows = []
    for lid in loc_ids:
        # Sales — daily_sales stores {location_id, date (YYYY-MM-DD), sales}
        sales_docs = list(daily_sales_collection.find(
            {"location_id": lid, "date": {"$gte": start_iso, "$lte": end_iso}},
            {"_id": 0, "sales": 1, "cash_taken": 1},
        ))
        sales_total = round(sum(float(s.get("sales") or 0) for s in sales_docs), 2)
        sales_days = len(sales_docs)

        # Invoices — invoice_date OR uploaded_at fallback
        inv_docs = list(invoices_collection.find(
            {"location_id": lid, "invoice_date": {"$gte": start_iso, "$lte": end_iso}},
            {"_id": 0, "total": 1, "category": 1},
        ))
        inv_total = round(sum(float(d.get("total") or 0) for d in inv_docs), 2)
        stock_total = round(sum(float(d.get("total") or 0) for d in inv_docs if (d.get("category") or "") == "stock"), 2)

        # Orders (native POS)
        order_query = {
            "location_id": lid,
            "created_at": {"$gte": start_iso, "$lte": end_iso + "T23:59:59.999Z"},
            "status": {"$in": ["completed", "ready", "collected", "paid", "confirmed"]},
        }
        orders_count = orders_collection.count_documents(order_query)

        # Staff hours — sum shift.hours in window
        hrs_docs = list(shifts_collection.find(
            {"location_id": lid, "date": {"$gte": start_iso, "$lte": end_iso}},
            {"_id": 0, "hours": 1},
        ))
        total_hours = round(sum(float(h.get("hours") or 0) for h in hrs_docs), 1)

        # Compliance — daily checks. Consider the daily_checks doc a
        # "completed" day if it exists for that date.
        daily_check_days = daily_checks_collection.count_documents(
            {"location_id": lid, "date": {"$gte": start_iso, "$lte": end_iso}},
        )
        daily_check_pct = round(min(100.0, (daily_check_days / days) * 100.0), 1) if days else 0.0

        closedown_days = kitchen_closedown_collection.count_documents(
            {"location_id": lid, "date": {"$gte": start_iso, "$lte": end_iso}},
        )
        closedown_pct = round(min(100.0, (closedown_days / days) * 100.0), 1) if days else 0.0

        temp_logs_count = temp_logs_collection.count_documents(
            {"location_id": lid, "recorded_at": {"$gte": start_iso, "$lte": end_iso + "T23:59:59.999Z"}},
        )

        # Cleaning — daily items expected × days vs logs count.
        daily_clean_items = daily_cleaning_items_collection.count_documents(
            {"location_id": lid, "is_active": {"$ne": False}},
        )
        daily_clean_logs = daily_cleaning_logs_collection.count_documents(
            {"location_id": lid, "date": {"$gte": start_iso, "$lte": end_iso}},
        )
        daily_clean_pct = round(
            min(100.0, (daily_clean_logs / max(1, daily_clean_items * days)) * 100.0), 1
        ) if daily_clean_items > 0 else 0.0

        weekly_clean_items = weekly_cleaning_items_collection.count_documents(
            {"location_id": lid, "is_active": {"$ne": False}},
        )
        weekly_clean_logs = weekly_cleaning_logs_collection.count_documents(
            {"location_id": lid, "week_start": {"$gte": start_iso, "$lte": end_iso}},
        )
        expected_weeks = max(1, days // 7)
        weekly_clean_pct = round(
            min(100.0, (weekly_clean_logs / max(1, weekly_clean_items * expected_weeks)) * 100.0), 1
        ) if weekly_clean_items > 0 else 0.0

        # Overall compliance score — mean of the four sub-scores.
        subs = [daily_check_pct, closedown_pct, daily_clean_pct, weekly_clean_pct]
        overall = round(sum(subs) / len(subs), 1) if subs else 0.0

        # Labour % (approx) — assumes £11.50/hr avg if hourly_rate not on shift.
        est_wage = round(total_hours * 11.5, 2)
        labour_pct = round((est_wage / sales_total * 100.0), 1) if sales_total > 0 else 0.0

        rows.append({
            "location_id": lid,
            "location_name": loc_names.get(lid, lid),
            # Operations
            "sales_total": sales_total,
            "sales_days": sales_days,
            "invoices_count": len(inv_docs),
            "invoices_total": inv_total,
            "stock_spend": stock_total,
            "orders_count": orders_count,
            "staff_hours": total_hours,
            "est_wage": est_wage,
            "labour_pct": labour_pct,
            # Compliance
            "daily_check_pct": daily_check_pct,
            "closedown_pct": closedown_pct,
            "temp_logs_count": temp_logs_count,
            "daily_clean_pct": daily_clean_pct,
            "weekly_clean_pct": weekly_clean_pct,
            "compliance_score": overall,
        })

    # Totals row across all requested sites — bottom of the table.
    def _sum(k):
        return round(sum(r[k] for r in rows), 2)
    def _avg(k):
        return round(sum(r[k] for r in rows) / len(rows), 1) if rows else 0.0

    totals = {
        "location_id": "__TOTAL__",
        "location_name": f"Total ({len(rows)} sites)",
        "sales_total": _sum("sales_total"),
        "sales_days": _sum("sales_days"),
        "invoices_count": _sum("invoices_count"),
        "invoices_total": _sum("invoices_total"),
        "stock_spend": _sum("stock_spend"),
        "orders_count": _sum("orders_count"),
        "staff_hours": _sum("staff_hours"),
        "est_wage": _sum("est_wage"),
        "labour_pct": round((_sum("est_wage") / _sum("sales_total") * 100.0), 1) if _sum("sales_total") > 0 else 0.0,
        "daily_check_pct": _avg("daily_check_pct"),
        "closedown_pct": _avg("closedown_pct"),
        "temp_logs_count": _sum("temp_logs_count"),
        "daily_clean_pct": _avg("daily_clean_pct"),
        "weekly_clean_pct": _avg("weekly_clean_pct"),
        "compliance_score": _avg("compliance_score"),
    }

    return {
        "period": {"start": start_iso, "end": end_iso, "days": days},
        "location_ids": loc_ids,
        "rows": rows,
        "totals": totals,
    }
