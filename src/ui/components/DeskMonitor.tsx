import { Backpack, BookOpen, Laptop, User } from 'lucide-react';
import { DESK_ABANDON_MINUTES } from '../../domain/desks';
import type { DeskObservation, StudyZoneRoi } from '../../domain/model';
import { DESK_META } from '../theme';
import { countdown } from './useLiveNow';

function Ring({ fraction, color, label }: { fraction: number; color: string; label: string }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg viewBox="0 0 64 64" className="h-16 w-16" role="img" aria-label={`Quedan ${label} para liberar el puesto`}>
      <circle cx="32" cy="32" r={radius} fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="5" />
      <circle cx="32" cy="32" r={radius} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={circumference * (1 - fraction)} transform="rotate(-90 32 32)" />
      <text x="32" y="36.5" textAnchor="middle" fontSize="13" fontWeight={700} fill="currentColor">{label}</text>
    </svg>
  );
}

/** Anti-hoarding monitor: one tile per desk ROI, in the same 2 × 4 layout as the camera. */
export function DeskMonitor({ rois, desks, now }: { rois: StudyZoneRoi[]; desks: DeskObservation[]; now: number }) {
  const byZone = new Map(desks.map((d) => [d.zoneId, d]));
  return (
    <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {rois.map((roi) => {
        const desk = byZone.get(roi.zoneId);
        const state = desk?.state ?? 'DISPONIBLE';
        const meta = DESK_META[state];
        const timer = desk?.unattendedSince && state === 'ALERTA_ACAPARAMIENTO' ? countdown(desk.unattendedSince, now, DESK_ABANDON_MINUTES) : null;
        return (
          <li key={roi.zoneId} className="flex min-h-[148px] flex-col rounded-xl border bg-sheet p-3"
            style={{ borderColor: `color-mix(in oklab, ${meta.color} 55%, var(--color-rule))`, boxShadow: state === 'LIBERADO_POR_ABANDONO' ? `inset 0 0 0 2px color-mix(in oklab, ${meta.color} 30%, transparent)` : undefined }}>
            <div className="flex items-start justify-between">
              <span className="lettering text-sm font-semibold">{roi.label}</span>
              <span className="text-[11px] text-ink-soft">{roi.zoneId}</span>
            </div>
            <div className="flex flex-1 items-center justify-center py-1" style={{ color: meta.color }}>
              {timer ? (
                <Ring fraction={timer.fraction} color={meta.color} label={timer.label} />
              ) : (
                <div className="flex items-center gap-1.5">
                  {desk && desk.peopleInside > 0 && <User className="h-6 w-6" />}
                  {desk && desk.belongingsInside > 0 && (state === 'LIBERADO_POR_ABANDONO' ? <Backpack className="h-6 w-6" /> : <Laptop className="h-5 w-5 opacity-70" />)}
                  {(!desk || (desk.peopleInside === 0 && desk.belongingsInside === 0)) && <BookOpen className="h-6 w-6 opacity-60" />}
                </div>
              )}
            </div>
            <p className="text-xs font-medium" style={{ color: meta.color }}>{meta.label}</p>
            <p className="text-[11px] text-ink-soft">
              {state === 'ALERTA_ACAPARAMIENTO' && desk ? `${desk.belongingsInside} ${desk.belongingsInside === 1 ? 'objeto' : 'objetos'} sin estudiante` : state === 'LIBERADO_POR_ABANDONO' ? 'Disponible para otro estudiante' : meta.hint}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
