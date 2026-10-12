import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import ExercisePicker from '../../components/ExercisePicker';
import NoteField from '../../components/NoteField';
import ScreenHeader from '../../components/ScreenHeader';
import { db } from '../../db/db';
import { addSessionExercise, discardSession, setSessionNote } from '../../db/sessions';
import { useSettings } from '../../db/settings';
import type { Exercise, RestGuidance, Session } from '../../db/types';
import { formatDate, formatTime, isSameDay } from '../../lib/time';
import ExerciseCard from './ExerciseCard';

export default function WorkoutScreen() {
  const { id = '' } = useParams();
  const session = useLiveQuery(async () => (await db.sessions.get(id)) ?? null, [id]);
  const exercises = useLiveQuery(async () => new Map((await db.exercises.toArray()).map((e) => [e.id, e])), []);
  const settings = useSettings();

  if (session === undefined || !exercises || !settings) return <ScreenHeader title="" back="/" backLabel="Today" />;
  if (session === null) {
    return (
      <>
        <ScreenHeader title="Not found" back="/" backLabel="Today" />
        <p className="muted">This workout no longer exists.</p>
      </>
    );
  }
  return <Workout key={session.id} session={session} exercises={exercises} rest={settings.rest} />;
}

interface WorkoutProps {
  session: Session;
  exercises: Map<string, Exercise>;
  rest: RestGuidance;
}

function Workout({ session, exercises, rest }: WorkoutProps) {
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);

  async function add(exercise: Exercise) {
    setAdding(false);
    const itemId = await addSessionExercise(session.id, exercise.id);
    setTimeout(() => document.getElementById(`item-${itemId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  function discard() {
    if (!window.confirm('Discard this workout? Anything logged in it will be deleted.')) return;
    navigate('/', { replace: true });
    void discardSession(session.id);
  }

  return (
    <>
      <ScreenHeader title={session.templateName ?? 'Blank workout'} back="/" backLabel="Today" />
      <p className="muted intro">{sessionMeta(session)}</p>

      <NoteField
        label="Session note"
        placeholder="Session note"
        value={session.note}
        onChange={(note) => setSessionNote(session.id, note)}
      />

      <div className="exercise-list">
        {session.exercises.map((item) => (
          <ExerciseCard key={item.id} sessionId={session.id} item={item} exercises={exercises} rest={rest} />
        ))}
      </div>

      <button type="button" className="btn btn-block add-exercise" onClick={() => setAdding(true)}>
        + Add exercise
      </button>

      {session.status === 'active' && (
        <div className="danger-zone">
          <button type="button" className="btn btn-block btn-quiet" onClick={discard}>
            Discard workout
          </button>
        </div>
      )}

      {adding && <ExercisePicker title="Add exercise" onPick={add} onClose={() => setAdding(false)} />}
    </>
  );
}

function sessionMeta(s: Session): string {
  if (isSameDay(s.startedAt, Date.now())) return `Today · started ${formatTime(s.startedAt)}`;
  return formatDate(s.startedAt);
}
