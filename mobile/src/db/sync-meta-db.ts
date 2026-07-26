import { eq } from 'drizzle-orm';
import { db } from './index';
import { syncMeta } from './schema';

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

export function getLastSyncAt(): number | null {
  const val = getSyncMeta('lastSyncAt');
  return val ? parseInt(val, 10) : null;
}

export function setLastSyncAt(ts: number): void {
  setSyncMeta('lastSyncAt', ts.toString());
}
