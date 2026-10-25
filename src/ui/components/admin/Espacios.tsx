import { Ruler } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useRequest, useTwin } from '../../../application/TwinContext';
import { planRoom } from '../../../campus/plan';
import type { CampusSpace, MedidasEspacio } from '../../../domain/model';
import { useStage } from '../../StageContext';
import { SPACE_TYPE_LABEL } from '../../theme';

const inputClass = 'rounded-lg border border-rule bg-white px-2.5 py-1.5 text-sm';

const medidasDe = (space: CampusSpace): MedidasEspacio => ({
  capacity: space.capacity, areaSqm: space.areaSqm, seatRows: space.seatRows, seatColumns: space.seatColumns,
  computers: space.computers, hvacInstalled: space.hvacInstalled,
});

/**
 * Measurements of a room taken on site. The pilot rooms 301-A and 303-A start with illustrative ones; the seat
 * grid decides the camera regions, so the backend refuses one that would leave a registered workstation outside.
 */
export function Espacios() {
  const { operaciones, gateway, snapshot } = useTwin();
  const { selectedSpace, selectSpace } = useStage();
  const { pending, run } = useRequest();
  const spaces = snapshot.twins.map((t) => t.space).sort((a, b) => Number(!!planRoom(a.spaceId)) - Number(!!planRoom(b.spaceId)) || a.spaceId.localeCompare(b.spaceId));
  const space = spaces.find((s) => s.spaceId === selectedSpace) ?? spaces[0];
  const [medidas, setMedidas] = useState<MedidasEspacio | null>(space ? medidasDe(space) : null);
  const [seats, setSeats] = useState(space?.seatRows !== null);

  useEffect(() => {
    if (!space) return;
    setMedidas(medidasDe(space));
    setSeats(space.seatRows !== null);
  }, [space]);

  if (!space || !medidas) return <p className="text-sm text-ink-soft">No hay salones en el catálogo.</p>;

  const set = (field: keyof MedidasEspacio) => (value: string) => setMedidas({ ...medidas, [field]: Number(value) });
  const save = async (event: FormEvent) => {
    event.preventDefault();
    const body = seats ? medidas : { ...medidas, seatRows: null, seatColumns: null };
    const done = await run(async () => {
      await operaciones.ajustarEspacio(space.spaceId, body);
      await gateway.refresh(space.spaceId);
      return true;
    }, `Medidas de ${space.spaceId} guardadas.`);
    if (!done) setMedidas(medidasDe(space));
  };
  const number = (field: keyof MedidasEspacio, label: string, props: { min: number; max: number; step?: number }) => (
    <label className="flex flex-col gap-1 text-xs text-ink-soft">{label}
      <input type="number" required value={String(medidas[field] ?? '')} onChange={(e) => set(field)(e.target.value)} className={inputClass} {...props} />
    </label>
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <form onSubmit={(event) => void save(event)} className="flex flex-col gap-3 rounded-2xl border border-rule bg-sheet p-4" aria-labelledby="espacio-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="espacio-title" className="flex items-center gap-1.5 text-lg font-semibold"><Ruler className="h-4 w-4 text-ink-soft" />Medidas del salón</h2>
          <select value={space.spaceId} onChange={(e) => selectSpace(e.target.value)} aria-label="Salón" className={inputClass}>
            {spaces.map((s) => <option key={s.spaceId} value={s.spaceId}>{s.spaceId} · {s.name}{planRoom(s.spaceId) ? '' : ' (piloto)'}</option>)}
          </select>
        </div>
        <p className="text-sm text-ink-soft">{SPACE_TYPE_LABEL[space.type]} · {space.buildingName}, piso {space.floor}. El tipo y la ubicación vienen del plano; aquí se ajusta lo que se mide en sitio.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {number('capacity', 'Aforo (personas)', { min: 1, max: 5000 })}
          {number('areaSqm', 'Área (m²)', { min: 0.1, max: 100000, step: 0.1 })}
          {number('computers', 'Computadores', { min: 0, max: 1000 })}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={seats} onChange={(e) => setSeats(e.target.checked)} className="h-4 w-4 accent-[var(--color-night)]" />
          Tiene puestos individuales (la cámara vigila cada uno)
        </label>
        {seats && (
          <div className="grid grid-cols-2 gap-3">
            {number('seatRows', 'Filas desde el tablero', { min: 1, max: 40 })}
            {number('seatColumns', 'Columnas', { min: 1, max: 40 })}
          </div>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={medidas.hvacInstalled} onChange={(e) => setMedidas({ ...medidas, hvacInstalled: e.target.checked })} className="h-4 w-4 accent-[var(--color-night)]" />
          Tiene equipo de clima que el sistema puede controlar
        </label>
        <button type="submit" disabled={pending} className="w-fit rounded-lg bg-night px-4 py-2 text-sm font-medium text-night-text disabled:opacity-60">{pending ? 'Guardando…' : 'Guardar medidas'}</button>
      </form>
      <aside className="rounded-2xl border border-rule bg-sheet p-4 text-sm text-ink-soft">
        <p className="font-medium text-ink">Antes de medir 301-A y 303-A</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Filas y columnas cuentan desde el tablero; la primera fila es la más cercana a él.</li>
          <li>Si la rejilla se reduce, primero retira los puestos que quedarían fuera.</li>
          <li>Después de cambiar la rejilla, vuelve a calibrar la cámara del salón.</li>
        </ul>
      </aside>
    </div>
  );
}
