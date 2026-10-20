import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTwin } from '../application/TwinContext';
import type { SimulationScenario } from '../domain/model';
import type { ArchitectureTrace, HvacControlState, ScenarioInfo } from '../domain/model';
import { summarizeOutcome, type ScenarioOutcome } from './outcome';
import { SCENARIO_STAGE, type ViewId } from './scenarioPlaybook';

const PRESENTATION_KEY = 'campusnexo.presentation';

function readPresentation(): boolean {
  try {
    return localStorage.getItem(PRESENTATION_KEY) !== 'off';
  } catch {
    return true;
  }
}

interface StageValue {
  /** Space shown in the twin detail and in the camera, shared so a scenario can focus it. */
  selectedSpace: string;
  selectSpace: (spaceId: string) => void;
  /** When on, a scenario takes the audience to the view where its effect shows. */
  presentation: boolean;
  setPresentation: (on: boolean) => void;
  outcome: ScenarioOutcome | null;
  dismissOutcome: () => void;
  running: SimulationScenario | null;
  play: (scenario: SimulationScenario) => Promise<void>;
  /** Space whose block pulses on the map right after a scenario. */
  pulseSpace: string | null;
  /** Last space a scenario targeted; the serial changes on every run so views can follow it. */
  focus: { spaceId: string; serial: number } | null;
}

const StageContextInstance = createContext<StageValue | null>(null);

export function navigate(view: ViewId) {
  if (location.hash !== `#/${view}`) location.hash = `#/${view}`;
}

/** UI choreography of the live defense, on top of the application's runScenario use case. */
export function StageProvider({ children }: { children: ReactNode }) {
  const { scenarios, runScenario, gateway, twin } = useTwin();
  const [selectedSpace, setSelectedSpace] = useState('AULA-301');
  const [presentation, setPresentationState] = useState(readPresentation);
  const [played, setPlayed] = useState<{ id: number; scenario: SimulationScenario; info?: ScenarioInfo; trace: ArchitectureTrace | null; target: string | null; hvacBefore: HvacControlState | null } | null>(null);
  const [running, setRunning] = useState<SimulationScenario | null>(null);
  const [pulseSpace, setPulseSpace] = useState<string | null>(null);
  const [focus, setFocus] = useState<StageValue['focus']>(null);
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const setPresentation = useCallback((on: boolean) => {
    setPresentationState(on);
    try {
      localStorage.setItem(PRESENTATION_KEY, on ? 'on' : 'off');
    } catch {
      /* Private mode: the choice only lasts for this visit. */
    }
  }, []);

  const play = useCallback(async (scenario: SimulationScenario) => {
    if (running) return;
    const info = scenarios.find((s) => s.scenario === scenario);
    const target = info?.spaceId && info.spaceId !== '*' ? info.spaceId : null;
    if (target) {
      setSelectedSpace(target);
      setFocus((current) => ({ spaceId: target, serial: (current?.serial ?? 0) + 1 }));
    }
    const view = SCENARIO_STAGE[scenario].view;
    if (presentation && view) navigate(view);
    const hvacBefore = target ? gateway.getSnapshot().twins.find((t) => t.space.spaceId === target)?.state.hvacState ?? null : null;
    setRunning(scenario);
    const trace = await runScenario(scenario);
    setRunning(null);
    setPlayed((current) => ({ id: (current?.id ?? 0) + 1, scenario, info, trace, target, hvacBefore }));
    if (target) {
      clearTimeout(pulseTimer.current);
      setPulseSpace(target);
      pulseTimer.current = setTimeout(() => setPulseSpace(null), 4_000);
    }
  }, [running, scenarios, presentation, runScenario, gateway]);

  const liveTwin = played?.target ? twin(played.target) : undefined;
  const outcome = played ? { ...summarizeOutcome(played.scenario, played.info, played.trace, liveTwin, played.hvacBefore), id: String(played.id) } : null;

  useEffect(() => () => clearTimeout(pulseTimer.current), []);

  const value = useMemo<StageValue>(() => ({
    selectedSpace,
    selectSpace: setSelectedSpace,
    presentation,
    setPresentation,
    outcome,
    dismissOutcome: () => setPlayed(null),
    running,
    play,
    pulseSpace,
    focus,
  }), [selectedSpace, presentation, setPresentation, outcome, running, play, pulseSpace, focus]);

  return <StageContextInstance.Provider value={value}>{children}</StageContextInstance.Provider>;
}

export function useStage(): StageValue {
  const value = useContext(StageContextInstance);
  if (!value) throw new Error('useStage debe usarse dentro de StageProvider');
  return value;
}
