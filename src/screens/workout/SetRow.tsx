import { useEffect, useState } from 'react';
import StepField from '../../components/StepField';
import type { SetFields } from '../../db/sessions';
import type { Exercise, WorkoutSet } from '../../db/types';
import { formatKg } from '../../lib/format';

interface Props {
  /** The logged set, or undefined for a ghost row. */
  set?: WorkoutSet;
  /** Last session's set at this position: its values show dimmed as placeholders. */
  ghost?: WorkoutSet;
  /** "W" for warm-ups, otherwise the working-set number. */
  label: string;
  exercise: Exercise;
  weightUnit: string;
  /** Logged set: saves the change. Ghost row: logs the set (ghost values + this change). */
  onChange: (fields: Partial<SetFields>) => void;
  onDelete?: () => void;
}

/**
 * One set. A ghost row looks the same but dimmed; tapping "Log", typing,
 * using −/+ or the warm-up chip turns it into a real set.
 */
export default function SetRow({ set, ghost, label, exercise, weightUnit, onChange, onDelete }: Props) {
  const isGhost = set === undefined;
  const warmup = set?.warmup ?? ghost?.warmup ?? false;
  const [noteOpen, setNoteOpen] = useState(set !== undefined && set.note !== '');
  const [note, setNote] = useState(set?.note ?? '');
  const [confirming, setConfirming] = useState(false);

  // A first tap on ✕ arms delete; it disarms itself after 3 s.
  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(t);
  }, [confirming]);

  const placeholder = (v: number | null | undefined) => (v === null || v === undefined ? '–' : formatKg(v));
  const classes = ['set-row', warmup && 'is-warmup', isGhost && 'is-ghost'].filter(Boolean).join(' ');

  return (
    <li className={classes}>
      <div className="set-top">
        <span className="set-label">{label}</span>
        <button type="button" className="chip-hit" aria-pressed={warmup} onClick={() => onChange({ warmup: !warmup })}>
          <span className="chip">Warm-up</span>
        </button>
        <span className="spacer" />
        {isGhost ? (
          <button type="button" className="chip-hit" aria-label={`Log set ${label} as last time`} onClick={() => onChange({})}>
            <span className="chip chip-log">✓ Log</span>
          </button>
        ) : (
          <>
            <button
              type="button"
              className="icon-button"
              aria-label="Set note"
              aria-pressed={noteOpen}
              onClick={() => setNoteOpen((open) => !open)}
            >
              ✎
            </button>
            {confirming ? (
              <button type="button" className="chip-hit" onClick={onDelete}>
                <span className="chip chip-confirm">Delete</span>
              </button>
            ) : (
              <button type="button" className="icon-button" aria-label="Delete set" onClick={() => setConfirming(true)}>
                ✕
              </button>
            )}
          </>
        )}
      </div>
      <div className="set-inputs">
        <StepField
          label="weight"
          value={set?.weight ?? null}
          fallback={isGhost ? ghost?.weight : undefined}
          step={exercise.weightStep}
          decimal
          placeholder={placeholder(ghost?.weight)}
          unit={weightUnit}
          onChange={(weight) => onChange({ weight })}
        />
        <StepField
          label="reps"
          value={set?.reps ?? null}
          fallback={isGhost ? ghost?.reps : undefined}
          step={1}
          placeholder={placeholder(ghost?.reps)}
          unit="reps"
          onChange={(reps) => onChange({ reps })}
        />
      </div>
      {noteOpen && !isGhost && (
        <input
          className="input set-note"
          aria-label="Set note"
          placeholder="Set note"
          value={note}
          autoComplete="off"
          enterKeyHint="done"
          onChange={(e) => {
            setNote(e.target.value);
            onChange({ note: e.target.value });
          }}
        />
      )}
    </li>
  );
}
