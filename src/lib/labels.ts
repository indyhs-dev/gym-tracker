import type { Exercise, ExerciseType, TemplateSlot, WarmupPolicy } from '../db/types';
import { formatKg, joinUnbroken } from './format';

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

/** Short labels for the four-way warm-up picker. */
export const WARMUP_SHORT: Record<WarmupPolicy, string> = {
  full: 'Full',
  one: '1 set',
  zeroToOne: '0–1',
  none: 'None',
};

export const WARMUP_POLICIES: WarmupPolicy[] = ['full', 'one', 'zeroToOne', 'none'];

/** "2 × 5–12" (or "3 × 5" when min = max). */
export function setsReps(slot: Pick<TemplateSlot, 'targetSets' | 'repMin' | 'repMax'>): string {
  const reps = slot.repMin === slot.repMax ? `${slot.repMin}` : `${slot.repMin}–${slot.repMax}`;
  return `${slot.targetSets} × ${reps}`;
}

/** "2 × 5–12 | Compound | Full warm-up", wrapping only at the separators. */
export function targetLine(slot: TemplateSlot, type: ExerciseType): string {
  return joinUnbroken([setsReps(slot), TYPE_LABEL[type], WARMUP_LABEL[slot.warmup]]);
}
