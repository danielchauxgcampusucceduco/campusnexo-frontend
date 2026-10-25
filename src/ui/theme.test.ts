import { describe, expect, it } from 'vitest';
import { HVAC_CONTROL_STATES, ROOM_CONDITIONS, SPACE_STATUSES, type ZoneDeskState } from '../domain/model';
import { CONDITION_META, DESK_META, HVAC_META, STATUS_META } from './theme';

describe('display metadata', () => {
  it('defines non-empty labels, hints and colors for every room and HVAC state', () => {
    for (const status of SPACE_STATUSES) {
      expect(STATUS_META[status].label.trim()).not.toBe('');
      expect(STATUS_META[status].hint.trim()).not.toBe('');
      expect(STATUS_META[status].color).toMatch(/^(#[\da-f]{6}|var\(--[\w-]+\))$/i);
    }
    for (const state of HVAC_CONTROL_STATES) {
      expect(HVAC_META[state].label.trim()).not.toBe('');
      expect(HVAC_META[state].hint.trim()).not.toBe('');
      expect(HVAC_META[state].color).toMatch(/^(#[\da-f]{6}|var\(--[\w-]+\))$/i);
    }
  });

  it('covers every room condition and desk state with a presentation label', () => {
    for (const condition of ROOM_CONDITIONS) expect(CONDITION_META[condition].label.trim()).not.toBe('');
    const deskStates: ZoneDeskState[] = ['DISPONIBLE', 'OCUPADO_VERIFICADO', 'ALERTA_ACAPARAMIENTO', 'LIBERADO_POR_ABANDONO'];
    for (const state of deskStates) expect(DESK_META[state].label.trim()).not.toBe('');
  });
});
