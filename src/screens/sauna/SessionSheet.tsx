import { useState } from 'react';
import ChoiceChips from '../../components/ChoiceChips';
import NoteField from '../../components/NoteField';
import Segmented from '../../components/Segmented';
import Sheet from '../../components/Sheet';
import Stepper from '../../components/Stepper';
import { deleteSaunaEntry, saveSaunaSession } from '../../db/sauna';
import type { SaunaContext, SaunaExitReason, SaunaFeel, SaunaSession } from '../../db/types';
import {
  CONTEXT_LABEL,
  DEFAULT_ROUND_MINUTES,
  DEFAULT_ROUNDS,
  EXIT_REASON_LABEL,
  FEEL_WORDS,
  formatMmSs,
  makeRound,
  MAX_ROUNDS,
  MIN_ROUNDS,
  parseTimeLeft,
  ROUND_MINUTES,
  saunaToday,
  timeLeftInput,
} from '../../lib/sauna';

interface RoundDraft {
  plannedMin: number;
  /** Time left as shown in the field ("3:37"); blank = completed. */
  left: string;
  reason: SaunaExitReason | null;
}

interface Draft {
  date: string;
  context: SaunaContext;
  rounds: RoundDraft[];
  feel: SaunaFeel | null;
  note: string;
}

const options = <T extends string>(labels: Record<T, string>) =>
  (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));

/**
 * Editing: the session as saved. New: today, every round completed, no feel
 * score or note yet, and the context and plan copied from the last session.
 */
function initialDraft(entry: SaunaSession | undefined, last: SaunaSession | null): Draft {
  if (entry) {
    return {
      ...entry,
      rounds: entry.rounds.map((r) => ({
        plannedMin: r.plannedMin,
        left: r.leftSec > 0 ? formatMmSs(r.leftSec) : '',
        reason: r.reason,
      })),
    };
  }
  const plan = last?.rounds.map((r) => r.plannedMin) ?? Array<number>(DEFAULT_ROUNDS).fill(DEFAULT_ROUND_MINUTES);
  return {
    date: saunaToday(),
    context: last?.context ?? 'afterLifting',
    rounds: plan.map((plannedMin) => ({ plannedMin, left: '', reason: null })),
    feel: null,
    note: '',
  };
}

interface Props {
  /** The session to edit; omit to log a new one. */
  entry?: SaunaSession;
  /** The latest session, for pre-filling a new one. */
  last: SaunaSession | null;
  onClose: () => void;
}

export default function SessionSheet({ entry, last, onClose }: Props) {
  const [draft, setDraft] = useState(() => initialDraft(entry, last));
  const [error, setError] = useState<string | null>(null);
  const today = saunaToday();
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const setRound = (i: number, patch: Partial<RoundDraft>) =>
    setDraft((d) => ({ ...d, rounds: d.rounds.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));
  const setRoundCount = (n: number) =>
    setDraft((d) => ({
      ...d,
      rounds:
        n < d.rounds.length
          ? d.rounds.slice(0, n)
          : [...d.rounds, { plannedMin: d.rounds.at(-1)?.plannedMin ?? DEFAULT_ROUND_MINUTES, left: '', reason: null }],
    }));

  const parsed = draft.rounds.map((r) => parseTimeLeft(r.left, r.plannedMin));
  const roundsOk = parsed.every((p) => p.ok);
  const problem = !draft.date
    ? 'Choose a date'
    : draft.date > today
      ? 'The date can’t be in the future'
      : !roundsOk
        ? 'Check the time left above'
        : draft.feel === null
          ? 'Choose a feel score to save'
          : null;

  async function save() {
    if (problem) return;
    try {
      await saveSaunaSession(
        {
          date: draft.date,
          context: draft.context,
          rounds: draft.rounds.map((r, i) => {
            const p = parsed[i];
            return makeRound(r.plannedMin, p.ok ? p.sec : 0, r.reason);
          }),
          feel: draft.feel!,
          note: draft.note,
        },
        entry?.id,
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function remove() {
    if (!entry || !window.confirm('Delete this sauna session? This can’t be undone.')) return;
    onClose();
    void deleteSaunaEntry(entry.id);
  }

  return (
    <Sheet
      title={entry ? 'Edit sauna session' : 'Log sauna'}
      onClose={onClose}
      footer={
        <>
          {(error || problem) && (
            <p className={error ? 'form-error sheet-footer-note' : 'row-meta sheet-footer-note'} role={error ? 'alert' : undefined}>
              {error ?? problem}
            </p>
          )}
          <button type="button" className="btn btn-primary btn-block btn-tall" disabled={problem !== null} onClick={save}>
            {entry ? 'Save changes' : 'Save session'}
          </button>
        </>
      }
    >
      <label className="field">
        <span className="field-label">Date</span>
        <input className="input" type="date" value={draft.date} max={today} onChange={(e) => set({ date: e.target.value })} />
        {draft.date && draft.date < today && !entry && <span className="row-meta">Logging an earlier session</span>}
      </label>

      <div className="field">
        <div className="stepper-row">
          <span className="row-text">
            <span className="row-title">Rounds</span>
          </span>
          <Stepper label="rounds" value={draft.rounds.length} min={MIN_ROUNDS} max={MAX_ROUNDS} onChange={setRoundCount} />
        </div>
        {draft.rounds.map((round, i) => (
          <RoundEditor key={i} index={i} round={round} onChange={(patch) => setRound(i, patch)} />
        ))}
      </div>

      <div className="field">
        <span className="field-label">Feel</span>
        <Segmented
          label="Feel, 1 to 5"
          options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))}
          value={draft.feel === null ? null : String(draft.feel)}
          onChange={(v) => set({ feel: Number(v) as SaunaFeel })}
        />
        <div className="feel-scale" aria-hidden="true">
          <span>1 {FEEL_WORDS[1]}</span>
          <span>3 {FEEL_WORDS[3]}</span>
          <span>5 {FEEL_WORDS[5]}</span>
        </div>
      </div>

      <div className="field">
        <span className="field-label">Context</span>
        <Segmented label="Context" options={options(CONTEXT_LABEL)} value={draft.context} onChange={(context) => set({ context })} />
      </div>

      <div className="field">
        <span className="field-label">Note · optional</span>
        <NoteField label="Sauna note" placeholder="Anything else worth noting" value={draft.note} onChange={(note) => set({ note })} />
      </div>

      {entry && (
        <div className="danger-zone">
          <button type="button" className="btn btn-block btn-quiet" onClick={remove}>
            Delete session
          </button>
        </div>
      )}
    </Sheet>
  );
}

function RoundEditor({ index, round, onChange }: { index: number; round: RoundDraft; onChange: (patch: Partial<RoundDraft>) => void }) {
  const name = `Round ${index + 1}`;
  const completed = round.left === '';
  const parsed = parseTimeLeft(round.left, round.plannedMin);
  return (
    <div className="round-card">
      <div className="round-head">
        <span className="round-title">{name}</span>
        <Segmented
          label={`${name} planned length`}
          options={ROUND_MINUTES.map((m) => ({ value: String(m), label: `${m} min` }))}
          value={String(round.plannedMin)}
          onChange={(v) => onChange({ plannedMin: Number(v) })}
        />
      </div>
      <div className="round-result">
        <button type="button" className="round-done" aria-pressed={completed} onClick={() => onChange({ left: '', reason: null })}>
          ✓ Completed
        </button>
        <input
          className="input input-number round-left"
          inputMode="numeric"
          aria-label={`${name} time left (m:ss)`}
          placeholder="Time left"
          value={round.left}
          autoComplete="off"
          enterKeyHint="done"
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          onChange={(e) => onChange({ left: timeLeftInput(e.target.value) })}
        />
      </div>
      {!completed &&
        (parsed.ok ? (
          <>
            <p className="row-meta round-preview">
              Left with {round.left} remaining · {formatMmSs(round.plannedMin * 60 - parsed.sec)} done
            </p>
            <ChoiceChips
              label={`${name} reason (optional)`}
              options={options(EXIT_REASON_LABEL)}
              value={round.reason}
              optional
              onChange={(reason) => onChange({ reason })}
            />
          </>
        ) : (
          <p className="form-error round-error" role="alert">
            {parsed.error}
          </p>
        ))}
    </div>
  );
}
