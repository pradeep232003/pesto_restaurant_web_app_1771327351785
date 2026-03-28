# Pesto Restaurant Web App (Jolly's Kafe) - PRD

## Original Problem Statement
Set up and deploy the Pesto Restaurant Web App from GitHub repository to the Emergent environment, migrate data storage from Supabase to MongoDB, add full admin CRUD functionality, implement admin authentication, build a prepaid balance management system for residents, and add menu image management with dual pricing.

## Architecture
- **Frontend**: React 18 + Vite + TailwindCSS
- **Backend**: FastAPI with MongoDB + JWT Authentication
- **Database**: MongoDB (local)
- **Authentication**: JWT tokens (httpOnly cookies) + bcrypt password hashing
- **Image Processing**: Pillow (auto-thumbnail 400x400)
- **Styling**: TailwindCSS with custom theme
- **Animations**: Framer Motion

## What's Been Implemented

### Phase 1: Initial Setup (Jan 2026)
- Migrated Vite app from GitHub to Emergent environment
- All pages functional (Home, Menu, Cart, Reservations, etc.)

### Phase 2: MongoDB Migration (Jan 2026)
- Created FastAPI backend with MongoDB connection
- Auto-seeding database with 5 locations and 28 menu items

### Phase 3: Admin CRUD & Authentication (Jan 2026)
- Full CRUD backend APIs for menu management
- JWT-based authentication with brute force protection
- Admin login page and protected endpoints

### Phase 4: Resident Prepaid Balance System (Jan 2026)
- Resident Profiles (CRUD, filter by location, search)
- Prepaid Wallet System (Cash/Card top-ups, running balance)
- Transactions (purchases, top-ups, email receipt via Resend)
- Transaction History & Reporting

### Phase 5: Menu Image Management (Feb 2026)
- Image Upload with auto-thumbnail generation (400x400 JPEG)
- Show/Hide Toggle per menu item
- Public menu respects show_image flag

### Phase 6: Dual Pricing (Feb 2026)
- Resident Price (R) and Visitor Price (V) per menu item
- Admin can set both prices in Add/Edit modal
- Public online menu shows ONLY resident price
- Admin table shows both R/V prices with color-coded labels
- Currency display uses GBP (£)

## Data Models

### Menu Items (updated)
```javascript
{
  id: string,
  location_id: string,
  name: string,
  price: number,           // Resident price (shown online)
  visitor_price: number,   // Visitor price (admin only)
  original_price: number,
  image_url: string,
  thumbnail_url: string,   // Auto-generated 400x400
  show_image: boolean,
  // ... other fields
}
```

## API Endpoints

### Admin Menu Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/admin/menu-items | List all (includes visitor_price) |
| POST | /api/admin/menu-items | Create (accepts visitor_price) |
| PUT | /api/admin/menu-items/{id} | Update (accepts visitor_price) |
| DELETE | /api/admin/menu-items/{id} | Delete |
| POST | /api/admin/menu-items/{id}/upload-image | Upload + auto thumbnail |
| PATCH | /api/admin/menu-items/{id}/toggle-image | Toggle visibility |
| GET | /api/uploads/{filename} | Serve original images |
| GET | /api/uploads/thumbnails/{filename} | Serve thumbnails |

## Prioritized Backlog

### P0 (In Progress - User's 5-feature request)
- Online ordering system (collection only, no delivery)
- Customer auth with verified email + phone
- Order status flow (Pending → Confirmed → Preparing → Ready → Collected)
- Order ready notifications (email + SMS + status page)
- Per-site ordering toggle (auto-schedule + manual override)

### P1 (High Priority)
- Stripe integration for card top-ups
- Twilio integration for SMS notifications
- Resend API key for email receipts/notifications

### P2 (Medium Priority)
- Bulk resident import/export
- Multiple admin users with roles

### P3 (Low Priority)
- Loyalty rewards program
- Push notifications for low balance
