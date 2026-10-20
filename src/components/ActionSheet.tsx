import { useSheet } from './Sheet';

export interface Action {
  label: string;
  onSelect: () => void;
  /** Destructive (delete, remove): shown in red. */
  danger?: boolean;
}

interface Props {
  title: string;
  actions: Action[];
  onClose: () => void;
}

/** A short menu of actions that slides up from the bottom, iOS style. Render it only while open. */
export default function ActionSheet({ title, actions, onClose }: Props) {
  useSheet(onClose);

  return (
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="action-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="action-group">
          <p className="action-title">{title}</p>
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              className={a.danger ? 'action is-danger' : 'action'}
              onClick={() => {
                onClose();
                a.onSelect();
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
        <button type="button" className="action action-cancel" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
