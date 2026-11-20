import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  // The stage router reads the URL hash when it loads; the test runner has no window.
  Object.assign(globalThis, { location: { hash: '' }, addEventListener: () => {}, removeEventListener: () => {} });
});
import type { ProgramaDemo, SalaDemo } from '../../domain/model';
import { programaDe, tieneClaseDe } from './SimulacionView';

const programa = (codigo: string): ProgramaDemo => ({ codigo, nombre: codigo, nivel: 'Pregrado', semestres: 10, grupos: 1, sesionesPorSemana: 6, fuente: 'supuesto' });
const programas = [programa('ISW'), programa('MED'), programa('MDH'), programa('DER')];

describe('programs of the simulated campus', () => {
  it('tells the program of a group by its prefix, even when one code starts like another', () => {
    expect(programaDe('MED12A', programas)?.codigo).toBe('MED');
    expect(programaDe('MDH2A', programas)?.codigo).toBe('MDH');
    expect(programaDe('ISW3B', programas)?.codigo).toBe('ISW');
    expect(programaDe('XYZ1A', programas)).toBeUndefined();
  });

  it('keeps a room in the grid only when it has a class of the chosen program that day', () => {
    const sala = { horario: [{ uso: 'LIBRE', curso: null, detalle: null }, { uso: 'CLASE', curso: 'Anatomía · MED2A', detalle: null }] } as unknown as SalaDemo;

    expect(tieneClaseDe(sala, 'MED', programas)).toBe(true);
    expect(tieneClaseDe(sala, 'DER', programas)).toBe(false);
  });
});
