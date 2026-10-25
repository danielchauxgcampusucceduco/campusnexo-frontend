import { describe, expect, it } from 'vitest';
import { parseCursos } from './HerramientasIa';
import { etiqueta, seconds } from './Puestos';

describe('herramientas de administración', () => {
  it('reads one course per line and reports the lines it cannot read', () => {
    expect(parseCursos('IS-701, 32\n\n  IS-502;24 \nCálculo I\t40\nsin número')).toEqual({
      cursos: [{ cursoId: 'IS-701', asistentes: 32 }, { cursoId: 'IS-502', asistentes: 24 }, { cursoId: 'Cálculo I', asistentes: 40 }],
      invalid: ['sin número'],
    });
    expect(parseCursos('IS-701, 0').invalid).toEqual(['IS-701, 0']);
  });

  it('labels a proposed seat like the backend: row letter, column number', () => {
    expect(etiqueta({ fila: 1, columna: 4 })).toBe('A4');
    expect(etiqueta({ fila: 5, columna: 6 })).toBe('E6');
  });

  it('reads the pairing slot in seconds or as an ISO-8601 duration', () => {
    expect(seconds(5)).toBe(5);
    expect(seconds('PT5S')).toBe(5);
    expect(seconds('PT1M15S')).toBe(75);
    expect(seconds('PT0.5S')).toBe(0.5);
    expect(seconds('cinco')).toBeNaN();
  });
});
