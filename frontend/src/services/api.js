import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET_KEY || '';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 20000,
});

const adminApi = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: { 'x-admin-key': ADMIN_SECRET },
});

export const templeAPI = {
  getAll:       (params = {}) => api.get('/api/temples', { params }),
  getBySlug:    (slug)        => api.get(`/api/temples/${slug}`),
  search:       (q)           => api.get('/api/temples/search', { params: { q } }),
  getNearby:    (lat, lng, radius_km = 10) =>
                  api.get('/api/temples/nearby', { params: { lat, lng, radius_km } }),
  getMantras:   (id) => api.get(`/api/temples/${id}/mantras`),
  getFestivals: (id) => api.get(`/api/temples/${id}/festivals`),
  getSevas:     (id) => api.get(`/api/temples/${id}/sevas`),

  // FIXED: was hitting non-existent public route → crashed outer try/catch → "Failed to load temple"
  // Now correctly wrapped so a 401/404 from admin endpoint NEVER breaks the main page load
  getMedia: async (id) => {
    try {
      return await adminApi.get(`/api/admin/temples/${id}/media`);
    } catch {
      return { data: { media: [] } };
    }
  },

  // Was missing entirely — edit modal silently did nothing
  update: (id, data) => adminApi.patch(`/api/admin/temples/${id}`, data),

  getPujaSchedule: (id) => api.get(`/api/temples/${id}/puja-schedule`),
  getPriests:      (id) => api.get(`/api/temples/${id}/priests`),
  health:          ()   => api.get('/api/health'),
};

export const routeAPI = {
  plan:    (data) => api.post('/api/route/plan', data),
  presets: ()     => api.get('/api/route/presets'),
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