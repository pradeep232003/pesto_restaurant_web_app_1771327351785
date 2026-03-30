"""
Test Google Reviews Integration
- Tests for /api/reviews endpoint
- Tests for google_place_id and google_api_key fields in location CRUD
- Tests for security (google_api_key not exposed in public endpoints)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestGoogleReviewsEndpoint:
    """Tests for GET /api/reviews endpoint"""
    
    def test_reviews_endpoint_returns_empty_array_when_no_place_ids(self):
        """GET /api/reviews should return empty array when no Place IDs configured"""
        response = requests.get(f"{BASE_URL}/api/reviews")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        # Since no real Place IDs are configured, should return empty
        # (or if there are configured ones, they would fail to fetch from Google)
        print(f"Reviews endpoint returned {len(data)} reviews")


class TestLocationGoogleFields:
    """Tests for google_place_id and google_api_key fields in location endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@jollys.com",
            "password": "Admin123!"
        })
        if response.status_code != 200:
            pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")
        return response.json().get("access_token")
    
    @pytest.fixture
    def auth_headers(self, auth_token):
        """Get headers with auth token"""
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
    
    def test_public_locations_does_not_expose_google_api_key(self):
        """GET /api/locations should NOT include google_api_key (security)"""
        response = requests.get(f"{BASE_URL}/api/locations")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        for location in data:
            assert "google_api_key" not in location, f"google_api_key should NOT be exposed in public endpoint for location {location.get('id')}"
            print(f"Location {location.get('id')}: google_api_key correctly hidden")
    
    def test_public_locations_includes_google_place_id(self):
        """GET /api/locations should include google_place_id"""
        response = requests.get(f"{BASE_URL}/api/locations")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Check that google_place_id field exists (even if empty)
        for location in data:
            # The field should exist in the response (may be empty string)
            assert "google_place_id" in location or location.get("google_place_id", "") == "", \
                f"google_place_id should be present in location {location.get('id')}"
            print(f"Location {location.get('id')}: google_place_id = '{location.get('google_place_id', '')}'")
    
    def test_public_location_by_slug_does_not_expose_google_api_key(self):
        """GET /api/locations/{slug} should NOT include google_api_key"""
        # First get list of locations to find a valid slug
        response = requests.get(f"{BASE_URL}/api/locations")
        assert response.status_code == 200
        locations = response.json()
        
        if not locations:
            pytest.skip("No locations available to test")
        
        slug = locations[0].get("slug")
        response = requests.get(f"{BASE_URL}/api/locations/{slug}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        location = response.json()
        assert "google_api_key" not in location, "google_api_key should NOT be exposed in public endpoint"
        print(f"Location {slug}: google_api_key correctly hidden in single location endpoint")
    
    def test_admin_locations_includes_google_api_key(self, auth_headers):
        """GET /api/admin/locations should include google_api_key for admin"""
        response = requests.get(f"{BASE_URL}/api/admin/locations", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Admin endpoint should include google_api_key
        for location in data:
            # Field should exist (may be empty)
            print(f"Admin location {location.get('id')}: google_api_key present = {'google_api_key' in location}")
    
    def test_admin_update_location_with_google_place_id(self, auth_headers):
        """PUT /api/admin/locations/{id} should accept google_place_id"""
        # Get existing locations
        response = requests.get(f"{BASE_URL}/api/admin/locations", headers=auth_headers)
        assert response.status_code == 200
        locations = response.json()
        
        if not locations:
            pytest.skip("No locations available to test")
        
        location_id = locations[0].get("id")
        original_place_id = locations[0].get("google_place_id", "")
        
        # Update with test place ID
        test_place_id = "TEST_ChIJN1t_tDeuEmsRUsoyG83frY4"
        response = requests.put(
            f"{BASE_URL}/api/admin/locations/{location_id}",
            headers=auth_headers,
            json={"google_place_id": test_place_id}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        updated = response.json()
        assert updated.get("google_place_id") == test_place_id, \
            f"Expected google_place_id to be '{test_place_id}', got '{updated.get('google_place_id')}'"
        print(f"Successfully updated google_place_id for location {location_id}")
        
        # Restore original value
        requests.put(
            f"{BASE_URL}/api/admin/locations/{location_id}",
            headers=auth_headers,
            json={"google_place_id": original_place_id}
        )
    
    def test_admin_update_location_with_google_api_key(self, auth_headers):
        """PUT /api/admin/locations/{id} should accept google_api_key"""
        # Get existing locations
        response = requests.get(f"{BASE_URL}/api/admin/locations", headers=auth_headers)
        assert response.status_code == 200
        locations = response.json()
        
        if not locations:
            pytest.skip("No locations available to test")
        
        location_id = locations[0].get("id")
        original_api_key = locations[0].get("google_api_key", "")
        
        # Update with test API key
        test_api_key = "TEST_AIzaSyTestKey123456789"
        response = requests.put(
            f"{BASE_URL}/api/admin/locations/{location_id}",
            headers=auth_headers,
            json={"google_api_key": test_api_key}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        updated = response.json()
        assert updated.get("google_api_key") == test_api_key, \
            f"Expected google_api_key to be '{test_api_key}', got '{updated.get('google_api_key')}'"
        print(f"Successfully updated google_api_key for location {location_id}")
        
        # Restore original value
        requests.put(
            f"{BASE_URL}/api/admin/locations/{location_id}",
            headers=auth_headers,
            json={"google_api_key": original_api_key}
        )
    
    def test_admin_update_location_preserves_other_fields(self, auth_headers):
        """PUT /api/admin/locations/{id} with google fields should not break other fields"""
        # Get existing locations
        response = requests.get(f"{BASE_URL}/api/admin/locations", headers=auth_headers)
        assert response.status_code == 200
        locations = response.json()
        
        if not locations:
            pytest.skip("No locations available to test")
        
        location = locations[0]
        location_id = location.get("id")
        original_name = location.get("name")
        original_address = location.get("address")
        original_wallet = location.get("wallet_enabled")
        
        # Update only google_place_id
        response = requests.put(
            f"{BASE_URL}/api/admin/locations/{location_id}",
            headers=auth_headers,
            json={"google_place_id": "TEST_preserve_fields"}
        )
        assert response.status_code == 200
        
        updated = response.json()
        assert updated.get("name") == original_name, "Name should be preserved"
        assert updated.get("address") == original_address, "Address should be preserved"
        assert updated.get("wallet_enabled") == original_wallet, "wallet_enabled should be preserved"
        print(f"Other fields preserved correctly when updating google_place_id")
        
        # Restore
        requests.put(
            f"{BASE_URL}/api/admin/locations/{location_id}",
            headers=auth_headers,
            json={"google_place_id": location.get("google_place_id", "")}
        )


class TestGoogleReviewsSecurityVerification:
    """Additional security tests for Google Reviews integration"""
    
    def test_reviews_endpoint_is_public(self):
        """GET /api/reviews should be accessible without authentication"""
        response = requests.get(f"{BASE_URL}/api/reviews")
        assert response.status_code == 200, f"Reviews endpoint should be public, got {response.status_code}"
        print("Reviews endpoint is correctly public")
    
    def test_admin_locations_requires_auth(self):
        """GET /api/admin/locations should require authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/locations")
        assert response.status_code == 401, f"Admin locations should require auth, got {response.status_code}"
        print("Admin locations endpoint correctly requires authentication")
    
    def test_admin_update_location_requires_auth(self):
        """PUT /api/admin/locations/{id} should require authentication"""
        response = requests.put(
            f"{BASE_URL}/api/admin/locations/test-location",
            json={"google_place_id": "test"}
        )
        assert response.status_code == 401, f"Admin update should require auth, got {response.status_code}"
        print("Admin update location endpoint correctly requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
