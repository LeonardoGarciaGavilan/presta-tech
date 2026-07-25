import axios, { type AxiosRequestConfig } from 'axios';

import { AUTH_PUBLIC_ROUTES } from '@/constants/auth.constants';
import { tokenStorage } from '@/utils/token-storage';
import { handleApiError } from '@/utils/error-handler';
import { waitForRefresh } from '@/api/refresh-manager';
import { getNetworkStatus } from '@/hooks/use-network-status';
import { API_CONFIG } from './config';

const client = axios.create(API_CONFIG);

client.interceptors.request.use(
  async (config) => {
    if (__DEV__) {
      console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
    }

    const urlPath = config.url ?? '';
    const isPublic = AUTH_PUBLIC_ROUTES.some((route) => urlPath.endsWith(route));

    if (!isPublic) {
      const token = await tokenStorage.getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }

    if (config.data instanceof FormData) {
      config.headers.delete('Content-Type');
    }

    return config;
  },
  (error) => Promise.reject(error),
);

client.interceptors.response.use(
  (response) => {
    if (__DEV__) {
      console.log(`[API] ${response.status} ${response.config.url}`);
    }
    return response;
  },
  async (error) => {
    const network = getNetworkStatus();
    const apiError = handleApiError(error);

    if (!network.isOnline && apiError.code === 'NETWORK_ERROR') {
      (apiError as any).isOffline = true;
      (apiError as any).isQueued = false;
    }

    const originalRequest = error.config as
      | (AxiosRequestConfig & { _retry?: boolean })
      | undefined;

    if (
      apiError.statusCode === 401 &&
      originalRequest &&
      !originalRequest._retry
    ) {
      const urlPath = originalRequest.url ?? '';
      const isPublic = AUTH_PUBLIC_ROUTES.some((route) =>
        urlPath.endsWith(route),
      );

      if (!isPublic) {
        originalRequest._retry = true;

        const success = await waitForRefresh();

        if (success) {
          return client(originalRequest);
        }
      }
    }

    if (__DEV__) {
      console.warn(`[API] Error ${apiError.statusCode}: ${apiError.message}`);
    }
    return Promise.reject(apiError);
  },
);

export default client;
