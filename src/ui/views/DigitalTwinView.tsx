import { useState } from 'react';
import { useTwin } from '../../application/TwinContext';
import { SPACE_STATUSES } from '../../domain/model';
import { IsoCampus } from '../components/IsoCampus';
import { SpaceDetail } from '../components/SpaceDetail';
import { STATUS_META } from '../theme';

export function DigitalTwinView() {
  const { snapshot, twin } = useTwin();
  const [selected, setSelected] = useState('AULA-301');
  const current = twin(selected) ?? snapshot.twins[0];
  const occupied = snapshot.twins.reduce((sum, t) => sum + t.state.occupancy, 0);
  const capacity = snapshot.twins.reduce((sum, t) => sum + t.space.capacity, 0);
  const present = new Set(snapshot.twins.map((t) => t.state.status));

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section aria-labelledby="twin-title" className="min-w-0">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 id="twin-title" className="lettering text-2xl font-semibold">Gemelo digital multisede</h1>
            <p className="mt-1 max-w-[64ch] text-sm text-ink-soft">
              La altura sólida de cada bloque es la ocupación estimada y el marco punteado su aforo. Hay {occupied} personas en {snapshot.twins.length} espacios monitoreados, para un aforo total de {capacity}.
            </p>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-night">
          <div className="aspect-[1000/560] w-full">
            <IsoCampus twins={snapshot.twins} selected={current?.space.spaceId ?? ''} onSelect={setSelected} />
          </div>
        </div>
        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs" aria-label="Leyenda de estados">
          {SPACE_STATUSES.map((status) => (
            <li key={status} className={`flex items-center gap-1.5 ${present.has(status) ? 'text-ink' : 'text-ink-soft/70'}`}>
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: STATUS_META[status].color }} />
              {STATUS_META[status].label}
            </li>
          ))}
        </ul>
      </section>
      <aside className="min-w-0 rounded-2xl border border-rule bg-sheet p-5">
        {current && <SpaceDetail twin={current} />}
      </aside>
    </div>
  );
}
