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
- **Staff ↔ Location assignment** (Feb 2026) — `StaffMember.location_ids` (list of site ids). Admin staff form (/admin/staff) drawer now has a Locations checkbox group listing every site; staff table shows blue location chips per row (orange "All sites" badge for legacy rows). `/jkhive/shifts` filters the schedulable roster (and AI Suggest prompt) to staff whose `location_ids` include the active location — empty list = legacy "any site" fallback so existing data keeps working.
- **Staff Active toggle** (Feb 2026) — `StaffMember.active` (bool, default True). Admin staff form has a green/grey Active toggle; staff table has a clickable Active/Inactive status pill column and dims inactive rows to 55% opacity. Inactive staff are hidden from the `/jkhive/shifts` grid, add-shift dropdown, and the AI Suggest roster, while historical shifts remain intact.
- **Invoice scanning** (Feb 2026) — new `/jkhive/invoices` page + "Invoices" tile in JKHive Operate section. Staff snap a photo with the phone camera (`<input capture="environment">`), backend stores the raw image in GridFS bucket `invoices_files`, then Claude Sonnet 4.5 vision (httpx → api.anthropic.com `image` content block) extracts supplier, invoice #, date, line items (description/qty/unit/total), VAT and grand total. Failed AI extraction still persists a draft with `ai_status='failed'` so the manager can edit by hand. Admin + super_admin can change location, edit fields, delete; staff are read-only for location and have no delete. Endpoints: `GET/POST/PATCH/DELETE /api/admin/invoices`. Modal uses zIndex 200 + ~84px bottom padding to clear the JKHive footer-nav.
- **Geofenced Clock In/Out MVP** (Feb 2026) — new `/jkhive/clock` page; Clock In/Out tile promoted to top "Operate" row of Workforce (above Shift Mgmt). Locations gain `latitude` / `longitude` / `geofence_radius_m` (default 200m) editable from Admin → Site Settings. On clock-in the browser captures GPS via `navigator.geolocation` (high accuracy, 8s timeout) and posts to `POST /api/clock/in`; server haversine-checks the distance vs the configured fence. Outside the fence → HTTP 403 with distance in the message. GPS denied/unavailable OR no fence configured → event is still recorded but flagged `verified: false` (UNVERIFIED chip) for admin review. Clock-out is bound to the open shift's location so staff can't drift sites mid-shift; server stores elapsed hours. Staff location permissions are enforced (`staff_members.location_ids`). Endpoints: `GET /api/clock/status`, `POST /api/clock/in`, `POST /api/clock/out`, `GET /api/clock/history`, `GET /api/clock/admin/events` (admin only). Per user request: NOT tested in preview — will be validated directly in PROD.
- **Multi-page invoice scan** (Feb 2026) — `/jkhive/invoices` toolbar now has a "Multi-page" button (alongside the single-shot "Scan Invoice"). It opens a file picker with `multiple` enabled, queues up to 20 pages in a modal with thumbnails (re-orderable via add/remove), and submits them all to new `POST /api/admin/invoices/scan-multi`. The server stores each page individually in GridFS, then sends ALL pages to Claude in a single call with `--- Page N of M ---` separators and a merge instruction, so the AI returns one consolidated extraction (supplier/date/totals from the final page, all line items combined). Invoice docs gain `pages: [{file_id, filename, content_type, size}]` + `page_count`; the top-level `file_id` still points to page 1 for back-compat. Detail modal shows prev/next arrows + "Page X / N" indicator; invoice cards show a small Layers badge with the page count. New endpoint `GET /api/admin/invoices/{id}/pages/{page_index}` streams a specific page. Delete cleans up every page from GridFS.
- **Merge into existing invoice** (Feb 2026) — every Recent-tab card now has a small "+" button next to the price. Tap → file picker (multiple allowed, image or PDF). The new pages are appended to the invoice's `pages[]` via `POST /api/admin/invoices/{id}/append-pages`, then by default the AI re-runs across **all** pages (original + new, refetched from GridFS) so supplier/items/totals are kept consistent. Click is `stopPropagation`'d so it doesn't open the detail modal. Legacy single-page invoices are upgraded transparently. 20-page cap enforced. Refresh is automatic.
- **Wage Budget header on `/jkhive/shifts`** (Feb 2026, admin/super_admin only) — 3-tile widget pinned to the top of Shift Management. **Last week revenue** is summed from `daily_sales` for the active location. **Next-week forecast** defaults to last week's revenue with a pencil-edit + reset to allow admins to override (stored in new `shift_budgets` collection, keyed by `(location_id, week_start)`). **Wage allocation** is `forecast × target_pct` (default 30%, target also editable inline) and shows £remaining-of-£total with a colour-shifting progress bar (green &lt;80%, amber 80–100%, red &gt;100%). `wage_used` is computed client-side from the already-loaded shifts × `staff.hourly_rate` so it ticks DOWN live as the manager fills the rota or drags blocks. Endpoints: `GET /api/admin/shifts/week-budget`, `PUT /api/admin/shifts/week-budget` (both admin-gated).
- **Upload + Review invoice button** (Feb 2026) — new up-arrow button on `/jkhive/invoices` toolbar (alongside Scan/Multi-page). File picker only (no camera), runs `POST /api/admin/invoices/scan-auto`. If the AI detects a **single invoice** → creates the record and opens the detail modal for immediate review. If the AI detects **multiple invoices in one file** (e.g. FCN Frozen Foods "Reprinted Invoices" statement bundle with 5 invoices on 5 pages) → returns UNPERSISTED drafts and opens a `BatchReviewModal` where the manager can edit supplier/number/date/total per row, drop hallucinated rows, then "Save all N" via `POST /api/admin/invoices/scan-batch-commit`. Every split invoice references the SAME source PDF in GridFS (batch_source_file_id + source_page_start/end fields) so the audit trail is intact. New `_AI_SYSTEM_MULTI` prompt returns `{invoices: [ ... ]}` array with page_start/page_end per invoice.
- **Frontend deploy fix** (Jul 2026) — removed unused `@supabase/supabase-js` dep (v2.110+ needs Node ≥22; Railway builds on Node 20). Deleted orphan `lib/supabase.js`. Build now passes on Node 20.
- **Invoice deduplication + date-desc sort** (Jul 2026) — the `/api/admin/invoices` list now sorts by `invoice_date` DESC (fallback `uploaded_at` DESC) so the newest supplier-dated invoice sits at the top of the "All Invoices" table. All save paths (`/scan`, `/scan-multi`, `/scan-auto`, `/scan-batch-commit`, `PATCH /{id}`) now call a shared `_raise_if_duplicate()` guard that rejects any save where the same `(location_id, supplier, invoice_number)` already exists (case-insensitive, both fields must be non-empty — AI-failed stubs are still permitted so the manager can hand-fill). Batch commit is atomic — a pre-flight loop rejects the whole payload if any single draft (or an internal same-payload duplicate) would clash, so partial success is impossible. Error 409 with clean message: "Duplicate invoice: Bidfood #0000390323 was already saved by Admin on 2026-07-04". Verified end-to-end with curl.

## 4. P0 Backlog
(none open)

## 5. P1 Backlog
- Click & Collect with WhatsApp Ordering — Phase 2/3 webhook + status page (blocked on Meta verification)
- Stripe card top-ups for loyalty (test keys available)
- JKHive "Coming Soon" tiles to activate next: HACCP Plan, Risk Assessments, Allergens (matrix), Payroll, Complaints, Safety Hotline, Food Wastage
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
