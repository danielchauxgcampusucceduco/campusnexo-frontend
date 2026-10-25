import { useEffect, useRef, useState } from 'react';

/** A number that rolls to its new value (300 ms, ease-out), so changes are seen, not just read. */
export function CountUp({ value, digits = 0, suffix = '' }: { value: number; digits?: number; suffix?: string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const shownRef = useRef(value);
  shownRef.current = shown;
  useEffect(() => {
    from.current = shownRef.current;
    if (from.current === value) return;
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setShown(value);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      // rAF timestamps are the frame start and can precede performance.now(): clamp at 0.
      const t = Math.min(1, Math.max(0, (now - start) / 380));
      const eased = 1 - (1 - t) ** 3;
      setShown(from.current + (value - from.current) * eased);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  const text = shown.toLocaleString('es-CO', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return <span className="tabular-nums">{text}{suffix}</span>;
}
