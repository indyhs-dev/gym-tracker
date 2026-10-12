const DAY_MS = 24 * 60 * 60 * 1000;

/** Monday 00:00 (local) of the week containing `ms`. */
export function startOfWeek(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

/** Adds calendar days (DST-safe). */
export function addDays(ms: number, days: number): number {
  const d = new Date(ms);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

/** "YYYY-MM-DD" in local time, as used by <input type="date">. */
export function toDateInput(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Start time for a workout on the chosen date: now if it's today, otherwise
 * that date at the current time of day (adjusted later when logging past sessions).
 */
export function startTimeFor(dateInput: string, now: number): number {
  if (dateInput === toDateInput(now)) return now;
  const [y, m, d] = dateInput.split('-').map(Number);
  const t = new Date(now);
  return new Date(y, m - 1, d, t.getHours(), t.getMinutes()).getTime();
}

/** "45m", "1h 5m", "2h". */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** "Mon 12 Oct" (follows the device's locale). */
export function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** "Monday 12 October" */
export function formatLongDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

/** "18:05" or "6:05 pm", following the device's setting. */
export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function isSameDay(a: number, b: number): boolean {
  return toDateInput(a) === toDateInput(b);
}

export { DAY_MS };

/** "42:13" under an hour, "1:02:13" after. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** "HH:MM" (24h) in local time, as used by <input type="time">. */
export function toTimeInput(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** The same local day as `dayMs`, at "HH:MM". */
export function atTime(dayMs: number, time: string): number {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(dayMs);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

/** End time on the start's day; if that's before the start, the session ran past midnight. */
export function endAtTime(startMs: number, time: string): number {
  const end = atTime(startMs, time);
  return end < startMs ? addDays(end, 1) : end;
}
