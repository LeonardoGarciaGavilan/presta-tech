import { tokenStorage } from '@/utils/token-storage';
import { useAuthStore } from '@/store/auth.store';
import { purgeAllTables } from '@/db/purge';

export async function clearSession(): Promise<void> {
  try {
    await tokenStorage.clearTokens();
  } catch {
    // SecureStore error — non-fatal, continue clearing state
  }
  try {
    await purgeAllTables();
  } catch {
    // SQLite purge error — non-fatal, keep clearing in-memory state
  }
  useAuthStore.getState().clearUser();
}
