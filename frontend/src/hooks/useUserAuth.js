import {
  useCallback,
  useState,
} from 'react';

import {
  userAuthAPI,
} from '../services/api';

import {
  friendlyError,
  UI_MESSAGES,
} from '../utils/uiMessages';

export function useUserAuth() {
  const [user, setUser] = useState(
    () => userAuthAPI.getUser()
  );

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  const isLoggedIn = Boolean(user);

  const isVerified =
    user?.is_verified ?? false;

  const signup = useCallback(
    async ({
      name,
      email,
      password,
      confirmPassword,
    }) => {
      setLoading(true);
      setError('');

      try {
        await userAuthAPI.signup({
          name,
          email,
          password,
          confirm_password:
            confirmPassword,
        });

        return {
          success: true,
        };
      } catch (requestError) {
        const message = friendlyError(
          requestError,
          "We couldn't create your account right now. Please review your details and try again."
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

  const login = useCallback(
    async (email, password) => {
      setLoading(true);
      setError('');

      try {
        const response =
          await userAuthAPI.login({
            email,
            password,
          });

        userAuthAPI.saveTokens(
          response.data
        );

        setUser(
          response.data.user
        );

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

  const logout = useCallback(() => {
    userAuthAPI.clearTokens();
    setUser(null);
  }, []);

  const updateProfile = useCallback(
    async (profileData) => {
      setLoading(true);
      setError('');

      try {
        const response =
          await userAuthAPI.updateProfile(
            profileData
          );

        const updatedUser =
          response.data.user;

        userAuthAPI.saveUser(
          updatedUser
        );

        setUser(updatedUser);

        return {
          success: true,
          user: updatedUser,
        };
      } catch (requestError) {
        const message = friendlyError(
          requestError,
          UI_MESSAGES.error.save
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

  const refreshUser =
    useCallback(async () => {
      try {
        const response =
          await userAuthAPI.me();

        userAuthAPI.saveUser(
          response.data
        );

        setUser(response.data);
      } catch {
        // Keep the current user state if
        // refreshing the profile is unavailable.
      }
    }, []);

  return {
    user,
    isLoggedIn,
    isVerified,
    loading,
    error,
    signup,
    login,
    logout,
    updateProfile,
    refreshUser,
  };
}