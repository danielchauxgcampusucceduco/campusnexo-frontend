import { BellRing, CheckCircle2, ChevronLeft, GraduationCap, MapPin, QrCode } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { useTwin } from '../../application/TwinContext';
import { DESK_ABANDON_MINUTES } from '../../domain/desks';
import type { TwinSpace } from '../../domain/model';
import { countdown } from './useLiveNow';

type Screen = { kind: 'home' } | { kind: 'qr'; zoneId: string } | { kind: 'done'; zoneId: string };

/** Mockup of the student app: free desks, QR check-in and pop-up study rooms during exams. */
export function StudentPhone({ library, now }: { library: TwinSpace; now: number }) {
  const { gateway, snapshot, runScenario, notify } = useTwin();
  const [tab, setTab] = useState<'puestos' | 'parciales'>('puestos');
  const [screen, setScreen] = useState<Screen>({ kind: 'home' });
  const [qr, setQr] = useState('');
  const [busy, setBusy] = useState(false);

  const deskState = new Map(library.state.desks.map((d) => [d.zoneId, d]));
  const free = library.rois.filter((roi) => {
    const state = deskState.get(roi.zoneId)?.state ?? 'DISPONIBLE';
    return state === 'DISPONIBLE' || state === 'LIBERADO_POR_ABANDONO';
  });
  const held = library.state.desks.find((d) => d.state === 'ALERTA_ACAPARAMIENTO' && d.unattendedSince);
  const heldLabel = held ? library.rois.find((r) => r.zoneId === held.zoneId)?.label : null;
  const popups = snapshot.twins.filter((t) => t.state.status === 'HABILITADO_POPUP_PARCIALES');
  const freeSeats = Math.max(0, library.space.capacity - library.state.occupancy);

  const minute = Math.floor(now / 60_000);
  useEffect(() => {
    if (screen.kind !== 'qr') return;
    const payload = `campusnexo://checkin?space=${library.space.spaceId}&desk=${screen.zoneId}&t=${minute}`;
    QRCode.toString(payload, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#1d262b', light: '#00000000' } })
      .then(setQr)
      .catch(() => setQr(''));
  }, [screen, library.space.spaceId, minute]);

  const label = (zoneId: string) => library.rois.find((r) => r.zoneId === zoneId)?.label ?? zoneId;

  const checkIn = async (zoneId: string) => {
    setBusy(true);
    try {
      await gateway.checkIn(library.space.spaceId, zoneId);
      setScreen({ kind: 'done', zoneId });
    } catch (error) {
      notify('error', error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-[300px] shrink-0 rounded-[44px] bg-night p-3 shadow-[0_24px_60px_-28px_rgba(15,29,36,0.75)]" aria-label="App estudiantil (maqueta)">
      <div className="relative flex h-[600px] flex-col overflow-hidden rounded-[34px] bg-[#f6f8f6] text-ink">
        <div className="mx-auto mt-2 h-6 w-28 rounded-full bg-night" />
        <header className="flex items-center gap-2 px-5 pb-3 pt-3">
          <GraduationCap className="h-5 w-5 text-st-optimo" />
          <div className="leading-tight">
            <p className="text-[13px] font-semibold">CampusNexo Estudiante</p>
            <p className="text-[11px] text-ink-soft">{library.space.name}</p>
          </div>
        </header>

        {held && heldLabel && screen.kind === 'home' && (
          <div className="mx-4 mb-2 flex gap-2 rounded-xl bg-[#fff4dc] px-3 py-2 text-[12px] text-[#7a5410]">
            <BellRing className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Tus cosas siguen en la {heldLabel}. Si no vuelves, el puesto se libera en <b className="tabular-nums">{countdown(held.unattendedSince!, now, DESK_ABANDON_MINUTES).label}</b>.</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {screen.kind === 'qr' && (
            <div className="flex flex-col items-center gap-3 pt-2 text-center">
              <button type="button" onClick={() => setScreen({ kind: 'home' })} className="self-start text-[12px] text-ink-soft"><ChevronLeft className="inline h-4 w-4" /> Volver</button>
              <p className="lettering text-lg font-semibold">{label(screen.zoneId)}</p>
              <p className="text-[12px] text-ink-soft">Escanea el código del puesto o muéstralo al llegar. La cámara confirma que estás sentado.</p>
              <div className="h-44 w-44 rounded-2xl border border-rule bg-white p-3" dangerouslySetInnerHTML={{ __html: qr }} aria-label={`Código QR de check-in de ${label(screen.zoneId)}`} role="img" />
              <button
                type="button"
                disabled={busy || !gateway.capabilities.checkIn}
                onClick={() => void checkIn(screen.zoneId)}
                className="w-full rounded-xl bg-night py-2.5 text-[13px] font-semibold text-night-text disabled:opacity-50"
              >
                Hacer check-in
              </button>
              {!gateway.capabilities.checkIn && <p className="text-[11px] text-ink-soft">El check-in real necesita la cuenta institucional; pruébalo en el modo de simulación.</p>}
            </div>
          )}

          {screen.kind === 'done' && (
            <div className="flex flex-col items-center gap-3 pt-10 text-center">
              <CheckCircle2 className="h-14 w-14 text-st-libre" />
              <p className="lettering text-lg font-semibold">Check-in hecho</p>
              <p className="text-[12px] text-ink-soft">La {label(screen.zoneId)} quedó a tu nombre. Si te levantas más de {DESK_ABANDON_MINUTES} min, se libera para otro estudiante.</p>
              <button type="button" onClick={() => setScreen({ kind: 'home' })} className="mt-2 text-[12px] font-medium text-st-optimo">Volver al inicio</button>
            </div>
          )}

          {screen.kind === 'home' && (
            <>
              <div role="tablist" className="mb-3 grid grid-cols-2 rounded-xl bg-rule/50 p-1 text-[12px]">
                {(['puestos', 'parciales'] as const).map((id) => (
                  <button key={id} role="tab" type="button" aria-selected={tab === id} onClick={() => setTab(id)}
                    className={`rounded-lg py-1.5 font-medium ${tab === id ? 'bg-white shadow-sm' : 'text-ink-soft'}`}>
                    {id === 'puestos' ? 'Puestos libres' : 'Aulas para parciales'}
                  </button>
                ))}
              </div>

              {tab === 'puestos' ? (
                <>
                  <p className="mb-2 text-[12px] text-ink-soft">{freeSeats} cupos libres en el piso, {free.length} mesas con sensor disponibles.</p>
                  <ul className="space-y-2">
                    {free.map((roi) => (
                      <li key={roi.zoneId}>
                        <button type="button" onClick={() => setScreen({ kind: 'qr', zoneId: roi.zoneId })}
                          className="flex w-full items-center gap-3 rounded-xl border border-rule bg-white px-3 py-2.5 text-left text-[13px]">
                          <MapPin className="h-4 w-4 text-st-libre" />
                          <span className="flex-1">
                            <span className="font-medium">{roi.label}</span>
                            {deskState.get(roi.zoneId)?.state === 'LIBERADO_POR_ABANDONO' && <span className="block text-[11px] text-ink-soft">Liberada por abandono</span>}
                          </span>
                          <QrCode className="h-4 w-4 text-ink-soft" />
                        </button>
                      </li>
                    ))}
                    {free.length === 0 && <li className="rounded-xl bg-white px-3 py-3 text-[12px] text-ink-soft">No hay mesas libres ahora. Revisa las aulas para parciales.</li>}
                  </ul>
                </>
              ) : (
                <>
                  {popups.length > 0 ? (
                    <ul className="space-y-2">
                      {popups.map((room) => (
                        <li key={room.space.spaceId} className="rounded-xl border border-st-popup/40 bg-white px-3 py-2.5 text-[13px]">
                          <p className="font-medium">{room.space.name}</p>
                          <p className="text-[11px] text-ink-soft">{room.space.buildingName}, {room.space.city}</p>
                          <p className="mt-1 text-[12px] text-st-popup">{Math.max(0, room.space.capacity - room.state.occupancy)} cupos de estudio libres</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="rounded-xl bg-white px-3 py-3 text-[12px] text-ink-soft">Todavía no hay aulas abiertas como sala de estudio.</p>
                  )}
                  <button type="button" onClick={() => void runScenario('POPUP_PARCIALES')}
                    className="mt-3 w-full rounded-xl border border-st-popup/50 py-2 text-[12px] font-medium text-st-popup">
                    Abrir aula pop-up (demo de coordinación)
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
