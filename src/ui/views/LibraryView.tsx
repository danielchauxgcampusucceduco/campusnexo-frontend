import { useTwin } from '../../application/TwinContext';
import { DeskMonitor } from '../components/DeskMonitor';
import { StatusBadge } from '../components/StatusBadge';
import { StudentPhone } from '../components/StudentPhone';
import { useLiveNow } from '../components/useLiveNow';

export function LibraryView() {
  const { gateway, snapshot, twin, runScenario } = useTwin();
  const now = useLiveNow(snapshot.now, gateway.timeScale());
  const library = twin('BIB-PISO-2');
  if (!library) return null;
  const desks = library.state.desks;
  const alerts = desks.filter((d) => d.state === 'ALERTA_ACAPARAMIENTO').length;
  const released = desks.filter((d) => d.state === 'LIBERADO_POR_ABANDONO').length;
  const verified = desks.filter((d) => d.state === 'OCUPADO_VERIFICADO').length;

  return (
    <div className="flex flex-col gap-8 xl:flex-row">
      <section aria-labelledby="library-title" className="min-w-0 flex-1">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 id="library-title" className="lettering text-2xl font-semibold">Monitor anti-acaparamiento</h1>
            <p className="mt-1 max-w-[64ch] text-sm text-ink-soft">
              Si en una mesa hay pertenencias pero ningún estudiante, empieza a correr un cronómetro de 15 minutos. Al terminar, la mesa se libera y aparece como disponible en la app.
            </p>
          </div>
          <StatusBadge status={library.state.status} />
        </div>

        <dl className="mb-6 grid grid-cols-2 gap-x-8 gap-y-4 border-y border-rule py-4 sm:grid-cols-4">
          <div><dt className="text-xs text-ink-soft">Personas en el piso</dt><dd className="lettering text-3xl font-semibold tabular-nums">{library.state.occupancy}<span className="text-base font-normal text-ink-soft"> / {library.space.capacity}</span></dd></div>
          <div><dt className="text-xs text-ink-soft">Mesas verificadas</dt><dd className="lettering text-3xl font-semibold tabular-nums">{verified}</dd></div>
          <div><dt className="text-xs text-ink-soft">Con cronómetro activo</dt><dd className="lettering text-3xl font-semibold tabular-nums text-[#b37f15]">{alerts}</dd></div>
          <div><dt className="text-xs text-ink-soft">Liberadas por abandono</dt><dd className="lettering text-3xl font-semibold tabular-nums text-st-sobrecupo">{released}</dd></div>
        </dl>

        <DeskMonitor rois={library.rois} desks={desks} now={now} />

        <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
          <button type="button" onClick={() => void runScenario('ACAPARAMIENTO_BIBLIOTECA')} className="rounded-lg bg-night px-3.5 py-2 font-medium text-night-text">
            Ejecutar escenario de acaparamiento
          </button>
          {gateway.capabilities.timeScale && (
            <p className="text-xs text-ink-soft">Con la simulación a {gateway.timeScale()}×, los 15 minutos pasan en {Math.round((15 * 60) / gateway.timeScale())} segundos.</p>
          )}
        </div>
      </section>
      <aside className="shrink-0">
        <StudentPhone library={library} now={now} />
      </aside>
    </div>
  );
}
