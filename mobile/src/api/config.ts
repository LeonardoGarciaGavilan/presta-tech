import type { AxiosRequestConfig } from 'axios';

import { API_BASE_URL, API_PREFIX, TIMEOUTS } from '@/constants/api.constants';

if (__DEV__) {
  console.log('API_BASE_URL:', API_BASE_URL);
  console.log('BASE_URL_FINAL:', `${API_BASE_URL}${API_PREFIX}`);
}

export const API_CONFIG: AxiosRequestConfig = {
  baseURL: `${API_BASE_URL}${API_PREFIX}`,
  timeout: TIMEOUTS.DEFAULT,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
};

export const ENV_FLAGS = {
  isDev: __DEV__,
  isProd: !__DEV__,
} as const;