import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({ baseURL: API_BASE, timeout: 30000 });
const adminApi = axios.create({ baseURL: API_BASE, timeout: 30000 });

// ── Request interceptor: attach token ────────────────────────────────
adminApi.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('bm_access_token');
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

// ── Response interceptor: refresh on 401, then retry ─────────────────
let isRefreshing = false;
let waitingQueue = []; // requests waiting while token refreshes

function processQueue(newToken) {
  waitingQueue.forEach(({ resolve }) => resolve(newToken));
  waitingQueue = [];
}

function clearSessionAndRedirect() {
  sessionStorage.removeItem('bm_access_token');
  sessionStorage.removeItem('bm_refresh_token');
  sessionStorage.removeItem('bm_admin_user');
  window.location.href = '/admin/login';
}

adminApi.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;

    // Only handle 401, and only once per request (prevent infinite retry loop)
    if (err.response?.status !== 401 || original._retry) {
      return Promise.reject(err);
    }
    original._retry = true;

    const refreshToken = sessionStorage.getItem('bm_refresh_token');
    if (!refreshToken) {
      clearSessionAndRedirect();
      return Promise.reject(err);
    }

    // If a refresh is already in progress, queue this request
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        waitingQueue.push({ resolve, reject });
      }).then((newToken) => {
        original.headers['Authorization'] = `Bearer ${newToken}`;
        return adminApi(original);
      });
    }

    // This request is the one doing the refresh
    isRefreshing = true;
    try {
      const { data } = await axios.post(
        `${API_BASE}/api/admin/auth/refresh`,
        { refresh_token: refreshToken }
      );
      const newToken = data.access_token;
      sessionStorage.setItem('bm_access_token', newToken);

      // Update default header for future requests
      adminApi.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;

      // Let all queued requests through with the new token
      processQueue(newToken);

      // Retry the original request
      original.headers['Authorization'] = `Bearer ${newToken}`;
      return adminApi(original);

    } catch (refreshErr) {
      // Refresh itself failed (refresh token also expired) → force login
      waitingQueue.forEach(({ reject }) => reject(refreshErr));
      waitingQueue = [];
      clearSessionAndRedirect();
      return Promise.reject(refreshErr);

    } finally {
      isRefreshing = false;
    }
  }
);

// ── API exports (unchanged) ───────────────────────────────────────────
export const templeAPI = {
  getAll:          (params = {}) => api.get('/api/temples', { params }),
  getBySlug:       (slug)        => api.get(`/api/temples/${slug}`),
  search:          (q)           => api.get('/api/temples/search', { params: { q } }),
  getNearby:       (lat, lng, radius_km = 10) =>
                     api.get('/api/temples/nearby', { params: { lat, lng, radius_km } }),
  getMantras:      (id) => api.get(`/api/temples/${id}/mantras`),
  getFestivals:    (id) => api.get(`/api/temples/${id}/festivals`),
  getSevas:        (id) => api.get(`/api/temples/${id}/sevas`),
  getPujaSchedule: (id) => api.get(`/api/temples/${id}/puja-schedule`),
  getPriests:      (id) => api.get(`/api/temples/${id}/priests`),
  health:          ()   => api.get('/api/health'),

  getMedia: async (id) => {
    try { return await adminApi.get(`/api/admin/temples/${id}/media`); }
    catch { return { data: { media: [] } }; }
  },
  update: (id, data) => adminApi.patch(`/api/admin/temples/${id}`, data),
};

export const adminAPI = {
  createTemple: (formData) =>
    adminApi.post('/api/admin/temples', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  listAll:     (page = 1) => adminApi.get('/api/admin/temples', { params: { page } }),
  uploadMedia: (templeId, formData) =>
    adminApi.post(`/api/admin/temples/${templeId}/media`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getMedia:    (templeId) => adminApi.get(`/api/admin/temples/${templeId}/media`),
  deleteMedia: (mediaId)  => adminApi.delete(`/api/admin/media/${mediaId}`),
};

export const routeAPI = {
  plan:    (data) => api.post('/api/route/plan', data),
  presets: ()     => api.get('/api/route/presets'),
};