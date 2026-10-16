import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import ExercisePicker from '../../components/ExercisePicker';
import NoteField from '../../components/NoteField';
import ScreenHeader from '../../components/ScreenHeader';
import { db } from '../../db/db';
import {
  addSessionExercise,
  discardSession,
  dropEmptyExercises,
  isLive,
  previousSetsFor,
  setSessionNote,
} from '../../db/sessions';
import { useSettings } from '../../db/settings';
import type { Exercise, RestGuidance, Session } from '../../db/types';
import { useGoBack } from '../../lib/nav';
import { clearRest, useRestTimer } from '../../lib/restTimer';
import { formatClock, formatDate, formatTime, isSameDay } from '../../lib/time';
import { useNow } from '../../lib/useNow';
import ExerciseCard from './ExerciseCard';
import FinishSheet from './FinishSheet';
import RestBar from './RestBar';
import TimesEditor from './TimesEditor';

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
  const editing = session.status === 'finished';
  const goBack = useGoBack(editing ? `/history/${session.id}` : '/');
  const [adding, setAdding] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const live = isLive(session);
  const restTimer = useRestTimer(session.id);
  const previous = useLiveQuery(
    () => previousSetsFor(session.exerciseIds, session),
    [session.id, session.startedAt, session.exerciseIds.join(',')],
  );

  async function add(exercise: Exercise) {
    setAdding(false);
    const itemId = await addSessionExercise(session.id, exercise.id);
    setTimeout(() => document.getElementById(`item-${itemId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  /** Leaving edit mode: tidy away any exercise left with no sets. */
  async function done() {
    await dropEmptyExercises(session.id);
    goBack();
  }

  function discard() {
    if (!window.confirm('Discard this workout? Anything logged in it will be deleted.')) return;
    navigate('/', { replace: true });
    clearRest(session.id);
    void discardSession(session.id);
  }

  return (
    <>
      <div className="workout-bar">
        {editing ? (
          <span />
        ) : (
          <button type="button" className="back" onClick={goBack}>
            ‹ Today
          </button>
        )}
        {live ? (
          <Elapsed since={session.startedAt} />
        ) : (
          <span className="workout-bar-date">{editing ? 'Editing' : formatDate(session.startedAt)}</span>
        )}
        {editing ? (
          <button type="button" className="btn btn-primary btn-finish" onClick={done}>
            Done
          </button>
        ) : (
          <button type="button" className="btn btn-primary btn-finish" onClick={() => setFinishing(true)}>
            {live ? 'Finish' : 'Save'}
          </button>
        )}
      </div>

      <h1 className="screen-title">{session.templateName ?? 'Blank workout'}</h1>
      <p className="muted intro">{sessionMeta(session)}</p>
      {editing && <TimesEditor session={session} />}

      <NoteField
        label="Session note"
        placeholder="Session note"
        value={session.note}
        onChange={(note) => setSessionNote(session.id, note)}
      />

      <div className="exercise-list">
        {session.exercises.map((item) => (
          <ExerciseCard
            key={item.id}
            sessionId={session.id}
            item={item}
            exercises={exercises}
            rest={rest}
            previous={previous?.get(item.exerciseId)}
            hints={session.status === 'active'}
            live={live}
          />
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
      {finishing && (
        <FinishSheet
          session={session}
          live={live}
          onClose={() => setFinishing(false)}
          onFinished={() => {
            clearRest(session.id);
            navigate(`/history/${session.id}`, { replace: true });
          }}
        />
      )}
      {/* Room for the rest bar is kept for the whole live workout, so closing the bar never shifts the page. */}
      {live && <div className="rest-spacer" />}
      {live && restTimer && <RestBar timer={restTimer} />}
    </>
  );
}

function sessionMeta(s: Session): string {
  if (isLive(s)) return `Today · started ${formatTime(s.startedAt)}`;
  if (s.status === 'active') return `Logging a past session · ${formatDate(s.startedAt)}`;
  return isSameDay(s.startedAt, Date.now()) ? 'Today' : formatDate(s.startedAt);
}

/** Running gym time. Its own component so only it re-renders every second. */
function Elapsed({ since }: { since: number }) {
  const now = useNow(1000);
  return (
    <span className="workout-bar-timer" role="timer" aria-label="Gym time">
      {formatClock(now - since)}
    </span>
  );
}
