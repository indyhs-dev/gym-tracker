import { Dexie, type EntityTable } from 'dexie';
import { defaultSettings } from './defaults';
import type { Exercise, Session, Settings, Template } from './types';

export const db = new Dexie('gym-log') as Dexie & {
  exercises: EntityTable<Exercise, 'id'>;
  templates: EntityTable<Template, 'id'>;
  sessions: EntityTable<Session, 'id'>;
  settings: EntityTable<Settings, 'id'>;
};

db.version(1).stores({
  exercises: 'id, &nameKey',
  templates: 'id, order',
  sessions: 'id, status, startedAt, *exerciseIds',
  settings: 'id',
});

// v2–v3 added a sauna log (saunaEntries), removed in Oct 2026. The table stays declared but
// unused, so entries already on a phone are left alone rather than deleted.
db.version(3).stores({
  saunaEntries: 'id, date',
});

// v4: settings drop the old sauna target, so backups no longer carry it.
db.version(4)
  .stores({})
  .upgrade((tx) =>
    tx
      .table('settings')
      .toCollection()
      .modify((s: Record<string, unknown>) => {
        delete s.sauna;
      }),
  );

db.on('populate', (tx) => {
  tx.table('settings').add(defaultSettings());
});
