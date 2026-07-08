// API service for connecting to MongoDB backend
// Use VITE_API_URL if set, otherwise auto-detect production backend
const PROD_BACKEND = 'https://jollys-kafe-backend-production.up.railway.app';
const PROD_HOSTS = new Set(['www.jollyskafe.com', 'jollyskafe.com']);
const API_BASE_URL = import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && PROD_HOSTS.has(window.location.hostname) ? PROD_BACKEND : '');

export { API_BASE_URL };

// Helper to resolve image URLs - prepends API base for cross-origin setups
export function resolveImageUrl(path) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${API_BASE_URL}${path}`;
}

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
  async fetch(endpoint, options = {}, _isRetry = false) {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Attach stored token as Authorization header (fallback for mobile browsers blocking cross-origin cookies)
    const storedToken = localStorage.getItem('access_token');
    if (storedToken && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${storedToken}`;
    }

    const response = await fetch(url, {
      ...options,
      credentials: API_BASE_URL ? 'include' : 'same-origin',
      headers,
    });
    
    // Auto-refresh admin token on 401 (once)
    if (response.status === 401 && !_isRetry) {
      const refreshed = await this._tryRefreshToken();
      if (refreshed) return this.fetch(endpoint, options, true);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(formatApiErrorDetail(errorData.detail) || `API Error: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  }

  async _tryRefreshToken() {
    // Try refresh via stored refresh_token
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
          method: 'POST',
          credentials: API_BASE_URL ? 'include' : 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.access_token) {
            localStorage.setItem('access_token', data.access_token);
            return true;
          }
        }
      } catch {}
    }
    // Try re-elevate from customer token
    const customerToken = localStorage.getItem('customer_token');
    if (customerToken) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/customer-elevate`, {
          method: 'POST',
          credentials: API_BASE_URL ? 'include' : 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customer_token: customerToken }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.access_token) {
            localStorage.setItem('access_token', data.access_token);
            if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token);
            return true;
          }
        }
      } catch {}
    }
    return false;
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

  async refreshToken(refreshToken) {
    return this.fetch('/api/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken || null }),
    });
  }

  async customerElevateToAdmin(customerToken) {
    return this.fetch('/api/auth/customer-elevate', {
      method: 'POST',
      body: JSON.stringify({ customer_token: customerToken }),
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

  // Google Reviews
  async getGoogleReviews() {
    return this.fetch('/api/reviews');
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

  // Upload image for a menu item
  async adminUploadMenuImage(itemId, file) {
    const formData = new FormData();
    formData.append('file', file);
    
    const headers = {};
    const storedToken = localStorage.getItem('access_token');
    if (storedToken) {
      headers['Authorization'] = `Bearer ${storedToken}`;
    }

    const response = await fetch(`${API_BASE_URL}/api/admin/menu-items/${itemId}/upload-image`, {
      method: 'POST',
      credentials: API_BASE_URL ? 'include' : 'same-origin',
      headers,
      body: formData,
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Upload failed: ${response.status}`);
    }
    
    return response.json();
  }

  // Toggle image visibility for a menu item
  async adminToggleImageVisibility(itemId) {
    return this.fetch(`/api/admin/menu-items/${itemId}/toggle-image`, {
      method: 'PATCH',
    });
  }

  // ============== RESIDENT PREPAID BALANCE ENDPOINTS ==============

  // Get all residents
  async getResidents(location = null) {
    const params = new URLSearchParams();
    if (location) params.append('location', location);
    const queryString = params.toString();
    return this.fetch(`/api/admin/residents${queryString ? `?${queryString}` : ''}`);
  }

  // Get single resident
  async getResident(residentId) {
    return this.fetch(`/api/admin/residents/${residentId}`);
  }

  // Create resident
  async createResident(residentData) {
    return this.fetch('/api/admin/residents', {
      method: 'POST',
      body: JSON.stringify(residentData),
    });
  }

  // Update resident
  async updateResident(residentId, residentData) {
    return this.fetch(`/api/admin/residents/${residentId}`, {
      method: 'PUT',
      body: JSON.stringify(residentData),
    });
  }

  // Delete resident
  async deleteResident(residentId) {
    return this.fetch(`/api/admin/residents/${residentId}`, {
      method: 'DELETE',
    });
  }

  // Create transaction (top-up or purchase)
  async createTransaction(transactionData) {
    return this.fetch('/api/admin/transactions', {
      method: 'POST',
      body: JSON.stringify({
        resident_id: transactionData.resident_id,
        transaction_type: transactionData.transaction_type,
        amount: transactionData.amount,
        description: transactionData.description || null,
        send_receipt: transactionData.send_receipt || false,
      }),
    });
  }

  // Get transactions with filters
  async getTransactions(filters = {}) {
    const params = new URLSearchParams();
    if (filters.resident_id) params.append('resident_id', filters.resident_id);
    if (filters.location) params.append('location', filters.location);
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    if (filters.transaction_type) params.append('transaction_type', filters.transaction_type);
    const queryString = params.toString();
    return this.fetch(`/api/admin/transactions${queryString ? `?${queryString}` : ''}`);
  }

  // Get resident's transactions
  async getResidentTransactions(residentId, filters = {}) {
    const params = new URLSearchParams();
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    const queryString = params.toString();
    return this.fetch(`/api/admin/residents/${residentId}/transactions${queryString ? `?${queryString}` : ''}`);
  }

  // Get balance summary
  async getBalanceSummary(location = null) {
    const params = new URLSearchParams();
    if (location) params.append('location', location);
    const queryString = params.toString();
    return this.fetch(`/api/admin/balance-summary${queryString ? `?${queryString}` : ''}`);
  }

  // ============== CUSTOMER AUTH ==============

  async customerRegister(name, email, phone) {
    return this.fetch('/api/customer/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, phone }),
    });
  }

  async customerLogin(email, password) {
    return this.fetch('/api/customer/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async customerGetMe(token) {
    return this.fetch('/api/customer/me', {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    });
  }

  async customerLogout() {
    return this.fetch('/api/customer/logout', { method: 'POST' });
  }

  async customerGoogleSession(sessionId) {
    return this.fetch('/api/customer/auth/google-session', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId }),
    });
  }

  async customerGoogleLogin(accessToken) {
    return this.fetch('/api/customer/auth/google-login', {
      method: 'POST',
      body: JSON.stringify({ access_token: accessToken }),
    });
  }

  async customerVerify(customerId, otp) {
    return this.fetch('/api/customer/verify', {
      method: 'POST',
      body: JSON.stringify({ customer_id: customerId, otp, type: 'email' }),
    });
  }

  async customerVerify(customerId, otp, type = 'email') {
    return this.fetch('/api/customer/verify', {
      method: 'POST',
      body: JSON.stringify({ customer_id: customerId, otp, type }),
    });
  }

  // ============== ORDERS ==============

  async createOrder(orderData, token) {
    return this.fetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    });
  }

  async trackOrder(orderNumber) {
    return this.fetch(`/api/orders/track/${orderNumber}`);
  }

  async getCustomerOrders(token) {
    return this.fetch('/api/customer/orders', {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    });
  }

  async adminGetOrders(locationId = null, status = null) {
    const params = new URLSearchParams();
    if (locationId) params.append('location_id', locationId);
    if (status) params.append('status', status);
    const qs = params.toString();
    return this.fetch(`/api/admin/orders${qs ? `?${qs}` : ''}`);
  }

  async adminUpdateOrderStatus(orderId, status) {
    return this.fetch(`/api/admin/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  // ============== SITE SETTINGS ==============

  async getSiteStatus(locationId) {
    return this.fetch(`/api/site-status/${locationId}`);
  }

  async adminGetSiteSettings() {
    return this.fetch('/api/admin/site-settings');
  }

  async adminUpdateSiteSettings(locationId, data) {
    return this.fetch(`/api/admin/site-settings/${locationId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async adminToggleOrdering(locationId) {
    return this.fetch(`/api/admin/site-settings/${locationId}/toggle`, {
      method: 'PATCH',
    });
  }

  // ============== ADMIN LOCATION CRUD ==============

  async adminGetLocations() {
    return this.fetch('/api/admin/locations');
  }

  async adminCreateLocation(data) {
    return this.fetch('/api/admin/locations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async adminUpdateLocation(locationId, data) {
    return this.fetch(`/api/admin/locations/${locationId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async adminDeleteLocation(locationId) {
    return this.fetch(`/api/admin/locations/${locationId}`, {
      method: 'DELETE',
    });
  }

  // ============== USER MANAGEMENT (SUPER ADMIN) ==============

  async adminGetCustomers() {
    return this.fetch('/api/admin/users');
  }

  async adminUpdateCustomerRole(customerId, role) {
    return this.fetch(`/api/admin/users/${customerId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  }

  async adminGetStaffList() {
    return this.fetch('/api/admin/users/staff-list');
  }

  // ============== DAILY SALES ==============

  async adminCreateDailySales(data) {
    return this.fetch('/api/admin/daily-sales', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async adminGetDailySales(filters = {}) {
    const params = new URLSearchParams();
    if (filters.location_id) params.append('location_id', filters.location_id);
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    const qs = params.toString();
    return this.fetch(`/api/admin/daily-sales${qs ? `?${qs}` : ''}`);
  }

  async adminGetTodaySales(locationId, date) {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    const qs = params.toString();
    return this.fetch(`/api/admin/daily-sales/today/${locationId}${qs ? `?${qs}` : ''}`);
  }

  async adminGetStaffNames() {
    return this.fetch('/api/admin/daily-sales/staff-names');
  }

  async adminDeleteDailySales(entryId) {
    return this.fetch(`/api/admin/daily-sales/${entryId}`, {
      method: 'DELETE',
    });
  }

  async adminGetSalesCompletion(month) {
    return this.fetch(`/api/admin/daily-sales/completion?month=${month}`);
  }

  async adminGetSalesSummary(filters = {}) {
    const params = new URLSearchParams();
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    if (filters.location_id) params.append('location_id', filters.location_id);
    const qs = params.toString();
    return this.fetch(`/api/admin/daily-sales/summary${qs ? `?${qs}` : ''}`);
  }

  // ============== INCOME & EXPENSES ==============

  async adminCreateIncome(data) {
    return this.fetch('/api/admin/finance/income', { method: 'POST', body: JSON.stringify(data) });
  }

  async adminGetIncome(filters = {}) {
    const params = new URLSearchParams();
    if (filters.location_id) params.append('location_id', filters.location_id);
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    if (filters.created_by) params.append('created_by', filters.created_by);
    const qs = params.toString();
    return this.fetch(`/api/admin/finance/income${qs ? `?${qs}` : ''}`);
  }

  async adminDeleteIncome(id) {
    return this.fetch(`/api/admin/finance/income/${id}`, { method: 'DELETE' });
  }

  async adminUpdateIncome(id, data) {
    return this.fetch(`/api/admin/finance/income/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async adminCreateExpense(data) {
    return this.fetch('/api/admin/finance/expenses', { method: 'POST', body: JSON.stringify(data) });
  }

  async adminGetExpenses(filters = {}) {
    const params = new URLSearchParams();
    if (filters.location_id) params.append('location_id', filters.location_id);
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    if (filters.created_by) params.append('created_by', filters.created_by);
    const qs = params.toString();
    return this.fetch(`/api/admin/finance/expenses${qs ? `?${qs}` : ''}`);
  }

  async adminDeleteExpense(id) {
    return this.fetch(`/api/admin/finance/expenses/${id}`, { method: 'DELETE' });
  }

  async adminUpdateExpense(id, data) {
    return this.fetch(`/api/admin/finance/expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async adminGetEditLog(filters = {}) {
    const params = new URLSearchParams();
    if (filters.record_type) params.append('record_type', filters.record_type);
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    const qs = params.toString();
    return this.fetch(`/api/admin/finance/edit-log${qs ? `?${qs}` : ''}`);
  }

  // ============== LOYALTY ==============

  async getMyLoyaltyCard() {
    return this.fetch('/api/customer/loyalty-card');
  }

  async adminLoyaltyScan(data) {
    return this.fetch('/api/admin/loyalty/scan', { method: 'POST', body: JSON.stringify(data) });
  }

  async adminGetLoyaltyCustomers() {
    return this.fetch('/api/admin/loyalty/customers');
  }

  async adminGetLoyaltyDetail(customerId) {
    return this.fetch(`/api/admin/loyalty/customer/${customerId}`);
  }

  // ============== TEMP MONITORING ==============

  async adminGetTempUnits(locationId) {
    const qs = locationId ? `?location_id=${locationId}` : '';
    return this.fetch(`/api/admin/temp/units${qs}`);
  }

  async adminCreateTempUnit(data) {
    return this.fetch('/api/admin/temp/units', { method: 'POST', body: JSON.stringify(data) });
  }

  async adminDeleteTempUnit(id) {
    return this.fetch(`/api/admin/temp/units/${id}`, { method: 'DELETE' });
  }

  async adminSubmitTempLog(data) {
    return this.fetch('/api/admin/temp/log', { method: 'POST', body: JSON.stringify(data) });
  }

  async adminGetTempLogs(locationId, opts = {}) {
    const params = new URLSearchParams({ location_id: locationId });
    if (opts.date) params.append('date', opts.date);
    if (opts.month) params.append('month', opts.month);
    return this.fetch(`/api/admin/temp/log?${params}`);
  }

  async adminSeedTempDefaults() {
    return this.fetch('/api/admin/temp/seed-defaults', { method: 'POST' });
  }

  async adminGetTempTimeSlots(locationId) {
    return this.fetch(`/api/admin/temp/time-slots/${locationId}`);
  }

  async adminUpdateTempTimeSlots(locationId, timeSlots) {
    return this.fetch('/api/admin/temp/time-slots', { method: 'PUT', body: JSON.stringify({ location_id: locationId, time_slots: timeSlots }) });
  }

  // ============== DAILY CHECKS ==============

  async adminGetChecklistItems(locationId) {
    const q = locationId ? `?location_id=${encodeURIComponent(locationId)}` : '';
    return this.fetch(`/api/admin/daily-checks/items${q}`);
  }

  async adminListAllChecklistItems() {
    return this.fetch('/api/admin/daily-checks/items/all');
  }

  async adminCreateChecklistItem(data) {
    return this.fetch('/api/admin/daily-checks/items', { method: 'POST', body: JSON.stringify(data) });
  }

  async adminUpdateChecklistItem(itemId, data) {
    return this.fetch(`/api/admin/daily-checks/items/${itemId}`, { method: 'PATCH', body: JSON.stringify(data) });
  }

  async adminDeleteChecklistItem(itemId) {
    return this.fetch(`/api/admin/daily-checks/items/${itemId}`, { method: 'DELETE' });
  }

  async adminSubmitDailyCheck(data) {
    return this.fetch('/api/admin/daily-checks', { method: 'POST', body: JSON.stringify(data) });
  }

  async adminGetDailyCheck(locationId, date) {
    return this.fetch(`/api/admin/daily-checks?location_id=${locationId}&date=${date}`);
  }

  async adminGetDailyChecksHistory(filters = {}) {
    const params = new URLSearchParams();
    if (filters.location_id) params.append('location_id', filters.location_id);
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    return this.fetch(`/api/admin/daily-checks/history?${params}`);
  }

  async adminGetDailyChecksCompletion(month) {
    return this.fetch(`/api/admin/daily-checks/completion?month=${month}`);
  }

  // ============== KITCHEN CLOSEDOWN ==============

  async adminGetClosedownItems(locationId) {
    const q = locationId ? `?location_id=${encodeURIComponent(locationId)}` : '';
    return this.fetch(`/api/admin/kitchen-closedown/items${q}`);
  }

  async adminListAllClosedownItems() {
    return this.fetch('/api/admin/kitchen-closedown/items/all');
  }

  async adminCreateClosedownItem(data) {
    return this.fetch('/api/admin/kitchen-closedown/items', { method: 'POST', body: JSON.stringify(data) });
  }

  async adminUpdateClosedownItem(itemId, data) {
    return this.fetch(`/api/admin/kitchen-closedown/items/${itemId}`, { method: 'PATCH', body: JSON.stringify(data) });
  }

  async adminDeleteClosedownItem(itemId) {
    return this.fetch(`/api/admin/kitchen-closedown/items/${itemId}`, { method: 'DELETE' });
  }

  async adminSubmitClosedown(data) {
    return this.fetch('/api/admin/kitchen-closedown', { method: 'POST', body: JSON.stringify(data) });
  }

  async adminGetClosedown(locationId, date) {
    return this.fetch(`/api/admin/kitchen-closedown?location_id=${locationId}&date=${date}`);
  }

  async adminGetClosedownHistory(filters = {}) {
    const params = new URLSearchParams();
    if (filters.location_id) params.append('location_id', filters.location_id);
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    return this.fetch(`/api/admin/kitchen-closedown/history?${params}`);
  }

  async adminGetClosedownCompletion(month) {
    return this.fetch(`/api/admin/kitchen-closedown/completion?month=${month}`);
  }

  // ============== COOKED & REHEATED TEMP ==============
  async adminListCookedTemp(filters = {}) {
    const p = new URLSearchParams();
    if (filters.location_id) p.append('location_id', filters.location_id);
    if (filters.start_date) p.append('start_date', filters.start_date);
    if (filters.end_date) p.append('end_date', filters.end_date);
    return this.fetch(`/api/admin/cooked-temp?${p}`);
  }
  async adminGetCookingMethods() { return this.fetch('/api/admin/cooked-temp/methods'); }
  async adminCreateCookedTemp(data) { return this.fetch('/api/admin/cooked-temp', { method: 'POST', body: JSON.stringify(data) }); }
  async adminDeleteCookedTemp(id) { return this.fetch(`/api/admin/cooked-temp/${id}`, { method: 'DELETE' }); }

  // ============== DELIVERY RECORDS ==============
  async adminListDeliveryRecords(filters = {}) {
    const p = new URLSearchParams();
    if (filters.location_id) p.append('location_id', filters.location_id);
    if (filters.start_date) p.append('start_date', filters.start_date);
    if (filters.end_date) p.append('end_date', filters.end_date);
    return this.fetch(`/api/admin/delivery-records?${p}`);
  }
  async adminCreateDeliveryRecord(data) { return this.fetch('/api/admin/delivery-records', { method: 'POST', body: JSON.stringify(data) }); }
  async adminDeleteDeliveryRecord(id) { return this.fetch(`/api/admin/delivery-records/${id}`, { method: 'DELETE' }); }

  // ============== PROBE CALIBRATION ==============
  async adminListProbeCalibration(filters = {}) {
    const p = new URLSearchParams();
    if (filters.location_id) p.append('location_id', filters.location_id);
    if (filters.start_date) p.append('start_date', filters.start_date);
    if (filters.end_date) p.append('end_date', filters.end_date);
    return this.fetch(`/api/admin/probe-calibration?${p}`);
  }
  async adminCreateProbeCalibration(data) { return this.fetch('/api/admin/probe-calibration', { method: 'POST', body: JSON.stringify(data) }); }
  async adminDeleteProbeCalibration(id) { return this.fetch(`/api/admin/probe-calibration/${id}`, { method: 'DELETE' }); }

  // ============== LEGIONELLA ==============
  async adminListLegionella(filters = {}) {
    const p = new URLSearchParams();
    if (filters.location_id) p.append('location_id', filters.location_id);
    if (filters.start_date) p.append('start_date', filters.start_date);
    if (filters.end_date) p.append('end_date', filters.end_date);
    return this.fetch(`/api/admin/legionella?${p}`);
  }
  async adminCreateLegionella(data) { return this.fetch('/api/admin/legionella', { method: 'POST', body: JSON.stringify(data) }); }
  async adminDeleteLegionella(id) { return this.fetch(`/api/admin/legionella/${id}`, { method: 'DELETE' }); }

  // ============== STAFF TABLE (admin + super_admin only) ==============
  async adminListStaff() { return this.fetch('/api/admin/staff'); }
  async adminCreateStaff(data) { return this.fetch('/api/admin/staff', { method: 'POST', body: JSON.stringify(data) }); }
  async adminUpdateStaff(id, data) { return this.fetch(`/api/admin/staff/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
  async adminDeleteStaff(id) { return this.fetch(`/api/admin/staff/${id}`, { method: 'DELETE' }); }

  // ============== BUSINESS INTELLIGENCE (super_admin only) ==============
  async adminBIOverview({ start_date, end_date, location_id } = {}) {
    const qs = new URLSearchParams(Object.entries({ start_date, end_date, location_id }).filter(([, v]) => v)).toString();
    return this.fetch(`/api/admin/bi${qs ? '?' + qs : ''}`);
  }
  async adminBIMenuCost({ location_id } = {}) {
    const qs = location_id ? `?location_id=${encodeURIComponent(location_id)}` : '';
    return this.fetch(`/api/admin/bi/menu-cost${qs}`);
  }
  async adminBIAIInsights({ start_date, end_date, location_id, refresh } = {}) {
    const qs = new URLSearchParams(
      Object.entries({ start_date, end_date, location_id, refresh: refresh ? '1' : undefined })
        .filter(([, v]) => v),
    ).toString();
    return this.fetch(`/api/admin/bi/ai-insights${qs ? '?' + qs : ''}`);
  }

  async adminGetAiSettings() {
    return this.fetch('/api/admin/ai-settings');
  }
  async adminSetAiKey({ api_key, provider = 'emergent' }) {
    return this.fetch('/api/admin/ai-settings', {
      method: 'PUT',
      body: JSON.stringify({ api_key, provider }),
    });
  }
  async adminClearAiKey() {
    return this.fetch('/api/admin/ai-settings', { method: 'DELETE' });
  }
  async adminTestAiKey({ api_key, provider = 'anthropic' }) {
    return this.fetch('/api/admin/ai-settings/test', {
      method: 'POST',
      body: JSON.stringify({ api_key, provider }),
    });
  }

  // ============== SHIFT MANAGEMENT ==============
  async shiftsList({ location_id, start_date, end_date } = {}) {
    const qs = new URLSearchParams(
      Object.entries({ location_id, start_date, end_date }).filter(([, v]) => v),
    ).toString();
    return this.fetch(`/api/admin/shifts${qs ? '?' + qs : ''}`);
  }
  async shiftCreate(body) {
    return this.fetch('/api/admin/shifts', { method: 'POST', body: JSON.stringify(body) });
  }
  async shiftUpdate(id, patch) {
    return this.fetch(`/api/admin/shifts/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
  }
  async shiftDelete(id) {
    return this.fetch(`/api/admin/shifts/${id}`, { method: 'DELETE' });
  }
  async shiftCopyWeek(body) {
    return this.fetch('/api/admin/shifts/copy-week', { method: 'POST', body: JSON.stringify(body) });
  }
  async shiftPublishWeek(body) {
    return this.fetch('/api/admin/shifts/publish-week', { method: 'POST', body: JSON.stringify(body) });
  }
  async shiftAiSuggestWeek(body) {
    return this.fetch('/api/admin/shifts/ai-suggest-week', { method: 'POST', body: JSON.stringify(body) });
  }
  async shiftBulkCreate(body) {
    return this.fetch('/api/admin/shifts/bulk-create', { method: 'POST', body: JSON.stringify(body) });
  }
  async shiftWeekBudgetGet({ location_id, week_start }) {
    const qs = new URLSearchParams({ location_id, week_start }).toString();
    return this.fetch(`/api/admin/shifts/week-budget?${qs}`);
  }
  async shiftWeekBudgetPut(body) {
    return this.fetch('/api/admin/shifts/week-budget', { method: 'PUT', body: JSON.stringify(body) });
  }

  // Invoices — supplier delivery invoices scanned by staff.
  async invoicesList({ location_id, supplier, category, start_date, end_date } = {}) {
    const qs = new URLSearchParams();
    if (location_id) qs.set('location_id', location_id);
    if (supplier) qs.set('supplier', supplier);
    if (category) qs.set('category', category);
    if (start_date) qs.set('start_date', start_date);
    if (end_date) qs.set('end_date', end_date);
    return this.fetch(`/api/admin/invoices${qs.toString() ? `?${qs.toString()}` : ''}`);
  }
  async invoiceScan(formData) {
    // Multipart — bypass this.fetch() so the browser sets Content-Type
    // with the multipart boundary itself. Mirrors adminUploadMenuImage.
    const headers = {};
    const storedToken = localStorage.getItem('access_token');
    if (storedToken) headers['Authorization'] = `Bearer ${storedToken}`;
    const response = await fetch(`${API_BASE_URL}/api/admin/invoices/scan`, {
      method: 'POST',
      credentials: API_BASE_URL ? 'include' : 'same-origin',
      headers,
      body: formData,
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Scan failed: ${response.status}`);
    }
    return response.json();
  }
  async invoiceScanMulti(formData) {
    const headers = {};
    const storedToken = localStorage.getItem('access_token');
    if (storedToken) headers['Authorization'] = `Bearer ${storedToken}`;
    const response = await fetch(`${API_BASE_URL}/api/admin/invoices/scan-multi`, {
      method: 'POST',
      credentials: API_BASE_URL ? 'include' : 'same-origin',
      headers,
      body: formData,
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Multi-page scan failed: ${response.status}`);
    }
    return response.json();
  }
  async invoiceScanAuto(formData) {
    const headers = {};
    const storedToken = localStorage.getItem('access_token');
    if (storedToken) headers['Authorization'] = `Bearer ${storedToken}`;
    const response = await fetch(`${API_BASE_URL}/api/admin/invoices/scan-auto`, {
      method: 'POST',
      credentials: API_BASE_URL ? 'include' : 'same-origin',
      headers,
      body: formData,
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Scan failed: ${response.status}`);
    }
    return response.json();
  }
  async invoiceScanBatchCommit(body) {
    return this.fetch('/api/admin/invoices/scan-batch-commit', {
      method: 'POST', body: JSON.stringify(body),
    });
  }
  async invoiceNormaliseDates() {
    return this.fetch('/api/admin/invoices/admin/normalise-dates', { method: 'POST' });
  }
  async biMenuEngineering({ location_id, days = 30 } = {}) {
    const qs = [`days=${days}`];
    if (location_id) qs.push(`location_id=${encodeURIComponent(location_id)}`);
    return this.fetch(`/api/admin/bi/menu-engineering?${qs.join('&')}`);
  }
  async biMenuEngineeringUpload(formData) {
    const headers = {};
    const storedToken = localStorage.getItem('access_token');
    if (storedToken) headers['Authorization'] = `Bearer ${storedToken}`;
    const response = await fetch(`${API_BASE_URL}/api/admin/bi/menu-engineering/upload`, {
      method: 'POST',
      credentials: API_BASE_URL ? 'include' : 'same-origin',
      headers,
      body: formData,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || `Upload failed: ${response.status}`);
    }
    return response.json();
  }
  biMenuEngineeringTemplateUrl() {
    // Client asks the browser to hit this via a temporary anchor with a
    // Bearer token in the header — see MenuEngineering.jsx for the impl.
    return `${API_BASE_URL}/api/admin/bi/menu-engineering/template`;
  }
  async salesTrainingGet(locationId) {
    return this.fetch(`/api/sales-training?location_id=${encodeURIComponent(locationId)}`);
  }
  async salesTrainingRefresh(locationId) {
    return this.fetch(`/api/sales-training/refresh?location_id=${encodeURIComponent(locationId)}`, { method: 'POST' });
  }
  async sliceAndDice({ locations, start, end } = {}) {
    const qs = [];
    if (locations && locations.length) qs.push(`locations=${encodeURIComponent(locations.join(','))}`);
    if (start) qs.push(`start=${start}`);
    if (end) qs.push(`end=${end}`);
    return this.fetch(`/api/admin/slice-and-dice${qs.length ? '?' + qs.join('&') : ''}`);
  }
  async invoiceAppendPages(id, formData) {
    const headers = {};
    const storedToken = localStorage.getItem('access_token');
    if (storedToken) headers['Authorization'] = `Bearer ${storedToken}`;
    const response = await fetch(`${API_BASE_URL}/api/admin/invoices/${id}/append-pages`, {
      method: 'POST',
      credentials: API_BASE_URL ? 'include' : 'same-origin',
      headers,
      body: formData,
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Append pages failed: ${response.status}`);
    }
    return response.json();
  }
  async invoiceUpdate(id, body) {
    return this.fetch(`/api/admin/invoices/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  }
  async invoiceDelete(id) {
    return this.fetch(`/api/admin/invoices/${id}`, { method: 'DELETE' });
  }
  async invoiceFileBlobUrl(id, pageIndex) {
    const tok = localStorage.getItem('access_token');
    const path = (pageIndex == null || pageIndex === 0)
      ? `/api/admin/invoices/${id}/file`
      : `/api/admin/invoices/${id}/pages/${pageIndex}`;
    const res = await fetch(`${API_BASE_URL}${path}`, {
      headers: tok ? { Authorization: `Bearer ${tok}` } : {},
    });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }

  // ============== BANK STATEMENTS (AI income/expense splitter) ==============
  async bankStatementsList({ location_id, location_ids } = {}) {
    const params = { location_id };
    if (Array.isArray(location_ids) && location_ids.length) {
      params.location_ids = location_ids.join(',');
    }
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v),
    ).toString();
    return this.fetch(`/api/admin/bank-statements${qs ? '?' + qs : ''}`);
  }
  async bankStatementsAggregate({ location_ids, ids } = {}) {
    const params = {};
    if (Array.isArray(location_ids) && location_ids.length) params.location_ids = location_ids.join(',');
    if (Array.isArray(ids) && ids.length) params.ids = ids.join(',');
    const qs = new URLSearchParams(params).toString();
    return this.fetch(`/api/admin/bank-statements/aggregate${qs ? '?' + qs : ''}`);
  }
  async bankStatementsAggregateXlsxUrl({ location_ids, ids } = {}) {
    const params = new URLSearchParams();
    if (Array.isArray(location_ids) && location_ids.length) params.set('location_ids', location_ids.join(','));
    if (Array.isArray(ids) && ids.length) params.set('ids', ids.join(','));
    const tok = localStorage.getItem('access_token');
    const url = `${API_BASE_URL}/api/admin/bank-statements/aggregate/xlsx${params.toString() ? '?' + params.toString() : ''}`;
    const res = await fetch(url, { headers: tok ? { Authorization: `Bearer ${tok}` } : {} });
    if (!res.ok) {
      const raw = await res.text().catch(() => '');
      let detail = raw;
      try {
        const j = JSON.parse(raw);
        detail = j.detail || j.message || JSON.stringify(j).slice(0, 300);
      } catch {
        if (/<html/i.test(raw)) {
          detail = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240);
        } else {
          detail = raw.slice(0, 300);
        }
      }
      throw new Error(`XLSX download failed (HTTP ${res.status}): ${detail || res.statusText || 'no body'}`);
    }
    const blob = await res.blob();
    if (!blob || blob.size === 0) {
      throw new Error('XLSX download failed: server returned an empty file.');
    }
    return URL.createObjectURL(blob);
  }
  async bankStatementUpload(formData) {
    const tok = localStorage.getItem('access_token');
    const response = await fetch(`${API_BASE_URL}/api/admin/bank-statements/upload`, {
      method: 'POST',
      headers: tok ? { Authorization: `Bearer ${tok}` } : {},
      body: formData,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || 'Upload failed');
    }
    return response.json();
  }
  async bankStatementGet(id) {
    return this.fetch(`/api/admin/bank-statements/${id}`);
  }
  async bankStatementXlsxUrl(id) {
    // Returns a blob URL for immediate download — auth header included.
    // Reads the body as text first so non-JSON error pages (Cloudflare
    // HTML, plain-text stack traces, etc.) surface useful diagnostics.
    const tok = localStorage.getItem('access_token');
    const res = await fetch(`${API_BASE_URL}/api/admin/bank-statements/${id}/xlsx`, {
      headers: tok ? { Authorization: `Bearer ${tok}` } : {},
    });
    if (!res.ok) {
      const raw = await res.text().catch(() => '');
      let detail = raw;
      try {
        const j = JSON.parse(raw);
        detail = j.detail || j.message || JSON.stringify(j).slice(0, 300);
      } catch {
        if (/<html/i.test(raw)) {
          detail = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240);
        } else {
          detail = raw.slice(0, 300);
        }
      }
      throw new Error(`XLSX download failed (HTTP ${res.status}): ${detail || res.statusText || 'no body'}`);
    }
    const blob = await res.blob();
    if (!blob || blob.size === 0) {
      throw new Error('XLSX download failed: server returned an empty file.');
    }
    return URL.createObjectURL(blob);
  }
  async bankStatementDelete(id) {
    return this.fetch(`/api/admin/bank-statements/${id}`, { method: 'DELETE' });
  }
  // ============== BANK STATEMENT RULES (custom category rules) ==============
  async bankRulesList() {
    return this.fetch(`/api/admin/bank-statements/rules`);
  }
  async bankRuleCreate(body) {
    return this.fetch(`/api/admin/bank-statements/rules`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }
  async bankRuleDelete(id) {
    return this.fetch(`/api/admin/bank-statements/rules/${id}`, { method: 'DELETE' });
  }

  async bankStatementReclassify(id, engine = 'python') {
    const qs = new URLSearchParams({ engine }).toString();
    return this.fetch(`/api/admin/bank-statements/${id}/reclassify?${qs}`, { method: 'POST' });
  }

  async bankStatementDebugMatches(id) {
    return this.fetch(`/api/admin/bank-statements/${id}/debug/matches`);
  }

  async bankStatementDebugInvoices(location_id) {
    const qs = new URLSearchParams({ location_id }).toString();
    return this.fetch(`/api/admin/bank-statements/debug/invoices?${qs}`);
  }

  // ============== INSPECTION PACK (EHO-ready audit bundle) ==============
  async adminInspectionPack({ location_id, start_date, end_date } = {}) {
    const qs = new URLSearchParams(
      Object.entries({ location_id, start_date, end_date }).filter(([, v]) => v),
    ).toString();
    return this.fetch(`/api/admin/inspection/pack${qs ? '?' + qs : ''}`);
  }

  // ============== DOCUMENTS (per-location file vault) ==============
  async documentsList({ location_id, category } = {}) {
    const qs = new URLSearchParams(
      Object.entries({ location_id, category }).filter(([, v]) => v),
    ).toString();
    return this.fetch(`/api/admin/documents${qs ? '?' + qs : ''}`);
  }
  async documentsCategories() {
    return this.fetch('/api/admin/documents/categories');
  }
  async documentsUpload(formData) {
    // Multipart; let the browser set the Content-Type with the boundary.
    const url = `${API_BASE_URL}/api/admin/documents/upload`;
    const tok = localStorage.getItem('access_token');
    const res = await fetch(url, {
      method: 'POST',
      headers: tok ? { Authorization: `Bearer ${tok}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Upload failed: ${res.status} ${txt}`);
    }
    return res.json();
  }
  /** Returns a fetch-blob URL the caller must `URL.revokeObjectURL` later.
   *  Used for inline preview of PDFs/images so the auth header stays attached. */
  async documentsFileBlobUrl(docId) {
    const tok = localStorage.getItem('access_token');
    const res = await fetch(`${API_BASE_URL}/api/admin/documents/${docId}/file`, {
      headers: tok ? { Authorization: `Bearer ${tok}` } : {},
    });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }
  async documentsDelete(docId) {
    return this.fetch(`/api/admin/documents/${docId}`, { method: 'DELETE' });
  }
  async documentsUpdate(docId, patch) {
    return this.fetch(`/api/admin/documents/${docId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }

  // ============== ROUTINE TEMPS (opening / closing) ==============
  async submitRoutineTemp(data) { return this.fetch('/api/admin/routine-temps', { method: 'POST', body: JSON.stringify(data) }); }
  async listRoutineTemps(filters = {}) {
    const qs = new URLSearchParams(Object.entries(filters).filter(([,v]) => v != null && v !== '')).toString();
    return this.fetch(`/api/admin/routine-temps${qs ? '?' + qs : ''}`);
  }
  async adminUpdateTempUnit(unitId, data) { return this.fetch(`/api/admin/temp/units/${unitId}`, { method: 'PATCH', body: JSON.stringify(data) }); }

  // ============== COOKING & COOLING ==============
  async coolingCatalog(locationId) { return this.fetch(`/api/admin/cooking-cooling/catalog?location_id=${encodeURIComponent(locationId)}`); }
  async coolingAddCustomItem(data) { return this.fetch('/api/admin/cooking-cooling/catalog', { method: 'POST', body: JSON.stringify(data) }); }
  async coolingActiveCount(locationId) { return this.fetch(`/api/admin/cooking-cooling/active-count?location_id=${encodeURIComponent(locationId)}`); }
  async coolingList(locationId, status) {
    const qs = new URLSearchParams({ location_id: locationId, ...(status ? { status } : {}) }).toString();
    return this.fetch(`/api/admin/cooking-cooling?${qs}`);
  }
  async coolingGet(id) { return this.fetch(`/api/admin/cooking-cooling/${id}`); }
  async coolingStart(data) { return this.fetch('/api/admin/cooking-cooling/start', { method: 'POST', body: JSON.stringify(data) }); }
  async coolingComplete(id, data) { return this.fetch(`/api/admin/cooking-cooling/${id}/complete`, { method: 'PATCH', body: JSON.stringify(data) }); }
  async coolingDelete(id) { return this.fetch(`/api/admin/cooking-cooling/${id}`, { method: 'DELETE' }); }

  // ============== REHEATING ==============
  async reheatingList(locationId) { return this.fetch(`/api/admin/reheating?location_id=${encodeURIComponent(locationId)}`); }
  async reheatingRecord(data) { return this.fetch('/api/admin/reheating', { method: 'POST', body: JSON.stringify(data) }); }
  async reheatingDelete(id) { return this.fetch(`/api/admin/reheating/${id}`, { method: 'DELETE' }); }
  async reheatingNoReheating(locationId) {
    return this.fetch('/api/admin/reheating/no-reheating', { method: 'POST', body: JSON.stringify({ location_id: locationId }) });
  }

  // ============== COOKED (CORE TEMP) ==============
  async cookedList(locationId) { return this.fetch(`/api/admin/cooked?location_id=${encodeURIComponent(locationId)}`); }
  async cookedRecord(data) { return this.fetch('/api/admin/cooked', { method: 'POST', body: JSON.stringify(data) }); }
  async cookedDelete(id) { return this.fetch(`/api/admin/cooked/${id}`, { method: 'DELETE' }); }

  // ============== DELIVERIES (JKHive goods-in) ==============
  async deliveriesSuppliersList(locationId) { return this.fetch(`/api/admin/deliveries/suppliers?location_id=${encodeURIComponent(locationId)}`); }
  async deliveriesSupplierAdd(data) { return this.fetch('/api/admin/deliveries/suppliers', { method: 'POST', body: JSON.stringify(data) }); }
  async deliveriesSupplierUpdate(id, data) { return this.fetch(`/api/admin/deliveries/suppliers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
  async deliveriesSupplierDelete(id) { return this.fetch(`/api/admin/deliveries/suppliers/${id}`, { method: 'DELETE' }); }
  async deliveriesList(locationId) { return this.fetch(`/api/admin/deliveries?location_id=${encodeURIComponent(locationId)}`); }
  async deliveriesRecord(data) { return this.fetch('/api/admin/deliveries', { method: 'POST', body: JSON.stringify(data) }); }
  async deliveriesDelete(id) { return this.fetch(`/api/admin/deliveries/${id}`, { method: 'DELETE' }); }
  async deliveriesNoDelivery(locationId) { return this.fetch('/api/admin/deliveries/no-delivery', { method: 'POST', body: JSON.stringify({ location_id: locationId, comment: '' }) }); }
  async coolingNoBulkPrep(locationId) { return this.fetch('/api/admin/cooking-cooling/no-bulk-prep', { method: 'POST', body: JSON.stringify({ location_id: locationId, comment: '' }) }); }

  // ============== INVENTORY ==============
  async inventoryAddStock(data) { return this.fetch('/api/admin/inventory/stock', { method: 'POST', body: JSON.stringify(data) }); }
  async inventoryList(locationId) { return this.fetch(`/api/admin/inventory?location_id=${encodeURIComponent(locationId)}`); }
  async inventoryBatches(locationId, opts = {}) {
    const qs = new URLSearchParams({ location_id: locationId, ...opts }).toString();
    return this.fetch(`/api/admin/inventory/batches?${qs}`);
  }
  async inventoryBatchDelete(batchId) { return this.fetch(`/api/admin/inventory/batches/${batchId}`, { method: 'DELETE' }); }

  // ============== WASTAGE ==============
  async wastageList(locationId, type = 'in_prep') { return this.fetch(`/api/admin/wastage?location_id=${encodeURIComponent(locationId)}&type=${type}`); }
  async wastageSummary(locationId, type = 'in_prep') { return this.fetch(`/api/admin/wastage/summary?location_id=${encodeURIComponent(locationId)}&type=${type}`); }
  async wastageRecord(data) { return this.fetch('/api/admin/wastage', { method: 'POST', body: JSON.stringify(data) }); }
  async wastageDelete(id) { return this.fetch(`/api/admin/wastage/${id}`, { method: 'DELETE' }); }

  // ============== PROBE CALIBRATION ==============
  async probesList(locationId) { return this.fetch(`/api/admin/probes?location_id=${encodeURIComponent(locationId)}`); }
  async probeAdd(data) { return this.fetch('/api/admin/probes', { method: 'POST', body: JSON.stringify(data) }); }
  async probeUpdate(id, data) { return this.fetch(`/api/admin/probes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
  async probeDelete(id) { return this.fetch(`/api/admin/probes/${id}`, { method: 'DELETE' }); }
  async probeCalibrations(locationId, opts = {}) {
    const qs = new URLSearchParams({ location_id: locationId, ...opts }).toString();
    return this.fetch(`/api/admin/probes/calibrations?${qs}`);
  }
  async probeCalibrate(data) { return this.fetch('/api/admin/probes/calibrations', { method: 'POST', body: JSON.stringify(data) }); }
  async probeCalibrationUpdate(id, data) { return this.fetch(`/api/admin/probes/calibrations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
  async probeCalibrationDelete(id) { return this.fetch(`/api/admin/probes/calibrations/${id}`, { method: 'DELETE' }); }
  async probeCalibrationHistory({ location_id, start_date, end_date, limit } = {}) {
    const qs = new URLSearchParams(Object.entries({ location_id, start_date, end_date, limit }).filter(([, v]) => v != null && v !== '')).toString();
    return this.fetch(`/api/admin/probes/calibrations/history${qs ? '?' + qs : ''}`);
  }

  // ============== WASHER TEMPS ==============
  async washersList(locationId) { return this.fetch(`/api/admin/washers?location_id=${encodeURIComponent(locationId)}`); }
  async washerAdd(data) { return this.fetch('/api/admin/washers', { method: 'POST', body: JSON.stringify(data) }); }
  async washerUpdate(id, data) { return this.fetch(`/api/admin/washers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
  async washerDelete(id) { return this.fetch(`/api/admin/washers/${id}`, { method: 'DELETE' }); }
  async washerChecks(locationId, opts = {}) {
    const qs = new URLSearchParams({ location_id: locationId, ...opts }).toString();
    return this.fetch(`/api/admin/washers/checks?${qs}`);
  }
  async washerRecord(data) { return this.fetch('/api/admin/washers/checks', { method: 'POST', body: JSON.stringify(data) }); }
  async washerCheckDelete(id) { return this.fetch(`/api/admin/washers/checks/${id}`, { method: 'DELETE' }); }

  // ============== FOOD ACIDITY (pH) ==============
  async acidityList(locationId) { return this.fetch(`/api/admin/acidity?location_id=${encodeURIComponent(locationId)}`); }
  async acidityRecord(data) { return this.fetch('/api/admin/acidity', { method: 'POST', body: JSON.stringify(data) }); }
  async acidityDelete(id) { return this.fetch(`/api/admin/acidity/${id}`, { method: 'DELETE' }); }

  // ============== VACUUM PACKING ==============
  async vacuumList(locationId) { return this.fetch(`/api/admin/vacuum-packing?location_id=${encodeURIComponent(locationId)}`); }
  async vacuumRecord(data) { return this.fetch('/api/admin/vacuum-packing', { method: 'POST', body: JSON.stringify(data) }); }
  async vacuumDelete(id) { return this.fetch(`/api/admin/vacuum-packing/${id}`, { method: 'DELETE' }); }

  // ============== FOOD WASHING ==============
  async foodWashList(locationId) { return this.fetch(`/api/admin/food-washing?location_id=${encodeURIComponent(locationId)}`); }
  async foodWashRecord(data) { return this.fetch('/api/admin/food-washing', { method: 'POST', body: JSON.stringify(data) }); }
  async foodWashDelete(id) { return this.fetch(`/api/admin/food-washing/${id}`, { method: 'DELETE' }); }

  // ============== SOUS VIDE ==============
  async sousVideList(locationId, status) {
    const qs = new URLSearchParams({ location_id: locationId, ...(status ? { status } : {}) }).toString();
    return this.fetch(`/api/admin/sous-vide?${qs}`);
  }
  async sousVideRecord(data) { return this.fetch('/api/admin/sous-vide', { method: 'POST', body: JSON.stringify(data) }); }
  async sousVideComplete(id, data) { return this.fetch(`/api/admin/sous-vide/${id}/complete`, { method: 'PATCH', body: JSON.stringify(data) }); }
  async sousVideDelete(id) { return this.fetch(`/api/admin/sous-vide/${id}`, { method: 'DELETE' }); }

  // ============== LEGIONELLA ==============
  async legionellaList(locationId) { return this.fetch(`/api/admin/legionella?location_id=${encodeURIComponent(locationId)}`); }
  async legionellaCreate(data) { return this.fetch('/api/admin/legionella', { method: 'POST', body: JSON.stringify(data) }); }
  async legionellaDelete(id) { return this.fetch(`/api/admin/legionella/${id}`, { method: 'DELETE' }); }

  // ============== HOT / COLD HOLDING ==============
  async hotColdList(locationId, status) {
    const qs = new URLSearchParams({ location_id: locationId, ...(status ? { status } : {}) }).toString();
    return this.fetch(`/api/admin/hot-cold/sessions?${qs}`);
  }
  async hotColdStart(data) { return this.fetch('/api/admin/hot-cold/sessions', { method: 'POST', body: JSON.stringify(data) }); }
  async hotColdCheck(id, data) { return this.fetch(`/api/admin/hot-cold/sessions/${id}/check`, { method: 'POST', body: JSON.stringify(data) }); }
  async hotColdComplete(id, data) { return this.fetch(`/api/admin/hot-cold/sessions/${id}/complete`, { method: 'POST', body: JSON.stringify(data) }); }
  async hotColdDelete(id) { return this.fetch(`/api/admin/hot-cold/sessions/${id}`, { method: 'DELETE' }); }
  async hotColdNoMode(locationId, mode) { return this.fetch('/api/admin/hot-cold/no-mode', { method: 'POST', body: JSON.stringify({ location_id: locationId, mode }) }); }

  // ============== CHECKLISTS ==============
  async checklistList(locationId, frequency) {
    const qs = new URLSearchParams({ location_id: locationId, ...(frequency ? { frequency } : {}) }).toString();
    return this.fetch(`/api/admin/checklists?${qs}`);
  }
  async checklistGet(id, locationId) {
    const qs = locationId ? `?location_id=${encodeURIComponent(locationId)}` : '';
    return this.fetch(`/api/admin/checklists/${id}${qs}`);
  }
  async checklistCreate(data) { return this.fetch('/api/admin/checklists', { method: 'POST', body: JSON.stringify(data) }); }
  async checklistUpdate(id, data) { return this.fetch(`/api/admin/checklists/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
  async checklistDelete(id) { return this.fetch(`/api/admin/checklists/${id}`, { method: 'DELETE' }); }
  async checklistDuplicate(id, locationId) { return this.fetch(`/api/admin/checklists/${id}/duplicate?location_id=${encodeURIComponent(locationId)}`, { method: 'POST' }); }
  async checklistRunsList(id) { return this.fetch(`/api/admin/checklists/${id}/runs`); }
  async checklistRunSubmit(id, data) { return this.fetch(`/api/admin/checklists/${id}/runs`, { method: 'POST', body: JSON.stringify(data) }); }
  async checklistRunDelete(runId) { return this.fetch(`/api/admin/checklists/runs/${runId}`, { method: 'DELETE' }); }

  // ============== WEB PUSH ==============
  async pushVapidKey() { return this.fetch('/api/push/vapid-public-key'); }
  async pushSubscribe(data) { return this.fetch('/api/push/subscribe', { method: 'POST', body: JSON.stringify(data) }); }
  async pushUnsubscribe(endpoint) { return this.fetch('/api/push/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint }) }); }
  async pushTest() { return this.fetch('/api/admin/push/test', { method: 'POST' }); }

  // ============== CLEANING SCHEDULES (daily + weekly deep) ==============
  // kind = 'daily-cleaning' | 'weekly-cleaning'
  async adminGetCleaningItems(kind, locationId) {
    const q = locationId ? `?location_id=${encodeURIComponent(locationId)}` : '';
    return this.fetch(`/api/admin/${kind}/items${q}`);
  }
  async adminListAllCleaningItems(kind) { return this.fetch(`/api/admin/${kind}/items/all`); }
  async adminCreateCleaningItem(kind, data) { return this.fetch(`/api/admin/${kind}/items`, { method: 'POST', body: JSON.stringify(data) }); }
  async adminUpdateCleaningItem(kind, id, data) { return this.fetch(`/api/admin/${kind}/items/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
  async adminDeleteCleaningItem(kind, id) { return this.fetch(`/api/admin/${kind}/items/${id}`, { method: 'DELETE' }); }
  async adminSubmitCleaningLog(kind, data) { return this.fetch(`/api/admin/${kind}`, { method: 'POST', body: JSON.stringify(data) }); }
  async adminGetCleaningLog(kind, locationId, weekEnding) { return this.fetch(`/api/admin/${kind}?location_id=${locationId}&week_ending=${weekEnding}`); }
  async adminGetCleaningHistory(kind, filters = {}) {
    const p = new URLSearchParams();
    if (filters.location_id) p.append('location_id', filters.location_id);
    if (filters.start_date) p.append('start_date', filters.start_date);
    if (filters.end_date) p.append('end_date', filters.end_date);
    return this.fetch(`/api/admin/${kind}/history?${p}`);
  }

  // ============== COMPLIANCE (EHO Dashboard) ==============
  async adminGetCompliance({ start_date, end_date, location_id }) {
    const p = new URLSearchParams({ start_date, end_date });
    if (location_id) p.append('location_id', location_id);
    return this.fetch(`/api/admin/compliance?${p}`);
  }
  async adminGetComplianceDetail({ location_id, check_key, start_date, end_date }) {
    const p = new URLSearchParams({ location_id, check_key, start_date, end_date });
    return this.fetch(`/api/admin/compliance/detail?${p}`);
  }
  async adminSendComplianceDigestNow() {
    return this.fetch('/api/admin/compliance-digest/send-now', { method: 'POST' });
  }
  async adminGetComplianceDigestRecipients() {
    return this.fetch('/api/admin/compliance-digest/recipients');
  }

  // ===== Offers =====
  async listOffers(locationId) {
    const qs = locationId ? `?location_id=${encodeURIComponent(locationId)}` : '';
    return this.fetch(`/api/offers${qs}`);
  }
  async adminListOffers() { return this.fetch('/api/admin/offers'); }
  async adminCreateOffer(data) {
    return this.fetch('/api/admin/offers', { method: 'POST', body: JSON.stringify(data) });
  }
  async adminUpdateOffer(id, data) {
    return this.fetch(`/api/admin/offers/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async adminDeleteOffer(id) {
    return this.fetch(`/api/admin/offers/${id}`, { method: 'DELETE' });
  }
  async adminUploadOfferImage(file) {
    const url = `${API_BASE_URL}/api/admin/offers/upload-image`;
    const form = new FormData();
    form.append('file', file);
    const headers = {};
    const t = localStorage.getItem('access_token');
    if (t) headers['Authorization'] = `Bearer ${t}`;
    const res = await fetch(url, {
      method: 'POST', body: form, headers,
      credentials: API_BASE_URL ? 'include' : 'same-origin',
    });
    if (!res.ok) throw new Error((await res.json()).detail || 'Upload failed');
    return res.json();
  }

  // ===== Friday Feast =====
  async getFridayMenu(locationId) {
    const qs = locationId ? `?location_id=${encodeURIComponent(locationId)}` : '';
    return this.fetch(`/api/friday-menu${qs}`);
  }
  async fridayCheckout(payload) {
    return this.fetch('/api/friday-menu/checkout', { method: 'POST', body: JSON.stringify(payload) });
  }
  async fridayCheckoutStatus(sessionId) {
    return this.fetch(`/api/friday-menu/status/${sessionId}`);
  }
  async adminListFridayMenus() { return this.fetch('/api/admin/friday-menus'); }
  async adminCreateFridayMenu(data) {
    return this.fetch('/api/admin/friday-menus', { method: 'POST', body: JSON.stringify(data) });
  }
  async adminUpdateFridayMenu(id, data) {
    return this.fetch(`/api/admin/friday-menus/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async adminDeleteFridayMenu(id) {
    return this.fetch(`/api/admin/friday-menus/${id}`, { method: 'DELETE' });
  }
  async adminUploadFridayImage(file) {
    const url = `${API_BASE_URL}/api/admin/friday-menus/upload-image`;
    const form = new FormData();
    form.append('file', file);
    const headers = {};
    const t = localStorage.getItem('access_token');
    if (t) headers['Authorization'] = `Bearer ${t}`;
    const res = await fetch(url, {
      method: 'POST', body: form, headers,
      credentials: API_BASE_URL ? 'include' : 'same-origin',
    });
    if (!res.ok) throw new Error((await res.json()).detail || 'Upload failed');
    return res.json();
  }
  async adminListFridayOrders(week, locationId) {
    const qs = [];
    if (week) qs.push(`week=${encodeURIComponent(week)}`);
    if (locationId) qs.push(`location_id=${encodeURIComponent(locationId)}`);
    return this.fetch(`/api/admin/friday-orders${qs.length ? '?' + qs.join('&') : ''}`);
  }

  // ============== CLOCK IN / OUT ==============
  async getClockStatus() {
    return this.fetch('/api/clock/status');
  }
  async clockIn(payload) {
    return this.fetch('/api/clock/in', { method: 'POST', body: JSON.stringify(payload) });
  }
  async clockOut(payload) {
    return this.fetch('/api/clock/out', { method: 'POST', body: JSON.stringify(payload) });
  }
  async getMyClockHistory(limit = 50) {
    return this.fetch(`/api/clock/history?limit=${limit}`);
  }
  async adminGetClockEvents({ locationId, days = 7 } = {}) {
    const qs = [`days=${days}`];
    if (locationId) qs.push(`location_id=${encodeURIComponent(locationId)}`);
    return this.fetch(`/api/clock/admin/events?${qs.join('&')}`);
  }

  // ---- Restock (per-location shopping list) ----
  async restockList({ location_id, status = 'open' } = {}) {
    const qs = new URLSearchParams();
    if (location_id) qs.set('location_id', location_id);
    if (status) qs.set('status', status);
    return this.fetch(`/api/restock?${qs.toString()}`);
  }
  async restockCreate(payload) {
    return this.fetch('/api/restock', { method: 'POST', body: JSON.stringify(payload) });
  }
  async restockUpdate(id, payload) {
    return this.fetch(`/api/restock/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
  }
  async restockDelete(id) {
    return this.fetch(`/api/restock/${id}`, { method: 'DELETE' });
  }
  async restockReopen(id) {
    return this.fetch(`/api/restock/${id}/reopen`, { method: 'POST' });
  }
}

export const api = new ApiService();
export default api;
