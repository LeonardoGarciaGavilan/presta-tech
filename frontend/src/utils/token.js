// frontend/src/utils/token.js
// Access token: en memoria (más seguro, no persiste entre recargas)
// Refresh token: en localStorage (necesario porque Railway elimina Set-Cookie cross-origin)

let accessTokenGlobal = null;
let accessTokenSubscribers = [];

// ─── ACCESS TOKEN (memoria) ───────────────────────────────────────────────
export const getAccessToken = () => accessTokenGlobal;

export const setAccessTokenGlobal = (token) => {
  accessTokenGlobal = token;
  accessTokenSubscribers.forEach(cb => cb(token));
};

export const subscribeToAccessToken = (callback) => {
  accessTokenSubscribers.push(callback);
  return () => {
    accessTokenSubscribers = accessTokenSubscribers.filter(cb => cb !== callback);
  };
};

// ─── REFRESH TOKEN (localStorage) ────────────────────────────────────────
const REFRESH_TOKEN_KEY = 'rt';

export const getRefreshToken = () => {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setRefreshToken = (token) => {
  try {
    if (token) {
      localStorage.setItem(REFRESH_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  } catch {}
};

export const clearRefreshToken = () => {
  try {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {}
};