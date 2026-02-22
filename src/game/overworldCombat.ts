// Overworld Combat System - Targeting, enemy AI, and tactical combat on the overworld map

import { Position, Monster } from './types';
import { OverworldState, OverworldTile, getOverworldTile, getOverworldEnemy, removeOverworldEnemy, setOverworldTile } from './overworld';
import { Move } from './moves';
import { EvolvedMove } from './moveMastery';
import { AttackConfig, getAttackConfig, getEnemyBehavior } from './dungeonCombat';

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

// Get tiles affected by an attack
export function getOverworldAffectedTiles(
  origin: Position,
  target: Position,
  config: AttackConfig,
): Position[] {
  const affected: Position[] = [];

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
        affected.push({ x: origin.x + dx * i, y: origin.y + dy * i });
        if (!config.piercing && target.x === origin.x + dx * i && target.y === origin.y + dy * i) break;
      }
      break;
    }
    case 'cone': {
      const dx = Math.sign(target.x - origin.x);
      const dy = Math.sign(target.y - origin.y);
      for (let i = 1; i <= config.range; i++) {
        affected.push({ x: origin.x + dx * i, y: origin.y + dy * i });
        // Spread perpendicular
        if (dx !== 0) {
          for (let s = 1; s <= Math.min(i, config.width || 1); s++) {
            affected.push({ x: origin.x + dx * i, y: origin.y + s });
            affected.push({ x: origin.x + dx * i, y: origin.y - s });
          }
        } else {
          for (let s = 1; s <= Math.min(i, config.width || 1); s++) {
            affected.push({ x: origin.x + s, y: origin.y + dy * i });
            affected.push({ x: origin.x - s, y: origin.y + dy * i });
          }
        }
      }
      break;
    }
    case 'cross':
      affected.push(target);
      affected.push({ x: target.x + 1, y: target.y });
      affected.push({ x: target.x - 1, y: target.y });
      affected.push({ x: target.x, y: target.y + 1 });
      affected.push({ x: target.x, y: target.y - 1 });
      break;
    case 'aura': {
      const r = config.range;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) + Math.abs(dy) <= r) {
            affected.push({ x: origin.x + dx, y: origin.y + dy });
          }
        }
      }
      break;
    }
    case 'area': {
      const radius = config.width || 1;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          affected.push({ x: target.x + dx, y: target.y + dy });
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

// Enemy AI for overworld - enemies move toward or away from player
export interface OverworldEnemyAction {
  type: 'move' | 'attack' | 'idle';
  dx: number;
  dy: number;
}

export function calculateOverworldEnemyAction(
  enemy: Monster,
  enemyPos: Position,
  playerPos: Position,
  overworld: OverworldState,
): OverworldEnemyAction {
  const dist = Math.abs(playerPos.x - enemyPos.x) + Math.abs(playerPos.y - enemyPos.y);
  const behavior = getEnemyBehavior(enemy);
  const attackRange = behavior === 'ranged' ? 4 : 1;

  if (dist <= attackRange) {
    return { type: 'attack', dx: 0, dy: 0 };
  }

  // Move toward or away
  const dirX = Math.sign(playerPos.x - enemyPos.x);
  const dirY = Math.sign(playerPos.y - enemyPos.y);

  if (behavior === 'ranged' && dist < 3) {
    // Move away
    return tryOverworldMove(overworld, enemyPos, -dirX, -dirY);
  }

  // Aggressive / move toward
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
