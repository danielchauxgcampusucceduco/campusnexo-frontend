import { DoorOpen, LogOut, Timer, UserRound } from 'lucide-react';
import { useTwin } from '../../application/TwinContext';
import { formatNumber } from '../../domain/kpis';
import { Logo } from './Logo';

const connectionCopy = {
  connecting: 'Conectando',
  live: 'En vivo',
  degraded: 'Sin actualización en vivo',
  offline: 'Sin conexión',
  unauthorized: 'Sesión vencida',
} as const;

const ROLE_COPY = { VIEWER: 'Consulta', OPERATOR: 'Personal', ADMIN: 'Administrador', SENSOR: 'Sensor' } as const;

/** QA-2: from the camera frame to this screen, p95 ≤ 2 s. */
const LATENCY_TARGET_MS = 2_000;

export function TopBar() {
  const { gateway, snapshot, signOut } = useTwin();
  const clock = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Bogota' }).format(snapshot.now);
  // Student spaces whose camera reports and sees nobody: free right now.
  const watched = snapshot.twins.filter((t) => t.space.accesibleParaEstudiantes && t.state.sensorsReporting);
  const free = watched.filter((t) => t.state.occupancy === 0 && !t.state.maintenance).length;
  const latency = snapshot.latency;
  const metrics = (
    <>
      {/* An engineering metric (QA-2): only the administration sees it. */}
      {latency && gateway.user.role === 'ADMIN' && (
        <span className="flex items-center gap-1.5" title={`Del frame de la cámara a esta pantalla, últimos ${latency.samples} eventos. Meta: p95 ≤ ${LATENCY_TARGET_MS / 1000} s`}>
          <Timer className="h-4 w-4 text-signal" />
          <span>Latencia p95</span>
          <span className={`font-semibold tabular-nums ${latency.p95Ms <= LATENCY_TARGET_MS ? 'text-white' : 'text-[#ffb4a6]'}`}>{formatNumber(latency.p95Ms / 1000, 2)} s</span>
        </span>
      )}
      <a href="#/disponibilidad" className="flex items-center gap-1.5 hover:text-white" title="Espacios de estudiantes con cámara en los que no hay nadie ahora">
        <DoorOpen className="h-4 w-4 text-ucc-lima" />
        <span className="text-night-text/75">Libres</span>
        <span className="font-semibold tabular-nums text-white">{free}</span>
        <span className="text-night-text/75">de {watched.length} con cámara</span>
      </a>
    </>
  );

  return (
    <header className="sticky top-0 z-40 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-night-line bg-night min-h-14 px-4 py-2 text-night-text md:px-6">
      <div className="flex items-center gap-2.5">
        <Logo className="h-7 w-7" />
        <div className="leading-tight">
          <p className="lettering text-[15px] font-semibold text-white">CampusNexo</p>
          <p className="hidden text-xs text-night-text/75 2xl:block">Universidad Cooperativa de Colombia · Campus Pasto</p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm" title={connectionCopy[snapshot.connection]}>
        <span className={`h-2 w-2 rounded-full ${snapshot.connection === 'live' ? 'bg-st-libre' : 'bg-st-subutilizado'}`} />
        <span className="sr-only 2xl:not-sr-only">{connectionCopy[snapshot.connection]}</span>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        <div className="hidden flex-wrap items-center gap-x-5 gap-y-1 md:flex">{metrics}</div>
        {/* On a phone the metrics fold into one control so the header stays one line (U2). */}
        <details className="relative md:hidden">
          <summary className="cursor-pointer list-none rounded-md border border-night-line px-2 py-1 text-xs">Métricas</summary>
          <div className="absolute right-0 top-full z-50 mt-1 flex w-64 flex-col gap-2 rounded-lg border border-night-line bg-night p-3 shadow-lg">{metrics}</div>
        </details>
        <span className="hidden font-semibold tabular-nums text-white sm:inline">{clock}</span>
        <span className="flex items-center gap-2 text-night-text/80">
          <UserRound className="h-4 w-4" />
          <span><b className="font-semibold text-white">{gateway.user.username}</b> · {ROLE_COPY[gateway.user.role]}</span>
          {gateway.user.signedIn && (
            <button type="button" onClick={signOut} title="Cerrar sesión" aria-label="Cerrar sesión"
              className="rounded-md p-1 hover:bg-white/10 hover:text-white"><LogOut className="h-4 w-4" /></button>
          )}
        </span>
      </div>
    </header>
  );
}
