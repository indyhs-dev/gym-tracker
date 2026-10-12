import { useState } from 'react';
import Sheet from '../../components/Sheet';
import { finishSession, suggestedEnd } from '../../db/sessions';
import type { Session } from '../../db/types';
import { plural } from '../../lib/format';
import { atTime, endAtTime, formatDate, formatDuration, toTimeInput } from '../../lib/time';

interface Props {
  session: Session;
  /** Live: end defaults to the last logged set. Past: times are entered by hand. */
  live: boolean;
  onClose: () => void;
  onFinished: () => void;
}

const HOUR = 60 * 60 * 1000;

export default function FinishSheet({ session, live, onClose, onFinished }: Props) {
  const [start, setStart] = useState(toTimeInput(session.startedAt));
  const [end, setEnd] = useState(toTimeInput(live ? suggestedEnd(session) : session.startedAt + HOUR));
  const [error, setError] = useState<string | null>(null);

  const startedAt = start ? atTime(session.startedAt, start) : null;
  const endedAt = startedAt !== null && end ? endAtTime(startedAt, end) : null;
  const skipped = session.exercises.filter((e) => e.sets.length === 0).length;
  const setCount = session.exercises.reduce((n, e) => n + e.sets.length, 0);

  async function finish() {
    if (startedAt === null || endedAt === null) return setError('Enter a start and end time');
    try {
      await finishSession(session.id, startedAt, endedAt);
      onFinished();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <Sheet title={live ? 'Finish workout' : 'Save session'} onClose={onClose}>
      <p className="muted intro-sheet">
        {formatDate(session.startedAt)} · {plural(setCount, 'set')} logged
      </p>

      <div className="time-grid">
        <label className="field">
          <span className="field-label">Start</span>
          <input className="input input-number" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">End</span>
          <input className="input input-number" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
      </div>
      {live && <p className="row-meta field-hint">End is set to when your last set was logged. Change it if needed.</p>}

      <div className="card finish-duration">
        <span className="card-title">Duration</span>
        <span className="finish-duration-value">
          {startedAt !== null && endedAt !== null ? formatDuration(endedAt - startedAt) : '–'}
        </span>
      </div>

      {skipped > 0 && (
        <p className="row-meta field-hint">
          {plural(skipped, 'exercise')} with no sets will be left out.
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <button type="button" className="btn btn-primary btn-block btn-tall" onClick={finish}>
        {live ? 'Finish workout' : 'Save session'}
      </button>
    </Sheet>
  );
}
