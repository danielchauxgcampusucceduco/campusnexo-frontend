import {
  ArrowRight, BellRing, CalendarClock, Cctv, Eye, EyeOff, Laptop, Loader2, LogIn, Map, MonitorSmartphone, Network, RefreshCw,
  ScanEye, ServerOff, ShieldCheck,
} from 'lucide-react';
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

const FEATURES = [
  { icon: Map, title: 'Campus en vivo', text: 'Los planos reales, piso por piso, pintados por lo que ve la cámara de cada espacio.' },
  { icon: CalendarClock, title: 'Disponibilidad', text: 'Salones, salas y laboratorios libres hora por hora, de 7:00 a 22:00.' },
  { icon: BellRing, title: 'Alertas', text: 'Sobrecupo, clases programadas a las que nadie llegó y cámaras sin señal.' },
  { icon: ScanEye, title: 'Simulación', text: 'Una semana del horario real de Ingeniería de Software para mostrar el sistema.' },
] as const;

const FLOW = [
  { icon: Cctv, label: 'Cámara PoE' },
  { icon: Laptop, label: 'Portátil de borde (YOLO)' },
  { icon: Network, label: 'Gemelo digital' },
  { icon: MonitorSmartphone, label: 'Tablero' },
] as const;

/** What CampusNexo is for and what can be done in it, over the real floor plan of the campus. */
function Presentation() {
  return (
    <section aria-labelledby="landing-title" className="relative isolate overflow-hidden bg-night px-6 py-8 text-night-text sm:px-10 lg:flex lg:flex-col lg:justify-center lg:px-14 lg:py-12">
      {/* The third floor of the campus as drawn in the 2025-B plan: student spaces in cyan, offices in outline. */}
      <img src="/plano-piso3.svg" alt="" aria-hidden
        className="pointer-events-none absolute -right-40 top-1/2 -z-10 w-[760px] max-w-none -translate-y-1/2 opacity-90 lg:-right-[24%] lg:w-[74%]" />
      {/* Dark under the text, the plan clear on the right. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(19,39,64,0.97)_0%,rgba(19,39,64,0.95)_52%,rgba(19,39,64,0.35)_82%,rgba(19,39,64,0.15)_100%)]" />

      <div className="floor-enter max-w-xl">
        <div className="flex items-center gap-3">
          <Logo className="h-10 w-10" />
          <div className="leading-tight">
            <p className="lettering text-lg font-semibold text-white">CampusNexo</p>
            <p className="text-xs text-night-text/80">Universidad Cooperativa de Colombia · Campus Pasto</p>
          </div>
        </div>

        <h2 id="landing-title" className="lettering mt-8 text-3xl font-semibold leading-tight text-white sm:text-4xl">
          ¿Qué espacios del campus están <span className="text-signal">libres</span> ahora?
        </h2>
        <p className="mt-4 text-base leading-relaxed text-night-text">
          CampusNexo es el gemelo digital del campus Pasto. Una cámara en cada espacio de estudio cuenta a las personas y el
          sistema muestra en vivo qué salones, salas y laboratorios están libres, hasta qué hora, y avisa a la administración
          cuando una clase programada queda sin uso.
        </p>

        <ul className="stagger mt-7 grid gap-3 sm:grid-cols-2">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="lift rounded-xl border border-night-line bg-white/[0.04] p-3.5 backdrop-blur-[2px] hover:border-signal/60 hover:bg-white/[0.07]">
              <p className="flex items-center gap-2 text-sm font-semibold text-white"><Icon className="h-4 w-4 text-signal" />{title}</p>
              <p className="mt-1 text-sm text-night-text/85">{text}</p>
            </li>
          ))}
        </ul>

        <ol aria-label="Cómo viajan los datos" className="stagger mt-7 hidden flex-wrap items-center gap-x-2 gap-y-2 text-xs sm:flex">
          {FLOW.map(({ icon: Icon, label }, i) => (
            <li key={label} className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full border border-night-line bg-night px-2.5 py-1 text-night-text">
                <Icon className="h-3.5 w-3.5 text-ucc-lima" />{label}
              </span>
              {i < FLOW.length - 1 && <ArrowRight aria-hidden className="h-3.5 w-3.5 text-night-text/60" />}
            </li>
          ))}
        </ol>

        <p className="mt-6 flex items-start gap-2 text-xs text-night-text/80">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ucc-verde" />
          Ninguna imagen sale del salón: la cámara solo envía posiciones y conteos (Ley 1581 de 2012).
        </p>
      </div>
    </section>
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
  const [showPassword, setShowPassword] = useState(false);
  const [missing, setMissing] = useState<{ username: boolean; password: boolean }>({ username: false, password: false });

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    // Own messages instead of the browser's bubbles, next to each field.
    const empty = { username: !username.trim(), password: !password };
    setMissing(empty);
    if (empty.username || empty.password) return;
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
    <div className="grid min-h-screen bg-paper lg:grid-cols-[minmax(0,1.25fr)_minmax(420px,1fr)]">
      <Presentation />
      <div className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="floor-enter w-full max-w-sm">
          <h1 className="lettering text-2xl font-semibold">Iniciar sesión</h1>
          <p className="mt-1 text-sm text-ink-soft">{reason}</p>
          <form noValidate className="mt-5 flex flex-col gap-3" onSubmit={(event) => void onSubmit(event)}>
            <label className="flex flex-col gap-1 text-sm">
              Usuario
              <input autoComplete="username" required value={username} aria-invalid={missing.username || undefined}
                aria-describedby={missing.username ? 'login-user-error' : undefined}
                onChange={(e) => { setUsername(e.target.value); setMissing((m) => ({ ...m, username: false })); }}
                className={`rounded-lg border bg-field px-3 py-2 text-base ${missing.username ? 'border-st-sobrecupo' : 'border-rule'}`} />
              {missing.username && <span id="login-user-error" className="text-xs text-st-sobrecupo-ink">Escribe tu usuario.</span>}
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Contraseña
              <span className="relative flex">
                <input type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password}
                  aria-invalid={missing.password || undefined} aria-describedby={missing.password ? 'login-password-error' : undefined}
                  onChange={(e) => { setPassword(e.target.value); setMissing((m) => ({ ...m, password: false })); }}
                  className={`w-full rounded-lg border bg-field py-2 pl-3 pr-11 text-base ${missing.password ? 'border-st-sobrecupo' : 'border-rule'}`} />
                <button type="button" onClick={() => setShowPassword((v) => !v)} aria-pressed={showPassword}
                  aria-label={showPassword ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
                  className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-lg text-ink-soft hover:text-ink">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </span>
              {missing.password && <span id="login-password-error" className="text-xs text-st-sobrecupo-ink">Escribe tu contraseña.</span>}
            </label>
            {error && <p role="alert" className="rounded-lg bg-alert-bg px-3 py-2 text-sm text-st-sobrecupo-ink">{error}</p>}
            <button type="submit" disabled={busy}
              className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-night px-4 py-2.5 text-sm font-medium text-night-text disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}{busy ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
          <p className="mt-4 flex items-start gap-2 text-xs text-ink-soft">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            Lo que puedes hacer depende de tu rol: consultar, operar salones y reservas, o administrar.
          </p>
        </div>
      </div>
    </div>
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
