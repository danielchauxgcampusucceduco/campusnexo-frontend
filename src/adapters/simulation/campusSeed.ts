import type { CampusSpace, NormalizedPoint, StudyZoneRoi } from '../../domain/model';

/** Same catalog as Flyway V2 and V5 (illustrative demo data). */
export const SEED_SPACES: CampusSpace[] = [
  { spaceId: 'AULA-301', name: 'Aula 301', type: 'AULA', capacity: 32, areaSqm: 48, buildingName: 'Bloque C - Ingeniería y Software', branchId: 'SEDE-ANDINA', branchName: 'Campus Torobajo / Sede Andina', city: 'Pasto', climateProfile: 'SEDE_ANDINA', energyTariffCopPerKwh: 865 },
  { spaceId: 'AULA-MAGNA-204', name: 'Aula Magna 204', type: 'AULA', capacity: 48, areaSqm: 72, buildingName: 'Edificio de Aulas Magnas', branchId: 'SEDE-TROPICAL', branchName: 'Campus Metropolitano Norte', city: 'Barranquilla', climateProfile: 'SEDE_TROPICAL', energyTariffCopPerKwh: 1020 },
  { spaceId: 'AULA-ADM-101', name: 'Aula 101', type: 'AULA', capacity: 32, areaSqm: 48, buildingName: 'Bloque de aulas y administración', branchId: 'SEDE-TEMPLADA', branchName: 'Campus Valle de Aburrá / Sede de demostración', city: 'Medellín', climateProfile: 'SEDE_TEMPLADA', energyTariffCopPerKwh: 940 },
  { spaceId: 'BIB-PISO-2', name: 'Biblioteca - Piso 2', type: 'BIBLIOTECA', capacity: 120, areaSqm: 210, buildingName: 'Biblioteca Central Universitaria', branchId: 'SEDE-ANDINA', branchName: 'Campus Torobajo / Sede Andina', city: 'Pasto', climateProfile: 'SEDE_ANDINA', energyTariffCopPerKwh: 865 },
  { spaceId: 'LAB-IA-102', name: 'Laboratorio IA 102', type: 'LABORATORIO', capacity: 24, areaSqm: 54, buildingName: 'Bloque C - Ingeniería y Software', branchId: 'SEDE-ANDINA', branchName: 'Campus Torobajo / Sede Andina', city: 'Pasto', climateProfile: 'SEDE_ANDINA', energyTariffCopPerKwh: 865 },
];

export const AVERAGE_OUTSIDE_C: Record<string, number> = { 'SEDE-ANDINA': 14.5, 'SEDE-TROPICAL': 31.8, 'SEDE-TEMPLADA': 22.8 };

/** Same 2 × 4 desk layout as Flyway V10. */
export const LIBRARY_DESKS: StudyZoneRoi[] = (() => {
  const columns: [number, number][] = [[0.06, 0.26], [0.29, 0.49], [0.52, 0.72], [0.75, 0.95]];
  const rows: [number, number][] = [[0.35, 0.58], [0.65, 0.88]];
  const desks: StudyZoneRoi[] = [];
  let number = 1;
  for (const [y0, y1] of rows) {
    for (const [x0, x1] of columns) {
      const polygon: NormalizedPoint[] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
      desks.push({ zoneId: `BIB2-M${String(number).padStart(2, '0')}`, label: `Mesa ${number}`, polygon });
      number++;
    }
  }
  return desks;
})();

export const ROIS_BY_SPACE: Record<string, StudyZoneRoi[]> = { 'BIB-PISO-2': LIBRARY_DESKS };
