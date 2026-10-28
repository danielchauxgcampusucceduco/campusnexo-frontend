import { CameraOff, FlaskConical, Lightbulb, Thermometer } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import { useTwin } from '../../application/TwinContext';
import { BackendError } from '../../adapters/backend/http';
import type { DemoSnapshot, DispositivoDemo, SalaDemo, SpaceType, UsoDemo } from '../../domain/model';
import { SPACE_TYPE_LABEL } from '../theme';

const POLL_MS = 3_000;
/** Each loop of the simulated day gets another schedule; the weekday only names it. */
const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const USO_META: Record<UsoDemo, { label: string; color: string; ink: string }> = {
  CLASE: { label: 'Clase', color: 'var(--color-st-optimo)', ink: 'var(--color-st-optimo-ink)' },
  PRACTICA: { label: 'Práctica', color: 'var(--color-st-popup)', ink: 'var(--color-st-popup-ink)' },
  RESERVA_SIN_USO: { label: 'Reservado sin uso', color: 'var(--color-st-noshow)', ink: 'var(--color-st-noshow-ink)' },
  MANTENIMIENTO: { label: 'Mantenimiento', color: 'var(--color-st-mantenimiento)', ink: 'var(--color-st-mantenimiento-ink)' },
  LIBRE: { label: 'Libre', color: 'var(--color-st-libre)', ink: 'var(--color-st-libre-ink)' },
};

const FILTROS: { id: 'todos' | SpaceType; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'SALA_COMPUTO', label: 'Salas de cómputo' },
  { id: 'LABORATORIO', label: 'Laboratorios' },
  { id: 'AULA', label: 'Salones' },
];

const ORDEN_TIPO: Partial<Record<SpaceType, number>> = { SALA_COMPUTO: 0, LABORATORIO: 1, AULA: 2 };

function useDemo() {
  const { operaciones } = useTwin();
  const [demo, setDemo] = useState<DemoSnapshot | null>(null);
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
  return { demo, error };
}

export function SimulacionView() {
  const { demo, error } = useDemo();
  const [filtro, setFiltro] = useState<'todos' | SpaceType>('todos');
  const [elegido, setElegido] = useState<string | null>(null);

  const salones = useMemo(() => (demo?.salones ?? [])
    .filter((s) => filtro === 'todos' || s.tipo === filtro)
    .sort((a, b) => (ORDEN_TIPO[a.tipo] ?? 9) - (ORDEN_TIPO[b.tipo] ?? 9) || a.nombre.localeCompare(b.nombre, 'es')), [demo, filtro]);

  if (!demo) {
    return (
      <section aria-labelledby="sim-title">
        <h1 id="sim-title" tabIndex={-1} className="lettering text-2xl font-semibold">Simulación del campus</h1>
        <p className="mt-2 max-w-[70ch] text-sm text-ink-soft">
          {error?.status === 404
            ? 'Este servidor corre sin la simulación. Se activa con DEMO_SIMULATION=true en el backend.'
            : error ? `No se pudo cargar la simulación: ${error.message}` : 'Cargando la simulación…'}
        </p>
      </section>
    );
  }

  const todos = demo.salones;
  const sala = todos.find((s) => s.spaceId === elegido)
    ?? [...todos].sort((a, b) => b.ahora.hallazgos.length - a.ahora.hallazgos.length)[0]!;
  const libres = todos.filter((s) => s.ahora.uso === 'LIBRE' && s.ahora.personas === 0).length;
  const enUso = todos.filter((s) => s.ahora.personas > 0 && s.ahora.uso !== 'MANTENIMIENTO').length;
  const desperdicio = todos.filter((s) => s.ahora.personas === 0 && (s.ahora.luces || s.ahora.dispositivosEncendidos > 0)).length;
  const potencia = todos.reduce((total, s) => total + s.ahora.potenciaKw, 0);
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
              Un día académico de 7:00 a 22:00 pasa en unos {Math.round(900 / demo.minutosSimuladosPorMinuto)} minutos y se repite con otro horario.
              Las situaciones están exageradas a propósito: luces y proyectores olvidados, laboratorios con equipos encendidos, clases a oscuras,
              sobrecupo, cámara caída y reservas sin uso. Cada salón tiene una cámara normal y una infrarroja.
            </p>
          </div>
          <div className="text-right">
            <p className="lettering text-5xl font-semibold tabular-nums">{demo.hora}</p>
            <p className="text-sm text-ink-soft">{DIAS[demo.dia % DIAS.length]} simulado · {demo.franjas[demo.franjaActual]?.etiqueta}</p>
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Libres ahora" value={libres} of={todos.length} />
          <Kpi label="Con personas" value={enUso} of={todos.length} />
          <Kpi label="Vacíos con algo encendido" value={desperdicio} of={todos.length} warn />
          <Kpi label="Potencia total" value={potencia.toFixed(1)} unit="kW" />
        </dl>
      </section>

      <section aria-labelledby="sim-horario">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="sim-horario" className="text-lg font-semibold">¿Dónde hay salones libres y en qué horario?</h2>
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

      <section aria-labelledby="sim-sala" className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div>
          <h2 id="sim-sala" className="text-lg font-semibold">{sala.nombre}</h2>
          <p className="text-sm text-ink-soft">
            {SPACE_TYPE_LABEL[sala.tipo]} · {sala.edificio}, piso {sala.piso} · aforo {sala.aforo} ·{' '}
            <span style={{ color: USO_META[sala.ahora.uso].ink }} className="font-semibold">{USO_META[sala.ahora.uso].label}{sala.ahora.curso ? `: ${sala.ahora.curso}` : ''}</span>
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <CamaraNormal sala={sala} />
            <CamaraInfrarroja sala={sala} />
          </div>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span><b>{sala.ahora.personas}</b> personas reales</span>
            <span>normal: <b>{sala.ahora.personasCamaraNormal ?? 'sin señal'}</b></span>
            <span>infrarroja: <b>{sala.ahora.personasInfrarroja}</b></span>
            <span className="flex items-center gap-1"><Lightbulb className="h-3.5 w-3.5" />{sala.ahora.luces ? 'luces encendidas' : 'luces apagadas'}</span>
            <span className="flex items-center gap-1"><Thermometer className="h-3.5 w-3.5" />{sala.ahora.temperaturaC.toFixed(1)} °C</span>
            <span>CO₂ {Math.round(sala.ahora.co2Ppm)} ppm</span>
            <span>{sala.ahora.potenciaKw.toFixed(2)} kW</span>
          </p>
          {sala.ahora.hallazgos.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1 text-sm">
              {sala.ahora.hallazgos.map((h) => <li key={h} className="rounded-md bg-sheet px-2 py-1" style={{ color: 'var(--color-rc-luces-ink)' }}>{h}</li>)}
            </ul>
          )}
        </div>
        <Dispositivos dispositivos={sala.ahora.dispositivos} />
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
      <dd className="lettering mt-1 text-3xl font-semibold tabular-nums" style={warn && Number(value) > 0 ? { color: 'var(--color-rc-luces-ink)' } : undefined}>
        {value}{unit && <span className="ml-1 text-base font-normal text-ink-soft">{unit}</span>}
        {of !== undefined && <span className="ml-1 text-base font-normal text-ink-soft">de {of}</span>}
      </dd>
    </div>
  );
}

function Leyenda() {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
      {(Object.keys(USO_META) as UsoDemo[]).map((uso) => (
        <li key={uso} className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ background: USO_META[uso].color }} />{USO_META[uso].label}</li>
      ))}
      <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ background: USO_META.LIBRE.color, boxShadow: 'inset 0 -4px 0 var(--color-rc-luces)' }} />Libre con algo encendido</li>
    </ul>
  );
}

function Horario({ demo, salones, elegido, onElegir }: { demo: DemoSnapshot; salones: SalaDemo[]; elegido: string; onElegir: (id: string) => void }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-rule">
      <table className="w-full min-w-[760px] border-collapse text-xs">
        <caption className="sr-only">Uso de cada salón por franja del día simulado</caption>
        <thead>
          <tr className="bg-sheet">
            <th scope="col" className="sticky left-0 bg-sheet px-2 py-1.5 text-left font-semibold">Salón</th>
            {demo.franjas.map((f, i) => (
              <th key={f.etiqueta} scope="col" className={`px-1 py-1.5 text-center font-medium ${i === demo.franjaActual ? 'text-ink' : 'text-ink-soft'}`}>
                {f.etiqueta.replace(' almuerzo', '')}{i === demo.franjaActual && <span className="block text-[10px] font-semibold text-signal">ahora</span>}
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
                const olvido = bloque.uso === 'LIBRE' && bloque.detalle;
                const titulo = [meta.label, bloque.curso, bloque.detalle].filter(Boolean).join(' · ');
                return (
                  <td key={i} className="px-0.5 py-0.5">
                    <button type="button" title={titulo} aria-label={`${s.nombre}, ${demo.franjas[i]!.etiqueta}: ${titulo}`} onClick={() => onElegir(s.spaceId)}
                      className={`block h-6 w-full rounded-sm ${i === demo.franjaActual ? 'ring-2 ring-night ring-offset-1' : ''}`}
                      style={{ background: meta.color, opacity: i < demo.franjaActual ? 0.45 : 1, boxShadow: olvido ? 'inset 0 -5px 0 var(--color-rc-luces)' : undefined }} />
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

/** PCs of a computer room sit on the desks, in order; a lone PC is the teacher's, by the board. */
function pcs(sala: SalaDemo, d: DispositivoDemo) {
  if (d.cantidad === 1) return [{ x: 0.18, y: 0.1, on: d.encendidos > 0 }];
  const lugares = asientos(sala);
  return Array.from({ length: d.cantidad }, (_, i) => ({ ...(lugares[i % lugares.length]!), on: i < d.encendidos }));
}

function Marco({ titulo, detalle, children, oscuro }: { titulo: string; detalle: string; children: React.ReactNode; oscuro?: boolean }) {
  return (
    <figure className="overflow-hidden rounded-lg border border-night-line bg-night">
      <div className="relative">
        <svg viewBox="0 0 100 72" className="block w-full" role="img" aria-label={`${titulo}: ${detalle}`}>{children}</svg>
        <figcaption className={`absolute left-2 top-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ${oscuro ? 'bg-black/50 text-white' : 'bg-white/70 text-ucc-marino'}`}>{titulo}</figcaption>
      </div>
      <p className="px-2 py-1 text-xs text-night-text">{detalle}</p>
    </figure>
  );
}

function CamaraNormal({ sala }: { sala: SalaDemo }) {
  const id = useId();
  const { ahora } = sala;
  if (!ahora.camaraNormalEnLinea) {
    return (
      <Marco titulo="CÁMARA NORMAL" detalle="Sin señal: el conteo lo sostiene la infrarroja" oscuro>
        <rect width="100" height="72" fill="#16191c" />
        {Array.from({ length: 24 }, (_, i) => <rect key={i} x="0" y={i * 3} width="100" height="1" fill="#2a2f33" opacity={(i * 37) % 5 / 5} />)}
        <foreignObject x="35" y="26" width="30" height="20"><CameraOff className="mx-auto h-6 w-6 text-white/60" /></foreignObject>
      </Marco>
    );
  }
  const luz = ahora.luces;
  const piso = luz ? '#e4eaed' : '#0b0e10';
  const mueble = luz ? '#c2cbd0' : '#161b1e';
  return (
    <Marco titulo="CÁMARA NORMAL" oscuro={!luz}
      detalle={ahora.personas === 0 ? `Salón vacío, luces ${luz ? 'encendidas' : 'apagadas'}` : `Ve ${ahora.personasCamaraNormal} de ${ahora.personas} personas${luz ? '' : ' (a oscuras)'}`}>
      <defs>
        <radialGradient id={`${id}-glow`}><stop offset="0" stopColor="#bfe9ff" stopOpacity="0.9" /><stop offset="1" stopColor="#bfe9ff" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="100" height="72" fill={piso} />
      <rect x="30" y="1.5" width="40" height="3" rx="0.5" fill={luz ? '#2f4a3a' : '#121614'} />
      {asientos(sala).map((a, i) => <rect key={i} x={px(a.x) - 2.6} y={py(a.y) - 1.4} width="5.2" height="2.8" rx="0.4" fill={mueble} />)}
      {ahora.dispositivos.map((d, i) => {
        if (d.categoria === 'COMPUTO') {
          return pcs(sala, d).map((p, j) => (
            <rect key={`${i}-${j}`} x={px(p.x) - 1.6} y={py(p.y) - 2.6} width="3.2" height="1.4" fill={p.on ? '#8fdcff' : luz ? '#59626a' : '#12171a'} />
          ));
        }
        const x = d.x ?? 0.5;
        const y = d.y ?? 0.03;
        const brilla = d.pantalla && d.encendidos > 0;
        if (d.categoria === 'PROYECCION') {
          return (
            <g key={i}>
              {brilla && <ellipse cx={px(x)} cy={py(y) + 2} rx="18" ry="5" fill={`url(#${id}-glow)`} />}
              <rect x={px(x) - 9} y={py(y) - 1} width="18" height="2.4" fill={brilla ? '#f4fbff' : luz ? '#3c4247' : '#101315'} />
            </g>
          );
        }
        return (
          <g key={i}>
            {brilla && <circle cx={px(x)} cy={py(y)} r="4" fill={`url(#${id}-glow)`} />}
            <rect x={px(x) - 1.8} y={py(y) - 1.8} width="3.6" height="3.6" rx="0.5" fill={brilla ? '#8fdcff' : luz ? '#7f8a91' : '#14191c'} />
          </g>
        );
      })}
      {ahora.personasVistas.filter((p) => p.visibleCamaraNormal).map((p, i) => (
        <circle key={i} cx={px(p.x)} cy={py(p.y)} r={p.docente ? 1.9 : 1.6}
          fill={p.docente ? 'var(--color-ucc-cian)' : luz ? '#304a66' : '#55626e'} stroke={luz ? '#fff' : 'none'} strokeWidth="0.3" />
      ))}
    </Marco>
  );
}

function CamaraInfrarroja({ sala }: { sala: SalaDemo }) {
  const id = useId();
  const { ahora } = sala;
  const calientes = ahora.dispositivos.filter((d) => d.termico !== 'FRIO').length;
  return (
    <Marco titulo="INFRARROJA" detalle={`Ve ${ahora.personasInfrarroja} personas por su calor · ${calientes} equipo${calientes === 1 ? '' : 's'} con calor`} oscuro>
      <defs>
        <radialGradient id={`${id}-persona`}><stop offset="0" stopColor="#fff6c2" /><stop offset="0.35" stopColor="#ffb02e" /><stop offset="1" stopColor="#e2341d" stopOpacity="0" /></radialGradient>
        <radialGradient id={`${id}-caliente`}><stop offset="0" stopColor="#ffd84a" /><stop offset="0.4" stopColor="#ff6a1f" /><stop offset="1" stopColor="#b3122e" stopOpacity="0" /></radialGradient>
        <radialGradient id={`${id}-tibio`}><stop offset="0" stopColor="#c2368a" /><stop offset="1" stopColor="#5a1a7a" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="100" height="72" fill="#080c2a" />
      <rect x="4" y="4" width="92" height="64" fill="none" stroke="#1c2660" strokeWidth="0.4" />
      {asientos(sala).map((a, i) => <rect key={i} x={px(a.x) - 2.6} y={py(a.y) - 1.4} width="5.2" height="2.8" rx="0.4" fill="#111a4a" />)}
      {ahora.dispositivos.map((d, i) => {
        const relleno = d.termico === 'CALIENTE' ? `url(#${id}-caliente)` : d.termico === 'TIBIO' ? `url(#${id}-tibio)` : null;
        if (d.categoria === 'COMPUTO') {
          return pcs(sala, d).map((p, j) => {
            const fill = p.on ? `url(#${id}-caliente)` : d.termico === 'TIBIO' ? `url(#${id}-tibio)` : null;
            return fill ? <circle key={`${i}-${j}`} cx={px(p.x)} cy={py(p.y) - 2} r="2.2" fill={fill} opacity="0.85" />
              : <rect key={`${i}-${j}`} x={px(p.x) - 1.6} y={py(p.y) - 2.6} width="3.2" height="1.4" fill="#1d2a6b" />;
          });
        }
        const x = px(d.x ?? 0.5);
        const y = py(d.y ?? 0.03);
        return relleno
          ? <circle key={i} cx={x} cy={y} r={d.termico === 'CALIENTE' ? (d.categoria === 'PROYECCION' ? 5 : 4.2) : 3.2} fill={relleno} />
          : <rect key={i} x={x - 1.8} y={y - 1.8} width="3.6" height="3.6" rx="0.5" fill="#1d2a6b" />;
      })}
      {ahora.personasVistas.map((p, i) => <circle key={i} cx={px(p.x)} cy={py(p.y)} r="3" fill={`url(#${id}-persona)`} />)}
    </Marco>
  );
}

const TERMICO: Record<DispositivoDemo['termico'], { label: string; color: string }> = {
  CALIENTE: { label: 'Caliente', color: 'var(--color-st-sobrecupo-ink)' },
  TIBIO: { label: 'Tibio, recién apagado', color: 'var(--color-rc-equipos-ink)' },
  FRIO: { label: 'Frío', color: 'var(--color-hv-frio-ink)' },
};

function Dispositivos({ dispositivos }: { dispositivos: DispositivoDemo[] }) {
  return (
    <div>
      <h3 className="text-base font-semibold">Dispositivos</h3>
      <p className="text-xs text-ink-soft">La cámara normal solo distingue una pantalla encendida; la infrarroja ve el calor de cualquier equipo.</p>
      <table className="mt-2 w-full text-sm">
        <thead>
          <tr className="border-b border-rule text-left text-xs text-ink-soft">
            <th scope="col" className="py-1 font-medium">Equipo</th>
            <th scope="col" className="py-1 font-medium">Cámara normal</th>
            <th scope="col" className="py-1 font-medium">Infrarroja</th>
          </tr>
        </thead>
        <tbody>
          {dispositivos.map((d) => (
            <tr key={d.nombre} className="border-b border-rule/60 align-top">
              <td className="py-1.5 pr-2">
                {d.nombre}
                {d.cantidad > 1 && <span className="text-ink-soft"> · {d.encendidos}/{d.cantidad} encendidos</span>}
                {d.siempreEncendido && <span className="ml-1 rounded bg-sheet px-1 text-[11px] text-ink-soft">debe estar encendido</span>}
              </td>
              <td className="py-1.5 pr-2 text-ink-soft">
                {d.camaraNormal === null ? (d.pantalla ? 'Sin señal' : 'No distingue') : d.camaraNormal ? 'Pantalla encendida' : 'Pantalla apagada'}
              </td>
              <td className="py-1.5 tabular-nums" style={{ color: TERMICO[d.termico].color }}>
                {TERMICO[d.termico].label} · {d.temperaturaC.toFixed(1)} °C
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
