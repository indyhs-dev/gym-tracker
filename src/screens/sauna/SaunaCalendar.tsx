import { useState } from 'react';
import type { SaunaEntry } from '../../db/types';
import { addDaysYmd, addMonths, dayStatuses, monthGrid, ymdToMs, type DayStatus } from '../../lib/sauna';
import { formatDate } from '../../lib/time';

const STATUS_LABEL: Record<DayStatus, string> = {
  completed: 'Completed',
  partial: 'Left early',
  skipped: 'Skipped',
};

// Monday first, in the device's language.
const WEEKDAYS = Array.from({ length: 7 }, (_, i) =>
  new Date(ymdToMs(addDaysYmd('2026-10-12', i))).toLocaleDateString(undefined, { weekday: 'narrow' }),
);

/** Month view coloured by each day's status, with ‹ › to move between months. */
export default function SaunaCalendar({ entries, today }: { entries: SaunaEntry[]; today: string }) {
  const thisMonth = today.slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const statuses = dayStatuses(entries);
  const weeks = monthGrid(month);
  const title = new Date(ymdToMs(`${month}-01`)).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const counts = { completed: 0, partial: 0, skipped: 0 };
  for (const [day, status] of statuses) if (day.startsWith(month)) counts[status]++;

  return (
    <section className="card chart-card" aria-label="Calendar">
      <div className="cal-head">
        <button type="button" className="icon-button" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))}>
          ‹
        </button>
        <h2 className="chart-title">{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Next month"
          disabled={month >= thisMonth}
          onClick={() => setMonth(addMonths(month, 1))}
        >
          ›
        </button>
      </div>

      <table className="cal">
        <thead>
          <tr>
            {WEEKDAYS.map((d, i) => (
              <th key={i} scope="col">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, i) => (
            <tr key={i}>
              {week.map((day, j) => {
                if (!day) return <td key={j} />;
                const status = statuses.get(day);
                const classes = ['cal-day', status ? `is-${status}` : '', day === today ? 'is-today' : '', day > today ? 'is-future' : ''];
                return (
                  <td key={j}>
                    <span className={classes.filter(Boolean).join(' ')} title={status ? STATUS_LABEL[status] : undefined}>
                      {Number(day.slice(8))}
                      <span className="visually-hidden">
                        {`, ${formatDate(ymdToMs(day))}: ${status ? STATUS_LABEL[status] : 'no entry'}`}
                      </span>
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="chart-legend cal-legend">
        {(Object.keys(STATUS_LABEL) as DayStatus[]).map((s) => (
          <span key={s} className="chart-legend-item">
            <span className={`cal-key is-${s}`} aria-hidden="true" />
            {STATUS_LABEL[s]} {counts[s]}
          </span>
        ))}
      </div>
    </section>
  );
}
