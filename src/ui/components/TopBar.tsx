import { LogOut, Timer, UserRound, Zap } from 'lucide-react';
import { useTwin } from '../../application/TwinContext';
import { fleetPower, formatCop, formatNumber } from '../../domain/kpis';
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
  const power = fleetPower(snapshot.twins, snapshot.now);
  const latency = snapshot.latency;

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
        {latency && (
          <span className="flex items-center gap-1.5" title={`Del frame de la cámara a esta pantalla, últimos ${latency.samples} eventos. Meta: p95 ≤ ${LATENCY_TARGET_MS / 1000} s`}>
            <Timer className="h-4 w-4 text-signal" />
            <span>Latencia p95</span>
            <span className={`font-semibold tabular-nums ${latency.p95Ms <= LATENCY_TARGET_MS ? 'text-white' : 'text-[#ffb4a6]'}`}>{formatNumber(latency.p95Ms / 1000, 2)} s</span>
          </span>
        )}
        <span className="flex items-center gap-1.5" title={`Consumo del clima ahora frente a ${formatNumber(power.baselineKw)} kW del horario convencional`}>
          <Zap className="h-4 w-4 text-ucc-lima" />
          <span className="font-semibold text-white">{formatNumber(power.actualKw)} kW</span>
          <span className="hidden text-night-text/75 2xl:inline">de {formatNumber(power.baselineKw)} kW sin CampusNexo</span>
        </span>
        {snapshot.savings && (
          <span className="text-night-text/75" title="Ahorro estimado acumulado">
            Ahorro <span className="font-semibold text-white">{formatNumber(snapshot.savings.totalKwh, 2)} kWh</span>, {formatCop(snapshot.savings.totalCop)}
          </span>
        )}
        <span className="font-semibold tabular-nums text-white">{clock}</span>
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
