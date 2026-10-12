import { useState, type FormEvent, type ReactNode } from 'react';
import { DEFAULT_WEIGHT_STEP, type ExerciseInput } from '../db/exercises';
import type { Exercise, ExerciseType } from '../db/types';
import { formatKg, parseDecimal } from '../lib/format';
import { EXERCISE_TYPES, TYPE_LABEL } from '../lib/labels';
import Segmented from './Segmented';
import Toggle from './Toggle';

export interface ExerciseDraft {
  name: string;
  type: ExerciseType | null;
  perHand: boolean;
  bodyweight: boolean;
  weightStep: string;
}

export function draftFrom(exercise?: Exercise, name = ''): ExerciseDraft {
  if (!exercise) {
    return { name, type: null, perHand: false, bodyweight: false, weightStep: formatKg(DEFAULT_WEIGHT_STEP) };
  }
  return {
    name: exercise.name,
    type: exercise.type,
    perHand: exercise.perHand,
    bodyweight: exercise.bodyweight,
    weightStep: formatKg(exercise.weightStep),
  };
}

interface Props {
  initial: ExerciseDraft;
  submitLabel: string;
  onSubmit: (input: ExerciseInput) => Promise<void>;
  autoFocusName?: boolean;
  children?: ReactNode;
}

export default function ExerciseForm({ initial, submitLabel, onSubmit, autoFocusName, children }: Props) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<ExerciseDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setError(null);
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const weightStep = parseDecimal(draft.weightStep);
    if (!draft.name.trim()) return setError('Enter a name');
    if (!draft.type) return setError('Choose a type');
    if (weightStep === null || weightStep <= 0) return setError('Weight step must be more than 0');
    setBusy(true);
    try {
      await onSubmit({ name: draft.name, type: draft.type, perHand: draft.perHand, bodyweight: draft.bodyweight, weightStep });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <label className="field">
        <span className="field-label">Name</span>
        <input
          className="input"
          value={draft.name}
          onChange={(e) => set({ name: e.target.value })}
          autoFocus={autoFocusName}
          autoCapitalize="words"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
        />
      </label>

      <div className="field">
        <span className="field-label">Type</span>
        <Segmented
          label="Type"
          options={EXERCISE_TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] }))}
          value={draft.type}
          onChange={(type) => set({ type })}
        />
      </div>

      <div className="field">
        <Toggle label="Per hand" hint="Weight is per dumbbell" checked={draft.perHand} onChange={(perHand) => set({ perHand })} />
        <Toggle
          label="Bodyweight"
          hint="Weight is added load; 0 = bodyweight"
          checked={draft.bodyweight}
          onChange={(bodyweight) => set({ bodyweight })}
        />
      </div>

      <label className="field">
        <span className="field-label">Weight step (kg)</span>
        <input
          className="input input-number"
          value={draft.weightStep}
          onChange={(e) => set({ weightStep: e.target.value })}
          inputMode="decimal"
          autoComplete="off"
        />
      </label>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
        {submitLabel}
      </button>
      {children}
    </form>
  );
}
