import { Download, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Area, ComposedChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useRequest, useTwin } from '../../application/TwinContext';
import type { Forecast } from '../../domain/model';

const hour = new Intl.DateTimeFormat('es-CO', { weekday: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' });

/**
 * Occupancy forecast of the next hours, computed by the AI service from the room's history in MongoDB
 * (weekly profile with exponential smoothing), and the history itself as CSV.
 */
export function PronosticoPanel({ spaceId }: { spaceId: string }) {
  const { operaciones } = useTwin();
  const { pending, run } = useRequest();
  const [forecast, setForecast] = useState<Forecast | null | undefined>(undefined);

  useEffect(() => setForecast(undefined), [spaceId]);

  const load = async () => {
    const result = await run(() => operaciones.pronostico(spaceId, 12));
    if (result !== undefined) setForecast(result);
  };

  const download = async () => {
    const blob = await run(() => operaciones.historialCsv(spaceId));
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = Object.assign(document.createElement('a'), { href: url, download: `historial-${spaceId}.csv` });
    link.click();
    URL.revokeObjectURL(url);
  };

  const data = (forecast?.points ?? []).map((p) => ({ t: Date.parse(p.at), people: p.people, band: [p.low, p.high] }));

  return (
    <section aria-labelledby="forecast-title" className="rounded-2xl border border-rule bg-sheet p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="forecast-title" className="flex items-center gap-1.5 text-base font-semibold"><TrendingUp className="h-4 w-4 text-ink-soft" />Pronóstico de ocupación</h2>
        <div className="flex gap-2">
          <button type="button" disabled={pending} onClick={() => void load()} className="rounded-lg bg-night px-3 py-1.5 text-sm font-medium text-night-text disabled:opacity-60">
            {pending ? 'Calculando…' : forecast === undefined ? 'Calcular 12 h' : 'Actualizar'}
          </button>
          <button type="button" disabled={pending} onClick={() => void download()} title="Historial del salón en CSV"
            className="flex items-center gap-1 rounded-lg border border-rule px-2.5 py-1.5 text-sm hover:bg-white disabled:opacity-60">
            <Download className="h-4 w-4" />CSV
          </button>
        </div>
      </div>
      {forecast === null && <p className="mt-2 text-sm text-ink-soft">Este salón todavía no tiene historial suficiente; el pronóstico aparece cuando el gemelo acumule lecturas.</p>}
      {forecast && (
        <>
          <div className="mt-3 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-rule)" strokeDasharray="3 4" vertical={false} />
                <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} tickFormatter={(t: number) => hour.format(t)} tick={{ fontSize: 11, fill: 'var(--color-ink-soft)' }} minTickGap={48} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'var(--color-ink-soft)' }} />
                <Tooltip labelFormatter={(t) => hour.format(Number(t))} formatter={(v) => (Array.isArray(v) ? `${Math.round(v[0])}–${Math.round(v[1])}` : Math.round(Number(v)))} contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: 'var(--color-rule)' }} />
                <Area dataKey="band" name="Intervalo 80 %" stroke="none" fill="var(--color-signal)" fillOpacity={0.18} isAnimationActive={false} />
                <Line dataKey="people" name="Personas" stroke="var(--color-st-optimo-ink)" strokeWidth={2} dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-xs text-ink-soft">{forecast.method} · {forecast.samplesUsed} muestras{forecast.note ? ` · ${forecast.note}` : ''}</p>
        </>
      )}
    </section>
  );
}
