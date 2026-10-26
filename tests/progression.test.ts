import { describe, expect, it } from 'vitest';
import { newSet } from '../src/db/sessions';
import { compareTopSets, goUpWeight, progressionHint, topSet } from '../src/lib/progression';

const set = (weight: number | null, reps: number | null, warmup = false) => newSet({ weight, reps, warmup }, 0);

describe('progressionHint', () => {
  it('triggers only when set 1 (first working set) reaches the top of the range', () => {
    expect(progressionHint([set(15, 10, true), set(22.5, 12), set(22.5, 9)], 12, 2.5)).toMatchObject({ weight: 22.5, reps: 12 });
    expect(progressionHint([set(22.5, 11), set(22.5, 12)], 12, 2.5)).toBeNull(); // only set 2 hit 12
    expect(progressionHint([set(15, 12, true)], 12, 2.5)).toBeNull(); // warm-up doesn't count
    expect(progressionHint(undefined, 12, 2.5)).toBeNull();
  });

  it('suggests 5–10% more, rounded to the step, at least one step', () => {
    expect(progressionHint([set(100, 10)], 10, 2.5)).toMatchObject({ low: 105, high: 110 });
    expect(progressionHint([set(22.5, 12)], 12, 2.5)).toMatchObject({ low: 25, high: 25 }); // 23.6 / 24.75 → one step
    expect(progressionHint([set(39, 12)], 12, 7)).toMatchObject({ low: 46, high: 46 }); // cable stack
    expect(progressionHint([set(60, 8)], 8, 2.5)).toMatchObject({ low: 62.5, high: 65 }); // 63→62.5, 66→65
  });

  it('bodyweight with no added load suggests adding one step', () => {
    expect(progressionHint([set(0, 12)], 12, 2.5)).toMatchObject({ weight: 0, low: 2.5, high: 2.5 });
  });
});

describe('top set comparison', () => {
  it('topSet is the heaviest working set, more reps breaking ties', () => {
    expect(topSet([set(25, 12, true), set(22.5, 8), set(22.5, 9), set(20, 12)])).toEqual({ weight: 22.5, reps: 9 });
    expect(topSet([set(null, 8)])).toBeNull();
  });

  it('heavier wins, then more reps', () => {
    expect(compareTopSets({ weight: 25, reps: 6 }, { weight: 22.5, reps: 9 })).toBe('beat');
    expect(compareTopSets({ weight: 22.5, reps: 10 }, { weight: 22.5, reps: 9 })).toBe('beat');
    expect(compareTopSets({ weight: 22.5, reps: 9 }, { weight: 22.5, reps: 9 })).toBe('matched');
    expect(compareTopSets({ weight: 22.5, reps: 8 }, { weight: 22.5, reps: 9 })).toBe('below');
    expect(compareTopSets({ weight: 20, reps: 15 }, { weight: 22.5, reps: 9 })).toBe('below');
  });
});

describe('goUpWeight', () => {
  it('one weight, a range when 5% and 10% round differently, + for added load', () => {
    expect(goUpWeight({ weight: 32.5, reps: 12, low: 35, high: 35 }, false)).toBe('35 kg');
    expect(goUpWeight({ weight: 60, reps: 12, low: 62.5, high: 65 }, false)).toBe('62.5–65 kg');
    expect(goUpWeight({ weight: 10, reps: 12, low: 12.5, high: 12.5 }, true)).toBe('+12.5 kg');
  });
});
