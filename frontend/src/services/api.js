import axios from 'axios';
import { getAccessToken, subscribeToAccessToken, setAccessTokenGlobal } from '../utils/token';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 10000,
});

const AUTH_PUBLIC_ROUTES = [
  '/auth/login',
  '/auth/refresh',
  '/auth/logout',
  '/auth/logout-all',
];

// ═══════════════════════════════════════════════════════════════════════════
// UTILIDADES JWT
// ═══════════════════════════════════════════════════════════════════════════

function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

function isTokenExpiringSoon(token) {
  if (!token) return true;
  
  const payload = parseJwt(token);
  if (!payload || !payload.exp) return true;
  
  const now = Math.floor(Date.now() / 1000);
  const bufferSeconds = 30;
  
  return payload.exp <= (now + bufferSeconds);
}

function getToken() {
  return getAccessToken();
}

function clearSession() {
  localStorage.removeItem("user");
  setAccessTokenGlobal(null);
  window.location.href = '/';
}

// ═══════════════════════════════════════════════════════════════════════════
// REFRESH CENTRALIZADO CON PROMETE COMPARTIDO
// ═══════════════════════════════════════════════════════════════════════════

let refreshPromise = null;

async function getValidToken() {
  const currentToken = getToken();

  if (currentToken && !isTokenExpiringSoon(currentToken)) {
    return currentToken;
  }

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const res = await api.post("/auth/refresh");
      const newToken = res.data?.access_token;

      if (!newToken) {
        throw new Error("No access token returned");
      }

      setAccessTokenGlobal(newToken);
      return newToken;
    } catch (error) {
      if (error.response?.status === 401) {
        clearSession();
      }
      throw error;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// ═══════════════════════════════════════════════════════════════════════════
// REQUEST INTERCEPTOR
// ═══════════════════════════════════════════════════════════════════════════

api.interceptors.request.use(
  async (config) => {
    const isAuthRoute = AUTH_PUBLIC_ROUTES.some(route => 
      config.url?.includes(route)
    );
    if (isAuthRoute) {
      return config;
    }

    const token = await getValidToken();
    config.headers.Authorization = `Bearer ${token}`;
    
    return config;
  },
  (error) => Promise.reject(error)
);

// ═══════════════════════════════════════════════════════════════════════════
// RESPONSE INTERCEPTOR (401 FALLBACK)
// ═══════════════════════════════════════════════════════════════════════════

api.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;

    const isAuthRoute = AUTH_PUBLIC_ROUTES.some(route => 
      originalRequest?.url?.includes(route)
    );
    if (isAuthRoute) {
      return Promise.reject(error);
    }

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const newToken = await getValidToken();
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
  }
);

export default api;
