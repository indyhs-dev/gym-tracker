import type { WorkoutSet } from '../db/types';

/**
 * Last session's set to show beside each of today's sets, for the Previous
 * column. Warm-ups and working sets line up separately (today's 2nd warm-up
 * beside last time's 2nd warm-up, working set 1 beside working set 1), so a
 * different number of warm-ups doesn't shift the working sets. Undefined
 * where last time had fewer.
 */
export function previousBeside(today: WorkoutSet[], last: WorkoutSet[] | undefined): (WorkoutSet | undefined)[] {
  const warmups = last?.filter((s) => s.warmup) ?? [];
  const working = last?.filter((s) => !s.warmup) ?? [];
  let w = 0;
  let n = 0;
  return today.map((s) => (s.warmup ? warmups[w++] : working[n++]));
}
