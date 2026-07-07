/** Default arena room presets. Admin editor can add more later. */
import type { ArenaRoom } from './types';

export const DEFAULT_ROOMS: ArenaRoom[] = [
  {
    id: 'oval_sand',
    name: 'Plain Sand Oval',
    shape: 'oval',
    floorColor: 'hsl(38 55% 72%)',
    rimColor: 'hsl(30 25% 40%)',
    crowdDensity: 32,
  },
];

export const CUSTOM_ROOMS_KEY = 'menagerie_arena_rooms_v1';

export function getAllRooms(): ArenaRoom[] {
  try {
    const raw = localStorage.getItem(CUSTOM_ROOMS_KEY);
    if (!raw) return DEFAULT_ROOMS;
    const custom = JSON.parse(raw) as ArenaRoom[];
    return [...DEFAULT_ROOMS, ...custom];
  } catch {
    return DEFAULT_ROOMS;
  }
}

export function saveCustomRooms(rooms: ArenaRoom[]) {
  const customOnly = rooms.filter(r => !DEFAULT_ROOMS.some(d => d.id === r.id));
  localStorage.setItem(CUSTOM_ROOMS_KEY, JSON.stringify(customOnly));
}

export function getRoom(id: string): ArenaRoom {
  return getAllRooms().find(r => r.id === id) ?? DEFAULT_ROOMS[0];
}
