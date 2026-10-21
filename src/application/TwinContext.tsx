import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { ArchitectureTrace, ScenarioInfo, SimulationScenario, TwinSpace } from '../domain/model';
import type { DataSourceMode, TwinGateway, TwinSnapshot } from '../ports/TwinGateway';
import { LoginRequiredError, login, logout } from '../adapters/backend/BackendSession';
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
  /** Ends the backend session (backend only). */
  signOut: () => void;
}

const TwinContextInstance = createContext<TwinContextValue | null>(null);
const config = readConfig();
let noticeSequence = 0;

/** What the provider shows before the twin is ready. */
export type GatewayStatus =
  | { kind: 'loading' }
  | { kind: 'login'; reason: string }
  | { kind: 'unavailable'; reason: string };

export interface StatusScreens {
  /** Waiting for the data source. */
  loading: ReactNode;
  /** The backend requires sign-in. */
  login: (props: { reason: string; submit: (username: string, password: string) => Promise<void>; chooseSimulation: () => void }) => ReactNode;
  /** The backend did not answer; never replaced by synthetic data without the person choosing it. */
  unavailable: (props: { reason: string; retry: () => void; chooseSimulation: () => void }) => ReactNode;
}

/** Application layer of the dashboard: owns the active gateway and exposes use cases to the UI. */
export function TwinProvider({ children, screens }: { children: ReactNode; screens: StatusScreens }) {
  const [gateway, setGateway] = useState<TwinGateway | null>(null);
  const [status, setStatus] = useState<GatewayStatus>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [requested, setRequested] = useState<DataSourceMode | 'auto'>(config.preference);
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
    setStatus({ kind: 'loading' });
    createGateway(config, requested).then((created) => {
      if (cancelled) {
        created.stop();
        return;
      }
      active = created;
      setGateway(created);
      if (created.mode === 'simulation' && requested === 'auto') {
        notify('info', 'El servidor no respondió; la demo sigue con la simulación en este navegador.');
      }
    }).catch((error: unknown) => {
      if (cancelled) return;
      const reason = error instanceof Error ? error.message : String(error);
      setStatus(error instanceof LoginRequiredError ? { kind: 'login', reason } : { kind: 'unavailable', reason });
    });
    return () => {
      cancelled = true;
      active?.stop();
    };
  }, [notify, requested, attempt]);

  // An expired or revoked session closes the twin and asks to sign in again.
  useEffect(() => {
    if (!gateway) return;
    return gateway.subscribe(() => {
      if (gateway.getSnapshot().connection === 'unauthorized') {
        gateway.stop();
        logout();
        setGateway(null);
        setStatus({ kind: 'login', reason: 'Tu sesión terminó; vuelve a iniciar sesión.' });
      }
    });
  }, [gateway]);

  const submit = useCallback(async (username: string, password: string) => {
    await login(config.apiBase, username, password);
    setRequested('backend');
    setAttempt((n) => n + 1);
  }, []);
  const chooseSimulation = useCallback(() => setRequested('simulation'), []);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const switchMode = useCallback(async (mode: DataSourceMode) => {
    if (!gateway || gateway.mode === mode) return;
    setSwitching(true);
    try {
      const next = await createGateway(config, mode);
      gateway.stop();
      setGateway(next);
      notify('info', mode === 'backend' ? 'Conectado al servidor real.' : 'Simulación activa: los datos no son del campus real.');
    } catch (error) {
      if (error instanceof LoginRequiredError) {
        gateway.stop();
        setGateway(null);
        setStatus({ kind: 'login', reason: error.message });
      } else {
        notify('error', error instanceof Error ? error.message : String(error));
      }
    } finally {
      setSwitching(false);
    }
  }, [gateway, notify]);

  const signOut = useCallback(() => {
    logout();
    gateway?.stop();
    setGateway(null);
    setStatus({ kind: 'login', reason: 'Sesión cerrada.' });
  }, [gateway]);

  if (!gateway) {
    if (status.kind === 'login') return <>{screens.login({ reason: status.reason, submit, chooseSimulation })}</>;
    if (status.kind === 'unavailable') return <>{screens.unavailable({ reason: status.reason, retry, chooseSimulation })}</>;
    return <>{screens.loading}</>;
  }
  return (
    <ConnectedProvider gateway={gateway} switchMode={switchMode} switching={switching} notices={notices} notify={notify}
      signOut={signOut}>
      {children}
    </ConnectedProvider>
  );
}

function ConnectedProvider({ gateway, children, switchMode, switching, notices, notify, signOut }: Omit<TwinContextValue, 'snapshot' | 'scenarios' | 'runScenario' | 'twin'> & { children: ReactNode }) {
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
    signOut,
  }), [gateway, snapshot, runScenario, switchMode, switching, notices, notify, signOut]);
  return <TwinContextInstance.Provider value={value}>{children}</TwinContextInstance.Provider>;
}

export function useTwin(): TwinContextValue {
  const value = useContext(TwinContextInstance);
  if (!value) throw new Error('useTwin debe usarse dentro de TwinProvider');
  return value;
}
