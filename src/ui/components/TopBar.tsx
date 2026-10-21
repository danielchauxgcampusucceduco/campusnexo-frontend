import { Gauge, LogOut, Radio, Server, UserRound, Zap } from 'lucide-react';
import { useTwin } from '../../application/TwinContext';
import { fleetPower, formatCop, formatNumber } from '../../domain/kpis';

const SPEEDS = [1, 10, 60, 120];

const connectionCopy = {
  connecting: 'Conectando',
  live: 'En vivo',
  degraded: 'Sin actualización en vivo',
  offline: 'Sin conexión',
  unauthorized: 'Sesión vencida',
} as const;

const ROLE_COPY = { VIEWER: 'Consulta', OPERATOR: 'Personal', ADMIN: 'Administrador', SENSOR: 'Sensor' } as const;

export function TopBar() {
  const { gateway, snapshot, switchMode, switching, signOut } = useTwin();
  const clock = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Bogota' }).format(snapshot.now);
  const power = fleetPower(snapshot.twins, snapshot.now);
  const backend = gateway.mode === 'backend';

  return (
    <header className="sticky top-0 z-40 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-rule bg-paper/95 min-h-14 px-4 py-2 backdrop-blur md:px-6">
      <div className="flex items-center gap-2.5">
        <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
          <rect width="32" height="32" rx="7" fill="var(--color-night)" />
          <path d="M8 21 16 9l8 12" fill="none" stroke="var(--color-signal)" strokeWidth="3" strokeLinejoin="round" />
          <circle cx="16" cy="21" r="2.6" fill="var(--color-paper)" />
        </svg>
        <div className="leading-tight">
          <p className="lettering text-[15px] font-semibold">CampusNexo</p>
          <p className="hidden text-xs text-ink-soft 2xl:block">UCC Campus Pasto · en vivo</p>
        </div>
      </div>

      <div role="group" aria-label="Fuente de datos" className="flex rounded-lg border border-rule bg-sheet p-0.5 text-sm">
        <button
          type="button"
          disabled={switching}
          onClick={() => void switchMode('backend')}
          aria-pressed={backend}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-colors ${backend ? 'bg-night text-night-text' : 'text-ink-soft hover:text-ink'}`}
        >
          <Server className="h-3.5 w-3.5" /> Servidor real
        </button>
        <button
          type="button"
          disabled={switching}
          onClick={() => void switchMode('simulation')}
          aria-pressed={!backend}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-colors ${!backend ? 'bg-night text-night-text' : 'text-ink-soft hover:text-ink'}`}
        >
          <Radio className="h-3.5 w-3.5" /> Simulación
        </button>
      </div>

      <div className="flex items-center gap-2 text-sm text-ink-soft" title={backend ? connectionCopy[snapshot.connection] : 'Simulación en este navegador'}>
        <span className={`h-2 w-2 rounded-full ${snapshot.connection === 'live' ? 'bg-st-libre' : 'bg-st-subutilizado'}`} />
        <span className="sr-only 2xl:not-sr-only">{backend ? connectionCopy[snapshot.connection] : 'Simulación en este navegador'}</span>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        <span className="flex items-center gap-1.5" title={`Consumo del clima ahora frente a ${formatNumber(power.baselineKw)} kW del horario convencional`}>
          <Zap className="h-4 w-4 text-hv-ahorro-ink" />
          <span className="font-semibold">{formatNumber(power.actualKw)} kW</span>
          <span className="hidden text-ink-soft 2xl:inline">de {formatNumber(power.baselineKw)} kW sin CampusNexo</span>
        </span>
        {snapshot.savings && (
          <span className="text-ink-soft" title="Ahorro estimado acumulado">
            Ahorro <span className="font-semibold text-ink">{formatNumber(snapshot.savings.totalKwh, 2)} kWh</span>, {formatCop(snapshot.savings.totalCop)}
          </span>
        )}
        <span className="flex items-center gap-1.5 tabular-nums">
          <span className="text-ink-soft">{backend ? 'Hora' : 'Hora simulada'}</span>
          <span className="font-semibold">{clock}</span>
        </span>
        {gateway.capabilities.timeScale && (
          <label className="flex items-center gap-1.5 text-ink-soft" title="Velocidad de la simulación">
            <Gauge className="h-3.5 w-3.5" />
            <span className="sr-only">Velocidad de la simulación</span>
            <select
              className="rounded-md border border-rule bg-sheet px-1.5 py-1 text-ink"
              value={gateway.timeScale()}
              onChange={(event) => gateway.setTimeScale(Number(event.target.value))}
            >
              {SPEEDS.map((speed) => (
                <option key={speed} value={speed}>{speed === 1 ? 'Tiempo real' : `${speed}×`}</option>
              ))}
            </select>
          </label>
        )}
        {gateway.user && (
          <span className="flex items-center gap-2 text-ink-soft">
            <UserRound className="h-4 w-4" />
            <span><b className="font-semibold text-ink">{gateway.user.username}</b> · {ROLE_COPY[gateway.user.role]}</span>
            {gateway.user.signedIn && (
              <button type="button" onClick={signOut} title="Cerrar sesión" aria-label="Cerrar sesión"
                className="rounded-md p-1 hover:bg-sheet hover:text-ink"><LogOut className="h-4 w-4" /></button>
            )}
          </span>
        )}
      </div>
    </header>
  );
}
