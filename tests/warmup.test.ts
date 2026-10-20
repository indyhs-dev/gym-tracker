import { describe, expect, it } from 'vitest';
import { newSet } from '../src/db/sessions';
import { roundToStep, warmupSuggestions, lastWorkWeight } from '../src/lib/warmup';

const set = (weight: number | null, reps: number | null, warmup = false) => newSet({ weight, reps, warmup }, 0);

describe('roundToStep', () => {
  it('rounds to the nearest step', () => {
    expect(roundToStep(9, 2.5)).toBe(10);
    expect(roundToStep(14.625, 2.5)).toBe(15);
    expect(roundToStep(8.4, 7)).toBe(7);
    expect(roundToStep(1.2, 2.5)).toBe(0);
  });
});

describe('warmupSuggestions', () => {
  it('full warm-up on a compound: 40%, 65%, 75%', () => {
    expect(warmupSuggestions('full', 'compound', 100, 2.5)).toEqual([
      { weight: 40, reps: '6–10', percent: 40 },
      { weight: 65, reps: '4–8', percent: 65 },
      { weight: 75, reps: '2–4', percent: 75 },
    ]);
  });

  it('full warm-up on an isolation exercise stops at 65%', () => {
    expect(warmupSuggestions('full', 'isolation', 20, 2.5)).toEqual([
      { weight: 7.5, reps: '6–10', percent: 40 },
      { weight: 12.5, reps: '4–8', percent: 65 },
    ]);
  });

  it('per-hand dumbbells round to the dumbbell step', () => {
    expect(warmupSuggestions('full', 'compound', 22.5, 2.5)).toEqual([
      { weight: 10, reps: '6–10', percent: 40 }, // 9 → 10
      { weight: 15, reps: '4–8', percent: 65 }, // 14.6 → 15
      { weight: 17.5, reps: '2–4', percent: 75 }, // 16.9 → 17.5
    ]);
  });

  it('1 set and 0–1 policies suggest a single 65% set; none suggests nothing', () => {
    expect(warmupSuggestions('one', 'compound', 39, 7)).toEqual([{ weight: 28, reps: '4–8', percent: 65 }]);
    expect(warmupSuggestions('zeroToOne', 'isolation', 30, 2.5)).toEqual([{ weight: 20, reps: '4–8', percent: 65 }]);
    expect(warmupSuggestions('none', 'compound', 100, 2.5)).toEqual([]);
  });

  it('drops steps that round to 0, to the work weight, or repeat', () => {
    // Cable stack in 7 kg steps, work weight 21: 8.4→7, 13.65→14, 15.75→14 (repeat, dropped)
    expect(warmupSuggestions('full', 'compound', 21, 7)).toEqual([
      { weight: 7, reps: '6–10', percent: 40 },
      { weight: 14, reps: '4–8', percent: 65 },
    ]);
    // Light: 5 kg with a 2.5 step: 2→2.5, 3.25→2.5 (repeat), 3.75→5 (= work weight, dropped)
    expect(warmupSuggestions('full', 'compound', 5, 2.5)).toEqual([{ weight: 2.5, reps: '6–10', percent: 40 }]);
    expect(warmupSuggestions('full', 'compound', 2.5, 2.5)).toEqual([]);
  });
});

describe('lastWorkWeight', () => {
  it("uses last session's first work set, ignoring warm-ups", () => {
    expect(lastWorkWeight([set(15, 10, true), set(22.5, 8), set(22.5, 9)])).toBe(22.5);
    expect(lastWorkWeight([set(15, 10, true), set(null, null)])).toBeNull();
    expect(lastWorkWeight(undefined)).toBeNull();
  });
});
