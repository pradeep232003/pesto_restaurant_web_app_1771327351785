# Pesto Restaurant Web App (Jolly's Kafe) - PRD

## Original Problem Statement
Full-stack restaurant management app with MongoDB, admin CRUD, authentication, resident prepaid wallets, menu image management, dual pricing, online ordering (collection only), order notifications, and per-site ordering controls.

## Architecture
- **Frontend**: React 18 + Vite + TailwindCSS + Framer Motion
- **Backend**: FastAPI + MongoDB + JWT Auth
- **Image Processing**: Pillow (400x400 auto-thumbnails)
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
- Location CRUD from admin panel
- wallet_enabled toggle per location

### Mobile Responsiveness (Mar 2026)
- All admin pages optimized for 375px+ mobile screens
- Hamburger sidebar, responsive grids, mobile card layouts

### Apple-Inspired Homepage Redesign (Mar 2026)
- Complete visual overhaul with Apple.com design language
- Outfit font (Google Fonts), monochrome palette (#FBFBFD, #1D1D1F, #86868B)
- Cinematic hero section with large typography and rounded-corner hero image
- Bento grid menu preview with glass-morphism labels
- Minimal icon features (ChefHat, Leaf, Clock, Heart) with generous whitespace
- Stats section (5 Locations, 50+ Menu Items, 10K+ Customers, 5-star Rating)
- Auto-rotating testimonials with large typographic quotes
- Newsletter signup in rounded gray container with pill-shaped CTA
- Clean footer with Explore/Locations/Connect columns
- Framer Motion scroll-triggered fade-up animations throughout
- Fully responsive on desktop and mobile

## Key Routes
| Route | Description |
|-------|-------------|
| / | Apple-inspired landing page |
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
