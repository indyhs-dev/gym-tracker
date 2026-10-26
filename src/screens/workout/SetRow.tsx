import { useState } from 'react';
import { flushSync } from 'react-dom';
import ActionSheet from '../../components/ActionSheet';
import { CheckIcon } from '../../components/Icons';
import NumberField from '../../components/NumberField';
import type { SetFields } from '../../db/sessions';
import { formatKg } from '../../lib/format';
import type { SetRowData } from '../../lib/setRows';

interface Props {
  row: SetRowData;
  /** "W" for warm-ups, otherwise the working-set number. */
  label: string;
  onChange: (fields: Partial<SetFields>) => void;
  onDelete: () => void;
  /** During a workout: the ✓ that logs the row (placeholders fill empty inputs) and starts the rest timer. */
  onDone?: () => void;
  done?: boolean;
  /** The next set to do: accent set number and kg border. */
  next?: boolean;
}

export const weightInputId = (rowId: string) => `kg-${rowId}`;
export const repsInputId = (rowId: string) => `reps-${rowId}`;

/**
 * One set as a table row: set number, kg, reps and ✓. Last time's values
 * sit in the empty inputs as placeholders. Tapping the set number opens its
 * menu (warm-up, note, delete), so nothing that can delete sits next to the
 * inputs. A pre-filled row that hasn't been logged yet has no menu.
 */
export default function SetRow({ row, label, onChange, onDelete, onDone, done = false, next = false }: Props) {
  const { set } = row;
  const [menu, setMenu] = useState(false);
  const [noteOpen, setNoteOpen] = useState((set?.note ?? '') !== '');
  const [note, setNote] = useState(set?.note ?? '');
  const name = row.warmup ? 'Warm-up set' : `Set ${label}`;
  const noteId = `set-note-${row.id}`;
  const classes = ['set-row', row.warmup && 'is-warmup', done && 'is-done', next && 'is-next'].filter(Boolean).join(' ');
  const { weight, reps } = row.placeholder;

  /** Shows the note field and focuses it inside the same tap, so iOS brings up the keyboard. */
  function openNote() {
    flushSync(() => setNoteOpen(true));
    document.getElementById(noteId)?.focus();
  }

  return (
    <li className={classes}>
      {set ? (
        <button type="button" className="set-label" aria-label={`${name} options`} onClick={() => setMenu(true)}>
          {label}
        </button>
      ) : (
        <span className="set-label">{label}</span>
      )}
      <NumberField
        id={weightInputId(row.id)}
        className="set-kg"
        label={`${name} weight`}
        value={set?.weight ?? null}
        placeholder={weight === null ? undefined : formatKg(weight)}
        decimal
        onChange={(w) => onChange({ weight: w })}
      />
      <NumberField
        id={repsInputId(row.id)}
        label={`${name} reps`}
        value={set?.reps ?? null}
        placeholder={reps === null ? undefined : String(reps)}
        onChange={(r) => onChange({ reps: r })}
      />
      {onDone && (
        <button type="button" className="done-button" aria-label={`${name} done`} aria-pressed={done} onClick={onDone}>
          <CheckIcon size={18} />
        </button>
      )}
      {set && noteOpen && (
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
      {menu && set && (
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
