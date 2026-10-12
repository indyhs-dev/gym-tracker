import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useParams } from 'react-router';
import Duration from '../../components/Duration';
import ScreenHeader from '../../components/ScreenHeader';
import { db } from '../../db/db';
import { discardSession } from '../../db/sessions';
import type { Exercise, Session } from '../../db/types';
import { exerciseMeta } from '../../lib/labels';
import { useGoBack } from '../../lib/nav';
import { setText } from '../../lib/setText';
import { formatDate, formatTime } from '../../lib/time';

const BACK = '/history';

export default function SessionDetail() {
  const { id = '' } = useParams();
  const session = useLiveQuery(async () => (await db.sessions.get(id)) ?? null, [id]);
  const exercises = useLiveQuery(async () => new Map((await db.exercises.toArray()).map((e) => [e.id, e])), []);

  if (session === undefined || !exercises) return <ScreenHeader title="" back={BACK} backLabel="History" />;
  if (session === null) {
    return (
      <>
        <ScreenHeader title="Not found" back={BACK} backLabel="History" />
        <p className="muted">This session no longer exists.</p>
      </>
    );
  }
  return <Detail session={session} exercises={exercises} />;
}

function Detail({ session, exercises }: { session: Session; exercises: Map<string, Exercise> }) {
  const goBack = useGoBack(BACK);

  function remove() {
    if (!window.confirm('Delete this session? This can’t be undone.')) return;
    goBack();
    void discardSession(session.id);
  }

  return (
    <>
      <ScreenHeader title={session.templateName ?? 'Blank workout'} back={BACK} backLabel="History" />
      <p className="muted intro">
        {formatDate(session.startedAt)} · {formatTime(session.startedAt)}
        {session.endedAt !== null && `–${formatTime(session.endedAt)}`}
      </p>

      <div className="card detail-summary">
        <div>
          <div className="stat-value">
            {session.endedAt !== null ? <Duration ms={session.endedAt - session.startedAt} /> : '–'}
          </div>
          <div className="stat-label">gym time</div>
        </div>
        <div>
          <div className="stat-value">{session.exercises.reduce((n, e) => n + e.sets.length, 0)}</div>
          <div className="stat-label">sets</div>
        </div>
      </div>

      {session.note && <p className="card detail-note">{session.note}</p>}

      {session.exercises.map((item) => {
        const exercise = exercises.get(item.exerciseId);
        let working = 0;
        return (
          <section key={item.id} className="card">
            <h2 className="exercise-name-static">{exercise?.name ?? 'Unknown exercise'}</h2>
            {exercise && <p className="row-meta">{exerciseMeta(exercise)}</p>}
            <ol className="detail-sets">
              {item.sets.map((set) => (
                <li key={set.id} className={set.warmup ? 'is-warmup' : undefined}>
                  <span className="set-label">{set.warmup ? 'W' : ++working}</span>
                  <span className="detail-set-value">{setText(set, exercise)}</span>
                  {set.note && <span className="detail-set-note">{set.note}</span>}
                </li>
              ))}
            </ol>
            {item.note && <p className="detail-note-inline">{item.note}</p>}
          </section>
        );
      })}

      <div className="danger-zone">
        <Link className="btn btn-primary btn-block" to={`/workout/${session.id}`}>
          Edit session
        </Link>
        <button type="button" className="btn btn-block btn-quiet" onClick={remove}>
          Delete session
        </button>
      </div>
    </>
  );
}
