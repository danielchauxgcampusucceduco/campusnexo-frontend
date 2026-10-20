import { useEffect, useRef, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { KALMAN_PARAMETERS } from '../../domain/kalman';
import type { SpaceTwinState } from '../../domain/model';
import { MEASUREMENT_META } from '../theme';

interface Point {
  t: number;
  estimate: number;
  camera: number | null;
  upper: number;
  lower: number;
}

const fmt = (value: number, digits = 2) => value.toLocaleString('es-CO', { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** OccupancyKalmanDomainService, written out with the numbers of the latest frame. */
export function KalmanPanel({ state }: { state: SpaceTwinState }) {
  const kalman = state.kalman;
  const [history, setHistory] = useState<Point[]>([]);
  const lastUpdate = useRef<string>('');

  useEffect(() => {
    lastUpdate.current = '';
    setHistory([]);
  }, [state.spaceId]);

  useEffect(() => {
    if (!kalman || state.updatedAt === lastUpdate.current) return;
    lastUpdate.current = state.updatedAt;
    const camera = kalman.measurements.find((m) => m.source === 'CAMARA_YOLO')?.value ?? null;
    const sd = Math.sqrt(kalman.posteriorVariance);
    setHistory((current) => [...current.slice(-59), {
      t: Date.parse(state.updatedAt),
      estimate: Math.round(kalman.posteriorEstimate * 10) / 10,
      camera,
      upper: Math.round((kalman.posteriorEstimate + 2 * sd) * 10) / 10,
      lower: Math.max(0, Math.round((kalman.posteriorEstimate - 2 * sd) * 10) / 10),
    }]);
  }, [kalman, state.updatedAt]);

  if (!kalman) {
    return <p className="text-sm text-ink-soft">Esperando el primer frame de este espacio.</p>;
  }
  const time = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Bogota' });

  return (
    <div className="flex flex-col gap-5">
      <div className="space-y-2 rounded-xl border border-rule bg-sheet p-4 text-[13px] leading-relaxed">
        <p className="text-sm text-ink-soft">Predicción (paseo aleatorio)</p>
        <p className="tabular-nums">
          x̂⁻ = x̂ = <b>{fmt(kalman.priorEstimate, 1)}</b> personas
        </p>
        <p className="tabular-nums">
          P⁻ = P + Q·Δt = {fmt(kalman.priorVariance)} + {KALMAN_PARAMETERS.processNoisePerMinute}·{fmt(kalman.elapsedMinutes)} = <b>{fmt(kalman.predictedVariance)}</b>
        </p>
        <p className="pt-2 text-sm text-ink-soft">Corrección secuencial: K = P⁻ / (P⁻ + R), x̂ = x̂⁻ + K(z − x̂⁻), P = (1 − K)P⁻</p>
        <ul className="space-y-2">
          {kalman.measurements.map((m) => (
            <li key={m.source} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
              <span>
                <span className="font-medium">{MEASUREMENT_META[m.source].label}</span>
                <span className="ml-2 tabular-nums text-ink-soft">z = {fmt(m.value, 1)}, R = {fmt(m.variance)}</span>
              </span>
              <span className="tabular-nums font-semibold">K = {fmt(m.gain, 3)}</span>
              <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-rule/60">
                <span className="block h-full rounded-full bg-st-optimo transition-[width] duration-500" style={{ width: `${Math.min(100, m.gain * 100)}%` }} />
              </span>
            </li>
          ))}
        </ul>
        {!state.cameraOnline && (
          <p className="rounded-md bg-st-sobrecupo/10 px-2 py-1.5 text-sm text-st-sobrecupo-ink">
            Cámara caída: el filtro solo fusiona CO₂ y Wi-Fi, por eso P crece.
          </p>
        )}
        <p className="border-t border-rule pt-2 tabular-nums">
          Estimación: x̂ = <b className="text-base">{fmt(kalman.posteriorEstimate, 1)}</b> ± {fmt(2 * Math.sqrt(kalman.posteriorVariance), 1)} personas (95 %), P = {fmt(kalman.posteriorVariance, 3)}
        </p>
      </div>

      <div>
        <p className="mb-2 text-sm text-ink-soft">Estimación fusionada frente al conteo de la cámara</p>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-rule)" strokeDasharray="3 4" vertical={false} />
              <XAxis dataKey="t" tickFormatter={(t: number) => time.format(t)} tick={{ fontSize: 12, fill: 'var(--color-ink-soft)' }} minTickGap={40} />
              <YAxis tick={{ fontSize: 12, fill: 'var(--color-ink-soft)' }} allowDecimals={false} />
              <Tooltip labelFormatter={(t) => time.format(Number(t))} contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: 'var(--color-rule)' }} />
              <Line type="monotone" dataKey="upper" name="Límite superior (2σ)" stroke="var(--color-rule)" dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="lower" name="Límite inferior (2σ)" stroke="var(--color-rule)" dot={false} isAnimationActive={false} />
              <Line type="stepAfter" dataKey="camera" name="Cámara" stroke="var(--color-st-subutilizado)" strokeDasharray="4 3" dot={false} isAnimationActive={false} connectNulls={false} />
              <Line type="monotone" dataKey="estimate" name="Kalman" stroke="var(--color-st-optimo)" strokeWidth={2.2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
