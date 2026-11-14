import { db } from './db';
import { withDefaults } from './settings';
import type { BodyScan, Exercise, Session, Settings, Template } from './types';

export const BACKUP_FORMAT = 'gym-log-backup';
// v2 added saunaEntries (sauna log, since removed). v1 and v2 backups both restore; any
// saunaEntries in them are ignored. New backups have no sauna data.
// v3 added bodyScans. Older backups have none; restoring one leaves the scans on the phone alone.
export const BACKUP_VERSION = 3;

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: number;
  data: {
    exercises: Exercise[];
    templates: Template[];
    sessions: Session[];
    settings: Settings[];
    /** Missing in backups made before v3. */
    bodyScans?: BodyScan[];
  };
}

export class BackupError extends Error {}

export async function readAll(): Promise<Backup['data']> {
  const [exercises, templates, sessions, settings, bodyScans] = await Promise.all([
    db.exercises.toArray(),
    db.templates.toArray(),
    db.sessions.toArray(),
    db.settings.toArray(),
    db.bodyScans.toArray(),
  ]);
  return { exercises, templates, sessions, settings, bodyScans };
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
  if (d.bodyScans !== undefined && !(isObjectArray(d.bodyScans) && d.bodyScans.every((s) => typeof s.date === 'string'))) {
    throw new BackupError('This backup file is incomplete or damaged.');
  }
  for (const s of d.sessions as Session[]) {
    if (!Array.isArray(s.exercises) || typeof s.startedAt !== 'number') {
      throw new BackupError('This backup file is incomplete or damaged.');
    }
  }
  return b as Backup;
}

/**
 * Replaces everything in the app with the backup's contents. Body scans are replaced only if
 * the backup has them: an older backup (no scans) leaves the scans on the phone untouched.
 */
export async function restoreBackup(backup: Backup): Promise<void> {
  const { exercises, templates, sessions, settings, bodyScans } = backup.data;
  await db.transaction('rw', [db.exercises, db.templates, db.sessions, db.settings, db.bodyScans], async () => {
    await Promise.all([db.exercises.clear(), db.templates.clear(), db.sessions.clear(), db.settings.clear()]);
    if (bodyScans) {
      await db.bodyScans.clear();
      await db.bodyScans.bulkAdd(bodyScans);
    }
    await db.exercises.bulkAdd(exercises);
    await db.templates.bulkAdd(templates);
    await db.sessions.bulkAdd(sessions);
    const saved = settings.find((s) => s.id === 'app');
    // Never re-run first-launch seeding on top of restored data.
    await db.settings.put({ ...withDefaults(saved), seededAt: saved?.seededAt ?? backup.exportedAt });
  });
}
