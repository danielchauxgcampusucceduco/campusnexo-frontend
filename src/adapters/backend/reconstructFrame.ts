import { boxAround, polygonCentroid } from '../../domain/geometry';
import type { TrackedDetection, TwinSpace } from '../../domain/model';
import type { CameraFrame } from '../../ports/TwinGateway';

/** Deterministic pseudo-random number in [0, 1) from a string seed and an index. */
function seeded(seed: string, index: number): number {
  let hash = 2166136261 ^ index;
  for (let i = 0; i < seed.length; i++) hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619);
  return ((hash >>> 0) % 10_000) / 10_000;
}

/**
 * The edge worker never sends boxes to the dashboard, so with the backend the viewer rebuilds a scene
 * that matches the twin: people at verified desks, belongings at held desks and the remaining
 * occupancy spread over seats. Positions are deterministic per space, with a small idle sway.
 */
export function reconstructFrame(twin: TwinSpace, realTimeMs: number): CameraFrame {
  const { state, space, rois } = twin;
  const detections: TrackedDetection[] = [];
  let trackId = 1;
  const sway = (index: number) => Math.sin(realTimeMs / 900 + index * 1.7) * 0.0025;
  if (state.cameraOnline) {
    const deskById = new Map(state.desks.map((desk) => [desk.zoneId, desk]));
    let deskPeople = 0;
    for (const roi of rois) {
      const desk = deskById.get(roi.zoneId);
      if (!desk) continue;
      const [cx, cy] = polygonCentroid(roi.polygon);
      for (let p = 0; p < desk.peopleInside; p++) {
        detections.push({ trackId: trackId++, objectClass: 'PERSON', confidence: 0.9, box: boxAround([cx - 0.02 + sway(trackId), cy - 0.01], 0.045, 0.075) });
        deskPeople++;
      }
      for (let b = 0; b < desk.belongingsInside; b++) {
        detections.push({ trackId: trackId++, objectClass: b % 2 === 0 ? 'LAPTOP' : 'BACKPACK', confidence: 0.78, box: boxAround([cx + 0.035 + b * 0.012, cy + 0.035 - b * 0.02], 0.045, 0.035) });
      }
    }
    const isLibrary = rois.length > 0;
    const free = Math.max(0, Math.min(60, state.occupancy - deskPeople));
    const columns = isLibrary ? 12 : Math.ceil(Math.sqrt(space.capacity * 1.7));
    for (let i = 0; i < free; i++) {
      const column = i % columns;
      const row = Math.floor(i / columns);
      const x = isLibrary ? 0.04 + column * 0.078 : 0.14 + (column / Math.max(1, columns - 1)) * 0.78;
      const y = isLibrary ? 0.13 + (row % 3) * 0.07 : 0.2 + row * 0.11;
      const jitter = (seeded(space.spaceId, i) - 0.5) * 0.01;
      detections.push({ trackId: trackId++, objectClass: 'PERSON', confidence: 0.84 + seeded(space.spaceId, i + 99) * 0.12, box: boxAround([x + jitter + sway(i), Math.min(0.95, y)], 0.045, 0.075) });
    }
  }
  return { spaceId: space.spaceId, capturedAt: Date.parse(state.updatedAt), cameraOnline: state.cameraOnline, detections, origin: 'reconstruido-desde-gemelo' };
}
