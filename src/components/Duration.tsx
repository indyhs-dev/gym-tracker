import { formatDuration } from '../lib/time';

/** "1h 12m" with large numbers and small units. */
export default function Duration({ ms }: { ms: number }) {
  const parts = [...formatDuration(ms).matchAll(/(\d+)([hm])/g)];
  return (
    <>
      {parts.map(([, n, unit], i) => (
        <span key={i}>
          {i > 0 && ' '}
          {n}
          <span className="stat-unit">{unit}</span>
        </span>
      ))}
    </>
  );
}
