import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/db';
import {
  addSlot,
  createTemplate,
  deleteTemplate,
  duplicateTemplate,
  moveSlot,
  newSlot,
  normaliseSlot,
  removeSlot,
  renameTemplate,
  updateSlot,
  withAlternative,
  withDefault,
  withoutAlternative,
} from '../src/db/templates';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('templates', () => {
  it('are created in order with a cleaned name', async () => {
    const a = await createTemplate('  Torso ');
    const b = await createTemplate('Legs');
    expect(a).toMatchObject({ name: 'Torso', order: 0, slots: [] });
    expect(b.order).toBe(1);
    await expect(createTemplate('  ')).rejects.toThrow('Name is required');
  });

  it('rename rejects an empty name and keeps the old one', async () => {
    const t = await createTemplate('Torso');
    await renameTemplate(t.id, 'Upper');
    await expect(renameTemplate(t.id, '')).rejects.toThrow();
    expect((await db.templates.get(t.id))?.name).toBe('Upper');
  });

  it('duplicate copies slots with fresh ids and leaves the original alone', async () => {
    const t = await createTemplate('Torso');
    await addSlot(t.id, 'ex1');
    await addSlot(t.id, 'ex2');
    const original = (await db.templates.get(t.id))!;
    const copy = await duplicateTemplate(t.id);

    expect(copy.name).toBe('Torso (copy)');
    expect(copy.id).not.toBe(t.id);
    expect(copy.order).toBe(1);
    expect(copy.slots.map((s) => s.exerciseId)).toEqual(['ex1', 'ex2']);
    expect(copy.slots.map((s) => s.id)).not.toContain(original.slots[0].id);

    await updateSlot(copy.id, copy.slots[0].id, (s) => ({ ...s, targetSets: 4 }));
    expect((await db.templates.get(t.id))!.slots[0].targetSets).toBe(2);
  });

  it('delete removes only that template', async () => {
    const t = await createTemplate('Torso');
    await createTemplate('Legs');
    await deleteTemplate(t.id);
    expect((await db.templates.toArray()).map((x) => x.name)).toEqual(['Legs']);
  });
});

describe('slots', () => {
  it('are added with defaults, moved and removed', async () => {
    const t = await createTemplate('Torso');
    const a = await addSlot(t.id, 'a');
    const b = await addSlot(t.id, 'b');
    const c = await addSlot(t.id, 'c');
    expect(a).toMatchObject({ targetSets: 2, repMin: 8, repMax: 12, warmup: 'none', alternativeIds: [] });

    await moveSlot(t.id, c.id, -1);
    await moveSlot(t.id, a.id, -1); // already first: no-op
    let order = (await db.templates.get(t.id))!.slots.map((s) => s.exerciseId);
    expect(order).toEqual(['a', 'c', 'b']);

    await moveSlot(t.id, a.id, 1);
    await moveSlot(t.id, b.id, 1); // already last: no-op
    order = (await db.templates.get(t.id))!.slots.map((s) => s.exerciseId);
    expect(order).toEqual(['c', 'a', 'b']);

    await removeSlot(t.id, a.id);
    order = (await db.templates.get(t.id))!.slots.map((s) => s.exerciseId);
    expect(order).toEqual(['c', 'b']);
  });

  it('updateSlot keeps values in range', async () => {
    const t = await createTemplate('Torso');
    const s = await addSlot(t.id, 'a');
    await updateSlot(t.id, s.id, (x) => ({ ...x, targetSets: 0, repMin: 15, repMax: 10 }));
    expect((await db.templates.get(t.id))!.slots[0]).toMatchObject({ targetSets: 1, repMin: 15, repMax: 15 });
  });

  it('normaliseSlot rounds and clamps', () => {
    expect(normaliseSlot({ ...newSlot('a'), targetSets: 2.6, repMin: -3, repMax: 500 })).toMatchObject({
      targetSets: 3,
      repMin: 1,
      repMax: 100,
    });
  });
});

describe('slot exercise helpers', () => {
  const base = { ...newSlot('knee'), alternativeIds: ['lsit', 'pike'] };

  it('withDefault swaps an alternative with the old default', () => {
    const s = withDefault(base, 'lsit');
    expect(s.exerciseId).toBe('lsit');
    expect(s.alternativeIds).toEqual(['knee', 'pike']);
  });

  it('withDefault with a new exercise replaces the default only', () => {
    const s = withDefault(base, 'other');
    expect(s.exerciseId).toBe('other');
    expect(s.alternativeIds).toEqual(['lsit', 'pike']);
  });

  it('withAlternative ignores the default and duplicates', () => {
    expect(withAlternative(base, 'knee').alternativeIds).toEqual(['lsit', 'pike']);
    expect(withAlternative(base, 'pike').alternativeIds).toEqual(['lsit', 'pike']);
    expect(withAlternative(base, 'new').alternativeIds).toEqual(['lsit', 'pike', 'new']);
    expect(withoutAlternative(base, 'lsit').alternativeIds).toEqual(['pike']);
  });
});
