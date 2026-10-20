import { BookOpen, Boxes, Cctv, Hexagon, Leaf } from 'lucide-react';
import { useEffect, useState, type ComponentType } from 'react';
import { Notices } from './components/Notices';
import { ScenarioDock } from './components/ScenarioDock';
import { TopBar } from './components/TopBar';
import { ArchitectureView } from './views/ArchitectureView';
import { DigitalTwinView } from './views/DigitalTwinView';
import { EdgeVisionView } from './views/EdgeVisionView';
import { EnergyView } from './views/EnergyView';
import { LibraryView } from './views/LibraryView';

type ViewId = 'camara' | 'gemelo' | 'biblioteca' | 'arquitectura' | 'energia';

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

export function App() {
  const [view, setView] = useState<ViewId>(viewFromHash);
  useEffect(() => {
    const onHash = () => setView(viewFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const Active = VIEWS.find((v) => v.id === view)!.component;

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <div className="flex flex-1 flex-col md:flex-row">
        <nav aria-label="Vistas" className="flex shrink-0 gap-1 overflow-x-auto border-b border-rule px-3 py-2 md:w-[184px] md:flex-col md:border-b-0 md:border-r md:px-3 md:py-5">
          {VIEWS.map(({ id, label, icon: Icon }) => {
            const active = id === view;
            return (
              <a
                key={id}
                href={`#/${id}`}
                aria-current={active ? 'page' : undefined}
                className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${active ? 'bg-night text-night-text' : 'text-ink-soft hover:bg-sheet hover:text-ink'}`}
              >
                <Icon className={`h-4 w-4 ${active ? 'text-signal' : ''}`} />
                {label}
              </a>
            );
          })}
        </nav>
        <main className="min-w-0 flex-1 px-4 py-5 md:px-7 md:py-6">
          <Active />
        </main>
      </div>
      <div className="sticky bottom-0 z-30">
        <ScenarioDock />
      </div>
      <Notices />
    </div>
  );
}
