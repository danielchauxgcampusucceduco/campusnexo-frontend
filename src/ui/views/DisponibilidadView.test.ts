import { describe, expect, it } from 'vitest';
import type { EspacioDisponible, EstadoFranja } from '../../domain/model';
import { hora, libresAhora, libresEnFranja } from './DisponibilidadView';

const espacio = (spaceId: string, ahora: EstadoFranja | null, libreHasta: string | null, estados: EstadoFranja[]): EspacioDisponible => ({
  spaceId, nombre: spaceId, tipo: 'AULA', edificio: 'Bloque A', piso: 3, aforo: 30, conCamara: true, personas: 0, ahora, libreHasta,
  franjas: estados.map((estado, i) => ({ desde: `${String(7 + i).padStart(2, '0')}:00:00`, hasta: `${String(8 + i).padStart(2, '0')}:00:00`, estado, detalle: null })),
});

describe('availability grid', () => {
  it('lists the free spaces, the one free longest first, and counts a class nobody attended as free', () => {
    const espacios = [
      espacio('301-A', 'LIBRE', '10:00:00', ['LIBRE', 'CLASE']),
      espacio('302-A', 'PROGRAMADO_SIN_USO', null, ['PROGRAMADO_SIN_USO', 'LIBRE']),
      espacio('303-A', 'CLASE', null, ['CLASE', 'RESERVADO']),
    ];

    expect(libresAhora(espacios).map((e) => e.spaceId)).toEqual(['302-A', '301-A']);
    expect(libresEnFranja(espacios, 0)).toBe(2);
    expect(libresEnFranja(espacios, 1)).toBe(1);
  });

  it('shows hours without the leading zero or seconds', () => {
    expect(hora('07:00:00')).toBe('7:00');
    expect(hora('14:30:00')).toBe('14:30');
  });
});
