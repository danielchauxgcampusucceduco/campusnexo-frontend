import { Armchair, Check, Cpu, Monitor, RefreshCw, Table2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useRequest, useTwin } from '../../../application/TwinContext';
import type { EmparejamientoCpu, Puesto, PuestoPropuesto, RevisionDePuestos } from '../../../domain/model';
import { useStage } from '../../StageContext';
import { ACTIVO_LABEL } from '../../theme';

const time = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Bogota' });

/** Same label as PuestoPropuesto.etiqueta(): row letter and column number, A1 at the front left. */
export const etiqueta = (p: { fila: number; columna: number }) => `${String.fromCharCode(64 + p.fila)}${p.columna}`;

/** Seconds of an EmparejamientoCpu slot, whether Jackson wrote it as a number or as an ISO-8601 duration. */
export function seconds(ranura: string | number): number {
  if (typeof ranura === 'number') return ranura;
  const match = /^PT(?:(\d+)M)?(?:([\d.]+)S)?$/.exec(ranura);
  return match ? Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0) : Number.NaN;
}

function Pairing({ pairing }: { pairing: EmparejamientoCpu }) {
  const slot = seconds(pairing.ranura);
  const start = Date.parse(pairing.inicio);
  const end = start + slot * 1000 * pairing.cpus.length;
  return (
    <p className="text-sm text-ink-soft">
      Emparejamiento de {pairing.cpus.length} CPU: de {time.format(start)} a {time.format(end)}, {slot} s por equipo. Cada PC muestra su patrón en su ranura y la cámara anota en qué puesto lo vio.
    </p>
  );
}

function SeatCell({ seat, discarded, onToggle, adds }: { seat: PuestoPropuesto; discarded: boolean; onToggle: () => void; adds: boolean }) {
  const label = etiqueta(seat);
  const incomplete = !seat.silla || !seat.mesa;
  return (
    <button type="button" onClick={onToggle} disabled={!adds} aria-pressed={adds && !discarded}
      title={`${label}: ${[seat.monitor && 'monitor', seat.silla && 'silla', seat.mesa && 'mesa', seat.cpu && `CPU ${seat.cpu}`].filter(Boolean).join(', ') || 'nada'}${adds ? (discarded ? ' · descartado' : ' · se registrará') : ' · ya registrado'}`}
      className={`flex flex-col items-center gap-0.5 rounded-lg border p-1.5 text-xs transition-colors ${discarded ? 'border-dashed border-rule opacity-50' : incomplete ? 'border-st-subutilizado bg-[color-mix(in_oklab,var(--color-st-subutilizado)_14%,transparent)]' : adds ? 'border-signal bg-white' : 'border-rule bg-paper'}`}>
      <span className="font-semibold">{label}</span>
      <span className="flex gap-0.5 text-ink-soft">
        <Monitor className={`h-3.5 w-3.5 ${seat.monitor ? 'text-ink' : 'opacity-25'}`} />
        <Armchair className={`h-3.5 w-3.5 ${seat.silla ? 'text-ink' : 'opacity-25'}`} />
        <Table2 className={`h-3.5 w-3.5 ${seat.mesa ? 'text-ink' : 'opacity-25'}`} />
        <Cpu className={`h-3.5 w-3.5 ${seat.cpu ? 'text-st-optimo-ink' : 'opacity-25'}`} />
      </span>
    </button>
  );
}

/**
 * Workstations of a room (Composite: CPU, chair and desk at one seat). The camera proposes them with the room
 * empty; each PC is paired with its seat by a pattern on its own monitor; the administrator reviews what the
 * proposal adds, discards what is wrong and confirms. Nothing reaches the inventory before that.
 */
export function Puestos() {
  const { operaciones, snapshot, notify } = useTwin();
  const { selectedSpace, selectSpace } = useStage();
  const { pending, run } = useRequest();
  const rooms = snapshot.twins.filter((t) => t.space.seatRows !== null).map((t) => t.space);
  const spaceId = rooms.some((r) => r.spaceId === selectedSpace) ? selectedSpace : rooms[0]?.spaceId ?? '';
  const [revision, setRevision] = useState<RevisionDePuestos | null | undefined>(undefined);
  const [puestos, setPuestos] = useState<Puesto[]>([]);
  const [discarded, setDiscarded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!spaceId) return;
    const [nextRevision, nextPuestos] = await Promise.all([
      run(() => operaciones.propuesta(spaceId)),
      run(() => operaciones.puestos(spaceId)),
    ]);
    if (nextRevision !== undefined) setRevision(nextRevision);
    if (nextPuestos) setPuestos(nextPuestos);
  }, [operaciones, spaceId, run]);

  useEffect(() => {
    setRevision(undefined);
    setDiscarded(new Set());
    void load();
  }, [load]);

  const pair = async () => {
    const pairing = await run(() => operaciones.emparejar(spaceId), 'Emparejamiento programado.');
    if (pairing) void load();
  };

  const confirm = async () => {
    const altas = await run(() => operaciones.confirmar(spaceId, [...discarded]));
    if (altas) {
      notify('info', `${altas.length} ${altas.length === 1 ? 'puesto registrado' : 'puestos registrados'} en ${spaceId}.`);
      setDiscarded(new Set());
      void load();
    }
  };

  const adds = new Set(revision?.altas.map((a) => a.etiqueta) ?? []);
  const columns = rooms.find((r) => r.spaceId === spaceId)?.seatColumns ?? 6;
  const toggle = (label: string) => setDiscarded((current) => {
    const next = new Set(current);
    if (!next.delete(label)) next.add(label);
    return next;
  });
  const toAdd = [...adds].filter((label) => !discarded.has(label)).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Puestos de trabajo</h2>
        <div className="flex items-center gap-2 text-sm">
          <select value={spaceId} onChange={(e) => selectSpace(e.target.value)} aria-label="Salón" className="rounded-lg border border-rule bg-sheet px-2.5 py-1.5">
            {rooms.map((r) => <option key={r.spaceId} value={r.spaceId}>{r.spaceId} · {r.name}</option>)}
          </select>
          <button type="button" onClick={() => void load()} disabled={pending} aria-label="Actualizar"
            className="grid h-9 w-9 place-items-center rounded-lg border border-rule bg-sheet hover:bg-white disabled:opacity-50"><RefreshCw className="h-4 w-4" /></button>
        </div>
      </div>

      <section aria-labelledby="propuesta-title" className="rounded-2xl border border-rule bg-sheet p-4">
        <h3 id="propuesta-title" className="font-semibold">Propuesta de la cámara</h3>
        {revision === undefined && <p className="mt-2 text-sm text-ink-soft">Cargando…</p>}
        {revision === null && (
          <p className="mt-2 text-sm text-ink-soft">
            La cámara aún no ha propuesto puestos para {spaceId}. Con el salón vacío, el borde corre <code className="rounded bg-paper px-1">yolo_edge_publisher.py --descubrir</code> y la propuesta aparece aquí.
          </p>
        )}
        {revision && (
          <div className="mt-2 flex flex-col gap-3">
            <p className="text-sm text-ink-soft">
              Recibida a las {time.format(Date.parse(revision.propuesta.recibidaAt))}{revision.propuesta.emulada ? ' (datos emulados)' : ''}: {revision.propuesta.puestos.length} puestos vistos,
              {' '}{revision.altas.length} por registrar, {revision.incompletos.length} incompletos (sin silla o sin mesa). Toca un puesto para descartarlo.
            </p>
            <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
              {[...revision.propuesta.puestos].sort((a, b) => a.fila - b.fila || a.columna - b.columna).map((seat) => {
                const label = etiqueta(seat);
                return <SeatCell key={label} seat={seat} adds={adds.has(label)} discarded={discarded.has(label)} onToggle={() => toggle(label)} />;
              })}
            </div>
            <p className="text-xs text-ink-soft">Frente del salón arriba. Íconos: monitor, silla, mesa, CPU emparejada. Amarillo: incompleto.</p>
            {revision.cpusSinPuesto.length > 0 && (
              <p className="text-sm">CPU que reportan desde el salón sin puesto: <span className="condensed">{revision.cpusSinPuesto.join(', ')}</span></p>
            )}
            {revision.emparejamiento && <Pairing pairing={revision.emparejamiento} />}
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={pending || revision.cpusSinPuesto.length === 0} onClick={() => void pair()}
                className="rounded-lg border border-rule px-3 py-1.5 text-sm font-medium hover:bg-white disabled:opacity-50">Emparejar CPU</button>
              <button type="button" disabled={pending || toAdd === 0} onClick={() => void confirm()}
                className="flex items-center gap-1.5 rounded-lg bg-night px-3 py-1.5 text-sm font-medium text-night-text disabled:opacity-50">
                <Check className="h-4 w-4" />Confirmar {toAdd} {toAdd === 1 ? 'puesto' : 'puestos'}
              </button>
            </div>
          </div>
        )}
      </section>

      <section aria-labelledby="registrados-title">
        <h3 id="registrados-title" className="font-semibold">Registrados ({puestos.length})</h3>
        {puestos.length === 0
          ? <p className="mt-2 text-sm text-ink-soft">Ningún puesto registrado en {spaceId}.</p>
          : (
            <div className="mt-2 overflow-x-auto rounded-2xl border border-rule bg-sheet">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="text-ink-soft">
                  <tr className="border-b border-rule">
                    <th className="px-3 py-2 font-normal">Puesto</th>
                    <th className="px-3 py-2 font-normal">Activos</th>
                    <th className="px-3 py-2 font-normal">Ahora</th>
                    <th className="px-3 py-2 font-normal">Faltantes</th>
                  </tr>
                </thead>
                <tbody>
                  {puestos.map((p) => (
                    <tr key={p.codigo} className="border-b border-rule/70 align-top">
                      <td className="px-3 py-2"><span className="font-medium">{p.numero}</span><span className="condensed block text-xs text-ink-soft">{p.codigo}</span></td>
                      <td className="px-3 py-2 text-ink-soft">{p.activos.map((a) => `${ACTIVO_LABEL[a.tipo]} ${a.codigo}${a.fueraDeServicio ? ' (fuera de servicio)' : ''}`).join(' · ')}</td>
                      <td className="px-3 py-2">
                        {p.cpuSinUsuario
                          ? <span className="font-medium text-st-subutilizado-ink">CPU encendida sin usuario</span>
                          : <>{p.ocupado ? 'Ocupado' : 'Libre'}{p.cpuEncendida ? ' · CPU encendida' : ''}</>}
                      </td>
                      <td className={`px-3 py-2 ${p.faltantes.length > 0 ? 'font-medium text-st-sobrecupo-ink' : 'text-ink-soft'}`}>
                        {p.faltantes.length > 0 ? p.faltantes.map((t) => ACTIVO_LABEL[t]).join(', ') : 'completo'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </section>
    </div>
  );
}
