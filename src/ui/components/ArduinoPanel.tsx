import { Cpu, Droplets, Lightbulb, LightbulbOff, Monitor, Thermometer, Wind } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTwin } from '../../application/TwinContext';
import { formatNumber } from '../../domain/kpis';
import type { TwinSpace } from '../../domain/model';

/**
 * What the room's Arduino reports: temperature and humidity (DHT22), light level (light sensor), the
 * lighting relay and the computers drawing power (current sensor), plus the CO₂ sensor when there is one.
 */
export function ArduinoPanel({ twin, compact = false }: { twin: TwinSpace; compact?: boolean }) {
  const { gateway } = useTwin();
  const { state, space } = twin;
  const comfort = state.indoorTemperatureC < 18 ? 'Frío' : state.indoorTemperatureC > 24 ? 'Caliente' : 'Cómodo';
  const co2High = state.co2Ppm > 1000;
  return (
    <section aria-label="Sensores del Arduino" className="rounded-2xl border border-rule bg-sheet p-4">
      <header className="mb-3 flex items-center gap-2">
        <Cpu className="h-4 w-4 text-ink-soft" />
        <h3 className="text-sm font-semibold">Arduino del salón</h3>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-ink-soft"><span className="live-dot h-2 w-2 rounded-full bg-st-libre" />envía cada 10 s</span>
      </header>
      <div className={`grid gap-2 ${compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
        <Tile icon={<Thermometer className="h-5 w-5" />} label="Temperatura" sensor="DHT22"
          value={`${formatNumber(state.indoorTemperatureC)} °C`} note={`${comfort} · afuera ${formatNumber(state.outdoorTemperatureC)} °C`}
          meter={Math.min(1, Math.max(0, (state.indoorTemperatureC - 12) / 16))} tone={comfort === 'Cómodo' ? 'var(--color-st-libre)' : 'var(--color-hv-calor)'} />
        <Tile icon={<Droplets className="h-5 w-5" />} label="Humedad" sensor="DHT22" value={`${Math.round(state.humidityPct)} %`} meter={state.humidityPct / 100} tone="var(--color-hv-aire)" />
        <Tile icon={state.lightsOn ? <Lightbulb className="h-5 w-5 text-[#b8860b]" /> : <LightbulbOff className="h-5 w-5" />} label="Luces" sensor="Relé + fotorresistencia"
          value={state.lightsOn ? 'Encendidas' : 'Apagadas'} note={`${Math.round(state.illuminanceLux)} lux`} highlight={state.lightsOn}
          action={gateway.capabilities.lightControl ? { label: state.lightsOn ? 'Apagar' : 'Encender', run: () => gateway.setLights(space.spaceId, !state.lightsOn) } : undefined} />
        <Tile icon={<Monitor className="h-5 w-5" />} label="Equipos" sensor="Sensor de corriente"
          value={space.computers > 0 ? `${state.devicesOn} de ${space.computers}` : 'Sin equipos'} note={space.computers > 0 ? 'encendidos' : undefined}
          meter={space.computers > 0 ? state.devicesOn / space.computers : 0} tone="var(--color-rc-equipos)" />
        <Tile icon={<Wind className="h-5 w-5" />} label="CO₂" sensor="Sensor de aire" value={`${Math.round(state.co2Ppm)} ppm`}
          note={co2High ? 'Hay que ventilar' : 'Aire bien'} meter={Math.min(1, state.co2Ppm / 1600)} tone={co2High ? 'var(--color-st-sobrecupo)' : 'var(--color-st-libre)'} />
      </div>
    </section>
  );
}

function Tile({ icon, label, sensor, value, note, meter, tone, highlight, action }: {
  icon: ReactNode; label: string; sensor: string; value: string; note?: string | undefined; meter?: number; tone?: string; highlight?: boolean;
  action?: { label: string; run: () => void } | undefined;
}) {
  return (
    <div className={`flex flex-col overflow-hidden rounded-xl border p-3 transition-colors duration-500 ${highlight ? 'border-[#e8c46a] bg-[#fff7e0]' : 'border-rule bg-paper'}`}>
      <div className="flex items-center gap-2 text-ink-soft">{icon}<span className="text-xs">{label}</span></div>
      <p className="mt-1 text-lg font-semibold leading-tight">{value}</p>
      {note && <p className="text-xs text-ink-soft">{note}</p>}
      {meter !== undefined && (
        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-rule/60">
          <span className="block h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.round(meter * 100)}%`, background: tone }} />
        </span>
      )}
      <p className="mt-1 text-xs text-ink-soft">{sensor}</p>
      {action && (
        <button type="button" onClick={action.run} className="mt-2 w-full rounded-md border border-rule bg-sheet px-2 py-0.5 text-xs font-medium hover:bg-white">
          {action.label}
        </button>
      )}
    </div>
  );
}
