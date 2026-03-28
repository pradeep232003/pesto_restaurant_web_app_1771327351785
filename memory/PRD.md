# Pesto Restaurant Web App (Jolly's Kafe) - PRD

## Original Problem Statement
Full-stack restaurant management app with MongoDB, admin CRUD, authentication, resident prepaid wallets, menu image management, dual pricing, online ordering (collection only), order notifications, and per-site ordering controls.

## Architecture
- **Frontend**: React 18 + Vite + TailwindCSS
- **Backend**: FastAPI + MongoDB + JWT Auth
- **Image Processing**: Pillow (400x400 auto-thumbnails)
- **Email**: Resend (when API key provided)
- **SMS**: Twilio (when credentials provided)

## Implemented Features

### Core (Jan 2026)
- MongoDB migration, 5 locations, 28 seeded menu items
- Full admin CRUD for menu items with JWT auth
- Resident prepaid wallet system (profiles, balances, top-ups, purchases, transactions)

### Menu Management (Feb 2026)
- Image upload with auto-thumbnail generation (400x400 JPEG)
- Show/hide image toggle per item
- Dual pricing: Resident (R) and Visitor (V) prices
- Public menu shows only resident price in GBP

### Online Ordering System (Feb 2026)
- Customer registration (name, email, phone) with auto-generated password
- Customer login with JWT tokens
- Cart -> Order submission (collection only, no delivery)
- Order status flow: Pending -> Confirmed -> Preparing -> Ready -> Collected
- Order tracking by order number (JK-XXXXXX format)
- Special instructions support

### Order Notifications (Feb 2026)
- Email notification on "ready" status (requires Resend API key)
- SMS notification on "ready" status (requires Twilio credentials)
- Real-time order status page for customers

### Site Ordering Controls (Feb 2026)
- Per-site opening hours (Mon-Sun with open/close times)
- Auto-enable/disable ordering based on schedule
- Manual override toggle for admin
- Public menu shows "Online Ordering Open/Closed" banner
- Cart blocks checkout when site is closed

### Dynamic Locations & Wallet Toggle (Mar 2026)
- Location CRUD: Admin can add, edit, soft-delete locations from Site Settings
- wallet_enabled toggle per location (controls resident wallet availability)
- Locations fetched from API (no more hardcoded arrays)
- Auto site_settings creation when adding new location
- Resident Balance and Transaction Report pages filter by wallet_enabled
- All admin pages (Menu, Orders, Dashboard, Site Settings) use dynamic locations

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

## API Endpoints

### Customer
| Method | Endpoint | Auth |
|--------|----------|------|
| POST | /api/customer/register | Public |
| POST | /api/customer/login | Public |
| GET | /api/customer/me | Customer |
| POST | /api/customer/logout | Customer |

### Orders
| Method | Endpoint | Auth |
|--------|----------|------|
| POST | /api/orders | Customer (verified) |
| GET | /api/orders/track/{order_number} | Public |
| GET | /api/customer/orders | Customer |
| GET | /api/admin/orders | Admin |
| PATCH | /api/admin/orders/{id}/status | Admin |

### Site Settings
| Method | Endpoint | Auth |
|--------|----------|------|
| GET | /api/site-status/{location_id} | Public |
| GET | /api/admin/site-settings | Admin |
| PUT | /api/admin/site-settings/{location_id} | Admin |
| PATCH | /api/admin/site-settings/{location_id}/toggle | Admin |

### Locations (NEW)
| Method | Endpoint | Auth |
|--------|----------|------|
| GET | /api/locations | Public |
| GET | /api/admin/locations | Admin |
| POST | /api/admin/locations | Admin |
| PUT | /api/admin/locations/{id} | Admin |
| DELETE | /api/admin/locations/{id} | Admin |

## Prioritized Backlog

### P1 (High)
- Stripe integration for card top-ups
- Resend API key for email notifications
- Twilio credentials for SMS notifications

### P2 (Medium)
- Kitchen display board (auto-updating orders on screen)
- Bulk resident import/export
- Order history for customers
- Print kitchen tickets

### P3 (Low)
- Multiple admin users with roles
- Loyalty rewards program
- Push notifications
