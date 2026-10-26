import type { WorkoutSet } from '../db/types';
import { formatKg } from './format';
import { isWorkingSet } from './progress';
import { roundToStep } from './warmup';

export interface ProgressionHint {
  /** Last session's first working set. */
  weight: number;
  reps: number;
  /** Suggested weight range for next time (equal when 5% and 10% round the same). */
  low: number;
  high: number;
}

/**
 * Set 1 goes to failure, so reaching the top of the rep range on it means
 * it's time to go up: 5–10% heavier, rounded to the exercise's step and at
 * least one step more. (Form can't be judged by the app; the wording says so.)
 */
export function progressionHint(lastSets: WorkoutSet[] | undefined, repMax: number, step: number): ProgressionHint | null {
  const first = lastSets?.find(isWorkingSet);
  if (!first || first.reps < repMax) return null;
  const weight = first.weight!;
  const low = Math.max(weight + step, roundToStep(weight * 1.05, step));
  const high = Math.max(low, roundToStep(weight * 1.1, step));
  return { weight, reps: first.reps!, low, high };
}

/**
 * The weight to go up to: "35 kg", "35–37.5 kg" when 5% and 10% round
 * differently, or "+12.5 kg" for added load on a bodyweight exercise.
 */
export function goUpWeight(hint: ProgressionHint, bodyweight: boolean): string {
  const range = `${formatKg(hint.low)}${hint.high > hint.low ? `–${formatKg(hint.high)}` : ''}`;
  return `${bodyweight ? '+' : ''}${range} kg`;
}

export interface TopSet {
  weight: number;
  reps: number;
}

/** Heaviest working set; at equal weight, the one with more reps. */
export function topSet(sets: WorkoutSet[] | undefined): TopSet | null {
  let best: TopSet | null = null;
  for (const s of sets ?? []) {
    if (!isWorkingSet(s)) continue;
    if (!best || s.weight! > best.weight || (s.weight === best.weight && s.reps! > best.reps)) {
      best = { weight: s.weight!, reps: s.reps! };
    }
  }
  return best;
}

export type Comparison = 'beat' | 'matched' | 'below';

/** Heavier wins; at the same weight, more reps wins. */
export function compareTopSets(today: TopSet, last: TopSet): Comparison {
  if (today.weight !== last.weight) return today.weight > last.weight ? 'beat' : 'below';
  if (today.reps !== last.reps) return today.reps > last.reps ? 'beat' : 'below';
  return 'matched';
}

/** Today's top set beats the best from every earlier session (never true the first time an exercise is done). */
export function isNewBest(sets: WorkoutSet[], previousBest: TopSet | undefined): boolean {
  const top = topSet(sets);
  return top !== null && previousBest !== undefined && compareTopSets(top, previousBest) === 'beat';
}
