"""
Test Customer Auth endpoints including Google OAuth
Tests: Customer registration, login, Google session endpoint
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCustomerAuth:
    """Customer authentication endpoint tests"""
    
    # Test customer data
    test_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    test_name = "Test Customer"
    test_phone = "07123456789"
    generated_password = None
    
    def test_health_check(self):
        """Test API is healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✓ Health check passed")
    
    def test_customer_register_success(self):
        """Test customer registration creates account and returns password"""
        response = requests.post(f"{BASE_URL}/api/customer/register", json={
            "name": self.test_name,
            "email": self.test_email,
            "phone": self.test_phone
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "password" in data, "Response should contain generated password"
        assert "token" in data, "Response should contain token"
        assert "customer_id" in data, "Response should contain customer_id"
        assert "message" in data, "Response should contain message"
        
        # Store password for login test
        TestCustomerAuth.generated_password = data["password"]
        print(f"✓ Customer registration passed - password: {data['password']}")
    
    def test_customer_register_duplicate_email(self):
        """Test registration with duplicate email fails"""
        response = requests.post(f"{BASE_URL}/api/customer/register", json={
            "name": "Another Customer",
            "email": self.test_email,  # Same email
            "phone": "07987654321"
        })
        assert response.status_code == 400, f"Expected 400 for duplicate email, got {response.status_code}"
        print("✓ Duplicate email registration correctly rejected")
    
    def test_customer_register_missing_fields(self):
        """Test registration with missing fields fails"""
        response = requests.post(f"{BASE_URL}/api/customer/register", json={
            "name": "Test",
            "email": "incomplete@test.com"
            # Missing phone
        })
        assert response.status_code == 422, f"Expected 422 for missing fields, got {response.status_code}"
        print("✓ Missing fields correctly rejected")
    
    def test_customer_login_success(self):
        """Test customer login with valid credentials"""
        # First register a new user to get password
        new_email = f"login_test_{uuid.uuid4().hex[:8]}@example.com"
        reg_response = requests.post(f"{BASE_URL}/api/customer/register", json={
            "name": "Login Test User",
            "email": new_email,
            "phone": "07123456789"
        })
        assert reg_response.status_code == 200, f"Registration failed: {reg_response.text}"
        password = reg_response.json()["password"]
        
        # Now test login
        response = requests.post(f"{BASE_URL}/api/customer/login", json={
            "email": new_email,
            "password": password
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "token" in data, "Response should contain token"
        assert "customer" in data, "Response should contain customer data"
        assert data["customer"]["email"] == new_email.lower()
        print("✓ Customer login passed")
    
    def test_customer_login_invalid_password(self):
        """Test customer login with invalid password fails"""
        response = requests.post(f"{BASE_URL}/api/customer/login", json={
            "email": self.test_email,
            "password": "wrongpassword123"
        })
        assert response.status_code == 401, f"Expected 401 for invalid password, got {response.status_code}"
        print("✓ Invalid password correctly rejected")
    
    def test_customer_login_nonexistent_email(self):
        """Test customer login with non-existent email fails"""
        response = requests.post(f"{BASE_URL}/api/customer/login", json={
            "email": "nonexistent@example.com",
            "password": "anypassword"
        })
        assert response.status_code == 401, f"Expected 401 for non-existent email, got {response.status_code}"
        print("✓ Non-existent email correctly rejected")


class TestGoogleOAuthEndpoint:
    """Google OAuth session endpoint tests"""
    
    def test_google_session_endpoint_exists(self):
        """Test POST /api/customer/auth/google-session endpoint exists"""
        response = requests.post(f"{BASE_URL}/api/customer/auth/google-session", json={})
        # Should return 400 (missing session_id) not 404
        assert response.status_code in [400, 401, 422], f"Expected 400/401/422, got {response.status_code}"
        print(f"✓ Google session endpoint exists (returned {response.status_code})")
    
    def test_google_session_missing_session_id(self):
        """Test Google session endpoint requires session_id"""
        response = requests.post(f"{BASE_URL}/api/customer/auth/google-session", json={})
        assert response.status_code == 400, f"Expected 400 for missing session_id, got {response.status_code}"
        
        data = response.json()
        assert "session_id" in data.get("detail", "").lower() or "required" in data.get("detail", "").lower()
        print("✓ Missing session_id correctly rejected with 400")
    
    def test_google_session_invalid_session_id(self):
        """Test Google session endpoint rejects invalid session_id"""
        response = requests.post(f"{BASE_URL}/api/customer/auth/google-session", json={
            "session_id": "invalid_session_id_12345"
        })
        assert response.status_code == 401, f"Expected 401 for invalid session_id, got {response.status_code}"
        
        data = response.json()
        assert "invalid" in data.get("detail", "").lower() or "expired" in data.get("detail", "").lower()
        print("✓ Invalid session_id correctly rejected with 401")
    
    def test_google_session_empty_session_id(self):
        """Test Google session endpoint rejects empty session_id"""
        response = requests.post(f"{BASE_URL}/api/customer/auth/google-session", json={
            "session_id": ""
        })
        # Empty string should be treated as missing
        assert response.status_code in [400, 401], f"Expected 400/401 for empty session_id, got {response.status_code}"
        print(f"✓ Empty session_id correctly rejected with {response.status_code}")


class TestCustomerMe:
    """Test customer /me endpoint"""
    
    def test_customer_me_without_token(self):
        """Test /me endpoint without token returns 401"""
        response = requests.get(f"{BASE_URL}/api/customer/me")
        assert response.status_code == 401, f"Expected 401 without token, got {response.status_code}"
        print("✓ /me without token correctly returns 401")
    
    def test_customer_me_with_invalid_token(self):
        """Test /me endpoint with invalid token returns 401"""
        response = requests.get(f"{BASE_URL}/api/customer/me", headers={
            "Authorization": "Bearer invalid_token_12345"
        })
        assert response.status_code == 401, f"Expected 401 with invalid token, got {response.status_code}"
        print("✓ /me with invalid token correctly returns 401")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
