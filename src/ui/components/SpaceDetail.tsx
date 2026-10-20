import { CalendarClock, CameraOff, Droplets, Thermometer, Users, Wind } from 'lucide-react';
import { formatNumber } from '../../domain/kpis';
import type { TwinSpace } from '../../domain/model';
import { HVAC_META, STATUS_META } from '../theme';
import { HvacBadge, StatusBadge } from './StatusBadge';
import { ThermalChart } from './ThermalChart';

const time = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' });

function Reading({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-ink-soft">{icon}</span>
      <span className="text-sm text-ink-soft">{label}</span>
      <span className="ml-auto font-semibold tabular-nums" style={tone ? { color: tone } : undefined}>{value}</span>
    </div>
  );
}

export function SpaceDetail({ twin }: { twin: TwinSpace }) {
  const { space, state, activeReservation } = twin;
  const thermal = state.thermal;
  return (
    <div className="grid gap-x-8 gap-y-5 lg:grid-cols-2 2xl:grid-cols-1">
      <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm text-ink-soft">{space.buildingName}, {space.city}</p>
        <h2 className="lettering mt-0.5 text-xl font-semibold">{space.name}</h2>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <StatusBadge status={state.status} />
          <HvacBadge state={state.hvacState} />
          {!state.cameraOnline && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-st-sobrecupo/10 px-2 py-1 text-sm font-medium text-st-sobrecupo-ink">
              <CameraOff className="h-3.5 w-3.5" /> Cámara caída
            </span>
          )}
        </div>
        <p className="mt-2 text-sm text-ink-soft">{STATUS_META[state.status].hint}.</p>
      </div>

      <div className="grid gap-2.5 border-y border-rule py-4 text-sm">
        <Reading icon={<Users className="h-4 w-4" />} label="Ocupación (Kalman)" value={`${state.occupancy} / ${space.capacity}  ± ${formatNumber(2 * state.occupancyStdDev)}`} />
        <Reading icon={<Thermometer className="h-4 w-4" />} label="Interior y exterior" value={`${formatNumber(state.indoorTemperatureC)} °C  /  ${formatNumber(state.outdoorTemperatureC)} °C`} />
        <Reading icon={<Wind className="h-4 w-4" />} label="CO₂" value={`${Math.round(state.co2Ppm)} ppm`} tone={state.co2Ppm > 1000 ? 'var(--color-st-sobrecupo-ink)' : undefined} />
        <Reading icon={<Droplets className="h-4 w-4" />} label="Humedad relativa" value={`${Math.round(state.humidityPct)} %`} />
        <Reading
          icon={<CalendarClock className="h-4 w-4" />}
          label="Reserva activa"
          value={activeReservation ? `${activeReservation.reference}, ${time.format(Date.parse(activeReservation.startsAt))}–${time.format(Date.parse(activeReservation.endsAt))} (${activeReservation.expectedAttendees})` : 'Ninguna'}
        />
      </div>
      </div>

      {thermal ? (
        <div>
          <p className="text-sm font-semibold">Decisión del controlador térmico</p>
          <p className="mt-1 text-sm text-ink-soft">
            <span style={{ color: HVAC_META[state.hvacState].ink }} className="font-medium">{HVAC_META[state.hvacState].label}.</span>{' '}
            {state.hvacState === thermal.recommendedState ? thermal.explanation : `${HVAC_META[state.hvacState].hint}. El MPC recomendaba: ${thermal.explanation}`}
          </p>
          <p className="mt-3 text-sm text-ink-soft">Trayectoria prevista sin climatizar, {thermal.horizonMinutes} min, setpoint {formatNumber(thermal.setpointC)} °C. La franja verde es la banda de confort de la sede.</p>
          <ThermalChart decision={thermal} profile={space.climateProfile} outdoorC={state.outdoorTemperatureC} />
        </div>
      ) : (
        <p className="text-sm text-ink-soft">Este espacio aún no ha reportado telemetría.</p>
      )}
    </div>
  );
}
