import { BellRing, CalendarClock, DoorOpen } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTwin } from '../../application/TwinContext';
import type { Alert, DisponibilidadDelCampus, EspacioDisponible, EstadoFranja, SpaceType } from '../../domain/model';
import { ESTADOS_FRANJA } from '../../domain/model';
import { navigate, useStage } from '../StageContext';
import { FRANJA_META, SPACE_TYPE_LABEL } from '../theme';

const POLL_MS = 30_000;

/** "07:00:00" → "7:00". */
export const hora = (hhmmss: string) => hhmmss.slice(0, 5).replace(/^0/, '');

const libre = (estado: EstadoFranja | null | undefined) => estado === 'LIBRE' || estado === 'PROGRAMADO_SIN_USO';

/** The spaces free right now, the ones that stay free longest first. */
export function libresAhora(espacios: EspacioDisponible[]): EspacioDisponible[] {
  return espacios
    .filter((e) => libre(e.ahora))
    .sort((a, b) => (b.libreHasta ?? '99').localeCompare(a.libreHasta ?? '99') || a.nombre.localeCompare(b.nombre, 'es', { numeric: true }));
}

/** Free spaces in slot `i`, counting a class nobody attended as free. */
export const libresEnFranja = (espacios: EspacioDisponible[], i: number) => espacios.filter((e) => libre(e.franjas[i]?.estado)).length;

const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Which student spaces are free, and when: every space × every hour of the day from the timetable, the bookings
 * and, for the current hour, what the camera sees. For the staff, the classes nobody attended (HORARIO_SIN_USO).
 */
export function DisponibilidadView() {
  const { operaciones, gateway } = useTwin();
  const { selectSpace } = useStage();
  const [fecha, setFecha] = useState(hoy);
  const [datos, setDatos] = useState<DisponibilidadDelCampus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tipo, setTipo] = useState<'todos' | SpaceType>('todos');
  const [piso, setPiso] = useState<'todos' | number>('todos');
  const [avisos, setAvisos] = useState<Alert[]>([]);
  const staff = gateway.capabilities.operations;

  useEffect(() => {
    let alive = true;
    const load = () => operaciones.disponibilidad(fecha).then(
      (d) => { if (alive) { setDatos(d); setError(null); } },
      (failure: unknown) => { if (alive) setError(failure instanceof Error ? failure.message : String(failure)); },
    );
    void load();
    const timer = setInterval(load, POLL_MS);
    return () => { alive = false; clearInterval(timer); };
  }, [operaciones, fecha]);

  useEffect(() => {
    if (!staff) return;
    let alive = true;
    operaciones.alertas({ type: 'HORARIO_SIN_USO' }).then((page) => { if (alive) setAvisos(page.items.slice(0, 8)); }, () => {});
    return () => { alive = false; };
  }, [operaciones, staff, datos?.generadoEn]);

  const tipos = useMemo(() => [...new Set((datos?.espacios ?? []).map((e) => e.tipo))], [datos]);
  const pisos = useMemo(() => [...new Set((datos?.espacios ?? []).map((e) => e.piso))].sort((a, b) => a - b), [datos]);
  const espacios = useMemo(() => (datos?.espacios ?? [])
    .filter((e) => (tipo === 'todos' || e.tipo === tipo) && (piso === 'todos' || e.piso === piso))
    .sort((a, b) => a.piso - b.piso || a.nombre.localeCompare(b.nombre, 'es', { numeric: true })), [datos, tipo, piso]);

  const abrir = (spaceId: string) => { selectSpace(spaceId); navigate('campus'); };
  const esHoy = fecha === hoy();
  const franjas = datos?.espacios[0]?.franjas ?? [];
  const ahora = new Date().toTimeString().slice(0, 8);
  const ahoraIdx = esHoy ? franjas.findIndex((f) => f.desde <= ahora && ahora < f.hasta) : -1;
  const libres = libresAhora(espacios);

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="disp-title">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 id="disp-title" tabIndex={-1} className="lettering flex items-center gap-2 text-2xl font-semibold">
              <CalendarClock className="h-6 w-6" />Disponibilidad de espacios
            </h1>
            <p className="view-intro mt-1 max-w-[70ch] text-sm text-ink-soft">
              Los espacios a los que puede entrar un estudiante, hora por hora. Cada franja sale del horario académico, de las reservas
              y, en la hora actual, de lo que ve la cámara. Una clase a la que nadie llegó en 15 minutos cuenta como libre y se avisa a la administración.
            </p>
          </div>
          <label className="text-sm">
            <span className="mr-2 text-ink-soft">Fecha</span>
            <input type="date" value={fecha} onChange={(event) => event.target.value && setFecha(event.target.value)}
              className="rounded-lg border border-rule bg-sheet px-2.5 py-1.5" />
          </label>
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-st-sobrecupo-ink">No se pudo cargar la disponibilidad: {error}</p>}
      </section>

      {!datos ? (
        !error && <p className="text-sm text-ink-soft">Cargando la disponibilidad…</p>
      ) : (
        <>
          <section aria-labelledby="disp-libres" className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
            <div>
              <h2 id="disp-libres" className="flex items-center gap-2 text-lg font-semibold"><DoorOpen className="h-5 w-5" />
                {esHoy ? `Libres ahora (${libres.length})` : `Disponibilidad del ${fecha}`}
              </h2>
              {!esHoy ? (
                <p className="mt-2 text-sm text-ink-soft">En otra fecha no hay cámara: la cuadrícula muestra lo que dicen el horario y las reservas.</p>
              ) : libres.length === 0 ? (
                <p className="mt-2 text-sm text-ink-soft">Ningún espacio libre con los filtros elegidos.</p>
              ) : (
                <ul className="stagger mt-3 grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
                  {libres.slice(0, 18).map((e) => (
                    <li key={e.spaceId}>
                      <button type="button" onClick={() => abrir(e.spaceId)} className="lift w-full rounded-lg border border-rule p-3 text-left text-sm hover:bg-sheet">
                        <span className="block font-semibold">{e.nombre}</span>
                        <span className="block text-ink-soft">{SPACE_TYPE_LABEL[e.tipo]} · piso {e.piso} · aforo {e.aforo}</span>
                        <span className="mt-1 block font-medium" style={{ color: FRANJA_META[e.ahora ?? 'LIBRE'].ink }}>
                          {e.libreHasta ? `Libre hasta las ${hora(e.libreHasta)}` : 'Libre el resto del día'}
                          {e.ahora === 'PROGRAMADO_SIN_USO' ? ' · clase sin asistentes' : ''}
                          {!e.conCamara ? ' · sin cámara' : ''}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {staff && (
              <aside aria-labelledby="disp-avisos" className="rounded-2xl border border-rule bg-sheet p-4">
                <h2 id="disp-avisos" className="flex items-center gap-2 text-base font-semibold"><BellRing className="h-4 w-4" />Clases sin asistentes</h2>
                <p className="text-xs text-ink-soft">Alertas para la administración: salones programados que quedaron libres.</p>
                {avisos.length === 0
                  ? <p className="mt-2 text-sm text-ink-soft">Ninguna por ahora.</p>
                  : (
                    <ul className="mt-2 flex flex-col gap-2 text-sm">
                      {avisos.map((a) => (
                        <li key={a.alertId} className="border-b border-rule/60 pb-2 last:border-0">
                          <button type="button" onClick={() => abrir(a.spaceId)} className="text-left hover:underline">
                            <b>{a.spaceId}</b> · {new Date(a.detectedAt).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })}
                          </button>
                          <p className="text-ink-soft">{a.message}</p>
                        </li>
                      ))}
                    </ul>
                  )}
              </aside>
            )}
          </section>

          <section aria-labelledby="disp-horario">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="disp-horario" className="text-lg font-semibold">Franjas del día ({espacios.length} espacios)</h2>
              <div className="flex flex-wrap gap-2 text-sm">
                <label><span className="mr-1 text-ink-soft">Tipo</span>
                  <select value={tipo} onChange={(event) => setTipo(event.target.value as 'todos' | SpaceType)} className="rounded-lg border border-rule bg-sheet px-2 py-1">
                    <option value="todos">Todos</option>
                    {tipos.map((t) => <option key={t} value={t}>{SPACE_TYPE_LABEL[t]}</option>)}
                  </select>
                </label>
                <label><span className="mr-1 text-ink-soft">Piso</span>
                  <select value={String(piso)} onChange={(event) => setPiso(event.target.value === 'todos' ? 'todos' : Number(event.target.value))} className="rounded-lg border border-rule bg-sheet px-2 py-1">
                    <option value="todos">Todos</option>
                    {pisos.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </label>
              </div>
            </div>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
              {ESTADOS_FRANJA.map((estado) => (
                <li key={estado} className="flex items-center gap-1.5" title={FRANJA_META[estado].hint}>
                  <span className="h-3 w-3 rounded-sm" style={{ background: FRANJA_META[estado].color }} />{FRANJA_META[estado].label}
                </li>
              ))}
            </ul>
            <div className="mt-3 overflow-x-auto rounded-lg border border-rule">
              <table className="w-full min-w-[920px] border-collapse text-xs">
                <caption className="sr-only">Estado de cada espacio para estudiantes por hora del {fecha}</caption>
                <thead>
                  <tr className="bg-sheet">
                    <th scope="col" className="sticky left-0 bg-sheet px-2 py-1.5 text-left font-semibold">Espacio</th>
                    {franjas.map((f, i) => (
                      <th key={f.desde} scope="col" className={`px-1 py-1.5 text-center font-medium ${i === ahoraIdx ? 'text-ink' : 'text-ink-soft'}`}>
                        {hora(f.desde)}{i === ahoraIdx && <span className="block text-[10px] font-semibold text-signal">ahora</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {espacios.map((e) => (
                    <tr key={e.spaceId} className="border-t border-rule">
                      <th scope="row" className="sticky left-0 bg-sheet px-2 py-1 text-left font-normal">
                        <button type="button" onClick={() => abrir(e.spaceId)} className="max-w-[220px] truncate text-left hover:underline">{e.nombre}</button>
                      </th>
                      {e.franjas.map((f, i) => {
                        const meta = FRANJA_META[f.estado];
                        const titulo = [meta.label, f.detalle].filter(Boolean).join(' · ');
                        // Text besides the colour, so the grid reads without telling colours apart.
                        const marca = f.estado === 'PROGRAMADO_SIN_USO' ? '∅' : f.estado === 'CLASE' ? (f.detalle?.split(' · ').at(-1) ?? 'C')
                          : f.estado === 'RESERVADO' ? 'R' : f.estado === 'OCUPADO' ? '●' : '';
                        return (
                          <td key={f.desde} className="px-0.5 py-0.5">
                            <span title={titulo} aria-label={`${e.nombre}, ${hora(f.desde)}: ${titulo}`}
                              className={`flex h-6 w-full items-center justify-center truncate rounded-sm text-[10px] font-semibold text-ucc-marino ${i === ahoraIdx ? 'ring-2 ring-night ring-offset-1' : ''}`}
                              style={{ background: meta.color, opacity: ahoraIdx >= 0 && i < ahoraIdx ? 0.45 : 1 }}>
                              {marca}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr className="border-t-2 border-rule bg-sheet font-semibold">
                    <th scope="row" className="sticky left-0 bg-sheet px-2 py-1.5 text-left">Libres en la franja</th>
                    {franjas.map((f, i) => (
                      <td key={f.desde} className="px-1 py-1.5 text-center tabular-nums" style={{ color: 'var(--color-st-libre-ink)' }}>{libresEnFranja(espacios, i)}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
