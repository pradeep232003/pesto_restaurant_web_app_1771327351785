# Test Credentials

## Super Admin Account
- Email: admin@jollys.com
- Password: Admin123!
- Role: super_admin

## Admin Account (for BI/admin-role testing)
- Email: test_admin_bi@jollys.com
- Password: AdminBI123!
- Role: admin
- Seeded directly in MongoDB by the testing agent (no public create-user endpoint).

## Auth Endpoints
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me
- POST /api/auth/refresh
