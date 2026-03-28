"""
Test suite for Location CRUD and wallet_enabled feature
Tests: Admin location management, wallet toggle, dynamic locations
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@jollys.com"
ADMIN_PASSWORD = "Admin123!"


class TestPublicLocationsAPI:
    """Test public GET /api/locations endpoint"""
    
    def test_get_locations_returns_active_locations(self):
        """GET /api/locations should return all active locations with wallet_enabled field"""
        response = requests.get(f"{BASE_URL}/api/locations")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) > 0, "Should have at least one location"
        
        # Check structure of first location
        loc = data[0]
        assert "id" in loc, "Location should have id"
        assert "name" in loc, "Location should have name"
        assert "slug" in loc, "Location should have slug"
        assert "wallet_enabled" in loc, "Location should have wallet_enabled field"
        assert "is_active" in loc, "Location should have is_active field"
        
        # All returned locations should be active
        for loc in data:
            assert loc.get("is_active") == True, f"Location {loc.get('id')} should be active"
        
        print(f"✓ GET /api/locations returned {len(data)} active locations")
        print(f"  Locations: {[l['name'] for l in data]}")
        
    def test_locations_have_wallet_enabled_field(self):
        """Verify wallet_enabled field exists and is boolean"""
        response = requests.get(f"{BASE_URL}/api/locations")
        assert response.status_code == 200
        
        data = response.json()
        wallet_enabled_count = 0
        for loc in data:
            assert "wallet_enabled" in loc, f"Location {loc.get('name')} missing wallet_enabled"
            assert isinstance(loc["wallet_enabled"], bool), f"wallet_enabled should be boolean"
            if loc["wallet_enabled"]:
                wallet_enabled_count += 1
        
        print(f"✓ All locations have wallet_enabled field")
        print(f"  Wallet-enabled locations: {wallet_enabled_count}/{len(data)}")


class TestAdminLocationCRUD:
    """Test admin location CRUD endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Get authenticated admin session with cookies"""
        session = requests.Session()
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_response.status_code == 200, f"Admin login failed: {login_response.text}"
        print(f"✓ Admin logged in successfully")
        return session
    
    def test_admin_get_all_locations(self, admin_session):
        """GET /api/admin/locations returns all locations including inactive"""
        response = admin_session.get(f"{BASE_URL}/api/admin/locations")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Admin GET /api/admin/locations returned {len(data)} locations (including inactive)")
    
    def test_admin_create_location(self, admin_session):
        """POST /api/admin/locations creates a new location"""
        unique_name = f"TEST-Location-{uuid.uuid4().hex[:6]}"
        
        response = admin_session.post(
            f"{BASE_URL}/api/admin/locations",
            json={
                "name": unique_name,
                "address": "123 Test Street",
                "wallet_enabled": True
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["name"] == unique_name, "Name should match"
        assert data["wallet_enabled"] == True, "wallet_enabled should be True"
        assert data["is_active"] == True, "New location should be active"
        assert "id" in data, "Should have id"
        assert "slug" in data, "Should have slug"
        
        # Verify it appears in public locations
        public_response = requests.get(f"{BASE_URL}/api/locations")
        public_data = public_response.json()
        found = any(loc["name"] == unique_name for loc in public_data)
        assert found, "New location should appear in public locations"
        
        print(f"✓ Created location: {unique_name} (id: {data['id']})")
        
        # Store for cleanup
        self.__class__.test_location_id = data["id"]
        self.__class__.test_location_name = unique_name
    
    def test_admin_create_location_auto_creates_site_settings(self, admin_session):
        """Creating a location should auto-create site_settings"""
        # Get site settings
        response = admin_session.get(f"{BASE_URL}/api/admin/site-settings")
        assert response.status_code == 200
        
        data = response.json()
        location_ids = [s["location_id"] for s in data]
        
        # Check if our test location has site settings
        if hasattr(self.__class__, 'test_location_id'):
            assert self.__class__.test_location_id in location_ids, \
                "New location should have auto-created site settings"
            print(f"✓ Site settings auto-created for {self.__class__.test_location_id}")
    
    def test_admin_update_location_wallet_toggle(self, admin_session):
        """PUT /api/admin/locations/{id} can toggle wallet_enabled"""
        if not hasattr(self.__class__, 'test_location_id'):
            pytest.skip("No test location created")
        
        location_id = self.__class__.test_location_id
        
        # Toggle wallet_enabled to False
        response = admin_session.put(
            f"{BASE_URL}/api/admin/locations/{location_id}",
            json={"wallet_enabled": False}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["wallet_enabled"] == False, "wallet_enabled should be False"
        
        # Toggle back to True
        response = admin_session.put(
            f"{BASE_URL}/api/admin/locations/{location_id}",
            json={"wallet_enabled": True}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["wallet_enabled"] == True, "wallet_enabled should be True"
        
        print(f"✓ Wallet toggle works for location {location_id}")
    
    def test_admin_update_location_name(self, admin_session):
        """PUT /api/admin/locations/{id} can update name"""
        if not hasattr(self.__class__, 'test_location_id'):
            pytest.skip("No test location created")
        
        location_id = self.__class__.test_location_id
        new_name = f"TEST-Updated-{uuid.uuid4().hex[:4]}"
        
        response = admin_session.put(
            f"{BASE_URL}/api/admin/locations/{location_id}",
            json={"name": new_name}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["name"] == new_name, "Name should be updated"
        
        self.__class__.test_location_name = new_name
        print(f"✓ Location name updated to: {new_name}")
    
    def test_admin_delete_location_soft_delete(self, admin_session):
        """DELETE /api/admin/locations/{id} soft-deletes (sets is_active=False)"""
        if not hasattr(self.__class__, 'test_location_id'):
            pytest.skip("No test location created")
        
        location_id = self.__class__.test_location_id
        
        response = admin_session.delete(f"{BASE_URL}/api/admin/locations/{location_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "deactivated" in data.get("message", "").lower() or data.get("is_active") == False, \
            "Should indicate deactivation"
        
        # Verify it's no longer in public locations
        public_response = requests.get(f"{BASE_URL}/api/locations")
        public_data = public_response.json()
        found = any(loc["id"] == location_id for loc in public_data)
        assert not found, "Deleted location should not appear in public locations"
        
        # But should still exist in admin locations
        admin_response = admin_session.get(f"{BASE_URL}/api/admin/locations")
        admin_data = admin_response.json()
        admin_found = any(loc["id"] == location_id for loc in admin_data)
        assert admin_found, "Soft-deleted location should still exist in admin view"
        
        print(f"✓ Location {location_id} soft-deleted (is_active=False)")
    
    def test_admin_create_duplicate_location_fails(self, admin_session):
        """POST /api/admin/locations with duplicate name should fail"""
        # First, get an existing location name
        response = admin_session.get(f"{BASE_URL}/api/admin/locations")
        data = response.json()
        if not data:
            pytest.skip("No existing locations")
        
        existing_name = data[0]["name"]
        
        # Try to create with same name
        response = admin_session.post(
            f"{BASE_URL}/api/admin/locations",
            json={"name": existing_name, "address": "Duplicate Test"}
        )
        assert response.status_code == 400, f"Expected 400 for duplicate, got {response.status_code}"
        print(f"✓ Duplicate location creation correctly rejected")


class TestAdminSiteSettings:
    """Test admin site settings endpoint"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Get authenticated admin session"""
        session = requests.Session()
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_response.status_code == 200
        return session
    
    def test_admin_get_site_settings_returns_active_only(self, admin_session):
        """GET /api/admin/site-settings returns settings for active locations only"""
        response = admin_session.get(f"{BASE_URL}/api/admin/site-settings")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Get active location IDs
        loc_response = requests.get(f"{BASE_URL}/api/locations")
        active_ids = [loc["id"] for loc in loc_response.json()]
        
        # All site settings should be for active locations
        for setting in data:
            assert setting["location_id"] in active_ids, \
                f"Site setting for {setting['location_id']} should be for active location"
        
        print(f"✓ GET /api/admin/site-settings returned {len(data)} settings for active locations")


class TestAuthRequired:
    """Test that admin endpoints require authentication"""
    
    def test_admin_locations_requires_auth(self):
        """GET /api/admin/locations requires authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/locations")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ GET /api/admin/locations requires auth")
    
    def test_admin_create_location_requires_auth(self):
        """POST /api/admin/locations requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/admin/locations",
            json={"name": "Unauthorized Test", "address": "Test"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ POST /api/admin/locations requires auth")
    
    def test_admin_update_location_requires_auth(self):
        """PUT /api/admin/locations/{id} requires authentication"""
        response = requests.put(
            f"{BASE_URL}/api/admin/locations/test-id",
            json={"name": "Unauthorized Update"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ PUT /api/admin/locations requires auth")
    
    def test_admin_delete_location_requires_auth(self):
        """DELETE /api/admin/locations/{id} requires authentication"""
        response = requests.delete(f"{BASE_URL}/api/admin/locations/test-id")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ DELETE /api/admin/locations requires auth")
    
    def test_admin_site_settings_requires_auth(self):
        """GET /api/admin/site-settings requires authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/site-settings")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ GET /api/admin/site-settings requires auth")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
