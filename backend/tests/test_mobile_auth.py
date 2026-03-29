"""
Test Mobile Admin Authentication - Dual Auth Approach
Tests the fix for P0: Mobile Admin Navigation dropping Authentication

The fix adds dual-auth: tokens returned in login/refresh response bodies,
stored in localStorage, attached as Authorization headers.
Backend accepts both cookies and Bearer tokens.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
ADMIN_EMAIL = "admin@jollys.com"
ADMIN_PASSWORD = "Admin123!"


class TestLoginReturnsTokens:
    """Test that login endpoint returns access_token and refresh_token in response body"""
    
    def test_login_returns_access_token_in_body(self):
        """Login response should include access_token field"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        # Verify access_token is in response body
        assert "access_token" in data, "access_token missing from login response"
        assert isinstance(data["access_token"], str), "access_token should be a string"
        assert len(data["access_token"]) > 50, "access_token seems too short to be a JWT"
        print(f"✓ Login returns access_token in body (length: {len(data['access_token'])})")
    
    def test_login_returns_refresh_token_in_body(self):
        """Login response should include refresh_token field"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        # Verify refresh_token is in response body
        assert "refresh_token" in data, "refresh_token missing from login response"
        assert isinstance(data["refresh_token"], str), "refresh_token should be a string"
        assert len(data["refresh_token"]) > 50, "refresh_token seems too short to be a JWT"
        print(f"✓ Login returns refresh_token in body (length: {len(data['refresh_token'])})")
    
    def test_login_returns_user_data(self):
        """Login response should include user data"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "id" in data, "User id missing from login response"
        assert "email" in data, "User email missing from login response"
        assert "role" in data, "User role missing from login response"
        assert data["email"] == ADMIN_EMAIL
        assert data["role"] == "admin"
        print(f"✓ Login returns user data: {data['email']} ({data['role']})")


class TestBearerTokenAuth:
    """Test that Bearer token Authorization header works for protected endpoints"""
    
    @pytest.fixture
    def access_token(self):
        """Get access token from login"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_bearer_token_works_for_auth_me(self, access_token):
        """GET /api/auth/me should accept Bearer token"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        assert response.status_code == 200, f"Auth/me failed with Bearer token: {response.text}"
        data = response.json()
        assert data["email"] == ADMIN_EMAIL
        print(f"✓ Bearer token works for /api/auth/me")
    
    def test_bearer_token_works_for_admin_orders(self, access_token):
        """GET /api/admin/orders should accept Bearer token"""
        response = requests.get(
            f"{BASE_URL}/api/admin/orders",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        assert response.status_code == 200, f"Admin orders failed with Bearer token: {response.text}"
        # Response should be a list (even if empty)
        data = response.json()
        assert isinstance(data, list), "Admin orders should return a list"
        print(f"✓ Bearer token works for /api/admin/orders (found {len(data)} orders)")
    
    def test_bearer_token_works_for_admin_menu(self, access_token):
        """GET /api/admin/menu-items should accept Bearer token"""
        response = requests.get(
            f"{BASE_URL}/api/admin/menu-items",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        assert response.status_code == 200, f"Admin menu failed with Bearer token: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Admin menu should return a list"
        print(f"✓ Bearer token works for /api/admin/menu-items (found {len(data)} items)")
    
    def test_bearer_token_works_for_admin_site_settings(self, access_token):
        """GET /api/admin/site-settings should accept Bearer token"""
        response = requests.get(
            f"{BASE_URL}/api/admin/site-settings",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        assert response.status_code == 200, f"Admin site-settings failed with Bearer token: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Admin site-settings should return a list"
        print(f"✓ Bearer token works for /api/admin/site-settings (found {len(data)} settings)")
    
    def test_bearer_token_works_for_admin_residents(self, access_token):
        """GET /api/admin/residents should accept Bearer token"""
        response = requests.get(
            f"{BASE_URL}/api/admin/residents",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        assert response.status_code == 200, f"Admin residents failed with Bearer token: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Admin residents should return a list"
        print(f"✓ Bearer token works for /api/admin/residents (found {len(data)} residents)")
    
    def test_bearer_token_works_for_admin_transactions(self, access_token):
        """GET /api/admin/transactions should accept Bearer token"""
        response = requests.get(
            f"{BASE_URL}/api/admin/transactions",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        assert response.status_code == 200, f"Admin transactions failed with Bearer token: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Admin transactions should return a list"
        print(f"✓ Bearer token works for /api/admin/transactions (found {len(data)} transactions)")


class TestTokenRefresh:
    """Test token refresh endpoint accepts refresh_token in request body"""
    
    @pytest.fixture
    def tokens(self):
        """Get both tokens from login"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        return {
            "access_token": data["access_token"],
            "refresh_token": data["refresh_token"]
        }
    
    def test_refresh_accepts_body_token(self, tokens):
        """POST /api/auth/refresh should accept refresh_token in request body"""
        response = requests.post(
            f"{BASE_URL}/api/auth/refresh",
            json={"refresh_token": tokens["refresh_token"]}
        )
        assert response.status_code == 200, f"Refresh failed: {response.text}"
        data = response.json()
        
        # Should return new access_token
        assert "access_token" in data, "Refresh should return new access_token"
        assert len(data["access_token"]) > 50, "New access_token seems too short"
        print(f"✓ Token refresh accepts body token and returns new access_token")
    
    def test_refresh_returns_user_data(self, tokens):
        """Refresh should also return user data"""
        response = requests.post(
            f"{BASE_URL}/api/auth/refresh",
            json={"refresh_token": tokens["refresh_token"]}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "email" in data, "Refresh should return user email"
        assert data["email"] == ADMIN_EMAIL
        print(f"✓ Token refresh returns user data")


class TestNoAuthReturns401:
    """Test that protected endpoints return 401 without authentication"""
    
    def test_auth_me_without_token_returns_401(self):
        """GET /api/auth/me without token should return 401"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ /api/auth/me returns 401 without auth")
    
    def test_admin_orders_without_token_returns_401(self):
        """GET /api/admin/orders without token should return 401"""
        response = requests.get(f"{BASE_URL}/api/admin/orders")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ /api/admin/orders returns 401 without auth")
    
    def test_admin_menu_without_token_returns_401(self):
        """GET /api/admin/menu-items without token should return 401"""
        response = requests.get(f"{BASE_URL}/api/admin/menu-items")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ /api/admin/menu-items returns 401 without auth")


class TestInvalidCredentials:
    """Test login with invalid credentials"""
    
    def test_login_wrong_password_returns_401(self):
        """Login with wrong password should return 401"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": "WrongPassword123!"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ Login with wrong password returns 401")
    
    def test_login_wrong_email_returns_401(self):
        """Login with wrong email should return 401"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "wrong@email.com", "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ Login with wrong email returns 401")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
