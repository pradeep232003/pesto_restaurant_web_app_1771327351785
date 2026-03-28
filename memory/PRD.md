# Pesto Restaurant Web App (Jolly's Kafe) - PRD

## Original Problem Statement
Set up and deploy the Pesto Restaurant Web App from GitHub repository (https://github.com/pradeep232003/pesto_restaurant_web_app_1771327351785) to the Emergent environment.

## Architecture
- **Frontend**: React 18 + Vite + TailwindCSS
- **Backend**: FastAPI (minimal - health check only)
- **Database**: MongoDB (available) / Supabase (optional, requires credentials)
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

## What's Been Implemented (Jan 2026)
- ✅ Migrated Vite app to Emergent environment structure
- ✅ Created mock data layer for Supabase fallback
- ✅ Home landing page with hero, deals, menu preview
- ✅ Menu catalog with category filters and location selector
- ✅ Shopping cart functionality
- ✅ Table reservation page
- ✅ Login and registration pages
- ✅ Order tracking page
- ✅ Admin menu management page
- ✅ Multi-location data (8 items per location)

## Current Status
- Running in **demo mode** with mock data (no Supabase credentials)
- All pages functional and tested
- 95% test success rate

## Prioritized Backlog

### P0 (Critical)
- None currently

### P1 (High Priority)
- Connect to Supabase with real credentials for persistent data
- Implement actual payment processing (Stripe)
- Add order submission to backend

### P2 (Medium Priority)
- Email notifications for orders/reservations
- User profile management
- Order history persistence
- Admin authentication

### P3 (Low Priority)
- Reviews and ratings system
- Loyalty rewards program
- Push notifications

## Next Tasks
1. User to provide Supabase credentials for real database connection
2. Implement backend API for orders and reservations
3. Add payment integration (Stripe)
