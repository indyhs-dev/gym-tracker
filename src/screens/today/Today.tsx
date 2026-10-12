import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link } from 'react-router';
import Duration from '../../components/Duration';
import { db } from '../../db/db';
import { getActiveSession, lastFinishedSession, loadWeekStats } from '../../db/sessions';
import { useSettings } from '../../db/settings';
import { needsBackupReminder } from '../../lib/export';
import type { Exercise, Session } from '../../db/types';
import { formatDate, formatDuration, formatLongDate, formatTime, isSameDay } from '../../lib/time';
import StartSheet from './StartSheet';

export default function Today() {
  const active = useLiveQuery(async () => (await getActiveSession()) ?? null, []);
  const last = useLiveQuery(async () => (await lastFinishedSession()) ?? null, []);
  const week = useLiveQuery(() => loadWeekStats(Date.now()), []);
  const exercises = useLiveQuery(async () => new Map((await db.exercises.toArray()).map((e) => [e.id, e])), []);
  const [starting, setStarting] = useState(false);
  const settings = useSettings();
  const firstSessionAt = useLiveQuery(
    async () =>
      (
        await db.sessions
          .orderBy('startedAt')
          .filter((s) => s.status === 'finished')
          .first()
      )?.startedAt ?? null,
    [],
  );
  const remind =
    settings !== undefined &&
    firstSessionAt !== undefined &&
    needsBackupReminder(settings.lastBackupAt, firstSessionAt, Date.now());

  return (
    <>
      <h1 className="screen-title">Today</h1>
      <p className="muted intro">{formatLongDate(Date.now())}</p>

      {remind && (
        <Link className="card card-link backup-reminder" to="/settings/backup">
          <span className="row-title">Time to back up</span>
          <span className="row-meta">
            {settings?.lastBackupAt
              ? `Your last backup was ${formatDate(settings.lastBackupAt)}.`
              : 'You haven’t saved a backup yet.'}{' '}
            Your data only lives on this phone. Tap to save one.
          </span>
        </Link>
      )}

      {active === null && (
        <button type="button" className="btn btn-primary btn-hero" onClick={() => setStarting(true)}>
          Start workout
        </button>
      )}
      {active && (
        <Link className="btn btn-primary btn-hero" to={`/workout/${active.id}`}>
          <span>Resume workout</span>
          <span className="btn-hero-meta">{activeMeta(active)}</span>
        </Link>
      )}

      <section className="card stat-card" aria-label="This week">
        <h2 className="card-title">This week</h2>
        <div className="stats">
          <div>
            <div className="stat-value">{week?.sessions ?? '–'}</div>
            <div className="stat-label">{week?.sessions === 1 ? 'session' : 'sessions'}</div>
          </div>
          <div>
            <div className="stat-value">{week ? <Duration ms={week.totalMs} /> : '–'}</div>
            <div className="stat-label">gym time</div>
          </div>
        </div>
      </section>

      {last && exercises ? (
        <Link className="card card-link" to={`/history/${last.id}`} aria-label="Last session">
          <h2 className="card-title">Last session</h2>
          <LastSession session={last} exercises={exercises} />
        </Link>
      ) : (
        <section className="card" aria-label="Last session">
          <h2 className="card-title">Last session</h2>
          {last === null && <p className="muted">No sessions yet.</p>}
        </section>
      )}

      {starting && <StartSheet onClose={() => setStarting(false)} />}
    </>
  );
}

function activeMeta(s: Session): string {
  const name = s.templateName ?? 'Blank workout';
  return isSameDay(s.startedAt, Date.now())
    ? `${name} · started ${formatTime(s.startedAt)}`
    : `${name} · ${formatDate(s.startedAt)}`;
}

function LastSession({ session, exercises }: { session: Session; exercises: Map<string, Exercise> }) {
  const names = session.exercises.map((e) => exercises.get(e.exerciseId)?.name ?? 'Unknown exercise');
  return (
    <div className="last-session">
      <div className="last-session-head">
        <span className="row-title">{session.templateName ?? 'Blank workout'}</span>
        <span className="last-session-duration">
          {session.endedAt !== null ? formatDuration(session.endedAt - session.startedAt) : ''}
        </span>
      </div>
      <div className="row-meta">{formatDate(session.startedAt)}</div>
      {names.length > 0 && <p className="last-session-exercises">{names.join(', ')}</p>}
    </div>
  );
}

