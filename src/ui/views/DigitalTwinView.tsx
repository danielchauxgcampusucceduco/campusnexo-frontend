import { useTwin } from '../../application/TwinContext';
import { SPACE_STATUSES } from '../../domain/model';
import { IsoCampus } from '../components/IsoCampus';
import { SpaceDetail } from '../components/SpaceDetail';
import { StatusBadge } from '../components/StatusBadge';
import { useStage } from '../StageContext';
import { STATUS_META } from '../theme';

export function DigitalTwinView() {
  const { snapshot, twin } = useTwin();
  const { selectedSpace, selectSpace, pulseSpace } = useStage();
  const current = twin(selectedSpace) ?? snapshot.twins[0];
  const occupied = snapshot.twins.reduce((sum, t) => sum + t.state.occupancy, 0);
  const capacity = snapshot.twins.reduce((sum, t) => sum + t.space.capacity, 0);
  const present = new Set(snapshot.twins.map((t) => t.state.status));

  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_400px]">
      <section aria-labelledby="twin-title" className="min-w-0">
        <div className="mb-4">
          <h1 id="twin-title" tabIndex={-1} className="lettering text-2xl font-semibold">Gemelo digital multisede</h1>
          <p className="view-intro mt-1 max-w-[70ch] text-sm text-ink-soft">
            La altura sólida de cada bloque es la ocupación estimada y el marco punteado, su aforo. La etiqueta encima muestra la estrategia HVAC, la temperatura interior y el CO₂. Hay {occupied} personas en {snapshot.twins.length} espacios, para un aforo total de {capacity}.
          </p>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-night">
          <div className="aspect-[1000/560] w-full">
            <IsoCampus twins={snapshot.twins} selected={current?.space.spaceId ?? ''} onSelect={selectSpace} pulse={pulseSpace} />
          </div>
        </div>
        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm" aria-label="Leyenda de estados">
          {SPACE_STATUSES.map((status) => (
            <li key={status} className={`flex items-center gap-1.5 ${present.has(status) ? 'font-medium text-ink' : 'text-ink-soft'}`}>
              <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
                <rect width="12" height="12" rx="2" fill={STATUS_META[status].color} />
                {status === 'LIBERADO_POR_NO_SHOW' && <path d="M-1 5 5 -1M-1 11 11 -1M5 13 13 5" stroke="#0f1d24" strokeOpacity="0.55" strokeWidth="1.6" />}
                {status === 'MANTENIMIENTO' && <path d="M-1 5 5 -1M-1 11 11 -1M5 13 13 5" stroke="#8d9296" strokeWidth="2" />}
              </svg>
              {STATUS_META[status].label}
            </li>
          ))}
        </ul>
        <ul className="mt-5 divide-y divide-rule rounded-xl border border-rule bg-sheet md:hidden" aria-label="Espacios">
          {snapshot.twins.map((t) => (
            <li key={t.space.spaceId}>
              <button type="button" onClick={() => selectSpace(t.space.spaceId)} aria-pressed={t.space.spaceId === current?.space.spaceId}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm aria-pressed:bg-white">
                <span className="flex-1">
                  <span className="block font-medium">{t.space.name}</span>
                  <span className="text-ink-soft">{t.state.occupancy} de {t.space.capacity} personas</span>
                </span>
                <StatusBadge status={t.state.status} size="sm" />
              </button>
            </li>
          ))}
        </ul>
      </section>
      <aside aria-label="Detalle del espacio" className="min-w-0 rounded-2xl border border-rule bg-sheet p-5">
        {current && <SpaceDetail twin={current} />}
      </aside>
    </div>
  );
}
