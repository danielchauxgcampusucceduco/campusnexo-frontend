import { CalendarPlus, Thermometer, Wrench, BookOpenCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useRequest, useTwin } from '../../application/TwinContext';
import type { SpaceTwinState, TwinSpace } from '../../domain/model';

const inputClass = 'rounded-lg border border-rule bg-white px-2.5 py-1.5 text-sm';
const buttonClass = 'flex items-center justify-center gap-1.5 rounded-lg border border-rule bg-paper px-3 py-1.5 text-sm font-medium hover:bg-white disabled:opacity-50';

/** Local time for a datetime-local input, rounded to the next quarter hour. */
function nextQuarter(now: number): string {
  const date = new Date(Math.ceil(now / 900_000) * 900_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * What the staff can do in a room: take it out of service, open it as a study room, hand the climate to the
 * teacher and book it, naming the registered teacher or student in charge. The backend applies its own rules
 * (who can book what and for how long) and answers with the new state.
 */
export function OperacionesPanel({ twin }: { twin: TwinSpace }) {
  const { operaciones, gateway, snapshot } = useTwin();
  const { pending, run } = useRequest();
  const { space, state, activeReservation } = twin;
  const [startsAt, setStartsAt] = useState(() => nextQuarter(snapshot.now));
  const [minutes, setMinutes] = useState(90);
  const [attendees, setAttendees] = useState(Math.min(space.capacity, 25));
  const [reference, setReference] = useState('');
  const [holderCode, setHolderCode] = useState('');

  const apply = async (request: () => Promise<SpaceTwinState>, done: string) => {
    const result = await run(request, done);
    if (result) gateway.accept(result);
  };

  const book = async (event: FormEvent) => {
    event.preventDefault();
    const start = new Date(startsAt);
    const created = await run(() => operaciones.reservar(space.spaceId, {
      startsAt: start.toISOString(),
      endsAt: new Date(start.getTime() + minutes * 60_000).toISOString(),
      expectedAttendees: attendees,
      reference: reference.trim(),
      holderCode: holderCode.trim() || null,
    }), `Reserva ${reference.trim()} creada en ${space.spaceId}.`);
    if (created) setReference('');
  };

  return (
    <section aria-labelledby="ops-title" className="rounded-2xl border border-rule bg-sheet p-4">
      <h2 id="ops-title" className="text-base font-semibold">Operación del salón</h2>
      {activeReservation && (
        <p className="mt-1 text-sm text-ink-soft">
          Reserva en curso: <b className="text-ink">{activeReservation.reference}</b> ({activeReservation.expectedAttendees} personas)
          {activeReservation.holderCode && <> · titular {activeReservation.holderCode}{activeReservation.checkedInAt ? ', ya hizo check-in' : ', sin check-in'}</>}
        </p>
      )}
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <button type="button" disabled={pending} className={buttonClass}
          onClick={() => void apply(() => operaciones.setMaintenance(space.spaceId, !state.maintenance),
            state.maintenance ? `${space.spaceId} vuelve a servicio.` : `${space.spaceId} queda en mantenimiento.`)}>
          <Wrench className="h-4 w-4" />{state.maintenance ? 'Terminar mantenimiento' : 'Mantenimiento'}
        </button>
        <button type="button" disabled={pending || state.maintenance} className={buttonClass}
          onClick={() => void apply(() => operaciones.openPopUp(space.spaceId, 120), `${space.spaceId} abierto como sala de estudio por 2 h.`)}>
          <BookOpenCheck className="h-4 w-4" />Sala de estudio 2 h
        </button>
        <button type="button" disabled={pending || !space.hvacInstalled} className={buttonClass}
          title={space.hvacInstalled ? undefined : 'Este salón no tiene equipo de clima'}
          onClick={() => void apply(() => operaciones.manualOverride(space.spaceId, 45), `Clima de ${space.spaceId} en control del docente por 45 min.`)}>
          <Thermometer className="h-4 w-4" />Clima al docente
        </button>
      </div>

      <form className="mt-4 grid grid-cols-2 gap-2 border-t border-rule pt-3" onSubmit={(event) => void book(event)}>
        <p className="col-span-2 flex items-center gap-1.5 text-sm font-medium"><CalendarPlus className="h-4 w-4 text-ink-soft" />Nueva reserva</p>
        <label className="col-span-2 flex flex-col gap-1 text-xs text-ink-soft sm:col-span-1">Inicio
          <input type="datetime-local" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-soft">Duración
          <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className={inputClass}>
            {[60, 90, 120, 180, 240].map((m) => <option key={m} value={m}>{m / 60} h</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-soft">Asistentes
          <input type="number" min={1} max={space.capacity * 2} required value={attendees} onChange={(e) => setAttendees(Number(e.target.value))} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-soft">Curso o grupo
          <input required maxLength={80} placeholder="IS-701" value={reference} onChange={(e) => setReference(e.target.value)} className={inputClass} />
        </label>
        <label className="col-span-2 flex flex-col gap-1 text-xs text-ink-soft">Código del titular (docente o estudiante registrado, opcional)
          <input maxLength={32} value={holderCode} onChange={(e) => setHolderCode(e.target.value)} className={inputClass} />
        </label>
        <button type="submit" disabled={pending} className="col-span-2 rounded-lg bg-night px-3 py-2 text-sm font-medium text-night-text disabled:opacity-60">
          {pending ? 'Enviando…' : 'Reservar'}
        </button>
      </form>
    </section>
  );
}
