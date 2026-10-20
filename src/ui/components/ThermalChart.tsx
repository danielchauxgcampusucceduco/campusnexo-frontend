import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ClimateProfile, ThermalDecision } from '../../domain/model';
import { comfortBand } from '../../domain/thermal';

/** Free-running trajectory predicted by the MPC over its horizon, against the branch comfort band. */
export function ThermalChart({ decision, profile, outdoorC }: { decision: ThermalDecision; profile: ClimateProfile; outdoorC: number }) {
  const band = comfortBand(profile);
  const data = decision.freeRunningTrajectoryC.map((temperature, step) => ({ minute: step * decision.stepMinutes, temperature, outdoor: outdoorC }));
  const values = [...decision.freeRunningTrajectoryC, band.lowC, band.highC, outdoorC];
  const min = Math.floor(Math.min(...values) - 1);
  const max = Math.ceil(Math.max(...values) + 1);
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 6, right: 10, left: -16, bottom: 0 }}>
          <CartesianGrid stroke="var(--color-rule)" strokeDasharray="3 4" vertical={false} />
          <ReferenceArea y1={band.lowC} y2={band.highC} fill="var(--color-st-libre)" fillOpacity={0.12} stroke="var(--color-st-libre)" strokeOpacity={0.4} strokeDasharray="4 4" />
          <XAxis dataKey="minute" tickFormatter={(m: number) => `${m} min`} tick={{ fontSize: 10, fill: 'var(--color-ink-soft)' }} />
          <YAxis domain={[min, max]} tickFormatter={(t: number) => `${t}°`} tick={{ fontSize: 10, fill: 'var(--color-ink-soft)' }} />
          <Tooltip formatter={(value, name) => [`${Number(value).toFixed(2)} °C`, name]} labelFormatter={(m) => `Minuto ${m}`} contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: 'var(--color-rule)' }} />
          <Line dataKey="outdoor" name="Exterior" stroke="var(--color-ink-soft)" strokeDasharray="2 4" dot={false} isAnimationActive={false} />
          <Area dataKey="temperature" name="Interior sin climatizar" stroke="var(--color-st-optimo)" strokeWidth={2.2} fill="var(--color-st-optimo)" fillOpacity={0.08} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
