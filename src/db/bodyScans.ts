import { useLiveQuery } from 'dexie-react-hooks';
import { newId } from '../lib/ids';
import { db } from './db';
import type { BodyScan } from './types';

export type ScanInput = Omit<BodyScan, 'id' | 'createdAt' | 'updatedAt'>;

/** All scans, newest first. */
export async function allScans(): Promise<BodyScan[]> {
  return (await db.bodyScans.orderBy('date').toArray()).reverse();
}

/** Live list of scans, newest first; undefined while loading. */
export function useScans(): BodyScan[] | undefined {
  return useLiveQuery(allScans, []);
}

/** Another scan on the same date (not `exceptId`), if there is one. */
export async function scanOnDate(date: string, exceptId?: string): Promise<BodyScan | undefined> {
  return (await db.bodyScans.where('date').equals(date).toArray()).find((s) => s.id !== exceptId);
}

/**
 * Adds a scan, or updates `id` if given. `replaceId` is a scan on the same date
 * the user chose to replace; it's deleted in the same transaction.
 */
export async function saveScan(input: ScanInput, id?: string, replaceId?: string, now = Date.now()): Promise<BodyScan> {
  return db.transaction('rw', db.bodyScans, async () => {
    const existing = id ? await db.bodyScans.get(id) : undefined;
    const scan: BodyScan = {
      ...input,
      id: existing?.id ?? newId(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    if (replaceId && replaceId !== scan.id) await db.bodyScans.delete(replaceId);
    await db.bodyScans.put(scan);
    return scan;
  });
}

export async function deleteScan(id: string): Promise<void> {
  await db.bodyScans.delete(id);
}
