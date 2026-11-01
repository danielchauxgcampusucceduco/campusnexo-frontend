import { ChevronDown, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { describeError, useSpaceName, useTwin } from '../../application/TwinContext';
import { ALERT_TYPES, type Alert, type AlertType } from '../../domain/model';
import { navigate, useStage } from '../StageContext';
import { ALERT_LABEL, SEVERITY_META } from '../theme';

const REFRESH_MS = 15_000;
/** Alerts of the same type and severity raised this close together are one event seen in several rooms. */
const GROUP_WINDOW_MS = 60_000;
const time = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Bogota' });

interface Group {
  key: string;
  first: Alert;
  alerts: Alert[];
}

/** Consecutive alerts (newest first) of the same type and severity within the window become one group. */
export function groupAlerts(alerts: readonly Alert[]): Group[] {
  const groups: Group[] = [];
  for (const alert of alerts) {
    const last = groups.at(-1);
    if (last && last.first.type === alert.type && last.first.severity === alert.severity
        && Date.parse(last.first.detectedAt) - Date.parse(alert.detectedAt) <= GROUP_WINDOW_MS) {
      last.alerts.push(alert);
    } else {
      groups.push({ key: alert.alertId, first: alert, alerts: [alert] });
    }
  }
  return groups;
}

/**
 * What the backend flagged, newest first: CO₂, overcrowding, energy in empty rooms, unused bookings, computers
 * on without anyone, missing chairs or desks, sensors reading out of pattern and cameras without signal. The same
 * event in several rooms is one row («12 salones: cámara sin señal»); older pages load on demand. The first page
 * refreshes every 15 s while no older page is open.
 */
export function AlertsView() {
  const { operaciones } = useTwin();
  const spaceName = useSpaceName();
  const { selectSpace } = useStage();
  const [type, setType] = useState<AlertType | ''>('');
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [morePages, setMorePages] = useState(false);
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const page = await operaciones.alertas(type ? { type } : {});
      setAlerts(page.items);
      setNext(page.next);
      setMorePages(false);
      setError(null);
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setLoading(false);
    }
  }, [operaciones, type]);

  const loadMore = async () => {
    if (!next) return;
    setLoading(true);
    try {
      const page = await operaciones.alertas(type ? { type } : {}, next);
      setAlerts((current) => [...(current ?? []), ...page.items]);
      setNext(page.next);
      setMorePages(true);
      setError(null);
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (morePages) return undefined;
    const id = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(id);
  }, [load, morePages]);

  const toggle = (key: string) => setOpen((current) => {
    const nextOpen = new Set(current);
    if (!nextOpen.delete(key)) nextOpen.add(key);
    return nextOpen;
  });
  const openRoom = (spaceId: string) => {
    selectSpace(spaceId);
    navigate('salon');
  };
  const groups = groupAlerts(alerts ?? []);

  return (
    <section aria-labelledby="alerts-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="alerts-title" tabIndex={-1} className="lettering text-2xl font-semibold">Alertas</h1>
          <p className="mt-1 max-w-[70ch] text-sm text-ink-soft">Lo que el sistema detectó en los salones, de la más reciente a la más antigua. Un mismo evento en varios salones aparece agrupado. Toca un salón para verlo.</p>
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
            className="grid h-9 w-9 place-items-center rounded-lg border border-rule bg-sheet hover:bg-field disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && <p role="alert" className="rounded-lg border border-st-sobrecupo/40 bg-alert-bg px-3 py-2 text-sm text-st-sobrecupo-ink">{error}</p>}
      {alerts === null && !error && <p className="text-sm text-ink-soft">Cargando alertas…</p>}
      {alerts?.length === 0 && <p className="text-sm text-ink-soft">No hay alertas{type ? ' de este tipo' : ''}.</p>}
      {groups.length > 0 && (
        <>
          <ol className="flex flex-col gap-2 md:hidden" aria-label="Alertas">
            {groups.map((group) => (
              <li key={group.key} className="rounded-xl border border-rule bg-sheet p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{ALERT_LABEL[group.first.type]}</span>
                  <Severity alert={group.first} />
                </div>
                <p className="mt-0.5 text-xs tabular-nums text-ink-soft">{time.format(Date.parse(group.first.detectedAt))}</p>
                <Rooms group={group} open={open.has(group.key)} onToggle={() => toggle(group.key)} spaceName={spaceName} onRoom={openRoom} />
                <p className="mt-1 text-ink-soft">{group.first.message}</p>
              </li>
            ))}
          </ol>
          <div className="hidden rounded-2xl border border-rule bg-sheet md:block">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="text-ink-soft">
                <tr className="border-b border-rule">
                  <th className="w-36 px-3 py-2 font-normal">Detectada</th>
                  <th className="w-56 px-3 py-2 font-normal">Salón</th>
                  <th className="w-44 px-3 py-2 font-normal">Tipo</th>
                  <th className="w-32 px-3 py-2 font-normal">Severidad</th>
                  <th className="px-3 py-2 font-normal">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <tr key={group.key} className="border-b border-rule/70 align-top">
                    <td className="px-3 py-2 tabular-nums text-ink-soft">{time.format(Date.parse(group.first.detectedAt))}</td>
                    <td className="px-3 py-2"><Rooms group={group} open={open.has(group.key)} onToggle={() => toggle(group.key)} spaceName={spaceName} onRoom={openRoom} /></td>
                    <td className="px-3 py-2 font-medium">{ALERT_LABEL[group.first.type]}</td>
                    <td className="px-3 py-2"><Severity alert={group.first} /></td>
                    <td className="break-words px-3 py-2 text-ink-soft">{group.first.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {next && (
            <button type="button" onClick={() => void loadMore()} disabled={loading}
              className="self-center rounded-lg border border-rule bg-sheet px-4 py-2 text-sm font-medium hover:bg-field disabled:opacity-50">
              {loading ? 'Cargando…' : 'Cargar alertas anteriores'}
            </button>
          )}
        </>
      )}
    </section>
  );
}

function Severity({ alert }: { alert: Alert }) {
  const severity = SEVERITY_META[alert.severity];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium" style={{ color: severity.ink, background: `color-mix(in oklab, ${severity.color} 14%, transparent)` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: severity.color }} />{severity.label}
    </span>
  );
}

/** One room, or «N salones» that unfolds into the list of rooms of the group. */
function Rooms({ group, open, onToggle, spaceName, onRoom }: {
  group: Group; open: boolean; onToggle: () => void; spaceName: (spaceId: string) => string; onRoom: (spaceId: string) => void;
}) {
  const rooms = [...new Set(group.alerts.map((a) => a.spaceId))];
  const room = (spaceId: string) => (
    <button key={spaceId} type="button" title={spaceId} onClick={() => onRoom(spaceId)} className="text-left font-medium text-st-optimo-ink hover:underline">{spaceName(spaceId)}</button>
  );
  if (rooms.length === 1) return room(rooms[0]!);
  return (
    <div>
      <button type="button" aria-expanded={open} onClick={onToggle} className="flex items-center gap-1 font-medium hover:underline">
        {rooms.length} salones<ChevronDown aria-hidden className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <ul className="mt-1 flex flex-col gap-0.5">{rooms.map((spaceId) => <li key={spaceId}>{room(spaceId)}</li>)}</ul>}
    </div>
  );
}
