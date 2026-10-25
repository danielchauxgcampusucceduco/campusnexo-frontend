import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { describeError, useTwin } from '../../application/TwinContext';
import { ALERT_TYPES, type Alert, type AlertType } from '../../domain/model';
import { navigate, useStage } from '../StageContext';
import { ALERT_LABEL, SEVERITY_META } from '../theme';

const REFRESH_MS = 15_000;
const time = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Bogota' });

/**
 * What the backend flagged, newest first: CO₂, overcrowding, energy in empty rooms, unused bookings, computers
 * on without anyone, missing chairs or desks and sensors reading out of pattern. Refreshed every 15 s.
 */
export function AlertsView() {
  const { operaciones } = useTwin();
  const { selectSpace } = useStage();
  const [type, setType] = useState<AlertType | ''>('');
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAlerts(await operaciones.alertas(type ? { type } : {}));
      setError(null);
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setLoading(false);
    }
  }, [operaciones, type]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  return (
    <section aria-labelledby="alerts-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="alerts-title" tabIndex={-1} className="lettering text-2xl font-semibold">Alertas</h1>
          <p className="mt-1 max-w-[70ch] text-sm text-ink-soft">Lo que el sistema detectó en los salones, de la más reciente a la más antigua. Toca un salón para verlo.</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <label>
            <span className="sr-only">Tipo de alerta</span>
            <select value={type} onChange={(event) => setType(event.target.value as AlertType | '')} className="rounded-lg border border-rule bg-sheet px-2.5 py-1.5">
              <option value="">Todos los tipos</option>
              {ALERT_TYPES.map((t) => <option key={t} value={t}>{ALERT_LABEL[t]}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => void load()} disabled={loading} aria-label="Actualizar"
            className="grid h-9 w-9 place-items-center rounded-lg border border-rule bg-sheet hover:bg-white disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && <p role="alert" className="rounded-lg border border-st-sobrecupo/40 bg-[#fdeeea] px-3 py-2 text-sm text-st-sobrecupo-ink">{error}</p>}
      {alerts === null && !error && <p className="text-sm text-ink-soft">Cargando alertas…</p>}
      {alerts?.length === 0 && <p className="text-sm text-ink-soft">No hay alertas{type ? ' de este tipo' : ''}.</p>}
      {alerts && alerts.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-rule bg-sheet">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-ink-soft">
              <tr className="border-b border-rule">
                <th className="px-3 py-2 font-normal">Detectada</th>
                <th className="px-3 py-2 font-normal">Salón</th>
                <th className="px-3 py-2 font-normal">Tipo</th>
                <th className="px-3 py-2 font-normal">Severidad</th>
                <th className="px-3 py-2 font-normal">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert) => {
                const severity = SEVERITY_META[alert.severity];
                return (
                  <tr key={alert.alertId} className="border-b border-rule/70 align-top">
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-ink-soft">{time.format(Date.parse(alert.detectedAt))}</td>
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => { selectSpace(alert.spaceId); navigate('salon'); }} className="condensed font-medium text-st-optimo-ink hover:underline">{alert.spaceId}</button>
                    </td>
                    <td className="px-3 py-2 font-medium">{ALERT_LABEL[alert.type]}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium" style={{ color: severity.ink, background: `color-mix(in oklab, ${severity.color} 14%, transparent)` }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: severity.color }} />{severity.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-ink-soft">{alert.message}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
