import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { BackendError } from '../adapters/backend/http';
import { LoginRequiredError, login, logout } from '../adapters/backend/BackendSession';
import { watchIdle } from './idleSignOut';
import type { TwinSpace } from '../domain/model';
import type { OperacionesPort } from '../ports/OperacionesPort';
import type { TwinGateway, TwinSnapshot } from '../ports/TwinGateway';
import { connect, readConfig, type Connection } from './gatewayFactory';

export interface Notice {
  id: number;
  tone: 'info' | 'error';
  text: string;
}

interface TwinContextValue {
  gateway: TwinGateway;
  operaciones: OperacionesPort;
  snapshot: TwinSnapshot;
  notices: Notice[];
  notify: (tone: Notice['tone'], text: string) => void;
  twin: (spaceId: string) => TwinSpace | undefined;
  /** Ends the session. */
  signOut: () => void;
}

const TwinContextInstance = createContext<TwinContextValue | null>(null);
let noticeSequence = 0;

/** What the person can do about a failed request, in plain words. */
export function describeError(error: unknown): string {
  if (error instanceof BackendError) {
    if (error.code === 'admin_network_required') {
      return 'Esta función solo responde desde la red de la administración: conéctate a la VPN de CampusNexo e inténtalo de nuevo.';
    }
    if (error.status === 403) return 'Tu rol no permite esta acción.';
    if (error.status === 503) return `${error.message} El resto del tablero sigue funcionando.`;
  }
  return error instanceof Error ? error.message : String(error);
}

/** What the provider shows before the twin is ready. */
export type GatewayStatus =
  | { kind: 'loading' }
  | { kind: 'login'; reason: string }
  | { kind: 'unavailable'; reason: string };

export interface StatusScreens {
  /** Waiting for the backend. */
  loading: ReactNode;
  /** The backend requires sign-in. */
  login: (props: { reason: string; submit: (username: string, password: string) => Promise<void> }) => ReactNode;
  /** The backend did not answer; the dashboard never shows invented data instead. */
  unavailable: (props: { reason: string; retry: () => void }) => ReactNode;
}

/** Application layer of the dashboard: owns the connection to the backend and exposes it to the UI. */
export function TwinProvider({ children, screens }: { children: ReactNode; screens: StatusScreens }) {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [status, setStatus] = useState<GatewayStatus>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [config] = useState(readConfig);

  const notify = useCallback((tone: Notice['tone'], text: string) => {
    const id = ++noticeSequence;
    setNotices((current) => [...current.slice(-2), { id, tone, text }]);
    setTimeout(() => setNotices((current) => current.filter((n) => n.id !== id)), 6_000);
  }, []);

  useEffect(() => {
    let active: Connection | null = null;
    let cancelled = false;
    setStatus({ kind: 'loading' });
    connect(config).then((created) => {
      if (cancelled) {
        created.gateway.stop();
        return;
      }
      active = created;
      setConnection(created);
    }).catch((error: unknown) => {
      if (cancelled) return;
      const reason = error instanceof Error ? error.message : String(error);
      setStatus(error instanceof LoginRequiredError ? { kind: 'login', reason } : { kind: 'unavailable', reason });
    });
    return () => {
      cancelled = true;
      active?.gateway.stop();
    };
  }, [attempt, config]);

  // An expired or revoked session closes the twin and asks to sign in again.
  useEffect(() => {
    if (!connection) return;
    const { gateway } = connection;
    return gateway.subscribe(() => {
      if (gateway.getSnapshot().connection === 'unauthorized') {
        gateway.stop();
        logout();
        setConnection(null);
        setStatus({ kind: 'login', reason: 'Tu sesión terminó; vuelve a iniciar sesión.' });
      }
    });
  }, [connection]);

  // 30 minutes without using the dashboard (in any tab) close the session; this window then asks to sign in again.
  useEffect(() => {
    if (!connection) return;
    return watchIdle({
      target: window,
      storage: (() => { try { return window.localStorage; } catch { return null; } })(),
      now: Date.now,
      onIdle: () => {
        connection.gateway.stop();
        logout();
        setConnection(null);
        setStatus({ kind: 'login', reason: 'Tu sesión se cerró tras 30 minutos sin actividad; vuelve a iniciar sesión.' });
      },
    });
  }, [connection]);

  const submit = useCallback(async (username: string, password: string) => {
    await login(config.apiBase, username, password);
    setAttempt((n) => n + 1);
  }, [config]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const signOut = useCallback(() => {
    logout();
    connection?.gateway.stop();
    setConnection(null);
    setStatus({ kind: 'login', reason: 'Sesión cerrada.' });
  }, [connection]);

  if (!connection) {
    if (status.kind === 'login') return <>{screens.login({ reason: status.reason, submit })}</>;
    if (status.kind === 'unavailable') return <>{screens.unavailable({ reason: status.reason, retry })}</>;
    return <>{screens.loading}</>;
  }
  return (
    <ConnectedProvider connection={connection} notices={notices} notify={notify} signOut={signOut}>
      {children}
    </ConnectedProvider>
  );
}

function ConnectedProvider({ connection, children, notices, notify, signOut }: {
  connection: Connection; children: ReactNode; notices: Notice[]; notify: TwinContextValue['notify']; signOut: () => void;
}) {
  const { gateway, operaciones } = connection;
  const snapshot = useSyncExternalStore(
    useCallback((listener: () => void) => gateway.subscribe(listener), [gateway]),
    () => gateway.getSnapshot(),
  );
  const value = useMemo<TwinContextValue>(() => ({
    gateway,
    operaciones,
    snapshot,
    twin: (spaceId: string) => snapshot.twins.find((t) => t.space.spaceId === spaceId),
    notices,
    notify,
    signOut,
  }), [gateway, operaciones, snapshot, notices, notify, signOut]);
  return <TwinContextInstance.Provider value={value}>{children}</TwinContextInstance.Provider>;
}

export function useTwin(): TwinContextValue {
  const value = useContext(TwinContextInstance);
  if (!value) throw new Error('useTwin debe usarse dentro de TwinProvider');
  return value;
}

/**
 * Runs a request from a screen: tracks whether it is pending and reports a failure as a notice, so every
 * form shows loading, error and result the same way.
 */
/**
 * Runs a request with a pending flag and a notice. `failure` keeps why the last request failed, so a section that
 * could not load says so (with the same words as the notice) instead of staying on «Cargando…» or showing an empty
 * list as if there were no data.
 */
export function useRequest() {
  const { notify } = useTwin();
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const run = useCallback(async <T,>(request: () => Promise<T>, done?: string): Promise<T | undefined> => {
    setPending(true);
    try {
      const result = await request();
      setFailure(null);
      if (done) notify('info', done);
      return result;
    } catch (error) {
      const message = describeError(error);
      setFailure(message);
      notify('error', message);
      return undefined;
    } finally {
      setPending(false);
    }
  }, [notify]);
  return { pending, run, failure };
}

/** The readable name of a space: screens show it, the code stays for tooltips and the administration. */
export function useSpaceName(): (spaceId: string) => string {
  const { twin } = useTwin();
  return useCallback((spaceId: string) => twin(spaceId)?.space.name ?? spaceId, [twin]);
}
