import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/db';
import { DEFAULT_REST } from '../src/db/defaults';
import { getSettings, updateSettings } from '../src/db/settings';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('settings', () => {
  it('are created with the default rest guidance on first open', async () => {
    const stored = await db.settings.get('app');
    expect(stored?.rest).toEqual(DEFAULT_REST);
    expect(stored?.lastBackupAt).toBeNull();
  });

  it('update merges a patch', async () => {
    await updateSettings({ rest: { ...DEFAULT_REST, compound: '4–5 min' } });
    const s = await getSettings();
    expect(s.rest.compound).toBe('4–5 min');
    expect(s.rest.core).toBe('60–90 s');
    expect(s.seededAt).toBeNull();
  });
});
