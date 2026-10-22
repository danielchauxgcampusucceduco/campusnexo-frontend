import type { ArchitectureTrace, HexagonalLayer } from '../../domain/model';
import type { DataSourceMode } from '../../ports/TwinGateway';

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

/** Ports and the domain are the same in both modes; adapters are whatever the active source runs. */
const CORE: Node[] = [
  { id: 'port-process', label: 'ProcessSpace', sublabel: 'TelemetryUseCase', layer: 'INPUT_PORT', x: 252, y: 236, match: ['processspacetelemetryusecase'] },
  { id: 'port-reeval', label: 'SpaceReevaluation', sublabel: 'UseCase', layer: 'INPUT_PORT', x: 252, y: 364, match: ['spacereevaluationusecase'] },
  { id: 'use-case', label: 'ProcessSpace', sublabel: 'TelemetryService', layer: 'USE_CASE', x: 500, y: 142, match: ['processspacetelemetryservice', 'processcameraframeservice', 'processenvironmentreadingservice', 'spacereevaluationservice'] },
  { id: 'use-ingest', label: 'TelemetryUseCase', sublabel: 'ingest + alertas', layer: 'USE_CASE', x: 500, y: 458, match: ['telemetryusecase.ingest'] },
  { id: 'dom-kalman', label: 'OccupancyKalman', sublabel: 'DomainService', layer: 'DOMAIN_SERVICE', x: 416, y: 262, match: ['occupancykalman'] },
  { id: 'dom-roi', label: 'StudyZoneRoi', sublabel: 'ray casting', layer: 'DOMAIN_SERVICE', x: 584, y: 262, match: ['studyzoneroi'] },
  { id: 'dom-status', label: 'SpaceStatus', sublabel: 'Policy', layer: 'DOMAIN_SERVICE', x: 416, y: 338, match: ['spacestatuspolicy'] },
  { id: 'dom-mpc', label: 'MPC + cadena', sublabel: 'HvacSettingChain', layer: 'DOMAIN_SERVICE', x: 584, y: 338, match: ['thermalinertiampc', 'hvacsettingchain'] },
  { id: 'port-repo', label: 'SpaceRepository', sublabel: 'Port', layer: 'OUTPUT_PORT', x: 748, y: 208, match: ['spacerepositoryport'] },
  { id: 'port-hvac', label: 'HvacActuator', sublabel: 'CommandPort', layer: 'OUTPUT_PORT', x: 748, y: 300, match: ['hvacactuatorcommandport'] },
  { id: 'port-notify', label: 'TwinChange', sublabel: 'NotifierPort', layer: 'OUTPUT_PORT', x: 748, y: 392, match: ['twinchangenotifierport'] },
];

const ADAPTERS: Record<DataSourceMode, Node[]> = {
  backend: [
    { id: 'in-mqtt', label: 'YoloMqttTelemetry', sublabel: 'InboundAdapter', layer: 'INBOUND_ADAPTER', x: 88, y: 146, match: ['mqtt'] },
    { id: 'in-sim', label: 'Simulation', sublabel: 'Controller (REST)', layer: 'INBOUND_ADAPTER', x: 88, y: 300, match: ['simulation'] },
    { id: 'in-rest', label: 'TwinController', sublabel: 'REST / app', layer: 'INBOUND_ADAPTER', x: 88, y: 454, match: ['twincontroller', 'twiningestioncontroller', 'twincontrol', 'app estudiantil'] },
    { id: 'out-repo', label: 'PostgresSpace', sublabel: 'RepositoryAdapter', layer: 'OUTBOUND_ADAPTER', x: 912, y: 146, match: ['postgres', 'repository'] },
    { id: 'out-hvac', label: 'Esp32HvacActuator', sublabel: 'Adapter (MQTT)', layer: 'OUTBOUND_ADAPTER', x: 912, y: 300, match: ['esp32', 'actuator'] },
    { id: 'out-notify', label: 'StompTwinChange', sublabel: 'NotifierAdapter', layer: 'OUTBOUND_ADAPTER', x: 912, y: 454, match: ['stomp', 'notifier'] },
  ],
  simulation: [
    { id: 'in-mqtt', label: 'YoloMqttTelemetry', sublabel: 'simulado', layer: 'INBOUND_ADAPTER', x: 88, y: 146, match: ['mqtt'] },
    { id: 'in-sim', label: 'Simulation', sublabel: 'Controller (simulado)', layer: 'INBOUND_ADAPTER', x: 88, y: 300, match: ['simulation'] },
    { id: 'in-rest', label: 'TwinControl', sublabel: 'REST / app (simulado)', layer: 'INBOUND_ADAPTER', x: 88, y: 454, match: ['twincontrol', 'app estudiantil', 'campusnexorestcontroller'] },
    { id: 'out-repo', label: 'InMemorySpace', sublabel: 'Repository', layer: 'OUTBOUND_ADAPTER', x: 912, y: 146, match: ['repository'] },
    { id: 'out-hvac', label: 'SimulatedEsp32', sublabel: 'Actuator', layer: 'OUTBOUND_ADAPTER', x: 912, y: 300, match: ['esp32', 'actuator'] },
    { id: 'out-notify', label: 'InMemoryDashboard', sublabel: 'Notifier', layer: 'OUTBOUND_ADAPTER', x: 912, y: 454, match: ['notifier'] },
  ],
};

const RING_COLOR: Record<HexagonalLayer, string> = {
  INBOUND_ADAPTER: '#8fbccd',
  INPUT_PORT: '#a8d4c4',
  USE_CASE: '#cdb4f5',
  DOMAIN_SERVICE: '#f2c14e',
  OUTPUT_PORT: '#a8d4c4',
  OUTBOUND_ADAPTER: '#8fbccd',
};

const BOX_W = 148;
const BOX_H = 50;

function hexagon(cx: number, cy: number, rx: number, ry: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i;
    return `${cx + rx * Math.cos(angle)},${cy + ry * Math.sin(angle)}`;
  }).join(' ');
}

export function nodesFor(mode: DataSourceMode): Node[] {
  return [...ADAPTERS[mode], ...CORE];
}

/** The node each trace step lands on (same layer, first matching name fragment), or null. */
export function tracePath(trace: ArchitectureTrace | null, mode: DataSourceMode): (Node | null)[] {
  const nodes = nodesFor(mode);
  return (trace?.steps ?? []).map((step) => {
    const name = step.component.toLowerCase();
    return nodes.find((node) => node.layer === step.layer && node.match.some((fragment) => name.includes(fragment))) ?? null;
  });
}

/** Where an edge leaves or enters a box: the border point on the line between both centres. */
function edgePoint(from: Node, to: Node): [number, number] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const scale = Math.min((BOX_W / 2 + 4) / Math.abs(dx || 1e-6), (BOX_H / 2 + 4) / Math.abs(dy || 1e-6));
  return [from.x + dx * Math.min(1, scale), from.y + dy * Math.min(1, scale)];
}

/**
 * Map of the hexagonal architecture. The caller decides how many steps of the trace have been
 * replayed (`progress`): every reached step lights its node and draws the edge from the previous hop.
 */
export function HexagonFlow({ trace, progress, mode }: { trace: ArchitectureTrace | null; progress: number; mode: DataSourceMode }) {
  const nodes = nodesFor(mode);
  const path = tracePath(trace, mode).slice(0, progress).filter((n): n is Node => n !== null);
  const current = path[path.length - 1];
  const touched = new Set(path.map((n) => n.id));
  const edges = path.slice(1).map((node, index) => [path[index]!, node] as const).filter(([a, b]) => a.id !== b.id);

  return (
    <svg viewBox="0 0 1000 600" className="h-full w-full" aria-hidden>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#5fd0bf" />
        </marker>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="7" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <polygon points={hexagon(500, 300, 485, 292)} fill="#122630" stroke="#3a5b6a" strokeWidth="2" />
      <polygon points={hexagon(500, 300, 345, 222)} fill="#15303b" stroke="#3a5b6a" strokeWidth="2" />
      <polygon points={hexagon(500, 300, 245, 192)} fill="#183743" stroke="#3a5b6a" strokeWidth="2" />
      <polygon points={hexagon(500, 300, 192, 120)} fill="#1d4250" stroke="#4d7080" strokeWidth="2" />
      <text x="500" y="222" textAnchor="middle" fill="#f2c14e" fontSize="15" fontWeight={600} style={{ fontStretch: '118%' }}>Dominio Java 21 puro</text>

      {edges.map(([from, to], index) => {
        const [x1, y1] = edgePoint(from, to);
        const [x2, y2] = edgePoint(to, from);
        const last = index === edges.length - 1;
        return <line key={`${from.id}-${to.id}-${index}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#5fd0bf" strokeWidth={last ? 4 : 3} strokeOpacity={last ? 1 : 0.7} strokeLinecap="round" markerEnd="url(#arrow)" />;
      })}

      {nodes.map((node) => {
        const active = current?.id === node.id;
        const lit = touched.has(node.id);
        const color = RING_COLOR[node.layer];
        return (
          <g key={node.id} transform={`translate(${node.x - BOX_W / 2}, ${node.y - BOX_H / 2})`} filter={active ? 'url(#glow)' : undefined}>
            <rect width={BOX_W} height={BOX_H} rx="10" fill={lit ? '#0b171d' : '#13262f'} stroke={lit ? color : '#45677a'} strokeWidth={active ? 3.5 : lit ? 2.2 : 1.5} />
            <text x={BOX_W / 2} y="22" textAnchor="middle" fill={lit ? '#f4faf8' : '#b5cbd1'} fontSize="14.5" fontWeight={600}>{node.label}</text>
            <text x={BOX_W / 2} y="40" textAnchor="middle" fill={lit ? color : '#93afb8'} fontSize="12.5">{node.sublabel}</text>
          </g>
        );
      })}
    </svg>
  );
}
