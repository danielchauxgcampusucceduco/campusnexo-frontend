import { Play, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { useTwin } from '../../application/TwinContext';
import type { SimulationScenario } from '../../domain/model';

const SHORT_LABEL: Record<SimulationScenario, string> = {
  CLASE_EN_CURSO: 'Clase en curso',
  CO2_ALTO: 'CO₂ alto',
  FALLO_CAMARA: 'Falla la cámara',
  NO_SHOW: 'No-show',
  PRE_ENFRIAMIENTO: 'Pre-enfriamiento',
  OVERRIDE_DOCENTE: 'Control docente',
  SOBRECUPO: 'Sobrecupo',
  MANTENIMIENTO: 'Mantenimiento',
  SUBUTILIZADO: 'Subutilizado',
  POPUP_PARCIALES: 'Aula pop-up',
  ACAPARAMIENTO_BIBLIOTECA: 'Acaparamiento',
  REINICIAR: 'Reiniciar todo',
};

/** Live defense scenarios. Each button goes through the same use case as real telemetry. */
export function ScenarioDock({ onRun }: { onRun?: (scenario: SimulationScenario) => void }) {
  const { scenarios, runScenario, notify } = useTwin();
  const [running, setRunning] = useState<SimulationScenario | null>(null);
  if (scenarios.length === 0) {
    return <p className="px-4 py-3 text-xs text-ink-soft">El backend tiene los escenarios de simulación deshabilitados.</p>;
  }
  const run = async (scenario: SimulationScenario) => {
    setRunning(scenario);
    const trace = await runScenario(scenario);
    setRunning(null);
    if (trace) notify('info', `${SHORT_LABEL[scenario]}: ${trace.steps.length} pasos por la arquitectura en ${trace.spaceId === '*' ? 'todo el campus' : trace.spaceId}.`);
    onRun?.(scenario);
  };
  return (
    <nav aria-label="Escenarios de sustentación" className="border-t border-rule bg-sheet/90 backdrop-blur">
      <div className="flex items-center gap-2 overflow-x-auto px-4 py-2.5 md:px-6">
        <span className="mr-1 shrink-0 text-xs text-ink-soft">Escenarios</span>
        {scenarios.map(({ scenario, spaceId, description }) => {
          const reset = scenario === 'REINICIAR';
          return (
            <button
              key={scenario}
              type="button"
              title={description}
              disabled={running !== null}
              onClick={() => void run(scenario)}
              className={`group flex shrink-0 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors disabled:opacity-60 ${reset ? 'border-ink/20 text-ink-soft hover:border-ink/40' : 'border-rule bg-paper hover:border-st-optimo/60 hover:bg-white'}`}
            >
              {reset ? <RotateCcw className="h-3.5 w-3.5" /> : <Play className={`h-3 w-3 ${running === scenario ? 'animate-pulse text-st-optimo' : 'text-ink-soft group-hover:text-st-optimo'}`} />}
              <span className="font-medium text-ink">{SHORT_LABEL[scenario]}</span>
              {!reset && <span className="condensed text-[11px] text-ink-soft">{spaceId}</span>}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
