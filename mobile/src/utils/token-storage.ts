import storage from '@/utils/storage';
import { AUTH_STORAGE_KEYS } from '@/constants/auth.constants';

let memoryCache: Record<string, string | null> = {};

async function getToken(key: string): Promise<string | null> {
  if (key in memoryCache) {
    return memoryCache[key];
  }

  try {
    const token = await storage.getItem(key);
    memoryCache[key] = token;
    return token;
  } catch {
    return null;
  }
}

async function setToken(key: string, token: string): Promise<void> {
  memoryCache[key] = token;
  await storage.setItem(key, token);
}

async function removeToken(key: string): Promise<void> {
  delete memoryCache[key];
  await storage.removeItem(key);
}

export const tokenStorage = {
  getAccessToken: () => getToken(AUTH_STORAGE_KEYS.ACCESS_TOKEN),
  setAccessToken: (token: string) => setToken(AUTH_STORAGE_KEYS.ACCESS_TOKEN, token),
  removeAccessToken: () => removeToken(AUTH_STORAGE_KEYS.ACCESS_TOKEN),

  getRefreshToken: () => getToken(AUTH_STORAGE_KEYS.REFRESH_TOKEN),
  setRefreshToken: (token: string) => setToken(AUTH_STORAGE_KEYS.REFRESH_TOKEN, token),
  removeRefreshToken: () => removeToken(AUTH_STORAGE_KEYS.REFRESH_TOKEN),

  clearTokens: async () => {
    memoryCache = {};
    await Promise.all([
      storage.removeItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN),
      storage.removeItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN),
    ]);
  },
};
