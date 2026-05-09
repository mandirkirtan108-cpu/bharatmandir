import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

const adminApi = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

// Read from sessionStorage with correct key 'bm_access_token'
adminApi.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('bm_access_token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// Token expired → redirect to login
adminApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      sessionStorage.removeItem('bm_access_token');
      sessionStorage.removeItem('bm_refresh_token');
      sessionStorage.removeItem('bm_admin_user');
      window.location.href = '/admin/login';
    }
    return Promise.reject(err);
  }
);

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
    try {
      return await adminApi.get(`/api/admin/temples/${id}/media`);
    } catch {
      return { data: { media: [] } };
    }
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