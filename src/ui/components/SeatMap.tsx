import type { TwinSpace } from '../../domain/model';
import { DESK_META, SEAT_WORD } from '../theme';

/**
 * The room's seats as the ceiling camera sees them, front of the room on top. Each seat is lit when the
 * camera finds a person inside its region (ray casting over the YOLO boxes).
 */
export function SeatMap({ twin, large = false }: { twin: TwinSpace; large?: boolean }) {
  const { space, state, rois } = twin;
  const columns = space.seatColumns ?? (rois.length === 8 ? 4 : Math.ceil(Math.sqrt(rois.length || 1)));
  const desks = new Map(state.desks.map((desk) => [desk.zoneId, desk]));
  if (rois.length === 0) {
    return <p className="text-sm text-ink-soft">Este espacio no tiene puestos individuales: la cámara solo cuenta personas.</p>;
  }
  const taken = state.desks.filter((d) => d.peopleInside > 0).length;
  const [, plural] = SEAT_WORD[space.type];
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3 text-sm">
        <span className="text-ink-soft">Frente del salón</span>
        <span><b className="tabular-nums">{taken}</b> de {rois.length} {plural} ocupados</span>
      </div>
      <div className={`rounded-xl border border-rule bg-paper p-2 ${large ? '' : 'mx-auto'}`} style={large ? undefined : { maxWidth: columns * 30 + 16 }} aria-hidden>
        <div className="mx-auto mb-2 h-1.5 w-1/3 rounded-full bg-ink/25" />
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {rois.map((roi) => {
            const desk = desks.get(roi.zoneId);
            const meta = DESK_META[desk?.state ?? 'DISPONIBLE'];
            const occupied = (desk?.peopleInside ?? 0) > 0;
            return (
              <span key={roi.zoneId} title={`${roi.label}: ${meta.label}`}
                className={`seat-cell grid place-items-center rounded-md border text-[10px] font-semibold ${large ? 'aspect-[4/3]' : 'aspect-square'} ${desk?.state === 'ALERTA_ACAPARAMIENTO' ? 'seat-alert' : ''}`}
                style={{ borderColor: meta.color, background: occupied ? meta.color : `color-mix(in oklab, ${meta.color} ${desk && desk.state !== 'DISPONIBLE' ? 55 : 10}%, transparent)`, color: occupied ? '#fff' : meta.ink }}>
                {large ? roi.label.replace(/^\D+/, '') : ''}
              </span>
            );
          })}
        </div>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
        {(['OCUPADO_VERIFICADO', 'DISPONIBLE', 'ALERTA_ACAPARAMIENTO', 'LIBERADO_POR_ABANDONO'] as const).map((s) => (
          <li key={s} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: DESK_META[s].color }} />{DESK_META[s].label}</li>
        ))}
      </ul>
    </div>
  );
}
