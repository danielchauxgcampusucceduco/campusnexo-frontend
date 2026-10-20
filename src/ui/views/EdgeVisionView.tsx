import { CameraOff, EyeOff, ScanLine } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTwin } from '../../application/TwinContext';
import { CameraCanvas } from '../components/CameraCanvas';
import { KalmanPanel } from '../components/KalmanPanel';
import { StatusBadge } from '../components/StatusBadge';
import { useStage } from '../StageContext';
import { DESK_META, OBJECT_META } from '../theme';

function Switch({ checked, onChange, label, icon, disabled, title }: { checked: boolean; onChange: (value: boolean) => void; label: string; icon: React.ReactNode; disabled?: boolean; title?: string }) {
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

export function EdgeVisionView() {
  const { gateway, snapshot, twin } = useTwin();
  const { focus, play } = useStage();
  const [spaceId, setSpaceId] = useState(focus?.spaceId ?? 'BIB-PISO-2');
  // A scenario on another space switches the camera to it, so its effect is on screen.
  useEffect(() => {
    if (focus) setSpaceId(focus.spaceId);
  }, [focus]);
  const [privacy, setPrivacy] = useState(true);
  const [boxes, setBoxes] = useState(true);
  const current = twin(spaceId);
  if (!current) return null;
  const { state, rois, space } = current;
  const frame = snapshot.frames[spaceId];
  const counts = (frame?.detections ?? []).reduce<Record<string, number>>((acc, d) => ({ ...acc, [d.objectClass]: (acc[d.objectClass] ?? 0) + 1 }), {});

  const toggleCamera = (failed: boolean) => {
    if (gateway.capabilities.cameraControl) gateway.setCameraOnline(spaceId, !failed);
    else if (failed) void play('FALLO_CAMARA');
  };

  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_420px]">
      <section aria-labelledby="camera-title" className="min-w-0">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 id="camera-title" tabIndex={-1} className="lettering text-2xl font-semibold">Visión edge en vivo</h1>
            <p className="view-intro mt-1 max-w-[62ch] text-sm text-ink-soft">
              Cada cámara cuenta personas y objetos en el propio dispositivo y solo publica cajas y conteos; ninguna imagen sale del aula.
            </p>
          </div>
          <label className="text-sm">
            <span className="mr-2 text-ink-soft">Cámara</span>
            <select value={spaceId} onChange={(event) => setSpaceId(event.target.value)} className="rounded-lg border border-rule bg-sheet px-2.5 py-1.5">
              {snapshot.twins.map((t) => <option key={t.space.spaceId} value={t.space.spaceId}>{t.space.name} ({t.space.spaceId})</option>)}
            </select>
          </label>
        </div>

        <CameraCanvas gateway={gateway} spaceId={spaceId} rois={rois} desks={state.desks} now={snapshot.now} privacyBlur={privacy} showBoxes={boxes} />

        <div className="mt-4 flex flex-wrap items-center gap-x-7 gap-y-3">
          <Switch checked={privacy} onChange={setPrivacy} label="Pixelado de privacidad (Habeas Data)" icon={<EyeOff className="h-4 w-4 text-ink-soft" />} />
          <Switch checked={boxes} onChange={setBoxes} label="Cajas YOLO y ByteTrack" icon={<ScanLine className="h-4 w-4 text-ink-soft" />} />
          <Switch
            checked={!state.cameraOnline}
            onChange={toggleCamera}
            label="Simular fallo de cámara"
            icon={<CameraOff className="h-4 w-4 text-ink-soft" />}
            disabled={!gateway.capabilities.cameraControl && spaceId !== 'AULA-301'}
            title={gateway.capabilities.cameraControl ? undefined : 'Con el backend se usa el escenario FALLO_CAMARA de AULA-301'}
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-soft">
          {Object.entries(OBJECT_META).map(([key, meta]) => (
            <span key={key} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: meta.color }} />{meta.label} {counts[key] ?? 0}</span>
          ))}
          {rois.length > 0 && Object.values(DESK_META).map((meta) => (
            <span key={meta.label} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border" style={{ borderColor: meta.color, background: `${meta.color}33` }} /><span style={{ color: meta.ink }}>{meta.label}</span></span>
          ))}
        </div>
        {frame?.origin === 'reconstruido-desde-gemelo' && (
          <p className="mt-3 text-sm text-ink-soft">Con el backend la escena se reconstruye desde el gemelo (puestos y ocupación), porque el edge no envía imágenes ni cajas al dashboard.</p>
        )}
      </section>

      <aside aria-labelledby="kalman-title" className="min-w-0">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="kalman-title" className="lettering text-lg font-semibold">Filtro de Kalman</h2>
            <p className="text-sm text-ink-soft">OccupancyKalmanDomainService sobre {space.name}</p>
          </div>
          <StatusBadge status={state.status} size="sm" />
        </div>
        <KalmanPanel state={state} />
      </aside>
    </div>
  );
}
