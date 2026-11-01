import { CloudOff, FlaskConical, X } from 'lucide-react';
import { useState } from 'react';
import { useTwin } from '../../application/TwinContext';

const time = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Bogota' });

const DISMISSED_KEY = 'campusnexo.aviso-demo';

/** Whether the demo notice was closed in this browser session; storage may be blocked. */
function dismissedBefore(): boolean {
  try {
    return sessionStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Says plainly when the figures are not the live campus: the feed dropped (they may be stale) or some rooms
 * receive emulated data instead of a real camera. The warning of a dropped feed cannot be dismissed; the demo
 * notice can, for this browser session (U2: on a phone it takes room).
 */
export function DataSourceBanner() {
  const { snapshot } = useTwin();
  const [dismissed, setDismissed] = useState(dismissedBefore);
  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Storage blocked: closed until the page reloads.
    }
  };
  const emulated = snapshot.twins.filter((t) => t.state.emulated).map((t) => t.space.spaceId);
  return (
    <>
      {(snapshot.connection === 'degraded' || snapshot.connection === 'offline') && (
        <div role="alert" className="flex items-center gap-2 border-b border-[#f1b5a8] bg-alert-bg px-4 py-1.5 text-sm text-st-sobrecupo-ink md:px-6">
          <CloudOff className="h-4 w-4 shrink-0" />
          <span><b>Sin actualización en vivo.</b> Los datos pueden estar desactualizados; última actualización {time.format(snapshot.now)}. Reintentando…</span>
        </div>
      )}
      {emulated.length > 0 && !dismissed && (
        <div role="status" className="flex items-center gap-2 border-b border-ucc-lima/70 bg-[color-mix(in_oklab,var(--color-ucc-lima)_16%,var(--color-sheet))] px-4 py-1.5 text-sm text-st-subutilizado-ink md:px-6">
          <FlaskConical className="h-4 w-4 shrink-0" />
          {emulated.length > 3
            ? <span><b>Demo emulada.</b> {emulated.length} salones reciben datos de la <a href="#/simulacion" className="underline">simulación del campus</a>, no de cámaras reales.</span>
            : <span><b>Piloto emulada.</b> {emulated.join(', ')} {emulated.length === 1 ? 'recibe' : 'reciben'} datos emulados, no de una cámara real.</span>}
          <button type="button" onClick={dismiss} aria-label="Cerrar el aviso de datos emulados" className="ml-auto shrink-0 rounded p-0.5 hover:bg-black/5"><X className="h-4 w-4" /></button>
        </div>
      )}
    </>
  );
}
