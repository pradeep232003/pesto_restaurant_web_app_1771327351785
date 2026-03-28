# Pesto Restaurant Web App (Jolly's Kafe) - PRD

## Original Problem Statement
Set up and deploy the Pesto Restaurant Web App from GitHub repository to the Emergent environment, then migrate data storage from Supabase to MongoDB.

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
3. **Admin**: Manage menu items, locations, pricing

## Core Requirements (Static)
- Multi-location restaurant support (5 locations)
- Menu catalog with category filtering
- Shopping cart functionality
- Table reservation system
- User authentication (login/register)
- Order tracking
- Admin menu management

## What's Been Implemented

### Initial Setup (Jan 2026)
- ✅ Migrated Vite app from GitHub to Emergent environment
- ✅ Created mock data layer for Supabase fallback
- ✅ All pages functional (Home, Menu, Cart, Reservations, etc.)

### MongoDB Migration (Jan 2026)
- ✅ Created FastAPI backend with MongoDB connection
- ✅ Implemented REST API endpoints:
  - GET /api/health - Health check
  - GET /api/locations - Get all locations
  - GET /api/locations/{slug} - Get location by slug
  - GET /api/menu-items - Get menu items (with filters)
  - GET /api/menu-items/{id} - Get single item
  - GET /api/featured-items - Get featured items
- ✅ Auto-seeding database with 5 locations and 28 menu items
- ✅ Frontend API service (api.js) for backend communication
- ✅ Updated menu-catalog and admin-menu pages to use MongoDB
- ✅ Updated AuthContext for localStorage-based auth

## Current Status
- **Database**: MongoDB (fully functional)
- **Backend API**: 100% test pass rate
- **Frontend**: 98% test pass rate
- All core features working

## Data Model

### Locations Collection
- id, name, slug, address, is_active, sort_order

### Menu Items Collection
- id, location_id, name, subtitle, description
- price, original_price, image_url, image_alt
- category, categories[], dietary[], tags[]
- featured, rating, review_count, prep_time, is_available

## Prioritized Backlog

### P0 (Critical)
- None currently

### P1 (High Priority)
- Implement full CRUD APIs for admin menu management
- Add payment integration (Stripe)
- Implement order submission and persistence

### P2 (Medium Priority)
- Email notifications for orders/reservations
- User profile persistence in MongoDB
- Order history storage
- Admin authentication with roles

### P3 (Low Priority)
- Reviews and ratings system
- Loyalty rewards program
- Push notifications
- Real-time order updates (WebSockets)

## API Endpoints Available

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/health | Health check |
| GET | /api/locations | List all locations |
| GET | /api/locations/{slug} | Get location by slug |
| GET | /api/menu-items | List menu items (optional: location_id, category) |
| GET | /api/menu-items/{id} | Get menu item by ID |
| GET | /api/featured-items | Get featured items (optional: location_id, limit) |

## Next Tasks
1. Implement POST/PUT/DELETE endpoints for admin menu management
2. Add order creation and management APIs
3. Integrate Stripe for payments
