export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
if (__DEV__) {
  console.log('EXPO_PUBLIC_API_URL:', process.env.EXPO_PUBLIC_API_URL);
  console.log('API_BASE_URL:', API_BASE_URL);
}
export const API_PREFIX = '/api/v1' as const;

export const TIMEOUTS = {
  DEFAULT: 30_000,
  UPLOAD: 120_000,
  AUTH: 10_000,
} as const;
