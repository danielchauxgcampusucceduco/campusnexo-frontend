import { useEffect, useRef, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTwin } from '../../application/TwinContext';
import { ENERGY, fleetPower, formatCop, formatNumber } from '../../domain/kpis';
import { HvacBadge } from '../components/StatusBadge';
import { HVAC_META } from '../theme';

const time = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' });

interface PowerPoint {
  t: number;
  actual: number;
  baseline: number;
}

export function EnergyView() {
  const { snapshot } = useTwin();
  const savings = snapshot.savings;
  const power = fleetPower(snapshot.twins, snapshot.now);
  const [history, setHistory] = useState<PowerPoint[]>([]);
  const last = useRef(0);

  useEffect(() => {
    if (snapshot.now - last.current < 30_000 && history.length > 0) return;
    last.current = snapshot.now;
    setHistory((current) => [...current.slice(-89), { t: snapshot.now, actual: Math.round(power.actualKw * 100) / 100, baseline: Math.round(power.baselineKw * 100) / 100 }]);
  }, [snapshot.now, power.actualKw, power.baselineKw, history.length]);

  const reduction = power.baselineKw > 0 ? 1 - power.actualKw / power.baselineKw : 0;
  const bars = (savings?.spaces ?? []).map((s) => ({ ...s, label: s.name }));

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="energy-title">
        <h1 id="energy-title" className="lettering text-2xl font-semibold">Ahorro energético</h1>
        <p className="mt-1 max-w-[70ch] text-sm text-ink-soft">
          La comparación es contra un horario convencional: aire acondicionado al 100 % de {ENERGY.scheduleStartHour}:00 a {ENERGY.scheduleEndHour}:00, con {ENERGY.ratedKwPerSqm} kW por m². Son estimaciones del modelo, no lecturas de medidor.
        </p>

        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div>
            <p className="text-sm text-ink-soft">Potencia de climatización en este momento</p>
            <p className="lettering mt-1 text-6xl font-semibold tabular-nums">
              {formatNumber(power.actualKw)}<span className="ml-2 text-2xl font-normal text-ink-soft">kW</span>
            </p>
            <p className="mt-1 text-sm">
              frente a {formatNumber(power.baselineKw)} kW del horario convencional
              {power.baselineKw > 0 && <span className="font-semibold text-hv-ahorro">, {Math.round(reduction * 100)} % menos</span>}
            </p>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-rule/60" aria-hidden>
              <div className="h-full rounded-full bg-hv-ahorro transition-[width] duration-700" style={{ width: `${power.baselineKw > 0 ? Math.min(100, (power.actualKw / power.baselineKw) * 100) : 0}%` }} />
            </div>
            <div className="mt-6 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-rule)" strokeDasharray="3 4" vertical={false} />
                  <XAxis dataKey="t" tickFormatter={(t: number) => time.format(t)} tick={{ fontSize: 10, fill: 'var(--color-ink-soft)' }} minTickGap={40} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--color-ink-soft)' }} />
                  <Tooltip labelFormatter={(t) => time.format(Number(t))} formatter={(v, n) => [`${Number(v).toFixed(2)} kW`, n]} contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: 'var(--color-rule)' }} />
                  <Area type="stepAfter" dataKey="baseline" name="Horario convencional" stroke="var(--color-ink-soft)" fill="var(--color-rule)" fillOpacity={0.35} strokeDasharray="4 3" isAnimationActive={false} />
                  <Area type="stepAfter" dataKey="actual" name="CampusNexo" stroke="var(--color-hv-ahorro)" fill="var(--color-hv-ahorro)" fillOpacity={0.25} strokeWidth={2} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <dl className="grid grid-cols-1 content-start gap-6 border-t border-rule pt-6 sm:grid-cols-3 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <div>
              <dt className="text-sm text-ink-soft">Energía ahorrada</dt>
              <dd className="lettering mt-1 text-4xl font-semibold tabular-nums">{formatNumber(savings?.totalKwh ?? 0, 2)}</dd>
              <dd className="text-xs text-ink-soft">kWh acumulados</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-soft">Dinero ahorrado</dt>
              <dd className="lettering mt-1 text-4xl font-semibold tabular-nums">{formatCop(savings?.totalCop ?? 0)}</dd>
              <dd className="text-xs text-ink-soft">con la tarifa de cada sede</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-soft">Emisiones evitadas</dt>
              <dd className="lettering mt-1 text-4xl font-semibold tabular-nums">{formatNumber(savings?.totalKgCo2 ?? 0, 2)}</dd>
              <dd className="text-xs text-ink-soft">kg CO₂, factor {savings?.emissionFactorKgCo2PerKwh ?? ENERGY.emissionFactorKgCo2PerKwh} kg/kWh</dd>
            </div>
          </dl>
        </div>
      </section>

      <section aria-labelledby="by-space" className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div>
          <h2 id="by-space" className="lettering text-lg font-semibold">Ahorro por espacio</h2>
          <div className="mt-3 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bars} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-rule)" strokeDasharray="3 4" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--color-ink-soft)' }} tickFormatter={(v: number) => `${v} kWh`} />
                <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 11, fill: 'var(--color-ink)' }} />
                <Tooltip formatter={(v) => [`${Number(v).toFixed(3)} kWh`, 'Ahorro']} contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: 'var(--color-rule)' }} />
                <Bar dataKey="kwh" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                  {bars.map((bar) => <Cell key={bar.spaceId} fill={bar.kwh < 0 ? 'var(--color-st-sobrecupo)' : HVAC_META[bar.hvacState].color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs text-ink-soft">
              <tr className="border-b border-rule">
                <th className="py-2 pr-3 font-normal">Espacio</th>
                <th className="py-2 pr-3 font-normal">Estrategia HVAC</th>
                <th className="py-2 pr-3 text-right font-normal">Potencia</th>
                <th className="py-2 pr-3 text-right font-normal">kWh</th>
                <th className="py-2 pr-3 text-right font-normal">COP</th>
                <th className="py-2 text-right font-normal">kg CO₂</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {(savings?.spaces ?? []).map((s) => (
                <tr key={s.spaceId} className="border-b border-rule/70">
                  <td className="py-2.5 pr-3"><span className="font-medium">{s.name}</span><span className="block text-[11px] text-ink-soft">{s.branchName}</span></td>
                  <td className="py-2.5 pr-3"><HvacBadge state={s.hvacState} size="sm" /></td>
                  <td className="py-2.5 pr-3 text-right">{formatNumber(s.ratedKw, 2)} kW</td>
                  <td className={`py-2.5 pr-3 text-right ${s.kwh < 0 ? 'text-st-sobrecupo' : ''}`}>{formatNumber(s.kwh, 3)}</td>
                  <td className="py-2.5 pr-3 text-right">{formatCop(s.cop)}</td>
                  <td className="py-2.5 text-right">{formatNumber(s.kgCo2, 3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-ink-soft">Un valor negativo significa que el espacio consumió más que el horario convencional, por ejemplo al climatizar fuera de horario o al pre-enfriar.</p>
        </div>
      </section>
    </div>
  );
}
