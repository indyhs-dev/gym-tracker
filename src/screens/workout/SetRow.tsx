import { useRef, useState, type PointerEvent } from 'react';
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
  /** Swiped left, showing Delete. One row at a time; the card keeps track. */
  swiped: boolean;
  onSwipe: (open: boolean) => void;
}

export const weightInputId = (rowId: string) => `kg-${rowId}`;
export const repsInputId = (rowId: string) => `reps-${rowId}`;

/** Width of the Delete button a swipe reveals. */
const DELETE_WIDTH = 88;
/** Sideways movement before a touch counts as a swipe rather than a tap or scroll. */
const SWIPE_START = 10;

/**
 * One set as a table row: set number, kg, reps and ✓. Last time's values
 * sit in the empty inputs as placeholders. Swiping left reveals Delete,
 * which works on pre-filled rows too; deleting takes a deliberate tap on it.
 * Tapping a logged set's number opens its menu (warm-up, note, delete).
 */
export default function SetRow({ row, label, onChange, onDelete, onDone, done = false, next = false, swiped, onSwipe }: Props) {
  const { set } = row;
  const [menu, setMenu] = useState(false);
  const [noteOpen, setNoteOpen] = useState((set?.note ?? '') !== '');
  const [note, setNote] = useState(set?.note ?? '');
  /** Offset while a finger is dragging the row; null when it rests open or closed. */
  const [dragX, setDragX] = useState<number | null>(null);
  const drag = useRef<{ pointer: number; x: number; y: number; from: number; at: number; swiping: boolean } | null>(null);
  /** A swipe just ended: the click that may follow it isn't a tap. */
  const swipedNow = useRef(false);
  const name = row.warmup ? 'Warm-up set' : `Set ${label}`;
  const noteId = `set-note-${row.id}`;
  const classes = ['set-row', row.warmup && 'is-warmup', done && 'is-done', next && 'is-next'].filter(Boolean).join(' ');
  const { weight, reps } = row.placeholder;
  const offset = dragX ?? (swiped ? -DELETE_WIDTH : 0);

  /** Shows the note field and focuses it inside the same tap, so iOS brings up the keyboard. */
  function openNote() {
    flushSync(() => setNoteOpen(true));
    document.getElementById(noteId)?.focus();
  }

  function pointerDown(e: PointerEvent) {
    swipedNow.current = false;
    if (e.button !== 0) return;
    const from = swiped ? -DELETE_WIDTH : 0;
    drag.current = { pointer: e.pointerId, x: e.clientX, y: e.clientY, from, at: from, swiping: false };
  }

  function pointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.swiping) {
      // Mostly up or down: a scroll, so let it go.
      if (Math.abs(dy) > SWIPE_START && Math.abs(dy) > Math.abs(dx)) drag.current = null;
      if (Math.abs(dx) < SWIPE_START || Math.abs(dx) <= Math.abs(dy)) return;
      d.swiping = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    d.at = Math.min(0, Math.max(-DELETE_WIDTH, d.from + dx));
    setDragX(d.at);
  }

  function pointerUp(e: PointerEvent) {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    drag.current = null;
    if (!d.swiping) return;
    swipedNow.current = true;
    onSwipe(d.at < -DELETE_WIDTH / 2);
    setDragX(null);
  }

  function pointerCancel() {
    drag.current = null;
    setDragX(null);
  }

  return (
    <li className={classes}>
      <div className={offset ? 'set-swipe is-revealed' : 'set-swipe'}>
        <button
          type="button"
          className="set-delete"
          inert={!swiped}
          aria-label={`Delete ${name.toLowerCase()}`}
          onClick={() => {
            onSwipe(false);
            onDelete();
          }}
        >
          Delete
        </button>
        <div
          className={dragX === null ? 'set-row-main' : 'set-row-main is-dragging'}
          style={offset ? { transform: `translateX(${offset}px)` } : undefined}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={pointerCancel}
          onClickCapture={(e) => {
            if (swipedNow.current) {
              swipedNow.current = false;
              e.preventDefault();
              e.stopPropagation();
            }
          }}
        >
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
        </div>
      </div>
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
