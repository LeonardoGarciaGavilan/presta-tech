import axios from 'axios';
import { getAccessToken, setAccessTokenGlobal, getRefreshToken, setRefreshToken, clearRefreshToken } from '../utils/token';

const API_URL = import.meta.env.VITE_API_URL || 'https://presta-tech-production.up.railway.app';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 90000,
});

const AUTH_PUBLIC_ROUTES = [
  '/auth/login',
  '/auth/refresh',
  '/auth/logout',
  '/auth/logout-all',
];

const MAX_REFRESH_RETRIES = 3;
const REFRESH_RETRY_DELAYS = [1000, 3000, 7000];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
  return payload.exp <= (now + 60);
}

export function clearSession() {
  localStorage.removeItem('user');
  setAccessTokenGlobal(null);
  clearRefreshToken();
  window.location.href = '/';
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNCIÓN PURA DE REFRESH — llama al backend directamente sin pasar
// por los interceptores para evitar recursión infinita
// ═══════════════════════════════════════════════════════════════════════════

let refreshPromise = null;

async function doRefresh() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw Object.assign(new Error('No refresh token'), { response: { status: 401 } });
  }

  // Usar fetch nativo en lugar de api (axios) para evitar pasar por los interceptores
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'x-refresh-token': refreshToken,
    },
  });

  if (!res.ok) {
    const err = new Error('Refresh failed');
    // @ts-ignore
    err.response = { status: res.status };
    throw err;
  }

  const data = await res.json();
  return data;
}

async function getValidToken() {
  const currentToken = getAccessToken();

  if (currentToken && !isTokenExpiringSoon(currentToken)) {
    return currentToken;
  }

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      for (let attempt = 0; attempt <= MAX_REFRESH_RETRIES; attempt++) {
        try {
          if (attempt > 0) {
            await sleep(REFRESH_RETRY_DELAYS[attempt - 1]);
          }

          const data = await doRefresh();

          const newAccessToken = data?.access_token;
          const newRefreshToken = data?.refresh_token;

          if (!newAccessToken) {
            throw new Error('No access token returned');
          }

          setAccessTokenGlobal(newAccessToken);
          if (newRefreshToken) {
            setRefreshToken(newRefreshToken);
          }

          return newAccessToken;

        } catch (error) {
          const isLastAttempt = attempt === MAX_REFRESH_RETRIES;
          const isRetryable = !error.response || error.response.status >= 500;

          if (isLastAttempt || !isRetryable) {
            throw error;
          }
        }
      }
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// Exportar para que AuthContext pueda usarla directamente
export { getValidToken };

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

    try {
      const token = await getValidToken();
      config.headers.Authorization = `Bearer ${token}`;
    } catch {
      // Si falla el refresh, dejar pasar sin token — el servidor responderá 401
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ═══════════════════════════════════════════════════════════════════════════
// RESPONSE INTERCEPTOR
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
      if (refreshError.response?.status === 401) {
        clearSession();
      }
      return Promise.reject(refreshError);
    }
  }
);

export default api;