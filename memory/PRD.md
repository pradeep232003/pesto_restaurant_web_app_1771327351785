# Pesto Restaurant Web App (Jolly's Kafe) - PRD

## Original Problem Statement
Full-stack restaurant management app with MongoDB, admin CRUD, authentication, resident prepaid wallets, menu image management, dual pricing, online ordering (collection only), order notifications, and per-site ordering controls.

## Architecture
- **Frontend**: React 18 + Vite + TailwindCSS + Framer Motion
- **Backend**: FastAPI + MongoDB + JWT Auth + httpx (Google API)
- **Image Processing**: Pillow (400x400 auto-thumbnails)
- **Auth**: Cookie-based JWT + localStorage Bearer token fallback + Custom Google OAuth (popup flow) + Email OTP verification
- **Email**: Gmail SMTP (smtplib) for contact/newsletter
- **SEO**: Dynamic SSR simulation via backend meta tag injection + auto-generated sitemap
- **Roles**: super_admin > admin > staff > customer

### Backend Structure (Modularized)
```
/app/backend/
├── server.py          (App init, CORS, routers, startup seed, SEO catch-all)
├── seo.py             (Sitemap generator, meta tag injector, JSON-LD)
├── db.py              (MongoDB connection & collections)
├── models.py          (All Pydantic models)
├── auth.py            (JWT, password, brute force, role-based auth deps)
├── helpers.py         (serialize_doc, serialize_user)
├── routes/
│   ├── auth.py        (/api/auth/*)
│   ├── locations.py   (/api/locations + /api/reviews + /api/admin/locations)
│   ├── menu.py        (/api/menu-items + /api/admin/menu-items + /api/images)
│   ├── residents.py   (/api/admin/residents + transactions + balance-summary)
│   ├── customers.py   (/api/customer/* + Google OAuth)
│   ├── orders.py      (/api/orders + /api/site-status + /api/admin/orders)
│   ├── settings.py    (/api/admin/site-settings)
│   ├── contact.py     (/api/contact + /api/subscribe)
│   ├── users.py       (/api/admin/users - user management)
│   ├── sales.py       (/api/admin/daily-sales - daily sales data)
│   └── seo.py         (Sitemap & meta tag utilities)
├── tests/
│   ├── test_seo.py
│   └── test_users_and_sales.py
```

## Implemented Features

### Core (Jan 2026)
- MongoDB migration, 5 locations, 28 seeded menu items
- Full admin CRUD for menu items with JWT auth
- Resident prepaid wallet system

### Menu Management (Feb 2026)
- Image upload with auto-thumbnail generation
- Show/hide image toggle, dual pricing

### Online Ordering System (Feb 2026)
- Customer registration/login, cart, order submission (collection only)
- Order status flow and tracking

### Site Ordering Controls (Feb 2026)
- Per-site opening hours, auto/manual scheduling

### Dynamic Locations & Wallet Toggle (Mar 2026)
- Location CRUD from admin panel, wallet_enabled toggle per location

### Apple-Inspired Redesign (Mar 2026)
- Outfit font, monochrome palette, cinematic hero, bento grid, glass-morphism

### Customer Auth + Google OAuth (Mar 2026)
- Custom popup-based Google OAuth flow
- Registration with email OTP verification

### Google Reviews Integration (Mar 2026)
- Admin: Google Place ID + API Key per location
- Dynamic carousel on homepage

### Backend Modularization (Mar 2026)
- Refactored server.py into modular /routes/ structure

### Timperley & Cheshire Menu Migration (Apr 2026)
- 106 categorized Timperley items, 48 Cheshire items per location

### Gmail SMTP Integration (Apr 2026)
- Contact Us form and Newsletter via Gmail SMTP

### SEO Optimization (Apr 2026) - VERIFIED
- Dynamic SSR meta tag injection per route
- Auto-generated /sitemap.xml (11 URLs)
- Location landing pages with JSON-LD schema
- 53 backend + 3 frontend tests passed

### User Management & Daily Sales (Apr 2026) - VERIFIED
- **User Management** (`/admin/users`): Super admin can view all 28+ registered customers, search by name/email/phone, change roles (customer/staff/admin). Stats cards show totals. Role promotion creates admin panel access.
- **Daily Sales** (`/admin/daily-sales`): Entry tab with location picker, date, sales fields (Sales, Float, Cash Taken, Cash Taken By), and dynamic Staff Hours rows (name with autocomplete, start/end times). History tab (admin/super_admin only) with location + date range filters, expandable entries showing all details, delete capability.
- **Role hierarchy**: super_admin sees Users nav item; admin sees History tab; staff sees Entry tab only.
- Backend: 15/15 tests passed. Frontend: save flow, history, role changes all verified.

### Daily Checks (Feb 2026) - VERIFIED
- **Daily Checks** (`/admin/daily-checks`): 15-item opening checklist digitized from physical form. Mobile-first UI staff use before serving — tap each item to pass/fail, pass counter live updates (X/15), quick "All Pass" and "Clear" actions, optional notes field. Same (location, date) upserts (no duplicates).
- **History tab** (admin+): expandable list showing per-item pass/fail detail for any saved entry.
- **Overview tab** (admin+): month x location grid with color-coded cells (green=all passed, orange=partial, red=missing) for compliance tracking.
- Sidebar link + dashboard quick action tile wired. Backend 6/6 pytest + frontend E2E all passed.

### Daily Checks — Item Management (Feb 2026) - VERIFIED
- Checklist items migrated from hardcoded constant to MongoDB collection `daily_check_items` (seeded with 15 defaults on first boot; fixed IDs preserve back-compat with prior submissions).
- **Manage tab** (admin-only, no location required): add / edit / delete items. Each item has scope = **Global** (applies everywhere) OR **Specific Location**. Scope shown via Globe/MapPin badge.
- Check tab dynamically loads items for the selected location (global + location-specific), so per-site checklists work out of the box.
- Submissions now store `items_snapshot` — history renders correctly even after items are edited/deleted later.
- Backend 11/11 pytest + frontend E2E (mobile + desktop) all passed.

### Kitchen Closedown Checks (Feb 2026) - VERIFIED
- **Kitchen Closedown** (`/admin/kitchen-closedown`): End-of-day checklist digitized from the physical "Kitchen Closedown Checks" form. 9 default items seeded (weekly cleaning sign-off, food covered/labelled, waste removed, fridge temps recorded, appliances off, extraction off, out-of-date food discarded, prep areas disinfected, floors swept).
- Same feature set as Daily Checks: Check / History / Overview / Manage tabs; per-location item scope; upsert behaviour; items_snapshot stored on each submission.
- Fully independent from Daily Checks — separate Mongo collections (`kitchen_closedown`, `kitchen_closedown_items`), separate API namespace (`/api/admin/kitchen-closedown`), cross-contamination test passes.
- Sidebar link (Power icon) + dashboard quick-action tile (purple, lg:grid-cols-4). Backend 12/12 pytest + frontend E2E all passed.

### Food Safety Log Forms (Feb 2026) - VERIFIED
Four log-entry style admin pages digitizing physical food-safety forms. Each has location selector, date range filter, "New Entry" inline form, card list of entries with auto-computed pass/fail indicator (green check / red X) and admin-only delete. Shared backend pattern: POST create → GET list (with filters) → DELETE by id (admin only).
- **Cooked & Reheated Temp** (`/admin/cooked-temp`, Flame icon): food_item, cooking_method (Combi/Grill/Microwave/Oven/Stove/Fryer/Bain-Marie/Other), temp_c, time, initials. Pass = temp ≥ 75°C. Initials auto-fill from logged-in user's name.
- **Delivery Records** (`/admin/delivery-records`, Truck icon): supplier, invoice_number, food_frozen_temp, food_chilled_temp, quality_comments. Pass = frozen ≤ -15°C AND chilled ≤ 8°C.
- **Probe Calibration** (`/admin/probe-calibration`, Gauge icon): probe_no, tested_by, cold_temp, hot_temp, comments. Pass = |cold - 0| ≤ 1 AND |hot - 100| ≤ 1.
- **Legionella Water Testing** (`/admin/legionella`, Droplet icon): test_time, hot_water_temp, cold_water_temp, name, initials, location_of_test, action_taken. Pass = hot > 50°C AND cold < 20°C.
- All 4 pages have: Today/History tabs (admin-only History with date-range + Excel `.xlsx` download), back-to-dashboard link, dashboard quick-action tile.
- Backend 18/18 pytest passed.

### Cleaning Schedules (Feb 2026) - VERIFIED
Two new admin pages digitizing the physical "Daily Cleaning" and "Weekly Deep Cleaning" forms.
- **Daily Cleaning** (`/admin/daily-cleaning`, cyan Sparkles): 18 seeded items (FRIDGE, FREEZER, SURFACES, GRILL, FRYER, MICROWAVE, COFFEE MACHINE, OVEN/HOB, POTS/PANS, HAND CONTACT, SINKS, TAPS, RUBBISH BIN, FLOOR, DUST PAN, TIN OPENERS, STOOLS/FAN, STAIRS).
- **Weekly Deep Cleaning** (`/admin/weekly-cleaning`, purple Sparkles): 7 seeded items (RUBBISH BIN, FRIDGE/FREEZER, SHELVES/WALL, FRYER, MICROWAVE, OVEN/HOB, CEILING).
- Each item: name, frequency (EOS/CAYG/AM/WEEKLY), method description, chemical. Schedule tab = 7-day tick-box grid (Mon-Sun) with upsert per (location, week_ending). Manage Items tab (admin) allows add/edit/delete with Global or Specific-Location scope. Back-to-dashboard link.
- Backend factory pattern (1 shared module → 2 routers). Collections: `daily_cleaning_items/logs`, `weekly_cleaning_items/logs`.

### Food Safety Compliance Dashboard (Feb 2026) - VERIFIED
Admin-only (/admin/compliance) EHO-ready compliance matrix aggregating all 9 food-safety checks across every site.
- **Backend**: `GET /api/admin/compliance?start_date=X&end_date=Y[&location_id=Z]` returns `{overall_pct, sites:[{location_id, location_name, compliance_pct, checks:{9 keys}}], check_types}`. Each check computes coverage `actual_periods/expected` (daily cadence = days in range; weekly cadence = distinct ISO weeks), status = complete/partial/overdue/missing, last_date, last_by. Status weighting: complete=1, partial=0.5, else 0. Drill-down: `/api/admin/compliance/detail` returns full entry list.
- **Frontend**: Matrix table (sites × 9 checks) with colored status pills (green/orange/red/gray), per-site score chip, overall % KPI. Filters: date range, site, check type, status. Click cell → side drawer with full entries. Dashboard widget card (admin-only) showing last-7-day overall % + top-5 sites. Sidebar link (Shield icon) admin+ only. **Print Report** button uses browser `window.print()` with `.print:hidden` / `.print:block` toggles — print view shows one summary table per site (Check / Status / Coverage / Last Record / Completed By) suitable for EHO inspections.
- Backend 39/39 pytest passed. Frontend 100% E2E including non-admin redirect, filter combinations, drill-down, and print layout.

### Weekly Compliance Digest Auto-Email (Feb 2026) - VERIFIED
Automated Monday-morning email digest of the previous week's compliance matrix to all admin/super_admin recipients.
- **Backend**: `/app/backend/routes/compliance_digest.py` uses **reportlab** (landscape A4) to generate a multi-page PDF — page 1 is the colored site × 9-check matrix with overall %, subsequent pages contain per-site detailed breakdown tables (EHO audit-ready). **APScheduler** BackgroundScheduler registered on startup with CronTrigger (day_of_week=mon, hour=7, minute=0, tz=Europe/London). Recipients union-queried from both `users_collection` and `customers_collection` where role ∈ {admin, super_admin}.
- **Endpoints** (all admin-gated): `POST /api/admin/compliance-digest/send-now` (manual trigger), `GET /recipients`, `GET /preview-pdf` (returns inline PDF).
- **Frontend**: /admin/compliance page has "Preview PDF" and "Email Digest Now" buttons + "Auto-sent every Monday 07:00 UK" note. `import.meta.env.VITE_REACT_APP_BACKEND_URL` pattern used (Vite-compatible).
- Dependencies added: reportlab, APScheduler, tzlocal (in both `requirements.txt` and `requirements-prod.txt`).
- Backend 9/9 pytest passed. Live SMTP send verified. Iteration 25 Preview-PDF env-var bug fixed.

## Prioritized Backlog

### P1 (High)
- Stripe integration for card top-ups

### P2 (Medium)
- Kitchen display board (auto-updating orders on screen)
- Bulk resident import/export

### P3 (Low)
- Multiple admin users with roles (DONE - role system implemented)
- Loyalty rewards program
