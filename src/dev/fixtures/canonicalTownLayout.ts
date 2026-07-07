/**
 * Canonical town layout used by the `town-build-and-refund` QA invariant.
 *
 * Each entry is a *relative* offset from `homeBase.position` (which is
 * always (0,0)). The order matters — later entries may rely on earlier
 * ones to extend the buildable radius via the "within 10 Manhattan of home
 * OR any existing building" rule (see `MAX_BUILD_RADIUS` in buildings.ts).
 *
 * Kept intentionally small (~10 builds) so the invariant runs in <100ms.
 */
import type { PlayerBuildingType } from '@/game/buildings';

export interface TownLayoutEntry {
  type: PlayerBuildingType;
  dx: number;
  dy: number;
  note: string;
}

export const CANONICAL_TOWN_LAYOUT: TownLayoutEntry[] = [
  { type: 'wall',           dx:  1, dy:  0, note: 'east perimeter start' },
  { type: 'wall',           dx: -1, dy:  0, note: 'west perimeter start' },
  { type: 'farm',           dx:  0, dy:  2, note: 'south farm' },
  { type: 'scout_tower',    dx:  2, dy:  0, note: 'east watchtower (chained off east wall)' },
  { type: 'forge',          dx:  0, dy: -2, note: 'north forge' },
  { type: 'workbench',      dx:  1, dy: -2, note: 'workbench next to forge' },
  { type: 'brewing_stand',  dx: -1, dy: -2, note: 'brewing next to forge' },
  { type: 'enchanting_altar', dx:  2, dy: -2, note: 'enchanting east of workbench' },
  { type: 'spike_trap',     dx:  3, dy:  0, note: 'trap chained off scout tower' },
  { type: 'farm',           dx:  0, dy:  3, note: 'second farm chained off first' },
];
