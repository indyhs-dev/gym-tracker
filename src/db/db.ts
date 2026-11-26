import { Dexie, type EntityTable } from 'dexie';
import { defaultSettings } from './defaults';
import type { BodyScan, Exercise, Session, Settings, Template } from './types';

export const db = new Dexie('gym-log') as Dexie & {
  exercises: EntityTable<Exercise, 'id'>;
  templates: EntityTable<Template, 'id'>;
  sessions: EntityTable<Session, 'id'>;
  settings: EntityTable<Settings, 'id'>;
  bodyScans: EntityTable<BodyScan, 'id'>;
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

// v5: the starting templates go Legs, Chest & Back (renamed from Torso), Shoulders & Arms.
// Only templates with those exact names move, swapping the places they already held,
// so templates you made yourself stay put. Past sessions keep the name they were done under.
db.version(5)
  .stores({})
  .upgrade(async (tx) => {
    const templates = tx.table<Template, string>('templates');
    const all = await templates.toArray();
    const moving = ['Legs', 'Torso', 'Shoulders & Arms']
      .map((name) => all.find((t) => t.name === name))
      .filter((t): t is Template => t !== undefined);
    const places = moving.map((t) => t.order).sort((a, b) => a - b);
    const rename = !all.some((t) => t.name === 'Chest & Back');
    for (const [i, t] of moving.entries()) {
      await templates.update(t.id, { order: places[i], ...(t.name === 'Torso' && rename ? { name: 'Chest & Back' } : {}) });
    }
  });

// v6: Evolt body scans, one row per scan, indexed by local date ("YYYY-MM-DD").
db.version(6).stores({
  bodyScans: 'id, date',
});

// v7: put the starting templates back in Legs, Chest & Back, Shoulders & Arms order
// (a backup restored after v5 could bring the old order back). Same rules as v5:
// only those names move, within the places they already hold.
db.version(7)
  .stores({})
  .upgrade(async (tx) => {
    const templates = tx.table<Template, string>('templates');
    const all = await templates.toArray();
    const moving = ['Legs', 'Chest & Back', 'Shoulders & Arms']
      .map((name) => all.find((t) => t.name === name))
      .filter((t): t is Template => t !== undefined);
    const places = moving.map((t) => t.order).sort((a, b) => a - b);
    for (const [i, t] of moving.entries()) {
      if (t.order !== places[i]) await templates.update(t.id, { order: places[i] });
    }
  });

db.on('populate', (tx) => {
  tx.table('settings').add(defaultSettings());
});
