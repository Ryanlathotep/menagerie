// A* Pathfinding for click-to-move navigation

import { DungeonState, Position, DungeonTile } from './types';

interface PathNode {
  x: number;
  y: number;
  g: number; // Cost from start
  h: number; // Heuristic to goal
  f: number; // Total cost
  parent: PathNode | null;
}

// Check if a tile is walkable.
// `allowMineable` is opt-in: when the player has Auto-Mine on, we let A* route
// through mineable_wall tiles (the walker will mine on arrival). When it's off
// — the default — mineable walls block pathing so double-tap-to-run walks
// around cavestone instead of stalling against it.
export function isWalkable(tile: DungeonTile, allowMineable = false): boolean {
  if (tile.type === 'wall') return false;
  if (tile.type === 'mineable_wall') return allowMineable;
  return true;
}

// Manhattan distance heuristic
function heuristic(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export interface FindPathOptions {
  /** When true, mineable walls are treated as walkable (auto-mine flow). */
  allowMineable?: boolean;
}

// Find path from start to goal using A*
export function findPath(
  dungeon: DungeonState,
  start: Position,
  goal: Position,
  options: FindPathOptions = {},
): Position[] | null {
  const { tiles, width, height } = dungeon;
  const allowMineable = !!options.allowMineable;

  // Check if goal is walkable (except for unexplored tiles).
  // Mineable walls at the goal are only reachable when the caller opted in.
  const goalTile = tiles[goal.y]?.[goal.x];
  if (!goalTile) return null;
  if (goalTile.type === 'wall') return null;
  if (goalTile.type === 'mineable_wall' && !allowMineable) return null;
  
  // Open and closed sets
  const openSet: PathNode[] = [];
  const closedSet = new Set<string>();
  
  const startNode: PathNode = {
    x: start.x,
    y: start.y,
    g: 0,
    h: heuristic(start, goal),
    f: heuristic(start, goal),
    parent: null,
  };
  
  openSet.push(startNode);
  
  while (openSet.length > 0) {
    // Find node with lowest f score
    let current = openSet[0];
    let currentIndex = 0;
    
    for (let i = 1; i < openSet.length; i++) {
      if (openSet[i].f < current.f) {
        current = openSet[i];
        currentIndex = i;
      }
    }
    
    // Check if we reached the goal
    if (current.x === goal.x && current.y === goal.y) {
      // Reconstruct path
      const path: Position[] = [];
      let node: PathNode | null = current;
      
      while (node) {
        path.unshift({ x: node.x, y: node.y });
        node = node.parent;
      }
      
      // Remove start position (player is already there)
      path.shift();
      return path;
    }
    
    // Move current to closed set
    openSet.splice(currentIndex, 1);
    closedSet.add(`${current.x},${current.y}`);
    
    // Check neighbors (4-directional)
    const neighbors = [
      { x: current.x, y: current.y - 1 }, // up
      { x: current.x, y: current.y + 1 }, // down
      { x: current.x - 1, y: current.y }, // left
      { x: current.x + 1, y: current.y }, // right
    ];
    
    for (const neighbor of neighbors) {
      // Bounds check
      if (neighbor.x < 0 || neighbor.x >= width || neighbor.y < 0 || neighbor.y >= height) {
        continue;
      }
      
      // Already processed
      if (closedSet.has(`${neighbor.x},${neighbor.y}`)) {
        continue;
      }
      
      // Check walkability. Only the *goal* tile is allowed to be a mineable
      // wall (and only when the caller opted in) — never a mid-path step, or
      // the walker would try to phase through solid rock without mining it.
      const tile = tiles[neighbor.y][neighbor.x];
      const isGoal = neighbor.x === goal.x && neighbor.y === goal.y;
      if (!isWalkable(tile, allowMineable && isGoal)) {
        continue;
      }
      
      const g = current.g + 1;
      const h = heuristic(neighbor, goal);
      const f = g + h;
      
      // Check if already in open set with better score
      const existingIndex = openSet.findIndex(n => n.x === neighbor.x && n.y === neighbor.y);
      
      if (existingIndex !== -1) {
        if (g < openSet[existingIndex].g) {
          openSet[existingIndex].g = g;
          openSet[existingIndex].f = f;
          openSet[existingIndex].parent = current;
        }
      } else {
        openSet.push({
          x: neighbor.x,
          y: neighbor.y,
          g,
          h,
          f,
          parent: current,
        });
      }
    }
  }
  
  // No path found
  return null;
}

// Get direction from one position to the next
export function getDirection(from: Position, to: Position): 'up' | 'down' | 'left' | 'right' | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  
  if (dx === 1 && dy === 0) return 'right';
  if (dx === -1 && dy === 0) return 'left';
  if (dx === 0 && dy === 1) return 'down';
  if (dx === 0 && dy === -1) return 'up';
  
  return null;
}
