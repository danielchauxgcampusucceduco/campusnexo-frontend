import { Gauge, Radio, Server, Zap } from 'lucide-react';
import { useTwin } from '../../application/TwinContext';
import { fleetPower, formatCop, formatNumber } from '../../domain/kpis';

const SPEEDS = [1, 10, 60, 120];

const connectionCopy = {
  connecting: 'Conectando',
  live: 'En vivo',
  degraded: 'Sin WebSocket, solo REST',
  offline: 'Sin conexión',
} as const;

export function TopBar() {
  const { gateway, snapshot, switchMode, switching } = useTwin();
  const clock = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Bogota' }).format(snapshot.now);
  const power = fleetPower(snapshot.twins, snapshot.now);
  const backend = gateway.mode === 'backend';

  return (
    <header className="sticky top-0 z-40 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-rule bg-paper/95 px-4 py-2.5 backdrop-blur md:px-6">
      <div className="flex items-center gap-2.5">
        <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
          <rect width="32" height="32" rx="7" fill="var(--color-night)" />
          <path d="M8 21 16 9l8 12" fill="none" stroke="var(--color-signal)" strokeWidth="3" strokeLinejoin="round" />
          <circle cx="16" cy="21" r="2.6" fill="var(--color-paper)" />
        </svg>
        <div className="leading-tight">
          <p className="lettering text-[15px] font-semibold">CampusNexo</p>
          <p className="text-[11px] text-ink-soft">Gemelo digital del campus</p>
        </div>
      </div>

      <div role="group" aria-label="Fuente de datos" className="flex rounded-lg border border-rule bg-sheet p-0.5 text-xs">
        <button
          type="button"
          disabled={switching}
          onClick={() => void switchMode('backend')}
          aria-pressed={backend}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-colors ${backend ? 'bg-night text-night-text' : 'text-ink-soft hover:text-ink'}`}
        >
          <Server className="h-3.5 w-3.5" /> Backend Java
        </button>
        <button
          type="button"
          disabled={switching}
          onClick={() => void switchMode('simulation')}
          aria-pressed={!backend}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-colors ${!backend ? 'bg-night text-night-text' : 'text-ink-soft hover:text-ink'}`}
        >
          <Radio className="h-3.5 w-3.5" /> Simulación local
        </button>
      </div>

      <div className="flex items-center gap-2 text-xs text-ink-soft">
        <span className={`h-2 w-2 rounded-full ${snapshot.connection === 'live' ? 'bg-st-libre' : 'bg-st-subutilizado'}`} />
        {backend ? connectionCopy[snapshot.connection] : 'Motor físico en el navegador'}
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
        <span className="flex items-center gap-1.5" title="Potencia HVAC actual frente a la línea base convencional">
          <Zap className="h-3.5 w-3.5 text-hv-ahorro" />
          <span className="font-semibold">{formatNumber(power.actualKw)} kW</span>
          <span className="text-ink-soft">de {formatNumber(power.baselineKw)} kW base</span>
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
          <label className="flex items-center gap-1.5 text-ink-soft">
            <Gauge className="h-3.5 w-3.5" />
            <span className="sr-only">Velocidad de la simulación</span>
            <select
              className="rounded-md border border-rule bg-sheet px-1.5 py-1 text-ink"
              value={gateway.timeScale()}
              onChange={(event) => gateway.setTimeScale(Number(event.target.value))}
            >
              {SPEEDS.map((speed) => (
                <option key={speed} value={speed}>{speed === 1 ? 'Tiempo real' : `${speed}× más rápido`}</option>
              ))}
            </select>
          </label>
        )}
      </div>
    </header>
  );
}
