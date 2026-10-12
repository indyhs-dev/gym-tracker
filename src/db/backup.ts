import { db } from './db';
import { defaultSettings } from './defaults';
import type { Exercise, Session, Settings, Template } from './types';

export const BACKUP_FORMAT = 'gym-log-backup';
export const BACKUP_VERSION = 1;

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: number;
  data: {
    exercises: Exercise[];
    templates: Template[];
    sessions: Session[];
    settings: Settings[];
  };
}

export class BackupError extends Error {}

export async function readAll(): Promise<Backup['data']> {
  const [exercises, templates, sessions, settings] = await Promise.all([
    db.exercises.toArray(),
    db.templates.toArray(),
    db.sessions.toArray(),
    db.settings.toArray(),
  ]);
  return { exercises, templates, sessions, settings };
}

export function makeBackup(data: Backup['data'], now = Date.now()): Backup {
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now, data };
}

const isObjectArray = (v: unknown): v is Record<string, unknown>[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'object' && x !== null && typeof (x as { id?: unknown }).id === 'string');

/** Checks a backup file's text. Throws BackupError with a readable message if it isn't one. */
export function parseBackup(text: string): Backup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('That file isn’t a Gym Log backup (not valid JSON).');
  }
  const b = raw as Partial<Backup>;
  if (b?.format !== BACKUP_FORMAT) throw new BackupError('That file isn’t a Gym Log backup.');
  if (typeof b.version !== 'number' || b.version > BACKUP_VERSION) {
    throw new BackupError('This backup was made by a newer version of the app.');
  }
  const d = b.data;
  if (!d || !isObjectArray(d.exercises) || !isObjectArray(d.templates) || !isObjectArray(d.sessions) || !isObjectArray(d.settings)) {
    throw new BackupError('This backup file is incomplete or damaged.');
  }
  for (const s of d.sessions as Session[]) {
    if (!Array.isArray(s.exercises) || typeof s.startedAt !== 'number') {
      throw new BackupError('This backup file is incomplete or damaged.');
    }
  }
  return b as Backup;
}

/** Replaces everything in the app with the backup's contents. */
export async function restoreBackup(backup: Backup): Promise<void> {
  const { exercises, templates, sessions, settings } = backup.data;
  await db.transaction('rw', db.exercises, db.templates, db.sessions, db.settings, async () => {
    await Promise.all([db.exercises.clear(), db.templates.clear(), db.sessions.clear(), db.settings.clear()]);
    await db.exercises.bulkAdd(exercises);
    await db.templates.bulkAdd(templates);
    await db.sessions.bulkAdd(sessions);
    const saved = settings.find((s) => s.id === 'app');
    // Never re-run first-launch seeding on top of restored data.
    await db.settings.put({ ...defaultSettings(), ...saved, id: 'app', seededAt: saved?.seededAt ?? backup.exportedAt });
  });
}
