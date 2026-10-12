import type { Exercise, ExerciseType, WarmupPolicy } from '../db/types';
import { formatKg } from './format';

export const TYPE_LABEL: Record<ExerciseType, string> = {
  compound: 'Compound',
  isolation: 'Isolation',
  core: 'Core',
};

export const EXERCISE_TYPES: ExerciseType[] = ['compound', 'isolation', 'core'];

export const WARMUP_LABEL: Record<WarmupPolicy, string> = {
  full: 'Full warm-up',
  one: '1 warm-up set',
  zeroToOne: '0–1 warm-up sets',
  none: 'No warm-up',
};

export function exerciseMeta(e: Exercise): string {
  return [
    TYPE_LABEL[e.type],
    e.perHand && 'per hand',
    e.bodyweight && 'bodyweight',
    `${formatKg(e.weightStep)} kg step`,
  ]
    .filter(Boolean)
    .join(' · ');
}
