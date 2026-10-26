import { useState } from 'react';
import { flushSync } from 'react-dom';
import ActionSheet from '../../components/ActionSheet';
import ExercisePicker from '../../components/ExercisePicker';
import { MoreIcon, StopwatchIcon } from '../../components/Icons';
import NoteField from '../../components/NoteField';
import {
  addSets,
  deleteSet,
  removeSessionExercise,
  setExerciseNote,
  swapExercise,
  updateSet,
  type SetFields,
} from '../../db/sessions';
import type { Exercise, RestGuidance, SessionExercise, WorkoutSet } from '../../db/types';
import { formatKg, joinUnbroken, plural } from '../../lib/format';
import { setsReps } from '../../lib/labels';
import { goUpWeight, progressionHint } from '../../lib/progression';
import { restAfter } from '../../lib/rest';
import { startRest, startWarmupRest, tickSet } from '../../lib/restTimer';
import { rowValues, type SetRowData } from '../../lib/setRows';
import { unlockSound } from '../../lib/sound';
import SetRow, { repsInputId, weightInputId } from './SetRow';

/** Remembers which pre-filled rows have been sent to the database, so fast typing never adds a set twice. */
export interface GhostLog {
  isLogged: (id: string) => boolean;
  markLogged: (ids: string[]) => void;
}

interface Props {
  sessionId: string;
  item: SessionExercise;
  exercises: Map<string, Exercise>;
  rest: RestGuidance;
  rows: SetRowData[];
  /** Per row: done (ticked during a session, reps entered when editing one). */
  done: boolean[];
  /** Last session's sets for this exercise, for the "Go up" hint. */
  previous?: WorkoutSet[];
  /** Session still in progress (live or logging a past one): rows get a ✓ and hints show. */
  active: boolean;
  /** A workout happening now: ✓ starts the rest timer, and there's a Warm-up rest button. */
  live: boolean;
  /** The exercise you're on (has sets left): accent border. */
  current: boolean;
  ghosts: GhostLog;
  onAddSet: () => void;
}

/**
 * The open exercise in a workout: name, small print, then the sets as a
 * table pre-filled to the template's target. Last time's numbers sit in the
 * inputs as placeholders, and ✓ on an empty row logs them.
 */
export default function ExerciseCard({
  sessionId,
  item,
  exercises,
  rest,
  rows,
  done,
  previous,
  active,
  live,
  current,
  ghosts,
  onAddSet,
}: Props) {
  const [menu, setMenu] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [noteOpen, setNoteOpen] = useState(item.note !== '');
  const exercise = exercises.get(item.exerciseId);
  const name = exercise?.name ?? 'Unknown exercise';
  const slot = item.slot;
  const noteId = `exercise-note-${item.id}`;

  // The slot's default and alternatives come first in the swap list.
  const suggested = slot
    ? [slot.exerciseId, ...slot.alternativeIds]
        .filter((id) => id !== item.exerciseId)
        .map((id) => exercises.get(id))
        .filter((e): e is Exercise => e !== undefined)
    : [];

  function swap(next: Exercise) {
    setSwapping(false);
    const n = item.sets.length;
    if (n > 0 && !window.confirm(`Move ${plural(n, 'set')} to ${next.name}?`)) return;
    void swapExercise(sessionId, item.id, next.id);
  }

  function remove() {
    const n = item.sets.length;
    if (n > 0 && !window.confirm(`Remove ${name} and its ${plural(n, 'set')} from this workout?`)) return;
    void removeSessionExercise(sessionId, item.id);
  }

  /** Shows the note field and focuses it inside the same tap, so iOS brings up the keyboard. */
  function openNote() {
    flushSync(() => setNoteOpen(true));
    document.getElementById(noteId)?.focus();
  }

  /**
   * Saves a change to a row. A pre-filled row becomes a set on its first
   * keystroke, keeping its id so the input keeps focus; any pre-filled rows
   * above it are added (empty) first, so the order stays as shown.
   */
  function write(index: number, fields: Partial<SetFields>) {
    const row = rows[index];
    if (row.set || ghosts.isLogged(row.id)) {
      void updateSet(sessionId, item.id, row.id, fields);
      return;
    }
    const batch = rows.slice(0, index + 1).filter((r) => !r.set && !ghosts.isLogged(r.id));
    ghosts.markLogged(batch.map((r) => r.id));
    void addSets(
      sessionId,
      item.id,
      batch.map((r) => (r.id === row.id ? { id: r.id, ...fields } : { id: r.id })),
    );
  }

  /** ✓: logs the row (placeholders fill any empty input), puts the keyboard away and starts resting. */
  function tick(index: number) {
    const row = rows[index];
    const values = rowValues(row);
    const missing = values.weight === null ? weightInputId(row.id) : values.reps === null ? repsInputId(row.id) : null;
    if (missing) {
      document.getElementById(missing)?.focus();
      return;
    }
    const fill: Partial<SetFields> = {};
    if (row.set?.weight == null) fill.weight = values.weight;
    if (row.set?.reps == null) fill.reps = values.reps;
    if (Object.keys(fill).length > 0) write(index, fill);
    if (live && exercise) {
      unlockSound();
      const { text, range } = restAfter(exercise.type, row.warmup, rest);
      startRest(sessionId, row.id, text, range);
    } else {
      tickSet(sessionId, row.id);
    }
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }

  /** Warm-up button: a rest using the warm-up guidance. Logs nothing, and can be tapped after each warm-up. */
  function warmupRest() {
    unlockSound();
    const { text, range } = restAfter(exercise?.type ?? 'isolation', true, rest);
    startWarmupRest(sessionId, text, range);
  }

  const restGuide = exercise && rest[exercise.type];
  const meta = joinUnbroken([slot ? setsReps(slot) : '', restGuide ? `${restGuide} rest` : ''].filter(Boolean), ' · ');

  // "Go up": last time's set 1 reached the top of the range.
  const progression = active && exercise && slot ? progressionHint(previous, slot.repMax, exercise.weightStep) : null;
  const goUp = !progression
    ? null
    : progression.weight === 0
      ? `↑ Add ${formatKg(progression.low)} kg today`
      : `↑ Try ${goUpWeight(progression, exercise?.bodyweight ?? false)} today`;

  const next = done.indexOf(false);
  let working = 0;
  const label = (warmup: boolean) => (warmup ? 'W' : String(++working));
  const weightLabel = exercise?.bodyweight ? '+kg' : exercise?.perHand ? 'kg each' : 'kg';

  return (
    <article className={current ? 'exercise-card is-current' : 'exercise-card'} id={`item-${item.id}`}>
      {/* The small print runs the full width under the name and buttons, so it never squeezes onto two lines. */}
      <div className="exercise-head">
        <h2 className="exercise-name">{name}</h2>
        <div className="exercise-actions">
          {live && (
            <button type="button" className="warmup-button" aria-label="Start warm-up rest timer" onClick={warmupRest}>
              <StopwatchIcon />
              Warm-up
            </button>
          )}
          <button type="button" className="exercise-more" aria-label={`${name} options`} onClick={() => setMenu(true)}>
            <MoreIcon />
          </button>
        </div>
        {meta && <p className="exercise-meta">{meta}</p>}
        {goUp && <p className="progression-hint">{goUp}</p>}
      </div>
      {slot?.planNote && <p className="exercise-plan">{slot.planNote}</p>}
      {noteOpen && (
        <NoteField
          id={noteId}
          label={`Note for ${name}`}
          placeholder="Exercise note"
          value={item.note}
          onChange={(note) => setExerciseNote(sessionId, item.id, note)}
        />
      )}

      {exercise && rows.length > 0 && (
        <div className={active ? 'set-table has-done' : 'set-table'}>
          <div className="set-head" aria-hidden="true">
            <span>Set</span>
            <span>{weightLabel}</span>
            <span>Reps</span>
          </div>
          <ol className="set-list">
            {rows.map((row, i) => (
              <SetRow
                key={row.id}
                row={row}
                label={label(row.warmup)}
                onChange={(fields) => write(i, fields)}
                onDelete={() => deleteSet(sessionId, item.id, row.id)}
                onDone={active ? () => tick(i) : undefined}
                done={done[i]}
                next={active && i === next}
              />
            ))}
          </ol>
        </div>
      )}

      <button type="button" className="add-set" onClick={onAddSet}>
        + Add set
      </button>

      {menu && (
        <ActionSheet
          title={name}
          onClose={() => setMenu(false)}
          actions={[
            { label: 'Swap exercise', onSelect: () => setSwapping(true) },
            ...(noteOpen ? [] : [{ label: 'Add note', onSelect: openNote }]),
            { label: 'Remove exercise', danger: true, onSelect: remove },
          ]}
        />
      )}
      {swapping && (
        <ExercisePicker
          title="Swap exercise"
          suggested={suggested}
          excludeIds={[item.exerciseId]}
          onPick={swap}
          onClose={() => setSwapping(false)}
        />
      )}
    </article>
  );
}
