import axios from 'axios';
import { APP_CONFIG } from '@/constants/config';
import { storage, STORAGE_KEYS } from '@/utils/storage';

const api = axios.create({
  baseURL: APP_CONFIG.apiBaseUrl,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Reads a cookie by name via document.cookie (no cookie-reading helper existed elsewhere
// in the codebase). Used below to echo the double-submit CSRF cookie back as a header.
function getCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

api.interceptors.request.use((config) => {
  const token = storage.get(STORAGE_KEYS.ACCESS_TOKEN);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Double-submit-cookie CSRF protection (Task #41): the backend's csrf.middleware.js
  // requires this header to match the non-httpOnly `csrf_token` cookie for state-changing
  // requests that are authenticated via cookie rather than Bearer header. Harmless to send
  // even when Bearer auth is used (the backend exempts Bearer requests from the check).
  const csrfToken = getCookie('csrf_token');
  if (csrfToken) {
    config.headers['X-CSRF-Token'] = csrfToken;
  }

  return config;
});

let isRefreshing = false;
let pendingQueue = [];

const flushQueue = (error, token = null) => {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  pendingQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const code = error.response?.data?.code;

    if (
      status === 401 &&
      code === 'TOKEN_EXPIRED' &&
      !original._retry &&
      !original.url?.includes('/auth/login') &&
      !original.url?.includes('/auth/refresh')
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = storage.get(STORAGE_KEYS.REFRESH_TOKEN);
        const csrfToken = getCookie('csrf_token');
        const { data } = await axios.post(
          `${APP_CONFIG.apiBaseUrl}/auth/refresh`,
          { refreshToken },
          {
            withCredentials: true,
            headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : undefined,
          }
        );

        const nextAccess = data?.data?.accessToken;
        const nextRefresh = data?.data?.refreshToken;

        if (nextAccess) storage.set(STORAGE_KEYS.ACCESS_TOKEN, nextAccess);
        if (nextRefresh) storage.set(STORAGE_KEYS.REFRESH_TOKEN, nextRefresh);

        flushQueue(null, nextAccess);
        original.headers.Authorization = `Bearer ${nextAccess}`;
        return api(original);
      } catch (refreshError) {
        flushQueue(refreshError, null);
        storage.clearAuth();
        if (window.location.pathname !== '/login') {
          window.location.assign('/login');
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
