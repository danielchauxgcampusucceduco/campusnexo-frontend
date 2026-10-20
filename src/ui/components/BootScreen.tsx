export function BootScreen() {
  return (
    <div className="grid min-h-screen place-items-center bg-paper">
      <div className="flex flex-col items-center gap-4 text-ink-soft">
        <svg viewBox="0 0 64 64" className="h-14 w-14 animate-pulse" aria-hidden>
          <path d="M14 44 32 16l18 28" fill="none" stroke="var(--color-ink)" strokeWidth="5" strokeLinejoin="round" />
          <circle cx="32" cy="44" r="5" fill="var(--color-signal)" />
        </svg>
        <p className="text-sm">Conectando con el gemelo digital del campus…</p>
      </div>
    </div>
  );
}
