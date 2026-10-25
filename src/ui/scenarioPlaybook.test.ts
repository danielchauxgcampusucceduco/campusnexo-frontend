import { describe, expect, it } from 'vitest';
import { ESCENARIOS_OPERATIVOS } from '../domain/model';
import { ESCENARIO_META, VIEW_KEYS } from './scenarioPlaybook';

describe('escenarios reconocidos', () => {
  it('da etiqueta y vista a cada escenario que reconoce el backend', () => {
    for (const escenario of ESCENARIOS_OPERATIVOS) {
      expect(ESCENARIO_META[escenario].label.trim()).not.toBe('');
      expect(Object.keys(VIEW_KEYS)).toContain(ESCENARIO_META[escenario].view);
    }
  });

  it('asigna una tecla distinta a cada vista', () => {
    const keys = Object.values(VIEW_KEYS);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
