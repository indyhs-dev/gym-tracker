import { newId } from '../lib/ids';
import {
  addDaysYmd,
  byDate,
  isSession,
  isYmd,
  makeRound,
  MAX_ROUNDS,
  MIN_ROUNDS,
  saunaToday,
  weekStartYmd,
} from '../lib/sauna';
import { db } from './db';
import { getSettings } from './settings';
import type { SaunaEntry, SaunaFeel, SaunaSession, SaunaSkip } from './types';

type Meta = 'id' | 'kind' | 'sample' | 'createdAt' | 'updatedAt';
/** Omit for each member of a union (plain Omit keeps only the shared fields). */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type SaunaSessionFields = Omit<SaunaSession, Meta>;
export type SaunaSkipFields = Omit<SaunaSkip, Meta>;

/** All sauna entries (sessions and skips), oldest first. */
export async function saunaEntries(): Promise<SaunaEntry[]> {
  return (await db.saunaEntries.toArray()).sort(byDate);
}

/** The most recent session (by day, then time logged), for pre-filling the next one. */
export async function lastSaunaSession(): Promise<SaunaSession | null> {
  return (await saunaEntries()).filter(isSession).at(-1) ?? null;
}

function checkDate(date: string) {
  if (!isYmd(date)) throw new Error('Choose a date');
}

/** Rounds are rebuilt so completed seconds always equal planned − left. */
function cleanSession(f: SaunaSessionFields): SaunaSessionFields {
  checkDate(f.date);
  if (f.rounds.length < MIN_ROUNDS || f.rounds.length > MAX_ROUNDS) throw new Error('A session has 1–3 rounds');
  const feel = Math.round(f.feel);
  if (!(feel >= 1 && feel <= 5)) throw new Error('Choose how it felt');
  return {
    date: f.date,
    context: f.context,
    rounds: f.rounds.map((r) => makeRound(r.plannedMin, r.leftSec, r.reason)),
    bench: f.bench,
    temp: f.temp,
    feel: feel as SaunaFeel,
    water: f.water,
  };
}

/** Adds an entry, or replaces the one with `id` (keeping when it was first logged). Returns its id. */
async function saveEntry(data: DistributiveOmit<SaunaEntry, 'id' | 'createdAt' | 'updatedAt'>, id?: string): Promise<string> {
  return db.transaction('rw', db.saunaEntries, async () => {
    const now = Date.now();
    const existing = id ? await db.saunaEntries.get(id) : undefined;
    if (id && !existing) throw new Error('This entry no longer exists');
    const entry = {
      ...data,
      ...(existing?.sample ? { sample: true } : {}),
      id: existing?.id ?? newId(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    } as SaunaEntry;
    await db.saunaEntries.put(entry);
    return entry.id;
  });
}

export async function saveSaunaSession(fields: SaunaSessionFields, id?: string): Promise<string> {
  return saveEntry({ kind: 'session', ...cleanSession(fields) }, id);
}

export async function saveSaunaSkip(fields: SaunaSkipFields, id?: string): Promise<string> {
  checkDate(fields.date);
  return saveEntry({ kind: 'skip', date: fields.date, reason: fields.reason }, id);
}

export function deleteSaunaEntry(id: string): Promise<void> {
  return db.saunaEntries.delete(id);
}

// ---- Sample sessions (to try the charts; remove them in Settings → Sauna) ----

/**
 * Adds three sample sessions on Monday–Wednesday of this week, once. If this
 * week's Wednesday hasn't happened yet (Mon/Tue), last week's are used, so
 * nothing is dated in the future. Never runs again once done or removed.
 */
export async function seedSaunaSamplesIfNeeded(now = Date.now()): Promise<boolean> {
  return db.transaction('rw', db.saunaEntries, db.settings, async () => {
    const settings = await getSettings();
    if (settings.sauna.samplesAddedAt !== null) return false;

    const monday = weekStartYmd(addDaysYmd(saunaToday(now), -2));
    const session = (day: number, fields: Omit<SaunaSessionFields, 'date'>): SaunaSession => ({
      id: newId(),
      kind: 'session',
      sample: true,
      date: addDaysYmd(monday, day),
      ...fields,
      createdAt: now + day,
      updatedAt: now + day,
    });
    await db.saunaEntries.bulkAdd([
      session(0, {
        context: 'afterLifting',
        rounds: [makeRound(15, 0), makeRound(15, 0)],
        bench: 'upper',
        temp: 'mid',
        feel: 3,
        water: true,
      }),
      session(1, {
        context: 'afterCardio',
        rounds: [makeRound(15, 0), makeRound(15, 3 * 60 + 37, 'tooHot')],
        bench: 'upper',
        temp: 'high',
        feel: 2,
        water: true,
      }),
      session(2, {
        context: 'afterLifting',
        rounds: [makeRound(15, 0), makeRound(15, 0)],
        bench: 'lower',
        temp: 'mid',
        feel: 4,
        water: false,
      }),
    ]);
    await db.settings.put({ ...settings, sauna: { ...settings.sauna, samplesAddedAt: now } });
    return true;
  });
}

export function countSaunaSamples(): Promise<number> {
  return db.saunaEntries.filter((e) => e.sample === true).count();
}

/** Deletes the sample sessions (and only them). Returns how many were removed. */
export function removeSaunaSamples(): Promise<number> {
  return db.saunaEntries.filter((e) => e.sample === true).delete();
}
