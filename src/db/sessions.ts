import { newId } from '../lib/ids';
import { addDays, startOfWeek } from '../lib/time';
import { db } from './db';
import type { Session } from './types';

export class ActiveSessionError extends Error {
  constructor() {
    super('A workout is already in progress');
  }
}

/** Fills in the derived fields. Every session write goes through this. */
export function withDerived(session: Session): Session {
  return {
    ...session,
    exerciseIds: [...new Set(session.exercises.map((e) => e.exerciseId))],
    updatedAt: Date.now(),
  };
}

export function getActiveSession(): Promise<Session | undefined> {
  return db.sessions.where('status').equals('active').first();
}

/**
 * Starts a workout from a template (or blank if `templateId` is null).
 * The template's slots are copied into the session, so later template edits
 * never change it.
 */
export async function startSession(templateId: string | null, startedAt: number): Promise<Session> {
  return db.transaction('rw', db.sessions, db.templates, async () => {
    if (await getActiveSession()) throw new ActiveSessionError();
    const template = templateId ? await db.templates.get(templateId) : undefined;
    if (templateId && !template) throw new Error('Template not found');

    const session = withDerived({
      id: newId(),
      templateId: template?.id ?? null,
      templateName: template?.name ?? null,
      status: 'active',
      startedAt,
      endedAt: null,
      note: '',
      exercises: (template?.slots ?? []).map((slot) => ({
        id: newId(),
        exerciseId: slot.exerciseId,
        slot: structuredClone(slot),
        note: '',
        sets: [],
      })),
      exerciseIds: [],
      updatedAt: 0,
    });
    await db.sessions.add(session);
    return session;
  });
}

/** Deletes a session outright (used to discard a workout started by mistake). */
export function discardSession(id: string): Promise<void> {
  return db.sessions.delete(id);
}

export function lastFinishedSession(): Promise<Session | undefined> {
  return db.sessions
    .orderBy('startedAt')
    .reverse()
    .filter((s) => s.status === 'finished')
    .first();
}

export interface WeekStats {
  sessions: number;
  totalMs: number;
}

/** Finished sessions that started this week (Monday–Sunday), and their total time. */
export function weekStats(sessions: Session[], now: number): WeekStats {
  const from = startOfWeek(now);
  const to = addDays(from, 7);
  const inWeek = sessions.filter(
    (s) => s.status === 'finished' && s.endedAt !== null && s.startedAt >= from && s.startedAt < to,
  );
  return {
    sessions: inWeek.length,
    totalMs: inWeek.reduce((sum, s) => sum + Math.max(0, s.endedAt! - s.startedAt), 0),
  };
}

export async function loadWeekStats(now: number): Promise<WeekStats> {
  const from = startOfWeek(now);
  const sessions = await db.sessions.where('startedAt').between(from, addDays(from, 7), true, false).toArray();
  return weekStats(sessions, now);
}
