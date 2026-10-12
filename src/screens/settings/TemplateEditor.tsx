import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import ExercisePicker from '../../components/ExercisePicker';
import ScreenHeader from '../../components/ScreenHeader';
import { db } from '../../db/db';
import { addSlot, deleteTemplate, duplicateTemplate, moveSlot, renameTemplate } from '../../db/templates';
import type { Exercise, Template } from '../../db/types';
import { targetLine } from '../../lib/labels';
import { useGoBack } from '../../lib/nav';

const BACK = '/settings/templates';

export default function TemplateEditor() {
  const { id = '' } = useParams();
  const template = useLiveQuery(async () => (await db.templates.get(id)) ?? null, [id]);
  const exercises = useLiveQuery(async () => new Map((await db.exercises.toArray()).map((e) => [e.id, e])), []);

  if (template === undefined || !exercises) return <ScreenHeader title="" back={BACK} backLabel="Templates" />;
  if (template === null) {
    return (
      <>
        <ScreenHeader title="Not found" back={BACK} backLabel="Templates" />
        <p className="muted">This template no longer exists.</p>
      </>
    );
  }
  return <Editor key={template.id} template={template} exercises={exercises} />;
}

function Editor({ template, exercises }: { template: Template; exercises: Map<string, Exercise> }) {
  const navigate = useNavigate();
  const goBack = useGoBack(BACK);
  const [name, setName] = useState(template.name);
  const [picking, setPicking] = useState(false);

  function changeName(value: string) {
    setName(value);
    if (value.trim()) void renameTemplate(template.id, value);
  }

  async function addExercise(exercise: Exercise) {
    setPicking(false);
    const slot = await addSlot(template.id, exercise.id);
    navigate(`/settings/templates/${template.id}/slots/${slot.id}`);
  }

  async function duplicate() {
    const copy = await duplicateTemplate(template.id);
    navigate(`/settings/templates/${copy.id}`, { replace: true });
  }

  function remove() {
    if (!window.confirm(`Delete “${template.name}”? Past workouts keep their data.`)) return;
    // Leave first so this screen doesn't flash "Not found".
    goBack();
    void deleteTemplate(template.id);
  }

  return (
    <>
      <ScreenHeader title={template.name} back={BACK} backLabel="Templates" />

      <label className="field">
        <span className="field-label">Name</span>
        <input
          className="input"
          value={name}
          onChange={(e) => changeName(e.target.value)}
          onBlur={() => !name.trim() && setName(template.name)}
          autoCapitalize="words"
          autoComplete="off"
          enterKeyHint="done"
        />
      </label>

      <div className="field">
        <span className="field-label">Exercises</span>
        {template.slots.length === 0 && <p className="empty">No exercises yet.</p>}
        {template.slots.length > 0 && (
          <ol className="slot-list">
            {template.slots.map((slot, i) => {
              const main = exercises.get(slot.exerciseId);
              const alternatives = slot.alternativeIds.map((a) => exercises.get(a)?.name).filter(Boolean);
              return (
                <li key={slot.id} className="slot-card">
                  <Link className="slot-main" to={`/settings/templates/${template.id}/slots/${slot.id}`}>
                    <span className="slot-number">{i + 1}</span>
                    <span className="row-text">
                      <span className="row-title">{main?.name ?? 'Unknown exercise'}</span>
                      {main && <span className="row-meta">{targetLine(slot, main.type)}</span>}
                      {alternatives.length > 0 && <span className="row-meta">or {alternatives.join(', ')}</span>}
                      {slot.planNote && <span className="row-meta slot-note">{slot.planNote}</span>}
                    </span>
                  </Link>
                  <span className="slot-move">
                    <button
                      type="button"
                      aria-label={`Move ${main?.name ?? 'exercise'} up`}
                      disabled={i === 0}
                      onClick={() => moveSlot(template.id, slot.id, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${main?.name ?? 'exercise'} down`}
                      disabled={i === template.slots.length - 1}
                      onClick={() => moveSlot(template.id, slot.id, 1)}
                    >
                      ↓
                    </button>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
        <button type="button" className="btn btn-block" onClick={() => setPicking(true)}>
          + Add exercise
        </button>
      </div>

      <div className="danger-zone">
        <button type="button" className="btn btn-block" onClick={duplicate}>
          Duplicate template
        </button>
        <button type="button" className="btn btn-block btn-quiet" onClick={remove}>
          Delete template
        </button>
      </div>

      {picking && <ExercisePicker title="Add exercise" onPick={addExercise} onClose={() => setPicking(false)} />}
    </>
  );
}
