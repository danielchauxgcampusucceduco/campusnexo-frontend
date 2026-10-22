import { describe, expect, it } from 'vitest';
import { SCENARIO_CATALOG } from '../domain/scenarios';
import type { SimulationScenario } from '../domain/model';
import { SCENARIO_GROUPS, SCENARIO_STAGE, VIEW_KEYS } from './scenarioPlaybook';

describe('scenario presentation choreography', () => {
  it('keeps every catalog scenario in exactly one visible group', () => {
    const catalog = SCENARIO_CATALOG.map(({ scenario }) => scenario);
    const grouped = SCENARIO_GROUPS.flatMap(({ scenarios }) => scenarios);
    const groupedCatalog = catalog.filter((scenario) => scenario !== 'REINICIAR');

    expect(new Set(catalog).size).toBe(catalog.length);
    expect(new Set(grouped).size).toBe(grouped.length);
    expect([...grouped].sort()).toEqual([...groupedCatalog].sort());
    expect(SCENARIO_STAGE.REINICIAR.view).toBeNull();
  });

  it('assigns unique shortcuts and valid views to each scenario', () => {
    const entries = Object.entries(SCENARIO_STAGE) as [SimulationScenario, (typeof SCENARIO_STAGE)[SimulationScenario]][];
    const keys = entries.map(([, stage]) => stage.key);

    expect(new Set(keys).size).toBe(keys.length);
    for (const [, stage] of entries) {
      expect(stage.label.trim()).not.toBe('');
      expect(stage.view === null || stage.view in VIEW_KEYS).toBe(true);
    }
  });
});
