import { useEffect, useState } from 'react';
import StepField from '../../components/StepField';
import type { SetFields } from '../../db/sessions';
import type { Exercise, WorkoutSet } from '../../db/types';

interface Props {
  set: WorkoutSet;
  weightUnit: string;
  /** "W" for warm-ups, otherwise the working-set number. */
  label: string;
  exercise: Exercise;
  onChange: (fields: Partial<SetFields>) => void;
  onDelete: () => void;
}

export default function SetRow({ set, weightUnit, label, exercise, onChange, onDelete }: Props) {
  const [noteOpen, setNoteOpen] = useState(set.note !== '');
  const [note, setNote] = useState(set.note);
  const [confirming, setConfirming] = useState(false);

  // A first tap on ✕ arms delete; it disarms itself after 3 s.
  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(t);
  }, [confirming]);

  return (
    <li className={set.warmup ? 'set-row is-warmup' : 'set-row'}>
      <div className="set-top">
        <span className="set-label">{label}</span>
        <button type="button" className="chip-hit" aria-pressed={set.warmup} onClick={() => onChange({ warmup: !set.warmup })}>
          <span className="chip">Warm-up</span>
        </button>
        <span className="spacer" />
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
      </div>
      <div className="set-inputs">
        <StepField
          label="weight"
          value={set.weight}
          step={exercise.weightStep}
          decimal
          placeholder="–"
          unit={weightUnit}
          onChange={(weight) => onChange({ weight })}
        />
        <StepField label="reps" value={set.reps} step={1} placeholder="–" unit="reps" onChange={(reps) => onChange({ reps })} />
      </div>
      {noteOpen && (
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
