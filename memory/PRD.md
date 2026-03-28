# Pesto Restaurant Web App (Jolly's Kafe) - PRD

## Original Problem Statement
Full-stack restaurant management app with MongoDB, admin CRUD, authentication, resident prepaid wallets, menu image management, dual pricing, online ordering (collection only), order notifications, and per-site ordering controls.

## Architecture
- **Frontend**: React 18 + Vite + TailwindCSS + Framer Motion
- **Backend**: FastAPI + MongoDB + JWT Auth
- **Image Processing**: Pillow (400x400 auto-thumbnails)
- **Auth**: Cookie-based JWT + Emergent Google OAuth
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
- Auto-rotating testimonials, newsletter CTA, Framer Motion animations

### Apple-Inspired Menu Catalog Redesign (Mar 2026)
- Sticky frosted-glass category bar, minimal white cards
- Glass Quick Add hover overlay, floating cart button

### Apple-Inspired Customer Auth + Google OAuth (Mar 2026)
- Complete auth page redesign with Apple aesthetic
- "Continue with Google" OAuth via Emergent Auth service
- Backend: POST /api/customer/auth/google-session exchanges session_id for JWT
- Frontend: GoogleAuthCallback component handles OAuth redirect
- Pill-shaped Login/Register toggle, minimal input fields
- Registration shows generated password before redirect
- Redirect URL: window.location.origin (no hardcoded URLs)

## Key Routes
| Route | Description |
|-------|-------------|
| / | Apple-inspired landing page |
| /menu-catalog | Apple-inspired menu with category tabs & floating cart |
| /customer-auth | Apple-inspired auth with Google OAuth |
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
