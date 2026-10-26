import type { WorkoutSet } from '../db/types';

/**
 * Last session's set matching each of today's sets, shown as placeholders in
 * the kg and reps inputs. Warm-ups and working sets line up separately
 * (today's 2nd warm-up beside last time's 2nd warm-up, working set 1 beside
 * working set 1), so a different number of warm-ups doesn't shift the working
 * sets. Undefined where last time had fewer.
 */
export function previousBeside(
  today: Pick<WorkoutSet, 'warmup'>[],
  last: WorkoutSet[] | undefined,
): (WorkoutSet | undefined)[] {
  const warmups = last?.filter((s) => s.warmup) ?? [];
  const working = last?.filter((s) => !s.warmup) ?? [];
  let w = 0;
  let n = 0;
  return today.map((s) => (s.warmup ? warmups[w++] : working[n++]));
}
