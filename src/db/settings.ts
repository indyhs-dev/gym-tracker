import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { defaultSettings } from './defaults';
import type { Settings } from './types';

export async function getSettings(): Promise<Settings> {
  return (await db.settings.get('app')) ?? defaultSettings();
}

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const current = await getSettings();
    await db.settings.put({ ...current, ...patch, id: 'app' });
  });
}

/** Live settings; undefined while loading. */
export function useSettings(): Settings | undefined {
  return useLiveQuery(getSettings, []);
}
