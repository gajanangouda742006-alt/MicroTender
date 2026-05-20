const API_BASE = '/api';

let isRefreshing = false;
let refreshQueue = [];

async function request(endpoint, options = {}, retried = false) {
  const token = localStorage.getItem('token');
  const headers = { ...options.headers };

  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });

  // Auto-refresh on 401
  if (res.status === 401 && !retried) {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      try {
        const refreshed = await refreshAccessToken(refreshToken);
        if (refreshed) {
          return request(endpoint, options, true);
        }
      } catch (e) {
        // Refresh failed, clear tokens
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
        throw new Error('Session expired. Please login again.');
      }
    }
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

async function refreshAccessToken(refreshToken) {
  if (isRefreshing) {
    return new Promise((resolve) => { refreshQueue.push(resolve); });
  }
  isRefreshing = true;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });
    if (!res.ok) throw new Error('Refresh failed');
    const data = await res.json();
    localStorage.setItem('token', data.token);
    localStorage.setItem('refreshToken', data.refreshToken);
    // Resolve queued requests
    refreshQueue.forEach(cb => cb(true));
    refreshQueue = [];
    return true;
  } catch (err) {
    refreshQueue.forEach(cb => cb(false));
    refreshQueue = [];
    throw err;
  } finally {
    isRefreshing = false;
  }
}

const api = {
  // Auth
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  getProfile: () => request('/auth/me'),
  updateProfile: (data) => request('/auth/me', { method: 'PUT', body: JSON.stringify(data) }),
  refreshAccessToken: (refreshToken) => refreshAccessToken(refreshToken),
  sendOtp: (email) => request('/auth/send-otp', { method: 'POST', body: JSON.stringify({ email }) }),
  verifyOtp: (email, otp) => request('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ email, otp }) }),
  logout: (refreshToken) => request('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }),

  // Complaints
  getComplaints: (params = '') => request(`/complaints${params ? '?' + params : ''}`),
  getMyComplaints: () => request(`/complaints/my`),
  getComplaint: (id) => request(`/complaints/${id}`),
  createComplaint: (formData) => request('/complaints', { method: 'POST', body: formData, headers: {} }),
  deleteComplaint: (id) => request(`/complaints/${id}`, { method: 'DELETE' }),
  analyzeComplaint: (formData) => request('/complaints/analyze', { method: 'POST', body: formData, headers: {} }),
  rateComplaint: (id, score, feedback, proofImage) => {
    const formData = new FormData();
    formData.append('score', score);
    if (feedback) formData.append('feedback', feedback);
    if (proofImage) formData.append('proof', proofImage);
    return request(`/complaints/${id}/rate`, { method: 'POST', body: formData });
  },
  getScoreboard: () => request('/complaints/scoreboard/citizens'),

  // Tenders
  getTenders: (params = '') => request(`/tenders${params ? '?' + params : ''}`),
  getTender: (id) => request(`/tenders/${id}`),
  getTenderDetails: (id) => request(`/tenders/${id}`),
  updateTenderStatus: (id, status) => request(`/tenders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  // Vendors
  registerVendor: (data) => request('/vendors/register', { method: 'POST', body: JSON.stringify(data) }),
  getVendorProfile: () => request('/vendors/profile'),
  updateVendorProfile: (data) => request('/vendors/profile', { method: 'PUT', body: JSON.stringify(data) }),
  getNearbyTenders: (radius) => request(`/vendors/nearby-tenders?radius=${radius || 5}`),
  applyToTender: (tenderId, data) => request(`/vendors/apply/${tenderId}`, { method: 'POST', body: JSON.stringify(data) }),
  getMyJobs: () => request('/vendors/my-jobs'),
  submitCompletionProof: (tenderId, formData) => {
    const token = localStorage.getItem('token');
    return fetch(`${API_URL}/tenders/${tenderId}/complete`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    }).then(r => r.json());
  },

  // Work Updates
  submitWorkUpdate: (formData) => request('/work-updates', { method: 'POST', body: formData, headers: {} }),
  getWorkUpdates: (tenderId) => request(`/work-updates/${tenderId}`),

  // Admin
  getTenderDetails: (id) => request(`/tenders/${id}`),
  adminAction: (tender_id, action, notes) => request('/admin/tender-action', { method: 'POST', body: JSON.stringify({ tender_id, action, notes }) }),
  autoAssign: (tender_id) => request(`/admin/auto-assign/${tender_id}`, { method: 'POST' }),
  assignVendor: (tender_id, vendor_id) => request('/admin/assign-vendor', { method: 'POST', body: JSON.stringify({ tender_id, vendor_id }) }),
  adminVerifyCompletion: (tenderId) => request(`/admin/tenders/${tenderId}/verify`, { method: 'PUT' }),
  getDashboard: () => request('/admin/dashboard'),
  updateTenderCost: (id, manual_cost, selected_cost_type) => request(`/admin/tender/${id}/cost`, { method: 'PATCH', body: JSON.stringify({ manual_cost, selected_cost_type }) }),
  getFraudAlerts: (resolved) => request(`/admin/fraud-alerts${resolved !== undefined ? '?resolved=' + resolved : ''}`),
  resolveFraudAlert: (id) => request(`/admin/fraud-alerts/${id}/resolve`, { method: 'PATCH' }),
  approveComplaint: (id) => request(`/admin/complaint/${id}/approve`, { method: 'POST' }),
  rejectComplaint: (id, reason) => request(`/admin/complaint/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
  getVendorDetails: (id) => request(`/admin/vendor/${id}/details`),
  getNearbyVendors: (lat, lon, category) => request(`/admin/nearby-vendors?lat=${lat}&lon=${lon}${category ? '&category=' + category : ''}`),
  getAllVendors: () => request('/vendors/all'),
  getVerifications: () => request('/admin/verifications'),

  // Notifications
  getNotifications: () => request('/notifications'),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () => request('/notifications/read-all', { method: 'PATCH' }),
};

export default api;

