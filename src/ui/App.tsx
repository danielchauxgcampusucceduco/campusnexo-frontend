import { BellRing, BookOpen, Cctv, Leaf, Map, ShieldCheck, Workflow } from 'lucide-react';
import { useEffect, useRef, useState, type ComponentType } from 'react';
import { useTwin } from '../application/TwinContext';
import type { GatewayCapabilities } from '../ports/TwinGateway';
import { DataSourceBanner } from './components/DataSourceBanner';
import { Notices } from './components/Notices';
import { Kbd, ScenarioDock } from './components/ScenarioDock';
import { TopBar } from './components/TopBar';
import { VIEW_KEYS, type ViewId } from './scenarioPlaybook';
import { navigate, StageProvider } from './StageContext';
import { AdminView } from './views/AdminView';
import { AlertsView } from './views/AlertsView';
import { CampusView } from './views/CampusView';
import { EnergyView } from './views/EnergyView';
import { HowItWorksView } from './views/HowItWorksView';
import { LibraryView } from './views/LibraryView';
import { SalonView } from './views/SalonView';

interface View {
  id: ViewId;
  label: string;
  icon: ComponentType<{ className?: string }>;
  component: ComponentType;
  /** Shown only to the roles that can use it. */
  requires?: keyof GatewayCapabilities;
}

const VIEWS: View[] = [
  { id: 'campus', label: 'Campus en vivo', icon: Map, component: CampusView },
  { id: 'salon', label: 'Salón', icon: Cctv, component: SalonView },
  { id: 'biblioteca', label: 'Biblioteca', icon: BookOpen, component: LibraryView },
  { id: 'alertas', label: 'Alertas', icon: BellRing, component: AlertsView, requires: 'operations' },
  { id: 'admin', label: 'Administración', icon: ShieldCheck, component: AdminView, requires: 'administration' },
  { id: 'energia', label: 'Ahorro de energía', icon: Leaf, component: EnergyView },
  { id: 'funciona', label: 'Cómo funciona', icon: Workflow, component: HowItWorksView },
];

function viewFromHash(views: View[]): ViewId {
  const id = location.hash.replace('#/', '') as ViewId;
  return views.some((view) => view.id === id) ? id : 'campus';
}

function typingInto(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName));
}

/** One key per view. */
function useShortcuts(views: View[]) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || typingInto(event.target)) return;
      const view = views.find((v) => VIEW_KEYS[v.id] === event.key.toUpperCase());
      if (view) {
        event.preventDefault();
        navigate(view.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [views]);
}

function Shell() {
  const { gateway } = useTwin();
  const [views] = useState(() => VIEWS.filter((v) => !v.requires || gateway.capabilities[v.requires]));
  const [view, setView] = useState<ViewId>(() => viewFromHash(views));
  const main = useRef<HTMLElement>(null);
  const nav = useRef<HTMLElement>(null);
  const firstRender = useRef(true);
  useShortcuts(views);

  useEffect(() => {
    const onHash = () => setView(viewFromHash(views));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [views]);

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

  const Active = views.find((v) => v.id === view)!.component;

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <DataSourceBanner />
      <div className="flex flex-1 flex-col md:flex-row">
        <div className="shrink-0 border-b border-rule md:sticky md:top-14 md:flex md:h-[calc(100vh-3.5rem)] md:w-[212px] md:flex-col md:gap-5 md:overflow-y-auto md:border-b-0 md:border-r md:px-3 md:py-4">
          <nav ref={nav} aria-label="Vistas" className="flex gap-1 overflow-x-auto px-3 py-2 md:flex-col md:overflow-visible md:p-0">
            {views.map(({ id, label, icon: Icon }) => {
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
        <main ref={main} className="min-w-0 flex-1 px-4 py-5 md:px-7 md:py-6 [&_h1]:outline-none">
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
