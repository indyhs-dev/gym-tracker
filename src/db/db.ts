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

db.on('populate', (tx) => {
  tx.table('settings').add(defaultSettings());
});
