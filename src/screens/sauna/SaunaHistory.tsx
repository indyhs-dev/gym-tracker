import type { SaunaEntry, SaunaSession } from '../../db/types';
import {
  BENCH_LABEL,
  CONTEXT_LABEL,
  EXIT_REASON_LABEL,
  planOf,
  planText,
  roundText,
  SKIP_REASON_LABEL,
  TEMP_LABEL,
  ymdToMs,
} from '../../lib/sauna';
import { formatDate } from '../../lib/time';

/** Every entry, newest first, grouped by month. Tap one to edit or delete it. */
export default function SaunaHistory({ entries, onEdit }: { entries: SaunaEntry[]; onEdit: (entry: SaunaEntry) => void }) {
  if (entries.length === 0) return <p className="empty">No sauna sessions yet.</p>;
  return (
    <>
      {groupByMonth([...entries].reverse()).map(([month, list]) => (
        <section key={month} className="history-month">
          <h2 className="field-label">{month}</h2>
          <ul className="list">
            {list.map((e) => (
              <li key={e.id}>
                <button type="button" className="list-row history-row" onClick={() => onEdit(e)}>
                  <span className="row-text">
                    <span className="history-date">{formatDate(ymdToMs(e.date))}</span>
                    {e.kind === 'session' ? (
                      <SessionText session={e} />
                    ) : (
                      <>
                        <span className="row-title">Skipped</span>
                        <span className="row-meta">{SKIP_REASON_LABEL[e.reason]}</span>
                      </>
                    )}
                  </span>
                  {e.kind === 'session' && (
                    <span className="sauna-feel" aria-label={`Feel ${e.feel} of 5`}>
                      <span className="history-duration">{e.feel}</span>
                      <span className="row-meta">feel</span>
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

function SessionText({ session: s }: { session: SaunaSession }) {
  const details = [
    `${BENCH_LABEL[s.bench]} bench`,
    s.temp && `${TEMP_LABEL[s.temp]} temp`,
    s.water && 'Drank water',
  ].filter(Boolean);
  return (
    <>
      <span className="row-title">
        {planText(planOf(s))} · {CONTEXT_LABEL[s.context].toLowerCase()}
      </span>
      {s.rounds.map((r, i) => (
        <span key={i} className="row-meta">
          {roundText(r, i)}
          {r.reason && ` · ${EXIT_REASON_LABEL[r.reason].toLowerCase()}`}
        </span>
      ))}
      <span className="row-meta">{details.join(' · ')}</span>
    </>
  );
}

function groupByMonth(entries: SaunaEntry[]): [string, SaunaEntry[]][] {
  const groups = new Map<string, SaunaEntry[]>();
  for (const e of entries) {
    const month = new Date(ymdToMs(e.date)).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    groups.set(month, [...(groups.get(month) ?? []), e]);
  }
  return [...groups];
}
