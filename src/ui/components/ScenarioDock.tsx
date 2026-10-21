import { Presentation, RotateCcw } from 'lucide-react';
import { useTwin } from '../../application/TwinContext';
import type { SimulationScenario } from '../../domain/model';
import { useStage } from '../StageContext';
import { SCENARIO_GROUPS, SCENARIO_STAGE } from '../scenarioPlaybook';

export function Kbd({ children, dark }: { children: string; dark?: boolean }) {
  return (
    <kbd className={`inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded border px-1 font-sans text-xs font-semibold ${dark ? 'border-night-line text-night-text' : 'border-rule bg-sheet text-ink-soft'}`}>
      {children}
    </kbd>
  );
}

/**
 * Live defense scenarios, grouped by what they demonstrate. Each one goes through the same use case
 * as real telemetry; the key on each button fires it without leaving the narration.
 * `rail` stacks them in the side column (desktop); `bar` is a scrolling strip for small screens.
 */
export function ScenarioDock({ layout }: { layout: 'rail' | 'bar' }) {
  const { scenarios, gateway } = useTwin();
  const { play, running, presentation, setPresentation } = useStage();
  if (scenarios.length === 0) {
    return <p className="px-3 py-3 text-sm text-ink-soft">Las demostraciones están apagadas en este servidor.</p>;
  }
  const allowed = gateway.capabilities.scenarios;
  const available = new Map(scenarios.map((s) => [s.scenario, s]));
  const rail = layout === 'rail';

  const button = (scenario: SimulationScenario) => {
    const stage = SCENARIO_STAGE[scenario];
    const reset = scenario === 'REINICIAR';
    const active = running === scenario;
    const info = available.get(scenario);
    return (
      <button
        key={scenario}
        type="button"
        disabled={running !== null || !allowed}
        aria-keyshortcuts={stage.key}
        title={!allowed ? 'Solo un administrador puede ejecutar las demostraciones'
          : info ? `${info.description}${info.spaceId !== '*' ? ` (${info.spaceId})` : ''}` : undefined}
        onClick={() => void play(scenario)}
        className={`flex shrink-0 items-center gap-2 rounded-lg px-2 py-1 text-left text-sm transition-colors disabled:cursor-not-allowed ${rail ? 'w-full' : 'border border-rule bg-paper'} ${active ? 'bg-white text-ink ring-1 ring-st-optimo' : 'text-ink hover:bg-white'} ${running !== null && !active ? 'opacity-55' : ''}`}
      >
        <Kbd>{stage.key}</Kbd>
        {reset && <RotateCcw className="h-3.5 w-3.5 text-ink-soft" />}
        <span className={`truncate ${reset ? 'text-ink-soft' : 'font-medium'}`}>{stage.label}</span>
        {active && <span className="ml-auto h-2 w-2 shrink-0 animate-pulse rounded-full bg-st-optimo" aria-hidden />}
      </button>
    );
  };

  return (
    <div aria-label="Escenarios de sustentación" role="navigation" className={rail ? 'flex flex-col gap-3 [@media(max-height:780px)]:gap-2' : 'flex items-center gap-3 overflow-x-auto px-3 py-2'}>
      {!allowed && <p className="px-2 text-xs text-ink-soft">Tu rol permite ver; las demostraciones las ejecuta un administrador.</p>}
      {SCENARIO_GROUPS.map((group) => {
        const items = group.scenarios.filter((s) => available.has(s));
        if (items.length === 0) return null;
        return (
          <div key={group.title} role="group" aria-label={group.title} className={rail ? 'flex flex-col gap-0.5' : 'flex shrink-0 items-center gap-1.5'}>
            <span className={`text-xs font-medium text-ink-soft ${rail ? 'px-2 pb-0.5 [@media(max-height:780px)]:sr-only' : 'shrink-0'}`}>{group.title}</span>
            {items.map(button)}
          </div>
        );
      })}
      <div className={rail ? 'flex flex-col gap-1 border-t border-rule pt-3' : 'flex shrink-0 items-center gap-2'}>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white" title="Cada escenario lleva la pantalla a la vista donde se ve su efecto y oculta los textos de introducción">
          <input type="checkbox" checked={presentation} onChange={(event) => setPresentation(event.target.checked)} className="h-4 w-4 shrink-0 accent-[var(--color-night)]" />
          <Presentation className="h-4 w-4 shrink-0 text-ink-soft" />
          <span className="truncate">Presentación</span>
          <span className="ml-auto"><Kbd>P</Kbd></span>
        </label>
        {available.has('REINICIAR') && button('REINICIAR')}
      </div>
    </div>
  );
}
