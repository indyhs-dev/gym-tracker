import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/db';
import { addSet, finishSession, isLive, setSessionTimes, startSession, suggestedEnd } from '../src/db/sessions';
import { addSlot, createTemplate } from '../src/db/templates';
import { atTime, endAtTime, formatClock, toTimeInput } from '../src/lib/time';

const at = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('time helpers', () => {
  it('formatClock', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(42 * 60_000 + 13_000)).toBe('42:13');
    expect(formatClock(3600_000 + 2 * 60_000 + 3_000)).toBe('1:02:03');
  });

  it('time inputs, and ends past midnight roll to the next day', () => {
    const start = at(2026, 10, 12, 18, 5);
    expect(toTimeInput(start)).toBe('18:05');
    expect(atTime(start, '07:30')).toBe(at(2026, 10, 12, 7, 30));
    expect(endAtTime(start, '19:20')).toBe(at(2026, 10, 12, 19, 20));
    expect(endAtTime(start, '00:30')).toBe(at(2026, 10, 13, 0, 30));
  });
});

describe('finishing', () => {
  it('suggests the last logged set time as the end', async () => {
    const s = await startSession(null, at(2026, 10, 12, 18, 0));
    expect(suggestedEnd(s, at(2026, 10, 12, 19, 30))).toBe(at(2026, 10, 12, 19, 30)); // no sets: now
    const withSets = {
      ...s,
      exercises: [
        {
          id: 'i',
          exerciseId: 'e',
          slot: null,
          note: '',
          sets: [
            { id: 'a', weight: 1, reps: 1, warmup: false, note: '', loggedAt: at(2026, 10, 12, 18, 20) },
            { id: 'b', weight: 1, reps: 1, warmup: false, note: '', loggedAt: at(2026, 10, 12, 19, 7) },
          ],
        },
      ],
    };
    expect(suggestedEnd(withSets, at(2026, 10, 12, 21, 0))).toBe(at(2026, 10, 12, 19, 7));
  });

  it('finish saves the times and drops skipped exercises', async () => {
    const t = await createTemplate('Torso');
    await addSlot(t.id, 'bench');
    await addSlot(t.id, 'dips');
    const s = await startSession(t.id, at(2026, 10, 12, 18, 0));
    await addSet(s.id, s.exercises[0].id, { weight: 22.5, reps: 8 });
    await finishSession(s.id, at(2026, 10, 12, 18, 0), at(2026, 10, 12, 19, 12));
    const saved = (await db.sessions.get(s.id))!;
    expect(saved).toMatchObject({ status: 'finished', endedAt: at(2026, 10, 12, 19, 12) });
    expect(saved.exercises.map((e) => e.exerciseId)).toEqual(['bench']);
    expect(saved.exerciseIds).toEqual(['bench']);
    expect(() => finishSession(s.id, 2000, 1000)).toThrow();
  });

  it('times stay editable afterwards', async () => {
    const s = await startSession(null, 1000);
    await finishSession(s.id, 1000, 5000);
    await setSessionTimes(s.id, 2000, 9000);
    expect(await db.sessions.get(s.id)).toMatchObject({ startedAt: 2000, endedAt: 9000 });
  });

  it('a workout started today is live; one dated in the past is not', async () => {
    const now = at(2026, 10, 12, 19, 0);
    const live = await startSession(null, at(2026, 10, 12, 18, 0));
    expect(isLive(live, now)).toBe(true);
    expect(isLive({ ...live, startedAt: at(2026, 10, 11, 19, 0) }, now)).toBe(false);
    expect(isLive({ ...live, status: 'finished' }, now)).toBe(false);
  });
});
