import { CloudOff, FlaskConical } from 'lucide-react';
import { useTwin } from '../../application/TwinContext';

const time = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Bogota' });

/**
 * Says plainly when the figures are not the live campus: the feed dropped (they may be stale) or some rooms
 * receive emulated data instead of a real camera. It cannot be dismissed.
 */
export function DataSourceBanner() {
  const { snapshot } = useTwin();
  const emulated = snapshot.twins.filter((t) => t.state.emulated).map((t) => t.space.spaceId);
  return (
    <>
      {(snapshot.connection === 'degraded' || snapshot.connection === 'offline') && (
        <div role="alert" className="flex items-center gap-2 border-b border-[#f1b5a8] bg-[#fdeeea] px-4 py-1.5 text-sm text-st-sobrecupo-ink md:px-6">
          <CloudOff className="h-4 w-4 shrink-0" />
          <span><b>Sin actualización en vivo.</b> Los datos pueden estar desactualizados; última actualización {time.format(snapshot.now)}. Reintentando…</span>
        </div>
      )}
      {emulated.length > 0 && (
        <div role="status" className="flex items-center gap-2 border-b border-ucc-lima/70 bg-[color-mix(in_oklab,var(--color-ucc-lima)_16%,var(--color-sheet))] px-4 py-1.5 text-sm text-st-subutilizado-ink md:px-6">
          <FlaskConical className="h-4 w-4 shrink-0" />
          {emulated.length > 3
            ? <span><b>Demo emulada.</b> {emulated.length} salones reciben datos de la <a href="#/simulacion" className="underline">simulación del campus</a>, no de cámaras reales.</span>
            : <span><b>Piloto emulada.</b> {emulated.join(', ')} {emulated.length === 1 ? 'recibe' : 'reciben'} datos emulados, no de una cámara real.</span>}
        </div>
      )}
    </>
  );
}
