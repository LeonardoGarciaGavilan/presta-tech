import { tokenStorage } from '@/utils/token-storage';
import { useAuthStore } from '@/store/auth.store';

export async function clearSession(): Promise<void> {
  try {
    await tokenStorage.clearTokens();
  } catch {
    // SecureStore error — non-fatal, continue clearing state
  }
  useAuthStore.getState().clearUser();
}
