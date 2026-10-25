import { useEffect, useRef, useState } from 'react';
import type { PlanFloor, PlanRoom } from '../../campus/plan';
import { centroid, seatSize, seatSpots, standingSpots } from '../../campus/seats';
import { WASTE_CONDITIONS, type TwinSpace } from '../../domain/model';
import { CONDITION_META, DESK_META, SPACE_TYPE_LABEL } from '../theme';

interface Props {
  floor: PlanFloor;
  twins: Map<string, TwinSpace>;
  selected: string | null;
  onSelect: (spaceId: string) => void;
  /** Block shown at full strength; the other one is dimmed. Null shows both. */
  block: 'A' | 'B' | null;
}

/**
 * Real floor plan of the campus (walls from the 2025-B DWG) with every room painted by its live state:
 * colour = overall condition, fill strength = occupancy, a lamp glow while the lights are on, a seat grid
 * where each desk lights up when the camera sees someone in it, and the computers drawing power.
 */
export function CampusPlan({ floor, twins, selected, onSelect, block }: Props) {
  const shutdowns = useShutdownFlashes(floor, twins);
  return (
    <svg viewBox={`0 0 ${floor.width} ${floor.height}`} className="campus-plan h-full w-full" role="group" aria-label={`Plano del ${floor.name.toLowerCase()}`}>
      <defs>
        <radialGradient id="lamp-glow">
          <stop offset="0%" stopColor="var(--color-lamp)" stopOpacity="0.85" />
          <stop offset="55%" stopColor="var(--color-lamp)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--color-lamp)" stopOpacity="0" />
        </radialGradient>
        <pattern id="plan-hatch" width="0.8" height="0.8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="0.8" stroke="#8d9296" strokeWidth="0.3" />
        </pattern>
      </defs>
      <path d={floor.walls} fill="none" stroke="#5d7f8c" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeLinecap="round" opacity="0.75" />
      {floor.rooms.map((room) => (
        <RoomShape key={room.spaceId} room={room} twin={twins.get(room.spaceId)} dimmed={block !== null && room.block !== block}
          selected={selected === room.spaceId} flash={shutdowns.has(room.spaceId)} onSelect={onSelect} />
      ))}
    </svg>
  );
}

/** Rooms whose lights or computers were just switched off by the Arduino, for a short ripple. */
function useShutdownFlashes(floor: PlanFloor, twins: Map<string, TwinSpace>): Set<string> {
  const last = useRef(new Map<string, string | null>());
  const [active, setActive] = useState<Set<string>>(new Set());
  useEffect(() => {
    const fresh: string[] = [];
    for (const room of floor.rooms) {
      const at = twins.get(room.spaceId)?.state.equipmentShutdownAt ?? null;
      const before = last.current.get(room.spaceId);
      if (before !== undefined && at && at !== before) fresh.push(room.spaceId);
      last.current.set(room.spaceId, at);
    }
    if (fresh.length === 0) return;
    setActive((current) => new Set([...current, ...fresh]));
    const id = setTimeout(() => setActive((current) => new Set([...current].filter((s) => !fresh.includes(s)))), 3_200);
    return () => clearTimeout(id);
  }, [floor, twins]);
  return active;
}

function RoomShape({ room, twin, dimmed, selected, flash, onSelect }: {
  room: PlanRoom; twin: TwinSpace | undefined; dimmed: boolean; selected: boolean; flash: boolean; onSelect: (spaceId: string) => void;
}) {
  const state = twin?.state;
  const condition = state?.condition ?? 'LIBRE';
  const meta = CONDITION_META[condition];
  const occupancy = state?.occupancy ?? 0;
  const share = Math.min(1, occupancy / Math.max(1, room.capacity));
  const points = room.polygon.map(([x, y]) => `${x},${y}`).join(' ');
  const [lx, ly] = [room.rect.cx, room.rect.cy];
  const short = Math.min(room.rect.w, room.rect.h);
  const label = Math.max(0.85, Math.min(2.1, short * 0.2));
  const waste = WASTE_CONDITIONS.has(condition);
  const lampR = Math.max(1.6, Math.min(room.rect.w, room.rect.h) * 0.6);
  const seats = seatSpots(room);
  const desks = new Map((state?.desks ?? []).map((desk, index) => [index, desk]));
  const seated = (state?.desks ?? []).filter((d) => d.peopleInside > 0).length;
  const standing = seats.length > 0 ? Math.max(0, occupancy - seated) : 0;
  const size = seatSize(room);
  const [px, py] = centroid(room.polygon);
  const computers = state?.devicesOn ?? 0;

  return (
    <g
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${room.name} (${room.spaceId}): ${meta.label}, ${occupancy} de ${room.capacity} personas${state?.lightsOn ? ', luces encendidas' : ''}${computers > 0 ? `, ${computers} equipos encendidos` : ''}`}
      onClick={() => onSelect(room.spaceId)}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(room.spaceId); } }}
      className={`plan-room group cursor-pointer outline-none ${dimmed ? 'opacity-30' : ''}`}
      style={{ transition: 'opacity 400ms ease' }}
    >
      <title>{`${room.name} · ${SPACE_TYPE_LABEL[room.type]}`}</title>
      {state?.lightsOn && <circle cx={px} cy={py} r={lampR} fill="url(#lamp-glow)" className="lamp-on" />}
      <polygon
        points={points}
        fill={condition === 'MANTENIMIENTO' ? 'url(#plan-hatch)' : meta.color}
        fillOpacity={condition === 'LIBRE' ? 0.16 : condition === 'OCUPADO' ? 0.22 + share * 0.5 : 0.55}
        stroke={selected ? '#f4fbf9' : meta.color}
        strokeWidth={selected ? 3 : 1.4}
        vectorEffect="non-scaling-stroke"
        className={`room-fill ${waste ? 'room-waste' : ''}`}
      />
      {flash && <polygon points={points} fill="none" stroke="var(--color-lamp)" strokeWidth="4" vectorEffect="non-scaling-stroke" className="iso-pulse" />}
      <g className="seats" pointerEvents="none">
        {seats.map((spot) => {
          const desk = desks.get(spot.index);
          const deskState = desk?.state ?? 'DISPONIBLE';
          const color = DESK_META[deskState].color;
          const taken = (desk?.peopleInside ?? 0) > 0;
          return (
            <g key={spot.index} transform={`translate(${spot.x} ${spot.y}) rotate(${spot.angle})`}>
              <rect x={-size / 2} y={-size / 2} width={size} height={size * 0.7} rx={size * 0.12}
                fill={taken || deskState !== 'DISPONIBLE' ? color : 'none'} fillOpacity={taken ? 0.9 : 0.55}
                stroke={color} strokeOpacity={0.7} strokeWidth={size * 0.08}
                className={deskState === 'ALERTA_ACAPARAMIENTO' ? 'seat-alert' : undefined} />
              {taken && <circle cx={0} cy={size * 0.55} r={size * 0.3} fill="#eaf6ff" className="person" style={{ animationDelay: `${(spot.index * 173) % 2400}ms` }} />}
            </g>
          );
        })}
        {standingSpots(room, standing).map((spot) => (
          <circle key={`s${spot.index}`} cx={spot.x} cy={spot.y} r={Math.max(0.22, size * 0.32)} fill="#ffd2c8" className="person"
            style={{ animationDelay: `${(spot.index * 251) % 2400}ms` }} />
        ))}
        {seats.length === 0 && occupancy > 0 && <OfficePeople room={room} count={occupancy} />}
      </g>
      <g pointerEvents="none" className="room-label">
        <text x={lx} y={ly - label * 0.15} textAnchor="middle" fontSize={label} fontWeight={700} fill="#f4fbf9"
          paintOrder="stroke" stroke="#0b171d" strokeWidth={label * 0.28} strokeOpacity={0.85}>
          {room.spaceId.length <= 6 ? room.spaceId : `${Math.round(share * 100)} %`}
        </text>
        {room.spaceId.length <= 6 && (
          <text x={lx} y={ly + label * 0.95} textAnchor="middle" fontSize={label * 0.78} fontWeight={600} fill={share > 0 ? '#ffffff' : '#a9c2c8'}
            paintOrder="stroke" stroke="#0b171d" strokeWidth={label * 0.24} strokeOpacity={0.85}>
            {Math.round(share * 100)} %
          </text>
        )}
        {computers > 0 && (
          <g transform={`translate(${lx + label * 1.6} ${ly - label * 0.9})`} className="screens-on">
            <rect x={-label * 0.42} y={-label * 0.3} width={label * 0.84} height={label * 0.56} rx={label * 0.08} fill="var(--color-rc-equipos)" />
            <rect x={-label * 0.12} y={label * 0.26} width={label * 0.24} height={label * 0.14} fill="var(--color-rc-equipos)" />
          </g>
        )}
      </g>
    </g>
  );
}

/** People in rooms without a seat grid (offices, storage): dots spread over the room. */
function OfficePeople({ room, count }: { room: PlanRoom; count: number }) {
  const { cx, cy, w, h, angle } = room.rect;
  const rad = (angle * Math.PI) / 180;
  const n = Math.min(count, 16);
  const columns = Math.ceil(Math.sqrt(n * (w / Math.max(1, h))));
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const u = -w * 0.35 + ((i % columns) + 0.5) * ((w * 0.7) / columns);
        const v = -h * 0.3 + (Math.floor(i / columns) + 0.5) * ((h * 0.6) / Math.ceil(n / columns));
        return <circle key={i} cx={cx + u * Math.cos(rad) - v * Math.sin(rad)} cy={cy + u * Math.sin(rad) + v * Math.cos(rad)} r={0.32} fill="#eaf6ff" className="person" style={{ animationDelay: `${(i * 211) % 2400}ms` }} />;
      })}
    </>
  );
}
