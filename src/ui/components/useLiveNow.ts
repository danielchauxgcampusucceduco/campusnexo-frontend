import { useEffect, useRef, useState } from 'react';

/**
 * Data-source clock advanced between snapshots, so countdowns tick smoothly even when the source
 * publishes once per second (or accelerates simulated time).
 */
export function useLiveNow(sourceNow: number, timeScale: number, intervalMs = 250): number {
  const anchor = useRef({ sourceNow, realAt: performance.now() });
  if (anchor.current.sourceNow !== sourceNow) anchor.current = { sourceNow, realAt: performance.now() };
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return anchor.current.sourceNow + (performance.now() - anchor.current.realAt) * timeScale;
}

export function countdown(unattendedSince: string, now: number, limitMinutes: number): { remainingMs: number; label: string; fraction: number } {
  const remainingMs = Math.max(0, limitMinutes * 60_000 - (now - Date.parse(unattendedSince)));
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const label = `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
  return { remainingMs, label, fraction: remainingMs / (limitMinutes * 60_000) };
}
