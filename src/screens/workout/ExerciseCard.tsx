import { useState } from 'react';
import { flushSync } from 'react-dom';
import ActionSheet from '../../components/ActionSheet';
import ExercisePicker from '../../components/ExercisePicker';
import NoteField from '../../components/NoteField';
import {
  addSet,
  deleteSet,
  removeSessionExercise,
  setExerciseNote,
  swapExercise,
  updateSet,
  type PreviousSets,
} from '../../db/sessions';
import type { Exercise, RestGuidance, SessionExercise, WarmupPolicy } from '../../db/types';
import { formatKg, plural } from '../../lib/format';
import { setsReps, WARMUP_LABEL } from '../../lib/labels';
import { previousBeside } from '../../lib/previous';
import { compareTopSets, progressionHint, topSet, type TopSet } from '../../lib/progression';
import { restAfter } from '../../lib/rest';
import { startRest, useDoneSets } from '../../lib/restTimer';
import { weightText } from '../../lib/setText';
import { lastWorkWeight, warmupSuggestions } from '../../lib/warmup';
import SetRow from './SetRow';

interface Props {
  sessionId: string;
  item: SessionExercise;
  exercises: Map<string, Exercise>;
  rest: RestGuidance;
  /** The last session's sets for this exercise: the Previous column and the hints. */
  previous?: PreviousSets;
  /** Show training hints (warm-ups, progression, top set): during a workout, not when editing history. */
  hints?: boolean;
  /** A workout happening now: sets get a ✓ that starts the rest timer. */
  live?: boolean;
}

/** What each warm-up policy asks for, in the warm-up sheet. */
const WARMUP_ABOUT: Record<Exclude<WarmupPolicy, 'none'>, string> = {
  full: 'A few lighter sets, building up to your first working set.',
  one: 'One lighter set before your first working set.',
  zeroToOne: 'One lighter set if you feel you need it, or go straight in.',
};

/**
 * One exercise in a workout. Sets are added one at a time with "+ Add set";
 * last session's numbers sit beside them in the Previous column, for
 * reference only. Everything above the sets is fixed once the card loads, so
 * logging a set never pushes the rows down under your thumb.
 */
export default function ExerciseCard({ sessionId, item, exercises, rest, previous, hints = false, live = false }: Props) {
  const [menu, setMenu] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [noteOpen, setNoteOpen] = useState(item.note !== '');
  /** Which hint chip's explanation is open. */
  const [info, setInfo] = useState<'warmup' | 'goUp' | null>(null);
  const exercise = exercises.get(item.exerciseId);
  const name = exercise?.name ?? 'Unknown exercise';
  const slot = item.slot;
  const noteId = `exercise-note-${item.id}`;

  // The slot's default and alternatives come first in the swap list.
  const suggested = slot
    ? [slot.exerciseId, ...slot.alternativeIds]
        .filter((id) => id !== item.exerciseId)
        .map((id) => exercises.get(id))
        .filter((e): e is Exercise => e !== undefined)
    : [];

  function swap(next: Exercise) {
    setSwapping(false);
    const n = item.sets.length;
    if (n > 0 && !window.confirm(`Move ${plural(n, 'set')} to ${next.name}?`)) return;
    void swapExercise(sessionId, item.id, next.id);
  }

  function remove() {
    const n = item.sets.length;
    if (n > 0 && !window.confirm(`Remove ${name} and its ${plural(n, 'set')} from this workout?`)) return;
    void removeSessionExercise(sessionId, item.id);
  }

  /** Shows the note field and focuses it inside the same tap, so iOS brings up the keyboard. */
  function openNote() {
    flushSync(() => setNoteOpen(true));
    document.getElementById(noteId)?.focus();
  }

  /** A new working set. It keeps the weight of the last working set; reps are yours to enter. */
  function add() {
    const lastWorking = item.sets.filter((s) => !s.warmup && s.weight !== null).at(-1);
    void addSet(sessionId, item.id, lastWorking ? { weight: lastWorking.weight } : {});
  }

  const doneIds = useDoneSets(sessionId);

  /** ✓ on a set: tick it, put the keyboard away and start resting. */
  function setDone(setId: string, warmupSet: boolean) {
    if (!exercise) return;
    const { text, range } = restAfter(exercise.type, warmupSet, rest);
    startRest(sessionId, setId, text, range);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }

  const meta = [slot && setsReps(slot), exercise && rest[exercise.type] && `Rest ${rest[exercise.type]}`]
    .filter(Boolean)
    .join(' · ');

  // Warm-up chip: the step weights from last time's work weight, else just the slot's policy.
  const warmupPolicy = hints && slot && slot.warmup !== 'none' ? slot.warmup : null;
  const work = exercise && !exercise.bodyweight ? lastWorkWeight(previous?.sets) : null;
  const warmups = warmupPolicy && exercise && work ? warmupSuggestions(warmupPolicy, exercise.type, work, exercise.weightStep) : [];

  // "Go up" chip: the weight to try, with the reasoning in its sheet.
  const progression = hints && exercise && slot ? progressionHint(previous?.sets, slot.repMax, exercise.weightStep) : null;
  const kgUnit = exercise?.perHand ? 'kg each' : exercise?.bodyweight ? 'kg added' : 'kg';
  const kg = (n: number) => `${formatKg(n)} ${kgUnit}`;
  const goUpRange =
    progression && `${formatKg(progression.low)}${progression.high > progression.low ? `–${formatKg(progression.high)}` : ''}`;
  const goUpChip = !progression
    ? null
    : progression.weight === 0
      ? `↑ Add ${formatKg(progression.low)} kg`
      : `↑ Try ${exercise?.bodyweight ? '+' : ''}${goUpRange} kg`;

  // Top set to beat: shown from the start whenever there's a last time, so it never appears mid-set.
  const lastTop = hints ? topSet(previous?.sets) : null;
  const todayTop = topSet(item.sets);
  const showSet = (t: TopSet) => `${weightText(t.weight, exercise)} × ${t.reps}`;
  const comparison = todayTop && lastTop ? compareTopSets(todayTop, lastTop) : null;

  const beside = previousBeside(item.sets, previous?.sets);
  let working = 0;
  const label = (warmup: boolean) => (warmup ? 'W' : String(++working));
  const weightLabel = exercise?.bodyweight ? '+kg' : exercise?.perHand ? 'kg each' : 'kg';

  return (
    <article className="card exercise-card" id={`item-${item.id}`}>
      <div className="exercise-head">
        <h2 className="exercise-name">{name}</h2>
        <button type="button" className="exercise-more" aria-label={`${name} options`} onClick={() => setMenu(true)}>
          <span aria-hidden="true">•••</span>
        </button>
      </div>
      {meta && <p className="exercise-meta">{meta}</p>}
      {slot?.planNote && <p className="exercise-plan">{slot.planNote}</p>}
      {(warmupPolicy || progression) && (
        <div className="hint-chips">
          {warmupPolicy && (
            <button type="button" className="hint-chip warmup-hint" onClick={() => setInfo('warmup')}>
              {warmups.length > 0 ? (
                <>
                  <span className="hint-chip-label">Warm-up</span>
                  {warmups.map((w) => formatKg(w.weight)).join(' · ')}
                </>
              ) : (
                WARMUP_LABEL[warmupPolicy]
              )}
            </button>
          )}
          {goUpChip && (
            <button type="button" className="hint-chip progression-hint" onClick={() => setInfo('goUp')}>
              {goUpChip}
            </button>
          )}
        </div>
      )}
      {noteOpen && (
        <NoteField
          id={noteId}
          label={`Note for ${name}`}
          placeholder="Exercise note"
          value={item.note}
          onChange={(note) => setExerciseNote(sessionId, item.id, note)}
        />
      )}

      {exercise && item.sets.length > 0 && (
        <div className={live ? 'set-table has-done' : 'set-table'}>
          <div className="set-head" aria-hidden="true">
            <span>Set</span>
            <span>Previous</span>
            <span>{weightLabel}</span>
            <span>Reps</span>
            {live && <span>✓</span>}
          </div>
          <ol className="set-list">
            {item.sets.map((set, i) => (
              <SetRow
                key={set.id}
                set={set}
                previous={beside[i]}
                label={label(set.warmup)}
                exercise={exercise}
                onChange={(fields) => updateSet(sessionId, item.id, set.id, fields)}
                onDelete={() => deleteSet(sessionId, item.id, set.id)}
                onDone={live ? () => setDone(set.id, set.warmup) : undefined}
                done={doneIds.includes(set.id)}
              />
            ))}
          </ol>
        </div>
      )}

      <button type="button" className="btn btn-block add-set" onClick={add}>
        + Add set
      </button>

      {lastTop && (
        <p className={`top-set-compare${comparison ? ` is-${comparison}` : ''}`} role="status">
          {comparison === 'beat' && (
            <>
              ↑ Beat last time · {showSet(todayTop!)} vs {showSet(lastTop)}
            </>
          )}
          {comparison === 'matched' && <>= Matched last time · {showSet(lastTop)}</>}
          {comparison === 'below' && (
            <>
              Top set {showSet(todayTop!)} · last time {showSet(lastTop)}
            </>
          )}
          {comparison === null && <>Top set to beat · {showSet(lastTop)}</>}
        </p>
      )}

      {menu && (
        <ActionSheet
          title={name}
          onClose={() => setMenu(false)}
          actions={[
            { label: 'Swap exercise', onSelect: () => setSwapping(true) },
            ...(noteOpen ? [] : [{ label: 'Add note', onSelect: openNote }]),
            { label: 'Remove exercise', danger: true, onSelect: remove },
          ]}
        />
      )}
      {info === 'warmup' && warmupPolicy && (
        <ActionSheet title={`Warm-up · ${name}`} closeLabel="Done" onClose={() => setInfo(null)}>
          <p>{WARMUP_ABOUT[warmupPolicy]}</p>
          {warmups.length > 0 && work ? (
            <>
              <p>
                Worked out from <strong>{kg(work)}</strong>, your first working set last time:
              </p>
              <ol className="info-list">
                {warmups.map((w) => (
                  <li key={w.weight}>
                    <strong>{kg(w.weight)}</strong>
                    <span>× {w.reps}</span>
                    <span className="muted">{w.percent}%</span>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="muted">
              {exercise?.bodyweight
                ? 'It’s a bodyweight exercise, so there are no weights to suggest.'
                : work
                  ? `At ${kg(work)} there’s nothing lighter to step up from.`
                  : 'Weights show here once you’ve logged this exercise.'}
            </p>
          )}
        </ActionSheet>
      )}
      {info === 'goUp' && progression && slot && (
        <ActionSheet title={`Go up · ${name}`} closeLabel="Done" onClose={() => setInfo(null)}>
          <p>
            Last time set 1 hit <strong>{progression.reps} reps</strong>, the top of your {slot.repMin}–{slot.repMax} range.
          </p>
          {progression.weight === 0 ? (
            <p>
              If your form was good, try adding <strong>{formatKg(progression.low)} kg</strong> today.
            </p>
          ) : (
            <p>
              If your form was good, try <strong>{goUpRange} {kgUnit}</strong> today (5–10% more). If not, stay at{' '}
              {kg(progression.weight)} until it’s solid.
            </p>
          )}
        </ActionSheet>
      )}
      {swapping && (
        <ExercisePicker
          title="Swap exercise"
          suggested={suggested}
          excludeIds={[item.exerciseId]}
          onPick={swap}
          onClose={() => setSwapping(false)}
        />
      )}
    </article>
  );
}
