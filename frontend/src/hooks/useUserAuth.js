// hooks/useUserAuth.js
import { useState, useCallback } from 'react';
import { userAuthAPI } from '../services/api';

export function useUserAuth() {
  const [user, setUser]       = useState(() => userAuthAPI.getUser());
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const isLoggedIn = !!user;
  const isVerified = user?.is_verified ?? false;

  const signup = useCallback(async ({ name, email, password, confirmPassword }) => {
    setLoading(true); setError('');
    try {
      await userAuthAPI.signup({ name, email, password, confirm_password: confirmPassword });
      // ✅ Do NOT saveTokens or setUser here — user must verify email first
      return { success: true };
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Signup failed';
      setError(msg);
      return { success: false, error: msg };
    } finally { setLoading(false); }
  }, []);

  const login = useCallback(async (email, password) => {
    setLoading(true); setError('');
    try {
      const res = await userAuthAPI.login({ email, password });
      userAuthAPI.saveTokens(res.data);
      setUser(res.data.user);
      return { success: true };
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Login failed';
      setError(msg);
      return { success: false, error: msg };
    } finally { setLoading(false); }
  }, []);

  const logout = useCallback(() => {
    userAuthAPI.clearTokens();
    setUser(null);
  }, []);

  return { user, isLoggedIn, isVerified, loading, error, signup, login, logout };
}