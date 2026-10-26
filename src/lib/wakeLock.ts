import { useEffect } from 'react';

/**
 * Keeps the screen on while `enabled` (a live workout), using the Screen
 * Wake Lock API where it exists. iOS drops the lock when the app is hidden,
 * so it's asked for again whenever the app comes back. Fails silently.
 */
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let stopped = false;

    async function request() {
      if (document.visibilityState !== 'visible' || (lock && !lock.released)) return;
      try {
        const next = await navigator.wakeLock.request('screen');
        if (stopped) void next.release().catch(() => {});
        else lock = next;
      } catch {
        // Not allowed (e.g. low battery mode): the screen just sleeps as usual.
      }
    }

    void request();
    document.addEventListener('visibilitychange', request);
    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', request);
      void lock?.release().catch(() => {});
    };
  }, [enabled]);
}
