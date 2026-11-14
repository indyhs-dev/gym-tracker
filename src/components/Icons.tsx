/** Small line icons. All are decorative (aria-hidden); the button or link carries the label. */

export function BackIcon() {
  return (
    <svg className="icon" width="10" height="16" viewBox="0 0 10 16" aria-hidden="true">
      <path d="M8 2 2 8l6 6" />
    </svg>
  );
}

export function ChevronIcon() {
  return (
    <svg className="icon" width="8" height="14" viewBox="0 0 8 14" aria-hidden="true">
      <path d="m1.5 1.5 5 5.5-5 5.5" />
    </svg>
  );
}

export function CheckIcon({ size = 14 }: { size?: number }) {
  return (
    <svg className="icon icon-check" width={size} height={size} viewBox="0 0 14 14" aria-hidden="true">
      <path d="m2.5 7.5 3 3 6-7" />
    </svg>
  );
}

export function SettingsIcon() {
  return (
    <svg className="icon" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function MoreIcon() {
  return (
    <svg width="18" height="4" viewBox="0 0 18 4" fill="currentColor" aria-hidden="true">
      <circle cx="2" cy="2" r="2" />
      <circle cx="9" cy="2" r="2" />
      <circle cx="16" cy="2" r="2" />
    </svg>
  );
}

/** The app icon (public/icon.svg) beside the "Gym" title. Keep the two in sync. */
export function AppIcon() {
  return (
    <svg className="app-icon" width="34" height="34" viewBox="0 0 512 512" aria-hidden="true">
      <defs>
        <linearGradient id="app-icon-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3A2412" />
          <stop offset="1" stopColor="#0E0C0A" />
        </linearGradient>
        <radialGradient id="app-icon-glow" cx="1" cy="0" r="1">
          <stop offset="0" stopColor="#FFA53D" stopOpacity="0.3" />
          <stop offset="0.6" stopColor="#FFA53D" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="512" height="512" fill="url(#app-icon-bg)" />
      <rect width="512" height="512" fill="url(#app-icon-glow)" />
      <path d="M138 276 L218 356 L332 214" fill="none" stroke="#FFA53D" strokeWidth="56" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M386 142 L376 252 L282 176 Z" fill="#FFA53D" stroke="#FFA53D" strokeWidth="18" strokeLinejoin="round" />
    </svg>
  );
}
