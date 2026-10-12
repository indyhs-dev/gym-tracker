import { newId } from '../lib/ids';
import { addDays, startOfWeek } from '../lib/time';
import { db } from './db';
import type { Session, SessionExercise, WorkoutSet } from './types';

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

// ---- Editing a session. Every change is saved immediately. ----

/** Applies a change to a session inside a transaction and saves it. */
export async function mutateSession(id: string, change: (s: Session) => Session): Promise<Session> {
  return db.transaction('rw', db.sessions, async () => {
    const current = await db.sessions.get(id);
    if (!current) throw new Error('Workout not found');
    const next = withDerived(change(current));
    await db.sessions.put(next);
    return next;
  });
}

function mapExercise(s: Session, itemId: string, change: (e: SessionExercise) => SessionExercise): Session {
  return { ...s, exercises: s.exercises.map((e) => (e.id === itemId ? change(e) : e)) };
}

function mapSet(e: SessionExercise, setId: string, change: (set: WorkoutSet) => WorkoutSet): SessionExercise {
  return { ...e, sets: e.sets.map((set) => (set.id === setId ? change(set) : set)) };
}

/** Weight: kg, not negative, 2 decimals. Reps: whole, not negative. */
export function cleanWeight(kg: number | null): number | null {
  return kg === null ? null : Math.max(0, Math.round(kg * 100) / 100);
}

export function cleanReps(reps: number | null): number | null {
  return reps === null ? null : Math.max(0, Math.round(reps));
}

export type SetFields = Pick<WorkoutSet, 'weight' | 'reps' | 'warmup' | 'note'>;

export function newSet(fields: Partial<SetFields> = {}, loggedAt = Date.now(), id = newId()): WorkoutSet {
  return {
    id,
    weight: cleanWeight(fields.weight ?? null),
    reps: cleanReps(fields.reps ?? null),
    warmup: fields.warmup ?? false,
    note: fields.note ?? '',
    loggedAt,
  };
}

/** Adds a set. `id` can be supplied so the UI can keep a row's identity (e.g. a ghost row being typed into). */
export function addSet(
  sessionId: string,
  itemId: string,
  fields: Partial<SetFields> = {},
  id?: string,
): Promise<Session> {
  return mutateSession(sessionId, (s) =>
    mapExercise(s, itemId, (e) => ({ ...e, sets: [...e.sets, newSet(fields, Date.now(), id)] })),
  );
}

/** Adds several sets at once (e.g. copying the previous session's sets). */
export function addSets(sessionId: string, itemId: string, fieldsList: Partial<SetFields>[]): Promise<Session> {
  const now = Date.now();
  return mutateSession(sessionId, (s) =>
    mapExercise(s, itemId, (e) => ({ ...e, sets: [...e.sets, ...fieldsList.map((f) => newSet(f, now))] })),
  );
}

/** Edits a set. Its loggedAt (creation time) is left unchanged. */
export function updateSet(sessionId: string, itemId: string, setId: string, fields: Partial<SetFields>): Promise<Session> {
  const clean: Partial<SetFields> = { ...fields };
  if ('weight' in fields) clean.weight = cleanWeight(fields.weight ?? null);
  if ('reps' in fields) clean.reps = cleanReps(fields.reps ?? null);
  return mutateSession(sessionId, (s) => mapExercise(s, itemId, (e) => mapSet(e, setId, (set) => ({ ...set, ...clean }))));
}

export function deleteSet(sessionId: string, itemId: string, setId: string): Promise<Session> {
  return mutateSession(sessionId, (s) =>
    mapExercise(s, itemId, (e) => ({ ...e, sets: e.sets.filter((set) => set.id !== setId) })),
  );
}

export function setExerciseNote(sessionId: string, itemId: string, note: string): Promise<Session> {
  return mutateSession(sessionId, (s) => mapExercise(s, itemId, (e) => ({ ...e, note })));
}

export function setSessionNote(sessionId: string, note: string): Promise<Session> {
  return mutateSession(sessionId, (s) => ({ ...s, note }));
}

/** Swaps the exercise done in this slot. Any sets already logged move with it. */
export function swapExercise(sessionId: string, itemId: string, exerciseId: string): Promise<Session> {
  return mutateSession(sessionId, (s) => mapExercise(s, itemId, (e) => ({ ...e, exerciseId })));
}

/** Adds an exercise that isn't part of the template. Returns the new item's id. */
export async function addSessionExercise(sessionId: string, exerciseId: string): Promise<string> {
  const item: SessionExercise = { id: newId(), exerciseId, slot: null, note: '', sets: [] };
  await mutateSession(sessionId, (s) => ({ ...s, exercises: [...s.exercises, item] }));
  return item.id;
}

export function removeSessionExercise(sessionId: string, itemId: string): Promise<Session> {
  return mutateSession(sessionId, (s) => ({ ...s, exercises: s.exercises.filter((e) => e.id !== itemId) }));
}

// ---- Last time: the previous session's sets for an exercise ----

export interface PreviousSets {
  sessionId: string;
  startedAt: number;
  sets: WorkoutSet[];
}

/**
 * For each exercise, the sets from the most recent *finished* session that
 * started before `current` and logged that exercise. Tracked strictly per
 * exercise, so variations never mix.
 */
export async function previousSetsFor(
  exerciseIds: string[],
  current: Pick<Session, 'id' | 'startedAt'>,
): Promise<Map<string, PreviousSets>> {
  const result = new Map<string, PreviousSets>();
  for (const exerciseId of new Set(exerciseIds)) {
    const candidates = await db.sessions.where('exerciseIds').equals(exerciseId).toArray();
    const previous = candidates
      .filter((s) => s.id !== current.id && s.status === 'finished' && s.startedAt < current.startedAt)
      .sort((a, b) => b.startedAt - a.startedAt)
      .map((s) => ({
        sessionId: s.id,
        startedAt: s.startedAt,
        sets: s.exercises.filter((e) => e.exerciseId === exerciseId).flatMap((e) => e.sets),
      }))
      .find((p) => p.sets.length > 0);
    if (previous) result.set(exerciseId, previous);
  }
  return result;
}

// ---- Gym time and finishing ----

/** Longest a workout can have been running and still be "live" (timer running). */
const LIVE_WINDOW_MS = 16 * 60 * 60 * 1000;

/**
 * A live workout is one started today with the timer running. A past-dated
 * one (logged after the fact) is still `active` until saved, but has no timer.
 */
export function isLive(session: Session, now = Date.now()): boolean {
  return session.status === 'active' && now - session.startedAt < LIVE_WINDOW_MS;
}

/** Suggested end time: when the last set was logged (or now if none). */
export function suggestedEnd(session: Session, now = Date.now()): number {
  const last = Math.max(0, ...session.exercises.flatMap((e) => e.sets.map((set) => set.loggedAt)));
  return last > session.startedAt ? last : now;
}

/** Finishes a workout with the given times. Exercises with no sets (skipped) are dropped. */
export function finishSession(id: string, startedAt: number, endedAt: number): Promise<Session> {
  if (endedAt < startedAt) throw new Error('End time is before the start time');
  return mutateSession(id, (s) => ({
    ...s,
    status: 'finished',
    startedAt,
    endedAt,
    exercises: s.exercises.filter((e) => e.sets.length > 0),
  }));
}

/** Changes the start/end of a session (e.g. editing a past one). */
export function setSessionTimes(id: string, startedAt: number, endedAt: number | null): Promise<Session> {
  if (endedAt !== null && endedAt < startedAt) throw new Error('End time is before the start time');
  return mutateSession(id, (s) => ({ ...s, startedAt, endedAt }));
}
