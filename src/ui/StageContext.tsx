import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
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
