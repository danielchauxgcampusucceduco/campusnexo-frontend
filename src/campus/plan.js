import data from './campusPlan.json';
export const PLAN_SOURCE = data.source;
export const PLAN_FLOORS = data.floors;
export const PLAN_ROOMS = PLAN_FLOORS.flatMap((floor) => floor.rooms);
const BY_ID = new Map(PLAN_ROOMS.map((room) => [room.spaceId, room]));
export const planRoom = (spaceId) => BY_ID.get(spaceId);
export const floorName = (floor) => PLAN_FLOORS.find((f) => f.floor === floor)?.name ?? `Piso ${floor}`;
