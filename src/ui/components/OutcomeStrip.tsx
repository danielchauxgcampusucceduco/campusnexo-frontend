import { ArrowRight, Route, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTwin } from '../../application/TwinContext';
import { SCENARIO_STAGE } from '../scenarioPlaybook';
import { useStage } from '../StageContext';

/**
 * The one sentence a scenario has to say, at a size that reads from the back of the room:
 * what was measured, what the domain decided and what the actuators did.
 */
export function OutcomeStrip() {
  const { outcome, dismissOutcome, running } = useStage();
  const { scenarios } = useTwin();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (outcome) ref.current?.animate(
      [{ opacity: 0, transform: 'translateY(-6px)', filter: 'blur(2px)' }, { opacity: 1, transform: 'none', filter: 'none' }],
      { duration: 420, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
    );
  }, [outcome?.id]);

  if (running) {
    const info = scenarios.find((s) => s.scenario === running);
    return (
      <div className="mb-5 rounded-2xl border border-rule bg-sheet px-5 py-4" role="status">
        <p className="text-sm text-ink-soft">Ejecutando {SCENARIO_STAGE[running].label}{info && info.spaceId !== '*' ? ` en ${info.spaceId}` : ''}…</p>
        {info && <p className="mt-1 text-xl font-semibold">{info.description}</p>}
      </div>
    );
  }
  if (!outcome) return null;

  return (
    <div ref={ref} role="status" aria-live="polite" className="mb-5 rounded-2xl border border-rule bg-sheet px-5 py-3">
      <div className="flex items-center gap-3">
        <p className="lettering text-base font-semibold">{outcome.spaceName}</p>
        {outcome.spaceId !== '*' && <p className="condensed text-sm text-ink-soft">{outcome.spaceId}</p>}
        <div className="ml-auto flex items-center gap-1">
          {outcome.traceId && (
            <a href="#/funciona" className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-st-optimo-ink hover:bg-white">
              <Route className="h-4 w-4" /> Ver recorrido
            </a>
          )}
          <button type="button" onClick={dismissOutcome} className="rounded-lg p-1.5 text-ink-soft hover:bg-white hover:text-ink" aria-label="Cerrar resumen del escenario">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <ol className="mt-1 grid gap-x-4 gap-y-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] md:items-start">
        <Stage title="Causa" text={outcome.cause} detail={outcome.causeDetail} />
        <Arrow />
        <Stage title="Decisión" text={outcome.decision} detail={outcome.decisionRule} color={outcome.decisionColor} />
        <Arrow />
        <Stage title="Efecto" text={outcome.effect} detail={outcome.effectDetail} />
      </ol>
    </div>
  );
}

function Stage({ title, text, detail, color }: { title: string; text: string; detail: string | null; color?: string | null }) {
  return (
    <li className="min-w-0">
      <p className="text-sm text-ink-soft">{title}</p>
      <p className="text-xl font-semibold leading-tight [text-wrap:balance]" style={color ? { color } : undefined}>{text}</p>
      {detail && <p className="mt-0.5 text-sm text-ink-soft [overflow-wrap:anywhere]">{detail}</p>}
    </li>
  );
}

function Arrow() {
  return (
    <li aria-hidden className="hidden pt-7 text-ink-soft md:block">
      <ArrowRight className="h-6 w-6" />
    </li>
  );
}
