import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({ baseURL: API_BASE, timeout: 30000 });
const adminApi = axios.create({ baseURL: API_BASE, timeout: 30000 });

// ── Request interceptor: attach admin token ───────────────────────────
adminApi.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('bm_access_token');
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

// ── Response interceptor: refresh on 401, then retry ─────────────────
let isRefreshing = false;
let waitingQueue = [];

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
    if (err.response?.status !== 401 || original._retry) {
      return Promise.reject(err);
    }
    original._retry = true;

    const refreshToken = sessionStorage.getItem('bm_refresh_token');
    if (!refreshToken) {
      clearSessionAndRedirect();
      return Promise.reject(err);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        waitingQueue.push({ resolve, reject });
      }).then((newToken) => {
        original.headers['Authorization'] = `Bearer ${newToken}`;
        return adminApi(original);
      });
    }

    isRefreshing = true;
    try {
      const { data } = await axios.post(
        `${API_BASE}/api/admin/auth/refresh`,
        { refresh_token: refreshToken }
      );
      const newToken = data.access_token;
      sessionStorage.setItem('bm_access_token', newToken);
      adminApi.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      processQueue(newToken);
      original.headers['Authorization'] = `Bearer ${newToken}`;
      return adminApi(original);
    } catch (refreshErr) {
      waitingQueue.forEach(({ reject }) => reject(refreshErr));
      waitingQueue = [];
      clearSessionAndRedirect();
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  }
);

// ── API exports ───────────────────────────────────────────
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

export const panchangAPI = {
  getDay: (date, params = {}) => api.get('/api/panchang/day', { params: { date, ...params } }),
  getMonth: (year, month, params = {}) => api.get('/api/panchang/month', { params: { year, month, ...params } }),
  getYear: (year, params = {}) => api.get('/api/panchang/year', { params: { year, ...params } }),
  getDaily: (data) => api.post('/api/panchang/daily', data),
  getMuhurat: (data) => api.post('/api/panchang/muhurat', data),
};

// ── User Auth API ────────────────────────────────────────────────────
const USER_ACCESS_KEY  = 'bm_user_access_token';
const USER_REFRESH_KEY = 'bm_user_refresh_token';
const USER_KEY         = 'bm_user';

// Axios instance with user token auto-attach
const userApi = axios.create({ baseURL: API_BASE, timeout: 30000 });
userApi.interceptors.request.use((config) => {
  const token = localStorage.getItem(USER_ACCESS_KEY);
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

export const userAuthAPI = {
  signup:    (data)          => api.post('/api/auth/signup',     data),
  login:     (data)          => api.post('/api/auth/login',      data),
  refresh:   (refresh_token) => api.post('/api/auth/refresh',    { refresh_token }),
  verifyOTP: (email, otp)    => api.post('/api/auth/verify-otp', { email, otp }),
  resendOTP: (email)         => api.post('/api/auth/resend-otp', { email }),

  me:            ()       => userApi.get('/api/auth/me'),
  updateProfile: (data)   => userApi.patch('/api/auth/profile', data),

  saveTokens(data) {
    localStorage.setItem(USER_ACCESS_KEY,  data.access_token);
    localStorage.setItem(USER_REFRESH_KEY, data.refresh_token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  },
  saveUser(user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clearTokens() {
    localStorage.removeItem(USER_ACCESS_KEY);
    localStorage.removeItem(USER_REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  },
  getUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY)); }
    catch { return null; }
  },
};
/*
  Paste this block into frontend/src/services/api.js — after the existing
  `userAuthAPI` export is a good spot. It reuses the same `api`, `adminApi`,
  and `userApi` axios instances already defined in that file (with their
  token-attach interceptors), so no new auth wiring is needed.
*/

// ── Library API (public/user) ───────────────────────────────────────
export const libraryAPI = {
  getCategories: () => api.get('/api/library/categories'),
  getBooks:      (params = {}) => api.get('/api/library/books', { params }),
  getBook:       (slug) => api.get(`/api/library/books/${slug}`),
  getPage:       (bookId, pageNumber, lang = 'en') =>
                   api.get(`/api/library/books/${bookId}/pages/${pageNumber}`, { params: { lang } }),

  // requires user auth — uses userApi (token auto-attached)
  updateProgress:   (data) => userApi.put('/api/library/progress', data),
  getContinueReading: () => userApi.get('/api/library/continue-reading'),

  addBookmark:    (data) => userApi.post('/api/library/bookmarks', data),
  getBookmarks:   (bookId) => userApi.get(`/api/library/bookmarks/${bookId}`),
  deleteBookmark: (id) => userApi.delete(`/api/library/bookmarks/${id}`),

  addHighlight:    (data) => userApi.post('/api/library/highlights', data),
  getHighlights:   (bookId) => userApi.get(`/api/library/highlights/${bookId}`),
  deleteHighlight: (id) => userApi.delete(`/api/library/highlights/${id}`),

  addFavorite:    (bookId) => userApi.post(`/api/library/favorites/${bookId}`),
  removeFavorite: (bookId) => userApi.delete(`/api/library/favorites/${bookId}`),
  getFavorites:   () => userApi.get('/api/library/favorites'),

  getPreferences:    () => userApi.get('/api/library/preferences'),
  updatePreferences: (data) => userApi.put('/api/library/preferences', data),
};

// ── Library Admin API ────────────────────────────────────────────────
export const libraryAdminAPI = {
  createBook: (formData) =>
    adminApi.post('/api/admin/library/books', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  listBooks:  () => adminApi.get('/api/admin/library/books'),
  updateBook: (id, data) => adminApi.patch(`/api/admin/library/books/${id}`, data),
  deleteBook: (id) => adminApi.delete(`/api/admin/library/books/${id}`),

  triggerTranslation: (bookId, languages) =>
    adminApi.post(`/api/admin/library/books/${bookId}/translate`, { languages }),
  getTranslationStatus: (bookId) =>
    adminApi.get(`/api/admin/library/books/${bookId}/translation-status`),
};