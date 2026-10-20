import { CameraOff, ChevronDown, EyeOff, ScanLine } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useTwin } from '../../application/TwinContext';
import { PLAN_FLOORS } from '../../campus/plan';
import { CameraCanvas } from '../components/CameraCanvas';
import { ArduinoPanel } from '../components/ArduinoPanel';
import { KalmanPanel } from '../components/KalmanPanel';
import { SeatMap } from '../components/SeatMap';
import { useStage } from '../StageContext';
import { CONDITION_META, MEASUREMENT_META, OBJECT_META } from '../theme';

function Switch({ checked, onChange, label, icon, disabled, title }: { checked: boolean; onChange: (value: boolean) => void; label: string; icon: ReactNode; disabled?: boolean; title?: string }) {
  return (
    <label title={title} className={`flex cursor-pointer items-center gap-2.5 text-sm ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}>
      <span className="relative inline-flex h-5 w-9 shrink-0">
        <input type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
        <span className="absolute inset-0 rounded-full bg-rule transition-colors peer-checked:bg-night peer-focus-visible:outline-2 peer-focus-visible:outline-st-optimo" />
        <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
      </span>
      {icon}
      {label}
    </label>
  );
}

/**
 * One room up close: what its ceiling camera sees (the AI model marks people and belongings and the
 * seat each one is in), its seat map, its Arduino readings and how the people count is reached.
 */
export function SalonView() {
  const { gateway, snapshot, twin, scenarios } = useTwin();
  const { focus, play, selectedSpace, selectSpace } = useStage();
  const [privacy, setPrivacy] = useState(true);
  const [boxes, setBoxes] = useState(true);
  const [details, setDetails] = useState(false);
  const spaceId = selectedSpace;
  useEffect(() => {
    if (focus) selectSpace(focus.spaceId);
  }, [focus, selectSpace]);
  const current = twin(spaceId) ?? snapshot.twins[0];
  if (!current) return null;
  const { state, rois, space } = current;
  const frame = snapshot.frames[space.spaceId];
  const counts = (frame?.detections ?? []).reduce<Record<string, number>>((acc, d) => ({ ...acc, [d.objectClass]: (acc[d.objectClass] ?? 0) + 1 }), {});
  const failScenario = scenarios.find((s) => s.scenario === 'FALLO_CAMARA');

  const toggleCamera = (failed: boolean) => {
    if (gateway.capabilities.cameraControl) gateway.setCameraOnline(space.spaceId, !failed);
    else if (failed) void play('FALLO_CAMARA');
  };
  const kalman = state.kalman;

  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_440px]">
      <section aria-labelledby="salon-title" className="min-w-0">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 id="salon-title" tabIndex={-1} className="lettering text-2xl font-semibold">{space.name}</h1>
            <p className="view-intro mt-1 max-w-[66ch] text-sm text-ink-soft">
              La cámara del techo tiene un modelo de inteligencia artificial que reconoce personas, portátiles, morrales y libros, y sabe en qué pupitre está cada uno. Solo envía conteos y posiciones: ninguna imagen sale del salón.
            </p>
          </div>
          <label className="text-sm">
            <span className="mr-2 text-ink-soft">Salón</span>
            <select value={space.spaceId} onChange={(event) => selectSpace(event.target.value)} className="max-w-[18rem] rounded-lg border border-rule bg-sheet px-2.5 py-1.5">
              {PLAN_FLOORS.map((floor) => (
                <optgroup key={floor.floor} label={floor.name}>
                  {floor.rooms.map((room) => <option key={room.spaceId} value={room.spaceId}>{room.name}{room.name.includes(room.spaceId) ? '' : ` (${room.spaceId})`}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
        </div>

        <CameraCanvas gateway={gateway} spaceId={space.spaceId} rois={rois} desks={state.desks} now={snapshot.now} privacyBlur={privacy} showBoxes={boxes} />

        <div className="mt-4 flex flex-wrap items-center gap-x-7 gap-y-3">
          <Switch checked={privacy} onChange={setPrivacy} label="Pixelado de privacidad" icon={<EyeOff className="h-4 w-4 text-ink-soft" />} />
          <Switch checked={boxes} onChange={setBoxes} label="Mostrar lo que reconoce la IA" icon={<ScanLine className="h-4 w-4 text-ink-soft" />} />
          <Switch checked={!state.cameraOnline} onChange={toggleCamera} label="Simular cámara caída" icon={<CameraOff className="h-4 w-4 text-ink-soft" />}
            disabled={!gateway.capabilities.cameraControl && space.spaceId !== failScenario?.spaceId}
            title={gateway.capabilities.cameraControl ? undefined : `Con el servidor se usa el escenario de cámara caída (${failScenario?.spaceId})`} />
        </div>

        <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-soft">
          {Object.entries(OBJECT_META).map(([key, meta]) => (
            <li key={key} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: meta.color }} />{meta.plain}: <b className="tabular-nums text-ink">{counts[key] ?? 0}</b></li>
          ))}
        </ul>

        <div className="mt-6">
          <h2 className="mb-2 text-lg font-semibold">Pupitres y puestos</h2>
          <SeatMap twin={current} large />
        </div>
      </section>

      <aside className="flex min-w-0 flex-col gap-4">
        <div className="rounded-2xl border border-rule bg-sheet p-4">
          <p className="text-sm text-ink-soft">Estado del salón</p>
          <p className="text-2xl font-semibold" style={{ color: CONDITION_META[state.condition].ink }}>{CONDITION_META[state.condition].label}</p>
          <p className="text-sm text-ink-soft">{state.occupancy} de {space.capacity} personas · {CONDITION_META[state.condition].hint}</p>
        </div>

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
