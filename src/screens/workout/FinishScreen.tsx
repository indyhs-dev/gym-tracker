import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { BackIcon, ChevronIcon } from '../../components/Icons';
import NoteField from '../../components/NoteField';
import { finishSession, previousBestsFor, setSessionNote, suggestedEnd } from '../../db/sessions';
import type { Exercise, Session } from '../../db/types';
import { plural } from '../../lib/format';
import { isWorkingSet } from '../../lib/progress';
import { goUpWeight, isNewBest, progressionHint, topSet } from '../../lib/progression';
import { weightText } from '../../lib/setText';
import { atTime, endAtTime, formatDayDate, formatDuration, formatTime, toTimeInput } from '../../lib/time';

interface Props {
  session: Session;
  exercises: Map<string, Exercise>;
  /** Live: end defaults to the last logged set. Past: times are entered by hand, so they start open. */
  live: boolean;
  onBack: () => void;
  onFinished: () => void;
}

const HOUR = 60 * 60 * 1000;
/** Exercises listed before "+ N more". */
const SHOWN = 3;

/**
 * The end of a workout, before it's saved: time, working sets and new
 * bests, what to go up on next time, each exercise's top set, and the
 * session note. Exercises with no sets are left out when it's saved.
 */
export default function FinishScreen({ session, exercises, live, onBack, onFinished }: Props) {
  const [start, setStart] = useState(toTimeInput(session.startedAt));
  const [end, setEnd] = useState(toTimeInput(live ? suggestedEnd(session) : session.startedAt + HOUR));
  const [editingTimes, setEditingTimes] = useState(!live);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bests = useLiveQuery(
    () => previousBestsFor(session.exerciseIds, session),
    [session.id, session.startedAt, session.exerciseIds.join(',')],
  );

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const startedAt = start ? atTime(session.startedAt, start) : null;
  const endedAt = startedAt !== null && end ? endAtTime(startedAt, end) : null;

  const logged = session.exercises
    .filter((item) => item.sets.some((s) => s.weight !== null || s.reps !== null))
    .map((item) => {
      const exercise = exercises.get(item.exerciseId);
      const top = topSet(item.sets);
      const best = isNewBest(item.sets, bests?.get(item.exerciseId));
      const hint = item.slot && exercise ? progressionHint(item.sets, item.slot.repMax, exercise.weightStep) : null;
      return { item, exercise, top, best, hint };
    });
  const skipped = session.exercises.length - logged.length;
  const workingSets = session.exercises.reduce((n, e) => n + e.sets.filter(isWorkingSet).length, 0);
  const newBests = logged.filter((x) => x.best).length;
  const goUps = logged.filter((x) => x.hint);
  // New bests first, then the rest in workout order.
  const listed = [...logged.filter((x) => x.best), ...logged.filter((x) => !x.best)];
  const collapsed = !showAll && listed.length > SHOWN;
  const visible = collapsed ? listed.slice(0, SHOWN - 1) : listed;

  async function save() {
    if (startedAt === null || endedAt === null) {
      setEditingTimes(true);
      return setError('Enter a start and end time');
    }
    try {
      await finishSession(session.id, startedAt, endedAt);
      onFinished();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const when = `${formatDayDate(session.startedAt)} · ${startedAt !== null ? formatTime(startedAt) : '–'} – ${endedAt !== null ? formatTime(endedAt) : '–'}`;

  return (
    <div className="finish-screen">
      <button type="button" className="back finish-back" onClick={onBack}>
        <BackIcon />
        Back to workout
      </button>

      <h1 className="finish-title">{session.templateName ?? 'Workout'} done</h1>
      <button
        type="button"
        className="finish-when"
        aria-expanded={editingTimes}
        aria-label={`${when}. Change start and end times`}
        onClick={() => setEditingTimes(true)}
      >
        {when}
      </button>

      {editingTimes && (
        <div className="time-grid finish-times">
          <label className="field">
            <span className="field-label">Start</span>
            <input className="input input-number" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">End</span>
            <input className="input input-number" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
        </div>
      )}

      <div className="finish-stats">
        <div className="finish-stat">
          <span className="finish-stat-value">
            {startedAt !== null && endedAt !== null ? formatDuration(endedAt - startedAt) : '–'}
          </span>
          <span className="finish-stat-label">time</span>
        </div>
        <div className="finish-stat">
          <span className="finish-stat-value">{workingSets}</span>
          <span className="finish-stat-label">working sets</span>
        </div>
        <div className="finish-stat">
          <span className="finish-stat-value">{newBests}</span>
          <span className="finish-stat-label">{newBests === 1 ? 'new best' : 'new bests'}</span>
        </div>
      </div>

      {goUps.length > 0 && (
        <section className="finish-goup">
          <h2>Go up next time</h2>
          {goUps.map(({ item, exercise, hint }) => (
            <div key={item.id} className="finish-goup-row">
              <span>{exercise?.name ?? 'Unknown exercise'}</span>
              <span className="finish-goup-weights">
                {weightText(hint!.weight, exercise)} → {goUpWeight(hint!, exercise?.bodyweight ?? false)}
              </span>
            </div>
          ))}
        </section>
      )}

      {listed.length > 0 && (
        <section className="finish-list">
          {visible.map(({ item, exercise, top, best }) => (
            <div key={item.id} className="finish-list-row">
              <span className="finish-list-name">{exercise?.name ?? 'Unknown exercise'}</span>
              <span className="finish-list-detail">
                {best && <span className="best-badge">Best</span>}
                {top ? `${weightText(top.weight, exercise)} × ${top.reps}` : plural(item.sets.length, 'set')}
              </span>
            </div>
          ))}
          {collapsed && (
            <button type="button" className="finish-list-row finish-more" onClick={() => setShowAll(true)}>
              <span>+ {plural(listed.length - visible.length, 'more exercise')}</span>
              <ChevronIcon />
            </button>
          )}
        </section>
      )}

      <NoteField
        label="Session note"
        placeholder="Session note (optional)"
        value={session.note}
        onChange={(note) => setSessionNote(session.id, note)}
      />
      {skipped > 0 && <p className="row-meta field-hint">{plural(skipped, 'exercise')} with no sets will be left out.</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="spacer" />
      <button type="button" className="btn btn-primary btn-block btn-tall finish-save" onClick={save}>
        Save workout
      </button>
    </div>
  );
}
