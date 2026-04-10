// frontend/src/utils/token.js
// Token storage en memoria - SIN localStorage para mayor seguridad
// Este archivo es independiente y NO tiene dependencias circulares

let accessTokenGlobal = null;
let accessTokenSubscribers = [];

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