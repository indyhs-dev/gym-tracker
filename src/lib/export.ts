import type { Exercise, Session } from '../db/types';
import { formatKg } from './format';
import { setText } from './setText';
import { DAY_MS, formatDuration, toDateInput } from './time';

// ---- CSV of every set ----

export const CSV_COLUMNS = ['date', 'session', 'exercise', 'set number', 'weight', 'reps', 'warm-up', 'note'];

function csvField(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * One row per set from finished sessions, oldest first. Set number counts every
 * set of that exercise in the session (warm-ups included). Weight is in kg as
 * entered (per hand for dumbbell exercises, added load for bodyweight ones).
 */
export function buildCsv(sessions: Session[], exercises: Map<string, Exercise>): string {
  const rows = [CSV_COLUMNS];
  const finished = sessions.filter((s) => s.status === 'finished').sort((a, b) => a.startedAt - b.startedAt);
  for (const s of finished) {
    for (const item of s.exercises) {
      item.sets.forEach((set, i) => {
        rows.push([
          toDateInput(s.startedAt),
          s.templateName ?? 'Blank',
          exercises.get(item.exerciseId)?.name ?? 'Unknown exercise',
          String(i + 1),
          set.weight === null ? '' : formatKg(set.weight),
          set.reps === null ? '' : String(set.reps),
          set.warmup ? 'yes' : 'no',
          set.note,
        ]);
      });
    }
  }
  // BOM so spreadsheet apps read the file as UTF-8.
  return '﻿' + rows.map((r) => r.map(csvField).join(',')).join('\r\n') + '\r\n';
}

// ---- "Copy for Claude": compact plain-text summary ----

// Fixed English formats so the text is the same on every device.
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const longDate = (ms: number) => {
  const d = new Date(ms);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};
const clock = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Finished sessions whose start falls on a day from `from` to `to` ("YYYY-MM-DD", inclusive). */
export function sessionsInRange(sessions: Session[], from: string, to: string): Session[] {
  return sessions
    .filter((s) => s.status === 'finished')
    .filter((s) => {
      const day = toDateInput(s.startedAt);
      return day >= from && day <= to;
    })
    .sort((a, b) => a.startedAt - b.startedAt);
}

export function claudeSummary(sessions: Session[], exercises: Map<string, Exercise>, from: string, to: string): string {
  const list = sessionsInRange(sessions, from, to);
  const lines = [
    `Gym log ${from} to ${to}: ${list.length} session${list.length === 1 ? '' : 's'}.`,
    'Weights in kg ("each" = per dumbbell, BW = bodyweight, BW+n = added load). W = warm-up set.',
  ];
  for (const s of list) {
    const duration = s.endedAt !== null ? ` (${formatDuration(s.endedAt - s.startedAt)})` : '';
    const times = s.endedAt !== null ? `${clock(s.startedAt)}–${clock(s.endedAt)}` : clock(s.startedAt);
    lines.push('', `${longDate(s.startedAt)} · ${s.templateName ?? 'Blank workout'} · ${times}${duration}`);
    if (s.note.trim()) lines.push(`Session note: ${s.note.trim()}`);
    for (const item of s.exercises) {
      const exercise = exercises.get(item.exerciseId);
      const name = `${exercise?.name ?? 'Unknown exercise'}${exercise?.perHand ? ' (each)' : ''}`;
      const sets = item.sets
        .map((set) => `${set.warmup ? 'W ' : ''}${setText(set, exercise).replace(' × ', '×')}${set.note.trim() ? ` [${set.note.trim()}]` : ''}`)
        .join(', ');
      lines.push(`- ${name}: ${sets || 'no sets'}${item.note.trim() ? `. Note: ${item.note.trim()}` : ''}`);
    }
  }
  return lines.join('\n') + '\n';
}

// ---- Backup reminder ----

export const BACKUP_REMINDER_DAYS = 14;

/**
 * True when it's been more than 14 days since the last JSON backup. Before the
 * first backup, the clock starts at the first finished session (so a brand-new
 * app doesn't nag).
 */
export function needsBackupReminder(lastBackupAt: number | null, firstSessionAt: number | null, now: number): boolean {
  const since = lastBackupAt ?? firstSessionAt;
  return since !== null && now - since > BACKUP_REMINDER_DAYS * DAY_MS;
}
