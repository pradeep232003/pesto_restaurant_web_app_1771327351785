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

## Prioritized Backlog

### P1 (High)
- Stripe integration for card top-ups

### P2 (Medium)
- Kitchen display board (auto-updating orders on screen)
- Bulk resident import/export

### P3 (Low)
- Multiple admin users with roles (DONE - role system implemented)
- Loyalty rewards program
