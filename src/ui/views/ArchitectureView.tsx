import { useEffect, useRef, useState } from 'react';
import { useTwin } from '../../application/TwinContext';
import type { ArchitectureTrace } from '../../domain/model';
import { HexagonFlow } from '../components/HexagonFlow';
import { LAYER_META } from '../theme';

const REPLAY_MS = 6_000;
const time = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Bogota' });

export function ArchitectureView() {
  const { snapshot, runScenario } = useTwin();
  const [pinned, setPinned] = useState<string | null>(null);
  const [live, setLive] = useState<ArchitectureTrace | null>(snapshot.highlightedTrace ?? snapshot.traces[0] ?? null);
  const latest = useRef(snapshot.traces[0] ?? null);
  latest.current = snapshot.traces[0] ?? null;

  // A user action replays immediately; otherwise the view follows live telemetry, one complete replay at a time.
  useEffect(() => {
    if (snapshot.highlightedTrace) {
      setPinned(null);
      setLive(snapshot.highlightedTrace);
    }
  }, [snapshot.highlightedTrace]);
  useEffect(() => {
    const id = setInterval(() => setLive((current) => (current === snapshot.highlightedTrace && current !== null ? current : latest.current)), REPLAY_MS);
    return () => clearInterval(id);
  }, [snapshot.highlightedTrace]);

  const trace: ArchitectureTrace | null = snapshot.traces.find((t) => t.traceId === pinned) ?? live;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section aria-labelledby="arch-title" className="min-w-0">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 id="arch-title" className="lettering text-2xl font-semibold">Trazabilidad de la arquitectura hexagonal</h1>
            <p className="mt-1 max-w-[66ch] text-sm text-ink-soft">
              Cada evento recorre el mismo camino: adaptador de entrada, puerto de entrada, caso de uso y servicios de dominio. Después sale por los puertos de salida hacia sus adaptadores. Las dependencias siempre apuntan hacia el dominio.
            </p>
          </div>
          <button type="button" onClick={() => void runScenario('CLASE_EN_CURSO')} className="rounded-lg bg-night px-3.5 py-2 text-sm font-medium text-night-text">
            Disparar un evento
          </button>
        </div>
        <div className="overflow-hidden rounded-2xl bg-night">
          <div className="aspect-[1000/600] w-full">
            <HexagonFlow key={trace?.traceId ?? 'none'} trace={trace} />
          </div>
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs text-ink-soft" aria-label="Anillos de la arquitectura">
          <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#7aa6b8]" />Adaptadores (infraestructura)</li>
          <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#9fc7b9]" />Puertos de entrada y salida</li>
          <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#c3a6f0]" />Casos de uso (aplicación)</li>
          <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#f2c14e]" />Servicios de dominio</li>
        </ul>
      </section>

      <aside className="min-w-0">
        {trace ? (
          <>
            <h2 className="lettering text-lg font-semibold">Recorrido del evento</h2>
            <p className="mt-0.5 text-xs text-ink-soft">{trace.trigger}, espacio {trace.spaceId}, {time.format(Date.parse(trace.startedAt))}</p>
            <ol className="mt-4 space-y-2.5 border-l border-rule pl-4">
              {trace.steps.map((step, index) => (
                <li key={`${step.component}-${index}`} className="relative">
                  <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-paper bg-st-optimo" />
                  <p className="text-[11px] text-ink-soft">{index + 1}. {LAYER_META[step.layer].label}</p>
                  <p className="text-sm font-medium [overflow-wrap:anywhere]">{step.component}</p>
                  {step.detail && <p className="text-xs text-ink-soft [overflow-wrap:anywhere]">{step.detail}</p>}
                </li>
              ))}
            </ol>
          </>
        ) : (
          <p className="text-sm text-ink-soft">Aún no hay eventos. Dispara un escenario para ver el recorrido.</p>
        )}

        <h3 className="mt-8 text-sm font-semibold">Eventos recientes</h3>
        <ul className="mt-2 max-h-64 divide-y divide-rule overflow-y-auto rounded-xl border border-rule bg-sheet text-xs">
          {snapshot.traces.slice(0, 15).map((t) => (
            <li key={t.traceId}>
              <button type="button" onClick={() => setPinned(t.traceId)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-white ${t.traceId === trace?.traceId ? 'bg-white font-medium' : ''}`}>
                <span className="tabular-nums text-ink-soft">{time.format(Date.parse(t.startedAt))}</span>
                <span className="flex-1 truncate">{t.trigger}</span>
                <span className="text-ink-soft">{t.spaceId}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
