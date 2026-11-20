import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDLE_LIMIT_MS, LAST_ACTIVITY_KEY, watchIdle } from './idleSignOut';

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe('idle sign-out', () => {
  beforeEach(() => vi.useFakeTimers({ now: Date.parse('2026-11-20T15:00:00Z') }));
  afterEach(() => vi.useRealTimers());

  const start = (storage = new MemoryStorage()) => {
    const target = new EventTarget();
    const onIdle = vi.fn();
    const stop = watchIdle({ target, storage, now: Date.now, onIdle });
    return { target, storage, onIdle, stop };
  };

  it('closes the session after 30 minutes without activity, once', () => {
    const { onIdle } = start();
    vi.advanceTimersByTime(IDLE_LIMIT_MS - 60_000);
    expect(onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60_000);
    expect(onIdle).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(IDLE_LIMIT_MS);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('a click or a key press restarts the count', () => {
    const { target, onIdle } = start();
    vi.advanceTimersByTime(20 * 60_000);
    target.dispatchEvent(new Event('keydown'));
    vi.advanceTimersByTime(20 * 60_000);
    expect(onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10 * 60_000);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('activity in another tab of the same session keeps this one open', () => {
    const { storage, onIdle } = start();
    vi.advanceTimersByTime(25 * 60_000);
    storage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    vi.advanceTimersByTime(25 * 60_000);
    expect(onIdle).not.toHaveBeenCalled();
  });

  it('stopping it (signing out by hand) cancels the timeout', () => {
    const { onIdle, stop } = start();
    stop();
    vi.advanceTimersByTime(2 * IDLE_LIMIT_MS);
    expect(onIdle).not.toHaveBeenCalled();
  });
});
