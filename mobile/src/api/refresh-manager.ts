import axios from 'axios';

import { API_BASE_URL, API_PREFIX, TIMEOUTS } from '@/constants/api.constants';
import { AUTH_API } from '@/constants/auth.constants';
import { tokenStorage } from '@/utils/token-storage';
import { clearSession } from '@/utils/session';
import type { RefreshRequest, RefreshResponse } from '@/types/auth.types';

let refreshPromise: Promise<boolean> | null = null;

async function executeRefresh(): Promise<boolean> {
  const refreshToken = await tokenStorage.getRefreshToken();

  if (!refreshToken) {
    await clearSession();
    return false;
  }

  try {
    const response = await axios.post<RefreshResponse>(
      `${API_BASE_URL}${API_PREFIX}${AUTH_API.REFRESH}`,
      { refresh_token: refreshToken } satisfies RefreshRequest,
      { timeout: TIMEOUTS.AUTH },
    );

    const { access_token, refresh_token: newRefreshToken } = response.data;

    await Promise.all([
      tokenStorage.setAccessToken(access_token),
      tokenStorage.setRefreshToken(newRefreshToken),
    ]);

    return true;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      await clearSession();
    }
    return false;
  }
}

export function waitForRefresh(): Promise<boolean> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = executeRefresh().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}
