import { describe, expect, it } from 'vitest';
import { twinSpace } from '../../test/fixtures';
import { activeScenarios } from './ScenarioDock';

describe('escenarios reconocidos ahora', () => {
  it('groups the rooms by scenario, in the order of the backend enum', () => {
    const clase = { escenario: 'CLASE_EN_CURSO' as const, descripcion: '' };
    const sobrecupo = { escenario: 'SOBRECUPO' as const, descripcion: '' };
    const twins = [
      twinSpace({ escenarios: [sobrecupo, clase] }),
      twinSpace({ escenarios: [clase] }, { spaceId: '303-A' }),
      twinSpace({ escenarios: [] }, { spaceId: '420-A' }),
    ];

    expect(activeScenarios(twins)).toEqual([
      { escenario: 'CLASE_EN_CURSO', rooms: ['301-A', '303-A'] },
      { escenario: 'SOBRECUPO', rooms: ['301-A'] },
    ]);
  });
});
