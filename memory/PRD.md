# Pesto Restaurant Web App (Jolly's Kafe) - PRD

## Original Problem Statement
Set up and deploy the Pesto Restaurant Web App from GitHub repository to the Emergent environment, migrate data storage from Supabase to MongoDB, add full admin CRUD functionality, implement admin authentication, and build a prepaid balance management system for residents.

## Architecture
- **Frontend**: React 18 + Vite + TailwindCSS
- **Backend**: FastAPI with MongoDB + JWT Authentication
- **Database**: MongoDB (local)
- **Authentication**: JWT tokens (httpOnly cookies) + bcrypt password hashing
- **Styling**: TailwindCSS with custom theme
- **Animations**: Framer Motion

## What's Been Implemented

### Phase 1: Initial Setup (Jan 2026)
- ✅ Migrated Vite app from GitHub to Emergent environment
- ✅ All pages functional (Home, Menu, Cart, Reservations, etc.)

### Phase 2: MongoDB Migration (Jan 2026)
- ✅ Created FastAPI backend with MongoDB connection
- ✅ Auto-seeding database with 5 locations and 28 menu items

### Phase 3: Admin CRUD & Authentication (Jan 2026)
- ✅ Full CRUD backend APIs for menu management
- ✅ JWT-based authentication with brute force protection
- ✅ Admin login page and protected endpoints

### Phase 4: Resident Prepaid Balance System (Jan 2026)
- ✅ **Resident Profiles**
  - Store residence number (unique), name/initials, location, notes
  - CRUD operations (create, read, update, delete)
  - Filter by location (Oakmere / Willowmere)
  - Search by name or residence number

- ✅ **Prepaid Wallet System**
  - Top-up balance functionality
  - Running balance per resident
  - Real-time balance updates

- ✅ **Transactions (Café Purchases)**
  - Record purchases with amount deduction
  - Prevents purchases if balance insufficient
  - Description/notes for each transaction

- ✅ **Transaction History**
  - Date & time of each transaction
  - Type (Top-up or Purchase)
  - Amount (+ for top-up, − for purchase)
  - Balance after transaction
  - Created by admin user

- ✅ **Reporting & Printing**
  - View full transaction history per resident
  - Filter by date range
  - Filter by location (Oakmere / Willowmere)
  - Filter by transaction type
  - Print-friendly views
  - Summary statistics (total balance, transaction counts, net flow)

## Current Status
- **Backend API**: 100% test pass rate
- **Frontend**: 100% test pass rate
- **Integration**: 100% test pass rate
- All features fully operational

## API Endpoints

### Auth Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | Admin login |
| POST | /api/auth/logout | Logout |
| GET | /api/auth/me | Get current user |
| POST | /api/auth/refresh | Refresh token |

### Public Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/locations | List locations |
| GET | /api/menu-items | List menu items |
| GET | /api/featured-items | Featured items |

### Admin Menu Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/admin/menu-items | List all menu items |
| POST | /api/admin/menu-items | Create menu item |
| PUT | /api/admin/menu-items/{id} | Update menu item |
| DELETE | /api/admin/menu-items/{id} | Delete menu item |

### Resident Balance Endpoints (NEW)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/admin/residents | List all residents |
| GET | /api/admin/residents/{id} | Get resident |
| POST | /api/admin/residents | Create resident |
| PUT | /api/admin/residents/{id} | Update resident |
| DELETE | /api/admin/residents/{id} | Delete resident |
| POST | /api/admin/transactions | Create transaction |
| GET | /api/admin/transactions | List transactions (filtered) |
| GET | /api/admin/residents/{id}/transactions | Resident's transactions |
| GET | /api/admin/balance-summary | Balance summary stats |

## Frontend Routes

### Public Routes
- `/` - Home page
- `/menu-catalog` - Menu catalog
- `/shopping-cart` - Shopping cart
- `/table-reservation` - Table reservation
- `/login` - User login
- `/register` - User registration

### Admin Routes
- `/admin-login` - Admin login
- `/admin-menu` - Menu management
- `/resident-balance` - Resident prepaid balance dashboard
- `/resident-history/:residentId` - Resident transaction history
- `/transaction-report` - Transaction reporting

## Data Models

### Residents Collection
```javascript
{
  id: string,
  residence_number: string (unique),
  name: string,
  location: "oakmere-handforth" | "willowmere-middlewich",
  about: string (optional),
  balance: number,
  created_at: datetime,
  updated_at: datetime
}
```

### Transactions Collection
```javascript
{
  id: string,
  resident_id: string,
  transaction_type: "topup" | "purchase",
  amount: number (+ for topup, - for purchase),
  balance_before: number,
  balance_after: number,
  description: string (optional),
  created_at: datetime,
  created_by: string (admin email)
}
```

## Prioritized Backlog

### P1 (High Priority)
- Add Stripe payment integration
- Customer authentication for order history
- Order submission and persistence

### P2 (Medium Priority)
- Email receipts for top-ups and purchases
- Bulk resident import/export
- Multiple admin users with roles

### P3 (Low Priority)
- Loyalty rewards program
- Push notifications for low balance
- Real-time balance updates via WebSockets

## Next Tasks
1. Add Stripe integration for online top-ups
2. Implement customer-facing order system
3. Add email notifications
