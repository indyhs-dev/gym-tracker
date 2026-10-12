import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/db';
import { addSessionExercise, addSet, dropEmptyExercises, finishedSessions, finishSession, startSession } from '../src/db/sessions';
import { setText, weightText } from '../src/lib/setText';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('history', () => {
  it('lists finished sessions newest first, without the active one', async () => {
    const a = await startSession(null, 1000);
    await finishSession(a.id, 1000, 2000);
    const b = await startSession(null, 5000);
    await finishSession(b.id, 5000, 6000);
    const c = await startSession(null, 3000);
    await finishSession(c.id, 3000, 4000);
    await startSession(null, 9000); // active
    expect((await finishedSessions()).map((s) => s.startedAt)).toEqual([5000, 3000, 1000]);
  });

  it('dropEmptyExercises keeps only exercises with sets', async () => {
    const s = await startSession(null, 1000);
    const keep = await addSessionExercise(s.id, 'bench');
    await addSessionExercise(s.id, 'dips');
    await addSet(s.id, keep, { weight: 20, reps: 5 });
    const saved = await dropEmptyExercises(s.id);
    expect(saved.exercises.map((e) => e.exerciseId)).toEqual(['bench']);
    expect(saved.exerciseIds).toEqual(['bench']);
  });
});

describe('setText', () => {
  const set = (weight: number | null, reps: number | null) => ({ id: 'x', weight, reps, warmup: false, note: '', loggedAt: 0 });
  it('formats weights, bodyweight and missing values', () => {
    expect(setText(set(22.5, 8), { bodyweight: false })).toBe('22.5 × 8');
    expect(setText(set(0, 12), { bodyweight: true })).toBe('BW × 12');
    expect(setText(set(10, 6), { bodyweight: true })).toBe('BW+10 × 6');
    expect(setText(set(null, null), undefined)).toBe('– × –');
    expect(weightText(0, { bodyweight: false })).toBe('0');
  });
});
