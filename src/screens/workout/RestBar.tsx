import { stopRest, type RestTimer } from '../../lib/restTimer';
import { formatClock } from '../../lib/time';
import { useNow } from '../../lib/useNow';

/**
 * The rest timer, pinned to the bottom of a live workout. It counts up from
 * the ✓, red while you should still be resting, green once the lower end of
 * the rest guidance has passed.
 */
export default function RestBar({ timer }: { timer: RestTimer }) {
  const now = useNow(250);
  const elapsed = Math.max(0, now - timer.startedAt);
  const ready = elapsed >= timer.range.min * 1000;
  const progress = Math.min(1, elapsed / (timer.range.min * 1000 || 1));

  return (
    <div className={`rest-bar ${ready ? 'is-ready' : 'is-resting'}`}>
      <div className="rest-bar-inner">
        <div className="rest-bar-text">
          <span className="rest-bar-state" aria-live="polite">
            {ready ? 'Go' : 'Rest'}
          </span>
          <span className="rest-bar-detail">
            {ready ? `Ready · guide ${timer.text}` : `Ready in ${formatClock(timer.range.min * 1000 - elapsed + 999)}`}
          </span>
        </div>
        <span className="rest-bar-clock" role="timer" aria-label="Rest time">
          {formatClock(elapsed)}
        </span>
        <button type="button" className="rest-bar-close" aria-label="Stop rest timer" onClick={stopRest}>
          ✕
        </button>
      </div>
      {!ready && <span className="rest-bar-progress" style={{ transform: `scaleX(${progress})` }} />}
    </div>
  );
}
