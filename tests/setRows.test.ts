import { describe, expect, it } from 'vitest';
import { newSet } from '../src/db/sessions';
import type { SessionExercise, TemplateSlot } from '../src/db/types';
import { isRowDone, rowValues, setRows, workingRowCount } from '../src/lib/setRows';

const set = (weight: number | null, reps: number | null, warmup = false) => newSet({ weight, reps, warmup }, 0);
const slot = (targetSets: number): TemplateSlot => ({
  id: 's',
  exerciseId: 'bench',
  alternativeIds: [],
  targetSets,
  repMin: 8,
  repMax: 12,
  warmup: 'full',
  planNote: '',
});
const item = (sets: SessionExercise['sets'], targetSets: number | null = 2): SessionExercise => ({
  id: 'i',
  exerciseId: 'bench',
  slot: targetSets === null ? null : slot(targetSets),
  note: '',
  sets,
});
let n = 0;
const ghostId = () => `ghost-${++n}`;
const show = (rows: ReturnType<typeof setRows>) =>
  rows.map((r) => `${r.set ? 'set' : 'ghost'} ${r.placeholder.weight ?? '–'}×${r.placeholder.reps ?? '–'}`);

describe('workingRowCount', () => {
  it('fills to the target during a workout, plus added rows, never below what was logged', () => {
    expect(workingRowCount(item([]), true, 0)).toBe(2);
    expect(workingRowCount(item([]), true, 1)).toBe(3);
    expect(workingRowCount(item([set(20, 8), set(20, 8), set(20, 6)]), true, 0)).toBe(3);
    // Warm-ups don't use up the target.
    expect(workingRowCount(item([set(10, 10, true), set(20, 8)]), true, 0)).toBe(2);
    // Ad-hoc exercise: one row to start.
    expect(workingRowCount(item([], null), true, 0)).toBe(1);
    // Editing history: just what was logged.
    expect(workingRowCount(item([set(20, 8)]), false, 0)).toBe(1);
  });
});

describe('setRows', () => {
  const last = [set(15, 10, true), set(22.5, 12), set(22.5, 10)];

  it('pre-fills ghost rows after the logged sets, with last time as placeholders', () => {
    const rows = setRows(item([set(22.5, 11)]), last, 3, { bodyweight: false }, ghostId);
    expect(show(rows)).toEqual(['set 22.5×12', 'ghost 22.5×10', 'ghost 22.5×–']);
    expect(rows[1].id).toMatch(/^ghost-/);
  });

  it('a row past last time carries the weight of the row above, typed or placeholder', () => {
    const rows = setRows(item([set(25, null)]), [set(22.5, 12)], 3, { bodyweight: false }, ghostId);
    expect(show(rows)).toEqual(['set 22.5×12', 'ghost 25×–', 'ghost 25×–']);
  });

  it('warm-ups line up with last time’s warm-ups', () => {
    const rows = setRows(item([set(null, null, true)]), last, 2, { bodyweight: false }, ghostId);
    expect(show(rows)).toEqual(['set 15×10', 'ghost 22.5×12', 'ghost 22.5×10']);
    expect(rows.map((r) => r.warmup)).toEqual([true, false, false]);
  });

  it('bodyweight with no history: 0 kg added', () => {
    expect(show(setRows(item([]), undefined, 2, { bodyweight: true }, ghostId))).toEqual(['ghost 0×–', 'ghost 0×–']);
    expect(show(setRows(item([]), undefined, 1, { bodyweight: false }, ghostId))).toEqual(['ghost –×–']);
  });
});

describe('rowValues and isRowDone', () => {
  it('typed values win, empty ones come from the placeholder', () => {
    const [typed, ghost] = setRows(item([set(25, null)]), [set(22.5, 12), set(22.5, 10)], 2, { bodyweight: false }, ghostId);
    expect(rowValues(typed)).toEqual({ weight: 25, reps: 12 });
    expect(rowValues(ghost)).toEqual({ weight: 22.5, reps: 10 });
  });

  it('done is ticked during a session, reps entered when editing one', () => {
    const [withReps, ghost] = setRows(item([set(20, 8)]), undefined, 2, { bodyweight: false }, ghostId);
    expect(isRowDone(withReps, true, [])).toBe(false);
    expect(isRowDone(withReps, true, [withReps.id])).toBe(true);
    expect(isRowDone(ghost, true, [ghost.id])).toBe(true); // ticked while its set is still being saved
    expect(isRowDone(withReps, false, [])).toBe(true);
    expect(isRowDone(ghost, false, [])).toBe(false);
  });
});
