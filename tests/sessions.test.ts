import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/db';
import {
  ActiveSessionError,
  discardSession,
  getActiveSession,
  lastFinishedSession,
  loadWeekStats,
  startSession,
  weekStats,
} from '../src/db/sessions';
import { addSlot, createTemplate, updateSlot, withAlternative } from '../src/db/templates';
import type { Session } from '../src/db/types';
import { restText } from '../src/lib/rest';
import { DEFAULT_REST } from '../src/db/defaults';

const at = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();

function finished(startedAt: number, minutes: number, extra: Partial<Session> = {}): Session {
  return {
    id: `s${startedAt}`,
    templateId: null,
    templateName: null,
    status: 'finished',
    startedAt,
    endedAt: startedAt + minutes * 60_000,
    note: '',
    exercises: [],
    exerciseIds: [],
    updatedAt: 0,
    ...extra,
  };
}

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('startSession', () => {
  it('copies the template slots into the session', async () => {
    const t = await createTemplate('Torso');
    const s1 = await addSlot(t.id, 'pullup');
    await updateSlot(t.id, s1.id, (s) => withAlternative({ ...s, repMin: 5, warmup: 'full' }, 'pulldown'));
    await addSlot(t.id, 'dips');

    const session = await startSession(t.id, 1000);
    expect(session).toMatchObject({ templateId: t.id, templateName: 'Torso', status: 'active', startedAt: 1000, endedAt: null });
    expect(session.exercises.map((e) => e.exerciseId)).toEqual(['pullup', 'dips']);
    expect(session.exercises[0].slot).toMatchObject({ repMin: 5, warmup: 'full', alternativeIds: ['pulldown'] });
    expect(session.exerciseIds).toEqual(['pullup', 'dips']);

    // Editing the template afterwards doesn't touch the session.
    await updateSlot(t.id, s1.id, (s) => ({ ...s, repMin: 8 }));
    expect((await db.sessions.get(session.id))!.exercises[0].slot!.repMin).toBe(5);
  });

  it('starts a blank session', async () => {
    const session = await startSession(null, 1000);
    expect(session).toMatchObject({ templateId: null, templateName: null, exercises: [] });
  });

  it('allows only one active workout', async () => {
    await startSession(null, 1000);
    await expect(startSession(null, 2000)).rejects.toBeInstanceOf(ActiveSessionError);
  });

  it('discard removes the active workout', async () => {
    const s = await startSession(null, 1000);
    await discardSession(s.id);
    expect(await getActiveSession()).toBeUndefined();
  });
});

describe('Today queries', () => {
  it('lastFinishedSession ignores the active one and picks the latest start', async () => {
    await db.sessions.bulkAdd([
      finished(at(2026, 10, 5, 18), 60, { templateName: 'Legs' }),
      finished(at(2026, 10, 9, 18), 70, { templateName: 'Torso' }),
      finished(at(2026, 10, 7, 18), 50, { templateName: 'Arms' }),
    ]);
    await startSession(null, at(2026, 10, 12, 18));
    expect((await lastFinishedSession())?.templateName).toBe('Torso');
  });

  it('weekStats counts finished sessions Monday–Sunday', async () => {
    const now = at(2026, 10, 14, 12); // Wednesday
    const sessions = [
      finished(at(2026, 10, 11, 23, 30), 60), // Sunday before: out
      finished(at(2026, 10, 12, 0, 0), 75), // Monday 00:00: in
      finished(at(2026, 10, 14, 7), 45), // in
      finished(at(2026, 10, 18, 23, 59), 30), // Sunday: in
      finished(at(2026, 10, 19, 0, 0), 60), // next Monday: out
      { ...finished(at(2026, 10, 13, 18), 60), status: 'active' as const, endedAt: null }, // active: out
    ];
    expect(weekStats(sessions, now)).toEqual({ sessions: 3, totalMs: (75 + 45 + 30) * 60_000 });

    await db.sessions.bulkAdd(sessions);
    expect(await loadWeekStats(now)).toEqual({ sessions: 3, totalMs: (75 + 45 + 30) * 60_000 });
  });
});

describe('restText', () => {
  it('adds the warm-up guidance unless the slot has no warm-up', () => {
    expect(restText('compound', 'full', DEFAULT_REST)).toBe('Rest 3–5 min · warm-ups 1–2 min');
    expect(restText('core', 'none', DEFAULT_REST)).toBe('Rest 60–90 s');
    expect(restText('isolation', null, DEFAULT_REST)).toBe('Rest 90 s–3 min · warm-ups 1–2 min');
    expect(restText('core', 'none', { ...DEFAULT_REST, core: '' })).toBe('');
  });
});
