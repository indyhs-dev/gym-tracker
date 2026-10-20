import { useState } from 'react';
import { flushSync } from 'react-dom';
import ActionSheet from '../../components/ActionSheet';
import NumberField from '../../components/NumberField';
import type { SetFields } from '../../db/sessions';
import type { Exercise, WorkoutSet } from '../../db/types';
import { setText } from '../../lib/setText';

interface Props {
  set: WorkoutSet;
  /** Last session's matching set, shown in the Previous column (display only). */
  previous?: WorkoutSet;
  /** "W" for warm-ups, otherwise the working-set number. */
  label: string;
  exercise: Exercise;
  onChange: (fields: Partial<SetFields>) => void;
  onDelete: () => void;
  /** Live workout only: the ✓ that marks the set done and starts the rest timer. */
  onDone?: () => void;
  /** Ticked done. */
  done?: boolean;
}

/**
 * One set as a table row: set number, last time's matching set, kg, reps and
 * (live workout) ✓. Tapping the set number opens its menu: warm-up, note,
 * delete. Nothing that can delete sits next to the inputs.
 */
export default function SetRow({ set, previous, label, exercise, onChange, onDelete, onDone, done = false }: Props) {
  const [menu, setMenu] = useState(false);
  const [noteOpen, setNoteOpen] = useState(set.note !== '');
  const [note, setNote] = useState(set.note);
  const name = set.warmup ? 'Warm-up set' : `Set ${label}`;
  const noteId = `set-note-${set.id}`;
  const classes = ['set-row', set.warmup && 'is-warmup', done && 'is-done'].filter(Boolean).join(' ');

  /** Shows the note field and focuses it inside the same tap, so iOS brings up the keyboard. */
  function openNote() {
    flushSync(() => setNoteOpen(true));
    document.getElementById(noteId)?.focus();
  }

  return (
    <li className={classes}>
      <button type="button" className="set-label" aria-label={`${name} options`} onClick={() => setMenu(true)}>
        {label}
      </button>
      <span className="set-prev">{previous ? setText(previous, exercise) : '–'}</span>
      <NumberField label="weight" value={set.weight} decimal onChange={(weight) => onChange({ weight })} />
      <NumberField label="reps" value={set.reps} onChange={(reps) => onChange({ reps })} />
      {onDone && (
        <button
          type="button"
          className="done-button"
          aria-label={`${name} done, start rest`}
          aria-pressed={done}
          onClick={onDone}
        >
          <span aria-hidden="true">✓</span>
        </button>
      )}
      {noteOpen && (
        <input
          id={noteId}
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
      {menu && (
        <ActionSheet
          title={name}
          onClose={() => setMenu(false)}
          actions={[
            { label: set.warmup ? 'Make it a working set' : 'Make it a warm-up', onSelect: () => onChange({ warmup: !set.warmup }) },
            ...(noteOpen ? [] : [{ label: 'Add note', onSelect: openNote }]),
            { label: 'Delete set', danger: true, onSelect: onDelete },
          ]}
        />
      )}
    </li>
  );
}
