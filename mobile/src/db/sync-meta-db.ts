import { eq } from 'drizzle-orm';
import { db } from './index';
import { syncMeta } from './schema';
import storage from '@/utils/storage';
import type { User } from '@/types/auth.types';

// El usuario cacheado se guarda en SecureStore (no en SQLite en claro), igual
// que los tokens de sesión. `utils/storage` usa expo-secure-store en nativo y
// localStorage en web.
const USER_CACHE_KEY = 'cached_user';

export function getSyncMeta(key: string): string | null {
  const row = db
    .select()
    .from(syncMeta)
    .where(eq(syncMeta.key, key))
    .get();
  return row?.value ?? null;
}

export function setSyncMeta(key: string, value: string): void {
  db.insert(syncMeta)
    .values({ key, value })
    .onConflictDoUpdate({ target: syncMeta.key, set: { value } })
    .run();
}

export async function getCachedUser(): Promise<User | null> {
  try {
    const raw = await storage.getItem(USER_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export async function setCachedUser(user: User): Promise<void> {
  try {
    await storage.setItem(USER_CACHE_KEY, JSON.stringify(user));
  } catch {
    // No bloqueamos el flujo de auth si SecureStore falla.
  }
}

export async function clearCachedUser(): Promise<void> {
  try {
    await storage.removeItem(USER_CACHE_KEY);
  } catch {
    // Best-effort.
  }
}

export function getLastSyncAt(): number | null {
  const val = getSyncMeta('lastSyncAt');
  return val ? parseInt(val, 10) : null;
}

export function setLastSyncAt(ts: number): void {
  setSyncMeta('lastSyncAt', ts.toString());
}
