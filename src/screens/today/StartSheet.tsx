import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import Sheet from '../../components/Sheet';
import { db } from '../../db/db';
import { startSession } from '../../db/sessions';
import { plural } from '../../lib/format';
import { startTimeFor, toDateInput } from '../../lib/time';

/** Choose a template (or blank) and a date; one tap starts the workout. */
export default function StartSheet({ onClose }: { onClose: () => void }) {
  const templates = useLiveQuery(() => db.templates.orderBy('order').toArray(), []);
  const today = toDateInput(Date.now());
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function start(templateId: string | null) {
    try {
      const session = await startSession(templateId, startTimeFor(date || today, Date.now()));
      navigate(`/workout/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <Sheet title="Start workout" onClose={onClose}>
      <label className="field">
        <span className="field-label">Date</span>
        <input className="input" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
        {date !== today && <span className="row-meta">Logging a past session</span>}
      </label>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="field">
        <span className="field-label">Template</span>
        <ul className="list">
          {templates?.map((t) => (
            <li key={t.id}>
              <button type="button" className="list-row" onClick={() => start(t.id)}>
                <span className="row-text">
                  <span className="row-title">{t.name}</span>
                  <span className="row-meta">{plural(t.slots.length, 'exercise')}</span>
                </span>
                <span className="chevron" aria-hidden="true">
                  ›
                </span>
              </button>
            </li>
          ))}
          <li>
            <button type="button" className="list-row" onClick={() => start(null)}>
              <span className="row-text">
                <span className="row-title">Blank workout</span>
                <span className="row-meta">Add exercises as you go</span>
              </span>
              <span className="chevron" aria-hidden="true">
                ›
              </span>
            </button>
          </li>
        </ul>
      </div>
    </Sheet>
  );
}
