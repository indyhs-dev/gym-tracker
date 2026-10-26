import { beforeEach, describe, expect, it } from 'vitest';
import { makeBackup, parseBackup, readAll, restoreBackup } from '../src/db/backup';
import { db } from '../src/db/db';
import { createExercise } from '../src/db/exercises';
import { seedIfNeeded } from '../src/db/seed';
import { addSet, finishSession, setExerciseNote, setSessionNote, startSession } from '../src/db/sessions';
import { updateSettings } from '../src/db/settings';
import type { Exercise, Session } from '../src/db/types';
import { buildCsv, claudeSummary, needsBackupReminder, sessionsInRange } from '../src/lib/export';

const at = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();

beforeEach(async () => {
  await db.delete();
  await db.open();
});

async function logSample() {
  await seedIfNeeded();
  const byName = new Map((await db.exercises.toArray()).map((e) => [e.name, e]));
  const torso = (await db.templates.toArray()).find((t) => t.name === 'Torso')!;
  const s = await startSession(torso.id, at(2026, 10, 12, 18, 0));
  const bench = s.exercises[0].id;
  await addSet(s.id, bench, { weight: 15, reps: 10, warmup: true });
  await addSet(s.id, bench, { weight: 22.5, reps: 8 });
  await addSet(s.id, bench, { weight: 22.5, reps: 9, note: 'slow, "paused"' });
  const dips = s.exercises[1].id;
  await addSet(s.id, dips, { weight: 0, reps: 12 });
  await addSet(s.id, dips, { weight: 10, reps: 6 });
  await setExerciseNote(s.id, dips, 'shoulders, fine');
  await setSessionNote(s.id, 'need to strengthen forearms');
  await finishSession(s.id, at(2026, 10, 12, 18, 0), at(2026, 10, 12, 19, 12));
  return { session: (await db.sessions.get(s.id))!, byName };
}

const exerciseMap = async () => new Map((await db.exercises.toArray()).map((e) => [e.id, e] as [string, Exercise]));

describe('CSV export', () => {
  it('has the agreed columns, one row per set, escaped fields', async () => {
    await logSample();
    const csv = buildCsv(await db.sessions.toArray(), await exerciseMap());
    expect(csv.startsWith('﻿')).toBe(true);
    const lines = csv.slice(1).trimEnd().split('\r\n');
    expect(lines).toEqual([
      'date,session,exercise,set number,weight,reps,warm-up,note',
      '2026-10-12,Torso,Flat Dumbbell Bench Press,1,15,10,yes,',
      '2026-10-12,Torso,Flat Dumbbell Bench Press,2,22.5,8,no,',
      '2026-10-12,Torso,Flat Dumbbell Bench Press,3,22.5,9,no,"slow, ""paused"""',
      '2026-10-12,Torso,Dips,1,0,12,no,',
      '2026-10-12,Torso,Dips,2,10,6,no,',
    ]);
  });
});

describe('Copy for Claude', () => {
  it('summarises sessions in the range compactly', async () => {
    await logSample();
    const text = claudeSummary(await db.sessions.toArray(), await exerciseMap(), '2026-10-01', '2026-10-12');
    expect(text).toBe(
      [
        'Gym log 2026-10-01 to 2026-10-12: 1 session.',
        'Weights in kg ("each" = per dumbbell, BW = bodyweight, BW+n = added load). W = warm-up set.',
        '',
        'Mon 12 Oct 2026 · Torso · 18:00–19:12 (1h 12m)',
        'Session note: need to strengthen forearms',
        '- Flat Dumbbell Bench Press (each): W 15×10, 22.5×8, 22.5×9 [slow, "paused"]',
        '- Dips: BW×12, BW+10×6. Note: shoulders, fine',
        '',
      ].join('\n'),
    );
  });

  it('range is inclusive by day and only includes finished sessions', () => {
    const mk = (id: string, startedAt: number, status: Session['status'] = 'finished') =>
      ({ id, startedAt, status }) as Session;
    const list = [mk('a', at(2026, 10, 1, 0, 0)), mk('b', at(2026, 10, 12, 23, 59)), mk('c', at(2026, 10, 13, 0, 1)), mk('d', at(2026, 10, 5), 'active')];
    expect(sessionsInRange(list, '2026-10-01', '2026-10-12').map((s) => s.id)).toEqual(['a', 'b']);
  });
});

describe('JSON backup', () => {
  it('round-trips everything exactly', async () => {
    await logSample();
    await createExercise({ name: 'Incline Dumbbell Press', type: 'compound', perHand: true, bodyweight: false, weightStep: 2.5 });
    await updateSettings({ lastBackupAt: 123 });
    const before = await readAll();
    const text = JSON.stringify(makeBackup(before));

    await db.delete();
    await db.open();
    await restoreBackup(parseBackup(text));

    const after = await readAll();
    const sort = <T extends { id: string }>(xs: T[]) => [...xs].sort((a, b) => a.id.localeCompare(b.id));
    expect(sort(after.exercises)).toEqual(sort(before.exercises));
    expect(sort(after.templates)).toEqual(sort(before.templates));
    expect(sort(after.sessions)).toEqual(sort(before.sessions));
    expect(after.settings).toEqual(before.settings);
    // Seeding doesn't run again on top of restored data.
    expect(await seedIfNeeded()).toBe(false);
  });

  it('has no sauna data (the sauna log was removed)', async () => {
    await logSample();
    const backup = makeBackup(await readAll());
    expect(Object.keys(backup.data).sort()).toEqual(['exercises', 'sessions', 'settings', 'templates']);
    expect(backup.data.settings[0]).not.toHaveProperty('sauna');
  });

  it('still restores old backups that contain sauna data, ignoring it', async () => {
    await logSample();
    const current = await readAll();
    const old = {
      format: 'gym-log-backup',
      version: 2,
      exportedAt: 1_760_000_000_000,
      data: {
        ...current,
        settings: current.settings.map((s) => ({ ...s, sauna: { weeklyTarget: 3, samplesAddedAt: 1 } })),
        saunaEntries: [{ id: 'x', date: '2026-10-13', kind: 'skip', reason: 'rest', createdAt: 1, updatedAt: 1 }],
      },
    };
    await db.delete();
    await db.open();
    await restoreBackup(parseBackup(JSON.stringify(old)));
    expect(await db.sessions.count()).toBe(current.sessions.length);
    expect(await db.settings.get('app')).not.toHaveProperty('sauna');
    expect(Object.keys(await readAll())).not.toContain('saunaEntries');
  });

  it('replaces existing data rather than merging', async () => {
    await logSample();
    const backup = makeBackup(await readAll());
    await createExercise({ name: 'Added Later', type: 'core', perHand: false, bodyweight: false, weightStep: 2.5 });
    await restoreBackup(backup);
    expect(await db.exercises.where('nameKey').equals('added later').count()).toBe(0);
  });

  it('rejects files that are not backups', () => {
    expect(() => parseBackup('not json')).toThrow('not valid JSON');
    expect(() => parseBackup('{"hello":1}')).toThrow('isn’t a Gym Log backup');
    expect(() => parseBackup(JSON.stringify({ format: 'gym-log-backup', version: 99, data: {} }))).toThrow('newer version');
    expect(() => parseBackup(JSON.stringify({ format: 'gym-log-backup', version: 1, data: { exercises: [] } }))).toThrow('incomplete');
  });
});

describe('backup reminder', () => {
  const day = 86_400_000;
  it('shows after 14 days without a backup, counting from the first session if never backed up', () => {
    const now = at(2026, 10, 30);
    expect(needsBackupReminder(null, null, now)).toBe(false);
    expect(needsBackupReminder(null, now - 3 * day, now)).toBe(false);
    expect(needsBackupReminder(null, now - 15 * day, now)).toBe(true);
    expect(needsBackupReminder(now - 13 * day, now - 60 * day, now)).toBe(false);
    expect(needsBackupReminder(now - 15 * day, now - 60 * day, now)).toBe(true);
  });
});
