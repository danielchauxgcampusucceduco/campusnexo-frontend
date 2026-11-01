import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ViewId } from './scenarioPlaybook';

/** Room the dashboard opens on: the pilot computer lab. */
export const DEFAULT_SPACE = '301-A';

interface StageValue {
  /** Space shown in the room detail, shared by every view. */
  selectedSpace: string;
  selectSpace: (spaceId: string) => void;
}

const StageContextInstance = createContext<StageValue | null>(null);

export function navigate(view: ViewId) {
  if (location.hash !== `#/${view}`) location.hash = `#/${view}`;
}

/** The route of the address: `#/salon/310-A` is the view `salon` with the parameter `310-A`. */
export function parseRoute(hash: string): { view: string; param: string | null } {
  const [view = '', ...rest] = hash.replace(/^#\/?/, '').split('/');
  return { view, param: rest.length > 0 && rest.join('/') ? decodeURIComponent(rest.join('/')) : null };
}

/** The parameter of the current route when it is `view`'s, following the address as it changes. */
export function useRouteParam(view: ViewId): string | null {
  const read = () => {
    const route = parseRoute(location.hash);
    return route.view === view ? route.param : null;
  };
  const [param, setParam] = useState(read);
  useEffect(() => {
    const onHash = () => setParam(read());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  });
  return param;
}

/** Writes the route without a new history entry (a selection, not a navigation). */
export function replaceRoute(view: ViewId, param: string) {
  const hash = `#/${view}/${encodeURIComponent(param)}`;
  if (location.hash !== hash) history.replaceState(null, '', hash);
}

export function StageProvider({ children }: { children: ReactNode }) {
  const [selectedSpace, selectSpace] = useState(DEFAULT_SPACE);
  const value = useMemo(() => ({ selectedSpace, selectSpace }), [selectedSpace]);
  return <StageContextInstance.Provider value={value}>{children}</StageContextInstance.Provider>;
}

export function useStage(): StageValue {
  const value = useContext(StageContextInstance);
  if (!value) throw new Error('useStage debe usarse dentro de StageProvider');
  return value;
}
