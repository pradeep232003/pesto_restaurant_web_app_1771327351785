# Jolly's Kafe — Product Requirements (live)

## 1. Vision
Full-stack restaurant ops platform: Apple-inspired UX, multi-location, role-gated admin CRUD, mobile-first JKHive PWA hub for daily/weekly/monthly food-safety routines, dynamic compliance reporting, BI for labour/food/wastage, recipe→inventory auto-deduction.

## 2. Personas
- **Super Admin** — financial BI, probe registry edits, calibration history admin
- **Admin (site)** — daily/weekly/monthly routines, staff, inventory, Inspection Mode
- **Staff** — execute routines on mobile

## 3. Recently completed (Feb 2026 session)
- BI dashboard (labour, food cost, wastage); recipe→inventory auto-deduction; staff `hourly_rate`
- JKHive Income & Expenses native wrappers with `?back=` deep links
- Weekly Check hub (Probes, Legionella, Weekly Checklist) with 3-state pills
- Compliance matrix transposed; drill-down modal mobile scroll fix
- Probe Calibration: admin history tab, date/site filter, edit/delete with audit stamps, admin-locked name edit, centred edit modal
- "0 probes ⇒ N/A" vs "probes registered but no calibration ⇒ Missing" gating
- Admin → Site Settings: **Weekly Check routines** toggles per location
- Weekly Check hub filters tiles by per-location `applicable_routines`
- **Weekly Checklist compliance** now uses union-coverage (mirrors hub: partial run ≠ 100%)
- **Inspection Mode** ("EHO-ready audit pack") — new admin page `/jkhive/inspection` with date-range picker, headline compliance %, per-routine status pills, probes, recent calibrations, legionella, staff, templates summary, and Print/Save-PDF (A4 print CSS). Backend: `GET /api/admin/inspection/pack`.
- **Documents** module — new `/jkhive/documents` page with upload (multipart, 25 MB cap), category filter, grouped listing, in-app preview (PDFs in iframe, images in `<img>`), download, admin-only delete. Backend: GridFS-backed `routes/documents.py`.
- Hot/Cold "No holding today" idempotent toggle; Checklist "All Done" tick; weekly/monthly tick retention over period
- Bulk cooling requires "Cooled Temp" to mark Done; Washer comment required <55 wash / <82 rinse
- Daily Check tile auto-jumps to single template; Tick timestamps "Ticked on X by Y"

## 4. P0 Backlog
(none open)

## 5. P1 Backlog
- Click & Collect with WhatsApp Ordering — Phase 2/3 webhook + status page (blocked on Meta verification)
- Stripe card top-ups for loyalty (test keys available)
- JKHive "Coming Soon" tiles to activate next: HACCP Plan, Documents, Risk Assessments, Allergens (matrix), Clock In/Out, Payroll, Complaints, Safety Hotline, Shift Mgmt
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
- Admin-only routes: `/api/admin/bi`, `/api/admin/inspection/pack`, probe PATCH/DELETE, calibration PATCH/DELETE.
- Mobile: never `position: fixed` save buttons inside forms (iOS keyboard).
- All audit-pack views must have a `@media print` CSS block so EHO can print on A4.
