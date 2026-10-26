import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ChevronIcon } from '../../components/Icons';
import Sheet from '../../components/Sheet';
import { db } from '../../db/db';
import { finishedSessions, startSession } from '../../db/sessions';
import type { Template } from '../../db/types';
import { plural } from '../../lib/format';
import { lastDoneByTemplate, rotationOrder } from '../../lib/rotation';
import { formatDate, startTimeFor, toDateInput } from '../../lib/time';

/**
 * Choose a template (or blank); one tap starts the workout. The next-up
 * template is on top, the others follow in rotation order, Blank workout is
 * last. The date sits at the bottom: only for logging a past workout.
 */
export default function StartSheet({ next, onClose }: { next: Template | null; onClose: () => void }) {
  const templates = useLiveQuery(() => db.templates.orderBy('order').toArray(), []);
  const lastDone = useLiveQuery(async () => lastDoneByTemplate(await finishedSessions()), []);
  const today = toDateInput(Date.now());
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const dateInput = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  async function start(templateId: string | null) {
    try {
      const session = await startSession(templateId, startTimeFor(date || today, Date.now()));
      navigate(`/workout/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const ordered = templates ? rotationOrder(templates, next) : [];
  const first = next && ordered[0]?.id === next.id ? ordered[0] : null;
  const others = first ? ordered.slice(1) : ordered;
  const meta = (t: Template) => {
    const done = lastDone?.get(t.id);
    return `${plural(t.slots.length, 'exercise')}${done ? ` · last done ${formatDate(done)}` : ''}`;
  };
  const [y, m, d] = (date || today).split('-').map(Number);

  return (
    <Sheet title="Start workout" onClose={onClose}>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="start-options">
        {first && (
          <button type="button" className="start-row start-next" onClick={() => start(first.id)}>
            <span className="row-text">
              <span className="start-next-title">
                <span className="row-title">{first.name}</span>
                <span className="next-up-badge">Next up</span>
              </span>
              <span className="row-meta">{meta(first)}</span>
            </span>
            <ChevronIcon />
          </button>
        )}

        <div className="start-list">
          {others.map((t) => (
            <button key={t.id} type="button" className="start-row" onClick={() => start(t.id)}>
              <span className="row-text">
                <span className="row-title">{t.name}</span>
                <span className="row-meta">{meta(t)}</span>
              </span>
              <ChevronIcon />
            </button>
          ))}
          <button type="button" className="start-row" onClick={() => start(null)}>
            <span className="row-text">
              <span className="row-title">Blank workout</span>
              <span className="row-meta">Add exercises as you go</span>
            </span>
            <ChevronIcon />
          </button>
        </div>

        {/* The native date input sits invisibly over the row, so tapping anywhere opens the picker. */}
        <label className="start-date">
          <span className="muted">Date</span>
          <span className="start-date-value">
            {date === today ? 'Today' : formatDate(new Date(y, m - 1, d).getTime())}
            <svg className="icon" width="12" height="8" viewBox="0 0 12 8" aria-hidden="true">
              <path d="m1.5 1.5 4.5 4.5 4.5-4.5" />
            </svg>
          </span>
          <input
            ref={dateInput}
            type="date"
            aria-label="Date"
            value={date}
            max={today}
            onClick={() => {
              try {
                dateInput.current?.showPicker();
              } catch {
                // Not supported: the tap itself opens the picker (iOS).
              }
            }}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <p className="row-meta start-date-hint">
          {date === today ? 'Change the date only when logging a past workout.' : 'Logging a past workout.'}
        </p>
      </div>
    </Sheet>
  );
}
