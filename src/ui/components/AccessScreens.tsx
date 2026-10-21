import { LogIn, RefreshCw, ServerOff, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-paper px-4">
      <div className="floor-enter w-full max-w-sm rounded-2xl border border-rule bg-sheet p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2.5">
          <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
            <rect width="32" height="32" rx="7" fill="var(--color-night)" />
            <path d="M8 21 16 9l8 12" fill="none" stroke="var(--color-signal)" strokeWidth="3" strokeLinejoin="round" />
            <circle cx="16" cy="21" r="2.6" fill="var(--color-paper)" />
          </svg>
          <div className="leading-tight">
            <p className="lettering text-base font-semibold">CampusNexo</p>
            <p className="text-xs text-ink-soft">UCC Campus Pasto</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Sign-in with the account an administrator created for you (jury, staff or administrator). */
export function LoginScreen({ reason, submit, chooseSimulation }: {
  reason: string;
  submit: (username: string, password: string) => Promise<void>;
  chooseSimulation: () => void;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await submit(username.trim(), password);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
      setBusy(false);
    }
  };

  return (
    <Shell>
      <h1 className="text-xl font-semibold">Iniciar sesión</h1>
      <p className="mt-1 text-sm text-ink-soft">{reason}</p>
      <form className="mt-5 flex flex-col gap-3" onSubmit={(event) => void onSubmit(event)}>
        <label className="flex flex-col gap-1 text-sm">
          Usuario
          <input autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)}
            className="rounded-lg border border-rule bg-white px-3 py-2 text-base" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Contraseña
          <input type="password" autoComplete="current-password" required value={password}
            onChange={(e) => setPassword(e.target.value)} className="rounded-lg border border-rule bg-white px-3 py-2 text-base" />
        </label>
        {error && <p role="alert" className="text-sm text-st-sobrecupo-ink">{error}</p>}
        <button type="submit" disabled={busy}
          className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-night px-4 py-2.5 text-sm font-medium text-night-text disabled:opacity-60">
          <LogIn className="h-4 w-4" />{busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      <p className="mt-4 flex items-start gap-2 text-xs text-ink-soft">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        Lo que puedes hacer depende de tu rol: ver (jurado), operar salones y reservas (personal) o ejecutar las demostraciones (administrador).
      </p>
      <button type="button" onClick={chooseSimulation} className="mt-4 text-sm font-medium text-st-optimo-ink">
        Ver la simulación (datos generados, no del campus)
      </button>
    </Shell>
  );
}

/** The server did not answer: say so plainly and let the person decide, instead of showing invented data. */
export function UnavailableScreen({ reason, retry, chooseSimulation }: {
  reason: string;
  retry: () => void;
  chooseSimulation: () => void;
}) {
  return (
    <Shell>
      <div className="flex items-center gap-2 text-st-sobrecupo-ink"><ServerOff className="h-5 w-5" /><h1 className="text-xl font-semibold">Sin conexión con el servidor</h1></div>
      <p className="mt-2 text-sm text-ink-soft">{reason}. El tablero no muestra datos inventados en su lugar.</p>
      <div className="mt-5 flex flex-col gap-2">
        <button type="button" onClick={retry}
          className="flex items-center justify-center gap-2 rounded-xl bg-night px-4 py-2.5 text-sm font-medium text-night-text">
          <RefreshCw className="h-4 w-4" />Reintentar
        </button>
        <button type="button" onClick={chooseSimulation}
          className="rounded-xl border border-rule px-4 py-2.5 text-sm font-medium">
          Usar la simulación (datos generados, no del campus)
        </button>
      </div>
    </Shell>
  );
}
