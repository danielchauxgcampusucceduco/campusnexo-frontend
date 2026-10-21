import { CloudOff, FlaskConical } from 'lucide-react';
import { useTwin } from '../../application/TwinContext';

const time = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Bogota' });

/**
 * Always says where the data comes from when it is not the live campus: the in-browser simulation, or a
 * backend whose live feed dropped (then the figures may be stale). It cannot be dismissed.
 */
export function DataSourceBanner() {
  const { gateway, snapshot } = useTwin();
  if (gateway.mode === 'simulation') {
    return (
      <div role="status" className="flex items-center gap-2 border-b border-[#e8c46a] bg-[#fff7e0] px-4 py-1.5 text-sm text-[#7a5508] md:px-6">
        <FlaskConical className="h-4 w-4 shrink-0" />
        <span><b>Simulación.</b> Estos datos los genera este navegador; no vienen de los sensores del campus.</span>
      </div>
    );
  }
  if (snapshot.connection === 'degraded' || snapshot.connection === 'offline') {
    return (
      <div role="alert" className="flex items-center gap-2 border-b border-[#f1b5a8] bg-[#fdeeea] px-4 py-1.5 text-sm text-st-sobrecupo-ink md:px-6">
        <CloudOff className="h-4 w-4 shrink-0" />
        <span><b>Sin actualización en vivo.</b> Los datos pueden estar desactualizados; última actualización {time.format(snapshot.now)}. Reintentando…</span>
      </div>
    );
  }
  return null;
}
