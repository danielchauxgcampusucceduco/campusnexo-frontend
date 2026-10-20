import { Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTwin } from '../../application/TwinContext';
import type { ArchitectureTrace } from '../../domain/model';
import { HexagonFlow, tracePath } from '../components/HexagonFlow';
import { Kbd } from '../components/ScenarioDock';
import { useStage } from '../StageContext';
import { LAYER_META } from '../theme';

const STEP_MS = 650;
/** Pause after a complete replay before following the next live event. */
const HOLD_MS = 4_000;
const time = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Bogota' });
const isPeriodic = (trace: ArchitectureTrace) => trace.trigger.startsWith('MQTT');

export function ArchitectureView() {
  const { snapshot, gateway } = useTwin();
  const { play, running } = useStage();
  const [pinned, setPinned] = useState<string | null>(null);
  const [live, setLive] = useState<ArchitectureTrace | null>(snapshot.highlightedTrace ?? snapshot.traces[0] ?? null);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hidePeriodic, setHidePeriodic] = useState(true);
  const latest = useRef(snapshot.traces[0] ?? null);
  latest.current = snapshot.traces[0] ?? null;

  const trace: ArchitectureTrace | null = snapshot.traces.find((t) => t.traceId === pinned) ?? live;
  const total = trace?.steps.length ?? 0;
  const path = tracePath(trace, gateway.mode);

  // A user action replays at once and stays on screen; otherwise the view follows live telemetry.
  useEffect(() => {
    if (snapshot.highlightedTrace) {
      setPinned(null);
      setLive(snapshot.highlightedTrace);
    }
  }, [snapshot.highlightedTrace]);

  useEffect(() => {
    setProgress(0);
  }, [trace?.traceId]);

  useEffect(() => {
    if (paused || !trace) return;
    if (progress < total) {
      const id = setTimeout(() => setProgress((p) => p + 1), progress === 0 ? 250 : STEP_MS);
      return () => clearTimeout(id);
    }
    if (pinned || trace === snapshot.highlightedTrace) return;
    const id = setInterval(() => {
      if (latest.current && latest.current.traceId !== trace.traceId) setLive(latest.current);
    }, HOLD_MS);
    return () => clearInterval(id);
  }, [paused, progress, total, trace, pinned, snapshot.highlightedTrace]);

  const step = (delta: number) => {
    setPaused(true);
    setProgress((p) => Math.max(0, Math.min(total, p + delta)));
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && target !== document.body && target.tagName !== 'H1') return;
      if (event.key === ' ') { event.preventDefault(); setPaused((p) => !p); }
      else if (event.key === 'ArrowRight') { event.preventDefault(); step(1); }
      else if (event.key === 'ArrowLeft') { event.preventDefault(); step(-1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const currentIndex = progress - 1;
  const currentStep = trace?.steps[currentIndex];
  const recent = snapshot.traces.filter((t) => !hidePeriodic || !isPeriodic(t) || t.traceId === trace?.traceId).slice(0, 15);

  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_440px]">
      <section aria-labelledby="arch-title" className="min-w-0">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 id="arch-title" tabIndex={-1} className="lettering text-2xl font-semibold">Trazabilidad de la arquitectura hexagonal</h1>
            <p className="view-intro mt-1 max-w-[70ch] text-sm text-ink-soft">
              Cada evento entra por un adaptador, pasa por un puerto de entrada y un caso de uso hasta los servicios de dominio, y sale por los puertos de salida hacia sus adaptadores. Las dependencias siempre apuntan hacia el dominio.
              {gateway.mode === 'simulation' && ' En la simulación, los adaptadores son las versiones en memoria que corren en el navegador.'}
            </p>
          </div>
          <button type="button" disabled={running !== null} onClick={() => void play('CLASE_EN_CURSO')} className="rounded-lg bg-night px-3.5 py-2 text-sm font-medium text-night-text disabled:opacity-60">
            Disparar Clase en curso (AULA-301)
          </button>
        </div>
        <div className="overflow-hidden rounded-2xl bg-night">
          <div className="aspect-[1000/600] w-full" role="img" aria-label={`Mapa de la arquitectura hexagonal, paso ${Math.max(0, progress)} de ${total}`}>
            <HexagonFlow trace={trace} progress={progress} mode={gateway.mode} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-1" role="group" aria-label="Control del recorrido">
            <IconButton label="Paso anterior" onClick={() => step(-1)} disabled={progress === 0}><SkipBack className="h-4 w-4" /></IconButton>
            <IconButton label={paused ? 'Reanudar' : 'Pausar'} onClick={() => setPaused((p) => !p)}>{paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}</IconButton>
            <IconButton label="Paso siguiente" onClick={() => step(1)} disabled={progress >= total}><SkipForward className="h-4 w-4" /></IconButton>
            <IconButton label="Repetir" onClick={() => { setProgress(0); setPaused(false); }}><RotateCcw className="h-4 w-4" /></IconButton>
            <span className="ml-2 text-sm tabular-nums text-ink-soft">Paso {Math.max(0, progress)} de {total}</span>
            <span className="ml-3 hidden items-center gap-1 text-sm text-ink-soft lg:flex"><Kbd>Espacio</Kbd> pausa, <Kbd>←</Kbd><Kbd>→</Kbd> paso a paso</span>
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-soft" aria-label="Anillos de la arquitectura">
            <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#8fbccd]" />Adaptadores</li>
            <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#a8d4c4]" />Puertos</li>
            <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#cdb4f5]" />Casos de uso</li>
            <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#f2c14e]" />Dominio</li>
          </ul>
        </div>
        <p className="sr-only" aria-live="polite">
          {currentStep ? `Paso ${progress} de ${total}: ${LAYER_META[currentStep.layer].label}, ${currentStep.component}` : ''}
        </p>
      </section>

      <aside className="min-w-0">
        {trace ? (
          <>
            <h2 className="lettering text-lg font-semibold">Recorrido del evento</h2>
            <p className="mt-0.5 text-sm text-ink-soft">{trace.trigger}, espacio {trace.spaceId}, {time.format(Date.parse(trace.startedAt))}</p>
            <ol className="mt-4 space-y-1 border-l border-rule pl-4">
              {trace.steps.map((s, index) => {
                const reached = index < progress;
                const isCurrent = index === currentIndex;
                const unmapped = path[index] === null;
                return (
                  <li key={`${s.component}-${index}`} className={`relative rounded-lg px-2 py-1.5 transition-colors ${isCurrent ? 'bg-sheet ring-1 ring-st-optimo/40' : ''} ${reached ? '' : 'opacity-55'}`}>
                    <span className={`absolute -left-[23px] top-3 h-2.5 w-2.5 rounded-full border-2 ${reached ? 'border-paper bg-st-optimo' : 'border-st-optimo bg-paper'}`} />
                    <p className="text-xs text-ink-soft">{index + 1}. {LAYER_META[s.layer].label}{unmapped ? ' (fuera del mapa)' : ''}</p>
                    <p className="text-[15px] font-medium [overflow-wrap:anywhere]">{s.component}</p>
                    {s.detail && <p className="text-sm text-ink-soft [overflow-wrap:anywhere]">{s.detail}</p>}
                  </li>
                );
              })}
            </ol>
          </>
        ) : (
          <p className="text-sm text-ink-soft">Aún no hay eventos. Dispara un escenario para ver el recorrido.</p>
        )}

        <div className="mt-8 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Eventos recientes</h3>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
            <input type="checkbox" checked={hidePeriodic} onChange={(event) => setHidePeriodic(event.target.checked)} className="h-4 w-4 accent-[var(--color-night)]" />
            Ocultar telemetría periódica
          </label>
        </div>
        <ul className="mt-2 max-h-64 divide-y divide-rule overflow-y-auto rounded-xl border border-rule bg-sheet text-sm">
          {recent.map((t) => (
            <li key={t.traceId}>
              <button type="button" onClick={() => { setPinned(t.traceId); setPaused(false); }}
                aria-current={t.traceId === trace?.traceId ? 'true' : undefined}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-white ${t.traceId === trace?.traceId ? 'bg-white font-medium' : ''}`}>
                <span className="tabular-nums text-ink-soft">{time.format(Date.parse(t.startedAt))}</span>
                <span className="flex-1 truncate">{t.trigger}</span>
                <span className="condensed text-ink-soft">{t.spaceId}</span>
              </button>
            </li>
          ))}
          {recent.length === 0 && <li className="px-3 py-3 text-ink-soft">Sin escenarios todavía. Desmarca el filtro para ver la telemetría de cada frame.</li>}
        </ul>
      </aside>
    </div>
  );
}

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled}
      className="grid h-9 w-9 place-items-center rounded-lg border border-rule bg-sheet text-ink hover:bg-white disabled:opacity-40">
      {children}
    </button>
  );
}
