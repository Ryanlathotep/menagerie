// Wall-top + effective elevation utilities.
//
// A wall is "walkable on top" only when it is surrounded on ALL FOUR cardinal
// sides by other walls. So a 3×3 wall block has 1 walkable interior tile;
// a 4×4 has 4; etc. The outer ring of any wall block remains a battlement
// face — visible as cliff-style edges, but NOT walkable.
//
// "Surrounded buildings" (any non-wall building also surrounded on all 4
// sides by walls or cliffs) are auto-raised to the same elevation as the
// surrounding ring, so they're only reachable by climbing up.
//
// Stairs and ladders are dedicated connectors that let the player change
// z-level adjacent to a wall block or natural cliff. They sit on a ground
// tile and tag onto the wall/cliff next to them.

import { OverworldState, getOverworldTile, OverworldTile } from './overworld';
import type { PlayerBuilding } from './buildings';

// ─── Tile lookups (cheap, no chunk loads) ───
function buildingAt(state: OverworldState, x: number, y: number): PlayerBuilding | undefined {
  return state.playerBuildings?.find(b => b.worldX === x && b.worldY === y);
}

export function isWallAt(state: OverworldState, x: number, y: number): boolean {
  const b = buildingAt(state, x, y);
  return !!b && b.type === 'wall';
}

export function isCliffAt(state: OverworldState, x: number, y: number): boolean {
  const t = getOverworldTile(state, x, y);
  return !!t && t.type === 'cliff';
}

// "High obstacle" = anything that participates in surrounding for the
// auto-raise rule. Walls and cliffs both qualify.
function isHighSide(state: OverworldState, x: number, y: number): boolean {
  return isWallAt(state, x, y) || isCliffAt(state, x, y);
}

// ─── Wall-top walkability ───
// True iff this wall tile is surrounded by walls on all 4 cardinal sides.
// Such a tile is walkable on top (z = ground + 1).
export function isWalkableWallTop(state: OverworldState, x: number, y: number): boolean {
  if (!isWallAt(state, x, y)) return false;
  return (
    isWallAt(state, x, y - 1) &&
    isWallAt(state, x, y + 1) &&
    isWallAt(state, x - 1, y) &&
    isWallAt(state, x + 1, y)
  );
}

// ─── Surrounded-building auto-raise ───
// A non-wall, non-cliff building becomes elevated when all 4 cardinal
// neighbors are walls or cliffs. Returns +1 when surrounded, else 0.
export function buildingElevationBonus(state: OverworldState, x: number, y: number): number {
  const t = getOverworldTile(state, x, y);
  if (!t) return 0;
  if (t.type !== 'player_building') return 0;
  const b = buildingAt(state, x, y);
  if (!b || b.type === 'wall') return 0; // walls are handled by isWalkableWallTop
  return (
    isHighSide(state, x, y - 1) &&
    isHighSide(state, x, y + 1) &&
    isHighSide(state, x - 1, y) &&
    isHighSide(state, x + 1, y)
  ) ? 1 : 0;
}

// ─── Effective Z for a tile ───
// The z a player would have while standing here.
//   - cliff / waterfall: not walkable; return ground for completeness
//   - wall (walkable top): ground + 1
//   - surrounded building: ground + 1
//   - stair/ladder: ground (they're a connector, base sits at ground)
//   - everything else: ground
export function getTileEffectiveZ(state: OverworldState, x: number, y: number, tile?: OverworldTile | null): number {
  const t = tile ?? getOverworldTile(state, x, y);
  if (!t) return 0;
  const ground = t.elevation ?? 0;
  if (t.type === 'player_building') {
    if (isWalkableWallTop(state, x, y)) return ground + 1;
    return ground + buildingElevationBonus(state, x, y);
  }
  return ground;
}

// ─── Stair / ladder helpers ───
// These two building types are "elevation connectors". Standing on them lets
// you transition between the ground (z) and the adjacent wall-top / cliff-top
// (z + 1). The connector itself sits at ground level.
export function isElevationConnector(b: PlayerBuilding | undefined | null): boolean {
  if (!b) return false;
  return b.type === 'stone_staircase' || b.type === 'ladder';
}

export function isElevationConnectorAt(state: OverworldState, x: number, y: number): boolean {
  return isElevationConnector(buildingAt(state, x, y));
}

// True iff this tile has a connector attached to a wall-top or cliff-top
// at the *target* z. Used by pathfinding to allow stepping up onto a wall.
// Specifically: there's a stair/ladder here, AND one of its 4 neighbors is
// a walkable wall-top whose z matches `targetZ`.
export function connectorReachesZ(
  state: OverworldState,
  x: number, y: number,
  targetZ: number,
): boolean {
  if (!isElevationConnectorAt(state, x, y)) return false;
  const here = getOverworldTile(state, x, y);
  const groundZ = here?.elevation ?? 0;
  // Connector spans groundZ ↔ groundZ + 1.
  if (targetZ !== groundZ && targetZ !== groundZ + 1) return false;
  return true;
}

// True iff (x,y) at z is reachable from (x,y) at any other z via a connector.
// Used when arriving on a connector tile from a wall-top above or ground below.
export function connectorAt(state: OverworldState, x: number, y: number): PlayerBuilding | null {
  const b = buildingAt(state, x, y);
  return isElevationConnector(b) ? b! : null;
}

// True if a stair/ladder may be placed at (sx, sy) — that is, it's adjacent
// to at least one wall block (any wall) or a natural cliff face.
export function canPlaceConnectorAt(state: OverworldState, sx: number, sy: number): boolean {
  const dirs: Array<[number, number]> = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  for (const [dx, dy] of dirs) {
    if (isWallAt(state, sx + dx, sy + dy)) return true;
    if (isCliffAt(state, sx + dx, sy + dy)) return true;
  }
  return false;
}

// Returns the z the player would be at on a given tile, considering they
// might be on a wall-top, surrounded building, or just standing on the ground.
// Equivalent to getTileEffectiveZ but renamed for call-site clarity.
export const playerZAt = getTileEffectiveZ;
