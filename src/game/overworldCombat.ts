// Overworld Combat System - Targeting, enemy AI, and tactical combat on the overworld map

import { Position, Monster } from './types';
import { OverworldState, OverworldTile, getOverworldTile, getOverworldEnemy, removeOverworldEnemy, setOverworldTile } from './overworld';
import { Move } from './moves';
import { EvolvedMove } from './moveMastery';
import { AttackConfig, getAttackConfig, getEnemyBehavior } from './dungeonCombat';
import * as enemyAI from './enemyAI';

// A tile is "blocking" for line-of-sight / AoE propagation if a projectile or
// blast can't physically pass through it: water, rock walls, trees, buildings,
// and active nests all qualify. Grass, roads, and even enemies/items are passable.
function isOverworldBlocker(tile: OverworldTile | null | undefined): boolean {
  if (!tile) return true; // off-map = blocked
  switch (tile.type) {
    case 'rock':
    case 'water':
    case 'tree':
    case 'player_building':
    case 'nest':
    case 'dungeon_entrance':
      return true;
    default:
      return false;
  }
}

// Bresenham line LOS check between two positions on the overworld.
// Endpoints themselves are never treated as blockers — only tiles strictly
// between origin and target.
function overworldHasLineOfSight(
  overworld: OverworldState,
  from: Position,
  to: Position,
): boolean {
  let x0 = from.x;
  let y0 = from.y;
  const x1 = to.x;
  const y1 = to.y;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    const isEndpoint =
      (x0 === from.x && y0 === from.y) || (x0 === to.x && y0 === to.y);
    if (!isEndpoint) {
      if (isOverworldBlocker(getOverworldTile(overworld, x0, y0))) return false;
    }
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
  return true;
}

// Get valid target tiles around the player within range
export function getOverworldValidTargets(
  playerPos: Position,
  config: AttackConfig,
  overworld: OverworldState,
): Position[] {
  const validTiles: Position[] = [];
  const range = config.range;

  for (let dy = -range; dy <= range; dy++) {
    for (let dx = -range; dx <= range; dx++) {
      const wx = playerPos.x + dx;
      const wy = playerPos.y + dy;
      if (dx === 0 && dy === 0 && config.pattern !== 'self') continue;

      const dist = Math.abs(dx) + Math.abs(dy);
      if (dist > range) continue;

      const tile = getOverworldTile(overworld, wx, wy);
      if (!tile || !tile.visible) continue;

      // Walls (water, rock not passable) don't block targeting in overworld (open terrain)
      if (config.pattern === 'self') {
        if (dx === 0 && dy === 0) validTiles.push({ x: wx, y: wy });
      } else {
        // Any visible tile in range is targetable (open overworld)
        validTiles.push({ x: wx, y: wy });
      }
    }
  }

  return validTiles;
}

// Get tiles affected by an attack.
// IMPORTANT: the AoE radius is INDEPENDENT of the player's targeting range —
// once a tile is "the target", the splash spreads from it regardless of how
// far the player can normally reach. Walls / buildings DO block the splash.
export function getOverworldAffectedTiles(
  origin: Position,
  target: Position,
  config: AttackConfig,
  overworld?: OverworldState,
): Position[] {
  const affected: Position[] = [];
  const ignoreWalls = config.wallPenetrate || false;

  // Helper: only push a tile if it's reachable from `from` (LOS) — used by
  // splash patterns so blasts can't bleed through buildings or rocks.
  const pushIfReachable = (from: Position, p: Position) => {
    if (ignoreWalls || !overworld) {
      affected.push(p);
      return;
    }
    if (overworldHasLineOfSight(overworld, from, p)) {
      affected.push(p);
    }
  };

  switch (config.pattern) {
    case 'self':
      affected.push(origin);
      break;
    case 'single':
      affected.push(target);
      break;
    case 'line': {
      const dx = Math.sign(target.x - origin.x);
      const dy = Math.sign(target.y - origin.y);
      for (let i = 1; i <= config.range; i++) {
        const p = { x: origin.x + dx * i, y: origin.y + dy * i };
        // Stop the line at the first blocker (unless wallPenetrate).
        if (!ignoreWalls && overworld && isOverworldBlocker(getOverworldTile(overworld, p.x, p.y))) break;
        affected.push(p);
        if (!config.piercing && target.x === p.x && target.y === p.y) break;
      }
      break;
    }
    case 'cone': {
      const dx = Math.sign(target.x - origin.x);
      const dy = Math.sign(target.y - origin.y);
      for (let i = 1; i <= config.range; i++) {
        const center = { x: origin.x + dx * i, y: origin.y + dy * i };
        pushIfReachable(origin, center);
        // Spread perpendicular
        if (dx !== 0) {
          for (let s = 1; s <= Math.min(i, config.width || 1); s++) {
            pushIfReachable(origin, { x: center.x, y: origin.y + s });
            pushIfReachable(origin, { x: center.x, y: origin.y - s });
          }
        } else {
          for (let s = 1; s <= Math.min(i, config.width || 1); s++) {
            pushIfReachable(origin, { x: origin.x + s, y: center.y });
            pushIfReachable(origin, { x: origin.x - s, y: center.y });
          }
        }
      }
      break;
    }
    case 'cross':
      affected.push(target);
      pushIfReachable(target, { x: target.x + 1, y: target.y });
      pushIfReachable(target, { x: target.x - 1, y: target.y });
      pushIfReachable(target, { x: target.x, y: target.y + 1 });
      pushIfReachable(target, { x: target.x, y: target.y - 1 });
      break;
    case 'aura': {
      const r = config.range;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) + Math.abs(dy) <= r) {
            // Aura emanates from the caster — block by walls from origin.
            pushIfReachable(origin, { x: origin.x + dx, y: origin.y + dy });
          }
        }
      }
      break;
    }
    case 'area': {
      // Splash radius is INDEPENDENT of the player's targeting range —
      // it expands fully from the target tile. Walls block the splash from
      // bleeding through buildings.
      const radius = config.width || 1;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          // Splash propagates from the target tile outward.
          pushIfReachable(target, { x: target.x + dx, y: target.y + dy });
        }
      }
      break;
    }
  }

  return affected;
}

// Find all enemies within a certain range of the player
export function getVisibleOverworldEnemies(
  overworld: OverworldState,
  viewRange: number = 8,
): { enemy: Monster; pos: Position }[] {
  const { x: px, y: py } = overworld.playerPosition;
  const result: { enemy: Monster; pos: Position }[] = [];

  for (let dy = -viewRange; dy <= viewRange; dy++) {
    for (let dx = -viewRange; dx <= viewRange; dx++) {
      const wx = px + dx;
      const wy = py + dy;
      const tile = getOverworldTile(overworld, wx, wy);
      if (tile?.type === 'enemy' && tile.enemyId && tile.visible) {
        const enemy = getOverworldEnemy(overworld, tile.enemyId);
        if (enemy) {
          result.push({ enemy, pos: { x: wx, y: wy } });
        }
      }
    }
  }

  return result;
}

// Manhattan-reach threat check for the overworld. Mirrors
// anyEnemyThreatensPlayer from dungeonCombat.ts: any visible enemy whose
// affordable moveset can reach the player's tile (including AoE/aura radius)
// counts as a threat. Consumed by every overworld auto-action so mining,
// hunting, searching, and walking all halt the moment we're in real danger.
export function anyOverworldEnemyThreatensPlayer(overworld: OverworldState): boolean {
  const visible = getVisibleOverworldEnemies(overworld, 12);
  if (visible.length === 0) return false;
  const { x: px, y: py } = overworld.playerPosition;
  for (const { enemy, pos } of visible) {
    if ((enemy.stats.currentHp ?? 0) <= 0) continue;
    const reach = getEnemyThreatReach(enemy);
    const dist = Math.abs(pos.x - px) + Math.abs(pos.y - py);
    if (dist <= reach) return true;
  }
  return false;
}


// Enemy AI for overworld - enemies move toward or away from player.
// Now archetype + IQ aware via src/game/enemyAI.ts.
export interface OverworldEnemyAction {
  type: 'move' | 'attack' | 'idle';
  dx: number;
  dy: number;
  move?: import('./moves').Move; // chosen attack move
}

export function calculateOverworldEnemyAction(
  enemy: Monster,
  enemyPos: Position,
  playerPos: Position,
  overworld: OverworldState,
  playerMonster?: Monster,
): OverworldEnemyAction {
  const ai = enemyAI;


  const dist = Math.abs(playerPos.x - enemyPos.x) + Math.abs(playerPos.y - enemyPos.y);
  const archetype = ai.getEnemyArchetype(enemy);
  const iq = ai.getEnemyIQ(enemy.level);
  const hint = ai.getMovementHint(archetype, iq);

  const enemyHpRatio = enemy.stats.currentHp / Math.max(1, enemy.stats.maxHp);
  const enemyStaminaRatio = (enemy.stats.currentStamina ?? enemy.stats.stamina ?? 0) /
                            Math.max(1, enemy.stats.stamina ?? 1);

  // Smart retreat
  if (enemyHpRatio < hint.retreatHpThreshold && iq > 0.25) {
    const dirX = Math.sign(playerPos.x - enemyPos.x);
    const dirY = Math.sign(playerPos.y - enemyPos.y);
    return tryOverworldMove(overworld, enemyPos, -dirX, -dirY);
  }

  // Pick best move for situation
  const decision = ai.chooseEnemyMove(enemy, {
    distance: dist,
    iq,
    archetype,
    enemyHpRatio,
    enemyStaminaRatio,
    playerHpRatio: playerMonster
      ? playerMonster.stats.currentHp / Math.max(1, playerMonster.stats.maxHp)
      : 1,
    playerElement: playerMonster?.element ?? enemy.element,
  });
  const chosen = decision.move ?? undefined;
  const attackRange = chosen ? (chosen.type === 'ranged' ? 4 : 1) : 1;

  if (dist <= attackRange) {
    return { type: 'attack', dx: 0, dy: 0, move: chosen };
  }

  const dirX = Math.sign(playerPos.x - enemyPos.x);
  const dirY = Math.sign(playerPos.y - enemyPos.y);

  if (hint.prefer === 'retreat' && dist < hint.idealRange) {
    return tryOverworldMove(overworld, enemyPos, -dirX, -dirY);
  }

  if (dist <= 6) {
    return tryOverworldMove(overworld, enemyPos, dirX, dirY);
  }

  return { type: 'idle', dx: 0, dy: 0 };
}

function tryOverworldMove(
  overworld: OverworldState,
  from: Position,
  dx: number,
  dy: number,
): OverworldEnemyAction {
  // Try primary direction, then fallback
  const attempts = [
    { dx, dy: 0 },
    { dx: 0, dy },
    { dx: 0, dy: dy === 0 ? 1 : dy },
    { dx: dx === 0 ? 1 : dx, dy: 0 },
  ];

  for (const a of attempts) {
    if (a.dx === 0 && a.dy === 0) continue;
    const nx = from.x + a.dx;
    const ny = from.y + a.dy;
    const tile = getOverworldTile(overworld, nx, ny);
    if (tile && tile.type === 'grass') {
      return { type: 'move', dx: a.dx, dy: a.dy };
    }
  }

  return { type: 'idle', dx: 0, dy: 0 };
}

// Move an enemy in the overworld
export function moveOverworldEnemy(
  overworld: OverworldState,
  enemyId: string,
  enemyPos: Position,
  dx: number,
  dy: number,
): boolean {
  const nx = enemyPos.x + dx;
  const ny = enemyPos.y + dy;

  const targetTile = getOverworldTile(overworld, nx, ny);
  if (!targetTile || targetTile.type !== 'grass') return false;

  // Clear old tile
  const oldTile = getOverworldTile(overworld, enemyPos.x, enemyPos.y);
  if (oldTile) {
    setOverworldTile(overworld, enemyPos.x, enemyPos.y, {
      ...oldTile,
      type: 'grass',
      enemyId: undefined,
    });
  }

  // Set new tile
  setOverworldTile(overworld, nx, ny, {
    ...targetTile,
    type: 'enemy',
    enemyId,
  });

  return true;
}

// Remove a defeated enemy from the overworld
export function removeOverworldEnemyFromMap(
  overworld: OverworldState,
  enemyId: string,
  pos: Position,
): void {
  const tile = getOverworldTile(overworld, pos.x, pos.y);
  if (tile && tile.enemyId === enemyId) {
    setOverworldTile(overworld, pos.x, pos.y, {
      ...tile,
      type: 'grass',
      enemyId: undefined,
    });
  }
  removeOverworldEnemy(overworld, enemyId);
}
