import { useEffect, useRef } from 'react';
import { CheckIcon } from '../../components/Icons';
import { addRestTime, restClock, stopRest, type RestTimer } from '../../lib/restTimer';
import { playReadySound, unlockSound } from '../../lib/sound';
import { formatClock } from '../../lib/time';
import { useNow } from '../../lib/useNow';

/** The rest that last beeped. */
let beepedFor: string | null = null;

interface Props {
  timer: RestTimer;
  /** What's up next, e.g. "Set 2 next" or "Pull-up next". */
  next: string | null;
}

/**
 * The rest timer, pinned to the bottom of a live workout. It counts down to
 * the lower end of the rest guidance, with a thin line on top running out
 * (accent after a working set, grey after a warm-up). At zero it turns
 * green: "Ready", with how long you've rested counting up. One clock only.
 */
export default function RestBar({ timer, next }: Props) {
  const now = useNow(250);
  const { ready, remaining, elapsed, left } = restClock(timer, now);
  const warmup = timer.setId === null;

  // Beep when the countdown reaches zero while you're watching (not when reopening the app later),
  // once per rest even if the effect runs twice.
  const wasReady = useRef(ready);
  const restKey = `${timer.startedAt}:${timer.range.min}`;
  useEffect(() => {
    if (ready && !wasReady.current && beepedFor !== restKey) {
      beepedFor = restKey;
      playReadySound();
    }
    wasReady.current = ready;
  }, [ready, restKey]);

  const label = warmup ? 'Warm-up rest · not logged' : `Rest${next ? ` · ${next}` : ''}`;

  return (
    <div className={`rest-bar${ready ? ' is-ready' : ''}${warmup ? ' is-warmup' : ''}`}>
      <span className="rest-bar-line">
        <span style={{ transform: `scaleX(${ready ? 1 : left})` }} />
      </span>
      <div className="rest-bar-inner">
        <div className="rest-bar-text">
          <span className="rest-bar-label">{ready ? `Rested ${formatClock(elapsed)} · go when ready` : label}</span>
          {ready ? (
            <span className="rest-bar-clock" aria-live="polite">
              <CheckIcon size={26} />
              Ready
            </span>
          ) : (
            <span className="rest-bar-clock" role="timer" aria-label="Rest left">
              {formatClock(remaining + 999)}
            </span>
          )}
        </div>
        {ready ? (
          <button type="button" className="rest-bar-button" onClick={stopRest}>
            Dismiss
          </button>
        ) : (
          <>
            <button
              type="button"
              className="rest-bar-button"
              onClick={() => {
                unlockSound();
                addRestTime(30);
              }}
            >
              +30 s
            </button>
            <button type="button" className="rest-bar-button" onClick={stopRest}>
              Skip
            </button>
          </>
        )}
      </div>
    </div>
  );
}
