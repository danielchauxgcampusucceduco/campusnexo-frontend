/** 30 minutes without using the dashboard close the session. */
export const IDLE_LIMIT_MS = 30 * 60_000;
/** Activity is written at most this often; the check runs as often. */
const TICK_MS = 15_000;
/** Shared by every tab of the same session, so an idle tab never closes the session another tab is using. */
export const LAST_ACTIVITY_KEY = 'campusnexo.ultimaActividad';
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

interface Options {
  target: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
  storage: Pick<Storage, 'getItem' | 'setItem'> | null;
  now: () => number;
  onIdle: () => void;
  limitMs?: number;
}

/**
 * Watches the user's activity and calls `onIdle` once after `limitMs` without any, in this tab or in another one of
 * the same session. It compares instants instead of trusting one long timer, so a laptop that slept past the limit
 * closes the session as soon as it wakes. Returns the function that stops watching.
 */
export function watchIdle({ target, storage, now, onIdle, limitMs = IDLE_LIMIT_MS }: Options): () => void {
  let last = now();
  let written = 0;
  const share = (at: number) => {
    try {
      storage?.setItem(LAST_ACTIVITY_KEY, String(at));
    } catch {
      // Storage may be blocked; this tab still counts its own activity.
    }
  };
  const shared = () => {
    try {
      const value = Number(storage?.getItem(LAST_ACTIVITY_KEY));
      return Number.isFinite(value) ? value : 0;
    } catch {
      return 0;
    }
  };
  const onActivity = () => {
    last = now();
    if (last - written >= TICK_MS) {
      written = last;
      share(last);
    }
  };
  share(last);
  written = last;
  ACTIVITY_EVENTS.forEach((type) => target.addEventListener(type, onActivity, { passive: true, capture: true }));
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    ACTIVITY_EVENTS.forEach((type) => target.removeEventListener(type, onActivity, { capture: true }));
  };
  const timer = setInterval(() => {
    if (now() - Math.max(last, shared()) >= limitMs) {
      stop();
      onIdle();
    }
  }, TICK_MS);
  return stop;
}
