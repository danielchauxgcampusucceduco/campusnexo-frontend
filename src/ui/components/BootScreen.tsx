import { useEffect, useState } from 'react';

/** After this long the first request is a cold start, not a slow network: say so (P3). */
const COLD_START_AFTER_S = 4;

export function BootScreen() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1_000);
    return () => clearInterval(id);
  }, []);
  const cold = seconds >= COLD_START_AFTER_S;

  return (
    <div className="grid min-h-screen place-items-center bg-paper px-4">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center text-ink-soft" role="status" aria-live="polite">
        <svg viewBox="0 0 64 64" className="h-14 w-14 animate-pulse" aria-hidden>
          <path d="M14 44 32 16l18 28" fill="none" stroke="var(--color-ink)" strokeWidth="5" strokeLinejoin="round" />
          <circle cx="32" cy="44" r="5" fill="var(--color-signal)" />
        </svg>
        <p className="text-sm">{cold ? 'Conectando con el servidor…' : 'Conectando con el gemelo digital del campus…'}</p>
        {cold && (
          <p className="text-xs">
            El servidor estaba en reposo y está despertando; en el plan gratuito tarda hasta un minuto la primera vez.
            <span className="mt-1 block tabular-nums">{seconds} s</span>
          </p>
        )}
      </div>
    </div>
  );
}
