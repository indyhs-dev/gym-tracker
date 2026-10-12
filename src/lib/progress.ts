import type { Session, WorkoutSet } from '../db/types';
import { addDays, startOfWeek } from './time';

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

// ---- Personal records ----

export interface BestSet {
  weight: number;
  reps: number;
  /** When it was first achieved. */
  startedAt: number;
}

export interface ExercisePRs {
  /** Heaviest working set (most reps at that weight; earliest if tied). */
  heaviest: BestSet | null;
  /** Best reps at each weight, heaviest weight first. */
  repsAtWeight: BestSet[];
}

export function exercisePRs(sessions: Session[], exerciseId: string): ExercisePRs {
  const best = new Map<number, BestSet>();
  const ordered = sessions.filter((s) => s.status === 'finished').sort((a, b) => a.startedAt - b.startedAt);
  for (const s of ordered) {
    for (const item of s.exercises) {
      if (item.exerciseId !== exerciseId) continue;
      for (const set of item.sets) {
        if (!isWorkingSet(set)) continue;
        const current = best.get(set.weight);
        // Strictly more reps to count as a new record, so the first time it was done is kept.
        if (!current || set.reps > current.reps) {
          best.set(set.weight, { weight: set.weight, reps: set.reps, startedAt: s.startedAt });
        }
      }
    }
  }
  const repsAtWeight = [...best.values()].sort((a, b) => b.weight - a.weight);
  return { heaviest: repsAtWeight[0] ?? null, repsAtWeight };
}

// ---- Overall ----

export interface WeekCount {
  weekStart: number;
  sets: number;
}

/** Working sets per week (Monday–Sunday) for the last `weeks` weeks, oldest first, including empty weeks. */
export function weeklyWorkingSets(sessions: Session[], now: number, weeks = 12): WeekCount[] {
  const thisWeek = startOfWeek(now);
  const result: WeekCount[] = Array.from({ length: weeks }, (_, i) => ({
    weekStart: addDays(thisWeek, -7 * (weeks - 1 - i)),
    sets: 0,
  }));
  for (const s of sessions) {
    if (s.status !== 'finished') continue;
    const week = result.find((w) => w.weekStart === startOfWeek(s.startedAt));
    if (!week) continue;
    week.sets += s.exercises.reduce((n, e) => n + e.sets.filter(isWorkingSet).length, 0);
  }
  return result;
}

export interface SessionDuration {
  sessionId: string;
  startedAt: number;
  minutes: number;
}

/** Gym time of the most recent finished sessions (up to `limit`), oldest first. */
export function sessionDurations(sessions: Session[], limit = 20): SessionDuration[] {
  return sessions
    .filter((s) => s.status === 'finished' && s.endedAt !== null)
    .sort((a, b) => a.startedAt - b.startedAt)
    .slice(-limit)
    .map((s) => ({ sessionId: s.id, startedAt: s.startedAt, minutes: Math.round((s.endedAt! - s.startedAt) / 60000) }));
}

/** Round ticks for a minutes axis: 15-minute steps (30 for wide ranges), one step of headroom each side. */
export function minuteTicks(minutes: number[]): number[] {
  const lo = Math.min(...minutes);
  const hi = Math.max(...minutes);
  const step = hi - lo > 90 ? 30 : 15;
  const start = Math.max(0, Math.floor(lo / step) * step - (lo % step === 0 ? step : 0));
  const end = Math.ceil(hi / step) * step + (hi % step === 0 ? step : 0);
  const ticks = [];
  for (let t = start; t <= end; t += step) ticks.push(t);
  return ticks;
}
