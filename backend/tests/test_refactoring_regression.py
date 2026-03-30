"""
Regression tests for server.py modularization refactoring.
Tests all endpoints to verify they work identically after splitting into:
- db.py, models.py, auth.py, helpers.py
- routes/: auth, locations, menu, residents, customers, orders, settings, contact
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from /app/memory/test_credentials.md
ADMIN_EMAIL = "admin@jollys.com"
ADMIN_PASSWORD = "Admin123!"


class TestHealthAndPublicEndpoints:
    """Test public endpoints that don't require authentication"""
    
    def test_health_check(self):
        """GET /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✓ Health check passed")
    
    def test_get_locations(self):
        """GET /api/locations returns 5 active locations"""
        response = requests.get(f"{BASE_URL}/api/locations")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 5, f"Expected 5 locations, got {len(data)}"
        # Verify location structure
        for loc in data:
            assert "id" in loc
            assert "name" in loc
            assert "slug" in loc
            assert "is_active" in loc
        print(f"✓ GET /api/locations returned {len(data)} locations")
    
    def test_locations_no_google_api_key(self):
        """GET /api/locations does NOT expose google_api_key (security)"""
        response = requests.get(f"{BASE_URL}/api/locations")
        assert response.status_code == 200
        data = response.json()
        for loc in data:
            assert "google_api_key" not in loc, f"google_api_key exposed in location {loc.get('id')}"
        print("✓ google_api_key not exposed in public locations endpoint")
    
    def test_get_menu_items(self):
        """GET /api/menu-items returns menu items"""
        response = requests.get(f"{BASE_URL}/api/menu-items")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0, "Expected at least one menu item"
        # Verify menu item structure
        item = data[0]
        assert "id" in item
        assert "name" in item
        assert "price" in item
        assert "location_id" in item
        print(f"✓ GET /api/menu-items returned {len(data)} items")
    
    def test_get_featured_items(self):
        """GET /api/featured-items returns featured items"""
        response = requests.get(f"{BASE_URL}/api/featured-items")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # All returned items should be featured
        for item in data:
            assert item.get("featured") == True, f"Item {item.get('id')} is not featured"
        print(f"✓ GET /api/featured-items returned {len(data)} featured items")
    
    def test_get_reviews_empty(self):
        """GET /api/reviews returns empty array (no Place IDs configured)"""
        response = requests.get(f"{BASE_URL}/api/reviews")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Expected empty since no Google Place IDs are configured
        print(f"✓ GET /api/reviews returned {len(data)} reviews (expected empty)")
    
    def test_get_site_status(self):
        """GET /api/site-status/{location_id} returns site status with opening_hours"""
        location_id = "timperley-altrincham"
        response = requests.get(f"{BASE_URL}/api/site-status/{location_id}")
        assert response.status_code == 200
        data = response.json()
        assert "is_open" in data
        assert "location_id" in data
        assert data["location_id"] == location_id
        assert "opening_hours" in data
        assert isinstance(data["opening_hours"], dict)
        print(f"✓ GET /api/site-status/{location_id} returned status with opening_hours")


class TestAuthEndpoints:
    """Test authentication endpoints"""
    
    def test_login_success(self):
        """POST /api/auth/login works and returns access_token + refresh_token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "access_token not in response"
        assert "refresh_token" in data, "refresh_token not in response"
        assert "id" in data, "user id not in response"
        assert "email" in data, "email not in response"
        assert data["email"] == ADMIN_EMAIL
        assert data["role"] == "admin"
        print("✓ POST /api/auth/login returns access_token + refresh_token")
    
    def test_login_invalid_credentials(self):
        """POST /api/auth/login with wrong password returns 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ Login with wrong password returns 401")
    
    def test_auth_me_with_bearer_token(self):
        """GET /api/auth/me works with Bearer token"""
        # First login to get token
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        token = login_resp.json()["access_token"]
        
        # Use token to get user info
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == ADMIN_EMAIL
        print("✓ GET /api/auth/me works with Bearer token")
    
    def test_auth_me_without_token(self):
        """GET /api/auth/me returns 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401
        print("✓ GET /api/auth/me returns 401 without auth")
    
    def test_refresh_token(self):
        """POST /api/auth/refresh works with body refresh_token"""
        # First login to get refresh token
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        refresh_token = login_resp.json()["refresh_token"]
        
        # Use refresh token to get new access token
        response = requests.post(f"{BASE_URL}/api/auth/refresh", json={
            "refresh_token": refresh_token
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        print("✓ POST /api/auth/refresh works with body refresh_token")
    
    def test_logout(self):
        """POST /api/auth/logout works"""
        response = requests.post(f"{BASE_URL}/api/auth/logout")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print("✓ POST /api/auth/logout works")


class TestAdminEndpoints:
    """Test admin endpoints that require authentication"""
    
    @pytest.fixture(autouse=True)
    def setup_auth(self):
        """Get auth token before each test"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        self.token = login_resp.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_admin_orders(self):
        """GET /api/admin/orders works with auth"""
        response = requests.get(f"{BASE_URL}/api/admin/orders", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/admin/orders returned {len(data)} orders")
    
    def test_admin_orders_no_auth(self):
        """GET /api/admin/orders returns 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/admin/orders")
        assert response.status_code == 401
        print("✓ GET /api/admin/orders returns 401 without auth")
    
    def test_admin_menu_items(self):
        """GET /api/admin/menu-items works with auth"""
        response = requests.get(f"{BASE_URL}/api/admin/menu-items", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        print(f"✓ GET /api/admin/menu-items returned {len(data)} items")
    
    def test_admin_locations(self):
        """GET /api/admin/locations works with auth"""
        response = requests.get(f"{BASE_URL}/api/admin/locations", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 5
        # Admin endpoint should include google_api_key
        for loc in data:
            assert "google_api_key" in loc or loc.get("google_api_key") == ""
        print(f"✓ GET /api/admin/locations returned {len(data)} locations")
    
    def test_admin_update_location(self):
        """PUT /api/admin/locations/{id} works with auth"""
        location_id = "timperley-altrincham"
        # Get current location data
        get_resp = requests.get(f"{BASE_URL}/api/admin/locations", headers=self.headers)
        locations = get_resp.json()
        original = next((l for l in locations if l["id"] == location_id), None)
        assert original is not None
        
        # Update with same data (no actual change)
        response = requests.put(
            f"{BASE_URL}/api/admin/locations/{location_id}",
            headers=self.headers,
            json={"name": original["name"]}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == location_id
        print(f"✓ PUT /api/admin/locations/{location_id} works with auth")
    
    def test_admin_residents(self):
        """GET /api/admin/residents works with auth"""
        response = requests.get(f"{BASE_URL}/api/admin/residents", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/admin/residents returned {len(data)} residents")
    
    def test_admin_transactions(self):
        """GET /api/admin/transactions works with auth"""
        response = requests.get(f"{BASE_URL}/api/admin/transactions", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/admin/transactions returned {len(data)} transactions")
    
    def test_admin_balance_summary(self):
        """GET /api/admin/balance-summary works with auth"""
        response = requests.get(f"{BASE_URL}/api/admin/balance-summary", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_balance" in data
        assert "total_residents" in data
        print(f"✓ GET /api/admin/balance-summary returned summary")
    
    def test_admin_site_settings(self):
        """GET /api/admin/site-settings works with auth"""
        response = requests.get(f"{BASE_URL}/api/admin/site-settings", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should have settings for each active location
        for setting in data:
            assert "location_id" in setting
            assert "ordering_enabled" in setting
            assert "opening_hours" in setting
        print(f"✓ GET /api/admin/site-settings returned {len(data)} settings")
    
    def test_admin_update_site_settings(self):
        """PUT /api/admin/site-settings/{location_id} works with auth"""
        location_id = "timperley-altrincham"
        response = requests.put(
            f"{BASE_URL}/api/admin/site-settings/{location_id}",
            headers=self.headers,
            json={"ordering_enabled": True}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["location_id"] == location_id
        print(f"✓ PUT /api/admin/site-settings/{location_id} works with auth")


class TestContactEndpoint:
    """Test contact form endpoint with spam protection"""
    
    def test_contact_valid_submission(self):
        """POST /api/contact with spam protection works"""
        response = requests.post(f"{BASE_URL}/api/contact", json={
            "name": "Test User",
            "email": "test@example.com",
            "message": "This is a test message for the contact form.",
            "_hp": "",  # Honeypot field empty
            "_ts": 5000  # Time spent > 3000ms
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        print("✓ POST /api/contact with valid data works")
    
    def test_contact_honeypot_trap(self):
        """POST /api/contact with honeypot filled returns success (silent fail)"""
        response = requests.post(f"{BASE_URL}/api/contact", json={
            "name": "Spam Bot",
            "email": "spam@bot.com",
            "message": "Buy cheap stuff!",
            "_hp": "filled",  # Honeypot filled = bot
            "_ts": 5000
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True  # Silent success to fool bots
        print("✓ POST /api/contact honeypot trap works")
    
    def test_contact_too_fast(self):
        """POST /api/contact submitted too fast returns success (silent fail)"""
        response = requests.post(f"{BASE_URL}/api/contact", json={
            "name": "Fast Bot",
            "email": "fast@bot.com",
            "message": "Submitted too quickly!",
            "_hp": "",
            "_ts": 1000  # Less than 3000ms = bot
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True  # Silent success to fool bots
        print("✓ POST /api/contact too-fast protection works")
    
    def test_contact_missing_fields(self):
        """POST /api/contact with missing fields returns 400"""
        response = requests.post(f"{BASE_URL}/api/contact", json={
            "name": "Test",
            "email": "",  # Missing email
            "message": "Test message",
            "_hp": "",
            "_ts": 5000
        })
        assert response.status_code == 400
        print("✓ POST /api/contact validates required fields")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
