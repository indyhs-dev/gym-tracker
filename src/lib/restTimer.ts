import { useSyncExternalStore } from 'react';
import type { RestRange } from './rest';

/**
 * The rest timer for the live workout. Kept in localStorage rather than the
 * database: it's only needed on this phone, during this workout, and it has
 * to survive the app being closed or the phone locking. Time is worked out
 * from `startedAt`, so it stays right while the app is in the background.
 */
export interface RestTimer {
  sessionId: string;
  /** The set whose ✓ started this rest. */
  setId: string;
  startedAt: number;
  /** The rest guidance text, e.g. "3–5 min". */
  text: string;
  range: RestRange;
}

interface State {
  timer: RestTimer | null;
  /** Sets ticked done in the live workout. */
  done: { sessionId: string; setIds: string[] } | null;
}

const KEY = 'gym-log.rest-timer';
const EMPTY: State = { timer: null, done: null };
const listeners = new Set<() => void>();
let state: State = load();

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as State) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

function save(next: State) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private mode or storage full: the timer still works until the app closes.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Ticks the set done and starts resting from now. */
export function startRest(sessionId: string, setId: string, text: string, range: RestRange, now = Date.now()) {
  const done = state.done?.sessionId === sessionId ? state.done.setIds.filter((id) => id !== setId) : [];
  save({
    timer: { sessionId, setId, startedAt: now, text, range },
    done: { sessionId, setIds: [...done, setId] },
  });
}

/** Hides the timer; ticked sets stay ticked. */
export function stopRest() {
  save({ ...state, timer: null });
}

/** Forgets the timer and ticks, e.g. when the workout is finished or discarded. */
export function clearRest(sessionId: string) {
  if (state.timer?.sessionId === sessionId || state.done?.sessionId === sessionId) save(EMPTY);
}

/** The running rest timer for this session, if any. */
export function useRestTimer(sessionId: string): RestTimer | null {
  const s = useSyncExternalStore(subscribe, () => state);
  return s.timer?.sessionId === sessionId ? s.timer : null;
}

/** Ids of the sets ticked done in this session. */
export function useDoneSets(sessionId: string): string[] {
  const s = useSyncExternalStore(subscribe, () => state);
  return s.done?.sessionId === sessionId ? s.done.setIds : NONE;
}

const NONE: string[] = [];
