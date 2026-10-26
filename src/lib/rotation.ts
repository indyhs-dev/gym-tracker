import type { Session, Template } from '../db/types';
import { addDays, isSameDay, startOfWeek } from './time';

/**
 * The template to do next: the one after the most recently done template,
 * in template order (wrapping round). The first template if none has been
 * done yet. `templates` is in template order; blank sessions are ignored.
 */
export function nextTemplate(templates: Template[], sessions: Session[]): Template | null {
  if (templates.length === 0) return null;
  const latest = sessions
    .filter((s) => s.status === 'finished' && templates.some((t) => t.id === s.templateId))
    .reduce<Session | null>((a, s) => (a === null || s.startedAt > a.startedAt ? s : a), null);
  if (!latest) return templates[0];
  const at = templates.findIndex((t) => t.id === latest.templateId);
  return templates[(at + 1) % templates.length];
}

/** Templates starting from `first`, continuing round in template order. */
export function rotationOrder(templates: Template[], first: Template | null): Template[] {
  const at = first ? templates.findIndex((t) => t.id === first.id) : -1;
  return at < 0 ? templates : [...templates.slice(at), ...templates.slice(0, at)];
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
