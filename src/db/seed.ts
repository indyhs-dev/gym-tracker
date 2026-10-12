import { newId } from '../lib/ids';
import { db } from './db';
import { DEFAULT_WEIGHT_STEP, nameKeyOf } from './exercises';
import { getSettings } from './settings';
import { newSlot } from './templates';
import type { Exercise, ExerciseType, Template, WarmupPolicy } from './types';

// Starting data only: applied once on first launch, then fully editable in-app.
// Nothing else in the app refers to these names.

interface SeedExercise {
  name: string;
  type: ExerciseType;
  perHand?: true;
  bodyweight?: true;
  step?: number;
}

interface SeedSlot {
  exercise: string;
  alternatives?: string[];
  sets: number;
  reps: [min: number, max: number];
  warmup: WarmupPolicy;
  note?: string;
}

export const SEED_EXERCISES: SeedExercise[] = [
  // Torso
  { name: 'Flat Dumbbell Bench Press', type: 'compound', perHand: true },
  { name: 'Dips', type: 'compound', bodyweight: true },
  { name: 'Cable Fly', type: 'isolation' },
  { name: 'Pec Deck', type: 'isolation' },
  { name: 'Pull-up', type: 'compound', bodyweight: true },
  { name: 'Lat Pulldown', type: 'compound', step: 7 },
  { name: 'Chest-supported Row', type: 'compound' },
  { name: 'Seated Cable Row', type: 'compound', step: 7 },
  { name: 'Single-arm Dumbbell Row', type: 'compound', perHand: true },
  { name: 'Back Extension', type: 'isolation', bodyweight: true },
  { name: 'Seated Back Extension Machine', type: 'isolation' },
  { name: 'Reverse Hyper', type: 'isolation' },
  { name: 'Hanging Knee Raise', type: 'core', bodyweight: true },
  { name: 'Hanging L-sit', type: 'core', bodyweight: true },
  { name: 'Hanging Pike', type: 'core', bodyweight: true },
  // Legs
  { name: 'Hack Squat', type: 'compound' },
  { name: 'Back Squat', type: 'compound' },
  { name: 'Leg Extension', type: 'isolation' },
  { name: 'Romanian Deadlift', type: 'compound' },
  { name: 'Deadlift', type: 'compound' },
  { name: 'Lying Leg Curl', type: 'isolation' },
  { name: 'Standing Calf Raise', type: 'isolation' },
  // Shoulders & Arms
  { name: 'Seated Dumbbell Overhead Press', type: 'compound', perHand: true },
  { name: 'Dumbbell Lateral Raise', type: 'isolation', perHand: true },
  { name: 'Cable Lateral Raise', type: 'isolation' },
  { name: 'Face Pull', type: 'isolation' },
  { name: 'Dumbbell Curl', type: 'isolation', perHand: true },
  { name: 'Preacher Curl Machine', type: 'isolation' },
  { name: 'Overhead Cable Triceps Extension', type: 'isolation' },
  { name: 'Cable Pushdown', type: 'isolation' },
  { name: 'Ab Wheel', type: 'core', bodyweight: true },
  { name: 'Cable Crunch', type: 'core' },
];

export const SEED_TEMPLATES: { name: string; slots: SeedSlot[] }[] = [
  {
    name: 'Torso',
    slots: [
      { exercise: 'Flat Dumbbell Bench Press', sets: 2, reps: [5, 12], warmup: 'full' },
      { exercise: 'Dips', sets: 2, reps: [5, 12], warmup: 'one', note: 'Add weight once 12 bodyweight reps are possible' },
      { exercise: 'Cable Fly', alternatives: ['Pec Deck'], sets: 2, reps: [8, 15], warmup: 'zeroToOne' },
      { exercise: 'Pull-up', alternatives: ['Lat Pulldown'], sets: 2, reps: [5, 12], warmup: 'full' },
      {
        exercise: 'Chest-supported Row',
        alternatives: ['Seated Cable Row', 'Single-arm Dumbbell Row'],
        sets: 2,
        reps: [5, 12],
        warmup: 'one',
      },
      {
        exercise: 'Back Extension',
        alternatives: ['Seated Back Extension Machine', 'Reverse Hyper'],
        sets: 2,
        reps: [8, 25],
        warmup: 'one',
      },
      {
        exercise: 'Hanging Knee Raise',
        alternatives: ['Hanging L-sit', 'Hanging Pike'],
        sets: 3,
        reps: [5, 5],
        warmup: 'none',
        note: 'Progression: Knee Raise → L-sit → Pike',
      },
    ],
  },
  {
    name: 'Legs',
    slots: [
      { exercise: 'Hack Squat', alternatives: ['Back Squat'], sets: 2, reps: [5, 12], warmup: 'full', note: 'Back Squat: use safety pins' },
      { exercise: 'Leg Extension', sets: 2, reps: [8, 15], warmup: 'one' },
      { exercise: 'Romanian Deadlift', alternatives: ['Deadlift'], sets: 2, reps: [5, 10], warmup: 'full' },
      { exercise: 'Lying Leg Curl', sets: 2, reps: [6, 12], warmup: 'one' },
      { exercise: 'Standing Calf Raise', sets: 3, reps: [8, 15], warmup: 'full' },
    ],
  },
  {
    name: 'Shoulders & Arms',
    slots: [
      { exercise: 'Seated Dumbbell Overhead Press', sets: 2, reps: [5, 12], warmup: 'full' },
      { exercise: 'Dumbbell Lateral Raise', alternatives: ['Cable Lateral Raise'], sets: 2, reps: [10, 20], warmup: 'zeroToOne' },
      { exercise: 'Face Pull', sets: 2, reps: [12, 20], warmup: 'zeroToOne', note: 'Rope' },
      { exercise: 'Dumbbell Curl', sets: 2, reps: [8, 15], warmup: 'full', note: 'Supinate' },
      { exercise: 'Preacher Curl Machine', sets: 2, reps: [8, 15], warmup: 'zeroToOne' },
      { exercise: 'Overhead Cable Triceps Extension', sets: 2, reps: [8, 15], warmup: 'full' },
      { exercise: 'Cable Pushdown', sets: 2, reps: [8, 15], warmup: 'zeroToOne' },
      { exercise: 'Ab Wheel', alternatives: ['Cable Crunch'], sets: 2, reps: [8, 15], warmup: 'none' },
    ],
  },
];

/**
 * Adds the starting library and templates the first time the app runs.
 * Exercises already in the library (same name) are reused, not duplicated.
 * Returns true if it seeded, false if it had already run.
 */
export async function seedIfNeeded(): Promise<boolean> {
  return db.transaction('rw', db.exercises, db.templates, db.settings, async () => {
    const settings = await getSettings();
    if (settings.seededAt !== null) return false;

    const now = Date.now();
    const idByName = new Map<string, string>();
    for (const seed of SEED_EXERCISES) {
      const nameKey = nameKeyOf(seed.name);
      const existing = await db.exercises.where('nameKey').equals(nameKey).first();
      if (existing) {
        idByName.set(seed.name, existing.id);
        continue;
      }
      const exercise: Exercise = {
        id: newId(),
        name: seed.name,
        nameKey,
        type: seed.type,
        perHand: seed.perHand ?? false,
        bodyweight: seed.bodyweight ?? false,
        weightStep: seed.step ?? DEFAULT_WEIGHT_STEP,
        createdAt: now,
      };
      await db.exercises.add(exercise);
      idByName.set(seed.name, exercise.id);
    }

    const idOf = (name: string) => {
      const id = idByName.get(name);
      if (!id) throw new Error(`Seed template refers to unknown exercise “${name}”`);
      return id;
    };

    const last = await db.templates.orderBy('order').last();
    let order = last ? last.order + 1 : 0;
    for (const seed of SEED_TEMPLATES) {
      const template: Template = {
        id: newId(),
        name: seed.name,
        order: order++,
        createdAt: now,
        updatedAt: now,
        slots: seed.slots.map((s) => ({
          ...newSlot(idOf(s.exercise)),
          alternativeIds: (s.alternatives ?? []).map(idOf),
          targetSets: s.sets,
          repMin: s.reps[0],
          repMax: s.reps[1],
          warmup: s.warmup,
          planNote: s.note ?? '',
        })),
      };
      await db.templates.add(template);
    }

    await db.settings.put({ ...settings, seededAt: now });
    return true;
  });
}
