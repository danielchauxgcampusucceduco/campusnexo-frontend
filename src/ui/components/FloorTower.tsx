import type { PlanFloor } from '../../campus/plan';
import { ROOM_CONDITIONS, roomCondition, type RoomCondition, type TwinSpace } from '../../domain/model';
import { CONDITION_META } from '../theme';

/**
 * The building seen from the side: one bar per floor, top floor first, split by how its student spaces are used.
 * It is the floor selector and, at a glance, where people are and how many rooms are free.
 */
export function FloorTower({ floors, twins, current, onSelect, block }: {
  floors: PlanFloor[];
  twins: Map<string, TwinSpace>;
  current: number;
  onSelect: (floor: number) => void;
  block: 'A' | 'B' | null;
}) {
  const ordered = [...floors].sort((a, b) => b.floor - a.floor);
  return (
    <ol className="flex flex-col gap-1.5" aria-label="Pisos">
      {ordered.map((floor) => {
        const rooms = floor.rooms.filter((r) => block === null || r.block === block);
        const counts = new Map<RoomCondition, number>();
        let people = 0;
        for (const room of rooms) {
          const twin = twins.get(room.spaceId);
          if (!twin?.space.accesibleParaEstudiantes) continue;
          const condition = roomCondition(twin);
          counts.set(condition, (counts.get(condition) ?? 0) + 1);
          people += twin.state.occupancy;
        }
        const active = floor.floor === current;
        const free = counts.get('LIBRE') ?? 0;
        return (
          <li key={floor.floor}>
            <button
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(floor.floor)}
              className={`group w-full rounded-xl border px-3 py-2 text-left transition-all duration-300 ${active ? 'border-transparent bg-night text-night-text shadow-[0_10px_24px_-14px_rgba(15,29,36,0.9)]' : 'border-rule bg-sheet hover:-translate-y-0.5 hover:border-ink/25'}`}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="lettering text-sm font-semibold">{floor.name}</span>
                <span className={`text-xs tabular-nums ${active ? 'text-night-text/80' : 'text-ink-soft'}`}>{people} personas</span>
              </span>
              <span className="mt-1.5 flex h-2.5 overflow-hidden rounded-full bg-rule/60" aria-hidden>
                {ROOM_CONDITIONS.map((condition) => {
                  const n = counts.get(condition) ?? 0;
                  return n > 0 ? <span key={condition} className="h-full transition-[flex-grow] duration-700" style={{ flexGrow: n, background: CONDITION_META[condition].color }} /> : null;
                })}
              </span>
              {free > 0 && (
                <span className={`mt-1 block text-xs font-medium ${active ? 'text-night-text/85' : 'text-st-libre-ink'}`}>
                  {free} {free === 1 ? 'espacio libre' : 'espacios libres'}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
