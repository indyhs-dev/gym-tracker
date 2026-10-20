import type { ReactNode } from 'react';
import { useSheet } from './Sheet';

export interface Action {
  label: string;
  onSelect: () => void;
  /** Destructive (delete, remove): shown in red. */
  danger?: boolean;
}

interface Props {
  title: string;
  actions?: Action[];
  /** Text under the title, for a sheet that explains something. */
  children?: ReactNode;
  /** The bottom button that just closes it. */
  closeLabel?: string;
  onClose: () => void;
}

/** A short menu (or explanation) that slides up from the bottom, iOS style. Render it only while open. */
export default function ActionSheet({ title, actions = [], children, closeLabel = 'Cancel', onClose }: Props) {
  useSheet(onClose);

  return (
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="action-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="action-group">
          <p className="action-title">{title}</p>
          {children && <div className="action-body">{children}</div>}
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
          {closeLabel}
        </button>
      </div>
    </div>
  );
}
