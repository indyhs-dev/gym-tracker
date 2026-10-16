import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router';
import SectionHeader from '../../components/SectionHeader';
import { db } from '../../db/db';
import { finishedSessions } from '../../db/sessions';
import type { Exercise, Session } from '../../db/types';
import { formatDate, formatDuration } from '../../lib/time';

export default function History() {
  const sessions = useLiveQuery(finishedSessions, []);
  const exercises = useLiveQuery(async () => new Map((await db.exercises.toArray()).map((e) => [e.id, e])), []);

  return (
    <>
      <SectionHeader section="gym" />
      {sessions && sessions.length === 0 && <p className="empty">No sessions yet.</p>}
      {sessions &&
        exercises &&
        groupByMonth(sessions).map(([month, list]) => (
          <section key={month} className="history-month">
            <h2 className="field-label">{month}</h2>
            <ul className="list">
              {list.map((s) => (
                <li key={s.id}>
                  <HistoryRow session={s} exercises={exercises} />
                </li>
              ))}
            </ul>
          </section>
        ))}
    </>
  );
}

function HistoryRow({ session, exercises }: { session: Session; exercises: Map<string, Exercise> }) {
  const names = session.exercises.map((e) => exercises.get(e.exerciseId)?.name ?? 'Unknown exercise');
  return (
    <Link className="list-row history-row" to={`/history/${session.id}`}>
      <span className="row-text">
        <span className="history-date">{formatDate(session.startedAt)}</span>
        <span className="row-title">{session.templateName ?? 'Blank workout'}</span>
        {names.length > 0 && <span className="row-meta history-exercises">{names.join(', ')}</span>}
      </span>
      <span className="history-duration">
        {session.endedAt !== null ? formatDuration(session.endedAt - session.startedAt) : ''}
      </span>
    </Link>
  );
}

function groupByMonth(sessions: Session[]): [string, Session[]][] {
  const groups = new Map<string, Session[]>();
  for (const s of sessions) {
    const month = new Date(s.startedAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    groups.set(month, [...(groups.get(month) ?? []), s]);
  }
  return [...groups];
}
