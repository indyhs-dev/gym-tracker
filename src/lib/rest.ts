import type { ExerciseType, RestGuidance, WarmupPolicy } from '../db/types';

/**
 * "Rest 3–5 min · warm-ups 1–2 min". The warm-up part is left out when the
 * slot has no warm-up; ad-hoc exercises (no slot) show both.
 */
export function restText(type: ExerciseType, warmup: WarmupPolicy | null, rest: RestGuidance): string {
  const parts = [];
  if (rest[type]) parts.push(`Rest ${rest[type]}`);
  if (warmup !== 'none' && rest.warmup) parts.push(`warm-ups ${rest.warmup}`);
  return parts.join(' · ');
}
