import { Flame, Hand, Leaf, Power, Snowflake, Wind, Wrench } from 'lucide-react';
import type { ComponentType } from 'react';
import type { HvacControlState, TwinSpace } from '../../domain/model';
import { BRANCH_LABEL, BRANCH_ORDER, HVAC_META, STATUS_META } from '../theme';

const COS = Math.cos(Math.PI / 6);
const SIN = Math.sin(Math.PI / 6);
const iso = (x: number, y: number, z = 0): [number, number] => [(x - y) * COS, (x + y) * SIN - z];
const points = (list: [number, number][]) => list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

export const HVAC_ICON: Record<HvacControlState, ComponentType<{ className?: string }>> = {
  APAGADO: Power,
  PRE_ENFRIAMIENTO_IA: Snowflake,
  CONFORT_ACTIVO: Flame,
  ECO_SETBACK_ENTRE_CLASES: Leaf,
  CORTE_INERCIA_TERMICA: Leaf,
  BLOQUEO_AHORRO_VACIO: Leaf,
  VENTILACION_CO2_ACTIVA: Wind,
  OVERRIDE_MANUAL_DOCENTE: Hand,
};

/** Layout of each branch plateau in grid units: room footprints derive from their floor area. */
const SLOTS: Record<string, [number, number][]> = {
  'SEDE-ANDINA': [[0, 0], [130, 0], [0, 120]],
  'SEDE-TROPICAL': [[0, 0]],
  'SEDE-TEMPLADA': [[0, 0]],
};
/** Screen position of each branch group, so the three sites read as separate islands. */
const GROUP_OFFSET: Record<string, [number, number]> = {
  'SEDE-ANDINA': [250, 165],
  'SEDE-TROPICAL': [640, 215],
  'SEDE-TEMPLADA': [860, 215],
};
const MAX_HEIGHT = 92;

function shade(color: string, amount: number) {
  return `color-mix(in oklab, ${color} ${100 - amount}%, #0f1d24)`;
}

interface Props {
  twins: TwinSpace[];
  selected: string;
  onSelect: (spaceId: string) => void;
}

/**
 * 2.5D isometric campus. Each room is a block whose solid height is the occupancy share and whose
 * dashed wireframe is the capacity; the top face carries the status colour and the badge shows the
 * HVAC strategy chosen by the thermal-inertia controller.
 */
export function IsoCampus({ twins, selected, onSelect }: Props) {
  const groups = BRANCH_ORDER.map((branchId) => {
    const rooms = twins.filter((t) => t.space.branchId === branchId);
    const blocks = rooms.map((twin, index) => {
      const [x, y] = SLOTS[branchId]?.[index] ?? [index * 120, 0];
      const side = Math.min(118, 46 + Math.sqrt(twin.space.areaSqm) * 4.6);
      return { twin, x, y, w: side, d: side * 0.82 };
    }).sort((a, b) => a.x + a.y - (b.x + b.y));
    if (blocks.length === 0) return null;
    const x0 = Math.min(...blocks.map((b) => b.x)) - 18;
    const y0 = Math.min(...blocks.map((b) => b.y)) - 18;
    const x1 = Math.max(...blocks.map((b) => b.x + b.w)) + 18;
    const y1 = Math.max(...blocks.map((b) => b.y + b.d)) + 18;
    return { branchId, blocks, x0, y0, x1, y1, offset: GROUP_OFFSET[branchId] ?? [0, 0] };
  }).filter((g) => g !== null);

  return (
    <svg viewBox="0 0 1000 560" className="h-full w-full" role="group" aria-label="Mapa isométrico de las tres sedes">
      <defs>
        <pattern id="maintenance-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="8" height="8" fill="#6b6f73" />
          <line x1="0" y1="0" x2="0" y2="8" stroke="#8d9296" strokeWidth="4" />
        </pattern>
      </defs>

      {groups.map(({ branchId, blocks, x0, y0, x1, y1, offset }) => {
        const label = BRANCH_LABEL[branchId]!;
        const front = iso(x1, y1);
        const leftCorner = iso(x0, y1);
        const labelX = (front[0] + leftCorner[0]) / 2 + (iso(x1, y0)[0] - leftCorner[0]) / 4;
        const labelY = front[1] + 46;
        return (
          <g key={branchId} transform={`translate(${offset[0]}, ${offset[1]})`}>
            <polygon points={points([iso(x0, y0), iso(x1, y0), iso(x1, y1), iso(x0, y1)])} fill="#14262f" stroke="#2a4350" strokeWidth="1.2" />
            <polygon points={points([iso(x0, y1), iso(x1, y1), iso(x1, y1, -8), iso(x0, y1, -8)])} fill="#0b161c" />
            <polygon points={points([iso(x1, y0), iso(x1, y1), iso(x1, y1, -8), iso(x1, y0, -8)])} fill="#0d1a21" />
            {blocks.map((block) => (
              <RoomBlock key={block.twin.space.spaceId} {...block} selected={selected === block.twin.space.spaceId} onSelect={onSelect} />
            ))}
            {blocks.map((block) => <RoomLabel key={`label-${block.twin.space.spaceId}`} {...block} />)}
            <text x={labelX} y={labelY} fill="#cfe0dc" fontSize="15" fontWeight={600} style={{ fontStretch: '118%' }} textAnchor="middle">{label.name}</text>
            <text x={labelX} y={labelY + 17} fill="#7f9aa3" fontSize="11.5" textAnchor="middle">{label.city}, {label.climate.toLowerCase()}</text>
          </g>
        );
      })}
    </svg>
  );
}

function RoomBlock({ twin, x, y, w, d, selected, onSelect }: { twin: TwinSpace; x: number; y: number; w: number; d: number; selected: boolean; onSelect: (spaceId: string) => void }) {
  const { space, state } = twin;
  const share = Math.min(1.25, state.occupancy / space.capacity);
  const h = Math.max(5, share * MAX_HEIGHT);
  const color = STATUS_META[state.status].color;
  const maintenance = state.status === 'MANTENIMIENTO';
  const top = [iso(x, y, h), iso(x + w, y, h), iso(x + w, y + d, h), iso(x, y + d, h)];
  const left = [iso(x, y + d, 0), iso(x + w, y + d, 0), iso(x + w, y + d, h), iso(x, y + d, h)];
  const right = [iso(x + w, y, 0), iso(x + w, y + d, 0), iso(x + w, y + d, h), iso(x + w, y, h)];
  const cap = [iso(x, y, MAX_HEIGHT), iso(x + w, y, MAX_HEIGHT), iso(x + w, y + d, MAX_HEIGHT), iso(x, y + d, MAX_HEIGHT)];
  const [bx, by] = iso(x + w / 2, y + d / 2, Math.max(h, MAX_HEIGHT) + 26);
  const Icon = HVAC_ICON[state.hvacState];
  const hvacColor = HVAC_META[state.hvacState].color;
  const fill = (base: string) => (maintenance ? 'url(#maintenance-hatch)' : base);
  return (
    <g
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${space.name}: ${STATUS_META[state.status].label}, ${state.occupancy} de ${space.capacity} personas, ${HVAC_META[state.hvacState].label}`}
      onClick={() => onSelect(space.spaceId)}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(space.spaceId); } }}
      className="group cursor-pointer outline-none"
    >
      <polygon points={points([iso(x - 6, y - 6), iso(x + w + 6, y - 6), iso(x + w + 6, y + d + 6), iso(x - 6, y + d + 6)])}
        fill="none" stroke="#5fd0bf" strokeWidth="2" className={selected ? 'opacity-100' : 'opacity-0 group-focus-visible:opacity-100'} />
      <polygon points={points(cap)} fill="none" stroke="#3d5a68" strokeDasharray="4 4" />
      {[[x, y], [x + w, y], [x + w, y + d], [x, y + d]].map(([cx, cy], i) => {
        const [x1, y1] = iso(cx!, cy!, 0);
        const [x2, y2] = iso(cx!, cy!, MAX_HEIGHT);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#2a4350" strokeDasharray="2 5" />;
      })}
      <polygon points={points(left)} fill={fill(shade(color, 38))} />
      <polygon points={points(right)} fill={fill(shade(color, 55))} />
      <polygon points={points(top)} fill={fill(color)} stroke="#e8f2ef" strokeOpacity="0.35" />
      <line x1={bx} y1={by + 13} x2={iso(x + w / 2, y + d / 2, h)[0]} y2={iso(x + w / 2, y + d / 2, h)[1]} stroke="#3d5a68" />
      <g transform={`translate(${bx - 52}, ${by - 14})`}>
        <rect width="104" height="26" rx="13" fill="#0f1d24" stroke={hvacColor} strokeOpacity="0.8" />
        <foreignObject x="6" y="4" width="18" height="18" style={{ color: hvacColor }}>
          <Icon className={`h-[18px] w-[18px] ${state.hvacState === 'VENTILACION_CO2_ACTIVA' ? 'animate-spin [animation-duration:2.4s]' : ''}`} />
        </foreignObject>
        <text x="28" y="17.5" fill="#e8f2ef" fontSize="11.5" fontWeight={600}>{state.indoorTemperatureC.toFixed(1)} °C</text>
        <text x="72" y="17.5" fill={state.co2Ppm > 1000 ? '#f08a5d' : '#8fb0b8'} fontSize="10.5">{Math.round(state.co2Ppm)}</text>
      </g>
      {maintenance && (
        <foreignObject x={bx - 9} y={by - 40} width="18" height="18" style={{ color: '#c8ccd0' }}><Wrench className="h-[18px] w-[18px]" /></foreignObject>
      )}
    </g>
  );
}

/** Drawn after every block of the group so no block hides another room's name. */
function RoomLabel({ twin, x, y, w, d }: { twin: TwinSpace; x: number; y: number; w: number; d: number }) {
  const [nx, ny] = iso(x + w, y + d, 0);
  return (
    <g aria-hidden>
      <text x={nx} y={ny + 17} fill="#e8f2ef" fontSize="12" fontWeight={600} textAnchor="middle" paintOrder="stroke" stroke="#0f1d24" strokeWidth="4">{twin.space.name}</text>
      <text x={nx} y={ny + 31} fill="#8fb0b8" fontSize="10.5" textAnchor="middle" paintOrder="stroke" stroke="#0f1d24" strokeWidth="4">{twin.state.occupancy}/{twin.space.capacity} personas</text>
    </g>
  );
}
