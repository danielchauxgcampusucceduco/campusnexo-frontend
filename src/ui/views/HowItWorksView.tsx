import { ArrowLeft, Cctv, Cpu, Lightbulb, Scale, Smartphone, Snowflake, Wifi } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTwin } from '../../application/TwinContext';
import { formatNumber } from '../../domain/kpis';
import { useStage } from '../StageContext';
import { CONDITION_META, HVAC_META, STATUS_META } from '../theme';
import { ArchitectureView } from './ArchitectureView';

/**
 * How CampusNexo works, in plain language and with the selected room's live values: what it senses,
 * how it decides and what it switches. The software architecture is one click away for the jury.
 */
export function HowItWorksView() {
  const [technical, setTechnical] = useState(false);
  const { twin, snapshot } = useTwin();
  const { selectedSpace } = useStage();
  if (technical) {
    return (
      <div className="flex flex-col gap-4">
        <button type="button" onClick={() => setTechnical(false)} className="flex w-fit items-center gap-1.5 text-sm font-medium text-st-optimo-ink">
          <ArrowLeft className="h-4 w-4" /> Volver a la explicación sencilla
        </button>
        <ArchitectureView />
      </div>
    );
  }
  const current = twin(selectedSpace) ?? snapshot.twins[0];
  if (!current) return null;
  const { state, space } = current;
  const cond = CONDITION_META[state.condition];
  const cam = state.kalman?.measurements.find((m) => m.source === 'CAMARA_YOLO');

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 tabIndex={-1} className="lettering text-2xl font-semibold">Cómo funciona</h1>
        <p className="view-intro mt-1 max-w-[70ch] text-sm text-ink-soft">
          Cada salón tiene una cámara con inteligencia artificial y un Arduino con sensores. Cada pocos segundos el sistema junta lo que miden, decide qué hacer y lo hace solo. Abajo están los valores reales de <b className="text-ink">{space.name}</b> en este momento.
        </p>
      </div>

      <ol className="flow grid gap-4 lg:grid-cols-4">
        <Stage n={1} title="Mira" icon={<Cctv className="h-6 w-6" />} tone="var(--color-signal)">
          <Fact icon={<Cctv className="h-4 w-4" />} label="Cámara con IA">{state.cameraOnline ? `${cam ? Math.round(cam.value) : state.occupancy} personas` : 'caída'}</Fact>
          <Fact icon={<Wifi className="h-4 w-4" />} label="Celulares en el Wi-Fi">{Math.round(state.kalman?.measurements.find((m) => m.source === 'WIFI_DISPOSITIVOS')?.value ?? 0)}</Fact>
          <p className="text-sm text-ink-soft">La IA reconoce personas, portátiles, morrales y libros, y en qué pupitre está cada uno. No guarda ni envía imágenes.</p>
        </Stage>
        <Stage n={2} title="Mide" icon={<Cpu className="h-6 w-6" />} tone="var(--color-rc-luces)">
          <Fact label="Temperatura (DHT22)">{formatNumber(state.indoorTemperatureC)} °C</Fact>
          <Fact label="Humedad">{Math.round(state.humidityPct)} %</Fact>
          <Fact label="Luces">{state.lightsOn ? 'encendidas' : 'apagadas'} · {Math.round(state.illuminanceLux)} lux</Fact>
          <Fact label="Equipos encendidos">{space.computers > 0 ? `${state.devicesOn} de ${space.computers}` : 'no tiene'}</Fact>
          <Fact label="CO₂ del aire">{Math.round(state.co2Ppm)} ppm</Fact>
        </Stage>
        <Stage n={3} title="Decide" icon={<Scale className="h-6 w-6" />} tone="var(--color-rc-ocupado)">
          <Fact label="Personas (las 3 pistas juntas)">{state.occupancy} de {space.capacity}</Fact>
          <p className="text-lg font-semibold leading-tight" style={{ color: cond.ink }}>{cond.label}</p>
          <p className="text-sm text-ink-soft">{cond.hint}. {STATUS_META[state.status].label}.</p>
          <p className="text-sm text-ink-soft">Reglas: si no hay nadie 5 minutos, se apagan luces y equipos; el clima se ajusta a cuántas personas hay y al calor que ya guarda el salón.</p>
        </Stage>
        <Stage n={4} title="Actúa" icon={<Snowflake className="h-6 w-6" />} tone="var(--color-st-libre)">
          <Fact icon={<Snowflake className="h-4 w-4" />} label="Clima">{HVAC_META[state.hvacState].label}</Fact>
          <Fact icon={<Lightbulb className="h-4 w-4" />} label="Relé de luces y equipos">{state.equipmentShutdownAt ? 'apagó lo que sobraba' : state.lightsOn ? 'luces encendidas' : 'en reposo'}</Fact>
          <Fact icon={<Smartphone className="h-4 w-4" />} label="App de estudiantes">puestos libres al día</Fact>
        </Stage>
      </ol>

      <div className="rounded-2xl border border-rule bg-sheet p-5">
        <h2 className="text-lg font-semibold">¿Y por dentro?</h2>
        <p className="mt-1 max-w-[70ch] text-sm text-ink-soft">
          El programa está organizado como un hexágono: las reglas del campus están en el centro y no dependen de la cámara, del Arduino ni de la base de datos. Por eso se puede cambiar un sensor sin tocar las reglas. La vista técnica muestra, paso a paso, por dónde pasa cada evento.
        </p>
        <button type="button" onClick={() => setTechnical(true)} className="mt-3 rounded-xl bg-night px-4 py-2.5 text-sm font-medium text-night-text transition-transform hover:-translate-y-0.5">
          Ver el recorrido técnico (arquitectura hexagonal)
        </button>
      </div>
    </div>
  );
}

function Stage({ n, title, icon, tone, children }: { n: number; title: string; icon: ReactNode; tone: string; children: ReactNode }) {
  return (
    <li className="flow-stage relative flex flex-col gap-2.5 rounded-2xl bg-night p-5 text-night-text" style={{ ['--tone' as string]: tone, animationDelay: `${(n - 1) * 120}ms` }}>
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: `color-mix(in oklab, ${tone} 22%, transparent)`, color: tone }}>{icon}</span>
        <div>
          <p className="text-xs uppercase tracking-wider text-night-text/70">Paso {n}</p>
          <h2 className="lettering text-xl font-semibold text-white">{title}</h2>
        </div>
      </div>
      <div className="flex flex-col gap-2 [&_.text-ink-soft]:text-night-text/75">{children}</div>
      {n < 4 && <span aria-hidden className="flow-arrow" />}
    </li>
  );
}

function Fact({ label, icon, children }: { label: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <p className="flex items-baseline justify-between gap-3 border-b border-night-line pb-1.5 text-sm">
      <span className="flex items-center gap-1.5 text-night-text/80">{icon}{label}</span>
      <b className="text-right tabular-nums text-white">{children}</b>
    </p>
  );
}
