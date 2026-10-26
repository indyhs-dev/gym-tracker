import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import ExercisePicker from '../../components/ExercisePicker';
import { BackIcon } from '../../components/Icons';
import NoteField from '../../components/NoteField';
import ScreenHeader from '../../components/ScreenHeader';
import { db } from '../../db/db';
import {
  addSessionExercise,
  addSet,
  discardSession,
  dropEmptyExercises,
  isLive,
  previousSetsFor,
  setSessionNote,
} from '../../db/sessions';
import { useSettings } from '../../db/settings';
import type { Exercise, RestGuidance, Session, SessionExercise } from '../../db/types';
import { formatKg } from '../../lib/format';
import { newId } from '../../lib/ids';
import { useGoBack } from '../../lib/nav';
import { goUpWeight, progressionHint } from '../../lib/progression';
import { clearRest, useDoneSets, useRestTimer } from '../../lib/restTimer';
import { isRowDone, setRows, workingRowCount } from '../../lib/setRows';
import { formatClock, formatDate } from '../../lib/time';
import { useNow } from '../../lib/useNow';
import { useWakeLock } from '../../lib/wakeLock';
import ExerciseCard, { type GhostLog } from './ExerciseCard';
import ExerciseRow from './ExerciseRow';
import FinishScreen from './FinishScreen';
import RestBar from './RestBar';
import TimesEditor from './TimesEditor';

export default function WorkoutScreen() {
  const { id = '' } = useParams();
  const session = useLiveQuery(async () => (await db.sessions.get(id)) ?? null, [id]);
  const exercises = useLiveQuery(async () => new Map((await db.exercises.toArray()).map((e) => [e.id, e])), []);
  const settings = useSettings();

  if (session === undefined || !exercises || !settings) return <ScreenHeader title="" back="/" backLabel="Today" />;
  if (session === null) {
    return (
      <>
        <ScreenHeader title="Not found" back="/" backLabel="Today" />
        <p className="muted">This workout no longer exists.</p>
      </>
    );
  }
  return <Workout key={session.id} session={session} exercises={exercises} rest={settings.rest} />;
}

interface WorkoutProps {
  session: Session;
  exercises: Map<string, Exercise>;
  rest: RestGuidance;
}

/** The exercise you tapped open, and whether it was already done then (so finishing it moves you on). */
interface Picked {
  id: string;
  wasComplete: boolean;
}

function Workout({ session, exercises, rest }: WorkoutProps) {
  const navigate = useNavigate();
  const editing = session.status === 'finished';
  const active = !editing;
  const goBack = useGoBack(editing ? `/history/${session.id}` : '/');
  const [adding, setAdding] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [picked, setPicked] = useState<Picked | null>(null);
  /** Rows added with "+ Add set" beyond the template's target, per exercise. */
  const [extraRows, setExtraRows] = useState<Record<string, number>>({});
  const live = isLive(session);
  useWakeLock(live);
  const restTimer = useRestTimer(session.id);
  const doneIds = useDoneSets(session.id);
  const ghosts = useGhostLog();
  const previous = useLiveQuery(
    () => previousSetsFor(session.exerciseIds, session),
    [session.id, session.startedAt, session.exerciseIds.join(',')],
  );

  const items = session.exercises.map((item) => {
    const exercise = exercises.get(item.exerciseId);
    const last = previous?.get(item.exerciseId)?.sets;
    const rows = setRows(item, last, workingRowCount(item, active, extraRows[item.id] ?? 0), exercise, ghosts.idsFor(item));
    const done = rows.map((row) => isRowDone(row, active, doneIds));
    const working = rows.filter((row) => !row.warmup).length;
    const workingDone = rows.filter((row, i) => !row.warmup && done[i]).length;
    // Set 1 hit the top of the range today: go up next time.
    const hint = active && exercise && item.slot ? progressionHint(item.sets, item.slot.repMax, exercise.weightStep) : null;
    const goUp = !hint
      ? null
      : hint.weight === 0
        ? `↑ Add ${formatKg(hint.low)} kg next time`
        : `↑ Go to ${goUpWeight(hint, exercise!.bodyweight)} next time`;
    return { item, exercise, last, rows, done, working, workingDone, goUp, complete: rows.length > 0 && !done.includes(false) };
  });
  const totalSets = items.reduce((n, x) => n + x.working, 0);
  const doneSets = items.reduce((n, x) => n + x.workingDone, 0);

  // The open card: the one you tapped, else the first exercise with sets left.
  // Ticking off a tapped exercise moves on to the next unfinished one after it.
  // When editing history only a tapped one opens: "done" there just means reps
  // are entered, and typing must never close the card.
  const pickedAt = picked ? items.findIndex((x) => x.item.id === picked.id) : -1;
  const firstOpen = (from: number) => {
    const after = items.findIndex((x, i) => i > from && !x.complete);
    return after >= 0 ? after : items.findIndex((x) => !x.complete);
  };
  const openAt =
    editing || (pickedAt >= 0 && (picked!.wasComplete || !items[pickedAt].complete))
      ? pickedAt
      : firstOpen(pickedAt);
  const openId = openAt >= 0 ? items[openAt].item.id : null;
  const upNextAt = items.findIndex((x, i) => i > openAt && openAt >= 0 && !x.complete);

  // For the rest bar: "Set 2 next" within the exercise you just ticked, else "Pull-up next".
  let restNext: string | null = null;
  if (restTimer && openAt >= 0) {
    const open = items[openAt];
    const row = open.done.indexOf(false);
    if (row >= 0 && open.rows.some((r) => r.id === restTimer.setId)) {
      restNext = open.rows[row].warmup ? 'Warm-up set next' : `Set ${open.rows.slice(0, row + 1).filter((r) => !r.warmup).length} next`;
    } else if (row >= 0) {
      restNext = `${open.exercise?.name ?? 'Next exercise'} next`;
    }
  }

  // When the open card changes (an exercise finished, or a row was tapped), bring it into view.
  const shownId = useRef(openId);
  useEffect(() => {
    if (shownId.current === openId) return;
    shownId.current = openId;
    if (openId) document.getElementById(`item-${openId}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [openId]);

  function open(item: SessionExercise, complete: boolean) {
    setPicked({ id: item.id, wasComplete: complete });
  }

  /** One more row: a pre-filled row during a workout, or a new set (keeping the working weight) when editing. */
  function addRow(item: SessionExercise) {
    if (active) {
      const logged = item.sets.filter((s) => !s.warmup).length;
      const target = item.slot?.targetSets ?? 1;
      setExtraRows((x) => ({ ...x, [item.id]: Math.max(x[item.id] ?? 0, logged - target) + 1 }));
      return;
    }
    const lastWorking = item.sets.filter((s) => !s.warmup && s.weight !== null).at(-1);
    void addSet(session.id, item.id, lastWorking ? { weight: lastWorking.weight } : {});
  }

  async function add(exercise: Exercise) {
    setAdding(false);
    const itemId = await addSessionExercise(session.id, exercise.id);
    setPicked({ id: itemId, wasComplete: false });
  }

  /** Leaving edit mode: tidy away any exercise left with no sets. */
  async function done() {
    await dropEmptyExercises(session.id);
    goBack();
  }

  function discard() {
    if (!window.confirm('Discard this workout? Anything logged in it will be deleted.')) return;
    navigate('/', { replace: true });
    clearRest(session.id);
    void discardSession(session.id);
  }

  if (finishing) {
    return (
      <FinishScreen
        session={session}
        exercises={exercises}
        live={live}
        onBack={() => setFinishing(false)}
        onFinished={() => {
          clearRest(session.id);
          navigate(`/history/${session.id}`, { replace: true });
        }}
      />
    );
  }

  return (
    <>
      <div className="workout-bar">
        {editing ? (
          <span />
        ) : (
          <button type="button" className="back" onClick={goBack}>
            <BackIcon />
            Today
          </button>
        )}
        {live ? (
          <Elapsed since={session.startedAt} />
        ) : (
          <span className="workout-bar-date">{editing ? 'Editing' : formatDate(session.startedAt)}</span>
        )}
        <button type="button" className="btn btn-secondary btn-finish" onClick={editing ? done : () => setFinishing(true)}>
          {editing ? 'Done' : live ? 'Finish' : 'Save'}
        </button>
      </div>

      <div className="workout-title">
        <h1>{session.templateName ?? 'Blank workout'}</h1>
        {totalSets > 0 && <span className="workout-count">{`${doneSets} of ${totalSets} sets`}</span>}
      </div>
      <div
        className="workout-progress"
        role="progressbar"
        aria-label="Working sets done"
        aria-valuemin={0}
        aria-valuemax={totalSets}
        aria-valuenow={doneSets}
      >
        <span style={{ transform: `scaleX(${totalSets ? doneSets / totalSets : 0})` }} />
      </div>

      {editing && (
        <>
          <TimesEditor session={session} />
          <NoteField
            label="Session note"
            placeholder="Session note"
            value={session.note}
            onChange={(note) => setSessionNote(session.id, note)}
          />
        </>
      )}

      <div className="exercise-list">
        {items.map((x, i) => (
          <div key={x.item.id} className="exercise-slot">
            {i === upNextAt && <h2 className="up-next">Up next</h2>}
            {x.item.id === openId ? (
              <ExerciseCard
                sessionId={session.id}
                item={x.item}
                exercises={exercises}
                rest={rest}
                rows={x.rows}
                done={x.done}
                previous={x.last}
                active={active}
                live={live}
                current={!x.complete}
                ghosts={ghosts}
                onAddSet={() => addRow(x.item)}
              />
            ) : (
              <ExerciseRow
                item={x.item}
                exercise={x.exercise}
                complete={x.complete}
                workingDone={x.workingDone}
                workingTotal={x.working}
                goUp={x.goUp}
                onOpen={() => open(x.item, x.complete)}
              />
            )}
          </div>
        ))}
      </div>

      <button type="button" className="btn btn-block add-exercise" onClick={() => setAdding(true)}>
        + Add exercise
      </button>

      {active && (
        <div className="danger-zone">
          <button type="button" className="btn btn-block btn-quiet" onClick={discard}>
            Discard workout
          </button>
        </div>
      )}

      {adding && <ExercisePicker title="Add exercise" onPick={add} onClose={() => setAdding(false)} />}
      {/* Room for the rest bar is kept for the whole live workout, so closing the bar never shifts the page. */}
      {live && <div className="rest-spacer" />}
      {live && restTimer && <RestBar timer={restTimer} next={restNext} />}
    </>
  );
}

/**
 * Ids for pre-filled rows. Each row position keeps its id until it's
 * logged, so the input you're typing in stays the same element when it
 * becomes a set. Once a set with that id has arrived, the id is never
 * handed out again (e.g. after that set is deleted).
 */
function useGhostLog(): GhostLog & { idsFor: (item: SessionExercise) => (position: number) => string } {
  const ids = useRef(new Map<string, string>());
  const logged = useRef(new Set<string>());
  const seen = useRef(new Set<string>());
  return {
    idsFor(item) {
      item.sets.forEach((s) => seen.current.add(s.id));
      return (position) => {
        const key = `${item.id}:${position}`;
        let id = ids.current.get(key);
        if (!id || seen.current.has(id)) {
          id = newId();
          ids.current.set(key, id);
        }
        return id;
      };
    },
    isLogged: (id) => logged.current.has(id),
    markLogged: (list) => list.forEach((id) => logged.current.add(id)),
  };
}

/** Running gym time. Its own component so only it re-renders every second. */
function Elapsed({ since }: { since: number }) {
  const now = useNow(1000);
  return (
    <span className="workout-bar-timer" role="timer" aria-label="Gym time">
      {formatClock(now - since)}
    </span>
  );
}
