import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { ArchitectureTrace, ScenarioInfo, SimulationScenario, TwinSpace } from '../domain/model';
import type { DataSourceMode, TwinGateway, TwinSnapshot } from '../ports/TwinGateway';
import { createGateway, readConfig } from './gatewayFactory';

export interface Notice {
  id: number;
  tone: 'info' | 'error';
  text: string;
}

interface TwinContextValue {
  gateway: TwinGateway;
  snapshot: TwinSnapshot;
  scenarios: ScenarioInfo[];
  runScenario: (scenario: SimulationScenario) => Promise<ArchitectureTrace | null>;
  switchMode: (mode: DataSourceMode) => Promise<void>;
  switching: boolean;
  notices: Notice[];
  notify: (tone: Notice['tone'], text: string) => void;
  twin: (spaceId: string) => TwinSpace | undefined;
}

const TwinContextInstance = createContext<TwinContextValue | null>(null);
const config = readConfig();
let noticeSequence = 0;

/** Application layer of the dashboard: owns the active gateway and exposes use cases to the UI. */
export function TwinProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const [gateway, setGateway] = useState<TwinGateway | null>(null);
  const [switching, setSwitching] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);

  const notify = useCallback((tone: Notice['tone'], text: string) => {
    const id = ++noticeSequence;
    setNotices((current) => [...current.slice(-2), { id, tone, text }]);
    setTimeout(() => setNotices((current) => current.filter((n) => n.id !== id)), 5_000);
  }, []);

  useEffect(() => {
    let active: TwinGateway | null = null;
    let cancelled = false;
    createGateway(config).then(async (created) => {
      if (cancelled) return;
      await created.start();
      active = created;
      setGateway(created);
      if (created.mode === 'simulation' && config.preference !== 'simulation') {
        notify('info', 'El backend no respondió; la demo corre con la simulación física en el navegador.');
      }
    }).catch((error: unknown) => notify('error', error instanceof Error ? error.message : String(error)));
    return () => {
      cancelled = true;
      active?.stop();
    };
  }, [notify]);

  const switchMode = useCallback(async (mode: DataSourceMode) => {
    if (!gateway || gateway.mode === mode) return;
    setSwitching(true);
    try {
      const next = await createGateway(config, mode);
      await next.start();
      gateway.stop();
      setGateway(next);
      notify('info', mode === 'backend' ? 'Conectado al backend Java en tiempo real.' : 'Simulación física local activa.');
    } catch (error) {
      notify('error', error instanceof Error ? error.message : String(error));
    } finally {
      setSwitching(false);
    }
  }, [gateway, notify]);

  if (!gateway) return <>{fallback}</>;
  return (
    <ConnectedProvider gateway={gateway} switchMode={switchMode} switching={switching} notices={notices} notify={notify}>
      {children}
    </ConnectedProvider>
  );
}

function ConnectedProvider({ gateway, children, switchMode, switching, notices, notify }: Omit<TwinContextValue, 'snapshot' | 'scenarios' | 'runScenario' | 'twin'> & { children: ReactNode }) {
  const snapshot = useSyncExternalStore(
    useCallback((listener: () => void) => gateway.subscribe(listener), [gateway]),
    () => gateway.getSnapshot(),
  );
  const runScenario = useCallback(async (scenario: SimulationScenario) => {
    try {
      return await gateway.runScenario(scenario);
    } catch (error) {
      notify('error', error instanceof Error ? error.message : String(error));
      return null;
    }
  }, [gateway, notify]);
  const value = useMemo<TwinContextValue>(() => ({
    gateway,
    snapshot,
    scenarios: gateway.scenarios(),
    runScenario,
    twin: (spaceId: string) => snapshot.twins.find((t) => t.space.spaceId === spaceId),
    switchMode,
    switching,
    notices,
    notify,
  }), [gateway, snapshot, runScenario, switchMode, switching, notices, notify]);
  return <TwinContextInstance.Provider value={value}>{children}</TwinContextInstance.Provider>;
}

export function useTwin(): TwinContextValue {
  const value = useContext(TwinContextInstance);
  if (!value) throw new Error('useTwin debe usarse dentro de TwinProvider');
  return value;
}
