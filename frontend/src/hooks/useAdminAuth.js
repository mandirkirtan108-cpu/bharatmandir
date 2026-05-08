// hooks/useAdminAuth.js
// JWT-based admin authentication hook
// Replaces the old env-key based approach

import { useState, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const ACCESS_KEY  = 'bm_access_token';
const REFRESH_KEY = 'bm_refresh_token';
const ADMIN_KEY   = 'bm_admin_user';

export function useAdminAuth() {
  const [admin, setAdmin]       = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(ADMIN_KEY)); }
    catch { return null; }
  });
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const isLoggedIn = !!admin;
  const isSuperAdmin = admin?.role === 'super_admin';
  const isEditor     = admin?.role === 'super_admin' || admin?.role === 'editor';

  // ── Login ────────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Login failed');

      sessionStorage.setItem(ACCESS_KEY,  data.access_token);
      sessionStorage.setItem(REFRESH_KEY, data.refresh_token);
      sessionStorage.setItem(ADMIN_KEY,   JSON.stringify(data.admin));
      setAdmin(data.admin);
      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Logout ───────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      const token = sessionStorage.getItem(ACCESS_KEY);
      if (token) {
        await fetch(`${API_BASE}/api/admin/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch (_) { /* ignore */ }
    sessionStorage.removeItem(ACCESS_KEY);
    sessionStorage.removeItem(REFRESH_KEY);
    sessionStorage.removeItem(ADMIN_KEY);
    setAdmin(null);
  }, []);

  // ── Authenticated fetch helper ───────────────────────────────────
  const authFetch = useCallback(async (url, options = {}) => {
    let token = sessionStorage.getItem(ACCESS_KEY);

    const doFetch = (t) => fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
        Authorization: `Bearer ${t}`,
      },
    });

    let res = await doFetch(token);

    // Token expired? Try refresh
    if (res.status === 401) {
      const refreshToken = sessionStorage.getItem(REFRESH_KEY);
      if (refreshToken) {
        const rRes = await fetch(`${API_BASE}/api/admin/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (rRes.ok) {
          const rData = await rRes.json();
          token = rData.access_token;
          sessionStorage.setItem(ACCESS_KEY, token);
          res = await doFetch(token);
        } else {
          logout();
          throw new Error('Session expired. Please log in again.');
        }
      } else {
        logout();
        throw new Error('Session expired. Please log in again.');
      }
    }

    return res;
  }, [logout]);

  return { admin, isLoggedIn, isSuperAdmin, isEditor, loading, error, login, logout, authFetch };
}