import { PLAN_ROOMS } from '../../campus/plan';
import type { CampusSpace, NormalizedPoint, StudyZoneRoi } from '../../domain/model';
import { seatGrid } from '../../domain/room';

export const CAMPUS = {
  branchId: 'UCC-PASTO',
  branchName: 'Universidad Cooperativa de Colombia · Campus Pasto',
  city: 'Pasto',
  address: 'Calle 18 # 47-150, Torobajo',
  averageOutsideC: 13.5,
  tariffCopPerKwh: 865,
} as const;

export const BUILDINGS: Record<string, { name: string; description: string }> = {
  'BLOQUE-A': { name: 'Bloque A', description: 'Salones con pupitres, salas de estudio, auditorio, oficinas y logística' },
  'BLOQUE-B': { name: 'Bloque B', description: 'Biblioteca, cafetería, laboratorios, salas de cómputo y auditorio' },
};

/** Same catalog as Flyway V12: the rooms recognised on the 2025-B plan (estimated capacity and equipment). */
export const SEED_SPACES: CampusSpace[] = PLAN_ROOMS.map((room) => {
  const buildingId = `BLOQUE-${room.block}`;
  return {
    spaceId: room.spaceId, name: room.name, type: room.type, capacity: room.capacity, areaSqm: room.areaSqm,
    buildingId, buildingName: BUILDINGS[buildingId]!.name, branchId: CAMPUS.branchId, branchName: CAMPUS.branchName,
    city: CAMPUS.city, climateProfile: 'SEDE_ANDINA', energyTariffCopPerKwh: CAMPUS.tariffCopPerKwh, floor: room.floor,
    computers: room.computers, seatRows: room.seatRows, seatColumns: room.seatColumns,
  };
});

export const LIBRARY_ID = 'BIBLIOTECA-2B';

/** The reading room has eight tables drawn over its camera (Flyway V12). */
export const LIBRARY_TABLES: StudyZoneRoi[] = (() => {
  const columns: [number, number][] = [[0.06, 0.26], [0.29, 0.49], [0.52, 0.72], [0.75, 0.95]];
  const rows: [number, number][] = [[0.35, 0.58], [0.65, 0.88]];
  const tables: StudyZoneRoi[] = [];
  let number = 1;
  for (const [y0, y1] of rows) {
    for (const [x0, x1] of columns) {
      const polygon: NormalizedPoint[] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
      tables.push({ zoneId: `BIB2B-M${String(number).padStart(2, '0')}`, label: `Mesa ${number}`, polygon });
      number++;
    }
  }
  return tables;
})();

/** Seat regions of a room: the drawn tables of the reading room, otherwise its seat grid. */
export function regionsOf(space: CampusSpace): StudyZoneRoi[] {
  return space.spaceId === LIBRARY_ID ? LIBRARY_TABLES : seatGrid(space);
}
