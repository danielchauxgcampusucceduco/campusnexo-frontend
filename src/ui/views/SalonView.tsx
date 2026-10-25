import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useTwin } from '../../application/TwinContext';
import { PLAN_FLOORS, planRoom } from '../../campus/plan';
import { ArduinoPanel } from '../components/ArduinoPanel';
import { KalmanPanel } from '../components/KalmanPanel';
import { OperacionesPanel } from '../components/OperacionesPanel';
import { PronosticoPanel } from '../components/PronosticoPanel';
import { RoomFloor } from '../components/RoomFloor';
import { ESCENARIO_META } from '../scenarioPlaybook';
import { useStage } from '../StageContext';
import { CONDITION_META, MEASUREMENT_META } from '../theme';

/**
 * One room up close: who the camera places in front of the board and in the seats, the scenarios the backend
 * recognizes there, its Arduino readings, how the people count is reached and, for staff, its controls.
 */
export function SalonView() {
  const { gateway, snapshot, twin } = useTwin();
  const { selectedSpace, selectSpace } = useStage();
  const [details, setDetails] = useState(false);
  const current = twin(selectedSpace) ?? snapshot.twins[0];
  if (!current) return null;
  const { state, space } = current;
  const kalman = state.kalman;
  const pilots = snapshot.twins.filter((t) => !planRoom(t.space.spaceId));

  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_440px]">
      <section aria-labelledby="salon-title" className="min-w-0">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 id="salon-title" tabIndex={-1} className="lettering text-2xl font-semibold">{space.name}</h1>
            <p className="mt-1 max-w-[66ch] text-sm text-ink-soft">
              La cámara reconoce personas y mobiliario y envía solo posiciones en el piso: quien está en la franja del tablero cuenta como docente y quien está en un puesto, como estudiante. Ninguna imagen sale del salón.
            </p>
          </div>
          <label className="text-sm">
            <span className="mr-2 text-ink-soft">Salón</span>
            <select value={space.spaceId} onChange={(event) => selectSpace(event.target.value)} className="max-w-[18rem] rounded-lg border border-rule bg-sheet px-2.5 py-1.5">
              {pilots.length > 0 && (
                <optgroup label="Salones piloto">
                  {pilots.map((t) => <option key={t.space.spaceId} value={t.space.spaceId}>{t.space.name} ({t.space.spaceId})</option>)}
                </optgroup>
              )}
              {PLAN_FLOORS.map((floor) => (
                <optgroup key={floor.floor} label={floor.name}>
                  {floor.rooms.map((room) => <option key={room.spaceId} value={room.spaceId}>{room.name}{room.name.includes(room.spaceId) ? '' : ` (${room.spaceId})`}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
        </div>

        <RoomFloor twin={current} now={snapshot.now} />

        <div className="mt-4">
          <h2 className="text-sm font-semibold">Escenarios reconocidos en este salón</h2>
          {state.escenarios.length === 0
            ? <p className="mt-1 text-sm text-ink-soft">Ninguno en este momento.</p>
            : (
              <ul className="mt-2 flex flex-wrap gap-2">
                {state.escenarios.map(({ escenario, descripcion }) => (
                  <li key={escenario} title={descripcion}
                    className={`rounded-full border px-3 py-1 text-sm ${ESCENARIO_META[escenario].attention ? 'border-st-subutilizado bg-[color-mix(in_oklab,var(--color-st-subutilizado)_14%,transparent)] text-st-subutilizado-ink' : 'border-st-optimo/50 bg-[color-mix(in_oklab,var(--color-st-optimo)_10%,transparent)] text-st-optimo-ink'}`}>
                    <b className="font-semibold">{ESCENARIO_META[escenario].label}</b> · {descripcion}
                  </li>
                ))}
              </ul>
            )}
        </div>
      </section>

      <aside className="flex min-w-0 flex-col gap-4">
        <div className="rounded-2xl border border-rule bg-sheet p-4">
          <p className="text-sm text-ink-soft">Estado del salón</p>
          <p className="text-2xl font-semibold" style={{ color: CONDITION_META[state.condition].ink }}>{CONDITION_META[state.condition].label}</p>
          <p className="text-sm text-ink-soft">{state.occupancy} de {space.capacity} personas · {CONDITION_META[state.condition].hint}</p>
        </div>

        {gateway.capabilities.operations && <OperacionesPanel twin={current} />}
        {gateway.capabilities.administration && <PronosticoPanel spaceId={space.spaceId} />}

        <ArduinoPanel twin={current} />

        <section className="rounded-2xl border border-rule bg-sheet p-4" aria-labelledby="count-title">
          <h2 id="count-title" className="text-base font-semibold">¿Cómo sabe cuántas personas hay?</h2>
          <p className="mt-1 text-sm text-ink-soft">Junta tres pistas y confía más en la más segura. Si la cámara se cae, sigue contando con las otras dos.</p>
          {kalman ? (
            <ul className="mt-3 space-y-2.5">
              {(['CAMARA_YOLO', 'CO2_BALANCE_MASICO', 'WIFI_DISPOSITIVOS'] as const).map((source) => {
                const m = kalman.measurements.find((x) => x.source === source);
                return (
                  <li key={source}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="font-medium">{MEASUREMENT_META[source].label}</span>
                      <span className="tabular-nums text-ink-soft">{m ? `${Math.round(m.value)} personas` : 'sin señal'}</span>
                    </div>
                    <span className="mt-1 block h-2 overflow-hidden rounded-full bg-rule/60">
                      <span className="block h-full rounded-full bg-st-optimo transition-[width] duration-700" style={{ width: `${m ? Math.round(Math.min(1, m.gain) * 100) : 0}%` }} />
                    </span>
                  </li>
                );
              })}
              <li className="border-t border-rule pt-2 text-sm">Resultado: <b className="text-base">{Math.round(kalman.posteriorEstimate)}</b> personas (± {Math.max(1, Math.round(2 * Math.sqrt(kalman.posteriorVariance)))})</li>
            </ul>
          ) : (
            <p className="mt-2 text-sm text-ink-soft">Esperando la primera lectura.</p>
          )}
          <button type="button" aria-expanded={details} onClick={() => setDetails((d) => !d)} className="mt-3 flex items-center gap-1 text-sm font-medium text-st-optimo-ink">
            <ChevronDown className={`h-4 w-4 transition-transform ${details ? 'rotate-180' : ''}`} />{details ? 'Ocultar' : 'Ver'} las ecuaciones (filtro de Kalman)
          </button>
          {details && <div className="mt-3"><KalmanPanel state={state} /></div>}
        </section>
      </aside>
    </div>
  );
}
