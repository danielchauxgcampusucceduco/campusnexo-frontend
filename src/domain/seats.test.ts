import { describe, expect, it } from 'vitest';
import { seatGrid } from './room';
import type { CampusSpace } from './model';

const space: CampusSpace = {
  spaceId: '203-A', name: 'Aula 203', type: 'AULA', capacity: 6, areaSqm: 20,
  buildingId: 'A', buildingName: 'Bloque A', branchId: 'PST', branchName: 'Pasto', city: 'Pasto',
  climateProfile: 'SEDE_ANDINA', energyTariffCopPerKwh: 14, floor: 2, computers: 0,
  seatRows: 2, seatColumns: 3,
};

describe('seat grid policy', () => {
  it('numbers regions row by row and leaves a front inset', () => {
    const seats = seatGrid(space);

    expect(seats.map(({ zoneId }) => zoneId)).toEqual([
      '203-A-P01', '203-A-P02', '203-A-P03', '203-A-P04', '203-A-P05', '203-A-P06',
    ]);
    expect(seats[0]!.label).toBe('Pupitre 1');
    expect(seats[0]!.polygon[0]![1]).toBeGreaterThan(0.3);
  });

  it('returns no camera regions for spaces without a seat layout', () => {
    expect(seatGrid({ ...space, seatRows: null, seatColumns: null })).toEqual([]);
  });
});
