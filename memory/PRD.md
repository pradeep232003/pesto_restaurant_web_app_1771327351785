# Jolly's Kafe — Product Requirements (live)

## 1. Vision
Full-stack restaurant ops platform: Apple-inspired UX, multi-location, role-gated admin CRUD, mobile-first JKHive PWA hub for daily/weekly/monthly food-safety routines, dynamic compliance reporting, BI for labour/food/wastage, recipe→inventory auto-deduction.

## 2. Personas
- **Super Admin** — financial BI + AI insights, probe registry edits, calibration history admin
- **Admin (site)** — daily/weekly/monthly routines, staff, inventory, Inspection Mode
- **Staff** — execute routines on mobile

## 3. Recently completed
- BI dashboard (labour, food cost, wastage); recipe→inventory auto-deduction; staff `hourly_rate`
- JKHive Income & Expenses native wrappers with `?back=` deep links
- Weekly Check hub (Probes, Legionella, Weekly Checklist) with 3-state pills
- Compliance matrix transposed; drill-down modal mobile scroll fix
- Probe Calibration: admin history tab, date/site filter, edit/delete with audit stamps, admin-locked name edit, centred edit modal, **unique-per-location name enforcement**
- "0 probes ⇒ N/A" vs "probes registered but no calibration ⇒ Missing" gating
- Admin → Site Settings: **Weekly Check routines** toggles per location
- Weekly Check hub filters tiles by per-location `applicable_routines`
- **Weekly Checklist compliance** now uses union-coverage (mirrors hub: partial run ≠ 100%)
- **Inspection Mode** ("EHO-ready audit pack") — `/jkhive/inspection` admin page with date-range picker, compliance %, probes, calibrations, legionella, staff, templates, **document expiry tracking** (expired & expiring-soon), and Print/Save-PDF (A4 print CSS).
- **Documents** module — `/jkhive/documents` with GridFS storage, category filter, in-app preview, download, admin-only delete, **location picker on upload**, and per-document **expiry tracking** (Expired / Expiring / OK / N/A chips).
- **Sales Summary** revamp — Location filter (All sites + per-site), Recharts area/bar charts with D/W/M/Y granularity toggle, avg-per-bucket KPI, peak label, click-to-drill-down by location.
- **Business Intelligence + AI** (super admin only) — Manager tile no longer "Coming Soon"; `/admin/bi` page now leads with a Claude Sonnet 4.5 analysis panel: gradient hero (health score + label + headline), "What's working", "Risks to address", priority-tagged Recommended Actions, Anomalies, 30-min cache. Endpoint: `GET /api/admin/bi/ai-insights`.
- **Shift Management** — Mobile day-card list + admin Copy-last-week + Publish-week with push notifications; staff see only their published shifts.
- **Shift Management RotaCloud-style desktop grid** (Feb 2026) — `/jkhive/shifts` on `md:` and above renders a staff × week matrix with day headers (Mon→Sun) and a per-staff weekly hours column. Click an empty cell → inline popover with presets (Morning 8-14, Day 9-17, Evening 14-22, Close 17-23) + custom time + role. Click an existing block → opens full edit modal. **HTML5 drag-and-drop** to MOVE a shift across staff/date in one PATCH. Mobile keeps the optimised day-card list intact via `md:hidden` wrapper.
- **AI Suggest Rota** (Feb 2026) — purple "AI Suggest" button next to Copy-last-week. `POST /api/admin/shifts/ai-suggest-week` calls Claude Sonnet 4.5 (via httpx, same pattern as BI) with last 4 weeks of sales footfall, the staff roster (incl. new `weekly_hours_target` field), and recent shift history. Returns a proposed week's rota with a one-line reasoning summary. UI shows a per-day preview modal; "Apply" → `POST /api/admin/shifts/bulk-create` inserts as **drafts** so the manager can review and Publish. In-batch dedupe + clash skipping built in. Errors surfaced as HTTP 500 so JSON detail survives the preview ingress.

## 4. P0 Backlog
(none open)

## 5. P1 Backlog
- Click & Collect with WhatsApp Ordering — Phase 2/3 webhook + status page (blocked on Meta verification)
- Stripe card top-ups for loyalty (test keys available)
- JKHive "Coming Soon" tiles to activate next: HACCP Plan, Risk Assessments, Allergens (matrix), Clock In/Out, Payroll, Complaints, Safety Hotline, Food Wastage
- AI Marketing Strategy Hub — content autopilot, smarter ads, 24/7 replies, adaptive strategy (OpenAI + Meta)

## 6. P2 Backlog
- Apple/Google Wallet pass generation (blocked on user credentials)
- Kitchen display board
- Bulk resident import

## 7. Refactor
- `Routes.jsx` is large — split into nested route modules per feature area

## 8. Key invariants
- All compliance "applicability" must use the configuration source (e.g. probes registry), not historical records, to decide N/A vs Missing.
- `applicable_routines` array stores both daily AND weekly routine keys; expand "empty = all" using `ALL_ROUTINE_KEYS`.
- For checklist-runs-backed compliance, a period only counts as complete when the UNION of ticked indices across runs covers all visible items.
- `?back=` parameter for every JKHive sub-route to preserve native mobile back behaviour.
- Admin-only routes: `/api/admin/bi`, `/api/admin/bi/ai-insights`, `/api/admin/inspection/pack`, probe PATCH/DELETE, calibration PATCH/DELETE.
- Probe names unique per location (case-insensitive); enforced both server-side and pre-validated client-side.
- LLM responses cached for 30 min keyed on (period + filter + data digest); refresh button forces a re-run.
- All audit-pack views must have a `@media print` CSS block.
