// API service for connecting to MongoDB backend
// Use VITE_API_URL if set, otherwise auto-detect production backend
const PROD_BACKEND = 'https://jollys-kafe-backend-production.up.railway.app';
const API_BASE_URL = import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname === 'www.jollyskafe.com' ? PROD_BACKEND : '');

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
}

export const api = new ApiService();
export default api;
