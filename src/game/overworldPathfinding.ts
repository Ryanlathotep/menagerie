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
function isTraversable(tile: OverworldTile | null, state: OverworldState, x: number, y: number): boolean {
  if (!tile) return false;
  switch (tile.type) {
    case 'grass':
    case 'dirt_road':
    case 'stone_road':
    case 'building':       // towns/campfires are walked onto
    case 'dungeon_entrance':
      return true;
    case 'player_building': {
      const id = tile.playerBuildingId;
      if (!id) return true;
      const b = state.playerBuildings?.find(pb => pb.id === id);
      if (!b) return true;
      // Walls are only traversable when they're a gate OR when this is a
      // walkable wall-top (interior of a 3×3+ wall block).
      if (b.type === 'wall') {
        return isWallActingAsGate(b, state) || isWalkableWallTop(state, x, y);
      }
      return true;
    }
    case 'water':
    case 'tree':
    case 'rock':
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
export function findOverworldPath(
  state: OverworldState,
  start: Position,
  goal: Position,
  maxNodes = 4000,
): Position[] | null {
  if (start.x === goal.x && start.y === goal.y) return [];

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
    goalTile.type === 'enemy' ||
    goalTile.type === 'nest' ||
    goalTile.type === 'dungeon_entrance' ||
    goalTile.type === 'building' ||
    goalTile.type === 'player_building';
  if (!isTraversable(goalTile, state) && !goalIsInteractable) return null;

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
      // We don't path through fog — only through known terrain. This keeps
      // tap-to-move from blindly marching into hazards.
      if (!tile.explored) continue;
      if (!isGoal && !isTraversable(tile, state)) continue;
      if (isGoal && !isTraversable(tile, state) && !goalIsInteractable) continue;

      const g = current.g + 1;
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
