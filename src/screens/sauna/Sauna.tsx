import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import TrendChart from '../../components/charts/TrendChart';
import WeeklyBars from '../../components/charts/WeeklyBars';
import Segmented from '../../components/Segmented';
import { saunaEntries } from '../../db/sauna';
import { useSettings } from '../../db/settings';
import type { SaunaEntry } from '../../db/types';
import { plural } from '../../lib/format';
import {
  consistency,
  CONTEXT_LABEL,
  FEEL_WORDS,
  isSession,
  planOf,
  planText,
  recentSessions,
  roundStats,
  saunaToday,
  saunaWeeks,
  STEP_UP_MIN_FEEL,
  STEP_UP_SESSIONS,
  stepUpSuggestion,
  WEEKS_SHOWN,
  ymdToMs,
} from '../../lib/sauna';
import { formatDate } from '../../lib/time';
import { CHART } from '../../styles/chartColors';
import SaunaCalendar from './SaunaCalendar';
import SaunaHistory from './SaunaHistory';
import SessionSheet from './SessionSheet';
import SkipSheet from './SkipSheet';

type Open = { kind: 'session' | 'skip'; entry?: SaunaEntry } | null;

export default function Sauna() {
  const entries = useLiveQuery(saunaEntries, []);
  const settings = useSettings();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState<Open>(null);

  if (!entries || !settings) return <h1 className="screen-title">Sauna</h1>;

  const today = saunaToday();
  const last = entries.filter(isSession).at(-1) ?? null;
  const view = params.get('view') === 'history' ? 'history' : 'overview';
  const close = () => setOpen(null);

  return (
    <>
      <h1 className="screen-title">Sauna</h1>

      <button type="button" className="btn btn-primary btn-hero" onClick={() => setOpen({ kind: 'session' })}>
        <span>Log sauna</span>
        <span className="btn-hero-meta">
          {last ? `${planText(planOf(last))} · ${CONTEXT_LABEL[last.context].toLowerCase()}` : '2 × 15 min'}
        </span>
      </button>
      <button type="button" className="btn btn-block" onClick={() => setOpen({ kind: 'skip' })}>
        Log a skip
      </button>

      <StepUpCard entries={entries} today={today} />

      <div className="field sauna-view">
        <Segmented
          label="View"
          options={[
            { value: 'overview', label: 'Overview' },
            { value: 'history', label: 'History' },
          ]}
          value={view}
          onChange={(v) => setParams(v === 'history' ? { view: v } : {}, { replace: true })}
        />
      </div>

      {view === 'overview' ? (
        <Overview entries={entries} target={settings.sauna.weeklyTarget} today={today} />
      ) : (
        <SaunaHistory entries={entries} onEdit={(entry) => setOpen({ kind: entry.kind, entry })} />
      )}

      {open?.kind === 'session' && (
        <SessionSheet entry={open.entry?.kind === 'session' ? open.entry : undefined} last={last} onClose={close} />
      )}
      {open?.kind === 'skip' && <SkipSheet entry={open.entry?.kind === 'skip' ? open.entry : undefined} onClose={close} />}
    </>
  );
}

// ---- Ready to step up? ----

const DISMISS_KEY = 'gym-log.sauna-step-up-dismissed';

function readDismissed(): string | null {
  try {
    return localStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
}

/** A gentle suggestion, never a nudge. "Not now" hides it until the next session is logged. */
function StepUpCard({ entries, today }: { entries: SaunaEntry[]; today: string }) {
  const [dismissed, setDismissed] = useState(readDismissed);
  const suggestion = stepUpSuggestion(entries, today);
  if (!suggestion || dismissed === suggestion.latestId) return null;

  function dismiss() {
    setDismissed(suggestion!.latestId);
    try {
      localStorage.setItem(DISMISS_KEY, suggestion!.latestId);
    } catch {
      // Private mode: it stays hidden until the app closes.
    }
  }

  // Keep "2 × 15 min" on one line.
  const unbroken = (plan: number[]) => planText(plan).replace(/ /g, ' ');
  const current = unbroken(suggestion.current);
  return (
    <section className="card step-up" aria-label="Ready to step up?">
      <h2 className="step-up-title">Ready to step up?</h2>
      <p>
        Your last {STEP_UP_SESSIONS} sessions at {current} were all completed with a feel of {STEP_UP_MIN_FEEL} or more. If
        you feel like it, you could try <strong>{unbroken(suggestion.next)}</strong> next time.
      </p>
      <p className="row-meta">Only if it feels right on the day. Staying at {current} is just as good.</p>
      <button type="button" className="btn btn-quiet btn-small step-up-dismiss" onClick={dismiss}>
        Not now
      </button>
    </section>
  );
}

// ---- Overview ----

function Overview({ entries, target, today }: { entries: SaunaEntry[]; target: number; today: string }) {
  if (entries.length === 0) {
    return <p className="empty">Your weekly sessions, calendar and feel trend appear here once you log a session.</p>;
  }
  const weeks = saunaWeeks(entries, today, target);
  const thisWeek = weeks.at(-1)!;
  const score = consistency(weeks, entries[0].date);
  const recent = recentSessions(entries);
  const stats = roundStats(recent);

  return (
    <>
      <Link className="card card-link" to="/settings/sauna" aria-label="This week">
        <h2 className="card-title">This week</h2>
        <div className="stats">
          <div>
            <div className="stat-value">
              {thisWeek.sessions}
              <span className="stat-unit"> of {target}</span>
            </div>
            <div className="stat-label">
              {thisWeek.sessions === 1 ? 'session' : 'sessions'}
              {thisWeek.skips > 0 && ` · ${thisWeek.skips} skipped`}
            </div>
          </div>
          <div>
            <div className="stat-value">
              {score.of > 0 ? score.met : '–'}
              {score.of > 0 && <span className="stat-unit"> of {score.of}</span>}
            </div>
            <div className="stat-label">{score.of === 1 ? 'week on target' : 'weeks on target'}</div>
          </div>
        </div>
        {thisWeek.met && <p className="row-meta sauna-met">Target met this week</p>}
      </Link>

      <section className="card chart-card">
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
