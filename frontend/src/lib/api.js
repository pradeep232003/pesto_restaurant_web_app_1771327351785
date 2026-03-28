// API service for connecting to MongoDB backend
const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.REACT_APP_BACKEND_URL || '';

class ApiService {
  async fetch(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  }

  // Locations
  async getLocations() {
    return this.fetch('/api/locations');
  }

  async getLocationBySlug(slug) {
    return this.fetch(`/api/locations/${slug}`);
  }

  // Menu Items
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
}

export const api = new ApiService();
export default api;
