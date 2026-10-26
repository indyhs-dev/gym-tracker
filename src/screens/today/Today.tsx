import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { CheckIcon, ChevronIcon } from '../../components/Icons';
import SectionHeader from '../../components/SectionHeader';
import { db } from '../../db/db';
import { finishedSessions, getActiveSession, loadWeekStats, previousBestsFor, startSession } from '../../db/sessions';
import { useSettings } from '../../db/settings';
import type { Session } from '../../db/types';
import { blockStatus } from '../../lib/block';
import { needsBackupReminder } from '../../lib/export';
import { plural } from '../../lib/format';
import { isWorkingSet } from '../../lib/progress';
import { isNewBest, type TopSet } from '../../lib/progression';
import { lastDoneByTemplate, nextTemplate, weekDays } from '../../lib/rotation';
import { formatDate, formatDuration, formatLongDate, formatTime, isSameDay } from '../../lib/time';
import StartSheet from './StartSheet';

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function Today() {
  const navigate = useNavigate();
  const active = useLiveQuery(async () => (await getActiveSession()) ?? null, []);
  const finished = useLiveQuery(() => finishedSessions(), []);
  const templates = useLiveQuery(() => db.templates.orderBy('order').toArray(), []);
  const week = useLiveQuery(() => loadWeekStats(Date.now()), []);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const last = finished?.[0] ?? null;
  const lastBests = useLiveQuery(
    async () => (last ? previousBestsFor(last.exerciseIds, last) : null),
    [last?.id, last?.updatedAt],
  );
  const next = templates && finished ? nextTemplate(templates, finished) : null;
  const lastDone = next && finished ? lastDoneByTemplate(finished).get(next.id) : undefined;
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
  /** "Start {name}": straight into the next template, dated today. */
  async function startNext(templateId: string) {
    try {
      const session = await startSession(templateId, Date.now());
      navigate(`/workout/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const block = settings ? blockStatus(settings.block, Date.now()) : null;
  const remind =
    settings !== undefined &&
    firstSessionAt !== undefined &&
    needsBackupReminder(settings.lastBackupAt, firstSessionAt, Date.now());

  return (
    <>
      <SectionHeader section="gym" />
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

      {active === null && templates && finished && (
        <section className="card next-up" aria-label="Next up">
          {next ? (
            <>
              <div className="next-up-text">
                <span className="next-up-label">Next up</span>
                <h2 className="next-up-name">{next.name}</h2>
                <span className="row-meta">
                  {plural(next.slots.length, 'exercise')} · {lastDone ? `last trained ${formatDate(lastDone)}` : 'not done yet'}
                </span>
              </div>
              <button type="button" className="btn btn-primary btn-block btn-tall" onClick={() => startNext(next.id)}>
                Start {next.name}
              </button>
              <button type="button" className="text-button" onClick={() => setStarting(true)}>
                Choose a different workout
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-primary btn-block btn-tall" onClick={() => setStarting(true)}>
              Start workout
            </button>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </section>
      )}
      {active && (
        <Link className="btn btn-primary btn-hero" to={`/workout/${active.id}`}>
          <span>Resume workout</span>
          <span className="btn-hero-meta">{activeMeta(active)}</span>
        </Link>
      )}

      {block && (
        <Link className={block.weekOffDue ? 'card card-link block-card is-due' : 'card card-link block-card'} to="/settings/block">
          {block.week === 0 ? (
            <span className="row-meta">
              Training block starts in {block.startsIn} {block.startsIn === 1 ? 'day' : 'days'}
            </span>
          ) : (
            <>
              <span className="block-week">Week {block.week}</span>
              <span className="row-meta">
                {block.weekOffDue
                  ? `Past week ${settings!.block.weekOffAfter}: time to take a week off`
                  : block.breakIn
                    ? 'Break-in week'
                    : 'Training block'}
              </span>
            </>
          )}
        </Link>
      )}

      <section className="card week-card" aria-label="This week">
        <div className="week-head">
          <h2 className="card-title">This week</h2>
          {week && (
            <span className="row-meta">
              {plural(week.sessions, 'session')} · {formatDuration(week.totalMs)}
            </span>
          )}
        </div>
        <ol className="week-days">
          {finished &&
            weekDays(finished, Date.now()).map((d, i) => (
              <li key={d.day} className={['week-day', d.trained && 'is-trained', d.today && 'is-today'].filter(Boolean).join(' ')}>
                <span className="week-day-letter" aria-hidden="true">
                  {DAY_LETTERS[i]}
                </span>
                <span className="week-day-dot">{d.trained && <CheckIcon />}</span>
                <span className="visually-hidden">
                  {DAY_NAMES[i]}
                  {d.today ? ', today' : ''}
                  {d.trained ? ', trained' : ''}
                </span>
              </li>
            ))}
        </ol>
      </section>

      {last ? (
        <Link className="card card-link last-session-card" to={`/history/${last.id}`}>
          <span className="last-session-text">
            <span className="card-title">Last session</span>
            <span className="last-session-title">
              {last.templateName ?? 'Blank workout'} · {formatDate(last.startedAt)}
            </span>
            <span className="row-meta">{lastSessionMeta(last, lastBests ?? null)}</span>
          </span>
          <ChevronIcon />
        </Link>
      ) : (
        finished && (
          <section className="card" aria-label="Last session">
            <h2 className="card-title">Last session</h2>
            <p className="muted">No sessions yet.</p>
          </section>
        )
      )}

      {starting && <StartSheet next={next} onClose={() => setStarting(false)} />}
    </>
  );
}

function activeMeta(s: Session): string {
  const name = s.templateName ?? 'Blank workout';
  return isSameDay(s.startedAt, Date.now())
    ? `${name} · started ${formatTime(s.startedAt)}`
    : `${name} · ${formatDate(s.startedAt)}`;
}

/** "58m · 15 sets · 2 new bests" (working sets; bests only when there are some). */
function lastSessionMeta(s: Session, bests: Map<string, TopSet> | null): string {
  const sets = s.exercises.reduce((n, e) => n + e.sets.filter(isWorkingSet).length, 0);
  const newBests = bests ? s.exercises.filter((e) => isNewBest(e.sets, bests.get(e.exerciseId))).length : 0;
  return [
    s.endedAt !== null && formatDuration(s.endedAt - s.startedAt),
    plural(sets, 'set'),
    newBests > 0 && plural(newBests, 'new best'),
  ]
    .filter(Boolean)
    .join(' · ');
}
