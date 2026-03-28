"""
Test Phase 2-5 Features:
- Customer Registration & Login
- Order Creation & Tracking
- Admin Order Management
- Site Settings Management
"""
import pytest
import requests
import os
import uuid

# Use localhost for backend testing
BASE_URL = "http://localhost:8001"

# Test data
TEST_CUSTOMER_EMAIL = f"test_{uuid.uuid4().hex[:8]}@example.com"
TEST_CUSTOMER_NAME = "Test Customer"
TEST_CUSTOMER_PHONE = "+447123456789"
TEST_LOCATION_ID = "timperley-altrincham"


class TestHealthAndBasics:
    """Basic health checks"""
    
    def test_health_endpoint(self):
        """Health endpoint returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✓ Health endpoint working")


class TestCustomerAuth:
    """Customer registration and login tests"""
    
    @pytest.fixture(scope="class")
    def registered_customer(self):
        """Register a test customer and return credentials"""
        email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        response = requests.post(f"{BASE_URL}/api/customer/register", json={
            "name": TEST_CUSTOMER_NAME,
            "email": email,
            "phone": TEST_CUSTOMER_PHONE
        })
        assert response.status_code == 200, f"Registration failed: {response.text}"
        data = response.json()
        return {
            "email": email,
            "password": data.get("password"),
            "token": data.get("token"),
            "customer_id": data.get("customer_id")
        }
    
    def test_customer_register_success(self):
        """POST /api/customer/register creates customer with auto-verified=true"""
        email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        response = requests.post(f"{BASE_URL}/api/customer/register", json={
            "name": "New Customer",
            "email": email,
            "phone": "+447999888777"
        })
        assert response.status_code == 200
        data = response.json()
        
        # Verify response contains password and token
        assert "password" in data, "Response should contain generated password"
        assert "token" in data, "Response should contain auth token"
        assert "customer_id" in data, "Response should contain customer_id"
        assert len(data["password"]) >= 8, "Password should be at least 8 characters"
        print(f"✓ Customer registered: {email}")
        print(f"  - Password returned: {data['password'][:4]}...")
        print(f"  - Token returned: {data['token'][:20]}...")
    
    def test_customer_register_duplicate_email(self):
        """Registration fails for duplicate email"""
        email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        # First registration
        requests.post(f"{BASE_URL}/api/customer/register", json={
            "name": "First Customer",
            "email": email,
            "phone": "+447111222333"
        })
        # Second registration with same email
        response = requests.post(f"{BASE_URL}/api/customer/register", json={
            "name": "Second Customer",
            "email": email,
            "phone": "+447444555666"
        })
        assert response.status_code == 400
        print("✓ Duplicate email registration rejected")
    
    def test_customer_login_success(self, registered_customer):
        """POST /api/customer/login with email+password works and returns token"""
        response = requests.post(f"{BASE_URL}/api/customer/login", json={
            "email": registered_customer["email"],
            "password": registered_customer["password"]
        })
        assert response.status_code == 200
        data = response.json()
        
        assert "token" in data, "Login should return token"
        assert "customer" in data, "Login should return customer object"
        assert data["customer"]["email"] == registered_customer["email"]
        print(f"✓ Customer login successful: {registered_customer['email']}")
    
    def test_customer_login_invalid_password(self, registered_customer):
        """Login fails with wrong password"""
        response = requests.post(f"{BASE_URL}/api/customer/login", json={
            "email": registered_customer["email"],
            "password": "wrongpassword123"
        })
        assert response.status_code == 401
        print("✓ Invalid password rejected")
    
    def test_customer_me_with_token(self, registered_customer):
        """GET /api/customer/me returns customer profile with token"""
        response = requests.get(
            f"{BASE_URL}/api/customer/me",
            headers={"Authorization": f"Bearer {registered_customer['token']}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["email"] == registered_customer["email"]
        assert data["name"] == TEST_CUSTOMER_NAME
        assert "email_verified" in data
        assert "phone_verified" in data
        print(f"✓ Customer profile retrieved: {data['name']}")
    
    def test_customer_me_without_token(self):
        """GET /api/customer/me fails without token"""
        response = requests.get(f"{BASE_URL}/api/customer/me")
        assert response.status_code == 401
        print("✓ Unauthenticated access rejected")


class TestSiteStatus:
    """Site status and opening hours tests"""
    
    def test_get_site_status(self):
        """GET /api/site-status/{location_id} returns is_open status"""
        response = requests.get(f"{BASE_URL}/api/site-status/{TEST_LOCATION_ID}")
        assert response.status_code == 200
        data = response.json()
        
        assert "is_open" in data, "Response should contain is_open"
        assert "location_id" in data
        assert data["location_id"] == TEST_LOCATION_ID
        assert "opening_hours" in data
        print(f"✓ Site status for {TEST_LOCATION_ID}: is_open={data['is_open']}")
    
    def test_get_site_status_all_locations(self):
        """Check site status for all 5 locations"""
        locations = [
            "timperley-altrincham",
            "howe-bridge-atherton",
            "chaddesden-derby",
            "oakmere-handforth",
            "willowmere-middlewich"
        ]
        for loc in locations:
            response = requests.get(f"{BASE_URL}/api/site-status/{loc}")
            assert response.status_code == 200
            data = response.json()
            assert "is_open" in data
            print(f"  - {loc}: is_open={data['is_open']}")
        print("✓ All 5 locations have site status")


class TestOrders:
    """Order creation and tracking tests"""
    
    @pytest.fixture(scope="class")
    def verified_customer(self):
        """Create a verified customer for order tests"""
        email = f"order_test_{uuid.uuid4().hex[:8]}@example.com"
        response = requests.post(f"{BASE_URL}/api/customer/register", json={
            "name": "Order Test Customer",
            "email": email,
            "phone": "+447555666777"
        })
        assert response.status_code == 200
        data = response.json()
        return {
            "email": email,
            "password": data["password"],
            "token": data["token"],
            "customer_id": data["customer_id"]
        }
    
    def test_create_order_success(self, verified_customer):
        """POST /api/orders creates order when customer is verified and site is open"""
        order_data = {
            "location_id": TEST_LOCATION_ID,
            "items": [
                {"menu_item_id": "1", "name": "Truffle Mushroom Risotto", "price": 28.99, "quantity": 2},
                {"menu_item_id": "3", "name": "Crispy Calamari Rings", "price": 16.99, "quantity": 1}
            ],
            "special_instructions": "No onions please"
        }
        response = requests.post(
            f"{BASE_URL}/api/orders",
            json=order_data,
            headers={"Authorization": f"Bearer {verified_customer['token']}"}
        )
        assert response.status_code == 200, f"Order creation failed: {response.text}"
        data = response.json()
        
        assert "order" in data
        order = data["order"]
        assert order["order_number"].startswith("JK-"), f"Order number should start with JK-, got: {order['order_number']}"
        assert order["status"] == "pending"
        assert order["total"] == round(28.99 * 2 + 16.99, 2)
        assert order["location_id"] == TEST_LOCATION_ID
        assert len(order["items"]) == 2
        
        # Store for tracking test
        self.__class__.created_order_number = order["order_number"]
        print(f"✓ Order created: {order['order_number']}")
        print(f"  - Total: £{order['total']}")
        print(f"  - Status: {order['status']}")
    
    def test_create_order_without_auth(self):
        """Order creation fails without authentication"""
        order_data = {
            "location_id": TEST_LOCATION_ID,
            "items": [{"menu_item_id": "1", "name": "Test Item", "price": 10.00, "quantity": 1}]
        }
        response = requests.post(f"{BASE_URL}/api/orders", json=order_data)
        assert response.status_code == 401
        print("✓ Unauthenticated order rejected")
    
    def test_track_order_success(self):
        """GET /api/orders/track/{order_number} returns order details"""
        order_number = getattr(self.__class__, 'created_order_number', None)
        if not order_number:
            pytest.skip("No order created in previous test")
        
        response = requests.get(f"{BASE_URL}/api/orders/track/{order_number}")
        assert response.status_code == 200
        data = response.json()
        
        assert data["order_number"] == order_number
        assert "status" in data
        assert "items" in data
        assert "total" in data
        print(f"✓ Order tracked: {order_number}")
        print(f"  - Status: {data['status']}")
    
    def test_track_order_not_found(self):
        """Tracking non-existent order returns 404"""
        response = requests.get(f"{BASE_URL}/api/orders/track/JK-NOTEXIST")
        assert response.status_code == 404
        print("✓ Non-existent order returns 404")


class TestAdminAuth:
    """Admin authentication tests"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Login as admin and return session with cookies"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@jollys.com",
            "password": "Admin123!"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return session
    
    def test_admin_login(self, admin_session):
        """Admin login works with correct credentials"""
        # Already logged in via fixture
        response = admin_session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "admin"
        print(f"✓ Admin logged in: {data['email']}")


class TestAdminOrders:
    """Admin order management tests"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Login as admin"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@jollys.com",
            "password": "Admin123!"
        })
        assert response.status_code == 200
        return session
    
    @pytest.fixture(scope="class")
    def test_order(self, admin_session):
        """Create a test order for admin tests"""
        # First create a customer
        email = f"admin_order_test_{uuid.uuid4().hex[:8]}@example.com"
        reg_response = requests.post(f"{BASE_URL}/api/customer/register", json={
            "name": "Admin Order Test",
            "email": email,
            "phone": "+447888999000"
        })
        assert reg_response.status_code == 200
        customer_data = reg_response.json()
        
        # Create order
        order_response = requests.post(
            f"{BASE_URL}/api/orders",
            json={
                "location_id": TEST_LOCATION_ID,
                "items": [{"menu_item_id": "1", "name": "Test Item", "price": 15.00, "quantity": 1}]
            },
            headers={"Authorization": f"Bearer {customer_data['token']}"}
        )
        assert order_response.status_code == 200
        return order_response.json()["order"]
    
    def test_admin_list_orders(self, admin_session):
        """GET /api/admin/orders lists orders (admin auth required)"""
        response = admin_session.get(f"{BASE_URL}/api/admin/orders")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        print(f"✓ Admin can list orders: {len(data)} orders found")
    
    def test_admin_list_orders_without_auth(self):
        """Admin orders endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/orders")
        assert response.status_code == 401
        print("✓ Unauthenticated admin access rejected")
    
    def test_admin_update_order_status_flow(self, admin_session, test_order):
        """PATCH /api/admin/orders/{order_id}/status updates order through flow"""
        order_id = test_order["id"]
        status_flow = ["confirmed", "preparing", "ready", "collected"]
        
        for new_status in status_flow:
            response = admin_session.patch(
                f"{BASE_URL}/api/admin/orders/{order_id}/status",
                json={"status": new_status}
            )
            assert response.status_code == 200, f"Failed to update to {new_status}: {response.text}"
            data = response.json()
            assert data["status"] == new_status
            print(f"  - Updated to: {new_status}")
        
        print(f"✓ Order status flow complete: pending -> confirmed -> preparing -> ready -> collected")
    
    def test_admin_cancel_order(self, admin_session):
        """Admin can cancel an order"""
        # Create a new order to cancel
        email = f"cancel_test_{uuid.uuid4().hex[:8]}@example.com"
        reg_response = requests.post(f"{BASE_URL}/api/customer/register", json={
            "name": "Cancel Test",
            "email": email,
            "phone": "+447111222333"
        })
        customer_data = reg_response.json()
        
        order_response = requests.post(
            f"{BASE_URL}/api/orders",
            json={
                "location_id": TEST_LOCATION_ID,
                "items": [{"menu_item_id": "1", "name": "Test", "price": 10.00, "quantity": 1}]
            },
            headers={"Authorization": f"Bearer {customer_data['token']}"}
        )
        order = order_response.json()["order"]
        
        # Cancel it
        response = admin_session.patch(
            f"{BASE_URL}/api/admin/orders/{order['id']}/status",
            json={"status": "cancelled"}
        )
        assert response.status_code == 200
        assert response.json()["status"] == "cancelled"
        print("✓ Admin can cancel orders")


class TestAdminSiteSettings:
    """Admin site settings management tests"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Login as admin"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@jollys.com",
            "password": "Admin123!"
        })
        assert response.status_code == 200
        return session
    
    def test_admin_get_site_settings(self, admin_session):
        """GET /api/admin/site-settings returns all 5 location settings"""
        response = admin_session.get(f"{BASE_URL}/api/admin/site-settings")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) == 5, f"Expected 5 locations, got {len(data)}"
        
        for setting in data:
            assert "location_id" in setting
            assert "ordering_enabled" in setting
            assert "manual_override" in setting
            assert "opening_hours" in setting
            print(f"  - {setting['location_id']}: enabled={setting['ordering_enabled']}, override={setting['manual_override']}")
        
        print("✓ All 5 location settings retrieved")
    
    def test_admin_update_opening_hours(self, admin_session):
        """PUT /api/admin/site-settings/{location_id} updates opening hours"""
        new_hours = {
            "monday": {"open": "09:00", "close": "18:00"},
            "tuesday": {"open": "09:00", "close": "18:00"},
            "wednesday": {"open": "09:00", "close": "18:00"},
            "thursday": {"open": "09:00", "close": "18:00"},
            "friday": {"open": "09:00", "close": "20:00"},
            "saturday": {"open": "10:00", "close": "17:00"},
            "sunday": {"open": "11:00", "close": "16:00"},
        }
        
        response = admin_session.put(
            f"{BASE_URL}/api/admin/site-settings/{TEST_LOCATION_ID}",
            json={"opening_hours": new_hours}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["opening_hours"]["monday"]["open"] == "09:00"
        assert data["opening_hours"]["friday"]["close"] == "20:00"
        print(f"✓ Opening hours updated for {TEST_LOCATION_ID}")
        
        # Restore original hours
        original_hours = {
            "monday": {"open": "08:00", "close": "17:00"},
            "tuesday": {"open": "08:00", "close": "17:00"},
            "wednesday": {"open": "08:00", "close": "17:00"},
            "thursday": {"open": "08:00", "close": "17:00"},
            "friday": {"open": "08:00", "close": "18:00"},
            "saturday": {"open": "09:00", "close": "16:00"},
            "sunday": {"open": "10:00", "close": "15:00"},
        }
        admin_session.put(
            f"{BASE_URL}/api/admin/site-settings/{TEST_LOCATION_ID}",
            json={"opening_hours": original_hours}
        )
    
    def test_admin_toggle_ordering(self, admin_session):
        """PATCH /api/admin/site-settings/{location_id}/toggle toggles ordering with manual_override=true"""
        # Get current state
        response = admin_session.get(f"{BASE_URL}/api/admin/site-settings")
        settings = response.json()
        location_setting = next(s for s in settings if s["location_id"] == TEST_LOCATION_ID)
        original_enabled = location_setting["ordering_enabled"]
        
        # Toggle
        response = admin_session.patch(f"{BASE_URL}/api/admin/site-settings/{TEST_LOCATION_ID}/toggle")
        assert response.status_code == 200
        data = response.json()
        
        assert data["ordering_enabled"] != original_enabled, "Ordering should be toggled"
        assert data["manual_override"] == True, "Manual override should be set to true"
        print(f"✓ Ordering toggled: {original_enabled} -> {data['ordering_enabled']}")
        
        # Toggle back
        admin_session.patch(f"{BASE_URL}/api/admin/site-settings/{TEST_LOCATION_ID}/toggle")
        print("  - Toggled back to original state")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
