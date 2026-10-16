import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link } from 'react-router';
import SectionHeader from '../../components/SectionHeader';
import { saunaEntries } from '../../db/sauna';
import { useSettings } from '../../db/settings';
import type { SaunaEntry } from '../../db/types';
import {
  consistency,
  CONTEXT_LABEL,
  isSession,
  planOf,
  planText,
  saunaToday,
  saunaWeeks,
  STEP_UP_MIN_FEEL,
  STEP_UP_SESSIONS,
  stepUpSuggestion,
  ymdToMs,
} from '../../lib/sauna';
import { formatDate, formatLongDate } from '../../lib/time';
import { SessionText } from './SaunaHistory';
import SessionSheet from './SessionSheet';
import SkipSheet from './SkipSheet';

/** Log a session or a skip, plus this week at a glance. */
export default function SaunaToday() {
  const entries = useLiveQuery(saunaEntries, []);
  const settings = useSettings();
  const [open, setOpen] = useState<'session' | 'skip' | null>(null);

  if (!entries || !settings) return <SectionHeader section="sauna" />;

  const today = saunaToday();
  const last = entries.filter(isSession).at(-1) ?? null;
  const target = settings.sauna.weeklyTarget;
  const weeks = saunaWeeks(entries, today, target);
  const thisWeek = weeks.at(-1)!;
  const score = consistency(weeks, entries[0]?.date ?? null);

  return (
    <>
      <SectionHeader section="sauna" />
      <p className="muted intro">{formatLongDate(ymdToMs(today))}</p>

      <button type="button" className="btn btn-primary btn-hero" onClick={() => setOpen('session')}>
        <span>Log sauna</span>
        <span className="btn-hero-meta">
          {last ? `${planText(planOf(last))} · ${CONTEXT_LABEL[last.context].toLowerCase()}` : '2 × 15 min'}
        </span>
      </button>
      <button type="button" className="btn btn-block" onClick={() => setOpen('skip')}>
        Log a skip
      </button>

      <StepUpCard entries={entries} today={today} />

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

      {last ? (
        <Link className="card card-link" to="/sauna/history" aria-label="Last sauna session">
          <h2 className="card-title">Last session</h2>
          <div className="sauna-last">
            <span className="row-text">
              <span className="history-date">{formatDate(ymdToMs(last.date))}</span>
              <SessionText session={last} />
            </span>
            <span className="sauna-feel" aria-label={`Feel ${last.feel} of 5`}>
              <span className="history-duration">{last.feel}</span>
              <span className="row-meta">feel</span>
            </span>
          </div>
        </Link>
      ) : (
        <section className="card" aria-label="Last sauna session">
          <h2 className="card-title">Last session</h2>
          <p className="muted">No sessions yet.</p>
        </section>
      )}

      {open === 'session' && <SessionSheet last={last} onClose={() => setOpen(null)} />}
      {open === 'skip' && <SkipSheet onClose={() => setOpen(null)} />}
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
