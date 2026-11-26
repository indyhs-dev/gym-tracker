import { Dexie } from 'dexie';
import { expect, it } from 'vitest';
import { db } from '../src/db/db';

it('v7 puts Legs, Chest & Back, Shoulders & Arms back in order, leaving other templates put', async () => {
  db.close();
  await Dexie.delete('gym-log');
  // A v6 database holding the old order (as a pre-v5 backup restore would leave it).
  const old = new Dexie('gym-log');
  old.version(6).stores({ templates: 'id, order' });
  await old.open();
  await old.table('templates').bulkAdd([
    { id: 'sa', name: 'Shoulders & Arms', order: 0, slots: [] },
    { id: 'mine', name: 'Cardio', order: 1, slots: [] },
    { id: 'cb', name: 'Chest & Back', order: 2, slots: [] },
    { id: 'legs', name: 'Legs', order: 3, slots: [] },
  ]);
  old.close();

  await db.open();
  const names = (await db.templates.orderBy('order').toArray()).map((t) => t.name);
  expect(names).toEqual(['Legs', 'Cardio', 'Chest & Back', 'Shoulders & Arms']);
});
