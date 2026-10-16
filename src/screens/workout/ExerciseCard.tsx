import { useRef, useState } from 'react';
import ExercisePicker from '../../components/ExercisePicker';
import NoteField from '../../components/NoteField';
import {
  addSet,
  addSets,
  deleteSet,
  removeSessionExercise,
  setExerciseNote,
  swapExercise,
  updateSet,
  type PreviousSets,
  type SetFields,
} from '../../db/sessions';
import type { Exercise, RestGuidance, SessionExercise, WorkoutSet } from '../../db/types';
import { formatKg, plural } from '../../lib/format';
import { newId } from '../../lib/ids';
import { targetLine } from '../../lib/labels';
import { compareTopSets, progressionHint, topSet, type TopSet } from '../../lib/progression';
import { restAfter, restText } from '../../lib/rest';
import { startRest, useDoneSets } from '../../lib/restTimer';
import { weightText } from '../../lib/setText';
import { formatDate } from '../../lib/time';
import { warmupSuggestions, workWeightFor } from '../../lib/warmup';
import SetRow from './SetRow';

interface Props {
  sessionId: string;
  item: SessionExercise;
  exercises: Map<string, Exercise>;
  rest: RestGuidance;
  /** The last session's sets for this exercise, shown as ghost rows. */
  previous?: PreviousSets;
  /** Show training hints (warm-ups, progression): during a workout, not when editing history. */
  hints?: boolean;
  /** A workout happening now: sets get a ✓ that starts the rest timer. */
  live?: boolean;
}

export default function ExerciseCard({ sessionId, item, exercises, rest, previous, hints = false, live = false }: Props) {
  const [swapping, setSwapping] = useState(false);
  // Each ghost position has a ready-made set id, so a ghost row keeps its
  // identity (and keyboard focus) when typing turns it into a real set.
  const ghostIds = useRef<string[]>([]);
  const logging = useRef(new Set<string>());
  const exercise = exercises.get(item.exerciseId);
  const slot = item.slot;

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
    const name = exercise?.name ?? 'this exercise';
    const n = item.sets.length;
    const msg = n > 0 ? `Remove ${name} and its ${plural(n, 'set')} from this workout?` : `Remove ${name} from this workout?`;
    if (window.confirm(msg)) void removeSessionExercise(sessionId, item.id);
  }

  const doneIds = useDoneSets(sessionId);

  /** ✓ on a set: tick it, put the keyboard away and start resting. */
  function setDone(setId: string, warmupSet: boolean) {
    if (!exercise) return;
    const { text, range } = restAfter(exercise.type, warmupSet, rest);
    startRest(sessionId, setId, text, range);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }

  const ghosts = (previous?.sets ?? []).slice(item.sets.length);
  const ghostId = (position: number) => (ghostIds.current[position] ??= newId());

  function logGhost(position: number, ghost: WorkoutSet, fields: Partial<SetFields>) {
    const id = ghostId(position);
    // Further keystrokes before the new set has arrived update it instead of adding another.
    if (logging.current.has(id)) {
      void updateSet(sessionId, item.id, id, fields);
      return;
    }
    logging.current.add(id);
    void addSet(sessionId, item.id, { weight: ghost.weight, reps: ghost.reps, warmup: ghost.warmup, ...fields }, id).finally(
      () => {
        logging.current.delete(id);
        ghostIds.current[position] = newId();
      },
    );
  }

  // Warm-up helper: template exercises with a warm-up policy, not bodyweight.
  const work = hints && exercise && slot && !exercise.bodyweight ? workWeightFor(item.sets, previous?.sets) : null;
  const warmups = work && exercise && slot ? warmupSuggestions(slot.warmup, exercise.type, work.weight, exercise.weightStep) : [];

  // Progression hint (from last time's set 1) and today's top set vs last time's.
  const progression =
    hints && exercise && slot ? progressionHint(previous?.sets, slot.repMax, exercise.weightStep) : null;
  const todayTop = hints ? topSet(item.sets) : null;
  const lastTop = topSet(previous?.sets);
  const comparison = todayTop && lastTop ? compareTopSets(todayTop, lastTop) : null;
  const kgUnit = exercise?.perHand ? 'kg each' : 'kg';
  const showSet = (t: TopSet) => `${weightText(t.weight, exercise)} × ${t.reps}`;

  const lastSet = item.sets.at(-1);
  let working = 0;
  const label = (warmup: boolean) => (warmup ? 'W' : String(++working));
  const weightLabel = exercise?.bodyweight ? '+kg' : exercise?.perHand ? 'kg each' : 'kg';

  return (
    <article className="card exercise-card" id={`item-${item.id}`}>
      <button type="button" className="exercise-name" onClick={() => setSwapping(true)}>
        <span>{exercise?.name ?? 'Unknown exercise'}</span>
        <span className="swap-hint" aria-hidden="true">
          ⇄
        </span>
      </button>
      {exercise && slot && <p className="exercise-target">{targetLine(slot, exercise.type)}</p>}
      {exercise && <p className="exercise-rest">{restText(exercise.type, slot?.warmup ?? null, rest)}</p>}
      {slot?.planNote && <p className="exercise-plan">{slot.planNote}</p>}
      {work && warmups.length > 0 && (
        <div className="hint warmup-hint">
          <span className="hint-title">
            Warm-up · from {formatKg(work.weight)} {work.source === 'today' ? 'today' : 'last time'}
          </span>
          <span className="warmup-steps">
            {warmups.map((w) => (
              <span key={w.weight} className="warmup-step">
                <strong>{formatKg(w.weight)}</strong> × {w.reps}
              </span>
            ))}
          </span>
        </div>
      )}

      {progression && slot && (
        <div className="hint progression-hint">
          <span className="hint-title">Go up</span>
          <span>
            Last time set 1 hit {progression.reps} reps (top of {slot.repMin}–{slot.repMax}). If your form was good,{' '}
            {progression.weight === 0 ? (
              <>
                try adding <strong>{formatKg(progression.low)} kg</strong>.
              </>
            ) : (
              <>
                try{' '}
                <strong>
                  {formatKg(progression.low)}
                  {progression.high > progression.low && `–${formatKg(progression.high)}`} {kgUnit}
                </strong>{' '}
                (+5–10%).
              </>
            )}
          </span>
        </div>
      )}

      {previous && <p className="last-time">Last time · {formatDate(previous.startedAt)}</p>}

      {exercise && item.sets.length + ghosts.length > 0 && (
        <>
          <div className="set-head" aria-hidden="true">
            <span>{weightLabel}</span>
            <span>reps</span>
          </div>
          {/* One list, so a ghost row and the set it becomes are the same element (keeps focus). */}
          <ol className="set-list">
            {[
              ...item.sets.map((set) => (
                <SetRow
                  key={set.id}
                  set={set}
                  weightUnit={weightLabel}
                  label={label(set.warmup)}
                  exercise={exercise}
                  onChange={(fields) => updateSet(sessionId, item.id, set.id, fields)}
                  onDelete={() => deleteSet(sessionId, item.id, set.id)}
                  onDone={live ? () => setDone(set.id, set.warmup) : undefined}
                  done={doneIds.includes(set.id)}
                />
              )),
              ...ghosts.map((ghost, i) => {
                const position = item.sets.length + i;
                return (
                  <SetRow
                    key={ghostId(position)}
                    ghost={ghost}
                    weightUnit={weightLabel}
                    label={label(ghost.warmup)}
                    exercise={exercise}
                    onChange={(fields) => logGhost(position, ghost, fields)}
                    onDone={
                      live
                        ? () => {
                            const id = ghostId(position);
                            logGhost(position, ghost, {});
                            setDone(id, ghost.warmup);
                          }
                        : undefined
                    }
                  />
                );
              }),
            ]}
          </ol>
        </>
      )}

      {comparison && todayTop && lastTop && (
        <p className={`top-set-compare is-${comparison}`} role="status">
          {comparison === 'beat' && <>↑ Top set {showSet(todayTop)} beats last time ({showSet(lastTop)})</>}
          {comparison === 'matched' && <>= Top set matches last time ({showSet(lastTop)})</>}
          {comparison === 'below' && (
            <>
              Top set {showSet(todayTop)} · not yet past last time ({showSet(lastTop)})
            </>
          )}
        </p>
      )}

      <div className="set-actions">
        <button type="button" className="btn" onClick={() => addSet(sessionId, item.id)}>
          + Add set
        </button>
        <button
          type="button"
          className="btn"
          disabled={!lastSet}
          onClick={() => lastSet && addSet(sessionId, item.id, { weight: lastSet.weight, reps: lastSet.reps })}
        >
          Copy last set
        </button>
      </div>
      {/* Stays in place (disabled) once every ghost is logged: if it vanished, the card would
          shrink and, scrolled to the bottom, slide the page so the next tap on reps + hit ✕. */}
      {previous && (
        <button
          type="button"
          className="btn btn-block copy-previous"
          disabled={ghosts.length === 0}
          onClick={() =>
            addSets(
              sessionId,
              item.id,
              ghosts.map((g) => ({ weight: g.weight, reps: g.reps, warmup: g.warmup })),
            )
          }
        >
          {ghosts.length > 0 ? `Copy previous session’s sets (${ghosts.length})` : 'Previous session’s sets all logged'}
        </button>
      )}

      <NoteField
        label={`Note for ${exercise?.name ?? 'exercise'}`}
        placeholder="Exercise note"
        value={item.note}
        onChange={(note) => setExerciseNote(sessionId, item.id, note)}
      />

      <button type="button" className="btn btn-block btn-quiet btn-small" onClick={remove}>
        Remove exercise
      </button>

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
