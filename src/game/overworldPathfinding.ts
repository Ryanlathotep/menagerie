// A* Pathfinding for overworld tap-to-move navigation.
// Treats grass/road tiles as walkable. The destination tile is allowed even
// if it's an interactable (tree/rock/building/dungeon/nest/enemy) — the
// caller will stop one step early or trigger the relevant interaction on
// arrival via movePlayer().

import { OverworldState, OverworldTile, getOverworldTile, ensureChunksLoaded } from './overworld';
import { Position } from './types';
import { isWallActingAsGate } from './buildings';
import { getTileEffectiveZ, isWalkableWallTop, isElevationConnectorAt } from './wallTop';

interface PathNode {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
  parent: PathNode | null;
}

function heuristic(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

// Tiles a path can step *through*. Goal tile uses a looser check.
// `avoidStructures` (used by auto-harvest / auto-hunt / auto-search) forbids
// stepping onto dungeon entrances, NPC buildings, and player-built structures
// mid-path — auto-jobs must never blunder into a dungeon or trigger a build
// menu just because it happened to lie on the shortest route.
function isTraversable(
  tile: OverworldTile | null,
  state: OverworldState,
  x: number,
  y: number,
  avoidStructures = false,
): boolean {
  if (!tile) return false;
  switch (tile.type) {
    case 'grass':
    case 'dirt_road':
    case 'stone_road':
      return true;
    case 'building':
    case 'dungeon_entrance':
      return !avoidStructures;
    case 'player_building': {
      const id = tile.playerBuildingId;
      if (!id) return !avoidStructures;
      const b = state.playerBuildings?.find(pb => pb.id === id);
      if (!b) return !avoidStructures;
      // Walls: only traversable via gate OR walkable wall-top. Those remain
      // legal even for auto-jobs since they're the intended traversal path
      // through a walled area.
      if (b.type === 'wall') {
        return isWallActingAsGate(b, state) || isWalkableWallTop(state, x, y);
      }
      return !avoidStructures;
    }
    case 'water':
    case 'tree':
    case 'rock':
    case 'plant':
    case 'enemy':
    case 'nest':
    case 'cliff':
    case 'waterfall':
      return false;
    default:
      return false;
  }
}

// Find a 4-connected path from start to goal. Goal is included in returned
// path. Returns null if no path exists within the search budget.
export interface FindOverworldPathOptions {
  /** Refuse to path through structures (dungeon entrances, NPC buildings,
   *  non-gate player buildings). Auto-harvest / auto-hunt / auto-search must
   *  pass this so they never wander onto a dungeon and trigger entry. */
  avoidStructures?: boolean;
}

export function findOverworldPath(
  state: OverworldState,
  start: Position,
  goal: Position,
  maxNodes = 8000,
  options: FindOverworldPathOptions = {},
): Position[] | null {
  if (start.x === goal.x && start.y === goal.y) return [];
  const avoidStructures = !!options.avoidStructures;

  // Make sure tiles around the goal are loaded so we don't pathfind through
  // ungenerated chunks.
  ensureChunksLoaded(state, goal.x, goal.y);

  const goalTile = getOverworldTile(state, goal.x, goal.y);
  if (!goalTile) return null;
  // Goal must be either traversable or a known interaction target. We let the
  // caller decide what "arrival" means — but obviously-blocked goals (water
  // with no interaction) aren't paths to anywhere useful.
  const goalIsInteractable =
    goalTile.type === 'tree' ||
    goalTile.type === 'rock' ||
    goalTile.type === 'plant' ||
    goalTile.type === 'enemy' ||
    goalTile.type === 'nest' ||
    goalTile.type === 'dungeon_entrance' ||
    goalTile.type === 'building' ||
    goalTile.type === 'player_building';
  if (!isTraversable(goalTile, state, goal.x, goal.y, avoidStructures) && !goalIsInteractable) return null;

  const open: PathNode[] = [];
  const closed = new Set<string>();
  const startNode: PathNode = {
    x: start.x, y: start.y,
    g: 0, h: heuristic(start, goal), f: heuristic(start, goal),
    parent: null,
  };
  open.push(startNode);
  let visited = 0;

  while (open.length > 0 && visited < maxNodes) {
    // Pop lowest-f node.
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[bestIdx].f) bestIdx = i;
    }
    const current = open.splice(bestIdx, 1)[0];
    closed.add(`${current.x},${current.y}`);
    visited++;

    if (current.x === goal.x && current.y === goal.y) {
      const path: Position[] = [];
      let n: PathNode | null = current;
      while (n) {
        path.unshift({ x: n.x, y: n.y });
        n = n.parent;
      }
      path.shift(); // drop start
      return path;
    }

    const neighbors: Position[] = [
      { x: current.x, y: current.y - 1 },
      { x: current.x, y: current.y + 1 },
      { x: current.x - 1, y: current.y },
      { x: current.x + 1, y: current.y },
    ];
    for (const nb of neighbors) {
      const key = `${nb.x},${nb.y}`;
      if (closed.has(key)) continue;
      const isGoal = nb.x === goal.x && nb.y === goal.y;
      const tile = getOverworldTile(state, nb.x, nb.y);
      if (!tile) continue;
      // Fog-of-war rule: we usually only path through explored terrain so
      // players can't blindly march into hazards. But for the last 2 tiles
      // around the goal we relax this — tapping just past the fog edge
      // should auto-walk to the boundary instead of silently failing.
      const distToGoal = Math.abs(nb.x - goal.x) + Math.abs(nb.y - goal.y);
      if (!tile.explored && distToGoal > 2) continue;
      if (!isGoal && !isTraversable(tile, state, nb.x, nb.y, avoidStructures)) continue;
      if (isGoal && !isTraversable(tile, state, nb.x, nb.y, avoidStructures) && !goalIsInteractable) continue;

      // Z-transition gate (mirrors movePlayer): only enforced when a wall-top
      // is involved. Natural ground elevation differences are walkable.
      const fromTile = getOverworldTile(state, current.x, current.y);
      const fromZ = getTileEffectiveZ(state, current.x, current.y, fromTile);
      const toZ = getTileEffectiveZ(state, nb.x, nb.y, tile);
      const fromIsWallTop = !!fromTile && fromTile.type === 'player_building' && isWalkableWallTop(state, current.x, current.y);
      const toIsWallTop = tile.type === 'player_building' && isWalkableWallTop(state, nb.x, nb.y);
      if ((fromIsWallTop || toIsWallTop) && fromZ !== toZ) {
        const fromIsConnector = !!fromTile && fromTile.type === 'player_building'
          && isElevationConnectorAt(state, current.x, current.y);
        const toIsConnector = tile.type === 'player_building'
          && isElevationConnectorAt(state, nb.x, nb.y);
        if (!fromIsConnector && !toIsConnector) continue;
      }

      // Step cost: roads are cheaper so the walker hugs them when possible.
      // Stone roads (with the speed boost) get a deeper discount than dirt.
      let stepCost = 1;
      if (tile.type === 'stone_road') stepCost = 0.6;
      else if (tile.type === 'dirt_road') stepCost = 0.8;
      const g = current.g + stepCost;
      const h = heuristic(nb, goal);
      const f = g + h;
      const existing = open.find(o => o.x === nb.x && o.y === nb.y);
      if (existing) {
        if (g < existing.g) {
          existing.g = g; existing.f = f; existing.parent = current;
        }
      } else {
        open.push({ x: nb.x, y: nb.y, g, h, f, parent: current });
      }
    }
  }
  return null;
}
