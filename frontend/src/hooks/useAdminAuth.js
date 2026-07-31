import {
  useCallback,
  useState,
} from 'react';

import {
  friendlyError,
  UI_MESSAGES,
} from '../utils/uiMessages';

const API_BASE =
  import.meta.env.VITE_API_URL ||
  'http://localhost:8000';

const ACCESS_KEY =
  'bm_access_token';

const REFRESH_KEY =
  'bm_refresh_token';

const ADMIN_KEY =
  'bm_admin_user';

export function useAdminAuth() {
  const [admin, setAdmin] =
    useState(() => {
      try {
        return JSON.parse(
          sessionStorage.getItem(
            ADMIN_KEY
          )
        );
      } catch {
        return null;
      }
    });

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  const isLoggedIn =
    Boolean(admin);

  const isSuperAdmin =
    admin?.role === 'super_admin';

  const isEditor =
    admin?.role === 'super_admin' ||
    admin?.role === 'editor';

  const login = useCallback(
    async (email, password) => {
      setLoading(true);
      setError('');

      try {
        const response = await fetch(
          `${API_BASE}/api/admin/auth/login`,
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body: JSON.stringify({
              email,
              password,
            }),
          }
        );

        const data =
          await response.json();

        if (!response.ok) {
          throw Object.assign(
            new Error(
              data.detail ||
              UI_MESSAGES.error.auth
            ),
            {
              status: response.status,
            }
          );
        }

        sessionStorage.setItem(
          ACCESS_KEY,
          data.access_token
        );

        sessionStorage.setItem(
          REFRESH_KEY,
          data.refresh_token
        );

        sessionStorage.setItem(
          ADMIN_KEY,
          JSON.stringify(data.admin)
        );

        setAdmin(data.admin);

        return {
          success: true,
        };
      } catch (requestError) {
        const message = friendlyError(
          requestError,
          UI_MESSAGES.error.auth
        );

        setError(message);

        return {
          success: false,
          error: message,
        };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const logout =
    useCallback(async () => {
      try {
        const token =
          sessionStorage.getItem(
            ACCESS_KEY
          );

        if (token) {
          await fetch(
            `${API_BASE}/api/admin/auth/logout`,
            {
              method: 'POST',

              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );
        }
      } catch {
        // Always clear the local session,
        // even if the server is unavailable.
      }

      sessionStorage.removeItem(
        ACCESS_KEY
      );

      sessionStorage.removeItem(
        REFRESH_KEY
      );

      sessionStorage.removeItem(
        ADMIN_KEY
      );

      setAdmin(null);
      setError('');
    }, []);

  const authFetch = useCallback(
    async (url, options = {}) => {
      let token =
        sessionStorage.getItem(
          ACCESS_KEY
        );

      const doFetch =
        (accessToken) =>
          fetch(url, {
            ...options,

            headers: {
              'Content-Type':
                'application/json',

              ...options.headers,

              Authorization:
                `Bearer ${accessToken}`,
            },
          });

      let response =
        await doFetch(token);

      if (response.status === 401) {
        const refreshToken =
          sessionStorage.getItem(
            REFRESH_KEY
          );

        if (!refreshToken) {
          await logout();

          throw new Error(
            UI_MESSAGES.error.session
          );
        }

        const refreshResponse =
          await fetch(
            `${API_BASE}/api/admin/auth/refresh`,
            {
              method: 'POST',

              headers: {
                'Content-Type':
                  'application/json',
              },

              body: JSON.stringify({
                refresh_token:
                  refreshToken,
              }),
            }
          );

        if (!refreshResponse.ok) {
          await logout();

          throw new Error(
            UI_MESSAGES.error.session
          );
        }

        const refreshData =
          await refreshResponse.json();

        token =
          refreshData.access_token;

        sessionStorage.setItem(
          ACCESS_KEY,
          token
        );

        response =
          await doFetch(token);
      }

      return response;
    },
    [logout]
  );

  return {
    admin,
    isLoggedIn,
    isSuperAdmin,
    isEditor,
    loading,
    error,
    login,
    logout,
    authFetch,
  };
}