import type {
  SaunaBench,
  SaunaContext,
  SaunaEntry,
  SaunaExitReason,
  SaunaRound,
  SaunaSession,
  SaunaSkipReason,
  SaunaTemp,
} from '../db/types';

// ---- Settings that are easy to change ----

/** Sauna days and weeks (Monday–Sunday) are counted in this time zone. */
export const SAUNA_TIME_ZONE = 'Australia/Brisbane';

/** Planned round lengths on offer, in minutes. */
export const ROUND_MINUTES = [15, 20];
export const DEFAULT_ROUND_MINUTES = 15;
export const DEFAULT_ROUNDS = 2;
export const MIN_ROUNDS = 1;
export const MAX_ROUNDS = 3;

/** Weeks in the weekly chart and the consistency count (this week included). */
export const WEEKS_SHOWN = 8;
/** Sessions used for the feel trend and the round stats. */
export const RECENT_SESSIONS = 20;

/**
 * "Ready to step up?" appears only when the last STEP_UP_SESSIONS sessions were
 * all on the same plan, every round was completed, every feel score was at
 * least STEP_UP_MIN_FEEL, and the oldest of them was within STEP_UP_WITHIN_DAYS
 * (heat tolerance fades after a break, so old sessions don't count).
 */
export const STEP_UP_SESSIONS = 3;
export const STEP_UP_MIN_FEEL = 4;
export const STEP_UP_WITHIN_DAYS = 21;

// ---- Labels ----

export const CONTEXT_LABEL: Record<SaunaContext, string> = {
  afterLifting: 'After lifting',
  afterCardio: 'After cardio',
  standalone: 'Standalone',
};

export const BENCH_LABEL: Record<SaunaBench, string> = { upper: 'Upper', lower: 'Lower' };

export const TEMP_LABEL: Record<SaunaTemp, string> = { low: 'Low', mid: 'Mid', high: 'High' };

export const EXIT_REASON_LABEL: Record<SaunaExitReason, string> = {
  tooHot: 'Too hot',
  dehydrated: 'Dehydrated',
  tired: 'Tired',
  other: 'Other',
};

export const SKIP_REASON_LABEL: Record<SaunaSkipReason, string> = {
  rest: 'Rest',
  sick: 'Sick',
  closed: 'Sauna closed',
  other: 'Other',
};

/** Words for the ends and middle of the 1–5 feel scale. */
export const FEEL_WORDS: Partial<Record<number, string>> = { 1: 'survivable', 3: 'comfortable', 5: 'easy' };

// ---- Calendar days ("YYYY-MM-DD") ----

const DAY_MS = 24 * 60 * 60 * 1000;

const dayParts = new Intl.DateTimeFormat('en-US', {
  timeZone: SAUNA_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Today's date in Brisbane, "YYYY-MM-DD". */
export function saunaToday(now = Date.now()): string {
  const parts = dayParts.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

const toUtc = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Calendar arithmetic on dates, independent of any time zone. */
export function addDaysYmd(ymd: string, days: number): string {
  return fromUtc(toUtc(ymd) + days * DAY_MS);
}

/** The Monday of the week containing `ymd`. */
export function weekStartYmd(ymd: string): string {
  const weekday = new Date(toUtc(ymd)).getUTCDay();
  return addDaysYmd(ymd, -((weekday + 6) % 7));
}

/** "2026-10" plus `n` months. */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}

/** Noon local time on that day, for chart axes and the app's date formatting (which use the device's clock). */
export function ymdToMs(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d, 12).getTime();
}

export const isYmd = (text: string) => /^\d{4}-\d{2}-\d{2}$/.test(text);

// ---- Time left (mm:ss) ----

/** 683 → "11:23", 900 → "15:00". */
export function formatMmSs(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * The "time left" field as you type. The iPhone number pad has no colon, so
 * digits fill from the right like a timer: 3, 3, 7 reads 0:03, 0:33, 3:37.
 * Anything that isn't a digit is ignored. Blank or zero stays blank.
 */
export function timeLeftInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').replace(/^0+/, '').slice(0, 4);
  if (digits === '') return '';
  const padded = digits.padStart(3, '0');
  return `${padded.slice(0, -2)}:${padded.slice(-2)}`;
}

export type TimeLeft = { ok: true; sec: number } | { ok: false; error: string };

/** Seconds left from the field ("" = completed). Must be less than the planned time. */
export function parseTimeLeft(text: string, plannedMin: number): TimeLeft {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: true, sec: 0 };
  const match = /^(\d{1,2})[:.](\d{2})$/.exec(trimmed);
  if (!match) return { ok: false, error: 'Enter the time left as m:ss, e.g. 3:37' };
  const seconds = Number(match[2]);
  if (seconds >= 60) return { ok: false, error: 'Seconds must be under 60' };
  const sec = Number(match[1]) * 60 + seconds;
  if (sec >= plannedMin * 60) return { ok: false, error: `Time left must be less than ${plannedMin}:00` };
  return { ok: true, sec };
}

// ---- Rounds and sessions ----

/** A round as stored: completed seconds = planned − time left. */
export function makeRound(plannedMin: number, leftSec: number, reason: SaunaExitReason | null = null): SaunaRound {
  const planned = plannedMin * 60;
  const left = Math.min(planned, Math.max(0, Math.round(leftSec)));
  return { plannedMin, leftSec: left, completedSec: planned - left, reason: left > 0 ? reason : null };
}

export const isRoundComplete = (r: SaunaRound) => r.leftSec === 0;

/** "Round 2: 15 min, left with 3:37 remaining" or "Round 1: 15 min, completed" (as entered). */
export function roundText(r: SaunaRound, index: number): string {
  const head = `Round ${index + 1}: ${r.plannedMin} min, `;
  return isRoundComplete(r) ? `${head}completed` : `${head}left with ${formatMmSs(r.leftSec)} remaining`;
}

/** "2 × 15 min", or "15 + 20 min" when the rounds differ. */
export function planText(minutes: number[]): string {
  if (minutes.length === 0) return '';
  return minutes.every((m) => m === minutes[0])
    ? `${minutes.length} × ${minutes[0]} min`
    : `${minutes.join(' + ')} min`;
}

export const planOf = (s: SaunaSession) => s.rounds.map((r) => r.plannedMin);

export const isSession = (e: SaunaEntry): e is SaunaSession => e.kind === 'session';

export const allRoundsComplete = (s: SaunaSession) => s.rounds.every(isRoundComplete);

/** Oldest first: by day, then by when it was logged. */
export function byDate(a: SaunaEntry, b: SaunaEntry): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return a.createdAt - b.createdAt;
}

// ---- Weeks and consistency ----

export interface SaunaWeek {
  /** Monday, "YYYY-MM-DD". */
  weekStart: string;
  sessions: number;
  skips: number;
  /** Sessions plus skips reached the target. */
  met: boolean;
}

/** A skip is excused: it counts towards the target, so it can never make a week fall short. */
export function weekMet(sessions: number, skips: number, target: number): boolean {
  return sessions + skips >= target;
}

/** The last `weeks` weeks (Monday–Sunday), oldest first, including empty ones. */
export function saunaWeeks(entries: SaunaEntry[], today: string, target: number, weeks = WEEKS_SHOWN): SaunaWeek[] {
  const thisWeek = weekStartYmd(today);
  const result: SaunaWeek[] = Array.from({ length: weeks }, (_, i) => ({
    weekStart: addDaysYmd(thisWeek, -7 * (weeks - 1 - i)),
    sessions: 0,
    skips: 0,
    met: false,
  }));
  const byStart = new Map(result.map((w) => [w.weekStart, w]));
  for (const e of entries) {
    const week = byStart.get(weekStartYmd(e.date));
    if (!week) continue;
    if (e.kind === 'session') week.sessions++;
    else week.skips++;
  }
  for (const w of result) w.met = weekMet(w.sessions, w.skips, target);
  return result;
}

export interface Consistency {
  met: number;
  of: number;
}

/**
 * Weeks on target, out of the shown weeks since the first entry (weeks before
 * you started don't count). This week counts only once it's met, because it
 * isn't over yet: it can add to the score but never lower it.
 */
export function consistency(weeks: SaunaWeek[], firstDate: string | null): Consistency {
  if (firstDate === null) return { met: 0, of: 0 };
  const first = weekStartYmd(firstDate);
  const counted = weeks.filter((w, i) => w.weekStart >= first && (i < weeks.length - 1 || w.met));
  return { met: counted.filter((w) => w.met).length, of: counted.length };
}

// ---- Calendar ----

export type DayStatus = 'completed' | 'partial' | 'skipped';

const RANK: Record<DayStatus, number> = { completed: 3, partial: 2, skipped: 1 };

/** Each day's status; with several entries on a day, the best one wins. Days with no entry are absent. */
export function dayStatuses(entries: SaunaEntry[]): Map<string, DayStatus> {
  const days = new Map<string, DayStatus>();
  for (const e of entries) {
    const status: DayStatus = e.kind === 'skip' ? 'skipped' : allRoundsComplete(e) ? 'completed' : 'partial';
    const current = days.get(e.date);
    if (!current || RANK[status] > RANK[current]) days.set(e.date, status);
  }
  return days;
}

/** The weeks of a month ("YYYY-MM"), Monday first; days outside the month are null. */
export function monthGrid(month: string): (string | null)[][] {
  const end = `${addMonths(month, 1)}-01`;
  const weeks: (string | null)[][] = [];
  let day = weekStartYmd(`${month}-01`);
  while (day < end) {
    const week: (string | null)[] = [];
    for (let i = 0; i < 7; i++, day = addDaysYmd(day, 1)) week.push(day.startsWith(month) ? day : null);
    weeks.push(week);
  }
  return weeks;
}

// ---- Stats ----

/** The most recent `limit` sessions (skips left out), oldest first. */
export function recentSessions(entries: SaunaEntry[], limit = RECENT_SESSIONS): SaunaSession[] {
  return entries.filter(isSession).sort(byDate).slice(-limit);
}

export interface RoundStats {
  rounds: number;
  /** Rounds completed as planned (no time left). */
  completed: number;
  /** completed / rounds, or null with no rounds. */
  rate: number | null;
  /** Average completed minutes per round, or null with no rounds. */
  avgMinutes: number | null;
}

export function roundStats(sessions: SaunaSession[]): RoundStats {
  const rounds = sessions.flatMap((s) => s.rounds);
  if (rounds.length === 0) return { rounds: 0, completed: 0, rate: null, avgMinutes: null };
  const completed = rounds.filter(isRoundComplete).length;
  const seconds = rounds.reduce((n, r) => n + r.completedSec, 0);
  return { rounds: rounds.length, completed, rate: completed / rounds.length, avgMinutes: seconds / rounds.length / 60 };
}

// ---- Stepping up ----

/**
 * The next step from a plan: lengthen every round to the longest option first,
 * then add a round at the shortest length, up to MAX_ROUNDS. Null at the top.
 * 2 × 15 → 2 × 20 → 20 + 20 + 15 → 3 × 20.
 */
export function nextPlan(plan: number[]): number[] | null {
  const longest = Math.max(...ROUND_MINUTES);
  if (plan.some((m) => m < longest)) return plan.map(() => longest);
  if (plan.length < MAX_ROUNDS) return [...plan, Math.min(...ROUND_MINUTES)];
  return null;
}

export interface StepUp {
  current: number[];
  next: number[];
  /** The latest session it's based on (so it can be dismissed until the next one). */
  latestId: string;
}

/** See STEP_UP_SESSIONS. Shows nothing after a round left early or a low feel score. */
export function stepUpSuggestion(entries: SaunaEntry[], today: string): StepUp | null {
  const last = recentSessions(entries, STEP_UP_SESSIONS);
  if (last.length < STEP_UP_SESSIONS) return null;
  if (last[0].date < addDaysYmd(today, -STEP_UP_WITHIN_DAYS)) return null;
  const plan = planOf(last.at(-1)!);
  const samePlan = last.every((s) => planOf(s).join() === plan.join());
  const easy = last.every((s) => allRoundsComplete(s) && s.feel >= STEP_UP_MIN_FEEL);
  if (!samePlan || !easy) return null;
  const next = nextPlan(plan);
  return next ? { current: plan, next, latestId: last.at(-1)!.id } : null;
}
