# Test Credentials

## Super Admin Account
- Email: admin@jollys.com
- Password: Admin123!
- Role: super_admin

## Auth Endpoints
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me
- POST /api/auth/refresh

## Role Hierarchy
- super_admin: Full access (user management + all admin features)
- admin: Sales entry + history + all standard admin features
- staff: Sales entry only + basic admin panel access
- customer: Customer-facing features only
