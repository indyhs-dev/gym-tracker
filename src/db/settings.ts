import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { defaultSettings } from './defaults';
import type { Settings } from './types';

/** Stored settings with defaults filled in for anything added since they were saved. */
export function withDefaults(stored: Partial<Settings> | undefined): Settings {
  const defaults = defaultSettings();
  return {
    ...defaults,
    ...stored,
    id: 'app',
    rest: { ...defaults.rest, ...stored?.rest },
    block: { ...defaults.block, ...stored?.block },
  };
}

export async function getSettings(): Promise<Settings> {
  return withDefaults(await db.settings.get('app'));
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
