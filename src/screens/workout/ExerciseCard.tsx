import { useState } from 'react';
import ExercisePicker from '../../components/ExercisePicker';
import NoteField from '../../components/NoteField';
import {
  addSet,
  deleteSet,
  removeSessionExercise,
  setExerciseNote,
  swapExercise,
  updateSet,
} from '../../db/sessions';
import type { Exercise, RestGuidance, SessionExercise } from '../../db/types';
import { plural } from '../../lib/format';
import { targetLine } from '../../lib/labels';
import { restText } from '../../lib/rest';
import SetRow from './SetRow';

interface Props {
  sessionId: string;
  item: SessionExercise;
  exercises: Map<string, Exercise>;
  rest: RestGuidance;
}

export default function ExerciseCard({ sessionId, item, exercises, rest }: Props) {
  const [swapping, setSwapping] = useState(false);
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

  let working = 0;
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

      {exercise && item.sets.length > 0 && (
        <>
          <div className="set-head" aria-hidden="true">
            <span>{weightLabel}</span>
            <span>reps</span>
          </div>
          <ol className="set-list">
            {item.sets.map((set) => (
              <SetRow
                key={set.id}
                set={set}
                weightUnit={weightLabel}
                label={set.warmup ? 'W' : String(++working)}
                exercise={exercise}
                onChange={(fields) => updateSet(sessionId, item.id, set.id, fields)}
                onDelete={() => deleteSet(sessionId, item.id, set.id)}
              />
            ))}
          </ol>
        </>
      )}

      <button type="button" className="btn btn-block add-set" onClick={() => addSet(sessionId, item.id)}>
        + Add set
      </button>

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
