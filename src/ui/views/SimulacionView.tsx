import { CameraOff, FlaskConical, LogOut, Play } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTwin } from '../../application/TwinContext';
import { BackendError } from '../../adapters/backend/http';
import { formatNumber } from '../../domain/kpis';
import type { DemoSnapshot, ProgramaDemo, SalaDemo, SpaceType, UsoDemo } from '../../domain/model';
import { navigate } from '../StageContext';
import { SPACE_TYPE_LABEL } from '../theme';

const POLL_MS = 3_000;

const USO_META: Record<UsoDemo, { label: string; color: string; ink: string }> = {
  CLASE: { label: 'Clase', color: 'var(--color-st-optimo)', ink: 'var(--color-st-optimo-ink)' },
  RESERVA_SIN_USO: { label: 'Programado, nadie llegó', color: 'var(--color-st-noshow)', ink: 'var(--color-st-noshow-ink)' },
  LIBRE: { label: 'Libre', color: 'var(--color-st-libre)', ink: 'var(--color-st-libre-ink)' },
};

const FILTROS: { id: 'todos' | SpaceType; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'SALA_COMPUTO', label: 'Salas de informática' },
  { id: 'AULA', label: 'Salones' },
  { id: 'LABORATORIO', label: 'Laboratorios' },
  { id: 'AUDITORIO', label: 'Auditorios' },
];

const ORDEN_TIPO: Partial<Record<SpaceType, number>> = { SALA_COMPUTO: 0, AULA: 1, LABORATORIO: 2, AUDITORIO: 3 };

/** The program of a group: `MED4A` is Medicine, fourth semester, group A (`ISW…` is Software Engineering). */
export function programaDe(grupo: string, programas: ProgramaDemo[]): ProgramaDemo | undefined {
  return programas.find((p) => grupo.startsWith(p.codigo) && /\d/.test(grupo.charAt(p.codigo.length)));
}

/** Whether the room has any class of that program on the simulated day. */
export const tieneClaseDe = (sala: SalaDemo, codigo: string, programas: ProgramaDemo[]) =>
  sala.horario.some((b) => b.curso !== null && programaDe(b.curso.split(' · ').at(-1) ?? '', programas)?.codigo === codigo);

/** The group of a timetable label ("Patrones de Software · 4A" → "4A"), shown in the grid cell. */
const grupoDe = (curso: string | null) => curso?.split(' · ').at(-1) ?? '';

/**
 * Leaves the simulation for the live campus. For the staff it also stops the demo and erases what it emulated
 * (telemetry, alerts, history), so no emulated figure stays; a viewer only leaves the screen.
 */
function SalirDeLaSimulacion() {
  const { operaciones, gateway } = useTwin();
  const [saliendo, setSaliendo] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const salir = async () => {
    if (gateway.user.role === 'VIEWER') {
      navigate('campus');
      return;
    }
    setSaliendo(true);
    setFallo(null);
    try {
      await operaciones.salirDeLaDemo();
      navigate('campus');
    } catch (failure) {
      setFallo(failure instanceof Error ? failure.message : String(failure));
      setSaliendo(false);
    }
  };
  return (
    <div className="flex flex-col items-start gap-1">
      <button type="button" onClick={() => void salir()} disabled={saliendo}
        title="Detiene la simulación y borra todos los datos emulados"
        className="flex items-center gap-1.5 rounded-lg border border-rule bg-sheet px-3 py-1.5 text-sm font-medium hover:bg-field disabled:opacity-50">
        <LogOut className="h-4 w-4" />{saliendo ? 'Borrando los datos emulados…' : 'Salir de la simulación'}
      </button>
      {fallo && <p role="alert" className="text-xs text-st-sobrecupo-ink">No se pudieron borrar los datos emulados: {fallo}</p>}
    </div>
  );
}

function useDemo() {
  const { operaciones } = useTwin();
  const [demo, setDemo] = useState<DemoSnapshot | null>(null);
  const [iniciando, setIniciando] = useState(false);
  const [falloAlIniciar, setFalloAlIniciar] = useState<string | null>(null);
  const [error, setError] = useState<BackendError | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => operaciones.demo().then(
      (snapshot) => { if (alive) { setDemo(snapshot); setError(null); } },
      (failure: unknown) => { if (alive) setError(failure instanceof BackendError ? failure : new BackendError(0, String(failure))); },
    );
    load();
    const timer = setInterval(load, POLL_MS);
    return () => { alive = false; clearInterval(timer); };
  }, [operaciones]);
  const iniciar = async () => {
    setIniciando(true);
    setFalloAlIniciar(null);
    try {
      setDemo(await operaciones.iniciarDemo());
    } catch (failure) {
      setFalloAlIniciar(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setIniciando(false);
    }
  };
  return { demo, error, iniciar, iniciando, falloAlIniciar };
}

/** Before anyone starts it: what the simulation does, and the button that starts it (staff only). */
function SinIniciar({ demo, onIniciar, iniciando, fallo }: { demo: DemoSnapshot; onIniciar: () => void; iniciando: boolean; fallo: string | null }) {
  const { gateway } = useTwin();
  const staff = gateway.capabilities.operations;
  return (
    <section aria-labelledby="sim-title" className="max-w-[72ch]">
      <h1 id="sim-title" tabIndex={-1} className="lettering flex items-center gap-2 text-2xl font-semibold">
        Simulación del campus
        <span className="rounded-full border border-rule px-2 py-0.5 text-xs font-medium text-ink-soft">Detenida</span>
      </h1>
      <p className="view-intro mt-2 text-sm text-ink-soft">
        La simulación recorre una semana de {demo.programa} ({demo.programas.length} programas, con todos sus semestres): Ingeniería de Software
        con su horario real y las demás carreras, especializaciones y la maestría con un horario generado. Cada día hábil, de 7:00 a 22:00, pasa en unos
        {' '}{formatNumber(900 / demo.minutosSimuladosPorMinuto, 0)} minutos. Mientras está activa, envía al gemelo frames de cámara
        marcados como <b>emulados</b>, y el campus en vivo, la disponibilidad y las alertas reaccionan como con cámaras reales.
      </p>
      <p className="mt-2 text-sm text-ink-soft">
        Ahora no se emula nada: todo lo que muestra el tablero viene de cámaras reales. Al salir de la simulación se borran todos los datos emulados.
      </p>
      {staff ? (
        <button type="button" onClick={onIniciar} disabled={iniciando}
          className="mt-5 flex items-center gap-2 rounded-xl bg-night px-4 py-2.5 text-sm font-medium text-night-text transition-transform hover:-translate-y-0.5 disabled:opacity-60">
          <Play className="h-4 w-4 text-signal" />{iniciando ? 'Iniciando…' : 'Iniciar simulación'}
        </button>
      ) : (
        <p className="mt-5 rounded-lg bg-sheet px-3 py-2 text-sm">La inicia un operador o un administrador.</p>
      )}
      {fallo && <p role="alert" className="mt-2 text-sm text-st-sobrecupo-ink">No se pudo iniciar la simulación: {fallo}</p>}
    </section>
  );
}

export function SimulacionView() {
  const { demo, error, iniciar, iniciando, falloAlIniciar } = useDemo();
  const [filtro, setFiltro] = useState<'todos' | SpaceType>('todos');
  const [programa, setPrograma] = useState<string>('todos');
  const [elegido, setElegido] = useState<string | null>(null);

  const salones = useMemo(() => (demo?.salones ?? [])
    .filter((s) => filtro === 'todos' || s.tipo === filtro)
    .filter((s) => programa === 'todos' || tieneClaseDe(s, programa, demo?.programas ?? []))
    .sort((a, b) => (ORDEN_TIPO[a.tipo] ?? 9) - (ORDEN_TIPO[b.tipo] ?? 9) || a.nombre.localeCompare(b.nombre, 'es')), [demo, filtro, programa]);

  if (!demo) {
    return (
      <section aria-labelledby="sim-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 id="sim-title" tabIndex={-1} className="lettering text-2xl font-semibold">Simulación del campus</h1>
          <SalirDeLaSimulacion />
        </div>
        <p className="mt-2 max-w-[70ch] text-sm text-ink-soft">
          {error?.status === 404
            ? 'Este servidor corre sin la simulación. Se activa con DEMO_SIMULATION=true en el backend.'
            : error ? `No se pudo cargar la simulación: ${error.message}` : 'Cargando la simulación…'}
        </p>
      </section>
    );
  }

  if (!demo.activa) {
    return <SinIniciar demo={demo} onIniciar={() => void iniciar()} iniciando={iniciando} fallo={falloAlIniciar} />;
  }

  const todos = demo.salones;
  const sala = todos.find((s) => s.spaceId === elegido)
    ?? [...todos].sort((a, b) => b.ahora.hallazgos.length - a.ahora.hallazgos.length)[0]!;
  const libres = todos.filter((s) => s.ahora.uso === 'LIBRE' && s.ahora.personas === 0).length;
  const enUso = todos.filter((s) => s.ahora.personas > 0).length;
  const sinUso = todos.filter((s) => s.ahora.uso === 'RESERVA_SIN_USO').length;
  const sinCamara = todos.filter((s) => !s.ahora.camaraEnLinea).length;
  const conHallazgos = todos.filter((s) => s.ahora.hallazgos.length > 0)
    .sort((a, b) => b.ahora.hallazgos.length - a.ahora.hallazgos.length);

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="sim-title">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 id="sim-title" tabIndex={-1} className="lettering flex items-center gap-2 text-2xl font-semibold">
              Simulación del campus
              <span className="flex items-center gap-1 rounded-full bg-ucc-lima px-2 py-0.5 text-xs font-semibold text-ucc-marino"><FlaskConical className="h-3 w-3" />Emulado</span>
            </h1>
            <p className="view-intro mt-1 max-w-[70ch] text-sm text-ink-soft">
              Una semana de {demo.programa}: cada día hábil, de 7:00 a 22:00, pasa en unos {formatNumber(900 / demo.minutosSimuladosPorMinuto, 0)} minutos,
              con cada grupo de cada semestre en su salón, sus estudiantes y su docente. Ingeniería de Software usa su horario real; las demás
              carreras, especializaciones y la maestría, uno generado sin cruces (pregrado de día, posgrado en la noche). Cada salón tiene una cámara
              que cuenta a las personas; alrededor del horario se simula lo que suele pasar: clases a las que nadie llega y una cámara que se cae.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 text-right">
            <SalirDeLaSimulacion />
            <p className="lettering text-5xl font-semibold tabular-nums">{demo.hora}</p>
            <p className="text-sm text-ink-soft">{demo.diaSemana} · franja {demo.franjas[demo.franjaActual]?.etiqueta}</p>
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Libres ahora" value={libres} of={todos.length} />
          <Kpi label="Con personas" value={enUso} of={todos.length} />
          <Kpi label="Programados sin nadie" value={sinUso} of={todos.length} warn />
          <Kpi label="Cámaras sin señal" value={sinCamara} of={todos.length} warn />
        </dl>
      </section>

      <Programas programas={demo.programas} />

      <section aria-labelledby="sim-horario">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="sim-horario" className="text-lg font-semibold">¿Dónde hay salones libres y en qué horario?</h2>
          <label className="text-xs">
            <span className="mr-1.5 text-ink-soft">Programa</span>
            <select value={programa} onChange={(event) => setPrograma(event.target.value)} className="max-w-[16rem] rounded-lg border border-rule bg-sheet px-2 py-1">
              <option value="todos">Todos ({demo.programas.length})</option>
              {demo.programas.map((p) => <option key={p.codigo} value={p.codigo}>{p.nombre}</option>)}
            </select>
          </label>
          <div role="group" aria-label="Tipo de espacio" className="flex flex-wrap gap-1">
            {FILTROS.map((f) => (
              <button key={f.id} type="button" aria-pressed={filtro === f.id} onClick={() => setFiltro(f.id)}
                className={`rounded-full border px-3 py-1 text-xs ${filtro === f.id ? 'border-night bg-night text-night-text' : 'border-rule text-ink-soft hover:bg-sheet'}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <Leyenda />
        <Horario demo={demo} salones={salones} elegido={sala.spaceId} onElegir={setElegido} />
      </section>

      <section aria-labelledby="sim-sala">
        <div>
          <h2 id="sim-sala" className="text-lg font-semibold">{sala.nombre}</h2>
          <p className="text-sm text-ink-soft">
            {SPACE_TYPE_LABEL[sala.tipo]} · {sala.edificio}, piso {sala.piso} · aforo {sala.aforo} ·{' '}
            <span style={{ color: USO_META[sala.ahora.uso].ink }} className="font-semibold">{USO_META[sala.ahora.uso].label}{sala.ahora.curso ? `: ${sala.ahora.curso}` : ''}</span>
          </p>
          <div className="mt-3 max-w-xl">
            <Camara sala={sala} />
          </div>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span><b>{sala.ahora.personas}</b> personas</span>
            <span>cámara: <b>{sala.ahora.camaraEnLinea ? 'en línea' : 'sin señal'}</b></span>
            <span>{sala.ahora.libreHasta ? <>libre hasta las <b>{sala.ahora.libreHasta}</b></> : 'en clase'}</span>
          </p>
          {sala.ahora.hallazgos.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1 text-sm">
              {sala.ahora.hallazgos.map((h) => <li key={h} className="rounded-md bg-sheet px-2 py-1" style={{ color: 'var(--color-st-noshow-ink)' }}>{h}</li>)}
            </ul>
          )}
        </div>
      </section>

      <section aria-labelledby="sim-ahora">
        <h2 id="sim-ahora" className="text-lg font-semibold">Ahora mismo en el campus</h2>
        {conHallazgos.length === 0
          ? <p className="mt-2 text-sm text-ink-soft">Nada fuera de lo normal en este momento.</p>
          : (
            <ul className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {conHallazgos.map((s) => (
                <li key={s.spaceId}>
                  <button type="button" onClick={() => setElegido(s.spaceId)}
                    className={`w-full rounded-lg border p-3 text-left text-sm hover:bg-sheet ${s.spaceId === sala.spaceId ? 'border-night' : 'border-rule'}`}>
                    <span className="font-semibold">{s.nombre}</span>
                    <ul className="mt-1 list-disc pl-4 text-ink-soft">
                      {s.ahora.hallazgos.map((h) => <li key={h}>{h}</li>)}
                    </ul>
                  </button>
                </li>
              ))}
            </ul>
          )}
      </section>
    </div>
  );
}

function Kpi({ label, value, of, unit, warn }: { label: string; value: number | string; of?: number; unit?: string; warn?: boolean }) {
  return (
    <div className="rounded-lg border border-rule bg-sheet p-3">
      <dt className="text-xs text-ink-soft">{label}</dt>
      <dd className="lettering mt-1 text-3xl font-semibold tabular-nums" style={warn && Number(value) > 0 ? { color: 'var(--color-st-noshow-ink)' } : undefined}>
        {value}{unit && <span className="ml-1 text-base font-normal text-ink-soft">{unit}</span>}
        {of !== undefined && <span className="ml-1 text-base font-normal text-ink-soft">de {of}</span>}
      </dd>
    </div>
  );
}

/** The programs of the simulated campus by level: groups this week, weekly sessions and where their semesters come from. */
function Programas({ programas }: { programas: ProgramaDemo[] }) {
  const niveles = [...new Set(programas.map((p) => p.nivel))];
  const grupos = programas.reduce((total, p) => total + p.grupos, 0);
  const sesiones = programas.reduce((total, p) => total + p.sesionesPorSemana, 0);
  return (
    <section aria-labelledby="sim-programas">
      <details className="rounded-2xl border border-rule bg-sheet p-4">
        <summary className="cursor-pointer list-none">
          <span id="sim-programas" className="text-lg font-semibold">Programas en la simulación</span>
          <span className="ml-2 text-sm text-ink-soft">{programas.length} programas · {grupos} grupos · {sesiones} clases por semana</span>
        </summary>
        <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {niveles.map((nivel) => (
            <div key={nivel}>
              <h3 className="text-sm font-semibold">{nivel}</h3>
              <ul className="mt-1 flex flex-col gap-1 text-sm">
                {programas.filter((p) => p.nivel === nivel).map((p) => (
                  <li key={p.codigo} className="flex items-baseline justify-between gap-3 border-b border-rule/60 py-1">
                    <span>
                      <span className="mr-1.5 rounded bg-paper px-1 font-mono text-[11px] text-ink-soft">{p.codigo}</span>{p.nombre}
                    </span>
                    <span className="shrink-0 text-xs text-ink-soft" title={`Semestres: ${p.fuente}`}>
                      {p.semestres} sem. · {p.grupos} grupos{p.fuente.startsWith('supuesto') ? ' *' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-ink-soft">
          * Semestres supuestos para la simulación; se ajustan en <code>demo/programas-pasto.csv</code> del backend. Solo Ingeniería de Software usa su horario oficial.
        </p>
      </details>
    </section>
  );
}

function Leyenda() {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
      {(Object.keys(USO_META) as UsoDemo[]).map((uso) => (
        <li key={uso} className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ background: USO_META[uso].color }} />{USO_META[uso].label}</li>
      ))}
      <li>Cada celda muestra el grupo en clase; ∅: clase programada a la que nadie llegó.</li>
    </ul>
  );
}

function Horario({ demo, salones, elegido, onElegir }: { demo: DemoSnapshot; salones: SalaDemo[]; elegido: string; onElegir: (id: string) => void }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-rule">
      <table className="w-full min-w-[920px] border-collapse text-xs">
        <caption className="sr-only">Clases de cada salón por hora del {demo.diaSemana.toLowerCase()} simulado</caption>
        <thead>
          <tr className="bg-sheet">
            <th scope="col" className="sticky left-0 bg-sheet px-2 py-1.5 text-left font-semibold">Salón</th>
            {demo.franjas.map((f, i) => (
              <th key={f.etiqueta} scope="col" className={`px-1 py-1.5 text-center font-medium ${i === demo.franjaActual ? 'text-ink' : 'text-ink-soft'}`}>
                <abbr title={f.etiqueta} className="no-underline">{f.desde / 60}:00</abbr>{i === demo.franjaActual && <span className="block text-[10px] font-semibold text-signal">ahora</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {salones.map((s) => (
            <tr key={s.spaceId} className={`border-t border-rule ${s.spaceId === elegido ? 'bg-sheet' : ''}`}>
              <th scope="row" className="sticky left-0 bg-inherit px-2 py-1 text-left font-normal">
                <button type="button" onClick={() => onElegir(s.spaceId)} className="max-w-[220px] truncate text-left hover:underline" aria-current={s.spaceId === elegido || undefined}>
                  {s.nombre}
                </button>
              </th>
              {s.horario.map((bloque, i) => {
                const meta = USO_META[bloque.uso];
                const titulo = [meta.label, bloque.curso, bloque.detalle].filter(Boolean).join(' · ');
                return (
                  <td key={i} className="px-0.5 py-0.5">
                    <button type="button" title={titulo} aria-label={`${s.nombre}, ${demo.franjas[i]!.etiqueta}: ${titulo}`} onClick={() => onElegir(s.spaceId)}
                      className={`flex h-6 w-full items-center justify-center rounded-sm text-[10px] font-semibold text-ucc-marino ${i === demo.franjaActual ? 'ring-2 ring-night ring-offset-1' : ''}`}
                      style={{ background: meta.color, opacity: i < demo.franjaActual ? 0.45 : 1 }}>
                      {/* Text and an icon besides the colour: the grid reads without telling colours apart. */}
                      {bloque.uso === 'RESERVA_SIN_USO' ? '∅' : grupoDe(bloque.curso)}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="border-t-2 border-rule bg-sheet font-semibold">
            <th scope="row" className="sticky left-0 bg-sheet px-2 py-1.5 text-left">Libres en la franja</th>
            {demo.franjas.map((f, i) => (
              <td key={f.etiqueta} className="px-1 py-1.5 text-center tabular-nums" style={{ color: 'var(--color-st-libre-ink)' }}>
                {salones.filter((s) => s.horario[i]?.uso === 'LIBRE').length}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ---- Cameras: floor coordinates (x 0..1 left to right, y 0 board .. 1 back) on a 100 x 72 view ----------------

const px = (x: number) => 4 + x * 92;
const py = (y: number) => 4 + y * 64;

function asientos(sala: SalaDemo) {
  const lista: { x: number; y: number }[] = [];
  for (let r = 0; r < sala.filas; r++) {
    for (let c = 0; c < sala.columnas; c++) lista.push({ x: (c + 0.5) / sala.columnas, y: 0.3 + (0.65 * (r + 0.5)) / sala.filas });
  }
  return lista;
}

function Marco({ titulo, detalle, children }: { titulo: string; detalle: string; children: React.ReactNode }) {
  return (
    <figure className="overflow-hidden rounded-lg border border-night-line bg-night">
      <div className="relative">
        <svg viewBox="0 0 100 72" className="block w-full" role="img" aria-label={`${titulo}: ${detalle}`}>{children}</svg>
        <figcaption className="absolute left-2 top-1.5 rounded bg-field/70 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-ucc-marino">{titulo}</figcaption>
      </div>
      <p className="px-2 py-1 text-xs text-night-text">{detalle}</p>
    </figure>
  );
}

/** The room as its PoE camera sees it from the ceiling: desks, the board and every person it counts. */
function Camara({ sala }: { sala: SalaDemo }) {
  const { ahora } = sala;
  if (!ahora.camaraEnLinea) {
    return (
      <Marco titulo="CÁMARA" detalle="Sin señal: el gemelo conserva la última estimación y avisa del fallo">
        <rect width="100" height="72" fill="#16191c" />
        {Array.from({ length: 24 }, (_, i) => <rect key={i} x="0" y={i * 3} width="100" height="1" fill="#2a2f33" opacity={(i * 37) % 5 / 5} />)}
        <foreignObject x="35" y="26" width="30" height="20"><CameraOff className="mx-auto h-6 w-6 text-white/60" /></foreignObject>
      </Marco>
    );
  }
  return (
    <Marco titulo="CÁMARA" detalle={ahora.personas === 0 ? 'Salón vacío' : `Cuenta ${ahora.personasVistas.length} personas${ahora.docente ? ', con el docente' : ''}`}>
      <rect width="100" height="72" fill="#e4eaed" />
      <rect x="30" y="1.5" width="40" height="3" rx="0.5" fill="#2f4a3a" />
      {asientos(sala).map((a, i) => <rect key={i} x={px(a.x) - 2.6} y={py(a.y) - 1.4} width="5.2" height="2.8" rx="0.4" fill="#c2cbd0" />)}
      {ahora.personasVistas.map((p, i) => (
        <circle key={i} cx={px(p.x)} cy={py(p.y)} r={p.docente ? 1.9 : 1.6}
          fill={p.docente ? 'var(--color-ucc-cian)' : '#304a66'} stroke="#fff" strokeWidth="0.3" />
      ))}
    </Marco>
  );
}
