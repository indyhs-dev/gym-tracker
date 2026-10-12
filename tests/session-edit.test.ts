import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/db';
import {
  addSessionExercise,
  addSet,
  deleteSet,
  removeSessionExercise,
  setExerciseNote,
  setSessionNote,
  startSession,
  swapExercise,
  updateSet,
} from '../src/db/sessions';
import { addSlot, createTemplate } from '../src/db/templates';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

async function torso() {
  const t = await createTemplate('Torso');
  await addSlot(t.id, 'pullup');
  await addSlot(t.id, 'dips');
  return startSession(t.id, 1000);
}

const load = async (id: string) => (await db.sessions.get(id))!;

describe('editing a session', () => {
  it('adds, edits and deletes sets', async () => {
    const s = await torso();
    const item = s.exercises[0].id;
    await addSet(s.id, item, { weight: 20, reps: 10, warmup: true });
    await addSet(s.id, item);
    let sets = (await load(s.id)).exercises[0].sets;
    expect(sets.map((x) => [x.weight, x.reps, x.warmup])).toEqual([
      [20, 10, true],
      [null, null, false],
    ]);
    const loggedAt = sets[1].loggedAt;

    await updateSet(s.id, item, sets[1].id, { weight: 22.499999, reps: 7.6, note: 'grip slipped' });
    sets = (await load(s.id)).exercises[0].sets;
    expect(sets[1]).toMatchObject({ weight: 22.5, reps: 8, note: 'grip slipped', loggedAt });

    await updateSet(s.id, item, sets[1].id, { weight: -5 });
    expect((await load(s.id)).exercises[0].sets[1].weight).toBe(0);

    await deleteSet(s.id, item, sets[0].id);
    expect((await load(s.id)).exercises[0].sets.map((x) => x.id)).toEqual([sets[1].id]);
  });

  it('saves exercise and session notes', async () => {
    const s = await torso();
    await setExerciseNote(s.id, s.exercises[1].id, 'forearms are dead');
    await setSessionNote(s.id, 'need to strengthen forearms');
    const saved = await load(s.id);
    expect(saved.note).toBe('need to strengthen forearms');
    expect(saved.exercises[1].note).toBe('forearms are dead');
  });

  it('swapping keeps the slot and moves the sets, and updates the index', async () => {
    const s = await torso();
    const item = s.exercises[0].id;
    await addSet(s.id, item, { weight: 0, reps: 6 });
    await swapExercise(s.id, item, 'pulldown');
    const saved = await load(s.id);
    expect(saved.exercises[0]).toMatchObject({ exerciseId: 'pulldown', slot: { exerciseId: 'pullup' } });
    expect(saved.exercises[0].sets).toHaveLength(1);
    expect(saved.exerciseIds).toEqual(['pulldown', 'dips']);
    expect(await db.sessions.where('exerciseIds').equals('pullup').count()).toBe(0);
  });

  it('adds and removes ad-hoc exercises', async () => {
    const s = await torso();
    const added = await addSessionExercise(s.id, 'incline');
    let saved = await load(s.id);
    expect(saved.exercises.at(-1)).toMatchObject({ id: added, exerciseId: 'incline', slot: null, sets: [] });
    await removeSessionExercise(s.id, s.exercises[1].id);
    saved = await load(s.id);
    expect(saved.exercises.map((e) => e.exerciseId)).toEqual(['pullup', 'incline']);
    expect(saved.exerciseIds).toEqual(['pullup', 'incline']);
  });
});
