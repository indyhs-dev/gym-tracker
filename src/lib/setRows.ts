import type { Exercise, SessionExercise, WorkoutSet } from '../db/types';
import { previousBeside } from './previous';

/**
 * One row of an exercise's set table: a logged set, or a pre-filled "ghost"
 * row (set null) that becomes a set once you type into it or tick it.
 */
export interface SetRowData {
  /** The set's id; for a ghost row, the id its set will get. */
  id: string;
  set: WorkoutSet | null;
  warmup: boolean;
  /** Shown inside empty inputs, and logged by ✓ when they're left empty. */
  placeholder: { weight: number | null; reps: number | null };
}

/**
 * How many working rows to show. During a workout (`prefill`) that's the
 * template's target (1 for an ad-hoc exercise) plus any added with
 * "+ Add set", and never fewer than the working sets already logged.
 * Otherwise (editing history) just the sets that were logged.
 */
export function workingRowCount(item: SessionExercise, prefill: boolean, extra: number): number {
  const logged = item.sets.filter((s) => !s.warmup).length;
  return prefill ? Math.max((item.slot?.targetSets ?? 1) + extra, logged) : logged;
}

/**
 * The rows for an exercise: logged sets in order, then ghost rows up to
 * `workingRows`. Placeholders are last time's matching set; a row past what
 * was done last time carries the weight of the row above it.
 */
export function setRows(
  item: SessionExercise,
  previous: WorkoutSet[] | undefined,
  workingRows: number,
  exercise: Pick<Exercise, 'bodyweight'> | undefined,
  ghostId: (position: number) => string,
): SetRowData[] {
  const logged = item.sets.filter((s) => !s.warmup).length;
  const ghosts = Math.max(0, workingRows - logged);
  const shapes = [...item.sets, ...Array.from({ length: ghosts }, () => ({ warmup: false }))];
  const beside = previousBeside(shapes, previous);
  let carried: number | null = exercise?.bodyweight ? 0 : null;

  return shapes.map((shape, i) => {
    const set = i < item.sets.length ? item.sets[i] : null;
    const last = beside[i];
    const placeholder = {
      weight: last?.weight ?? (shape.warmup ? null : carried),
      reps: last?.reps ?? null,
    };
    if (!shape.warmup) carried = set?.weight ?? placeholder.weight;
    return { id: set?.id ?? ghostId(i), set, warmup: shape.warmup, placeholder };
  });
}

/** What ✓ logs: typed values, with any empty field taken from the placeholder. */
export function rowValues(row: SetRowData): { weight: number | null; reps: number | null } {
  return { weight: row.set?.weight ?? row.placeholder.weight, reps: row.set?.reps ?? row.placeholder.reps };
}

/**
 * Whether a row counts as done. While a session is in progress (live or
 * logging a past one) that's ticked ✓, so typing never moves you on; when
 * editing a finished session, it's having reps entered.
 */
export function isRowDone(row: SetRowData, inProgress: boolean, doneIds: readonly string[]): boolean {
  return inProgress ? doneIds.includes(row.id) : row.set?.reps != null;
}
