import type { ExerciseType, WarmupPolicy, WorkoutSet } from '../db/types';
import { isWorkingSet } from './progress';

export interface WarmupStep {
  weight: number;
  reps: string;
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
    steps.push({ weight, reps });
  }
  return steps;
}

export interface WorkWeight {
  weight: number;
  source: 'today' | 'last time';
}

/** First working-set weight logged today, otherwise last session's. */
export function workWeightFor(todaySets: WorkoutSet[], lastSets: WorkoutSet[] | undefined): WorkWeight | null {
  const today = todaySets.find((s) => isWorkingSet(s) && s.weight > 0);
  if (today) return { weight: today.weight!, source: 'today' };
  const last = lastSets?.find((s) => isWorkingSet(s) && s.weight > 0);
  return last ? { weight: last.weight!, source: 'last time' } : null;
}
