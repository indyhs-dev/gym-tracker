import type { Exercise, RestGuidance, SessionExercise } from '../../db/types';
import { targetLine } from '../../lib/labels';
import { restText } from '../../lib/rest';

interface Props {
  item: SessionExercise;
  exercise: Exercise | undefined;
  rest: RestGuidance;
}

export default function ExerciseCard({ item, exercise, rest }: Props) {
  const slot = item.slot;
  return (
    <article className="card exercise-card">
      <h2 className="exercise-name">{exercise?.name ?? 'Unknown exercise'}</h2>
      {exercise && slot && <p className="exercise-target">{targetLine(slot, exercise.type)}</p>}
      {exercise && <p className="exercise-rest">{restText(exercise.type, slot?.warmup ?? null, rest)}</p>}
      {slot?.planNote && <p className="exercise-plan">{slot.planNote}</p>}
    </article>
  );
}
