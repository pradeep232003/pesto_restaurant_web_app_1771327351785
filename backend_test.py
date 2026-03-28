import requests
import sys
import json
from datetime import datetime

class ResidentBalanceAPITester:
    def __init__(self, base_url="https://jovial-hamilton-4.preview.emergentagent.com"):
        self.base_url = base_url
        self.session = requests.Session()
        self.tests_run = 0
        self.tests_passed = 0
        self.created_residents = []
        self.created_transactions = []

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = self.session.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = self.session.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = self.session.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = self.session.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json()
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_admin_login(self):
        """Test admin login and establish session"""
        print("\n🔐 Testing Admin Authentication...")
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "api/auth/login",
            200,
            data={"email": "admin@jollys.com", "password": "Admin123!"}
        )
        if success:
            print(f"   Logged in as: {response.get('email', 'Unknown')}")
            return True
        return False

    def test_health_check(self):
        """Test basic health endpoint"""
        success, _ = self.run_test(
            "Health Check",
            "GET",
            "api/health",
            200
        )
        return success

    def test_get_residents_empty(self):
        """Test getting residents when none exist"""
        success, response = self.run_test(
            "Get Residents (Empty)",
            "GET",
            "api/admin/residents",
            200
        )
        if success:
            print(f"   Found {len(response)} residents")
        return success

    def test_create_resident(self, residence_number, name, location, about=None):
        """Test creating a new resident"""
        resident_data = {
            "residence_number": residence_number,
            "name": name,
            "location": location,
            "about": about
        }
        success, response = self.run_test(
            f"Create Resident {name}",
            "POST",
            "api/admin/residents",
            201,
            data=resident_data
        )
        if success and response.get('id'):
            self.created_residents.append(response['id'])
            print(f"   Created resident ID: {response['id']}")
            return response['id']
        return None

    def test_get_residents(self):
        """Test getting all residents"""
        success, response = self.run_test(
            "Get All Residents",
            "GET",
            "api/admin/residents",
            200
        )
        if success:
            print(f"   Found {len(response)} residents")
        return success, response

    def test_get_resident_by_id(self, resident_id):
        """Test getting a specific resident"""
        success, response = self.run_test(
            f"Get Resident {resident_id}",
            "GET",
            f"api/admin/residents/{resident_id}",
            200
        )
        return success, response

    def test_update_resident(self, resident_id, update_data):
        """Test updating a resident"""
        success, response = self.run_test(
            f"Update Resident {resident_id}",
            "PUT",
            f"api/admin/residents/{resident_id}",
            200,
            data=update_data
        )
        return success, response

    def test_create_transaction(self, resident_id, transaction_type, amount, description=None):
        """Test creating a transaction (top-up or purchase)"""
        transaction_data = {
            "resident_id": resident_id,
            "transaction_type": transaction_type,
            "amount": amount,
            "description": description
        }
        success, response = self.run_test(
            f"Create {transaction_type.title()} Transaction",
            "POST",
            "api/admin/transactions",
            201,
            data=transaction_data
        )
        if success and response.get('transaction', {}).get('id'):
            self.created_transactions.append(response['transaction']['id'])
            print(f"   New balance: £{response.get('new_balance', 0):.2f}")
        return success, response

    def test_get_transactions(self, filters=None):
        """Test getting transactions with optional filters"""
        success, response = self.run_test(
            "Get Transactions",
            "GET",
            "api/admin/transactions",
            200,
            params=filters
        )
        if success:
            print(f"   Found {len(response)} transactions")
        return success, response

    def test_get_resident_transactions(self, resident_id):
        """Test getting transactions for a specific resident"""
        success, response = self.run_test(
            f"Get Resident {resident_id} Transactions",
            "GET",
            f"api/admin/residents/{resident_id}/transactions",
            200
        )
        if success:
            transactions = response.get('transactions', [])
            print(f"   Found {len(transactions)} transactions for resident")
        return success, response

    def test_balance_summary(self, location=None):
        """Test getting balance summary"""
        params = {"location": location} if location else None
        success, response = self.run_test(
            f"Balance Summary{' for ' + location if location else ''}",
            "GET",
            "api/admin/balance-summary",
            200,
            params=params
        )
        if success:
            print(f"   Total balance: £{response.get('total_balance', 0):.2f}")
            print(f"   Total residents: {response.get('total_residents', 0)}")
        return success, response

    def test_location_filtering(self):
        """Test location-based filtering"""
        print("\n📍 Testing Location Filtering...")
        
        # Test Oakmere residents
        success, oakmere_residents = self.run_test(
            "Get Oakmere Residents",
            "GET",
            "api/admin/residents",
            200,
            params={"location": "oakmere-handforth"}
        )
        
        # Test Willowmere residents  
        success2, willowmere_residents = self.run_test(
            "Get Willowmere Residents",
            "GET",
            "api/admin/residents",
            200,
            params={"location": "willowmere-middlewich"}
        )
        
        if success and success2:
            print(f"   Oakmere residents: {len(oakmere_residents)}")
            print(f"   Willowmere residents: {len(willowmere_residents)}")
        
        return success and success2

    def test_error_scenarios(self):
        """Test error handling scenarios"""
        print("\n⚠️  Testing Error Scenarios...")
        
        # Test creating resident with duplicate residence number
        if self.created_residents:
            # Get first resident to duplicate
            success, first_resident = self.test_get_resident_by_id(self.created_residents[0])
            if success:
                duplicate_data = {
                    "residence_number": first_resident.get('residence_number'),
                    "name": "Duplicate Test",
                    "location": "oakmere-handforth"
                }
                success, _ = self.run_test(
                    "Create Duplicate Residence Number",
                    "POST",
                    "api/admin/residents",
                    400,  # Should fail
                    data=duplicate_data
                )
        
        # Test insufficient balance purchase
        if self.created_residents:
            resident_id = self.created_residents[0]
            success, _ = self.run_test(
                "Purchase with Insufficient Balance",
                "POST",
                "api/admin/transactions",
                400,  # Should fail
                data={
                    "resident_id": resident_id,
                    "transaction_type": "purchase",
                    "amount": 1000.00,  # Large amount
                    "description": "Test insufficient balance"
                }
            )
        
        # Test invalid transaction type
        if self.created_residents:
            resident_id = self.created_residents[0]
            success, _ = self.run_test(
                "Invalid Transaction Type",
                "POST",
                "api/admin/transactions",
                400,  # Should fail
                data={
                    "resident_id": resident_id,
                    "transaction_type": "invalid_type",
                    "amount": 10.00
                }
            )

    def test_delete_resident(self, resident_id):
        """Test deleting a resident"""
        success, response = self.run_test(
            f"Delete Resident {resident_id}",
            "DELETE",
            f"api/admin/residents/{resident_id}",
            200
        )
        return success

    def cleanup(self):
        """Clean up created test data"""
        print("\n🧹 Cleaning up test data...")
        for resident_id in self.created_residents:
            self.test_delete_resident(resident_id)

def main():
    print("🚀 Starting Resident Prepaid Balance API Tests")
    print("=" * 60)
    
    tester = ResidentBalanceAPITester()
    
    # Test authentication first
    if not tester.test_admin_login():
        print("❌ Authentication failed, stopping tests")
        return 1
    
    # Test basic endpoints
    tester.test_health_check()
    tester.test_get_residents_empty()
    
    # Create test residents (using unique residence numbers)
    print("\n👥 Creating Test Residents...")
    timestamp = datetime.now().strftime("%H%M%S")
    john_id = tester.test_create_resident(f"A{timestamp}1", f"John Test {timestamp}", "oakmere-handforth", "Test resident for Oakmere")
    mary_id = tester.test_create_resident(f"B{timestamp}2", f"Mary Test {timestamp}", "willowmere-middlewich", "Test resident for Willowmere")
    bob_id = tester.test_create_resident(f"A{timestamp}3", f"Bob Test {timestamp}", "oakmere-handforth")
    
    if not all([john_id, mary_id, bob_id]):
        print("❌ Failed to create test residents")
        return 1
    
    # Test resident operations
    print("\n👤 Testing Resident Operations...")
    tester.test_get_residents()
    tester.test_get_resident_by_id(john_id)
    tester.test_update_resident(john_id, {"about": "Updated test resident"})
    
    # Test transactions
    print("\n💰 Testing Transaction Operations...")
    tester.test_create_transaction(john_id, "topup", 50.00, "Initial top-up")
    tester.test_create_transaction(john_id, "topup", 25.00, "Additional funds")
    tester.test_create_transaction(john_id, "purchase", 12.50, "Coffee and snacks")
    
    tester.test_create_transaction(mary_id, "topup", 100.00, "Monthly allowance")
    tester.test_create_transaction(mary_id, "purchase", 15.75, "Lunch")
    
    # Test transaction queries
    tester.test_get_transactions()
    tester.test_get_transactions({"location": "oakmere-handforth"})
    tester.test_get_transactions({"transaction_type": "topup"})
    tester.test_get_resident_transactions(john_id)
    
    # Test balance summaries
    print("\n📊 Testing Balance Summaries...")
    tester.test_balance_summary()
    tester.test_balance_summary("oakmere-handforth")
    tester.test_balance_summary("willowmere-middlewich")
    
    # Test filtering
    tester.test_location_filtering()
    
    # Test error scenarios
    tester.test_error_scenarios()
    
    # Clean up
    tester.cleanup()
    
    # Print results
    print("\n" + "=" * 60)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print(f"⚠️  {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())