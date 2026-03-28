// API service for connecting to MongoDB backend
const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.REACT_APP_BACKEND_URL || '';

// Helper to format API error details
function formatApiErrorDetail(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

class ApiService {
  async fetch(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      credentials: 'include', // Include cookies for auth
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(formatApiErrorDetail(errorData.detail) || `API Error: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  }

  // ============== AUTH ENDPOINTS ==============

  async login(email, password) {
    return this.fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async logout() {
    return this.fetch('/api/auth/logout', {
      method: 'POST',
    });
  }

  async getMe() {
    return this.fetch('/api/auth/me');
  }

  async refreshToken() {
    return this.fetch('/api/auth/refresh', {
      method: 'POST',
    });
  }

  // ============== PUBLIC ENDPOINTS ==============

  // Locations
  async getLocations() {
    return this.fetch('/api/locations');
  }

  async getLocationBySlug(slug) {
    return this.fetch(`/api/locations/${slug}`);
  }

  // Menu Items (Public)
  async getMenuItems(locationId = null, category = null) {
    const params = new URLSearchParams();
    if (locationId) params.append('location_id', locationId);
    if (category && category !== 'all') params.append('category', category);
    
    const queryString = params.toString();
    return this.fetch(`/api/menu-items${queryString ? `?${queryString}` : ''}`);
  }

  async getMenuItem(itemId) {
    return this.fetch(`/api/menu-items/${itemId}`);
  }

  async getFeaturedItems(locationId = null, limit = 8) {
    const params = new URLSearchParams();
    if (locationId) params.append('location_id', locationId);
    params.append('limit', limit.toString());
    
    return this.fetch(`/api/featured-items?${params.toString()}`);
  }

  // ============== ADMIN ENDPOINTS (PROTECTED) ==============

  // Get all menu items for admin (including unavailable)
  async adminGetMenuItems(locationId = null) {
    const params = new URLSearchParams();
    if (locationId) params.append('location_id', locationId);
    
    const queryString = params.toString();
    return this.fetch(`/api/admin/menu-items${queryString ? `?${queryString}` : ''}`);
  }

  // Create a new menu item
  async adminCreateMenuItem(itemData) {
    return this.fetch('/api/admin/menu-items', {
      method: 'POST',
      body: JSON.stringify(itemData),
    });
  }

  // Update an existing menu item
  async adminUpdateMenuItem(itemId, itemData) {
    return this.fetch(`/api/admin/menu-items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(itemData),
    });
  }

  // Toggle menu item availability
  async adminToggleAvailability(itemId) {
    return this.fetch(`/api/admin/menu-items/${itemId}/availability`, {
      method: 'PATCH',
    });
  }

  // Delete a menu item
  async adminDeleteMenuItem(itemId) {
    return this.fetch(`/api/admin/menu-items/${itemId}`, {
      method: 'DELETE',
    });
  }
}

export const api = new ApiService();
export default api;
