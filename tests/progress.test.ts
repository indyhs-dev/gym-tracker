import { describe, expect, it } from 'vitest';
import { newSet } from '../src/db/sessions';
import type { Session } from '../src/db/types';
import {
  epley,
  exercisePRs,
  exerciseHistory,
  isWorkingSet,
  minuteTicks,
  sessionDurations,
  trainedExercises,
  weeklyWorkingSets,
} from '../src/lib/progress';

const set = (weight: number | null, reps: number | null, warmup = false) => newSet({ weight, reps, warmup }, 0);

function session(id: string, startedAt: number, items: [string, ReturnType<typeof set>[]][], status: Session['status'] = 'finished'): Session {
  return {
    id,
    templateId: null,
    templateName: null,
    status,
    startedAt,
    endedAt: startedAt + 1,
    note: '',
    updatedAt: 0,
    exercises: items.map(([exerciseId, sets], i) => ({ id: `${id}${i}`, exerciseId, slot: null, note: '', sets })),
    exerciseIds: items.map(([e]) => e),
  };
}

describe('working sets and Epley', () => {
  it('counts only non-warm-up sets with weight and reps', () => {
    expect(isWorkingSet(set(20, 8))).toBe(true);
    expect(isWorkingSet(set(0, 12))).toBe(true); // bodyweight
    expect(isWorkingSet(set(20, 8, true))).toBe(false);
    expect(isWorkingSet(set(null, 8))).toBe(false);
    expect(isWorkingSet(set(20, 0))).toBe(false);
  });

  it('epley', () => {
    expect(epley(100, 10)).toBeCloseTo(133.33, 2);
    expect(epley(22.5, 8)).toBeCloseTo(28.5, 5);
  });
});

describe('exerciseHistory', () => {
  const sessions = [
    session('b', 2000, [['bench', [set(15, 10, true), set(22.5, 8), set(22.5, 9)]], ['curl', [set(10, 15)]]]),
    session('a', 1000, [['bench', [set(20, 10), set(20, 7)]]]),
    session('c', 3000, [['bench', [set(25, 15), set(22.5, 12)]]]),
    session('d', 4000, [['bench', [set(30, 5)]]], 'active'),
    session('e', 5000, [['bench', [set(15, 10, true)]]]), // only warm-ups: no point
  ];

  it('gives one point per finished session, oldest first', () => {
    const h = exerciseHistory(sessions, 'bench');
    expect(h.map((p) => p.sessionId)).toEqual(['a', 'b', 'c']);
    expect(h[1]).toMatchObject({ topWeight: 22.5, topReps: 9, mostReps: 9, workingSets: 2 });
    expect(h[1].e1rm).toBeCloseTo(epley(22.5, 9), 5); // warm-up ignored
  });

  it('top weight counts any reps, but e1RM ignores sets over 12 reps', () => {
    const c = exerciseHistory(sessions, 'bench')[2];
    expect(c.topWeight).toBe(25); // 25 × 15 is the heaviest
    expect(c.e1rm).toBeCloseTo(epley(22.5, 12), 5); // 25 × 15 excluded from e1RM
  });

  it('e1RM is null when every set is over 12 reps', () => {
    expect(exerciseHistory(sessions, 'curl')[0].e1rm).toBeNull();
  });

  it('trainedExercises lists exercises with working sets, most recent first', () => {
    expect(trainedExercises(sessions)).toEqual(['bench', 'curl']);
  });
});

describe('PRs', () => {
  const sessions = [
    session('a', 1000, [['bench', [set(20, 10), set(20, 8), set(22.5, 6)]]]),
    session('b', 2000, [['bench', [set(15, 10, true), set(22.5, 8), set(20, 10)]]]), // 20×10 ties: keep first
    session('c', 3000, [['bench', [set(25, 5), set(22.5, 7)]]]),
    session('d', 4000, [['bench', [set(30, 3)]]], 'active'),
  ];

  it('heaviest weight and best reps at each weight, first time achieved', () => {
    const prs = exercisePRs(sessions, 'bench');
    expect(prs.heaviest).toEqual({ weight: 25, reps: 5, startedAt: 3000 });
    expect(prs.repsAtWeight).toEqual([
      { weight: 25, reps: 5, startedAt: 3000 },
      { weight: 22.5, reps: 8, startedAt: 2000 },
      { weight: 20, reps: 10, startedAt: 1000 },
    ]);
    expect(exercisePRs(sessions, 'nothing')).toEqual({ heaviest: null, repsAtWeight: [] });
  });
});

describe('overall', () => {
  const at = (y: number, mo: number, d: number, h = 12) => new Date(y, mo - 1, d, h).getTime();

  it('weeklyWorkingSets counts working sets per Monday–Sunday week, including empty weeks', () => {
    const sessions = [
      session('a', at(2026, 10, 12), [['bench', [set(15, 10, true), set(20, 8), set(20, 7)]], ['dips', [set(0, 10)]]]),
      session('b', at(2026, 10, 18, 20), [['bench', [set(20, 8)]]]), // Sunday, same week
      session('c', at(2026, 10, 5), [['bench', [set(20, 8), set(20, 8)]]]),
      session('d', at(2026, 7, 1), [['bench', [set(20, 8)]]]), // too old
      session('e', at(2026, 10, 13), [['bench', [set(20, 8)]]], 'active'),
    ];
    const weeks = weeklyWorkingSets(sessions, at(2026, 10, 14), 3);
    expect(weeks.map((w) => [new Date(w.weekStart).getDate(), w.sets])).toEqual([
      [28, 0],
      [5, 2],
      [12, 4],
    ]);
  });

  it('sessionDurations returns the latest sessions in order, in minutes', () => {
    const list = [1, 2, 3].map((i) => ({ ...session(`s${i}`, i * 1e7, []), endedAt: i * 1e7 + i * 30 * 60000 }));
    expect(sessionDurations(list, 2)).toEqual([
      { sessionId: 's2', startedAt: 2e7, minutes: 60 },
      { sessionId: 's3', startedAt: 3e7, minutes: 90 },
    ]);
  });
});

describe('minuteTicks', () => {
  it('uses round 15- or 30-minute steps with headroom', () => {
    expect(minuteTicks([67, 102])).toEqual([60, 75, 90, 105]);
    expect(minuteTicks([45, 60])).toEqual([30, 45, 60, 75]);
    expect(minuteTicks([30, 150])).toEqual([0, 30, 60, 90, 120, 150, 180]);
  });
});
