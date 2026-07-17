import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  clearVolunteerSession,
  getStoredVolunteer,
  getVolunteerAccessToken,
  saveVolunteerSession,
  volunteerApi,
} from '../services/volunteerApi';

export function useVolunteerAuth() {
  const [volunteer, setVolunteer] = useState(
    () => getStoredVolunteer()
  );

  const [loading, setLoading] = useState(
    () =>
      Boolean(getVolunteerAccessToken()) &&
      !getStoredVolunteer()
  );

  const [error, setError] = useState('');

  const updateVolunteerState = useCallback(
    (volunteerData) => {
      setVolunteer(volunteerData || null);

      window.dispatchEvent(
        new CustomEvent(
          'bharatmandir-volunteer-auth-change',
          {
            detail: {
              volunteer: volunteerData || null,
            },
          }
        )
      );
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      if (getVolunteerAccessToken()) {
        await volunteerApi.logout();
      }
    } catch {
      // Backend logout fail hone par bhi local
      // session clear honi chahiye.
    } finally {
      clearVolunteerSession();
      setVolunteer(null);
      setError('');

      window.dispatchEvent(
        new CustomEvent(
          'bharatmandir-volunteer-auth-change',
          {
            detail: {
              volunteer: null,
            },
          }
        )
      );
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const accessToken =
      getVolunteerAccessToken();

    if (!accessToken) {
      clearVolunteerSession();
      setVolunteer(null);
      setLoading(false);
      return null;
    }

    setLoading(true);
    setError('');

    try {
      const response =
        await volunteerApi.me();

      const volunteerData = response.data;

      saveVolunteerSession({
        volunteer: volunteerData,
      });

      updateVolunteerState(volunteerData);

      return volunteerData;
    } catch (requestError) {
      clearVolunteerSession();
      setVolunteer(null);

      setError(
        requestError.response?.data?.detail ||
          'Volunteer session expire ho gayi. Please dobara sign in karein.'
      );

      return null;
    } finally {
      setLoading(false);
    }
  }, [updateVolunteerState]);

  const login = useCallback(
    async (email, password) => {
      setLoading(true);
      setError('');

      try {
        const response =
          await volunteerApi.login({
            email: email.trim().toLowerCase(),
            password,
          });

        const sessionData = response.data;

        if (
          !sessionData?.access_token ||
          !sessionData?.volunteer
        ) {
          throw new Error(
            'Login response incomplete hai.'
          );
        }

        saveVolunteerSession({
          accessToken:
            sessionData.access_token,

          refreshToken:
            sessionData.refresh_token,

          volunteer:
            sessionData.volunteer,
        });

        updateVolunteerState(
          sessionData.volunteer
        );

        return true;
      } catch (requestError) {
        clearVolunteerSession();
        setVolunteer(null);

        setError(
          requestError.response?.data?.detail ||
            requestError.message ||
            'Volunteer login nahi ho paya.'
        );

        return false;
      } finally {
        setLoading(false);
      }
    },
    [updateVolunteerState]
  );

  const signup = useCallback(
    async (signupData) => {
      setLoading(true);
      setError('');

      try {
        const response =
          await volunteerApi.signup(
            signupData
          );

        return {
          success: true,
          data: response.data,
          error: '',
        };
      } catch (requestError) {
        const signupError =
          requestError.response?.data?.detail ||
          requestError.message ||
          'Volunteer account create nahi ho paya.';

        setError(signupError);

        return {
          success: false,
          data: null,
          error: signupError,
        };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const updateProfile = useCallback(
    async (profileData) => {
      setLoading(true);
      setError('');

      try {
        const response =
          await volunteerApi.updateProfile(
            profileData
          );

        const updatedVolunteer =
          response.data;

        saveVolunteerSession({
          volunteer: updatedVolunteer,
        });

        updateVolunteerState(
          updatedVolunteer
        );

        return {
          success: true,
          data: updatedVolunteer,
          error: '',
        };
      } catch (requestError) {
        const profileError =
          requestError.response?.data?.detail ||
          requestError.message ||
          'Volunteer profile update nahi ho paayi.';

        setError(profileError);

        return {
          success: false,
          data: null,
          error: profileError,
        };
      } finally {
        setLoading(false);
      }
    },
    [updateVolunteerState]
  );

  const clearError = useCallback(() => {
    setError('');
  }, []);

  useEffect(() => {
    const handleAuthChange = (event) => {
      setVolunteer(
        event.detail?.volunteer || null
      );
    };

    const handleSessionExpired = () => {
      clearVolunteerSession();
      setVolunteer(null);
      setLoading(false);

      setError(
        'Volunteer session expire ho gayi. Please dobara sign in karein.'
      );
    };

    window.addEventListener(
      'bharatmandir-volunteer-auth-change',
      handleAuthChange
    );

    window.addEventListener(
      'bharatmandir-volunteer-session-expired',
      handleSessionExpired
    );

    return () => {
      window.removeEventListener(
        'bharatmandir-volunteer-auth-change',
        handleAuthChange
      );

      window.removeEventListener(
        'bharatmandir-volunteer-session-expired',
        handleSessionExpired
      );
    };
  }, []);

  useEffect(() => {
    const accessToken =
      getVolunteerAccessToken();

    if (!accessToken) {
      setLoading(false);
      return;
    }

    refreshProfile();
  }, [refreshProfile]);

  return {
    volunteer,

    isLoggedIn: Boolean(
      volunteer &&
        getVolunteerAccessToken()
    ),

    loading,
    error,

    login,
    signup,
    logout,
    refresh: refreshProfile,
    updateProfile,
    clearError,
  };
}

export default useVolunteerAuth;