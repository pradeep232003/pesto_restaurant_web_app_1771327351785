# Pesto Restaurant Web App (Jolly's Kafe) - PRD

## Original Problem Statement
Set up and deploy the Pesto Restaurant Web App from GitHub repository to the Emergent environment, migrate data storage from Supabase to MongoDB, and add full admin CRUD functionality.

## Architecture
- **Frontend**: React 18 + Vite + TailwindCSS
- **Backend**: FastAPI with MongoDB integration
- **Database**: MongoDB (local)
- **Styling**: TailwindCSS with custom theme
- **Animations**: Framer Motion
- **State Management**: React Context + Local Storage

## User Personas
1. **Customers**: Browse menu, order food, make reservations
2. **Restaurant Staff**: Manage orders, reservations
3. **Admin**: Manage menu items, locations, pricing (FULLY IMPLEMENTED)

## Core Requirements (Static)
- Multi-location restaurant support (5 locations)
- Menu catalog with category filtering
- Shopping cart functionality
- Table reservation system
- User authentication (login/register)
- Order tracking
- Admin menu management ✅ COMPLETE

## What's Been Implemented

### Initial Setup (Jan 2026)
- ✅ Migrated Vite app from GitHub to Emergent environment
- ✅ Created mock data layer for Supabase fallback
- ✅ All pages functional (Home, Menu, Cart, Reservations, etc.)

### MongoDB Migration (Jan 2026)
- ✅ Created FastAPI backend with MongoDB connection
- ✅ Implemented REST API endpoints for public access
- ✅ Auto-seeding database with 5 locations and 28 menu items
- ✅ Frontend API service for backend communication

### Admin CRUD Functionality (Jan 2026)
- ✅ Full CRUD backend APIs for menu management
- ✅ Admin panel with menu item table
- ✅ Add New Menu Item modal with complete form
- ✅ Edit existing menu items
- ✅ Toggle item availability
- ✅ Delete menu items
- ✅ Location selector for multi-location management
- ✅ Category filtering in admin view

## Current Status
- **Database**: MongoDB (fully functional)
- **Backend API**: 100% test pass rate
- **Frontend**: 95% test pass rate
- **Admin CRUD**: Fully operational

## API Endpoints

### Public Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/health | Health check |
| GET | /api/locations | List all locations |
| GET | /api/locations/{slug} | Get location by slug |
| GET | /api/menu-items | List available menu items |
| GET | /api/menu-items/{id} | Get menu item by ID |
| GET | /api/featured-items | Get featured items |

### Admin Endpoints (NEW)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/admin/menu-items | List ALL items (including unavailable) |
| POST | /api/admin/menu-items | Create new menu item |
| PUT | /api/admin/menu-items/{id} | Update menu item |
| PATCH | /api/admin/menu-items/{id}/availability | Toggle availability |
| DELETE | /api/admin/menu-items/{id} | Delete menu item |

## Data Model

### Locations Collection
- id, name, slug, address, is_active, sort_order

### Menu Items Collection
- id, location_id, name, subtitle, description
- price, original_price, image_url, image_alt
- category, categories[], dietary[], tags[]
- featured, rating, review_count, prep_time, is_available
- created_at, updated_at

## Prioritized Backlog

### P0 (Critical)
- None currently

### P1 (High Priority)
- Add admin authentication/authorization
- Add payment integration (Stripe)
- Implement order submission and persistence

### P2 (Medium Priority)
- Email notifications for orders/reservations
- User profile persistence in MongoDB
- Order history storage
- Bulk menu item import/export

### P3 (Low Priority)
- Reviews and ratings system
- Loyalty rewards program
- Push notifications
- Real-time order updates (WebSockets)

## Next Tasks
1. Add admin authentication to protect CRUD endpoints
2. Implement order creation and management APIs
3. Integrate Stripe for payments
