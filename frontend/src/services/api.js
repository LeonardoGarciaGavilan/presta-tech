import axios from 'axios';
import { getAccessToken, setAccessTokenGlobal } from '../utils/token';

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
  const bufferSeconds = 60;

  return payload.exp <= (now + bufferSeconds);
}

function getToken() {
  return getAccessToken();
}

// FIX: clearSession NO se llama desde getValidToken.
// Solo se invoca desde el interceptor de response, cuando una petición
// real (no el refresh interno) recibe un 401 definitivo del servidor.
// Esto evita que errores de red temporales o timeouts destruyan la sesión.
function clearSession() {
  localStorage.removeItem("user");
  setAccessTokenGlobal(null);
  window.location.href = '/';
}

// ═══════════════════════════════════════════════════════════════════════════
// REFRESH CENTRALIZADO CON PROMESA COMPARTIDA
// ═══════════════════════════════════════════════════════════════════════════

let refreshPromise = null;

// getValidToken SOLO renueva el token. No toma decisiones sobre la sesión.
// Si el refresh falla, lanza el error hacia arriba y deja que el llamador decida.
async function getValidToken() {
  const currentToken = getToken();

  if (currentToken && !isTokenExpiringSoon(currentToken)) {
    return currentToken;
  }

  // Reusar la promesa en vuelo si ya hay un refresh en curso
  // (evita múltiples llamadas simultáneas a /auth/refresh)
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

          const res = await api.post('/auth/refresh');
          const newToken = res.data?.access_token;

          if (!newToken) {
            throw new Error('No access token returned');
          }

          setAccessTokenGlobal(newToken);
          return newToken;

        } catch (error) {
          const isLastAttempt = attempt === MAX_REFRESH_RETRIES;

          // Solo reintentar en errores de red o 5xx (problemas del servidor).
          // Un 401 significa que el refresh token es inválido/expirado — no reintentar.
          const isRetryable = !error.response || error.response.status >= 500;

          if (isLastAttempt || !isRetryable) {
            // FIX CLAVE: lanzar el error sin llamar clearSession() aquí.
            // clearSession destruiría la sesión incluso en fallos de red temporales
            // durante la carga inicial, tabs en segundo plano, etc.
            // El interceptor de response es el único punto donde se decide
            // si la sesión debe cerrarse.
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

// ═══════════════════════════════════════════════════════════════════════════
// REQUEST INTERCEPTOR
// ═══════════════════════════════════════════════════════════════════════════

api.interceptors.request.use(
  async (config) => {
    const isAuthRoute = AUTH_PUBLIC_ROUTES.some(route =>
      config.url?.includes(route)
    );

    // Rutas públicas de auth van sin token
    if (isAuthRoute) {
      return config;
    }

    try {
      const token = await getValidToken();
      config.headers.Authorization = `Bearer ${token}`;
    } catch {
      // Si getValidToken falla en el interceptor de request (ej: no hay cookie,
      // error de red en el refresh), dejamos pasar la petición sin token.
      // El servidor responderá 401 y el interceptor de response lo manejará.
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ═══════════════════════════════════════════════════════════════════════════
// RESPONSE INTERCEPTOR — único punto donde se decide cerrar sesión
// ═══════════════════════════════════════════════════════════════════════════

api.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;

    // Rutas de auth no pasan por el retry — evita bucles infinitos
    const isAuthRoute = AUTH_PUBLIC_ROUTES.some(route =>
      originalRequest?.url?.includes(route)
    );
    if (isAuthRoute) {
      return Promise.reject(error);
    }

    // Solo actuar en 401 y solo una vez por petición (_retry flag)
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      // Intentar renovar el token y reintentar la petición original
      const newToken = await getValidToken();
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return api(originalRequest);

    } catch (refreshError) {
      // FIX: clearSession SOLO aquí, cuando:
      //   1. Una petición real (no el refresh) devolvió 401
      //   2. El intento de renovar el token también falló
      //   3. El fallo del refresh fue un 401 (cookie inválida/expirada),
      //      no un error de red o timeout
      if (refreshError.response?.status === 401) {
        clearSession();
      }

      return Promise.reject(refreshError);
    }
  }
);

export default api;