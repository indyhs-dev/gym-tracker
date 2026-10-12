import { useLiveQuery } from 'dexie-react-hooks';
import { useLocation, useParams } from 'react-router';
import ExerciseForm, { draftFrom } from '../../components/ExerciseForm';
import ScreenHeader from '../../components/ScreenHeader';
import { db } from '../../db/db';
import { createExercise, deleteExercise, exerciseUsage, updateExercise } from '../../db/exercises';
import { plural } from '../../lib/format';
import { useGoBack } from '../../lib/nav';

const BACK = '/settings/exercises';

export default function ExerciseEditor() {
  const { id } = useParams();
  return id ? <EditExercise id={id} /> : <NewExercise />;
}

function NewExercise() {
  const location = useLocation();
  const goBack = useGoBack(BACK);
  const name = (location.state as { name?: string } | null)?.name ?? '';

  return (
    <>
      <ScreenHeader title="New exercise" back={BACK} backLabel="Exercises" />
      <ExerciseForm
        initial={draftFrom(undefined, name)}
        submitLabel="Add to library"
        autoFocusName={!name}
        onSubmit={async (input) => {
          await createExercise(input);
          goBack();
        }}
      />
    </>
  );
}

function EditExercise({ id }: { id: string }) {
  const goBack = useGoBack(BACK);
  const exercise = useLiveQuery(async () => (await db.exercises.get(id)) ?? null, [id]);
  const usage = useLiveQuery(() => exerciseUsage(id), [id]);

  if (exercise === undefined) return <ScreenHeader title="" back={BACK} backLabel="Exercises" />;
  if (exercise === null) {
    return (
      <>
        <ScreenHeader title="Not found" back={BACK} backLabel="Exercises" />
        <p className="muted">This exercise no longer exists.</p>
      </>
    );
  }

  const used = usage && (usage.templates > 0 || usage.sessions > 0);

  function remove() {
    if (!exercise || !window.confirm(`Delete “${exercise.name}”?`)) return;
    // Leave first so this screen doesn't flash "Not found" once the record is gone.
    goBack();
    deleteExercise(exercise.id).catch((err: Error) => window.alert(err.message));
  }

  return (
    <>
      <ScreenHeader title={exercise.name} back={BACK} backLabel="Exercises" />
      <ExerciseForm
        key={exercise.id}
        initial={draftFrom(exercise)}
        submitLabel="Save"
        onSubmit={async (input) => {
          await updateExercise(exercise.id, input);
          goBack();
        }}
      >
        {usage && !used && (
          <button type="button" className="btn btn-block btn-quiet" onClick={remove}>
            Delete exercise
          </button>
        )}
        {used && (
          <p className="form-note">
            Used in {plural(usage.templates, 'template')} and {plural(usage.sessions, 'session')}, so it can’t be deleted.
          </p>
        )}
      </ExerciseForm>
    </>
  );
}
