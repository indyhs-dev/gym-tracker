import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router';
import ScreenHeader from '../../components/ScreenHeader';
import { db } from '../../db/db';
import { discardSession } from '../../db/sessions';
import { useSettings } from '../../db/settings';
import type { Session } from '../../db/types';
import { formatDate, formatTime, isSameDay } from '../../lib/time';
import ExerciseCard from './ExerciseCard';

export default function WorkoutScreen() {
  const { id = '' } = useParams();
  const session = useLiveQuery(async () => (await db.sessions.get(id)) ?? null, [id]);
  const exercises = useLiveQuery(async () => new Map((await db.exercises.toArray()).map((e) => [e.id, e])), []);
  const settings = useSettings();
  const navigate = useNavigate();

  if (session === undefined || !exercises || !settings) return <ScreenHeader title="" back="/" backLabel="Today" />;
  if (session === null) {
    return (
      <>
        <ScreenHeader title="Not found" back="/" backLabel="Today" />
        <p className="muted">This workout no longer exists.</p>
      </>
    );
  }

  function discard() {
    if (!window.confirm('Discard this workout? Anything logged in it will be deleted.')) return;
    navigate('/', { replace: true });
    void discardSession(id);
  }

  return (
    <>
      <ScreenHeader title={session.templateName ?? 'Blank workout'} back="/" backLabel="Today" />
      <p className="muted intro">{sessionMeta(session)}</p>

      {session.exercises.length === 0 && <p className="empty">No exercises yet.</p>}
      <div className="exercise-list">
        {session.exercises.map((item) => (
          <ExerciseCard key={item.id} item={item} exercise={exercises.get(item.exerciseId)} rest={settings.rest} />
        ))}
      </div>

      {session.status === 'active' && (
        <div className="danger-zone">
          <button type="button" className="btn btn-block btn-quiet" onClick={discard}>
            Discard workout
          </button>
        </div>
      )}
    </>
  );
}

function sessionMeta(s: Session): string {
  if (isSameDay(s.startedAt, Date.now())) return `Today · started ${formatTime(s.startedAt)}`;
  return formatDate(s.startedAt);
}
