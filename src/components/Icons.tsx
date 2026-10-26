/** Small line icons used on the workout screen. All are decorative (aria-hidden); the button carries the label. */

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

export function StopwatchIcon() {
  return (
    <svg className="icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="9" r="5.5" />
      <path d="M8 9V6.5M6.5 1.5h3" />
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
