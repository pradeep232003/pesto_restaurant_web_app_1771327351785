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

### Compliance Print & Preview Fixes (Feb 2026) - VERIFIED
- **Print Report** now renders in **A4 landscape** with `@page { size: A4 landscape; margin: 12mm }` so the full 9-check compliance matrix fits on one row. Each per-site detailed breakdown table now starts on its own page (`page-break-before: always` on `.print-site-page`), giving EHO inspectors a clean, one-page-per-location printout. Color retention enforced via `-webkit-print-color-adjust: exact`.
- **Preview PDF** button now uses `API_BASE_URL`-prefixed fetch (exported from `/app/frontend/src/lib/api.js`) instead of bare relative URL — fixes the button on www.jollyskafe.com production where frontend and backend are on different hosts. Blob is opened via an anchor-click (`target=_blank`) to bypass popup blockers; blob URL revoked after 30 s.

### JKHive Mobile Hub + Routine Temp Wizard (Feb 2026) - VERIFIED
- New mobile-first PWA hub at `/jkhive` with iOS-style aesthetic (glass footer, squircle tiles), four tabs: Intelligence, Routines, Workforce, Manager. Wrappers reuse existing admin pages; each admin page sniffs `useLocation().pathname.startsWith('/jkhive')` to hide desktop sidebar and render mobile headers.
- **Routine Temp Wizard** (`/app/frontend/src/pages/jkhive/RoutineTempWizard.jsx`): step-per-fridge gauge wizard for opening + closing routines. Draggable semicircle SVG gauge, +/- 0.1°C pill buttons, manual numeric input (mobile keyboard supports negatives). Per-unit `skip_periods` array (set in Routine Units admin) lets specific units (e.g. Display Chiller) skip closing routine.
- **Layout reorder (May 2026)**: +/- pill buttons + numeric input now render **above** the gauge (per user IMG_6666 spec); recommended-range hint sits below the gauge.
- Excel exports via `xlsx` for Daily Sales (per-location sheets + staff hours + staff totals). Staff Table CRUD admin page with auto-fill `Cash Taken By` / `Staff Name` combo-boxes powered by `StaffPicker`.

### JKHive Cooking & Cooling Wizard (May 2026) - VERIFIED
- New 5-step wizard for the EHO "cooked-then-cooled" log, accessible from `/jkhive/cooking-cooling` (Routines tab). The "Temp Log" tile was removed from `Routines.jsx` to make space.
- **Backend** (`/app/backend/routes/cooking_cooling.py`): two collections — `cooking_cooling_logs` (one per cooling session) and `cooking_cooling_custom` (per-location custom items). Endpoints: `GET /catalog`, `POST /catalog`, `GET /active-count`, `GET ""`, `POST /start`, `GET /{id}`, `PATCH /{id}/complete`, `DELETE /{id}`. Default catalog is hard-coded with 16 categories (Beef, Chicken, Eggs, Fish (other), Flat Fish, Game, Lamb, Milk, Molluscs, Pastry, Pork, Rice And Grains, Round Fish, Salad, Turkey, General) each with 3-12 items and a category emoji icon.
- **Frontend** (`/app/frontend/src/pages/jkhive/cooling/`):
  - `CoolingHome.jsx` — list currently-cooling items with start temp + elapsed time; sticky "Add new cooling" button.
  - `CoolingPickItem.jsx` — search box, alphabetised category accordion with star-favourites (sorted to top via localStorage), 3-col grid of item tiles with category emoji + per-category "Add Custom" inline form.
  - `CoolingStartTemp.jsx` — Set Current Temp gauge (red, 0-100°C, default 75°C), Begin Cooling.
  - `CoolingRecordTemp.jsx` — Record Cooled Temperature gauge (blue, 0-30°C, ticks 0/6/12/18/24/30, default 5°C), recommended-range hint turns green/red against the log's `target_temp_c`, Next.
  - `CoolingComment.jsx` — optional 250-char comment, Submit Record → green-check confirmation card.
- **Tile badge** — `Tile.jsx` now accepts a `badge` and `badgeColor` prop. On Routines, the badge colour ticks live: **blue** while every item is < 75 min old, **orange** while any item is 75-90 min, **red** as soon as any item is ≥ 90 min.
- **Soft 90-min cooling timer** (`/app/frontend/src/pages/jkhive/cooling/cooling_alarms.js`): tapping **Begin Cooling** requests `Notification` permission and schedules two local alerts via `setTimeout` — "15 min left" at 75 min and "OVERDUE" at 90 min. Notified-set persisted in localStorage, reconciled on every CoolingHome / Routines mount so timers re-attach after reload within the session. On submit, alarms are cleared. CoolingHome cards show a coloured left-border + status pill ("On track" / "Hurry — 15 min" / "OVERDUE") that ticks every 30 s.

### JKHive Web Push (May 2026) - VERIFIED
- True background notifications for cooling alarms, fired by the server even when the JKHive PWA is closed / device asleep.
- **Backend**: `routes/push.py` (`pywebpush 2.3.0` + `py-vapid`) with VAPID keys stored in `backend/.env` (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`). Endpoints: `GET /api/push/vapid-public-key`, `POST /api/push/subscribe`, `POST /api/push/unsubscribe`, `POST /api/admin/push/test`. Subscriptions stored in `push_subscriptions` Mongo collection keyed by endpoint, scoped to `location_id`. Dead subs (HTTP 404/410) are auto-purged.
- **Cooling alarm sweep** (`run_cooling_alarm_sweep`) — APScheduler `IntervalTrigger(seconds=60)`. Iterates cooling-status logs, fires `warn` push at age ≥ 75 min and `over` push at ≥ 90 min, idempotent via `alerts_sent` array on each log.
- **Service Worker** (`/app/frontend/public/cooling-sw.js`): handles `push` (renders system notification with vibrate + requireInteraction + apple-touch-icon badge) and `notificationclick` (focuses any open JKHive tab and posts an in-SPA navigation message; otherwise opens `/jkhive/cooking-cooling`). Layout.jsx subscribes to that message bridge so navigation stays SPA-native.
- **Frontend register** (`/app/frontend/src/pages/jkhive/cooling/webpush.js`): `ensurePushSubscribed(locationId)` registers `/cooling-sw.js`, requests permission, subscribes via `pushManager.subscribe({applicationServerKey: VAPID})`, and POSTs the subscription. Called from CoolingStartTemp on **Begin Cooling**, plus a "Turn on background alerts" pill on CoolingHome that doubles as a status indicator (enabled / blocked / iOS-needs-PWA-install).
- **iOS handling**: `pushSupported()` returns `false` if running on iOS without standalone PWA (Safari requirement). The CoolingHome pill in that case prompts the user to "Add to Home Screen".
- Verified: VAPID public key endpoint serves the key; SW served with `application/javascript`; sweep marked `alerts_sent=['warn']` for an 80-min-old log and `['warn','over']` for a 95-min-old log; second sweep was idempotent (no duplicate fires); pywebpush successfully encrypted payloads and posted to dummy endpoints.
- **Cross-site safety** — every wizard screen uses a `WizardHeader` showing **location name** + **date** so staff working at multiple sites cannot misfile a record.
- End-to-end flow verified by screenshot: pick Beef (Brisket) → 75°C start → Begin Cooling → routines tile shows "1" badge → tap "Tap to record" → 5°C → Next → comment → Submit Record → "Record saved!".

### JKHive Deliveries Wizard (May 2026) - VERIFIED
5-step iOS wizard at `/jkhive/delivery-records` for goods-in temperature logging, mirroring the Cooking/Reheating/Cooked patterns. Supports per-location supplier list with 8 supplier types (general, fishmonger, butcher, greengrocer, bakery, wine merchant, alcohol supplier, other).

**No-Delivery audit trail (May 2026)**: Added a secondary "📅 No deliveries today" outlined pill underneath the primary "+ Add new delivery" pill on `DeliveriesHome.jsx`. Posts to `POST /api/admin/deliveries/no-delivery` (idempotent per-location-per-day — a 2nd call returns the existing record). Backend stores `kind: "no_delivery"` with `item_name: "No deliveries received"`, `temp_c: null`, `chilled_pass/frozen_pass: null`. Home renders the row with 🚫 icon + grey "NO DELIVERY" badge + "Logged by {name} · {time}" subtitle. After a no-delivery is logged the "Add new delivery" pill greys-out (and vice versa) so staff can't have both states for the same day. Curl + mobile Playwright E2E verified.
- **Backend** (`/app/backend/routes/deliveries.py`): two collections — `delivery_suppliers` (location-scoped) and `delivery_records`. Endpoints: `GET/POST/DELETE /api/admin/deliveries/suppliers[/{id}]` + `GET/POST/DELETE /api/admin/deliveries[/{id}]`. Each record auto-computes `chilled_pass` (temp_c ≤ 8°C) and `frozen_pass` (temp_c ≤ -18°C). Supplier name denormalised onto each record at write time.
- **Frontend** (`/app/frontend/src/pages/jkhive/deliveries/`): `DeliveriesHome.jsx` (today's records with CHILLED OK / FROZEN OK / OUT OF RANGE pills + delete) → `PickSupplier.jsx` (3-col grid + Add Supplier tile) → `AddSupplier.jsx` (name + 8-option type select + optional info) → `PickItem.jsx` (reuses cooking-cooling catalog with search + ⭐ favourites) → `RecordTemp.jsx` (semicircular gauge -25°C to +15°C, default 5°C, ticks at -25/-17/-9/-1/7/15, with both Chilled/Frozen recommended-range tick indicators) → `CommentSubmit.jsx` (250-char comment + Submit + green confirmation card).
- **Tile badge**: Routines page Deliveries tile shows live "today's records" count (blue) refreshed every 60 s.
- Verified: 16/16 backend pytest + full mobile (414×896) E2E walkthrough (login → dismiss location sheet → add supplier → record 4°C chicken delivery → CHILLED OK pill + delete row → tile badge increments to 1).

### JKHive Washer Temps Wizard (May 2026) - VERIFIED
4-step iOS wizard at `/jkhive/washer-temps` for dishwasher / glasswasher cycle temperature logging, mirroring the screenshots IMG_6719–IMG_6722. UK FSA thresholds: Wash ≥ 55 °C, Rinse ≥ 81 °C, `passed` = both.
- **Select Washer** (`PickWasher.jsx`): centred "Select Washer" title, 3-col grid of washer tiles (🚿 + name + tiny `i` edit pill) with `+ Add Washer` tile.
- **Wash cycle** (`WashTemp.jsx`): header "Record Washer Temperatures", large left-aligned headline "Temperature during wash cycle:", `−`/`55.0 °C`/`+` stepper, semicircular gauge 45–90 °C with ticks 45/54/63/72/81/90, knob green when ≥ 55 / red below, "Recommended range: 55°C or higher", floating black pill `Next`.
- **Rinse cycle** (`RinseTemp.jsx`): same chrome, headline "Temperature during rinse cycle:", default 85 °C, ticks 70/74/78/82/86/90, knob green when ≥ 81, "Recommended range: 81°C or higher", redirects back to /wash if state missing.
- **Comment & Submit** (`CommentSubmit.jsx`): blue speech-bubble icon + "Add a comment?" + "(This is optional)" + textarea + black pill `Submit Record` → green/red pass-card showing both ✓/✗ temps.
- **Backend** (`/app/backend/routes/washers.py`): `POST /api/admin/washers/checks` auto-computes `wash_pass` (≥55), `rinse_pass` (≥81), `passed = both`. `washers` registry has full CRUD; 404 on unknown washer_id.
- Verified: full mobile Playwright E2E (Select Washer → Wash 55°C → Rinse 85°C → Submit Record → Done card with both ✓ ticks).

### JKHive Specialist Routines (May 2026) - VERIFIEDFour new specialist food-safety workflows under `/jkhive/routines/more`, each following the same Home → Pick (shared catalog) → Record + Submit + result card pattern, reusing the existing `/api/admin/cooking-cooling/catalog` endpoint (Fresh / Frozen / Dry / Prepared / Beverages) via a new `SpecialistCatalogPicker` component at `/app/frontend/src/pages/jkhive/_shared/CatalogPicker.jsx`.

1. **Food Acidity (pH)** — `/jkhive/acidity` · backend `/api/admin/acidity` · collection `acidity_records` · **3-step iOS wizard** matching IMG_6723–IMG_6725: (1) "Record Food Acidity" item picker (search + ⭐ favourite categories + reusable shared catalog), (2) "Record Food Acidity" gauge page — item icon + name centered, `−`/`7.0`/`pH`/`+` stepper, semicircular gauge 0–14 with ticks 0/2.8/5.6/8.4/11.2/14 (no degree symbol via new `tickSuffix=""` prop on `TempGauge`), green knob when ≤ 4.6 / red above, "Next" pill, (3) "Add a comment? (This is optional)" speech-bubble + textarea + "Submit Record" pill → green/red pass card. Pass when `ph_value ≤ 4.6` (FSA acidified-foods rule).
2. **Vacuum Packing** — `/jkhive/vacuum-packing` · backend `/api/admin/vacuum-packing` · collection `vacuum_records` · pack-temp gauge -5–15 °C default 3 °C + use-by date input (required, default +5 days) + optional batch label · pass when `pack_temp ≤ 5` AND a use-by date is supplied.
3. **Food Washing** — `/jkhive/food-washing` · backend `/api/admin/food-washing` · collection `washing_records` · **4-step iOS wizard** matching IMG_6732–IMG_6736: (1) "Chemical Food Washing" item picker, (2) chemical chooser (Chlorine/ppm vs Acid Wash/pH cards), (3) strength gauge — chlorine 100–200 ppm with default 150 (ticks 100/120/140/160/180/200, pass band 50–200 ppm) OR acid 0–3 pH default 2.0 (ticks 0/0.6/1.2/1.8/2.4/3, pass band 0.5–3.0 pH), (4) optional comment + Submit Record. Floating bottom-right "+ New Record" pill on home. `TempGauge` now colours all ticks ≤ value in the active colour for clearer sweep indication.
4. **Sous Vide** — `/jkhive/sous-vide` · backend `/api/admin/sous-vide` · collection `sousvide_records` · **Two-phase iOS wizard**:
   - **Start phase** (5 steps, IMG_6738–6742): Pick item → Pre-cooked/Raw chooser → wheel-picker batch count 1–99 → water-bath temperature gauge 45–100 °C (ticks 45/56/67/78/89/100, knob green when ≥ min-temp) → twin-wheel hours 0–24 + minutes 0–59 → "Start sous vide" creates an `active` session.
   - **Home dashboard** (IMG_6746): Shows each `active` session as a large white card with Items in batch · Initial water temperature (red if below min) · Start time · Intended duration · **Current duration** ticking up every second (DOM-mutation pattern, iOS Safari safe). Each card has a red trash button + a `COMPLETE` link; bottom-right floating pill is `+ Add record`.
   - **Complete phase** (4 steps, IMG_6747–6750): Tap `COMPLETE` → "Enter final core temperature" gauge → "Is this item being served or cooled?" two-card chooser → "Starting Temperature: 49.1 °C" carry-forward review screen → "Add a comment?" optional textarea → `Submit Record` patches the session to `complete` with `final_core_temp`, `served_or_cooled`, `completion_comment`. Recently completed sessions appear as compact rows below active cards.
   - Pass logic at start: pre-cooked bath ≥ 63 °C, raw bath ≥ 54 °C, duration > 0. Endpoints: `GET ?status=active|complete`, `POST` (start), `PATCH /{id}/complete`, `DELETE /{id}` — re-completion returns 400.

- **Wired**: `MoreRoutines.jsx` Food Acidity (#30B0C7), Vacuum Packing (#007AFF), Food Washing (#32ADE6), Sous Vide (#AF52DE) tiles all routed (no longer Coming Soon). 12 new routes under JKHive layout.
- Verified: 18/18 backend pytest (CRUD, pass/fail logic, `_id` excluded, 401/403 unauth, 404 unknown delete, sanitiser-specific PPM bands) + main-agent mobile Playwright E2E for Acidity (Alcopops (WKD) · pH 4.00 → "Within range" pass card) + Sous Vide home render confirmed. Vacuum/Washing share identical pattern.

### JKHive Legionella Wizard (May 2026) - VERIFIED
5-step iOS wizard at `/jkhive/legionella` for the weekly Legionella water-safety test, reusing the existing `/api/admin/legionella` backend (collection `legionella_entries`).

- **Home** (`LegionellaHome.jsx`): Recent test rows with droplet icon + outlet name + "hot 55.0°C · cold 15.0°C" + PASS/FAIL pill + delete; floating bottom-right `+ Add record` pill.
- **Pick outlet** (`LegionellaPickOutlet.jsx`): "Which water outlet?" — quick-pick chips of recent outlets at this location (deduped from history) + free-text input for new outlets. No separate registry collection needed.
- **Hot water temp** (`LegionellaHotTemp.jsx`): 🔥 + outlet subtitle + °C stepper + gauge 20–80 °C with ticks 20/35/50/65/80, knob green when ≥ 50 °C. "Recommended: ≥ 50 °C within 1 min of running."
- **Cold water temp** (`LegionellaColdTemp.jsx`): ❄️ + gauge 0–30 °C with ticks 0/8/16/20/24/30, knob green when ≤ 20 °C. "Recommended: ≤ 20 °C within 2 min of running."
- **Comment & Submit** (`LegionellaCommentSubmit.jsx`): Summary card (outlet + hot/cold ✓/✗), required `Action taken` textarea **only when failing**, optional comment + "Submit Record" pill. POSTs to `/api/admin/legionella` with `date`, `test_time`, `hot_water_temp`, `cold_water_temp`, `location_of_test`, `action_taken`, `name`, `initials` (auto-derived from logged-in user). Backend computes `passed` server-side. Done card shows green/red status + per-axis ✓/✗.
- **Wired**: `MoreRoutines.jsx` Legionella tile (#30B0C7) now routes to `/jkhive/legionella` (was `/admin/legionella`). 5 new routes under JKHive layout.
- Verified: Mobile Playwright E2E (login → /jkhive → routines → more → Legionella → Add record → Kitchen hot tap → hot 55 °C → cold 15 °C → Submit → "Test passed" card with both ✓ ticks).

## Prioritized Backlog

### P1 (High)
- Stripe integration for card top-ups

### P2 (Medium)
- Kitchen display board (auto-updating orders on screen)
- Bulk resident import/export

### P3 (Low)
- Multiple admin users with roles (DONE - role system implemented)
- Loyalty rewards program
