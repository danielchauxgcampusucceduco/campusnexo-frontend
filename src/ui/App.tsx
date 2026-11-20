import { BellRing, BookOpen, CalendarClock, Map, ScanEye, ShieldCheck, Workflow } from 'lucide-react';
import { lazy, Suspense, useEffect, useRef, useState, type ComponentType } from 'react';
import { useTwin } from '../application/TwinContext';
import type { GatewayCapabilities } from '../ports/TwinGateway';
import { DataSourceBanner } from './components/DataSourceBanner';
import { Notices } from './components/Notices';
import { Kbd, ScenarioDock } from './components/ScenarioDock';
import { TopBar } from './components/TopBar';
import { VIEW_KEYS, type ViewId } from './scenarioPlaybook';
import { navigate, parseRoute, StageProvider } from './StageContext';

// One chunk per view (P1): charts, the plan and the admin tools load when their view opens.
const AdminView = lazy(() => import('./views/AdminView').then((m) => ({ default: m.AdminView })));
const AlertsView = lazy(() => import('./views/AlertsView').then((m) => ({ default: m.AlertsView })));
const CampusView = lazy(() => import('./views/CampusView').then((m) => ({ default: m.CampusView })));
const DisponibilidadView = lazy(() => import('./views/DisponibilidadView').then((m) => ({ default: m.DisponibilidadView })));
const HowItWorksView = lazy(() => import('./views/HowItWorksView').then((m) => ({ default: m.HowItWorksView })));
const LibraryView = lazy(() => import('./views/LibraryView').then((m) => ({ default: m.LibraryView })));
const SimulacionView = lazy(() => import('./views/SimulacionView').then((m) => ({ default: m.SimulacionView })));

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
  { id: 'disponibilidad', label: 'Disponibilidad', icon: CalendarClock, component: DisponibilidadView },
  { id: 'simulacion', label: 'Simulación', icon: ScanEye, component: SimulacionView },
  { id: 'biblioteca', label: 'Biblioteca', icon: BookOpen, component: LibraryView },
  { id: 'alertas', label: 'Alertas', icon: BellRing, component: AlertsView, requires: 'operations' },
  { id: 'admin', label: 'Administración', icon: ShieldCheck, component: AdminView, requires: 'administration' },
  { id: 'funciona', label: 'Cómo funciona', icon: Workflow, component: HowItWorksView },
];

/** The view of the address, `campus` for an empty one, or null for a route that does not exist. */
function viewFromHash(views: View[]): ViewId | null {
  const { view } = parseRoute(location.hash);
  if (!view) return 'campus';
  return views.find((v) => v.id === view)?.id ?? null;
}

/** An address that names no view: say so and offer the way back, instead of showing the campus under a wrong URL. */
function NotFound() {
  return (
    <section aria-labelledby="notfound-title" className="max-w-[60ch]">
      <h1 id="notfound-title" tabIndex={-1} className="lettering text-2xl font-semibold">Página no encontrada</h1>
      <p className="mt-2 text-sm text-ink-soft">La dirección <code className="rounded bg-sheet px-1">{location.hash || '/'}</code> no corresponde a ninguna sección del tablero.</p>
      <a href="#/campus" className="mt-4 inline-block rounded-lg bg-night px-3 py-2 text-sm font-medium text-night-text">Volver al campus en vivo</a>
    </section>
  );
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
  const [view, setView] = useState<ViewId | null>(() => viewFromHash(views));
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

  const Active = views.find((v) => v.id === view)?.component ?? NotFound;

  return (
    <div className="flex min-h-screen flex-col">
      {/* Skip link (WCAG 2.4.1). The address carries the route (#/…), so it moves the focus instead of the hash. */}
      <a href="#contenido" onClick={(event) => { event.preventDefault(); main.current?.focus(); }}
        className="sr-only z-50 rounded-lg bg-night px-3 py-2 text-sm font-medium text-night-text focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Saltar al contenido
      </a>
      <TopBar />
      <DataSourceBanner />
      <div className="flex flex-1 flex-col md:flex-row">
        <div className="shrink-0 border-b border-rule md:sticky md:top-14 md:flex md:h-[calc(100vh-3.5rem)] md:w-[212px] md:flex-col md:gap-5 md:overflow-y-auto md:border-b-0 md:border-r md:px-3 md:py-4">
          {/* On narrow screens the tabs scroll sideways without a visible bar; a fade on the right says there are more (U8). */}
          <nav ref={nav} aria-label="Vistas" className="scrollbar-none flex gap-1 overflow-x-auto px-3 py-2 [mask-image:linear-gradient(to_right,black_85%,transparent)] md:flex-col md:overflow-visible md:p-0 md:[mask-image:none]">
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
        <main ref={main} id="contenido" tabIndex={-1} className="min-w-0 flex-1 outline-none px-4 py-5 md:px-7 md:py-6 [&_h1]:outline-none">
          <Suspense fallback={<p className="text-sm text-ink-soft">Cargando la vista…</p>}>
            <Active />
          </Suspense>
        </main>
      </div>
      <div className="sticky bottom-0 z-30 border-t border-rule bg-sheet/95 backdrop-blur md:hidden">
        {/* Folded by default on a phone (U2): one line that opens the strip. */}
        <details>
          <summary className="cursor-pointer list-none px-3 py-1.5 text-xs font-semibold text-ink">Reconocido ahora ▴</summary>
          <ScenarioDock layout="bar" />
        </details>
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
