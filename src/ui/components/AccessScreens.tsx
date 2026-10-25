import { LogIn, RefreshCw, ServerOff, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Logo } from './Logo';

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-paper px-4">
      <div className="floor-enter w-full max-w-sm rounded-2xl border border-rule bg-sheet p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2.5">
          <Logo className="h-8 w-8" />
          <div className="leading-tight">
            <p className="lettering text-base font-semibold">CampusNexo</p>
            <p className="text-xs text-ink-soft">Universidad Cooperativa de Colombia · Campus Pasto</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Sign-in with the account the administration created for you. */
export function LoginScreen({ reason, submit }: {
  reason: string;
  submit: (username: string, password: string) => Promise<void>;
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
        Lo que puedes hacer depende de tu rol: consultar, operar salones y reservas, o administrar. La administración solo responde desde la VPN de la universidad.
      </p>
    </Shell>
  );
}

/** The server did not answer: say so plainly instead of showing invented data. */
export function UnavailableScreen({ reason, retry }: { reason: string; retry: () => void }) {
  return (
    <Shell>
      <div className="flex items-center gap-2 text-st-sobrecupo-ink"><ServerOff className="h-5 w-5" /><h1 className="text-xl font-semibold">Sin conexión con el servidor</h1></div>
      <p className="mt-2 text-sm text-ink-soft">{reason}. El tablero no muestra datos inventados en su lugar. Si el servidor estaba en reposo, tarda cerca de un minuto en despertar.</p>
      <button type="button" onClick={retry}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-night px-4 py-2.5 text-sm font-medium text-night-text">
        <RefreshCw className="h-4 w-4" />Reintentar
      </button>
    </Shell>
  );
}
