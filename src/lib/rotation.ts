import type { Session, Template } from '../db/types';
import { addDays, isSameDay, startOfWeek } from './time';

/**
 * The template to do next. Each week (Monday to Sunday) starts again from
 * the first template: next up is the first one, in template order, not done
 * yet this week. Once every template has been done this week, it's the one
 * after the most recently done (wrapping round). `templates` is in template
 * order; blank sessions are ignored.
 */
export function nextTemplate(templates: Template[], sessions: Session[], now: number): Template | null {
  if (templates.length === 0) return null;
  const monday = startOfWeek(now);
  const thisWeek = sessions.filter(
    (s) => s.status === 'finished' && s.startedAt >= monday && templates.some((t) => t.id === s.templateId),
  );
  const notYet = templates.find((t) => !thisWeek.some((s) => s.templateId === t.id));
  if (notYet) return notYet;
  const latest = thisWeek.reduce((a, s) => (s.startedAt > a.startedAt ? s : a));
  const at = templates.findIndex((t) => t.id === latest.templateId);
  return templates[(at + 1) % templates.length];
}

/** When each template was last done (the latest finished session's start). */
export function lastDoneByTemplate(sessions: Session[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const s of sessions) {
    if (s.status !== 'finished' || !s.templateId) continue;
    if ((result.get(s.templateId) ?? -Infinity) < s.startedAt) result.set(s.templateId, s.startedAt);
  }
  return result;
}

export interface WeekDay {
  /** Midnight (local) at the start of the day. */
  day: number;
  trained: boolean;
  today: boolean;
}

/** Monday to Sunday of this week: which days had a finished session, and which is today. */
export function weekDays(sessions: Session[], now: number): WeekDay[] {
  const monday = startOfWeek(now);
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(monday, i);
    return {
      day,
      trained: sessions.some((s) => s.status === 'finished' && isSameDay(s.startedAt, day)),
      today: isSameDay(day, now),
    };
  });
}
