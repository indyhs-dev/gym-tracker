import { CheckIcon, ChevronIcon } from '../../components/Icons';
import type { Exercise, SessionExercise } from '../../db/types';
import { plural } from '../../lib/format';
import { setsReps } from '../../lib/labels';
import { topSet } from '../../lib/progression';
import { weightText } from '../../lib/setText';

interface Props {
  item: SessionExercise;
  exercise: Exercise | undefined;
  /** Every row done: a green tick and the top set. */
  complete: boolean;
  workingDone: number;
  workingTotal: number;
  /** Today's sets earned a step up, e.g. "↑ Go to 35 kg next time". */
  goUp?: string | null;
  onOpen: () => void;
}

/**
 * An exercise that isn't open, as one tappable row. Done: tick, name and top
 * set ("32.5 × 12"), plus "↑ Go to 35 kg next time" if set 1 hit the top of
 * the range. Not done: name and the target ("2 × 5–12"), or how far you got
 * if it was left part-way.
 */
export default function ExerciseRow({ item, exercise, complete, workingDone, workingTotal, goUp, onOpen }: Props) {
  const name = exercise?.name ?? 'Unknown exercise';
  const top = topSet(item.sets);
  const detail = complete
    ? top
      ? `${weightText(top.weight, exercise)} × ${top.reps}`
      : plural(item.sets.length, 'set')
    : workingDone > 0
      ? `${workingDone} of ${workingTotal} sets`
      : item.slot
        ? setsReps(item.slot)
        : plural(workingTotal, 'set');

  return (
    <button
      type="button"
      className={complete ? 'exercise-row is-complete' : 'exercise-row'}
      id={`item-${item.id}`}
      aria-expanded={false}
      onClick={onOpen}
    >
      {complete && (
        <span className="exercise-row-tick">
          <CheckIcon />
          <span className="visually-hidden">Done:</span>
        </span>
      )}
      <span className="exercise-row-name">
        {name}
        {goUp && <span className="exercise-row-goup">{goUp}</span>}
      </span>
      <span className="exercise-row-detail">{detail}</span>
      {!complete && <ChevronIcon />}
    </button>
  );
}
