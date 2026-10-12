import type { Exercise, WorkoutSet } from '../db/types';
import { formatKg } from './format';

/** Weight as shown in summaries: "22.5", "BW", "BW+10", or "–" if not entered. */
export function weightText(weight: number | null, exercise: Pick<Exercise, 'bodyweight'> | undefined): string {
  if (weight === null) return '–';
  if (exercise?.bodyweight) return weight === 0 ? 'BW' : `BW+${formatKg(weight)}`;
  return formatKg(weight);
}

/** "22.5 × 8", "BW × 12", "BW+10 × 6". */
export function setText(set: WorkoutSet, exercise: Pick<Exercise, 'bodyweight'> | undefined): string {
  return `${weightText(set.weight, exercise)} × ${set.reps ?? '–'}`;
}
