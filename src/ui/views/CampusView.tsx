import { FlaskConical, Lightbulb, Monitor, Thermometer, Users } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useTwin } from '../../application/TwinContext';
import { PLAN_FLOORS, planRoom } from '../../campus/plan';
import { ROOM_CONDITIONS, type TwinSpace } from '../../domain/model';
import { CampusPlan } from '../components/CampusPlan';
import { CountUp } from '../components/CountUp';
import { FloorTower } from '../components/FloorTower';
import { RoomPanel } from '../components/RoomPanel';
import { useStage } from '../StageContext';
import { CONDITION_META } from '../theme';

const BLOCKS = [
  { id: null, label: 'Todo' },
  { id: 'A', label: 'Bloque A' },
  { id: 'B', label: 'Bloque B' },
] as const;

/**
 * The campus as it is right now, on its real floor plans: one floor at a time, every room painted by
 * its state, with the building's floors as a live selector and the selected room's detail beside it.
 */
export function CampusView() {
  const { snapshot, twin } = useTwin();
  const { selectedSpace, selectSpace } = useStage();
  const twins = useMemo(() => new Map(snapshot.twins.map((t) => [t.space.spaceId, t])), [snapshot.twins]);
  const [floor, setFloor] = useState(() => planRoom(selectedSpace)?.floor ?? 4);
  const [block, setBlock] = useState<'A' | 'B' | null>(null);

  const plan = PLAN_FLOORS.find((f) => f.floor === floor) ?? PLAN_FLOORS[0]!;
  const current = twin(selectedSpace);
  const all = snapshot.twins;
  const people = all.reduce((sum, t) => sum + t.state.occupancy, 0);
  const inUse = all.filter((t) => t.state.occupancy > 0).length;
  const lightsWasted = all.filter((t) => t.state.lightsOn && t.state.occupancy === 0).length;
  const computersOn = all.reduce((sum, t) => sum + t.state.devicesOn, 0);
  const occupiedTemps = all.filter((t) => t.state.occupancy > 0);
  const avgTemp = occupiedTemps.length ? occupiedTemps.reduce((s, t) => s + t.state.indoorTemperatureC, 0) / occupiedTemps.length : 0;
  const pilots = all.filter((t) => !planRoom(t.space.spaceId));
  const present = new Set(plan.rooms.map((r) => twins.get(r.spaceId)?.state.condition ?? 'LIBRE'));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 tabIndex={-1} className="lettering text-2xl font-semibold">Campus Pasto en vivo</h1>
          <p className="view-intro mt-1 max-w-[72ch] text-sm text-ink-soft">
            Los planos son los del campus (actualización 2025-B). Cada salón se pinta según lo que ven su cámara y su Arduino: quién está, si las luces y los equipos están encendidos y qué temperatura hace. Toca un salón para ver el detalle.
          </p>
        </div>
        <div role="group" aria-label="Bloque" className="flex rounded-xl border border-rule bg-sheet p-1 text-sm">
          {BLOCKS.map((b) => (
            <button key={b.label} type="button" aria-pressed={block === b.id} onClick={() => setBlock(b.id)}
              className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${block === b.id ? 'bg-night text-night-text' : 'text-ink-soft hover:text-ink'}`}>
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {pilots.length > 0 && <PilotRooms twins={pilots} selected={selectedSpace} onSelect={selectSpace} />}

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={<Users className="h-5 w-5" />} label="Personas en el campus" value={<CountUp value={people} />} note={`${inUse} de ${all.length} espacios en uso`} />
        <Kpi icon={<Lightbulb className="h-5 w-5" />} label="Luces encendidas sin nadie" value={<CountUp value={lightsWasted} />} note={lightsWasted > 0 ? 'Se apagan solas a los 5 min' : 'Ninguna'} warn={lightsWasted > 0} />
        <Kpi icon={<Monitor className="h-5 w-5" />} label="Computadores encendidos" value={<CountUp value={computersOn} />} note="según el sensor de corriente" />
        <Kpi icon={<Thermometer className="h-5 w-5" />} label="Temperatura en salones ocupados" value={<CountUp value={avgTemp} digits={1} suffix=" °C" />} note="promedio de los Arduino" />
      </dl>

      <div className="grid gap-5 xl:grid-cols-[200px_minmax(0,1fr)] 2xl:grid-cols-[200px_minmax(0,1fr)_380px]">
        <div className="order-2 xl:order-1">
          <FloorTower floors={PLAN_FLOORS} twins={twins} current={floor} onSelect={setFloor} block={block} />
        </div>
        <section aria-label={`Plano del ${plan.name.toLowerCase()}`} className="order-1 min-w-0 xl:order-2">
          <div className="relative overflow-hidden rounded-2xl bg-night p-3">
            <p className="lettering pointer-events-none absolute left-5 top-4 z-10 text-lg font-semibold text-night-text">{plan.name}</p>
            <div key={floor} className="floor-enter" style={{ aspectRatio: `${plan.width} / ${plan.height}` }}>
              <CampusPlan floor={plan} twins={twins} selected={selectedSpace} onSelect={selectSpace} block={block} />
            </div>
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm" aria-label="Leyenda">
            {ROOM_CONDITIONS.map((c) => (
              <li key={c} className={`flex items-center gap-1.5 ${present.has(c) ? 'font-medium text-ink' : 'text-ink-soft'}`}>
                <span className="h-3 w-3 rounded-sm" style={{ background: CONDITION_META[c].color }} />{CONDITION_META[c].label}
              </li>
            ))}
            <li className="flex items-center gap-1.5 text-ink-soft"><span className="h-3 w-3 rounded-full bg-[var(--color-lamp)] shadow-[0_0_8px_var(--color-lamp)]" />Luces encendidas</li>
          </ul>
        </section>
        <aside aria-label="Detalle del salón" className="order-3 min-w-0 xl:col-span-2 2xl:col-span-1">
          {current ? <RoomPanel twin={current} /> : <p className="text-sm text-ink-soft">Toca un salón del plano.</p>}
        </aside>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, note, warn }: { icon: ReactNode; label: string; value: ReactNode; note: string; warn?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 transition-colors duration-500 ${warn ? 'border-[#e8c46a] bg-[#fff7e0]' : 'border-rule bg-sheet'}`}>
      <dt className="flex items-center gap-2 text-sm text-ink-soft">{icon}{label}</dt>
      <dd className="lettering mt-1 text-3xl font-semibold">{value}</dd>
      <dd className="text-sm text-ink-soft">{note}</dd>
    </div>
  );
}

/**
 * Rooms of the pilot that are not drawn on the 2025-B plan yet (301-A and 303-A): listed apart, with their
 * real-time state and whether their data is emulated.
 */
function PilotRooms({ twins, selected, onSelect }: { twins: TwinSpace[]; selected: string; onSelect: (spaceId: string) => void }) {
  return (
    <section aria-labelledby="pilot-title">
      <h2 id="pilot-title" className="text-sm font-semibold">Salones piloto</h2>
      <ul className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {twins.map(({ space, state }) => {
          const meta = CONDITION_META[state.condition];
          return (
            <li key={space.spaceId}>
              <button type="button" aria-pressed={selected === space.spaceId} onClick={() => onSelect(space.spaceId)}
                className={`w-full rounded-2xl border p-3 text-left transition-colors ${selected === space.spaceId ? 'border-signal bg-white' : 'border-rule bg-sheet hover:bg-white'}`}>
                <span className="flex items-center justify-between gap-2">
                  <span className="lettering font-semibold">{space.spaceId}</span>
                  {state.emulated && <span className="flex items-center gap-1 rounded-full bg-ucc-lima px-2 py-0.5 text-xs font-semibold text-ucc-marino"><FlaskConical className="h-3 w-3" />Emulado</span>}
                </span>
                <span className="block text-sm text-ink-soft">{space.name}</span>
                <span className="mt-1 block text-sm font-medium" style={{ color: meta.ink }}>{meta.label}</span>
                <span className="block text-xs text-ink-soft">{state.teachersPresent} docente · {state.studentsPresent} estudiantes · {state.occupancy} de {space.capacity}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
