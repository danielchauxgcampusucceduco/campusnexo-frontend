import { Activity, Shuffle } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useRequest, useTwin } from '../../../application/TwinContext';
import type { AssignmentPlan, SensorAnomaly } from '../../../domain/model';
import type { Curso } from '../../../ports/OperacionesPort';
import { formatNumber } from '../../../domain/kpis';

const time = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' });
const inputClass = 'rounded-lg border border-rule bg-white px-2.5 py-1.5 text-sm';

/** Kinds of app.domain.anomalias in the AI service. */
const KIND_LABEL: Record<string, string> = {
  FUERA_DE_RANGO: 'Fuera del rango físico',
  VALOR_PEGADO: 'Valor pegado',
  SALTO: 'Salto brusco',
};

/** "IS-701, 32" per line → courses; invalid lines are reported, never guessed. */
export function parseCursos(text: string): { cursos: Curso[]; invalid: string[] } {
  const cursos: Curso[] = [];
  const invalid: string[] = [];
  for (const line of text.split('\n').map((l) => l.trim()).filter(Boolean)) {
    const match = /^(.+?)[,;\t ]+(\d+)$/.exec(line);
    if (match && Number(match[2]) > 0) cursos.push({ cursoId: match[1]!.trim(), asistentes: Number(match[2]) });
    else invalid.push(line);
  }
  return { cursos, invalid };
}

/** Sensor health from the history (range, stuck value, jump by MAD), computed by the AI service. */
function SaludDeSensores() {
  const { operaciones } = useTwin();
  const { pending, run } = useRequest();
  const [horas, setHoras] = useState(24);
  const [anomalies, setAnomalies] = useState<SensorAnomaly[] | null>(null);

  const check = async () => {
    const result = await run(() => operaciones.saludDeSensores(horas));
    if (result) setAnomalies(result);
  };

  return (
    <section aria-labelledby="sensores-title" className="rounded-2xl border border-rule bg-sheet p-4">
      <h3 id="sensores-title" className="flex items-center gap-1.5 font-semibold"><Activity className="h-4 w-4 text-ink-soft" />Salud de los sensores</h3>
      <p className="mt-1 text-sm text-ink-soft">Busca lecturas fuera del rango físico, valores pegados y saltos bruscos en el historial. Cada hallazgo deja una alerta de sensor anómalo.</p>
      <div className="mt-3 flex items-center gap-2">
        <select value={horas} onChange={(e) => setHoras(Number(e.target.value))} aria-label="Ventana" className={inputClass}>
          <option value={24}>Últimas 24 h</option>
          <option value={72}>Últimos 3 días</option>
          <option value={168}>Última semana</option>
        </select>
        <button type="button" disabled={pending} onClick={() => void check()} className="rounded-lg bg-night px-3 py-1.5 text-sm font-medium text-night-text disabled:opacity-60">
          {pending ? 'Revisando…' : 'Revisar'}
        </button>
      </div>
      {anomalies?.length === 0 && <p className="mt-3 text-sm text-st-libre-ink">Sin anomalías en la ventana elegida.</p>}
      {anomalies && anomalies.length > 0 && (
        <ul className="mt-3 max-h-72 divide-y divide-rule overflow-y-auto rounded-xl border border-rule text-sm">
          {anomalies.map((a, i) => (
            <li key={`${a.spaceId}-${a.sensor}-${a.at}-${i}`} className="px-3 py-2">
              <p><b className="condensed">{a.spaceId}</b> · {a.sensor} · <span className="font-medium text-st-subutilizado-ink">{KIND_LABEL[a.kind] ?? a.kind}</span></p>
              <p className="text-xs text-ink-soft">{time.format(Date.parse(a.at))} · valor {formatNumber(a.value, 1)} · {a.detail}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Room assignment for a list of courses (Hungarian algorithm in the AI service). */
function Asignacion() {
  const { operaciones } = useTwin();
  const { pending, run } = useRequest();
  const [text, setText] = useState('IS-701, 32\nIS-502, 24');
  const [margin, setMargin] = useState(1.1);
  const [plan, setPlan] = useState<AssignmentPlan | null>(null);
  const { cursos, invalid } = parseCursos(text);

  const assign = async (event: FormEvent) => {
    event.preventDefault();
    const result = await run(() => operaciones.asignar(cursos, margin));
    if (result) setPlan(result);
  };

  return (
    <section aria-labelledby="asignacion-title" className="rounded-2xl border border-rule bg-sheet p-4">
      <h3 id="asignacion-title" className="flex items-center gap-1.5 font-semibold"><Shuffle className="h-4 w-4 text-ink-soft" />Asignación de salones</h3>
      <p className="mt-1 text-sm text-ink-soft">Un curso por línea con su número de asistentes. Busca la combinación que cabe con el margen de seguridad y consume menos energía.</p>
      <form className="mt-3 flex flex-col gap-2" onSubmit={(event) => void assign(event)}>
        <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} aria-label="Cursos y asistentes" className={`${inputClass} font-mono`} />
        {invalid.length > 0 && <p className="text-xs text-st-sobrecupo-ink">No se entienden estas líneas: {invalid.join(' · ')}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-ink-soft">Margen
            <select value={margin} onChange={(e) => setMargin(Number(e.target.value))} className={inputClass}>
              {[1, 1.1, 1.2, 1.5].map((m) => <option key={m} value={m}>{Math.round((m - 1) * 100)} %</option>)}
            </select>
          </label>
          <button type="submit" disabled={pending || cursos.length === 0 || cursos.length > 18 || invalid.length > 0}
            className="rounded-lg bg-night px-3 py-1.5 text-sm font-medium text-night-text disabled:opacity-60">{pending ? 'Calculando…' : `Asignar ${cursos.length} cursos`}</button>
        </div>
      </form>
      {plan && !plan.feasible && <p className="mt-3 text-sm text-st-sobrecupo-ink">No hay una asignación posible: {plan.reason}</p>}
      {plan?.feasible && (
        <table className="mt-3 w-full text-left text-sm">
          <thead className="text-ink-soft"><tr className="border-b border-rule"><th className="py-1.5 font-normal">Curso</th><th className="py-1.5 font-normal">Salón</th><th className="py-1.5 text-right font-normal">Uso</th></tr></thead>
          <tbody>
            {plan.assignments.map((a) => (
              <tr key={a.courseId} className="border-b border-rule/70">
                <td className="py-1.5 font-medium">{a.courseId}</td>
                <td className="condensed py-1.5">{a.roomId}</td>
                <td className="py-1.5 text-right tabular-nums">{a.attendance}/{a.capacity} ({Math.round(a.utilizationPct)} %)</td>
              </tr>
            ))}
          </tbody>
          {plan.totalPowerKw !== null && <caption className="caption-bottom pt-2 text-left text-xs text-ink-soft">Potencia nominal total: {formatNumber(plan.totalPowerKw, 1)} kW</caption>}
        </table>
      )}
    </section>
  );
}

export function HerramientasIa() {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <SaludDeSensores />
      <Asignacion />
    </div>
  );
}
