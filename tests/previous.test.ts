import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/db';
import { addSet, addSets, newSet, previousBestsFor, previousSetsFor, startSession } from '../src/db/sessions';
import type { Session } from '../src/db/types';
import { previousBeside } from '../src/lib/previous';

const set = (weight: number, reps: number, warmup = false) => newSet({ weight, reps, warmup }, 0);

function finished(id: string, startedAt: number, items: [string, ReturnType<typeof set>[]][]): Session {
  return {
    id,
    templateId: null,
    templateName: null,
    status: 'finished',
    startedAt,
    endedAt: startedAt + 3600_000,
    note: '',
    updatedAt: 0,
    exercises: items.map(([exerciseId, sets], i) => ({ id: `${id}-${i}`, exerciseId, slot: null, note: '', sets })),
    exerciseIds: [...new Set(items.map(([e]) => e))],
  };
}

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('previousSetsFor', () => {
  it('takes the latest earlier finished session with sets for that exact exercise', async () => {
    await db.sessions.bulkAdd([
      finished('old', 1000, [['bench', [set(20, 10)]]]),
      finished('recent', 3000, [['bench', [set(15, 10, true), set(22.5, 8), set(22.5, 9)]], ['pulldown', [set(39, 7)]]]),
      finished('empty-bench', 4000, [['bench', []]]), // logged nothing for bench: skipped
      finished('pullups', 4500, [['pullup', [set(0, 6)]]]),
      finished('future', 9000, [['bench', [set(30, 5)]]]), // after the current session: ignored
    ]);
    const current = await startSession(null, 5000);
    const prev = await previousSetsFor(['bench', 'pulldown', 'pullup', 'dips'], current);

    expect(prev.get('bench')).toMatchObject({ sessionId: 'recent', startedAt: 3000 });
    expect(prev.get('bench')!.sets.map((s) => [s.weight, s.reps, s.warmup])).toEqual([
      [15, 10, true],
      [22.5, 8, false],
      [22.5, 9, false],
    ]);
    // Variations are separate: pulldown and pull-up each have their own history.
    expect(prev.get('pulldown')!.sets.map((s) => s.weight)).toEqual([39]);
    expect(prev.get('pullup')!.sets.map((s) => s.reps)).toEqual([6]);
    expect(prev.has('dips')).toBe(false);
  });

  it('ignores unfinished sessions and the current one', async () => {
    const current = await startSession(null, 5000);
    await addSet(current.id, 'x', {}); // no-op on missing item
    await db.sessions.add({ ...finished('draft', 2000, [['bench', [set(50, 5)]]]), status: 'active' });
    expect((await previousSetsFor(['bench'], current)).size).toBe(0);
  });
});

describe('previousBestsFor', () => {
  it('the best top set across every earlier finished session, per exercise', async () => {
    await db.sessions.bulkAdd([
      finished('a', 1000, [['bench', [set(25, 6), set(22.5, 10)]]]),
      finished('b', 2000, [['bench', [set(22.5, 12)]], ['dips', [set(0, 9)]]]),
      finished('c', 9000, [['bench', [set(40, 5)]]]), // after the current session: ignored
    ]);
    const current = await startSession(null, 5000);
    const bests = await previousBestsFor(['bench', 'dips', 'fly'], current);
    expect(bests.get('bench')).toEqual({ weight: 25, reps: 6 });
    expect(bests.get('dips')).toEqual({ weight: 0, reps: 9 });
    expect(bests.has('fly')).toBe(false);
  });
});

describe('adding sets', () => {
  it('addSet can keep a supplied id; addSets adds several in order', async () => {
    const s = await startSession(null, 1000);
    await db.sessions.update(s.id, { exercises: [{ id: 'i1', exerciseId: 'bench', slot: null, note: '', sets: [] }] });
    await addSet(s.id, 'i1', { weight: 20, reps: 10 }, 'fixed-id');
    await addSets(s.id, 'i1', [{ weight: 22.5, reps: 8 }, { weight: 22.5, reps: 9, warmup: false }]);
    const sets = (await db.sessions.get(s.id))!.exercises[0].sets;
    expect(sets[0].id).toBe('fixed-id');
    expect(sets.map((x) => `${x.weight}x${x.reps}`)).toEqual(['20x10', '22.5x8', '22.5x9']);
    await addSets(s.id, 'i1', [{ id: 'a' }, { id: 'b', reps: 5 }]);
    const more = (await db.sessions.get(s.id))!.exercises[0].sets.slice(3);
    expect(more.map((x) => [x.id, x.reps])).toEqual([['a', null], ['b', 5]]);
  });
});

describe('previousBeside', () => {
  it('lines up warm-ups with warm-ups and working sets with working sets', () => {
    const last = [set(10, 10, true), set(15, 6, true), set(22.5, 8), set(22.5, 7)];
    const today = [set(10, 10, true), set(22.5, 9), set(22.5, 8), set(22.5, 6)];
    const beside = previousBeside(today, last).map((s) => s && `${s.weight}×${s.reps}`);
    expect(beside).toEqual(['10×10', '22.5×8', '22.5×7', undefined]);
    expect(previousBeside(today, undefined)).toEqual([undefined, undefined, undefined, undefined]);
  });
});
