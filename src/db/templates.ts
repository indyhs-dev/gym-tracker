import { newId } from '../lib/ids';
import { db } from './db';
import type { Template, TemplateSlot } from './types';

export const MAX_SETS = 20;
export const MAX_REPS = 100;

export function newSlot(exerciseId: string): TemplateSlot {
  return {
    id: newId(),
    exerciseId,
    alternativeIds: [],
    targetSets: 2,
    repMin: 8,
    repMax: 12,
    warmup: 'none',
    planNote: '',
  };
}

function cleanTemplateName(name: string): string {
  const cleaned = name.trim().replace(/\s+/g, ' ');
  if (!cleaned) throw new Error('Name is required');
  return cleaned;
}

/** Keeps counts whole and in range, and the rep range the right way round. */
export function normaliseSlot(slot: TemplateSlot): TemplateSlot {
  const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)));
  const repMin = clamp(slot.repMin, 1, MAX_REPS);
  return {
    ...slot,
    targetSets: clamp(slot.targetSets, 1, MAX_SETS),
    repMin,
    repMax: clamp(slot.repMax, repMin, MAX_REPS),
  };
}

/**
 * Makes `exerciseId` the slot's default. If it was an alternative, the old
 * default takes its place in the alternatives (handy when progressing, e.g.
 * Knee Raise → L-sit).
 */
export function withDefault(slot: TemplateSlot, exerciseId: string): TemplateSlot {
  if (exerciseId === slot.exerciseId) return slot;
  const alternativeIds = slot.alternativeIds.includes(exerciseId)
    ? slot.alternativeIds.map((id) => (id === exerciseId ? slot.exerciseId : id))
    : slot.alternativeIds;
  return { ...slot, exerciseId, alternativeIds };
}

export function withAlternative(slot: TemplateSlot, exerciseId: string): TemplateSlot {
  if (exerciseId === slot.exerciseId || slot.alternativeIds.includes(exerciseId)) return slot;
  return { ...slot, alternativeIds: [...slot.alternativeIds, exerciseId] };
}

export function withoutAlternative(slot: TemplateSlot, exerciseId: string): TemplateSlot {
  return { ...slot, alternativeIds: slot.alternativeIds.filter((id) => id !== exerciseId) };
}

async function nextOrder(): Promise<number> {
  const last = await db.templates.orderBy('order').last();
  return last ? last.order + 1 : 0;
}

export async function createTemplate(name: string, slots: TemplateSlot[] = []): Promise<Template> {
  return db.transaction('rw', db.templates, async () => {
    const now = Date.now();
    const template: Template = {
      id: newId(),
      name: cleanTemplateName(name),
      slots,
      order: await nextOrder(),
      createdAt: now,
      updatedAt: now,
    };
    await db.templates.add(template);
    return template;
  });
}

async function mutate(id: string, change: (t: Template) => Template): Promise<Template> {
  return db.transaction('rw', db.templates, async () => {
    const current = await db.templates.get(id);
    if (!current) throw new Error('Template not found');
    const next = { ...change(current), updatedAt: Date.now() };
    await db.templates.put(next);
    return next;
  });
}

export async function renameTemplate(id: string, name: string): Promise<Template> {
  const cleaned = cleanTemplateName(name);
  return mutate(id, (t) => ({ ...t, name: cleaned }));
}

/** Copies a template (new ids throughout) to the end of the list as "Name (copy)". */
export async function duplicateTemplate(id: string): Promise<Template> {
  return db.transaction('rw', db.templates, async () => {
    const original = await db.templates.get(id);
    if (!original) throw new Error('Template not found');
    const now = Date.now();
    const copy: Template = {
      ...structuredClone(original),
      id: newId(),
      name: `${original.name} (copy)`,
      slots: original.slots.map((s) => ({ ...structuredClone(s), id: newId() })),
      order: await nextOrder(),
      createdAt: now,
      updatedAt: now,
    };
    await db.templates.add(copy);
    return copy;
  });
}

/** Past sessions keep their own snapshot, so deleting a template never changes history. */
export function deleteTemplate(id: string): Promise<void> {
  return db.templates.delete(id);
}

export async function addSlot(templateId: string, exerciseId: string): Promise<TemplateSlot> {
  const slot = newSlot(exerciseId);
  await mutate(templateId, (t) => ({ ...t, slots: [...t.slots, slot] }));
  return slot;
}

export function updateSlot(
  templateId: string,
  slotId: string,
  change: (slot: TemplateSlot) => TemplateSlot,
): Promise<Template> {
  return mutate(templateId, (t) => ({
    ...t,
    slots: t.slots.map((s) => (s.id === slotId ? normaliseSlot(change(s)) : s)),
  }));
}

export function removeSlot(templateId: string, slotId: string): Promise<Template> {
  return mutate(templateId, (t) => ({ ...t, slots: t.slots.filter((s) => s.id !== slotId) }));
}

/** Moves a slot one place up (-1) or down (+1); no-op at either end. */
export function moveSlot(templateId: string, slotId: string, delta: -1 | 1): Promise<Template> {
  return mutate(templateId, (t) => {
    const from = t.slots.findIndex((s) => s.id === slotId);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= t.slots.length) return t;
    const slots = [...t.slots];
    [slots[from], slots[to]] = [slots[to], slots[from]];
    return { ...t, slots };
  });
}
