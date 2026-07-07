export const AUTH_STORAGE_KEYS = {
  ACCESS_TOKEN: 'sas_prestamos_access_token',
  REFRESH_TOKEN: 'sas_prestamos_refresh_token',
} as const;

export const AUTH_EXPIRY = {
  ACCESS_TOKEN_MS: 60 * 60 * 1000,
  REFRESH_TOKEN_MS: 7 * 24 * 60 * 60 * 1000,
  REFRESH_THRESHOLD_MS: 60 * 1000,
} as const;

export const AUTH_API = {
  LOGIN: '/auth/login',
  REFRESH: '/auth/refresh',
  LOGOUT: '/auth/logout',
  LOGOUT_ALL: '/auth/logout-all',
  ME: '/auth/me',
} as const;

export const AUTH_API_CHANGE_PASSWORD = '/usuarios/cambiar-password';

export const AUTH_PUBLIC_ROUTES = [
  AUTH_API.LOGIN,
  AUTH_API.REFRESH,
  AUTH_API.LOGOUT,
] as const;
