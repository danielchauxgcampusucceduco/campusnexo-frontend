import { useTwin } from '../../application/TwinContext';
import { ESCENARIOS_OPERATIVOS, type EscenarioOperativo } from '../../domain/model';
import { ESCENARIO_META } from '../scenarioPlaybook';
import { navigate, useStage } from '../StageContext';

export function Kbd({ children, dark }: { children: string; dark?: boolean }) {
  return (
    <kbd className={`inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded border px-1 font-sans text-xs font-semibold ${dark ? 'border-night-line text-night-text' : 'border-rule bg-sheet text-ink-soft'}`}>
      {children}
    </kbd>
  );
}

/** Scenario → rooms where the backend recognizes it right now. */
export function activeScenarios(twins: { space: { spaceId: string }; state: { escenarios: { escenario: EscenarioOperativo }[] } }[]) {
  const rooms = new Map<EscenarioOperativo, string[]>();
  for (const twin of twins) {
    for (const { escenario } of twin.state.escenarios) rooms.set(escenario, [...(rooms.get(escenario) ?? []), twin.space.spaceId]);
  }
  return ESCENARIOS_OPERATIVOS.filter((e) => rooms.has(e)).map((escenario) => ({ escenario, rooms: rooms.get(escenario)! }));
}

/**
 * The operational scenarios the backend recognizes right now, read from the live twin. Nothing here triggers a
 * scenario: they appear when the rooms are in that situation. A room opens its view.
 * `rail` stacks them in the side column (desktop); `bar` is a scrolling strip for small screens.
 */
export function ScenarioDock({ layout }: { layout: 'rail' | 'bar' }) {
  const { snapshot } = useTwin();
  const { selectSpace } = useStage();
  const active = activeScenarios(snapshot.twins);
  const rail = layout === 'rail';
  const open = (escenario: EscenarioOperativo, spaceId: string) => {
    selectSpace(spaceId);
    navigate(ESCENARIO_META[escenario].view);
  };

  return (
    <section aria-label="Escenarios reconocidos ahora" className={rail ? 'flex flex-col gap-2' : 'flex items-center gap-3 overflow-x-auto px-3 py-2'}>
      <h2 className={`text-xs font-semibold text-ink-soft ${rail ? 'px-2' : 'shrink-0'}`}>Reconocido ahora</h2>
      {active.length === 0 && <p className="px-2 text-xs text-ink-soft">Ningún escenario en curso.</p>}
      <ul className={rail ? 'flex flex-col gap-1.5' : 'flex shrink-0 items-center gap-2'}>
        {active.map(({ escenario, rooms }) => {
          const meta = ESCENARIO_META[escenario];
          return (
            <li key={escenario} className={`rounded-lg border px-2 py-1.5 text-sm ${meta.attention ? 'border-st-subutilizado/60 bg-[color-mix(in_oklab,var(--color-st-subutilizado)_12%,transparent)]' : 'border-rule bg-sheet'}`}>
              <p className="font-medium">{meta.label}</p>
              <p className="mt-0.5 flex flex-wrap gap-1">
                {rooms.slice(0, 6).map((spaceId) => (
                  <button key={spaceId} type="button" onClick={() => open(escenario, spaceId)}
                    className="condensed rounded bg-white/70 px-1.5 text-xs text-ink hover:bg-white hover:underline">{spaceId}</button>
                ))}
                {rooms.length > 6 && <span className="text-xs text-ink-soft">+{rooms.length - 6}</span>}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
