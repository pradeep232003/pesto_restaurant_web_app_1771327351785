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

### Backend Structure (Modularized Mar 2026)
```
/app/backend/
├── server.py          (App init, CORS, routers, startup seed, SEO catch-all frontend serve)
├── seo.py             (Sitemap generator, meta tag injector, JSON-LD builder)
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
│   └── contact.py     (/api/contact + /api/subscribe)
├── tests/
│   └── test_seo.py    (53 SEO unit tests)
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
- Apple-designed auth page with custom popup-based Google OAuth
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

### Timperley Menu Migration (Apr 2026)
- Parsed Zettle POS export (157 raw items) into 106 categorized menu items

### JK Locations Page (Apr 2026)
- Jolly's Kafe logo added to /jklocations page
- All 5 locations displayed with Apple-inspired card design

### Gmail SMTP Integration (Apr 2026)
- Contact Us form and Newsletter subscription via Gmail SMTP (replaced Resend)

### Custom Google OAuth (Apr 2026)
- Replaced @react-oauth/google with custom popup-based flow
- Avoids production crashes from missing build-time env vars

### SEO Optimization (Apr 2026) - VERIFIED
- Dynamic SSR simulation: backend injects route-specific <title>, <meta description>, OG tags, Twitter cards, canonical URLs, and JSON-LD schema into index.html before serving
- Auto-generated /sitemap.xml with 11 URLs (6 core + 5 locations)
- Location-specific landing pages: /handforth, /middlewich, /timperley, /atherton, /chaddesden
- Each location page has CafeOrCoffeeShop JSON-LD with address, opening hours
- robots.txt references sitemap
- 301 redirects: .html extensions, non-www to www domain
- 53 backend tests + 3 frontend redirect tests — ALL PASSED

## Prioritized Backlog

### P1 (High)
- Stripe integration for card top-ups

### P2 (Medium)
- Kitchen display board (auto-updating orders on screen)
- Bulk resident import/export

### P3 (Low)
- Multiple admin users with roles
- Loyalty rewards program
