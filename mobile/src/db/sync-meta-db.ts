import { eq } from 'drizzle-orm';
import { db } from './index';
import { syncMeta } from './schema';
import type { User } from '@/types/auth.types';

const USER_CACHE_KEY = 'current_user';

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

export function getCachedUser(): User | null {
  const raw = getSyncMeta(USER_CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function setCachedUser(user: User): void {
  setSyncMeta(USER_CACHE_KEY, JSON.stringify(user));
}

export function clearCachedUser(): void {
  db.delete(syncMeta)
    .where(eq(syncMeta.key, USER_CACHE_KEY))
    .run();
}

export function getLastSyncAt(): number | null {
  const val = getSyncMeta('lastSyncAt');
  return val ? parseInt(val, 10) : null;
}

export function setLastSyncAt(ts: number): void {
  setSyncMeta('lastSyncAt', ts.toString());
}
