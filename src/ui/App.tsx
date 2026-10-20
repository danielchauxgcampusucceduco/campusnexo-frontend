import { BookOpen, Boxes, Cctv, Hexagon, Leaf } from 'lucide-react';
import { useEffect, useRef, useState, type ComponentType } from 'react';
import { useTwin } from '../application/TwinContext';
import { SIMULATION_SCENARIOS } from '../domain/model';
import { Notices } from './components/Notices';
import { OutcomeStrip } from './components/OutcomeStrip';
import { Kbd, ScenarioDock } from './components/ScenarioDock';
import { TopBar } from './components/TopBar';
import { SCENARIO_STAGE, VIEW_KEYS, type ViewId } from './scenarioPlaybook';
import { navigate, StageProvider, useStage } from './StageContext';
import { ArchitectureView } from './views/ArchitectureView';
import { DigitalTwinView } from './views/DigitalTwinView';
import { EdgeVisionView } from './views/EdgeVisionView';
import { EnergyView } from './views/EnergyView';
import { LibraryView } from './views/LibraryView';

const VIEWS: { id: ViewId; label: string; icon: ComponentType<{ className?: string }>; component: ComponentType }[] = [
  { id: 'gemelo', label: 'Gemelo 2.5D', icon: Boxes, component: DigitalTwinView },
  { id: 'camara', label: 'Cámara edge', icon: Cctv, component: EdgeVisionView },
  { id: 'biblioteca', label: 'Biblioteca', icon: BookOpen, component: LibraryView },
  { id: 'arquitectura', label: 'Arquitectura', icon: Hexagon, component: ArchitectureView },
  { id: 'energia', label: 'Energía', icon: Leaf, component: EnergyView },
];

function viewFromHash(): ViewId {
  const id = location.hash.replace('#/', '') as ViewId;
  return VIEWS.some((view) => view.id === id) ? id : 'gemelo';
}

function typingInto(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName));
}

/** Presenter shortcuts: one key per scenario and per view, P for presentation mode. */
function useShortcuts() {
  const { scenarios } = useTwin();
  const { play, presentation, setPresentation } = useStage();
  useEffect(() => {
    const available = new Set(scenarios.map((s) => s.scenario));
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || typingInto(event.target)) return;
      const key = event.key.toUpperCase();
      const scenario = SIMULATION_SCENARIOS.find((s) => SCENARIO_STAGE[s].key === key && available.has(s));
      const view = (Object.keys(VIEW_KEYS) as ViewId[]).find((v) => VIEW_KEYS[v] === key);
      if (scenario) {
        event.preventDefault();
        void play(scenario);
      } else if (view) {
        event.preventDefault();
        navigate(view);
      } else if (key === 'P') {
        event.preventDefault();
        setPresentation(!presentation);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [scenarios, play, presentation, setPresentation]);
}

function Shell() {
  const [view, setView] = useState<ViewId>(viewFromHash);
  const main = useRef<HTMLElement>(null);
  const nav = useRef<HTMLElement>(null);
  const firstRender = useRef(true);
  const { presentation } = useStage();
  useShortcuts();

  useEffect(() => {
    const onHash = () => setView(viewFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // On a route change, move focus to the new heading (screen readers announce it) and keep the
  // active tab visible in the horizontal nav on small screens.
  useEffect(() => {
    nav.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    main.current?.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
  }, [view]);

  const Active = VIEWS.find((v) => v.id === view)!.component;

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <div className="flex flex-1 flex-col md:flex-row">
        <div className="shrink-0 border-b border-rule md:sticky md:top-14 md:flex md:h-[calc(100vh-3.5rem)] md:w-[212px] md:flex-col md:gap-5 md:overflow-y-auto md:border-b-0 md:border-r md:px-3 md:py-4">
          <nav ref={nav} aria-label="Vistas" className="flex gap-1 overflow-x-auto px-3 py-2 md:flex-col md:overflow-visible md:p-0">
            {VIEWS.map(({ id, label, icon: Icon }) => {
              const active = id === view;
              return (
                <a
                  key={id}
                  href={`#/${id}`}
                  aria-current={active ? 'page' : undefined}
                  aria-keyshortcuts={VIEW_KEYS[id]}
                  className={`flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm transition-colors ${active ? 'bg-night text-night-text' : 'text-ink-soft hover:bg-sheet hover:text-ink'}`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-signal' : ''}`} />
                  {label}
                  <span className="ml-auto hidden md:inline-flex"><Kbd dark={active}>{VIEW_KEYS[id]}</Kbd></span>
                </a>
              );
            })}
          </nav>
          <div className="hidden border-t border-rule pt-4 md:block">
            <ScenarioDock layout="rail" />
          </div>
        </div>
        <main ref={main} data-presentation={presentation ? '' : undefined} className="min-w-0 flex-1 px-4 py-5 md:px-7 md:py-6 [&_h1]:outline-none">
          <OutcomeStrip />
          <Active />
        </main>
      </div>
      <div className="sticky bottom-0 z-30 border-t border-rule bg-sheet/95 backdrop-blur md:hidden">
        <ScenarioDock layout="bar" />
      </div>
      <Notices />
    </div>
  );
}

export function App() {
  return (
    <StageProvider>
      <Shell />
    </StageProvider>
  );
}
