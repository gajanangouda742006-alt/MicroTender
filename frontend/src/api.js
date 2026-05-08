const API_BASE = '/api';

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = { ...options.headers };

  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

const api = {
  // Auth
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  getProfile: () => request('/auth/me'),
  sendOtp: (email) => request('/auth/send-otp', { method: 'POST', body: JSON.stringify({ email }) }),
  verifyOtp: (email, otp) => request('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ email, otp }) }),

  // Complaints
  getComplaints: (params = '') => request(`/complaints${params ? '?' + params : ''}`),
  getComplaint: (id) => request(`/complaints/${id}`),
  createComplaint: (formData) => request('/complaints', { method: 'POST', body: formData, headers: {} }),
  analyzeComplaint: (formData) => request('/complaints/analyze', { method: 'POST', body: formData, headers: {} }),
  rateComplaint: (id, score, feedback) => request(`/complaints/${id}/rate`, { method: 'POST', body: JSON.stringify({ score, feedback }) }),
  getScoreboard: () => request('/complaints/scoreboard/citizens'),

  // Tenders
  getTenders: (params = '') => request(`/tenders${params ? '?' + params : ''}`),
  getTender: (id) => request(`/tenders/${id}`),
  updateTenderStatus: (id, status) => request(`/tenders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  // Vendors
  registerVendor: (data) => request('/vendors/register', { method: 'POST', body: JSON.stringify(data) }),
  getVendorProfile: () => request('/vendors/profile'),
  updateVendorProfile: (data) => request('/vendors/profile', { method: 'PUT', body: JSON.stringify(data) }),
  getNearbyTenders: (radius) => request(`/vendors/nearby-tenders?radius=${radius || 5}`),
  applyToTender: (tenderId, bid_amount, proposal) => request(`/vendors/apply/${tenderId}`, { method: 'POST', body: JSON.stringify({ bid_amount, proposal }) }),
  getMyJobs: () => request('/vendors/my-jobs'),

  // Admin
  getDashboard: () => request('/admin/dashboard'),
  assignVendor: (tender_id, vendor_id) => request('/admin/assign-vendor', { method: 'POST', body: JSON.stringify({ tender_id, vendor_id }) }),
  autoAssign: (tenderId) => request(`/admin/auto-assign/${tenderId}`, { method: 'POST' }),
  updateTenderCost: (id, manual_cost, selected_cost_type) => request(`/admin/tender/${id}/cost`, { method: 'PATCH', body: JSON.stringify({ manual_cost, selected_cost_type }) }),
  adminAction: (tenderId, action, notes) => request(`/admin/action/${tenderId}`, { method: 'POST', body: JSON.stringify({ action, notes }) }),
  getFraudAlerts: (resolved) => request(`/admin/fraud-alerts${resolved !== undefined ? '?resolved=' + resolved : ''}`),
  resolveFraudAlert: (id) => request(`/admin/fraud-alerts/${id}/resolve`, { method: 'PATCH' }),
  getVendorDetails: (id) => request(`/admin/vendor/${id}/details`),
  getNearbyVendors: (lat, lon, category) => request(`/admin/nearby-vendors?lat=${lat}&lon=${lon}${category ? '&category=' + category : ''}`),
  getAllVendors: () => request('/vendors/all'),

  // Notifications
  getNotifications: () => request('/notifications'),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () => request('/notifications/read-all', { method: 'PATCH' }),
};

export default api;
