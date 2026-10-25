import { ShieldCheck } from 'lucide-react';
import { useState, type ComponentType } from 'react';
import { Espacios } from '../components/admin/Espacios';
import { HerramientasIa } from '../components/admin/HerramientasIa';
import { Personas } from '../components/admin/Personas';
import { Puestos } from '../components/admin/Puestos';

const TABS: { id: string; label: string; component: ComponentType }[] = [
  { id: 'puestos', label: 'Puestos de trabajo', component: Puestos },
  { id: 'salones', label: 'Salones', component: Espacios },
  { id: 'personas', label: 'Docentes y estudiantes', component: Personas },
  { id: 'ia', label: 'Herramientas de IA', component: HerramientasIa },
];

/**
 * What only the university administration manages. The backend checks the ADMIN role and that the request
 * comes from the administration network (the WireGuard VPN); outside it every action answers with a notice.
 */
export function AdminView() {
  const [tab, setTab] = useState(TABS[0]!.id);
  const Active = TABS.find((t) => t.id === tab)!.component;
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 tabIndex={-1} className="lettering text-2xl font-semibold">Administración</h1>
        <p className="mt-1 flex max-w-[72ch] items-start gap-1.5 text-sm text-ink-soft">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          Inventario de puestos, medidas de los salones, personas y herramientas de IA. Solo responde a administradores conectados a la VPN de la universidad.
        </p>
      </div>
      <div role="tablist" aria-label="Secciones" className="flex w-fit flex-wrap gap-1 rounded-xl border border-rule bg-sheet p-1 text-sm">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${tab === t.id ? 'bg-night text-night-text' : 'text-ink-soft hover:text-ink'}`}>
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel"><Active /></div>
    </div>
  );
}
