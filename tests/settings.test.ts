import { Dexie } from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/db';
import { DEFAULT_REST } from '../src/db/defaults';
import { getSettings, updateSettings, withDefaults } from '../src/db/settings';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('settings', () => {
  it('are created with the default rest guidance on first open', async () => {
    const stored = await db.settings.get('app');
    expect(stored?.rest).toEqual(DEFAULT_REST);
    expect(stored?.lastBackupAt).toBeNull();
  });

  it('update merges a patch', async () => {
    await updateSettings({ rest: { ...DEFAULT_REST, compound: '4–5 min' } });
    const s = await getSettings();
    expect(s.rest.compound).toBe('4–5 min');
    expect(s.rest.core).toBe('60–90 s');
    expect(s.seededAt).toBeNull();
  });

  it('leave out the old sauna target from settings saved before it was removed', () => {
    const old = { ...withDefaults(undefined), sauna: { weeklyTarget: 3, samplesAddedAt: null } };
    expect(withDefaults(old)).not.toHaveProperty('sauna');
  });
});

describe('database upgrade', () => {
  it('opens a phone’s v3 database: sauna entries left alone, sauna target dropped from settings', async () => {
    db.close();
    await Dexie.delete('gym-log');
    const v3 = new Dexie('gym-log');
    v3.version(3).stores({
      exercises: 'id, &nameKey',
      templates: 'id, order',
      sessions: 'id, status, startedAt, *exerciseIds',
      settings: 'id',
      saunaEntries: 'id, date',
    });
    await v3.table('settings').put({ ...withDefaults(undefined), lastBackupAt: 5, sauna: { weeklyTarget: 3, samplesAddedAt: 1 } });
    await v3.table('saunaEntries').put({ id: 'x', date: '2026-10-13' });
    v3.close();

    await db.open();
    const settings = await db.settings.get('app');
    expect(settings?.lastBackupAt).toBe(5);
    expect(settings).not.toHaveProperty('sauna');
    expect(await db.table('saunaEntries').count()).toBe(1);
  });

  it('opens a phone’s v4 database: starting templates go Legs, Chest & Back, Shoulders & Arms; your own stay put', async () => {
    db.close();
    await Dexie.delete('gym-log');
    const v4 = new Dexie('gym-log');
    v4.version(4).stores({
      exercises: 'id, &nameKey',
      templates: 'id, order',
      sessions: 'id, status, startedAt, *exerciseIds',
      settings: 'id',
      saunaEntries: 'id, date',
    });
    const template = (id: string, name: string, order: number) => ({ id, name, order, slots: [], createdAt: 0, updatedAt: 0 });
    await v4.table('templates').bulkPut([
      template('mine', 'Mine', 0),
      template('torso', 'Torso', 1),
      template('legs', 'Legs', 2),
      template('arms', 'Shoulders & Arms', 3),
      template('extra', 'Extra', 4),
    ]);
    await v4.table('sessions').put({ id: 's', templateId: 'torso', templateName: 'Torso', status: 'finished', startedAt: 1, exerciseIds: [] });
    v4.close();

    await db.open();
    const names = (await db.templates.orderBy('order').toArray()).map((t) => t.name);
    expect(names).toEqual(['Mine', 'Legs', 'Chest & Back', 'Shoulders & Arms', 'Extra']);
    expect((await db.sessions.get('s'))?.templateName).toBe('Torso');
  });

  it('leaves Torso’s name alone if there’s already a Chest & Back', async () => {
    db.close();
    await Dexie.delete('gym-log');
    const v4 = new Dexie('gym-log');
    v4.version(4).stores({ templates: 'id, order', settings: 'id' });
    const template = (id: string, name: string, order: number) => ({ id, name, order, slots: [], createdAt: 0, updatedAt: 0 });
    await v4.table('templates').bulkPut([template('torso', 'Torso', 0), template('cb', 'Chest & Back', 1), template('legs', 'Legs', 2)]);
    v4.close();

    await db.open();
    const names = (await db.templates.orderBy('order').toArray()).map((t) => t.name);
    expect(names).toEqual(['Legs', 'Chest & Back', 'Torso']);
  });
});
