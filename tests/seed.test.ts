import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/db';
import { createExercise } from '../src/db/exercises';
import { SEED_EXERCISES, seedIfNeeded } from '../src/db/seed';
import { deleteTemplate } from '../src/db/templates';
import type { Exercise, Template } from '../src/db/types';
import { setsReps, WARMUP_LABEL } from '../src/lib/labels';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

async function load() {
  const exercises = await db.exercises.toArray();
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const byName = new Map(exercises.map((e) => [e.name, e]));
  const templates = await db.templates.orderBy('order').toArray();
  return { exercises, byId, byName, templates };
}

/** "Default (Alt, Alt) | 2 × 5–12 | Full warm-up | note" — mirrors the spec's slot format. */
function describeSlots(t: Template, byId: Map<string, Exercise>) {
  return t.slots.map((s) => {
    const alts = s.alternativeIds.length ? ` (${s.alternativeIds.map((a) => byId.get(a)!.name).join(', ')})` : '';
    const note = s.planNote ? ` | ${s.planNote}` : '';
    return `${byId.get(s.exerciseId)!.name}${alts} | ${setsReps(s)} | ${WARMUP_LABEL[s.warmup]}${note}`;
  });
}

describe('seedIfNeeded', () => {
  it('adds the library and the three templates exactly once', async () => {
    expect(await seedIfNeeded()).toBe(true);
    expect(await seedIfNeeded()).toBe(false);
    const { exercises, templates } = await load();
    expect(exercises).toHaveLength(SEED_EXERCISES.length);
    expect(templates.map((t) => t.name)).toEqual(['Torso', 'Legs', 'Shoulders & Arms']);
    expect((await db.settings.get('app'))?.seededAt).toEqual(expect.any(Number));
  });

  it('builds the templates as specified', async () => {
    await seedIfNeeded();
    const { byId, templates } = await load();
    expect(describeSlots(templates[0], byId)).toEqual([
      'Flat Dumbbell Bench Press | 2 × 5–12 | Full warm-up',
      'Dips | 2 × 5–12 | 1 warm-up set | Add weight once 12 bodyweight reps are possible',
      'Cable Fly (Pec Deck) | 2 × 8–15 | 0–1 warm-up sets',
      'Pull-up (Lat Pulldown) | 2 × 5–12 | Full warm-up',
      'Chest-supported Row (Seated Cable Row, Single-arm Dumbbell Row) | 2 × 5–12 | 1 warm-up set',
      'Back Extension (Seated Back Extension Machine, Reverse Hyper) | 2 × 8–25 | 1 warm-up set',
      'Hanging Knee Raise (Hanging L-sit, Hanging Pike) | 3 × 5 | No warm-up | Progression: Knee Raise → L-sit → Pike',
    ]);
    expect(describeSlots(templates[1], byId)).toEqual([
      'Hack Squat (Back Squat) | 2 × 5–12 | Full warm-up | Back Squat: use safety pins',
      'Leg Extension | 2 × 8–15 | 1 warm-up set',
      'Romanian Deadlift (Deadlift) | 2 × 5–10 | Full warm-up',
      'Lying Leg Curl | 2 × 6–12 | 1 warm-up set',
      'Standing Calf Raise | 3 × 8–15 | Full warm-up',
    ]);
    expect(describeSlots(templates[2], byId)).toEqual([
      'Seated Dumbbell Overhead Press | 2 × 5–12 | Full warm-up',
      'Dumbbell Lateral Raise (Cable Lateral Raise) | 2 × 10–20 | 0–1 warm-up sets',
      'Face Pull | 2 × 12–20 | 0–1 warm-up sets | Rope',
      'Dumbbell Curl | 2 × 8–15 | Full warm-up | Supinate',
      'Preacher Curl Machine | 2 × 8–15 | 0–1 warm-up sets',
      'Overhead Cable Triceps Extension | 2 × 8–15 | Full warm-up',
      'Cable Pushdown | 2 × 8–15 | 0–1 warm-up sets',
      'Ab Wheel (Cable Crunch) | 2 × 8–15 | No warm-up',
    ]);
  });

  it('sets the exercise flags and steps', async () => {
    await seedIfNeeded();
    const { exercises, byName } = await load();
    const perHand = exercises.filter((e) => e.perHand).map((e) => e.name).sort();
    const bodyweight = exercises.filter((e) => e.bodyweight).map((e) => e.name).sort();
    expect(perHand).toEqual([
      'Dumbbell Curl',
      'Dumbbell Lateral Raise',
      'Flat Dumbbell Bench Press',
      'Seated Dumbbell Overhead Press',
      'Single-arm Dumbbell Row',
    ]);
    expect(bodyweight).toEqual([
      'Ab Wheel',
      'Back Extension',
      'Dips',
      'Hanging Knee Raise',
      'Hanging L-sit',
      'Hanging Pike',
      'Pull-up',
    ]);
    expect(exercises.filter((e) => e.weightStep !== 2.5).map((e) => `${e.name} ${e.weightStep}`).sort()).toEqual([
      'Lat Pulldown 7',
      'Seated Cable Row 7',
    ]);
    expect(byName.get('Ab Wheel')?.type).toBe('core');
    expect(byName.get('Face Pull')?.type).toBe('isolation');
  });

  it('reuses exercises already in the library and keeps templates you already have', async () => {
    const mine = await createExercise({ name: 'dips', type: 'isolation', perHand: false, bodyweight: false, weightStep: 5 });
    await db.templates.add({ id: 'mine', name: 'My test', slots: [], order: 0, createdAt: 0, updatedAt: 0 });
    await seedIfNeeded();
    const { exercises, templates } = await load();
    expect(exercises).toHaveLength(SEED_EXERCISES.length);
    expect(templates.map((t) => t.name)).toEqual(['My test', 'Torso', 'Legs', 'Shoulders & Arms']);
    expect(templates[1].slots[1].exerciseId).toBe(mine.id);
    expect((await db.exercises.get(mine.id))?.weightStep).toBe(5);
  });

  it("doesn't bring back a seeded template you deleted", async () => {
    await seedIfNeeded();
    const legs = (await db.templates.toArray()).find((t) => t.name === 'Legs')!;
    await deleteTemplate(legs.id);
    await seedIfNeeded();
    expect((await db.templates.toArray()).map((t) => t.name)).not.toContain('Legs');
  });
});
