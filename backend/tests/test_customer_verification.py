"""
Test customer registration with email verification flow
Tests: POST /api/customer/register, POST /api/customer/verify
"""
import pytest
import requests
import uuid
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://jovial-hamilton-4.preview.emergentagent.com')


class TestCustomerRegistrationVerification:
    """Test customer registration and verification flow"""
    
    def test_health_check(self):
        """Verify API is healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✓ Health check passed")
    
    def test_register_returns_needs_verification(self):
        """Registration should return needs_verification=true and verification_code"""
        test_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        response = requests.post(f"{BASE_URL}/api/customer/register", json={
            "name": "Test User",
            "email": test_email,
            "phone": "07123456789"
        })
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "needs_verification" in data
        assert data["needs_verification"] == True
        assert "customer_id" in data
        assert "password" in data
        assert len(data["password"]) > 0
        
        # Since RESEND_API_KEY is not configured, verification_code should be returned
        assert "verification_code" in data
        assert data["verification_code"] is not None
        assert len(data["verification_code"]) == 6  # OTP is 6 digits
        
        print(f"✓ Registration returns needs_verification=true, code={data['verification_code']}")
        return data
    
    def test_verify_with_correct_otp(self):
        """Verification with correct OTP should activate account and issue JWT"""
        # First register
        test_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        reg_response = requests.post(f"{BASE_URL}/api/customer/register", json={
            "name": "Test Verify User",
            "email": test_email,
            "phone": "07123456789"
        })
        assert reg_response.status_code == 200
        reg_data = reg_response.json()
        
        customer_id = reg_data["customer_id"]
        otp_code = reg_data["verification_code"]
        
        # Now verify
        verify_response = requests.post(f"{BASE_URL}/api/customer/verify", json={
            "customer_id": customer_id,
            "otp": otp_code,
            "type": "email"
        })
        assert verify_response.status_code == 200
        verify_data = verify_response.json()
        
        # Verify JWT is issued
        assert "token" in verify_data
        assert len(verify_data["token"]) > 0
        assert "customer" in verify_data
        assert verify_data["customer"]["email_verified"] == True
        
        print(f"✓ Verification with correct OTP issues JWT token")
        return verify_data
    
    def test_verify_with_wrong_otp(self):
        """Verification with wrong OTP should return error"""
        # First register
        test_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        reg_response = requests.post(f"{BASE_URL}/api/customer/register", json={
            "name": "Test Wrong OTP User",
            "email": test_email,
            "phone": "07123456789"
        })
        assert reg_response.status_code == 200
        reg_data = reg_response.json()
        
        customer_id = reg_data["customer_id"]
        
        # Try to verify with wrong OTP
        verify_response = requests.post(f"{BASE_URL}/api/customer/verify", json={
            "customer_id": customer_id,
            "otp": "000000",  # Wrong OTP
            "type": "email"
        })
        assert verify_response.status_code == 400
        verify_data = verify_response.json()
        assert "Invalid verification code" in verify_data.get("detail", "")
        
        print("✓ Verification with wrong OTP returns error")
    
    def test_verify_nonexistent_customer(self):
        """Verification for non-existent customer should return 404"""
        verify_response = requests.post(f"{BASE_URL}/api/customer/verify", json={
            "customer_id": "nonexistent-id",
            "otp": "123456",
            "type": "email"
        })
        assert verify_response.status_code == 404
        print("✓ Verification for non-existent customer returns 404")
    
    def test_duplicate_email_registration(self):
        """Duplicate email registration should return 400"""
        test_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        
        # First registration
        response1 = requests.post(f"{BASE_URL}/api/customer/register", json={
            "name": "First User",
            "email": test_email,
            "phone": "07123456789"
        })
        assert response1.status_code == 200
        
        # Second registration with same email
        response2 = requests.post(f"{BASE_URL}/api/customer/register", json={
            "name": "Second User",
            "email": test_email,
            "phone": "07987654321"
        })
        assert response2.status_code == 400
        data = response2.json()
        assert "already registered" in data.get("detail", "").lower()
        
        print("✓ Duplicate email registration returns 400")


class TestAdminLogin:
    """Test admin login flow"""
    
    def test_admin_login_valid_credentials(self):
        """Admin login with valid credentials should succeed"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@jollys.com",
            "password": "Admin123!"
        })
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["email"] == "admin@jollys.com"
        assert data["role"] == "admin"
        print("✓ Admin login with valid credentials succeeds")
    
    def test_admin_login_invalid_credentials(self):
        """Admin login with invalid credentials should fail"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@jollys.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ Admin login with invalid credentials returns 401")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
