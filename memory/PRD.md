# Pesto Restaurant Web App (Jolly's Kafe) - PRD

## Original Problem Statement
Full-stack restaurant management app with MongoDB, admin CRUD, authentication, resident prepaid wallets, menu image management, dual pricing, online ordering (collection only), order notifications, and per-site ordering controls.

## Architecture
- **Frontend**: React 18 + Vite + TailwindCSS
- **Backend**: FastAPI + MongoDB + JWT Auth
- **Image Processing**: Pillow (400x400 auto-thumbnails)
- **Email**: Resend (when API key provided)

## Implemented Features

### Core (Jan 2026)
- MongoDB migration, 5 locations, 28 seeded menu items
- Full admin CRUD for menu items with JWT auth
- Resident prepaid wallet system (profiles, balances, top-ups, purchases, transactions)

### Menu Management (Feb 2026)
- Image upload with auto-thumbnail generation (400x400 JPEG)
- Show/hide image toggle per item
- Dual pricing: Resident (R) and Visitor (V) prices

### Online Ordering System (Feb 2026)
- Customer registration/login with JWT tokens
- Cart -> Order submission (collection only)
- Order status flow: Pending -> Confirmed -> Preparing -> Ready -> Collected
- Order tracking by order number (JK-XXXXXX format)

### Site Ordering Controls (Feb 2026)
- Per-site opening hours (Mon-Sun)
- Auto-enable/disable ordering based on schedule
- Manual override toggle for admin

### Dynamic Locations & Wallet Toggle (Mar 2026)
- Location CRUD: Admin can add, edit, soft-delete locations
- wallet_enabled toggle per location
- Locations fetched from API (no hardcoded arrays)
- Auto site_settings creation when adding new location

### Mobile Responsiveness (Mar 2026)
- All admin pages optimized for 375px+ mobile screens
- Hamburger sidebar navigation with slide-in drawer and overlay
- Site Settings: controls use flex-wrap, delete button in card header
- Dashboard: recent orders stack name below order number on mobile
- Menu modal: price fields stack vertically on mobile (grid-cols-1 sm:grid-cols-3)
- Transaction Report: mobile card layout replaces table (md:hidden)
- Resident Balance: 2-col summary cards, single-column resident cards
- ResidentCard uses dynamic locationName prop (no hardcoded map)
- All headers scale down text for mobile (text-xl sm:text-2xl)

## Key Routes
| Route | Description |
|-------|-------------|
| /menu-catalog | Public menu with site status |
| /customer-auth | Customer register/login |
| /shopping-cart | Cart with real checkout |
| /order-status | Track order by number |
| /admin-login | Admin authentication |
| /admin-menu | Menu CRUD management |
| /admin-orders | Order management dashboard |
| /admin-site-settings | Location CRUD, site hours, wallet toggle |
| /resident-balance | Prepaid wallet management |

## Prioritized Backlog

### P1 (High)
- Stripe integration for card top-ups
- Resend API key for email notifications

### P2 (Medium)
- Kitchen display board (auto-updating orders on screen)
- Bulk resident import/export

### P3 (Low)
- Multiple admin users with roles
- Loyalty rewards program
