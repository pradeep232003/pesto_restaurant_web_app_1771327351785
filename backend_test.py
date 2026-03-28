#!/usr/bin/env python3
"""
Backend API Testing for Pesto Restaurant Web App
Tests MongoDB integration and Admin Authentication
"""

import requests
import sys
import json
import time
from datetime import datetime

class PestoAPITester:
    def __init__(self, base_url="https://3a4be02d-b92e-46d8-9044-932fe25694f9.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.session = requests.Session()  # Use session to maintain cookies
        self.admin_credentials = {
            "email": "admin@jollys.com",
            "password": "Admin123!"
        }

    def run_test(self, name, method, endpoint, expected_status, data=None, expected_fields=None, use_auth=False):
        """Run a single API test"""
        url = f"{self.base_url}{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            # Use session for authenticated requests to maintain cookies
            if use_auth:
                if method == 'GET':
                    response = self.session.get(url, headers=headers, timeout=10)
                elif method == 'POST':
                    response = self.session.post(url, json=data, headers=headers, timeout=10)
                elif method == 'PUT':
                    response = self.session.put(url, json=data, headers=headers, timeout=10)
                elif method == 'PATCH':
                    response = self.session.patch(url, json=data, headers=headers, timeout=10)
                elif method == 'DELETE':
                    response = self.session.delete(url, headers=headers, timeout=10)
            else:
                if method == 'GET':
                    response = requests.get(url, headers=headers, timeout=10)
                elif method == 'POST':
                    response = requests.post(url, json=data, headers=headers, timeout=10)

            success = response.status_code == expected_status
            response_data = {}
            
            try:
                response_data = response.json()
            except:
                response_data = {"raw_response": response.text}

            if success:
                # Additional validation for expected fields
                if expected_fields and isinstance(response_data, list) and len(response_data) > 0:
                    first_item = response_data[0]
                    missing_fields = [field for field in expected_fields if field not in first_item]
                    if missing_fields:
                        success = False
                        print(f"❌ Failed - Missing expected fields: {missing_fields}")
                    else:
                        print(f"✅ Passed - Status: {response.status_code}, Fields: {expected_fields}")
                elif expected_fields and isinstance(response_data, dict):
                    missing_fields = [field for field in expected_fields if field not in response_data]
                    if missing_fields:
                        success = False
                        print(f"❌ Failed - Missing expected fields: {missing_fields}")
                    else:
                        print(f"✅ Passed - Status: {response.status_code}, Fields: {expected_fields}")
                else:
                    print(f"✅ Passed - Status: {response.status_code}")
                
                if success:
                    self.tests_passed += 1
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}...")

            self.test_results.append({
                "name": name,
                "endpoint": endpoint,
                "method": method,
                "expected_status": expected_status,
                "actual_status": response.status_code,
                "success": success,
                "response_sample": str(response_data)[:200] if response_data else ""
            })

            return success, response_data

        except requests.exceptions.Timeout:
            print(f"❌ Failed - Request timeout")
            self.test_results.append({
                "name": name,
                "endpoint": endpoint,
                "method": method,
                "expected_status": expected_status,
                "actual_status": "TIMEOUT",
                "success": False,
                "response_sample": "Request timeout"
            })
            return False, {}
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.test_results.append({
                "name": name,
                "endpoint": endpoint,
                "method": method,
                "expected_status": expected_status,
                "actual_status": "ERROR",
                "success": False,
                "response_sample": str(e)
            })
            return False, {}

    # ============== AUTH TESTS ==============
    
    def test_admin_login_valid(self):
        """Test admin login with valid credentials"""
        success, response = self.run_test(
            "Admin Login (Valid Credentials)",
            "POST",
            "/api/auth/login",
            200,
            data=self.admin_credentials,
            expected_fields=["id", "email", "role"]
        )
        
        if success and response.get('role') == 'admin':
            print(f"   ✅ Successfully logged in as admin: {response.get('email')}")
        
        return success, response

    def test_admin_login_invalid_email(self):
        """Test admin login with invalid email"""
        invalid_creds = {
            "email": "invalid@example.com",
            "password": "Admin123!"
        }
        success, response = self.run_test(
            "Admin Login (Invalid Email)",
            "POST",
            "/api/auth/login",
            401,
            data=invalid_creds
        )
        return success, response

    def test_admin_login_invalid_password(self):
        """Test admin login with invalid password"""
        invalid_creds = {
            "email": "admin@jollys.com",
            "password": "WrongPassword123!"
        }
        success, response = self.run_test(
            "Admin Login (Invalid Password)",
            "POST",
            "/api/auth/login",
            401,
            data=invalid_creds
        )
        return success, response

    def test_get_current_user(self):
        """Test getting current authenticated user"""
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "/api/auth/me",
            200,
            use_auth=True,
            expected_fields=["id", "email", "role"]
        )
        
        if success and response.get('role') == 'admin':
            print(f"   ✅ Current user is admin: {response.get('email')}")
        
        return success, response

    def test_refresh_token(self):
        """Test token refresh"""
        success, response = self.run_test(
            "Refresh Token",
            "POST",
            "/api/auth/refresh",
            200,
            use_auth=True,
            expected_fields=["id", "email", "role"]
        )
        return success, response

    def test_admin_logout(self):
        """Test admin logout"""
        success, response = self.run_test(
            "Admin Logout",
            "POST",
            "/api/auth/logout",
            200,
            use_auth=True,
            expected_fields=["message"]
        )
        
        if success and "logged out" in response.get('message', '').lower():
            print(f"   ✅ Successfully logged out")
        
        return success, response

    def test_unauthorized_access(self):
        """Test accessing admin endpoints without authentication"""
        success, response = self.run_test(
            "Unauthorized Admin Access",
            "GET",
            "/api/admin/menu-items",
            401
        )
        
        if success:
            print(f"   ✅ Properly blocked unauthorized access")
        
        return success, response

    def test_brute_force_protection(self):
        """Test brute force protection after multiple failed attempts"""
        print(f"\n🔒 Testing Brute Force Protection...")
        
        # Make 5 failed login attempts
        invalid_creds = {
            "email": "admin@jollys.com",
            "password": "WrongPassword"
        }
        
        for i in range(5):
            print(f"   Attempt {i+1}/5...")
            response = requests.post(
                f"{self.base_url}/api/auth/login",
                json=invalid_creds,
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            if response.status_code != 401:
                print(f"   ⚠️  Expected 401, got {response.status_code}")
        
        # 6th attempt should be blocked with 429
        print(f"   Attempt 6 (should be blocked)...")
        response = requests.post(
            f"{self.base_url}/api/auth/login",
            json=invalid_creds,
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        
        self.tests_run += 1
        if response.status_code == 429:
            self.tests_passed += 1
            print(f"   ✅ Brute force protection working - got 429 status")
            return True, response.json() if response.content else {}
        else:
            print(f"   ❌ Brute force protection failed - expected 429, got {response.status_code}")
            return False, {}

    # ============== PUBLIC API TESTS ==============

    def test_health_check(self):
        """Test health check endpoint"""
        return self.run_test(
            "Health Check",
            "GET",
            "/api/health",
            200,
            expected_fields=["status", "app", "database"]
        )

    def test_get_locations(self):
        """Test get all locations"""
        success, response = self.run_test(
            "Get All Locations",
            "GET",
            "/api/locations",
            200,
            expected_fields=["id", "name", "slug", "address", "is_active", "sort_order"]
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} locations")
            if len(response) >= 5:
                print(f"   ✅ Expected 5+ locations, got {len(response)}")
            else:
                print(f"   ⚠️  Expected 5+ locations, got {len(response)}")
        
        return success, response

    def test_get_location_by_slug(self, slug):
        """Test get location by slug"""
        return self.run_test(
            f"Get Location by Slug ({slug})",
            "GET",
            f"/api/locations/{slug}",
            200,
            expected_fields=["id", "name", "slug", "address"]
        )

    def test_get_menu_items_all(self):
        """Test get all menu items"""
        success, response = self.run_test(
            "Get All Menu Items",
            "GET",
            "/api/menu-items",
            200,
            expected_fields=["id", "location_id", "name", "price", "category"]
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} menu items")
            if len(response) >= 28:
                print(f"   ✅ Expected 28+ menu items, got {len(response)}")
            else:
                print(f"   ⚠️  Expected 28+ menu items, got {len(response)}")
        
        return success, response

    def test_get_menu_items_by_location(self, location_id):
        """Test get menu items filtered by location"""
        success, response = self.run_test(
            f"Get Menu Items by Location ({location_id})",
            "GET",
            f"/api/menu-items?location_id={location_id}",
            200,
            expected_fields=["id", "location_id", "name", "price", "category"]
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} items for location {location_id}")
            # Verify all items belong to the requested location
            wrong_location_items = [item for item in response if item.get('location_id') != location_id]
            if wrong_location_items:
                print(f"   ⚠️  Found {len(wrong_location_items)} items with wrong location_id")
            else:
                print(f"   ✅ All items belong to location {location_id}")
        
        return success, response

    def test_get_menu_items_by_category(self, category):
        """Test get menu items filtered by category"""
        success, response = self.run_test(
            f"Get Menu Items by Category ({category})",
            "GET",
            f"/api/menu-items?category={category}",
            200,
            expected_fields=["id", "category", "name", "price"]
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} items for category {category}")
        
        return success, response

    def test_get_featured_items(self):
        """Test get featured items"""
        success, response = self.run_test(
            "Get Featured Items",
            "GET",
            "/api/featured-items",
            200,
            expected_fields=["id", "name", "featured"]
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} featured items")
            # Verify all items are actually featured
            non_featured = [item for item in response if not item.get('featured')]
            if non_featured:
                print(f"   ⚠️  Found {len(non_featured)} non-featured items in featured endpoint")
            else:
                print(f"   ✅ All items are properly featured")
        
        return success, response

    def test_get_menu_item_by_id(self, item_id):
        """Test get single menu item by ID"""
        return self.run_test(
            f"Get Menu Item by ID ({item_id})",
            "GET",
            f"/api/menu-items/{item_id}",
            200,
            expected_fields=["id", "name", "price", "description"]
        )

    def test_404_endpoints(self):
        """Test 404 responses for non-existent resources"""
        # Test non-existent location
        self.run_test(
            "Non-existent Location (404)",
            "GET",
            "/api/locations/non-existent-location",
            404
        )
        
        # Test non-existent menu item
        self.run_test(
            "Non-existent Menu Item (404)",
            "GET",
            "/api/menu-items/999999",
            404
        )

    # ============== ADMIN CRUD TESTS (AUTHENTICATED) ==============
    
    def test_admin_get_menu_items(self):
        """Test admin get all menu items (including unavailable)"""
        success, response = self.run_test(
            "Admin Get All Menu Items",
            "GET",
            "/api/admin/menu-items",
            200,
            use_auth=True,
            expected_fields=["id", "location_id", "name", "price", "is_available"]
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} admin menu items")
            # Check if we have both available and unavailable items
            available_items = [item for item in response if item.get('is_available', True)]
            unavailable_items = [item for item in response if not item.get('is_available', True)]
            print(f"   Available: {len(available_items)}, Unavailable: {len(unavailable_items)}")
        
        return success, response

    def test_admin_get_menu_items_by_location(self, location_id):
        """Test admin get menu items filtered by location"""
        success, response = self.run_test(
            f"Admin Get Menu Items by Location ({location_id})",
            "GET",
            f"/api/admin/menu-items?location_id={location_id}",
            200,
            use_auth=True,
            expected_fields=["id", "location_id", "name", "price", "is_available"]
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} admin items for location {location_id}")
        
        return success, response

    def test_admin_create_menu_item(self):
        """Test creating a new menu item via admin API"""
        test_item = {
            "location_id": "timperley-altrincham",
            "name": "Test Admin Item",
            "subtitle": "Created via admin API test",
            "description": "This is a test item created by the admin CRUD test suite",
            "price": 15.99,
            "original_price": 18.99,
            "image_url": "https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b",
            "image_alt": "Test food item",
            "category": "mains",
            "categories": ["lunch", "dinner", "mains"],
            "dietary": ["vegetarian"],
            "tags": ["test", "admin"],
            "featured": True,
            "prep_time": 20,
            "is_available": True
        }
        
        success, response = self.run_test(
            "Admin Create Menu Item",
            "POST",
            "/api/admin/menu-items",
            201,  # Should be 201 for created
            data=test_item,
            use_auth=True,
            expected_fields=["id", "name", "price", "location_id"]
        )
        
        if success and 'id' in response:
            print(f"   Successfully created item with ID: {response['id']}")
            return success, response
        
        return success, response

    def test_admin_update_menu_item(self, item_id):
        """Test updating an existing menu item via admin API"""
        update_data = {
            "name": "Updated Test Admin Item",
            "price": 17.99,
            "description": "This item has been updated via admin API test",
            "featured": False
        }
        
        success, response = self.run_test(
            f"Admin Update Menu Item ({item_id})",
            "PUT",
            f"/api/admin/menu-items/{item_id}",
            200,
            data=update_data,
            use_auth=True,
            expected_fields=["id", "name", "price"]
        )
        
        if success and response.get('name') == "Updated Test Admin Item":
            print(f"   ✅ Item successfully updated")
        
        return success, response

    def test_admin_toggle_availability(self, item_id):
        """Test toggling menu item availability via admin API"""
        success, response = self.run_test(
            f"Admin Toggle Availability ({item_id})",
            "PATCH",
            f"/api/admin/menu-items/{item_id}/availability",
            200,
            use_auth=True,
            expected_fields=["id", "is_available"]
        )
        
        if success:
            availability = response.get('is_available')
            print(f"   ✅ Availability toggled to: {availability}")
        
        return success, response

    def test_admin_delete_menu_item(self, item_id):
        """Test deleting a menu item via admin API"""
        success, response = self.run_test(
            f"Admin Delete Menu Item ({item_id})",
            "DELETE",
            f"/api/admin/menu-items/{item_id}",
            200,
            use_auth=True,
            expected_fields=["message", "id"]
        )
        
        if success and response.get('id') == item_id:
            print(f"   ✅ Item successfully deleted")
        
        return success, response

def main():
    print("🍽️  Starting Pesto Restaurant API Tests (Admin Authentication + CRUD)")
    print("=" * 70)
    
    tester = PestoAPITester()
    created_item_id = None
    
    # ============== AUTHENTICATION TESTS ==============
    print("\n🔐 AUTHENTICATION TESTS")
    print("=" * 50)
    
    # Test 1: Test unauthorized access first
    tester.test_unauthorized_access()
    
    # Test 2: Test invalid login attempts
    tester.test_admin_login_invalid_email()
    tester.test_admin_login_invalid_password()
    
    # Test 3: Test valid admin login
    login_success, login_data = tester.test_admin_login_valid()
    if not login_success:
        print("❌ Admin login failed - stopping tests")
        return 1
    
    # Test 4: Test getting current user
    tester.test_get_current_user()
    
    # Test 5: Test token refresh
    tester.test_refresh_token()
    
    # ============== PUBLIC API TESTS ==============
    print("\n🌐 PUBLIC API TESTS")
    print("=" * 50)
    
    # Test 6: Health Check
    health_success, health_data = tester.test_health_check()
    if not health_success:
        print("❌ Health check failed - stopping tests")
        return 1
    
    # Test 7: Get all locations
    locations_success, locations_data = tester.test_get_locations()
    if not locations_success:
        print("❌ Locations endpoint failed - stopping tests")
        return 1
    
    # Test 8: Test specific location by slug
    if locations_data and len(locations_data) > 0:
        first_location = locations_data[0]
        location_slug = first_location.get('slug', 'timperley-altrincham')
        location_id = first_location.get('id', 'timperley-altrincham')
        
        tester.test_get_location_by_slug(location_slug)
        
        # Test 9: Get all menu items
        menu_success, menu_data = tester.test_get_menu_items_all()
        
        # Test 10: Get menu items by location
        if menu_success:
            tester.test_get_menu_items_by_location(location_id)
            
            # Test 11: Get menu items by category
            tester.test_get_menu_items_by_category('mains')
            tester.test_get_menu_items_by_category('desserts')
            
            # Test 12: Get featured items
            tester.test_get_featured_items()
            
            # Test 13: Get specific menu item
            if menu_data and len(menu_data) > 0:
                first_item_id = menu_data[0].get('id', '1')
                tester.test_get_menu_item_by_id(first_item_id)
    
    # Test 14: 404 endpoints
    tester.test_404_endpoints()
    
    # ============== ADMIN CRUD TESTS ==============
    print("\n🔧 ADMIN CRUD TESTS (AUTHENTICATED)")
    print("=" * 50)
    
    # Test 15: Admin get all menu items
    admin_menu_success, admin_menu_data = tester.test_admin_get_menu_items()
    
    # Test 16: Admin get menu items by location
    if admin_menu_success and location_id:
        tester.test_admin_get_menu_items_by_location(location_id)
    
    # Test 17: Admin create menu item
    create_success, create_data = tester.test_admin_create_menu_item()
    if create_success and 'id' in create_data:
        created_item_id = create_data['id']
        
        # Test 18: Admin update menu item
        tester.test_admin_update_menu_item(created_item_id)
        
        # Test 19: Admin toggle availability
        tester.test_admin_toggle_availability(created_item_id)
        
        # Test 20: Admin delete menu item
        tester.test_admin_delete_menu_item(created_item_id)
    else:
        print("⚠️  Skipping update/toggle/delete tests due to failed creation")
    
    # ============== SECURITY TESTS ==============
    print("\n🔒 SECURITY TESTS")
    print("=" * 50)
    
    # Test 21: Logout
    tester.test_admin_logout()
    
    # Test 22: Brute force protection (this will lock the account temporarily)
    tester.test_brute_force_protection()
    
    # Print summary
    print("\n" + "=" * 70)
    print(f"📊 Test Summary:")
    print(f"   Tests Run: {tester.tests_run}")
    print(f"   Tests Passed: {tester.tests_passed}")
    print(f"   Success Rate: {(tester.tests_passed/tester.tests_run*100):.1f}%")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed! Admin authentication and CRUD are working correctly.")
        return 0
    else:
        print(f"⚠️  {tester.tests_run - tester.tests_passed} tests failed.")
        return 1

if __name__ == "__main__":
    sys.exit(main())