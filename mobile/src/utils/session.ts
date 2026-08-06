import { tokenStorage } from '@/utils/token-storage';
import { useAuthStore } from '@/store/auth.store';
import { clearCachedUser } from '@/db/sync-meta-db';

export async function clearSession(): Promise<void> {
  try {
    await tokenStorage.clearTokens();
  } catch {
    // SecureStore error — non-fatal, continue clearing state
  }
  await clearCachedUser();
  useAuthStore.getState().clearUser();
}
