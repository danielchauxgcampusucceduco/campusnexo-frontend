import { describe, expect, it } from 'vitest';
import { seatGrid } from './room';
import type { CampusSpace } from './model';

const space: CampusSpace = {
  spaceId: '203-A', name: 'Aula 203', type: 'AULA', capacity: 6, areaSqm: 20,
  buildingId: 'A', buildingName: 'Bloque A', branchId: 'PST', branchName: 'Pasto', city: 'Pasto',
  climateProfile: 'SEDE_ANDINA', energyTariffCopPerKwh: 14, floor: 2, computers: 0,
  seatRows: 2, seatColumns: 3, hvacInstalled: true, simulationAllowed: false,
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

  it('rejects partial, fractional, and negative layouts before creating camera regions', () => {
    expect(() => seatGrid({ ...space, seatRows: 2, seatColumns: null })).toThrow(RangeError);
    expect(() => seatGrid({ ...space, seatRows: 2.5, seatColumns: 3 })).toThrow(RangeError);
    expect(() => seatGrid({ ...space, seatRows: -2, seatColumns: 3 })).toThrow(RangeError);
  });

  it('caps generated regions to prevent malformed campus metadata from expanding unboundedly', () => {
    expect(() => seatGrid({ ...space, seatRows: 101, seatColumns: 10 })).toThrow('1000 regions');
  });
});
