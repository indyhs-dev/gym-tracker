import { useState } from 'react';
import { setSessionTimes } from '../../db/sessions';
import type { Session } from '../../db/types';
import { atTime, endAtTime, formatDuration, toDateInput, toTimeInput } from '../../lib/time';

/** Date, start and end of a finished session. Saves as soon as all three are valid. */
export default function TimesEditor({ session }: { session: Session }) {
  const [date, setDate] = useState(toDateInput(session.startedAt));
  const [start, setStart] = useState(toTimeInput(session.startedAt));
  const [end, setEnd] = useState(session.endedAt !== null ? toTimeInput(session.endedAt) : '');
  const today = toDateInput(Date.now());

  function save(next: { date?: string; start?: string; end?: string }) {
    const d = next.date ?? date;
    const st = next.start ?? start;
    const en = next.end ?? end;
    if (!d || !st || !en) return;
    const [y, m, day] = d.split('-').map(Number);
    const startedAt = atTime(new Date(y, m - 1, day).getTime(), st);
    void setSessionTimes(session.id, startedAt, endAtTime(startedAt, en));
  }

  const duration = session.endedAt !== null ? formatDuration(session.endedAt - session.startedAt) : '–';

  return (
    <div className="card times-editor">
      <label className="field">
        <span className="field-label">Date</span>
        <input
          className="input"
          type="date"
          value={date}
          max={today}
          onChange={(e) => {
            setDate(e.target.value);
            save({ date: e.target.value });
          }}
        />
      </label>
      <div className="time-grid">
        <label className="field">
          <span className="field-label">Start</span>
          <input
            className="input input-number"
            type="time"
            value={start}
            onChange={(e) => {
              setStart(e.target.value);
              save({ start: e.target.value });
            }}
          />
        </label>
        <label className="field">
          <span className="field-label">End</span>
          <input
            className="input input-number"
            type="time"
            value={end}
            onChange={(e) => {
              setEnd(e.target.value);
              save({ end: e.target.value });
            }}
          />
        </label>
      </div>
      <p className="row-meta">Duration {duration}</p>
    </div>
  );
}
