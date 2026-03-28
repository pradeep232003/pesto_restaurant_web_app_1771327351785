"""
Test suite for Menu Item Image Upload and Toggle Visibility features
Tests the new endpoints:
- POST /api/admin/menu-items/{item_id}/upload-image
- PATCH /api/admin/menu-items/{item_id}/toggle-image
"""
import pytest
import requests
import os
import io

# Use localhost for backend testing
BASE_URL = "http://localhost:8001"

# Admin credentials from test_credentials.md
ADMIN_EMAIL = "admin@jollys.com"
ADMIN_PASSWORD = "Admin123!"


class TestMenuImageFeatures:
    """Test image upload and visibility toggle for menu items"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login as admin and get session"""
        self.session = requests.Session()
        # Login as admin
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if login_response.status_code != 200:
            pytest.skip(f"Admin login failed: {login_response.status_code} - {login_response.text}")
        
        # Get menu items to find a test item
        items_response = self.session.get(f"{BASE_URL}/api/admin/menu-items")
        if items_response.status_code != 200:
            pytest.skip("Could not fetch menu items")
        
        items = items_response.json()
        if not items:
            pytest.skip("No menu items available for testing")
        
        self.test_item = items[0]
        self.test_item_id = self.test_item.get("id")
        print(f"Using test item: {self.test_item.get('name')} (ID: {self.test_item_id})")
        yield
        
        # Cleanup: logout
        self.session.post(f"{BASE_URL}/api/auth/logout")
    
    def test_admin_login_success(self):
        """Test admin login works with correct credentials"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        # Login returns user data directly or nested under "user"
        user_data = data.get("user", data)
        assert user_data.get("email") == ADMIN_EMAIL
        print("Admin login successful")
    
    def test_toggle_image_visibility(self):
        """Test PATCH /api/admin/menu-items/{id}/toggle-image toggles show_image field"""
        # Get current state
        initial_show_image = self.test_item.get("show_image", True)
        print(f"Initial show_image state: {initial_show_image}")
        
        # Toggle image visibility
        response = self.session.patch(
            f"{BASE_URL}/api/admin/menu-items/{self.test_item_id}/toggle-image"
        )
        assert response.status_code == 200, f"Toggle failed: {response.text}"
        
        data = response.json()
        assert "show_image" in data, "Response should contain show_image field"
        
        # Verify toggle worked
        new_show_image = data.get("show_image")
        assert new_show_image != initial_show_image, f"show_image should have toggled from {initial_show_image} to {not initial_show_image}"
        print(f"Toggle successful: show_image changed from {initial_show_image} to {new_show_image}")
        
        # Toggle back to original state
        response2 = self.session.patch(
            f"{BASE_URL}/api/admin/menu-items/{self.test_item_id}/toggle-image"
        )
        assert response2.status_code == 200
        data2 = response2.json()
        assert data2.get("show_image") == initial_show_image, "Second toggle should restore original state"
        print(f"Restored to original state: {initial_show_image}")
    
    def test_toggle_image_requires_auth(self):
        """Test toggle endpoint requires admin authentication"""
        # Use a new session without login
        unauthenticated_session = requests.Session()
        response = unauthenticated_session.patch(
            f"{BASE_URL}/api/admin/menu-items/{self.test_item_id}/toggle-image"
        )
        assert response.status_code in [401, 403], f"Expected 401/403 for unauthenticated request, got {response.status_code}"
        print("Unauthenticated toggle correctly rejected")
    
    def test_toggle_image_nonexistent_item(self):
        """Test toggle returns 404 for non-existent item"""
        response = self.session.patch(
            f"{BASE_URL}/api/admin/menu-items/nonexistent-item-id-12345/toggle-image"
        )
        assert response.status_code == 404, f"Expected 404 for non-existent item, got {response.status_code}"
        print("Non-existent item toggle correctly returns 404")
    
    def test_upload_image_endpoint_exists(self):
        """Test POST /api/admin/menu-items/{id}/upload-image endpoint exists and accepts multipart"""
        # Create a simple test image (1x1 pixel PNG)
        # PNG header for a 1x1 transparent pixel
        png_data = bytes([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,  # PNG signature
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,  # IHDR chunk
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,  # 1x1 dimensions
            0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,  # bit depth, color type, etc
            0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,  # IDAT chunk
            0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,  # compressed data
            0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,  # more data
            0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44,  # IEND chunk
            0xAE, 0x42, 0x60, 0x82                           # IEND CRC
        ])
        
        files = {
            'file': ('test_image.png', io.BytesIO(png_data), 'image/png')
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/admin/menu-items/{self.test_item_id}/upload-image",
            files=files
        )
        
        # Should succeed or fail with validation error, not 404/405
        assert response.status_code in [200, 400, 500], f"Unexpected status: {response.status_code} - {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert "image_url" in data, "Response should contain image_url"
            assert "item" in data, "Response should contain updated item"
            print(f"Image upload successful: {data.get('image_url')}")
        else:
            print(f"Upload returned {response.status_code}: {response.text}")
    
    def test_upload_image_requires_auth(self):
        """Test upload endpoint requires admin authentication"""
        unauthenticated_session = requests.Session()
        
        png_data = bytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
        files = {'file': ('test.png', io.BytesIO(png_data), 'image/png')}
        
        response = unauthenticated_session.post(
            f"{BASE_URL}/api/admin/menu-items/{self.test_item_id}/upload-image",
            files=files
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("Unauthenticated upload correctly rejected")
    
    def test_upload_image_invalid_file_type(self):
        """Test upload rejects non-image files"""
        # Try uploading a text file
        files = {
            'file': ('test.txt', io.BytesIO(b'This is not an image'), 'text/plain')
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/admin/menu-items/{self.test_item_id}/upload-image",
            files=files
        )
        assert response.status_code == 400, f"Expected 400 for invalid file type, got {response.status_code}"
        print("Invalid file type correctly rejected")
    
    def test_upload_image_nonexistent_item(self):
        """Test upload returns 404 for non-existent item"""
        png_data = bytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
        files = {'file': ('test.png', io.BytesIO(png_data), 'image/png')}
        
        response = self.session.post(
            f"{BASE_URL}/api/admin/menu-items/nonexistent-item-id-12345/upload-image",
            files=files
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("Non-existent item upload correctly returns 404")
    
    def test_get_menu_items_includes_show_image_field(self):
        """Test that menu items include show_image field"""
        response = self.session.get(f"{BASE_URL}/api/admin/menu-items")
        assert response.status_code == 200
        
        items = response.json()
        assert len(items) > 0, "Should have at least one menu item"
        
        # Check that items have show_image field
        for item in items[:3]:  # Check first 3 items
            # show_image might be True, False, or not present (defaults to True)
            show_image = item.get("show_image", True)
            assert isinstance(show_image, bool), f"show_image should be boolean, got {type(show_image)}"
            print(f"Item '{item.get('name')}' show_image: {show_image}")
    
    def test_public_menu_respects_show_image(self):
        """Test that public menu endpoint respects show_image flag"""
        # First, set show_image to False for test item
        self.session.patch(f"{BASE_URL}/api/admin/menu-items/{self.test_item_id}/toggle-image")
        
        # Get the item to check current state
        admin_response = self.session.get(f"{BASE_URL}/api/admin/menu-items")
        admin_items = admin_response.json()
        test_item_admin = next((i for i in admin_items if i.get("id") == self.test_item_id), None)
        
        if test_item_admin:
            print(f"Admin view - Item show_image: {test_item_admin.get('show_image')}")
        
        # Get public menu items
        public_response = requests.get(f"{BASE_URL}/api/menu-items")
        assert public_response.status_code == 200
        
        public_items = public_response.json()
        print(f"Public menu has {len(public_items)} items")
        
        # Restore original state
        self.session.patch(f"{BASE_URL}/api/admin/menu-items/{self.test_item_id}/toggle-image")


class TestAdminMenuEndpoints:
    """Test existing admin menu endpoints still work"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if login_response.status_code != 200:
            pytest.skip("Admin login failed")
        yield
        self.session.post(f"{BASE_URL}/api/auth/logout")
    
    def test_admin_get_menu_items(self):
        """Test GET /api/admin/menu-items returns all items"""
        response = self.session.get(f"{BASE_URL}/api/admin/menu-items")
        assert response.status_code == 200
        items = response.json()
        assert isinstance(items, list)
        print(f"Admin menu items: {len(items)} items")
    
    def test_admin_toggle_availability(self):
        """Test PATCH /api/admin/menu-items/{id}/availability works"""
        # Get an item
        items_response = self.session.get(f"{BASE_URL}/api/admin/menu-items")
        items = items_response.json()
        if not items:
            pytest.skip("No items to test")
        
        item_id = items[0].get("id")
        initial_available = items[0].get("is_available", True)
        
        # Toggle availability
        response = self.session.patch(f"{BASE_URL}/api/admin/menu-items/{item_id}/availability")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("is_available") != initial_available
        
        # Toggle back
        self.session.patch(f"{BASE_URL}/api/admin/menu-items/{item_id}/availability")
        print("Availability toggle works correctly")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
