import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '';
const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET_KEY || '';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
});

const adminApi = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: {
    'x-admin-key': ADMIN_SECRET,
  },
});

export const templeAPI = {
  getAll:       (params = {}) => api.get('/api/temples', { params }),
  getBySlug:    (slug)        => api.get(`/api/temples/${slug}`),
  search:       (q)           => api.get('/api/temples/search', { params: { q } }),
  getNearby:    (lat, lng, radius_km = 10) =>
                  api.get('/api/temples/nearby', { params: { lat, lng, radius_km } }),
  getMantras:   (id)          => api.get(`/api/temples/${id}/mantras`),
  getFestivals: (id)          => api.get(`/api/temples/${id}/festivals`),
  getSevas:     (id)          => api.get(`/api/temples/${id}/sevas`),
  getMedia:     (id)          => api.get(`/api/temples/${id}/media`),
  health:       ()            => api.get('/api/health'),
};

export const routeAPI = {
  plan:    (data) => api.post('/api/route/plan', data),
  presets: ()     => api.get('/api/route/presets'),
};

export const adminAPI = {
  // Temple CRUD
  createTemple: (formData) =>
    adminApi.post('/api/admin/temples', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  listAll: (page = 1) =>
    adminApi.get('/api/admin/temples', { params: { page } }),

  // Media
  uploadMedia: (templeId, formData) =>
    adminApi.post(`/api/admin/temples/${templeId}/media`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getMedia:    (templeId) => adminApi.get(`/api/admin/temples/${templeId}/media`),
  deleteMedia: (mediaId)  => adminApi.delete(`/api/admin/media/${mediaId}`),
};