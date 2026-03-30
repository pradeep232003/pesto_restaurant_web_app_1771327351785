# Pesto Restaurant Web App (Jolly's Kafe) - PRD

## Original Problem Statement
Full-stack restaurant management app with MongoDB, admin CRUD, authentication, resident prepaid wallets, menu image management, dual pricing, online ordering (collection only), order notifications, and per-site ordering controls.

## Architecture
- **Frontend**: React 18 + Vite + TailwindCSS + Framer Motion
- **Backend**: FastAPI + MongoDB + JWT Auth + httpx (Google API)
- **Image Processing**: Pillow (400x400 auto-thumbnails)
- **Auth**: Cookie-based JWT + localStorage Bearer token fallback + Emergent Google OAuth + Email OTP verification
- **Email**: Resend (when API key provided)

### Backend Structure (Modularized Mar 2026)
```
/app/backend/
├── server.py          (~250 lines: app init, CORS, routers, startup seed, frontend serve)
├── db.py              (MongoDB connection & collections)
├── models.py          (All Pydantic models)
├── auth.py            (JWT, password, brute force, auth dependencies)
├── helpers.py         (serialize_doc, serialize_user)
├── routes/
│   ├── auth.py        (/api/auth/login, logout, me, refresh)
│   ├── locations.py   (/api/locations + /api/reviews + /api/admin/locations)
│   ├── menu.py        (/api/menu-items + /api/admin/menu-items + /api/images)
│   ├── residents.py   (/api/admin/residents + transactions + balance-summary)
│   ├── customers.py   (/api/customer/* + Google OAuth)
│   ├── orders.py      (/api/orders + /api/site-status + /api/admin/orders)
│   ├── settings.py    (/api/admin/site-settings)
│   └── contact.py     (/api/contact)
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

### Mobile Responsiveness (Mar 2026)
- All admin pages optimized for 375px+

### Apple-Inspired Redesign (Mar 2026)
- Outfit font, monochrome palette, cinematic hero, bento grid, glass-morphism
- Homepage, Menu Catalog, Shopping Cart, Table Reservation, Order Status, Contact Us

### Customer Auth + Google OAuth + Email Verification (Mar 2026)
- Apple-designed auth page with Google OAuth via Emergent Auth
- Registration requires email OTP verification

### Mobile Admin Auth Fix (Mar 2026)
- Dual-auth: cookies + localStorage Bearer tokens for cross-origin mobile

### Google Reviews Integration (Mar 2026)
- Admin: Google Place ID + API Key per location
- /api/reviews fetches from Google Places API with 6h cache, 4+ stars only
- Home page dynamic carousel, hidden when no reviews configured

### Backend Modularization (Mar 2026)
- Refactored ~2000-line server.py into modular /routes/ structure
- Zero functional changes, all 27 backend + all frontend tests passed

## Prioritized Backlog

### P1 (High)
- Stripe integration for card top-ups
- Resend API key for email notifications (blocked on user)

### P2 (Medium)
- Kitchen display board (auto-updating orders on screen)
- Bulk resident import/export

### P3 (Low)
- Multiple admin users with roles
- Loyalty rewards program
