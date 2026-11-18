import { useEffect, useRef, useState } from 'react';
import type { PlanFloor, PlanRoom } from '../../campus/plan';
import { seatSize, seatSpots, standingSpots } from '../../campus/seats';
import { roomCondition, type TwinSpace } from '../../domain/model';
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
 * Real floor plan of the campus (walls from the 2025-B DWG) with every student space painted by its live use:
 * colour = free, in use, over capacity or out of service, fill strength = occupancy, and a seat grid where each desk
 * lights up when the camera sees someone in it. Offices and staff rooms are drawn but not followed.
 */
export function CampusPlan({ floor, twins, selected, onSelect, block }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [hovered, setHovered] = useState<string | null>(null);

  // Pixels per metre of the drawn plan: the labels are HTML at a fixed 12 px, shown where they fit.
  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const measure = () => setScale(element.clientWidth / floor.width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [floor.width]);

  return (
    <div ref={box} className="relative h-full w-full">
    <svg viewBox={`0 0 ${floor.width} ${floor.height}`} className="campus-plan h-full w-full" role="group" aria-label={`Plano del ${floor.name.toLowerCase()}`}>
      <defs>
        <pattern id="plan-hatch" width="0.8" height="0.8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="0.8" stroke="#8d9296" strokeWidth="0.3" />
        </pattern>
        {/* A room without any sensor: light grey stripes, never the colour of «Libre». */}
        <pattern id="plan-nosensor" width="1.2" height="1.2" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
          <rect width="1.2" height="1.2" fill="#3a4a52" />
          <line x1="0" y1="0" x2="0" y2="1.2" stroke="#9fb0b8" strokeWidth="0.25" />
        </pattern>
      </defs>
      <path d={floor.walls} fill="none" stroke="#5d7f8c" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeLinecap="round" opacity="0.75" />
      {floor.rooms.map((room) => (
        <RoomShape key={room.spaceId} room={room} twin={twins.get(room.spaceId)} dimmed={block !== null && room.block !== block}
          selected={selected === room.spaceId} onSelect={onSelect} onHover={setHovered} />
      ))}
    </svg>
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {scale > 0 && floor.rooms.map((room) => (
          <RoomLabel key={room.spaceId} room={room} floor={floor} twin={twins.get(room.spaceId)} scale={scale}
            forced={hovered === room.spaceId || selected === room.spaceId} dimmed={block !== null && room.block !== block} />
        ))}
      </div>
    </div>
  );
}

/** A student space whose camera has never reported: it is not free, it is unknown. */
export const withoutSensor = (twin: TwinSpace | undefined) => twin?.state.sensorsReporting === false;

/** An office, staff room or storage: drawn on the plan, not followed by the camera. */
export const notMonitored = (twin: TwinSpace | undefined) => twin !== undefined && !twin.space.accesibleParaEstudiantes;

/**
 * The room's name and occupancy at a fixed, legible size (12 px), shown only where it fits; a room too small shows it
 * on hover, on focus or when selected. Rooms without a sensor say so instead of a percentage.
 */
function RoomLabel({ room, floor, twin, scale, forced, dimmed }: {
  room: PlanRoom; floor: PlanFloor; twin: TwinSpace | undefined; scale: number; forced: boolean; dimmed: boolean;
}) {
  const widthPx = room.rect.w * scale;
  const heightPx = room.rect.h * scale;
  const fits = widthPx >= 46 && heightPx >= 30;
  if (!fits && !forced) return null;
  const share = Math.min(1, (twin?.state.occupancy ?? 0) / Math.max(1, room.capacity));
  const title = room.spaceId.length <= 6 ? room.spaceId : room.name;
  return (
    <div className={`absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center leading-tight ${dimmed ? 'opacity-30' : ''}`}
      style={{ left: `${(room.rect.cx / floor.width) * 100}%`, top: `${(room.rect.cy / floor.height) * 100}%`, maxWidth: forced ? 180 : Math.max(46, widthPx - 4) }}>
      <span className={`max-w-full truncate rounded px-1 text-[12px] font-bold text-white ${forced && !fits ? 'bg-[#0b171d]/90' : ''}`}
        style={{ textShadow: '0 0 3px #0b171d, 0 0 3px #0b171d' }}>{title}</span>
      <span className="text-[11px] font-semibold" style={{ color: share > 0 ? '#ffffff' : '#c2d4d9', textShadow: '0 0 3px #0b171d' }}>
        {notMonitored(twin) ? 'No monitoreado' : withoutSensor(twin) ? 'Sin sensor' : `${Math.round(share * 100)} %`}
      </span>
    </div>
  );
}

function RoomShape({ room, twin, dimmed, selected, onSelect, onHover }: {
  room: PlanRoom; twin: TwinSpace | undefined; dimmed: boolean; selected: boolean; onSelect: (spaceId: string) => void;
  onHover: (spaceId: string | null) => void;
}) {
  const offList = notMonitored(twin);
  const noSensor = offList || withoutSensor(twin);
  const state = twin?.state;
  const condition = twin ? roomCondition(twin) : 'LIBRE';
  const meta = CONDITION_META[condition];
  const occupancy = state?.occupancy ?? 0;
  const share = Math.min(1, occupancy / Math.max(1, room.capacity));
  const points = room.polygon.map(([x, y]) => `${x},${y}`).join(' ');
  const seats = seatSpots(room);
  const desks = new Map((state?.desks ?? []).map((desk, index) => [index, desk]));
  const seated = (state?.desks ?? []).filter((d) => d.peopleInside > 0).length;
  const standing = seats.length > 0 ? Math.max(0, occupancy - seated) : 0;
  const size = seatSize(room);

  return (
    <g
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={offList ? `${room.name}, no monitoreado` : noSensor ? `${room.name}, sin sensor` : `${room.name}, ${meta.label.toLowerCase()}, ${occupancy} de ${room.capacity}`}
      onClick={() => onSelect(room.spaceId)}
      onMouseEnter={() => onHover(room.spaceId)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(room.spaceId)}
      onBlur={() => onHover(null)}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(room.spaceId); } }}
      className={`plan-room group cursor-pointer outline-none ${dimmed ? 'opacity-30' : ''}`}
      style={{ transition: 'opacity 400ms ease' }}
    >
      <title>{`${room.name} · ${SPACE_TYPE_LABEL[room.type]}`}</title>
      <polygon
        points={points}
        fill={noSensor ? 'url(#plan-nosensor)' : condition === 'MANTENIMIENTO' ? 'url(#plan-hatch)' : meta.color}
        fillOpacity={noSensor ? 0.7 : condition === 'LIBRE' ? 0.16 : condition === 'OCUPADO' ? 0.22 + share * 0.5 : 0.55}
        stroke={selected ? '#f4fbf9' : noSensor ? '#7d8f96' : meta.color}
        strokeWidth={selected ? 3 : 1.4}
        vectorEffect="non-scaling-stroke"
        className="room-fill"
      />
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
