import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useParams } from 'react-router';
import ExercisePicker from '../../components/ExercisePicker';
import ScreenHeader from '../../components/ScreenHeader';
import Segmented from '../../components/Segmented';
import Stepper from '../../components/Stepper';
import { db } from '../../db/db';
import {
  MAX_REPS,
  MAX_SETS,
  removeSlot,
  updateSlot,
  withAlternative,
  withDefault,
  withoutAlternative,
} from '../../db/templates';
import type { Exercise, Template, TemplateSlot } from '../../db/types';
import { exerciseMeta, WARMUP_LABEL, WARMUP_POLICIES, WARMUP_SHORT } from '../../lib/labels';
import { useGoBack } from '../../lib/nav';

export default function SlotEditor() {
  const { id = '', slotId = '' } = useParams();
  const back = `/settings/templates/${id}`;
  const template = useLiveQuery(async () => (await db.templates.get(id)) ?? null, [id]);
  const exercises = useLiveQuery(async () => new Map((await db.exercises.toArray()).map((e) => [e.id, e])), []);
  const slot = template?.slots.find((s) => s.id === slotId);

  if (template === undefined || !exercises) return <ScreenHeader title="" back={back} backLabel="Template" />;
  if (!template || !slot) {
    return (
      <>
        <ScreenHeader title="Not found" back={back} backLabel="Template" />
        <p className="muted">This exercise is no longer in the template.</p>
      </>
    );
  }
  return <Editor key={slot.id} template={template} slot={slot} exercises={exercises} />;
}

interface EditorProps {
  template: Template;
  slot: TemplateSlot;
  exercises: Map<string, Exercise>;
}

function Editor({ template, slot, exercises }: EditorProps) {
  const goBack = useGoBack(`/settings/templates/${template.id}`);
  const [picking, setPicking] = useState<'default' | 'alternative' | null>(null);
  const [note, setNote] = useState(slot.planNote);
  const main = exercises.get(slot.exerciseId);
  const change = (fn: (s: TemplateSlot) => TemplateSlot) => updateSlot(template.id, slot.id, fn);

  function pick(exercise: Exercise) {
    const mode = picking;
    setPicking(null);
    if (mode === 'default') void change((s) => withDefault(s, exercise.id));
    if (mode === 'alternative') void change((s) => withAlternative(s, exercise.id));
  }

  function remove() {
    if (!window.confirm(`Remove ${main?.name ?? 'this exercise'} from ${template.name}?`)) return;
    goBack();
    void removeSlot(template.id, slot.id);
  }

  return (
    <>
      <ScreenHeader title={main?.name ?? 'Exercise'} back={`/settings/templates/${template.id}`} backLabel={template.name} />

      <div className="field">
        <span className="field-label">Default exercise</span>
        <button type="button" className="list-row card-row" onClick={() => setPicking('default')}>
          <span className="row-text">
            <span className="row-title">{main?.name ?? 'Choose exercise'}</span>
            {main && <span className="row-meta">{exerciseMeta(main)}</span>}
          </span>
          <span className="row-action">Change</span>
        </button>
      </div>

      <div className="field">
        <span className="field-label">Alternatives</span>
        {slot.alternativeIds.length > 0 && (
          <ul className="list">
            {slot.alternativeIds.map((altId) => {
              const alt = exercises.get(altId);
              if (!alt) return null;
              return (
                <li key={altId} className="list-row">
                  <span className="row-text">
                    <span className="row-title">{alt.name}</span>
                    <span className="row-meta">{exerciseMeta(alt)}</span>
                  </span>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remove ${alt.name}`}
                    onClick={() => change((s) => withoutAlternative(s, altId))}
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <button type="button" className="btn btn-block" onClick={() => setPicking('alternative')}>
          + Add alternative
        </button>
      </div>

      <div className="field">
        <span className="field-label">Target</span>
        <div className="stepper-row">
          <span className="row-title">Sets</span>
          <Stepper
            label="sets"
            value={slot.targetSets}
            min={1}
            max={MAX_SETS}
            onChange={(targetSets) => change((s) => ({ ...s, targetSets }))}
          />
        </div>
        <div className="stepper-row">
          <span className="row-title">Min reps</span>
          <Stepper
            label="min reps"
            value={slot.repMin}
            min={1}
            max={MAX_REPS}
            onChange={(repMin) => change((s) => ({ ...s, repMin, repMax: Math.max(repMin, s.repMax) }))}
          />
        </div>
        <div className="stepper-row">
          <span className="row-title">Max reps</span>
          <Stepper
            label="max reps"
            value={slot.repMax}
            min={1}
            max={MAX_REPS}
            onChange={(repMax) => change((s) => ({ ...s, repMax, repMin: Math.min(repMax, s.repMin) }))}
          />
        </div>
      </div>

      <div className="field">
        <span className="field-label">Warm-up · {WARMUP_LABEL[slot.warmup]}</span>
        <Segmented
          label="Warm-up"
          options={WARMUP_POLICIES.map((p) => ({ value: p, label: WARMUP_SHORT[p] }))}
          value={slot.warmup}
          onChange={(warmup) => change((s) => ({ ...s, warmup }))}
        />
      </div>

      <label className="field">
        <span className="field-label">Plan note</span>
        <input
          className="input"
          value={note}
          placeholder="e.g. Use safety pins"
          onChange={(e) => {
            const planNote = e.target.value;
            setNote(planNote);
            void change((s) => ({ ...s, planNote: planNote.trim() }));
          }}
          autoComplete="off"
          enterKeyHint="done"
        />
      </label>

      <button type="button" className="btn btn-block btn-quiet" onClick={remove}>
        Remove from template
      </button>

      {picking && (
        <ExercisePicker
          title={picking === 'default' ? 'Default exercise' : 'Add alternative'}
          excludeIds={picking === 'default' ? [slot.exerciseId] : [slot.exerciseId, ...slot.alternativeIds]}
          onPick={pick}
          onClose={() => setPicking(null)}
        />
      )}
    </>
  );
}
