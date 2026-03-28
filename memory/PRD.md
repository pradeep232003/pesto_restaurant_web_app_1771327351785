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
- Transaction History (date/time, type, amount, balance)
- Reporting & Printing (filters, print-friendly views, summary stats)

### Phase 5: Menu Image Management (Feb 2026)
- **Image Upload**: Admin can upload images for menu items via file picker (multipart/form-data)
- **Show/Hide Toggle**: Per-item toggle to show or hide food pictures on the public menu
- **Public Menu Respects Flag**: Public menu catalog hides images when show_image is false
- **Modal Integration**: Add/Edit modal includes "Show image on menu" toggle
- Backend endpoints: POST /api/admin/menu-items/{id}/upload-image, PATCH /api/admin/menu-items/{id}/toggle-image

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
| POST | /api/admin/menu-items/{id}/upload-image | Upload image |
| PATCH | /api/admin/menu-items/{id}/toggle-image | Toggle image visibility |

### Resident Balance Endpoints
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

## Prioritized Backlog

### P1 (High Priority)
- Stripe payment integration for card top-ups
- Resend API key configuration for email receipts

### P2 (Medium Priority)
- Bulk resident import/export
- Customer authentication for order history
- Order submission and persistence

### P3 (Low Priority)
- Loyalty rewards program
- Push notifications for low balance
- Multiple admin users with roles
