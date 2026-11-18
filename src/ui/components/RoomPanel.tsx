import { Cctv, CameraOff, FlaskConical, Users } from 'lucide-react';
import { floorName, planRoom } from '../../campus/plan';
import { roomCondition, type TwinSpace } from '../../domain/model';
import { navigate } from '../StageContext';
import { CONDITION_META, SPACE_TYPE_LABEL, STATUS_META } from '../theme';
import { CountUp } from './CountUp';
import { SeatMap } from './SeatMap';

/** Everything about one room, in plain words: who is there, what the camera sees and what the system decided. */
export function RoomPanel({ twin }: { twin: TwinSpace }) {
  const { space, state, activeReservation } = twin;
  const plan = planRoom(space.spaceId);
  const share = Math.min(1.25, state.occupancy / Math.max(1, space.capacity));
  const condition = CONDITION_META[roomCondition(twin)];
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="flex flex-col gap-4">
      <header>
        <p className="text-sm text-ink-soft">{space.buildingName} · {floorName(space.floor)} · {SPACE_TYPE_LABEL[space.type]}</p>
        <h2 className="lettering mt-0.5 text-2xl font-semibold leading-tight">{space.name}</h2>
        <p className="condensed flex items-center gap-2 text-sm text-ink-soft">{space.spaceId}{plan ? ` · ${plan.areaSqm.toLocaleString('es-CO')} m² según el plano` : ' · salón piloto'}
          {state.emulated && <span className="flex items-center gap-1 rounded-full bg-ucc-lima px-2 py-0.5 text-xs font-semibold text-ucc-marino"><FlaskConical className="h-3 w-3" />Emulado</span>}
        </p>
      </header>

      {!space.accesibleParaEstudiantes ? (
        <p className="rounded-2xl border border-rule bg-sheet p-4 text-sm text-ink-soft">
          Espacio administrativo: aparece en el plano pero no se monitorea, porque los estudiantes no lo usan.
        </p>
      ) : (
        <div className="flex items-center gap-4 rounded-2xl border border-rule bg-sheet p-4">
          <svg viewBox="0 0 80 80" className="h-24 w-24 shrink-0" aria-hidden>
            <circle cx="40" cy="40" r={radius} fill="none" stroke="var(--color-rule)" strokeWidth="8" />
            <circle cx="40" cy="40" r={radius} fill="none" stroke={condition.color} strokeWidth="8" strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={circumference * (1 - Math.min(1, share))} transform="rotate(-90 40 40)"
              style={{ transition: 'stroke-dashoffset 700ms cubic-bezier(0.16, 1, 0.3, 1), stroke 400ms ease' }} />
            <text x="40" y="44" textAnchor="middle" fontSize="17" fontWeight={700} fill="currentColor">{Math.round(share * 100)}%</text>
          </svg>
          <div className="min-w-0">
            <p className="text-lg font-semibold leading-tight" style={{ color: condition.ink }}>{condition.label}</p>
            <p className="text-sm text-ink-soft">{condition.hint}</p>
            <p className="mt-2 flex items-center gap-1.5 text-sm"><Users className="h-4 w-4 text-ink-soft" />
              <b><CountUp value={state.occupancy} /></b>&nbsp;de {space.capacity} personas
            </p>
            <p className="text-sm text-ink-soft">{state.teachersPresent} en la zona del docente · {state.studentsPresent} en los puestos</p>
            <p className="text-sm text-ink-soft">{STATUS_META[state.status].label}{activeReservation ? ` · reserva ${activeReservation.reference} (${activeReservation.expectedAttendees})` : ''}</p>
            <p className="text-sm text-ink-soft">
              {!state.sensorsReporting ? 'La cámara todavía no ha enviado datos' : state.cameraOnline ? 'Cámara en línea' : 'Cámara sin señal: se muestra la última estimación'}
            </p>
          </div>
        </div>
      )}

      <SeatMap twin={twin} />

      <button type="button" onClick={() => navigate('salon')}
        className="flex items-center justify-center gap-2 rounded-xl bg-night px-4 py-2.5 text-sm font-medium text-night-text transition-transform hover:-translate-y-0.5">
        {state.cameraOnline ? <Cctv className="h-4 w-4 text-signal" /> : <CameraOff className="h-4 w-4 text-[#f6a47f]" />}
        Ver el salón en detalle
      </button>
    </div>
  );
}
