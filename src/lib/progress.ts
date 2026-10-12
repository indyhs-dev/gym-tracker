import type { Session, WorkoutSet } from '../db/types';

/** Not a warm-up, with weight entered and at least one rep (bodyweight sets count with 0 added). */
export function isWorkingSet(set: WorkoutSet): set is WorkoutSet & { weight: number; reps: number } {
  return !set.warmup && set.weight !== null && set.reps !== null && set.reps > 0;
}

/** Epley estimated 1RM. Only meaningful up to 12 reps, so callers skip higher-rep sets. */
export function epley(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}

export const E1RM_MAX_REPS = 12;

export interface ExercisePoint {
  sessionId: string;
  startedAt: number;
  /** Heaviest working set (any reps), and the most reps done at that weight. */
  topWeight: number;
  topReps: number;
  /** Best Epley estimate from working sets of ≤ 12 reps; null if all sets were higher-rep. */
  e1rm: number | null;
  /** Most reps in any working set. */
  mostReps: number;
  workingSets: number;
}

/** One point per finished session that has working sets for this exercise, oldest first. */
export function exerciseHistory(sessions: Session[], exerciseId: string): ExercisePoint[] {
  const points: ExercisePoint[] = [];
  for (const s of sessions) {
    if (s.status !== 'finished') continue;
    const sets = s.exercises
      .filter((e) => e.exerciseId === exerciseId)
      .flatMap((e) => e.sets)
      .filter(isWorkingSet);
    if (sets.length === 0) continue;
    const topWeight = Math.max(...sets.map((x) => x.weight));
    const topReps = Math.max(...sets.filter((x) => x.weight === topWeight).map((x) => x.reps));
    const estimates = sets.filter((x) => x.reps <= E1RM_MAX_REPS).map((x) => epley(x.weight, x.reps));
    points.push({
      sessionId: s.id,
      startedAt: s.startedAt,
      topWeight,
      topReps,
      e1rm: estimates.length ? Math.max(...estimates) : null,
      mostReps: Math.max(...sets.map((x) => x.reps)),
      workingSets: sets.length,
    });
  }
  return points.sort((a, b) => a.startedAt - b.startedAt);
}

/** Exercises with at least one working set in a finished session, most recently trained first. */
export function trainedExercises(sessions: Session[]): string[] {
  const last = new Map<string, number>();
  for (const s of sessions) {
    if (s.status !== 'finished') continue;
    for (const e of s.exercises) {
      if (!e.sets.some(isWorkingSet)) continue;
      last.set(e.exerciseId, Math.max(last.get(e.exerciseId) ?? 0, s.startedAt));
    }
  }
  return [...last].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}
