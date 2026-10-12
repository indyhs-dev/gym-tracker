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
import { plural } from '../../lib/format';
import { newId } from '../../lib/ids';
import { targetLine } from '../../lib/labels';
import { restText } from '../../lib/rest';
import { formatDate } from '../../lib/time';
import SetRow from './SetRow';

interface Props {
  sessionId: string;
  item: SessionExercise;
  exercises: Map<string, Exercise>;
  rest: RestGuidance;
  /** The last session's sets for this exercise, shown as ghost rows. */
  previous?: PreviousSets;
}

export default function ExerciseCard({ sessionId, item, exercises, rest, previous }: Props) {
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
                  />
                );
              }),
            ]}
          </ol>
        </>
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
      {ghosts.length > 0 && (
        <button
          type="button"
          className="btn btn-block copy-previous"
          onClick={() =>
            addSets(
              sessionId,
              item.id,
              ghosts.map((g) => ({ weight: g.weight, reps: g.reps, warmup: g.warmup })),
            )
          }
        >
          Copy previous session’s sets ({ghosts.length})
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
