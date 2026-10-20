import { useEffect, type ReactNode } from 'react';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Pinned below the scrolling content (e.g. a Save button that's always in reach). */
  footer?: ReactNode;
}

/** While a sheet is open: the page behind it doesn't scroll, and Escape closes it. */
export function useSheet(onClose: () => void) {
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      root.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
}

/** Bottom sheet over the current screen. Render it only while open. */
export default function Sheet({ title, onClose, children, footer }: Props) {
  useSheet(onClose);

  return (
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-header">
          <h2 className="sheet-title">{title}</h2>
          <button type="button" className="sheet-close" onClick={onClose}>
            Cancel
          </button>
        </div>
        <div className={footer ? 'sheet-body has-footer' : 'sheet-body'}>{children}</div>
        {footer && <div className="sheet-footer">{footer}</div>}
      </div>
    </div>
  );
}
