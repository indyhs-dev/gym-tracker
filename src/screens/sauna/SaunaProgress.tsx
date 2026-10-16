import { useLiveQuery } from 'dexie-react-hooks';
import TrendChart from '../../components/charts/TrendChart';
import WeeklyBars from '../../components/charts/WeeklyBars';
import SectionHeader from '../../components/SectionHeader';
import { saunaEntries } from '../../db/sauna';
import { useSettings } from '../../db/settings';
import { plural } from '../../lib/format';
import {
  FEEL_WORDS,
  planOf,
  planText,
  recentSessions,
  roundStats,
  saunaToday,
  saunaWeeks,
  WEEKS_SHOWN,
  ymdToMs,
} from '../../lib/sauna';
import { formatDate } from '../../lib/time';
import { CHART } from '../../styles/chartColors';
import SaunaCalendar from './SaunaCalendar';

/** Weekly sessions against the target, the month calendar, feel trend and round stats. */
export default function SaunaProgress() {
  const entries = useLiveQuery(saunaEntries, []);
  const settings = useSettings();
  if (!entries || !settings) return <SectionHeader section="sauna" />;
  if (entries.length === 0) {
    return (
      <>
        <SectionHeader section="sauna" />
        <p className="empty">Charts appear here once you log a sauna session.</p>
      </>
    );
  }

  const today = saunaToday();
  const target = settings.sauna.weeklyTarget;
  const weeks = saunaWeeks(entries, today, target);
  const recent = recentSessions(entries);
  const stats = roundStats(recent);

  return (
    <>
      <SectionHeader section="sauna" />

      <section className="card chart-card sauna-first">
        <h2 className="chart-title">Sessions per week</h2>
        <p className="chart-subtitle">Last {WEEKS_SHOWN} weeks · skipped days count towards the target</p>
        <WeeklyBars
          data={weeks.map((w) => ({ x: ymdToMs(w.weekStart), value: w.sessions, extra: w.skips }))}
          goal={target}
          valueLabel="Sessions"
          extraLabel="Skipped"
          format={(v) => plural(v, 'session')}
          formatExtra={(v) => `${v} skipped`}
          label={`Sauna sessions per week, last ${WEEKS_SHOWN} weeks, target ${target}`}
        />
        <details className="chart-table">
          <summary>Show as table</summary>
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Week of</th>
                <th scope="col">Sessions</th>
                <th scope="col">Skipped</th>
                <th scope="col">On target</th>
              </tr>
            </thead>
            <tbody>
              {[...weeks].reverse().map((w) => (
                <tr key={w.weekStart}>
                  <td>{formatDate(ymdToMs(w.weekStart))}</td>
                  <td>{w.sessions}</td>
                  <td>{w.skips}</td>
                  <td>{w.met ? 'Yes' : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>

      <SaunaCalendar entries={entries} today={today} />

      {recent.length > 0 && (
        <section className="card chart-card">
          <h2 className="chart-title">Feel</h2>
          <p className="chart-subtitle">
            Last {plural(recent.length, 'session')} · {[1, 3, 5].map((n) => `${n} ${FEEL_WORDS[n]}`).join(', ')}
          </p>
          <TrendChart
            data={recent.map((s) => ({ x: ymdToMs(s.date), feel: s.feel }))}
            series={[
              {
                key: 'feel',
                label: 'Feel',
                color: CHART.accent,
                format: (v) => (FEEL_WORDS[v] ? `${v} · ${FEEL_WORDS[v]}` : String(v)),
              },
            ]}
            yTicks={[1, 2, 3, 4, 5]}
            label="Feel score per sauna session"
            height={180}
          />
          <details className="chart-table">
            <summary>Show as table</summary>
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Session</th>
                  <th scope="col">Plan</th>
                  <th scope="col">Feel</th>
                </tr>
              </thead>
              <tbody>
                {[...recent].reverse().map((s) => (
                  <tr key={s.id}>
                    <td>{formatDate(ymdToMs(s.date))}</td>
                    <td>{planText(planOf(s))}</td>
                    <td>{s.feel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </section>
      )}

      {stats.rate !== null && (
        <section className="card">
          <h2 className="card-title">Rounds · last {plural(recent.length, 'session')}</h2>
          <div className="stat-value">
            {Math.round(stats.rate * 100)}
            <span className="stat-unit">%</span>
          </div>
          <div className="stat-label">
            completed as planned ({stats.completed} of {plural(stats.rounds, 'round')})
          </div>
          <p className="row-meta sauna-secondary">Average {stats.avgMinutes!.toFixed(1)} min per round</p>
        </section>
      )}
    </>
  );
}
