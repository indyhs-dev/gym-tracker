import { beforeEach, describe, expect, it } from 'vitest';
import { makeBackup, restoreBackup } from '../src/db/backup';
import { db } from '../src/db/db';
import { getSettings, updateSettings } from '../src/db/settings';
import { blockStatus } from '../src/lib/block';

const at = (y: number, mo: number, d: number, h = 12) => new Date(y, mo - 1, d, h).getTime();
const block = (startDate: string | null, weekOffAfter = 12) => ({ startDate, weekOffAfter });

describe('blockStatus', () => {
  it('counts weeks from the start date', () => {
    expect(blockStatus(block(null), at(2026, 10, 12))).toBeNull();
    expect(blockStatus(block('2026-10-12'), at(2026, 10, 12, 0))).toMatchObject({ week: 1, breakIn: true });
    expect(blockStatus(block('2026-10-12'), at(2026, 10, 18, 23))).toMatchObject({ week: 1 });
    expect(blockStatus(block('2026-10-12'), at(2026, 10, 19))).toMatchObject({ week: 2, breakIn: true });
    expect(blockStatus(block('2026-10-12'), at(2026, 10, 26))).toMatchObject({ week: 3, breakIn: false });
  });

  it('is DST-proof (UK clocks change 25 Oct, Australian 4 Oct)', () => {
    expect(blockStatus(block('2026-10-19'), at(2026, 10, 26, 0))).toMatchObject({ week: 2 });
    expect(blockStatus(block('2026-09-28'), at(2026, 10, 5, 0))).toMatchObject({ week: 2 });
  });

  it('reminds once past the chosen number of weeks', () => {
    const start = '2026-01-05';
    expect(blockStatus(block(start, 12), at(2026, 3, 29))).toMatchObject({ week: 12, weekOffDue: false });
    expect(blockStatus(block(start, 12), at(2026, 3, 30))).toMatchObject({ week: 13, weekOffDue: true });
    expect(blockStatus(block(start, 16), at(2026, 3, 30))).toMatchObject({ weekOffDue: false });
  });

  it('a future start date counts down', () => {
    expect(blockStatus(block('2026-10-15'), at(2026, 10, 12))).toEqual({ week: 0, breakIn: false, weekOffDue: false, startsIn: 3 });
  });
});

describe('block settings', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('defaults to off with a 12-week reminder, also for settings saved before it existed', async () => {
    expect((await getSettings()).block).toEqual({ startDate: null, weekOffAfter: 12 });
    const { block: _omit, ...old } = await getSettings();
    await db.settings.put(old as never);
    expect((await getSettings()).block).toEqual({ startDate: null, weekOffAfter: 12 });
  });

  it('survives a backup made before it existed, and round-trips when set', async () => {
    await updateSettings({ block: { startDate: '2026-10-12', weekOffAfter: 14 } });
    const backup = makeBackup({ exercises: [], templates: [], sessions: [], settings: [await getSettings()] });
    await db.delete();
    await db.open();
    await restoreBackup(backup);
    expect((await getSettings()).block).toEqual({ startDate: '2026-10-12', weekOffAfter: 14 });

    const { block: _omit, ...old } = await getSettings();
    await restoreBackup(makeBackup({ exercises: [], templates: [], sessions: [], settings: [old as never] }));
    expect((await getSettings()).block).toEqual({ startDate: null, weekOffAfter: 12 });
  });
});
