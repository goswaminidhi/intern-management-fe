import axios from 'axios';

// =====================================================
// 1. API BASE URL
// =====================================================

export const getApiBaseUrl = () => {
  if (
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ) {
    return 'http://localhost:3000/api';
  }
  return (
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_URL ||
    'http://localhost:3000/api'
  );
};

const API_BASE_URL = getApiBaseUrl().replace(/\/+$/, '');

// =====================================================
// 2. CENTRALIZED AXIOS INSTANCE
// =====================================================

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 5000000,
});

// =====================================================
// 3. AUTHENTICATION STATE
// =====================================================

// Shares one refresh request between simultaneous API calls.
let refreshPromise = null;

// Prevents multiple unauthorized events and redirects.
let logoutInProgress = false;

// Id of the user logged in IN THIS TAB (used to pick the right refresh cookie).
const getStoredUserId = () => {
  try {
    const raw = sessionStorage.getItem('user');
    return raw ? JSON.parse(raw)?.id ?? null : null;
  } catch {
    return null;
  }
};

// =====================================================
// 4. AUTH ENDPOINT DETECTION
// =====================================================

const isAuthEndpoint = (url = '') => {
  const path = url.split('?')[0];

  return /\/users\/(login|refresh|logout)\/?$/.test(path);
};

// =====================================================
// 5. CLEAR AUTHENTICATION
// =====================================================

export function clearAuthAndRedirect() {
  if (logoutInProgress) return;

  logoutInProgress = true;

  // Remove client-side authentication information.
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');

  // Notify AuthContext and Socket.IO listeners.
  window.dispatchEvent(
    new CustomEvent('auth:unauthorized')
  );

  // Replace history entry to prevent returning to
  // the protected page using the browser Back button.
  if (window.location.pathname !== '/') {
    window.location.replace('/');
  }
}

// =====================================================
// 6. REFRESH ACCESS TOKEN
// =====================================================

export async function refreshAccessToken() {
  const userId = getStoredUserId();

  // Reuse an existing refresh request if one is running.
  if (!refreshPromise) {
    refreshPromise = axios
      .post(
        `${API_BASE_URL}/users/refresh`,
        userId ? { userId } : {},
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 1000000,
        }
      )
      .then((response) => {
        const newToken =
          response.data?.accessToken ||
          response.data?.token;

        if (!newToken) {
          throw new Error(
            'Refresh response did not include an access token.'
          );
        }

        // Store the new access token.
        sessionStorage.setItem('token', newToken);

        if (response.data?.user) {
          sessionStorage.setItem(
            'user',
            JSON.stringify(response.data.user)
          );
        }

        // Notify AuthContext and Socket.IO.
        window.dispatchEvent(
          new CustomEvent('auth:token-refreshed', {
            detail: {
              token: newToken,
              user: response.data?.user || null,
            },
          })
        );

        return newToken;
      })
      .finally(() => {
        // Allow future refresh attempts.
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

// =====================================================
// 7. REQUEST INTERCEPTOR
// =====================================================

apiClient.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('token');

    // Do not attach an old token to login/logout requests.
    if (!isAuthEndpoint(config.url || '') && token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// =====================================================
// 8. RESPONSE INTERCEPTOR
// =====================================================

apiClient.interceptors.response.use(
  (response) => {
    // A successful login starts a new authenticated session.
    if (isAuthEndpoint(response.config?.url || '') &&
      /\/users\/login\/?$/.test(
        (response.config?.url || '').split('?')[0]
      )) {
      logoutInProgress = false;
    }

    return response;
  },

  async (error) => {
    const status = error.response?.status;
    const responseData = error.response?.data;
    const originalRequest = error.config;

    // -------------------------------------------------
    // HANDLE 401 UNAUTHORIZED
    // -------------------------------------------------

    if (status === 401 && originalRequest) {
      const requestUrl = originalRequest.url || '';

      // Never attempt refresh for login, refresh or logout.
      if (isAuthEndpoint(requestUrl)) {
        return Promise.reject(error);
      }

      // These errors should not be recovered by refreshing.
      const isHardAccountRejection =
        responseData?.code === 'ACCOUNT_DEACTIVATED' ||
        responseData?.code === 'USER_NOT_FOUND';

      if (isHardAccountRejection) {
        clearAuthAndRedirect();
        return Promise.reject(error);
      }

      // If the request already failed after a refresh retry,
      // do not retry it again.
      if (originalRequest._retry) {
        clearAuthAndRedirect();
        return Promise.reject(error);
      }

      // -------------------------------------------------
      // AVOID UNNECESSARY REFRESH REQUESTS
      // -------------------------------------------------

      const currentToken = sessionStorage.getItem('token');

      const requestToken =
        originalRequest.headers?.Authorization;

      // Another request may already have refreshed the token.
      if (
        currentToken &&
        requestToken &&
        requestToken !== `Bearer ${currentToken}`
      ) {
        originalRequest.headers.Authorization =
          `Bearer ${currentToken}`;

        originalRequest._retry = true;

        return apiClient(originalRequest);
      }

      // Mark this request so it cannot enter a retry loop.
      originalRequest._retry = true;

      // -------------------------------------------------
      // ATTEMPT TOKEN REFRESH
      // -------------------------------------------------

      try {
        const newToken = await refreshAccessToken();

        // Update the failed request with the new token.
        originalRequest.headers =
          originalRequest.headers || {};

        originalRequest.headers.Authorization =
          `Bearer ${newToken}`;

        // Retry the original API request.
        return apiClient(originalRequest);

      } catch (refreshError) {
        // Refresh failed: session can no longer be recovered.
        clearAuthAndRedirect();

        return Promise.reject(refreshError);
      }
    }

    // -------------------------------------------------
    // HANDLE FIRST LOGIN PASSWORD CHANGE
    // -------------------------------------------------

    if (
      status === 403 &&
      responseData?.code ===
      'FIRST_LOGIN_PASSWORD_CHANGE_REQUIRED'
    ) {
      window.dispatchEvent(
        new CustomEvent('auth:first-login-required', {
          detail: responseData,
        })
      );
    }

    return Promise.reject(error);
  }
);

// =====================================================
// 9. ACCESS TOKEN HELPER
// =====================================================

export const getAccessToken = () => {
  return sessionStorage.getItem('token');
};

export const fetchHierarchy = async () => {
  const { data } = await apiClient.get('/users/hierarchy');
  return data;
};

export default apiClient;
