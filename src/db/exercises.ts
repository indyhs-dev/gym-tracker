import { newId } from '../lib/ids';
import { db } from './db';
import type { Exercise, ExerciseType } from './types';

export interface ExerciseInput {
  name: string;
  type: ExerciseType;
  perHand: boolean;
  bodyweight: boolean;
  weightStep: number;
}

export const DEFAULT_WEIGHT_STEP = 2.5;

export class DuplicateNameError extends Error {
  constructor(public existingName: string) {
    super(`“${existingName}” is already in your library`);
  }
}

export class ExerciseInUseError extends Error {
  constructor(public usage: ExerciseUsage) {
    super('This exercise is used in a template or session, so it can’t be deleted');
  }
}

export function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export function nameKeyOf(name: string): string {
  return cleanName(name).toLowerCase();
}

function validate(input: ExerciseInput): Omit<Exercise, 'id' | 'createdAt'> {
  const name = cleanName(input.name);
  if (!name) throw new Error('Name is required');
  if (!(input.weightStep > 0)) throw new Error('Weight step must be more than 0');
  return {
    name,
    nameKey: nameKeyOf(name),
    type: input.type,
    perHand: input.perHand,
    bodyweight: input.bodyweight,
    weightStep: input.weightStep,
  };
}

async function assertNameFree(nameKey: string, exceptId?: string) {
  const clash = await db.exercises.where('nameKey').equals(nameKey).first();
  if (clash && clash.id !== exceptId) throw new DuplicateNameError(clash.name);
}

export async function createExercise(input: ExerciseInput): Promise<Exercise> {
  const exercise: Exercise = { id: newId(), createdAt: Date.now(), ...validate(input) };
  await db.transaction('rw', db.exercises, async () => {
    await assertNameFree(exercise.nameKey);
    await db.exercises.add(exercise);
  });
  return exercise;
}

export async function updateExercise(id: string, input: ExerciseInput): Promise<void> {
  const fields = validate(input);
  await db.transaction('rw', db.exercises, async () => {
    await assertNameFree(fields.nameKey, id);
    const updated = await db.exercises.update(id, fields);
    if (!updated) throw new Error('Exercise not found');
  });
}

export interface ExerciseUsage {
  templates: number;
  sessions: number;
}

export async function exerciseUsage(id: string): Promise<ExerciseUsage> {
  const [templates, sessions] = await Promise.all([
    db.templates
      .filter((t) => t.slots.some((s) => s.exerciseId === id || s.alternativeIds.includes(id)))
      .count(),
    db.sessions.where('exerciseIds').equals(id).count(),
  ]);
  return { templates, sessions };
}

/** Deletes an exercise only if no template or session uses it (for cleaning up typos). */
export async function deleteExercise(id: string): Promise<void> {
  await db.transaction('rw', db.exercises, db.templates, db.sessions, async () => {
    const usage = await exerciseUsage(id);
    if (usage.templates || usage.sessions) throw new ExerciseInUseError(usage);
    await db.exercises.delete(id);
  });
}

/** Exercises whose name contains every word of the query, alphabetical. */
export function filterExercises(all: Exercise[], query: string): Exercise[] {
  const words = nameKeyOf(query).split(' ').filter(Boolean);
  return all
    .filter((e) => words.every((w) => e.nameKey.includes(w)))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function findByName(all: Exercise[], name: string): Exercise | undefined {
  const key = nameKeyOf(name);
  return all.find((e) => e.nameKey === key);
}
