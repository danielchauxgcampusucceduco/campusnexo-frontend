import { describe, expect, it } from 'vitest';
import { ALERT_TYPES, ESTADOS_FRANJA, ROOM_CONDITIONS, SPACE_STATUSES, type ZoneDeskState } from '../domain/model';
import { ALERT_LABEL, CONDITION_META, DESK_META, FRANJA_META, STATUS_META } from './theme';

describe('display metadata', () => {
  it('defines non-empty labels, hints and colors for every room status and availability slot', () => {
    for (const meta of [...SPACE_STATUSES.map((s) => STATUS_META[s]), ...ESTADOS_FRANJA.map((e) => FRANJA_META[e])]) {
      expect(meta.label.trim()).not.toBe('');
      expect(meta.hint.trim()).not.toBe('');
      expect(meta.color).toMatch(/^(#[\da-f]{6}|var\(--[\w-]+\))$/i);
    }
  });

  it('covers every room condition, desk state and alert type with a presentation label', () => {
    for (const condition of ROOM_CONDITIONS) expect(CONDITION_META[condition].label.trim()).not.toBe('');
    const deskStates: ZoneDeskState[] = ['DISPONIBLE', 'OCUPADO_VERIFICADO', 'ALERTA_ACAPARAMIENTO', 'LIBERADO_POR_ABANDONO'];
    for (const state of deskStates) expect(DESK_META[state].label.trim()).not.toBe('');
    for (const type of ALERT_TYPES) expect(ALERT_LABEL[type].trim()).not.toBe('');
  });
});
