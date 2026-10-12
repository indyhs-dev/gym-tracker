import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/db';
import {
  createExercise,
  deleteExercise,
  DuplicateNameError,
  ExerciseInUseError,
  filterExercises,
  findByName,
  updateExercise,
  type ExerciseInput,
} from '../src/db/exercises';
import type { Session, Template } from '../src/db/types';

const input = (name: string, extra: Partial<ExerciseInput> = {}): ExerciseInput => ({
  name,
  type: 'compound',
  perHand: false,
  bodyweight: false,
  weightStep: 2.5,
  ...extra,
});

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('createExercise', () => {
  it('saves a cleaned-up name and the flags', async () => {
    const ex = await createExercise(input('  Flat   Dumbbell Bench Press ', { perHand: true }));
    expect(ex.name).toBe('Flat Dumbbell Bench Press');
    expect(ex.nameKey).toBe('flat dumbbell bench press');
    const stored = await db.exercises.get(ex.id);
    expect(stored).toMatchObject({ name: 'Flat Dumbbell Bench Press', perHand: true, weightStep: 2.5 });
  });

  it('blocks duplicates regardless of case and spacing', async () => {
    await createExercise(input('Lat Pulldown'));
    await expect(createExercise(input('lat  pulldown'))).rejects.toBeInstanceOf(DuplicateNameError);
    expect(await db.exercises.count()).toBe(1);
  });

  it('rejects an empty name or a zero step', async () => {
    await expect(createExercise(input('   '))).rejects.toThrow('Name is required');
    await expect(createExercise(input('Dips', { weightStep: 0 }))).rejects.toThrow('Weight step');
  });
});

describe('updateExercise', () => {
  it('allows changing the case of its own name', async () => {
    const ex = await createExercise(input('pull-up'));
    await updateExercise(ex.id, input('Pull-up', { bodyweight: true }));
    expect(await db.exercises.get(ex.id)).toMatchObject({ name: 'Pull-up', bodyweight: true });
  });

  it('blocks renaming onto another exercise', async () => {
    await createExercise(input('Dips'));
    const ex = await createExercise(input('Dipz'));
    await expect(updateExercise(ex.id, input('DIPS'))).rejects.toBeInstanceOf(DuplicateNameError);
  });
});

describe('deleteExercise', () => {
  it('deletes an unused exercise', async () => {
    const ex = await createExercise(input('Typo Exercise'));
    await deleteExercise(ex.id);
    expect(await db.exercises.count()).toBe(0);
  });

  it('refuses when a template uses it (default or alternative)', async () => {
    const main = await createExercise(input('Pull-up'));
    const alt = await createExercise(input('Lat Pulldown'));
    const template: Template = {
      id: 't1', name: 'Torso', order: 0, createdAt: 0, updatedAt: 0,
      slots: [{ id: 's1', exerciseId: main.id, alternativeIds: [alt.id], targetSets: 2, repMin: 5, repMax: 12, warmup: 'full', planNote: '' }],
    };
    await db.templates.add(template);
    await expect(deleteExercise(main.id)).rejects.toBeInstanceOf(ExerciseInUseError);
    await expect(deleteExercise(alt.id)).rejects.toBeInstanceOf(ExerciseInUseError);
  });

  it('refuses when a session used it', async () => {
    const ex = await createExercise(input('Dips'));
    const session: Session = {
      id: 'x1', templateId: null, templateName: null, status: 'finished', startedAt: 1, endedAt: 2, note: '', updatedAt: 2,
      exercises: [{ id: 'se1', exerciseId: ex.id, slot: null, note: '', sets: [] }],
      exerciseIds: [ex.id],
    };
    await db.sessions.add(session);
    await expect(deleteExercise(ex.id)).rejects.toMatchObject({ usage: { templates: 0, sessions: 1 } });
  });
});

describe('search helpers', () => {
  it('matches every word in any order and sorts alphabetically', async () => {
    for (const n of ['Seated Cable Row', 'Cable Fly', 'Lat Pulldown', 'Cable Pushdown']) await createExercise(input(n));
    const all = await db.exercises.toArray();
    expect(filterExercises(all, 'cable').map((e) => e.name)).toEqual(['Cable Fly', 'Cable Pushdown', 'Seated Cable Row']);
    expect(filterExercises(all, 'row  cable').map((e) => e.name)).toEqual(['Seated Cable Row']);
    expect(filterExercises(all, '')).toHaveLength(4);
    expect(findByName(all, ' lat pulldown ')?.name).toBe('Lat Pulldown');
  });
});
