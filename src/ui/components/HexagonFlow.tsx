import { useEffect, useMemo, useState } from 'react';
import type { ArchitectureTrace, HexagonalLayer } from '../../domain/model';

interface Node {
  id: string;
  label: string;
  sublabel: string;
  layer: HexagonalLayer;
  x: number;
  y: number;
  /** Lower-case fragments of component names that map a trace step to this node. */
  match: string[];
}

const NODES: Node[] = [
  { id: 'in-mqtt', label: 'YoloMqttTelemetry', sublabel: 'InboundAdapter', layer: 'INBOUND_ADAPTER', x: 175, y: 175, match: ['mqtt'] },
  { id: 'in-sim', label: 'Simulation', sublabel: 'escenarios REST', layer: 'INBOUND_ADAPTER', x: 108, y: 300, match: ['simulation'] },
  { id: 'in-rest', label: 'CampusNexoRest', sublabel: 'Controller / app', layer: 'INBOUND_ADAPTER', x: 175, y: 425, match: ['campusnexorestcontroller', 'twincontrol', 'app estudiantil'] },
  { id: 'port-process', label: 'ProcessSpace', sublabel: 'TelemetryUseCase', layer: 'INPUT_PORT', x: 290, y: 245, match: ['processspacetelemetryusecase'] },
  { id: 'port-reeval', label: 'SpaceReevaluation', sublabel: 'UseCase', layer: 'INPUT_PORT', x: 290, y: 355, match: ['spacereevaluationusecase'] },
  { id: 'use-case', label: 'ProcessSpace', sublabel: 'TelemetryService', layer: 'USE_CASE', x: 500, y: 152, match: ['processspacetelemetryservice'] },
  { id: 'use-ingest', label: 'TelemetryUseCase', sublabel: 'ingest + alertas', layer: 'USE_CASE', x: 500, y: 448, match: ['telemetryusecase.ingest'] },
  { id: 'dom-kalman', label: 'OccupancyKalman', sublabel: 'DomainService', layer: 'DOMAIN_SERVICE', x: 430, y: 250, match: ['occupancykalman'] },
  { id: 'dom-roi', label: 'StudyZoneRoi', sublabel: 'ray casting', layer: 'DOMAIN_SERVICE', x: 570, y: 250, match: ['studyzoneroi'] },
  { id: 'dom-status', label: 'SpaceStatus', sublabel: 'Policy', layer: 'DOMAIN_SERVICE', x: 430, y: 350, match: ['spacestatuspolicy'] },
  { id: 'dom-mpc', label: 'ThermalInertia', sublabel: 'MpcDomainService', layer: 'DOMAIN_SERVICE', x: 570, y: 350, match: ['thermalinertiampc'] },
  { id: 'port-repo', label: 'SpaceRepository', sublabel: 'Port', layer: 'OUTPUT_PORT', x: 712, y: 205, match: ['spacerepositoryport'] },
  { id: 'port-hvac', label: 'HvacActuator', sublabel: 'CommandPort', layer: 'OUTPUT_PORT', x: 740, y: 300, match: ['hvacactuatorcommandport'] },
  { id: 'port-notify', label: 'RealtimeDashboard', sublabel: 'NotifierPort', layer: 'OUTPUT_PORT', x: 712, y: 395, match: ['realtimedashboardnotifierport'] },
  { id: 'out-repo', label: 'PostgresSpace', sublabel: 'RepositoryAdapter', layer: 'OUTBOUND_ADAPTER', x: 825, y: 175, match: ['postgres', 'inmemoryspacerepository', 'repository'] },
  { id: 'out-hvac', label: 'Esp32HvacActuator', sublabel: 'Adapter (MQTT)', layer: 'OUTBOUND_ADAPTER', x: 892, y: 300, match: ['esp32', 'actuator'] },
  { id: 'out-notify', label: 'StompRealtime', sublabel: 'DashboardNotifier', layer: 'OUTBOUND_ADAPTER', x: 825, y: 425, match: ['stomp', 'notifier'] },
];

const RING_COLOR: Record<HexagonalLayer, string> = {
  INBOUND_ADAPTER: '#7aa6b8',
  INPUT_PORT: '#9fc7b9',
  USE_CASE: '#c3a6f0',
  DOMAIN_SERVICE: '#f2c14e',
  OUTPUT_PORT: '#9fc7b9',
  OUTBOUND_ADAPTER: '#7aa6b8',
};

function hexagon(cx: number, cy: number, rx: number, ry: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i;
    return `${cx + rx * Math.cos(angle)},${cy + ry * Math.sin(angle)}`;
  }).join(' ');
}

/** Resolves the node a trace step belongs to: same layer, first matching name fragment. */
function nodeFor(layer: HexagonalLayer, component: string): Node | undefined {
  const name = component.toLowerCase();
  return NODES.find((node) => node.layer === layer && node.match.some((fragment) => name.includes(fragment)));
}

const STEP_MS = 280;

/**
 * Live map of the hexagonal architecture. When a trace arrives its steps are replayed in order:
 * every hop lights the node it touches and draws the edge from the previous hop, from the inbound
 * adapter to the domain services and back out to the outbound adapters.
 */
export function HexagonFlow({ trace }: { trace: ArchitectureTrace | null }) {
  const path = useMemo(() => (trace ? trace.steps.map((step) => nodeFor(step.layer, step.component)).filter((n): n is Node => n !== undefined) : []), [trace]);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setProgress(0);
    if (path.length === 0) return;
    let step = 0;
    const id = setInterval(() => {
      step++;
      setProgress(step);
      if (step >= path.length) clearInterval(id);
    }, STEP_MS);
    return () => clearInterval(id);
  }, [path]);

  const visited = path.slice(0, progress);
  const current = visited[visited.length - 1];
  const touched = new Set(visited.map((n) => n.id));

  return (
    <svg viewBox="0 0 1000 600" className="h-full w-full" role="img" aria-label="Recorrido del último evento por la arquitectura hexagonal">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#5fd0bf" />
        </marker>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <polygon points={hexagon(500, 300, 470, 285)} fill="#122630" stroke="#2a4350" strokeWidth="1.5" />
      <polygon points={hexagon(500, 300, 330, 212)} fill="#15303b" stroke="#2a4350" strokeWidth="1.5" />
      <polygon points={hexagon(500, 300, 232, 172)} fill="#183743" stroke="#2a4350" strokeWidth="1.5" />
      <polygon points={hexagon(500, 300, 160, 112)} fill="#1d4250" stroke="#3d5a68" strokeWidth="1.5" />
      <text x="500" y="305" textAnchor="middle" fill="#f2c14e" fontSize="13" fontWeight={600} style={{ fontStretch: '118%' }}>Dominio Java 21 puro</text>

      {visited.slice(1).map((node, index) => {
        const from = visited[index]!;
        if (from.id === node.id) return null;
        return <line key={`${from.id}-${node.id}-${index}`} x1={from.x} y1={from.y} x2={node.x} y2={node.y} stroke="#5fd0bf" strokeWidth="2" strokeOpacity="0.85" markerEnd="url(#arrow)" />;
      })}

      {NODES.map((node) => {
        const active = current?.id === node.id;
        const lit = touched.has(node.id);
        const color = RING_COLOR[node.layer];
        return (
          <g key={node.id} transform={`translate(${node.x - 64}, ${node.y - 21})`} filter={active ? 'url(#glow)' : undefined}>
            <rect width="128" height="42" rx="9" fill={lit ? '#0f1d24' : '#13262f'} stroke={lit ? color : '#2f4b58'} strokeWidth={active ? 2.5 : 1.3} />
            <text x="64" y="18" textAnchor="middle" fill={lit ? '#eef6f4' : '#86a2aa'} fontSize="11" fontWeight={600}>{node.label}</text>
            <text x="64" y="32" textAnchor="middle" fill={lit ? color : '#5f7c86'} fontSize="10">{node.sublabel}</text>
          </g>
        );
      })}
    </svg>
  );
}
