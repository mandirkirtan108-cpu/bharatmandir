import axios from 'axios';

export const VOLUNTEER_STORAGE_KEYS = {
  accessToken:
    'bm_volunteer_access_token',

  refreshToken:
    'bm_volunteer_refresh_token',

  volunteer:
    'bm_volunteer_user',
};

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  'http://localhost:8000';

const volunteerClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,

  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,

  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

let refreshRequest = null;

function isBrowser() {
  return typeof window !== 'undefined';
}

export function getVolunteerAccessToken() {
  if (!isBrowser()) {
    return null;
  }

  return localStorage.getItem(
    VOLUNTEER_STORAGE_KEYS.accessToken
  );
}

export function getVolunteerRefreshToken() {
  if (!isBrowser()) {
    return null;
  }

  return localStorage.getItem(
    VOLUNTEER_STORAGE_KEYS.refreshToken
  );
}

export function getStoredVolunteer() {
  if (!isBrowser()) {
    return null;
  }

  const storedVolunteer =
    localStorage.getItem(
      VOLUNTEER_STORAGE_KEYS.volunteer
    );

  if (!storedVolunteer) {
    return null;
  }

  try {
    return JSON.parse(storedVolunteer);
  } catch {
    localStorage.removeItem(
      VOLUNTEER_STORAGE_KEYS.volunteer
    );

    return null;
  }
}

export function saveVolunteerSession({
  accessToken,
  refreshToken,
  volunteer,
}) {
  if (!isBrowser()) {
    return;
  }

  if (accessToken) {
    localStorage.setItem(
      VOLUNTEER_STORAGE_KEYS.accessToken,
      accessToken
    );
  }

  if (refreshToken) {
    localStorage.setItem(
      VOLUNTEER_STORAGE_KEYS.refreshToken,
      refreshToken
    );
  }

  if (volunteer) {
    localStorage.setItem(
      VOLUNTEER_STORAGE_KEYS.volunteer,
      JSON.stringify(volunteer)
    );
  }
}

export function clearVolunteerSession() {
  if (!isBrowser()) {
    return;
  }

  Object.values(
    VOLUNTEER_STORAGE_KEYS
  ).forEach((storageKey) => {
    localStorage.removeItem(storageKey);
  });
}

function notifySessionExpired() {
  if (!isBrowser()) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(
      'bharatmandir-volunteer-session-expired'
    )
  );
}

volunteerClient.interceptors.request.use(
  (config) => {
    const accessToken =
      getVolunteerAccessToken();

    if (accessToken) {
      config.headers.Authorization =
        `Bearer ${accessToken}`;
    }

    return config;
  },

  (requestError) =>
    Promise.reject(requestError)
);

volunteerClient.interceptors.response.use(
  (response) => response,

  async (requestError) => {
    const originalRequest =
      requestError.config;

    const status =
      requestError.response?.status;

    const requestUrl =
      originalRequest?.url || '';

    const isAuthRequest =
      requestUrl.includes(
        '/api/volunteer/auth/login'
      ) ||
      requestUrl.includes(
        '/api/volunteer/auth/signup'
      ) ||
      requestUrl.includes(
        '/api/volunteer/auth/refresh'
      );

    if (
      status !== 401 ||
      originalRequest?._volunteerRetry ||
      isAuthRequest
    ) {
      return Promise.reject(requestError);
    }

    const refreshToken =
      getVolunteerRefreshToken();

    if (!refreshToken) {
      clearVolunteerSession();
      notifySessionExpired();

      return Promise.reject(requestError);
    }

    originalRequest._volunteerRetry = true;

    try {
      if (!refreshRequest) {
        refreshRequest = refreshClient
          .post(
            '/api/volunteer/auth/refresh',
            {
              refresh_token: refreshToken,
            }
          )
          .then((response) => {
            const newAccessToken =
              response.data?.access_token;

            if (!newAccessToken) {
              throw new Error(
                'A new access token was not returned.'
              );
            }

            saveVolunteerSession({
              accessToken: newAccessToken,
            });

            return newAccessToken;
          })
          .finally(() => {
            refreshRequest = null;
          });
      }

      const newAccessToken =
        await refreshRequest;

      originalRequest.headers =
        originalRequest.headers || {};

      originalRequest.headers.Authorization =
        `Bearer ${newAccessToken}`;

      return volunteerClient(
        originalRequest
      );
    } catch (refreshError) {
      clearVolunteerSession();
      notifySessionExpired();

      return Promise.reject(refreshError);
    }
  }
);

export const volunteerApi = {
  signup(signupData) {
    return volunteerClient.post(
      '/api/volunteer/auth/signup',
      signupData
    );
  },

  login(loginData) {
    return volunteerClient.post(
      '/api/volunteer/auth/login',
      loginData
    );
  },

  logout() {
    return volunteerClient.post(
      '/api/volunteer/auth/logout'
    );
  },

  refresh(refreshToken) {
    return refreshClient.post(
      '/api/volunteer/auth/refresh',
      {
        refresh_token: refreshToken,
      }
    );
  },

  me() {
    return volunteerClient.get(
      '/api/volunteer/auth/me'
    );
  },

  updateProfile(profileData) {
    return volunteerClient.patch(
      '/api/volunteer/auth/profile',
      profileData
    );
  },

  listSubmissions() {
    return volunteerClient.get(
      '/api/volunteer/submissions'
    );
  },

  getSubmission(submissionId) {
    return volunteerClient.get(
      `/api/volunteer/submissions/${submissionId}`
    );
  },

  createSubmission(submissionData) {
    return volunteerClient.post(
      '/api/volunteer/submissions',
      submissionData
    );
  },

  updateSubmission(
    submissionId,
    submissionData
  ) {
    return volunteerClient.patch(
      `/api/volunteer/submissions/${submissionId}`,
      submissionData
    );
  },

  deleteSubmission(submissionId) {
    return volunteerClient.delete(
      `/api/volunteer/submissions/${submissionId}`
    );
  },

  submitSubmission(submissionId) {
    return volunteerClient.post(
      `/api/volunteer/submissions/${submissionId}/submit`
    );
  },

  autofillFromMapsLink(url) {
    return volunteerClient.get('/api/volunteer/automation/maps-link', {
      params: { url },
    });
  },

  reverseGeocode(latitude, longitude) {
    return volunteerClient.get('/api/volunteer/automation/reverse-geocode', {
      params: { latitude, longitude },
    });
  },

  searchPlaces(q) {
    return volunteerClient.get('/api/volunteer/automation/place-search', { params: { q } });
  },

  findDuplicates(params) {
    return volunteerClient.get('/api/volunteer/automation/duplicates', { params });
  },

  getPlaceDetails(placeId) {
    return volunteerClient.get('/api/volunteer/automation/place-details', {
      params: { place_id: placeId },
    });
  },

  getPlacePhoto(photoReference) {
    return volunteerClient.get('/api/volunteer/automation/place-photo', {
      params: { reference: photoReference }, responseType: 'blob',
    });
  },

  extractSignboard(image) {
    const body = new FormData();
    body.append('image', image);
    return volunteerClient.post('/api/volunteer/automation/ocr', body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  getTempleSuggestions(data) {
    return volunteerClient.post('/api/volunteer/automation/suggestions', data);
  },

  translateToHindi(text) {
    return volunteerClient.post('/api/volunteer/automation/translate-to-hindi', {
      text,
    });
  },

  listAdminVolunteers(status) {
    const query = status ? `?approval_status=${status}` : '';
    return volunteerClient.get(`/api/volunteer/auth/admin/volunteers${query}`);
  },
};

export default volunteerClient;
