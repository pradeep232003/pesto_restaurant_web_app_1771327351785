#!/usr/bin/env python3
"""
Backend API Testing for Pesto Restaurant Web App
Tests MongoDB integration after migration from Supabase
"""

import requests
import sys
import json
from datetime import datetime

class PestoAPITester:
    def __init__(self, base_url="https://3a4be02d-b92e-46d8-9044-932fe25694f9.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def run_test(self, name, method, endpoint, expected_status, data=None, expected_fields=None):
        """Run a single API test"""
        url = f"{self.base_url}{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
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

def main():
    print("🍽️  Starting Pesto Restaurant API Tests (MongoDB Integration)")
    print("=" * 60)
    
    tester = PestoAPITester()
    
    # Test 1: Health Check
    health_success, health_data = tester.test_health_check()
    if not health_success:
        print("❌ Health check failed - stopping tests")
        return 1
    
    # Test 2: Get all locations
    locations_success, locations_data = tester.test_get_locations()
    if not locations_success:
        print("❌ Locations endpoint failed - stopping tests")
        return 1
    
    # Test 3: Test specific location by slug
    if locations_data and len(locations_data) > 0:
        first_location = locations_data[0]
        location_slug = first_location.get('slug', 'timperley-altrincham')
        location_id = first_location.get('id', 'timperley-altrincham')
        
        tester.test_get_location_by_slug(location_slug)
        
        # Test 4: Get all menu items
        menu_success, menu_data = tester.test_get_menu_items_all()
        
        # Test 5: Get menu items by location
        if menu_success:
            tester.test_get_menu_items_by_location(location_id)
            
            # Test 6: Get menu items by category
            tester.test_get_menu_items_by_category('mains')
            tester.test_get_menu_items_by_category('desserts')
            
            # Test 7: Get featured items
            tester.test_get_featured_items()
            
            # Test 8: Get specific menu item
            if menu_data and len(menu_data) > 0:
                first_item_id = menu_data[0].get('id', '1')
                tester.test_get_menu_item_by_id(first_item_id)
    
    # Test 9: 404 endpoints
    tester.test_404_endpoints()
    
    # Print summary
    print("\n" + "=" * 60)
    print(f"📊 Test Summary:")
    print(f"   Tests Run: {tester.tests_run}")
    print(f"   Tests Passed: {tester.tests_passed}")
    print(f"   Success Rate: {(tester.tests_passed/tester.tests_run*100):.1f}%")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed! MongoDB integration is working correctly.")
        return 0
    else:
        print(f"⚠️  {tester.tests_run - tester.tests_passed} tests failed.")
        return 1

if __name__ == "__main__":
    sys.exit(main())