# Pesto Restaurant Web App (Jolly's Kafe) - PRD

## Original Problem Statement
Full-stack restaurant management app with MongoDB, admin CRUD, authentication, resident prepaid wallets, menu image management, dual pricing, online ordering (collection only), order notifications, and per-site ordering controls.

## Architecture
- **Frontend**: React 18 + Vite + TailwindCSS + Framer Motion
- **Backend**: FastAPI + MongoDB + JWT Auth
- **Image Processing**: Pillow (400x400 auto-thumbnails)
- **Auth**: Cookie-based JWT + Emergent Google OAuth + Email OTP verification
- **Email**: Resend (when API key provided)

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

### Apple-Inspired Homepage Redesign (Mar 2026)
- Outfit font, monochrome palette, cinematic hero, bento grid, glass-morphism
- Whitespace between sections tightened for better flow

### Apple-Inspired Menu Catalog Redesign (Mar 2026)
- Sticky frosted-glass category bar, minimal white cards
- Quick Add hidden when ordering closed

### Customer Auth + Google OAuth + Email Verification (Mar 2026)
- Apple-designed auth page with Google OAuth via Emergent Auth
- Registration requires email OTP verification

### Apple-Inspired Admin Pages (Mar 2026)
- Dark sidebar, stat cards, clean headers, all pages redesigned

### Location Picker Modal (Mar 2026)
- Glassmorphism modal triggered when navigating to menu without selecting cafe

### Apple Shopping Cart (Mar 2026)
- Redesigned with Apple aesthetic (empty, filled, success states)
- Mobile-responsive layout

### Apple Table Reservation (Mar 2026)
- 3-step flow: Location → Calendar/Time → Details → Confirmation modal
- Dynamic locations from API, glassmorphism confirmation
- "Reservations" link always visible in header nav (desktop + mobile)

## Key Routes
| Route | Description |
|-------|-------------|
| / | Apple-inspired landing page |
| /menu-catalog | Apple-inspired menu with category tabs |
| /customer-auth | Apple auth with Google OAuth + email verification |
| /shopping-cart | Apple-designed cart with checkout |
| /table-reservation | Apple-designed reservation with calendar |
| /order-status | Track order by number |
| /admin-login | Apple-styled admin login |
| /admin | Apple-styled dashboard |
| /admin/menu | Menu CRUD management |
| /admin/orders | Order management |
| /admin/site-settings | Location CRUD, site hours, wallet toggle |
| /admin/residents | Prepaid wallet management |
| /admin/transactions | Transaction reports |

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
- Backend server.py modularization (~1800 lines -> /routes/)
