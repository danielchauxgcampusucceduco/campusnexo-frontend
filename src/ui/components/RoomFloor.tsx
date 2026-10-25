import { CameraOff, Cctv, FlaskConical } from 'lucide-react';
import { planRoom } from '../../campus/plan';
import { TEACHER_ZONE_BOTTOM, type NormalizedPoint, type TwinSpace } from '../../domain/model';
import { DESK_META, SEAT_WORD } from '../theme';

const time = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Bogota' });

function center(polygon: NormalizedPoint[]): NormalizedPoint {
  const [x, y] = polygon.reduce<[number, number]>((sum, [px, py]) => [sum[0] + px, sum[1] + py], [0, 0]);
  return [x / polygon.length, y / polygon.length];
}

/**
 * The room seen from above, as the twin knows it: the board at the top with the teacher band in front of it,
 * every seat region the camera watches, a dot for each person the backend placed in a seat and one for each
 * person in the teacher band. Only positions travel from the room; no image does.
 */
export function RoomFloor({ twin, now }: { twin: TwinSpace; now: number }) {
  const { space, state, rois } = twin;
  const rect = planRoom(space.spaceId)?.rect;
  const aspect = rect ? Math.max(rect.w, rect.h) / Math.min(rect.w, rect.h) : 1.6;
  const width = 100 * aspect;
  const height = 100;
  const desks = new Map(state.desks.map((desk) => [desk.zoneId, desk]));
  const teachers = Math.min(state.teachersPresent, 6);
  const standing = Math.max(0, state.occupancy - state.teachersPresent - state.studentsPresent);
  const frameAge = state.lastCameraFrameAt ? Math.max(0, Math.round((now - Date.parse(state.lastCameraFrameAt)) / 1000)) : null;
  const [, seats] = SEAT_WORD[space.type];

  return (
    <figure className="overflow-hidden rounded-2xl bg-night text-night-text">
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
        {state.cameraOnline
          ? <span className="flex items-center gap-1.5"><Cctv className="h-4 w-4 text-signal" />Cámara en línea</span>
          : <span className="flex items-center gap-1.5 text-[#ffb4a6]"><CameraOff className="h-4 w-4" />Cámara sin señal</span>}
        {frameAge !== null && <span className="text-night-text/75">último frame hace {frameAge} s ({time.format(Date.parse(state.lastCameraFrameAt!))})</span>}
        {state.emulated && (
          <span className="ml-auto flex items-center gap-1.5 rounded-full bg-ucc-lima px-2.5 py-0.5 text-xs font-semibold text-ucc-marino">
            <FlaskConical className="h-3.5 w-3.5" />Emulado
          </span>
        )}
      </figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} className="block w-full" role="img"
        aria-label={`${space.name}: ${state.teachersPresent} en la zona del docente, ${state.studentsPresent} en ${seats}`}>
        <rect x="0" y="0" width={width} height={height} fill="#0e1e33" />
        <rect x="0" y="0" width={width} height={TEACHER_ZONE_BOTTOM * height} fill="var(--color-signal)" fillOpacity="0.1" />
        <line x1="0" x2={width} y1={TEACHER_ZONE_BOTTOM * height} y2={TEACHER_ZONE_BOTTOM * height} stroke="var(--color-signal)" strokeOpacity="0.5" strokeDasharray="1.5 1.5" strokeWidth="0.4" />
        <rect x={width * 0.3} y="1.2" width={width * 0.4} height="2.2" rx="0.6" fill="#d6e6ef" fillOpacity="0.85" />
        <text x={width / 2} y="8.5" textAnchor="middle" fontSize="3.4" fill="#d6e6ef" fillOpacity="0.8">Tablero · zona del docente</text>
        {Array.from({ length: teachers }, (_, i) => (
          <circle key={`t${i}`} cx={width * ((i + 1) / (teachers + 1))} cy={TEACHER_ZONE_BOTTOM * height * 0.62} r="2.6"
            fill="var(--color-ucc-lima)" stroke="#0e1e33" strokeWidth="0.6" className="person" />
        ))}
        {rois.map((roi) => {
          const desk = desks.get(roi.zoneId);
          const meta = DESK_META[desk?.state ?? 'DISPONIBLE'];
          const taken = (desk?.peopleInside ?? 0) > 0;
          const [cx, cy] = center(roi.polygon);
          return (
            <g key={roi.zoneId}>
              <title>{`${roi.label}: ${meta.label}`}</title>
              <polygon points={roi.polygon.map(([x, y]) => `${x * width},${y * height}`).join(' ')}
                fill={meta.color} fillOpacity={taken ? 0.55 : desk && desk.state !== 'DISPONIBLE' ? 0.4 : 0.1}
                stroke={meta.color} strokeOpacity="0.8" strokeWidth="0.4"
                className={desk?.state === 'ALERTA_ACAPARAMIENTO' ? 'seat-alert' : undefined} />
              {taken && <circle cx={cx * width} cy={cy * height} r="1.9" fill="#eaf6ff" className="person" />}
            </g>
          );
        })}
      </svg>
      <p className="flex flex-wrap gap-x-5 gap-y-1 px-4 py-2.5 text-sm">
        <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-ucc-lima" />Docente en zona: <b className="text-white">{state.teachersPresent}</b></span>
        <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-[#eaf6ff]" />Estudiantes en {seats}: <b className="text-white">{state.studentsPresent}</b></span>
        {standing > 0 && <span className="text-night-text/75">De pie fuera de los puestos: {standing}</span>}
      </p>
    </figure>
  );
}
