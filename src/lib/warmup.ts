import type { ExerciseType, WarmupPolicy, WorkoutSet } from '../db/types';
import { isWorkingSet } from './progress';

export interface WarmupStep {
  weight: number;
  reps: string;
  /** Share of the work weight before rounding, e.g. 40. */
  percent: number;
}

/** Nearest multiple of the exercise's weight step. */
export function roundToStep(kg: number, step: number): number {
  return Math.round(Math.round(kg / step) * step * 100) / 100;
}

const FULL: [pct: number, reps: string][] = [
  [0.4, '6–10'],
  [0.65, '4–8'],
];
const HEAVY: [number, string] = [0.75, '2–4'];
const SINGLE: [number, string] = [0.65, '4–8'];

/**
 * Suggested warm-up sets for a work weight:
 * full → 40% × 6–10, 65% × 4–8, and (compound only) 75% × 2–4;
 * 1 set / 0–1 → a single 65% × 4–8. Rounded to the step; steps that round
 * to 0 or repeat the previous weight are dropped.
 */
export function warmupSuggestions(
  policy: WarmupPolicy,
  type: ExerciseType,
  workWeight: number,
  step: number,
): WarmupStep[] {
  if (policy === 'none' || workWeight <= 0) return [];
  const plan = policy === 'full' ? [...FULL, ...(type === 'compound' ? [HEAVY] : [])] : [SINGLE];
  const steps: WarmupStep[] = [];
  for (const [pct, reps] of plan) {
    const weight = roundToStep(workWeight * pct, step);
    if (weight <= 0 || weight >= workWeight || steps.at(-1)?.weight === weight) continue;
    steps.push({ weight, reps, percent: Math.round(pct * 100) });
  }
  return steps;
}

/**
 * Last session's first working-set weight: what the warm-ups lead up to.
 * Only last time counts, never today's sets, so the warm-up line is fixed for
 * the whole workout and can't appear or change above a set while you log it.
 */
export function lastWorkWeight(lastSets: WorkoutSet[] | undefined): number | null {
  return lastSets?.find((s) => isWorkingSet(s) && s.weight > 0)?.weight ?? null;
}
