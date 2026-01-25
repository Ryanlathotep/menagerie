// Dungeon Combat System - Attack targeting, enemy AI, and real-time combat on the map

import { DungeonState, Monster, Position, DungeonTile } from './types';
import { Move } from './moves';
import { EvolvedMove } from './moveMastery';

// Attack pattern shapes
export type AttackPattern = 'single' | 'line' | 'cone' | 'cross' | 'area' | 'self';

// Attack range and pattern configuration
export interface AttackConfig {
  pattern: AttackPattern;
  range: number;
  width?: number; // For cone/area patterns
}

// Get attack configuration based on move type
export function getAttackConfig(move: Move | EvolvedMove): AttackConfig {
  const isAoE = 'isAoE' in move && move.isAoE;
  
  if (move.type === 'heal' || move.type === 'status') {
    // Self-targeting for buffs and heals
    if (!move.effect?.includes('lower_') && move.type !== 'status') {
      return { pattern: 'self', range: 0 };
    }
  }
  
  if (move.type === 'melee') {
    if (isAoE) {
      return { pattern: 'cross', range: 1, width: 1 };
    }
    return { pattern: 'single', range: 1 };
  }
  
  if (move.type === 'ranged') {
    if (isAoE) {
      return { pattern: 'area', range: 4, width: 2 };
    }
    return { pattern: 'line', range: 5 };
  }
  
  // Status moves that target enemies
  if (move.type === 'status' && move.effect?.includes('lower_')) {
    return { pattern: 'single', range: 3 };
  }
  
  return { pattern: 'single', range: 1 };
}

// Get all tiles affected by an attack pattern
export function getAffectedTiles(
  origin: Position,
  target: Position,
  config: AttackConfig,
  dungeonWidth: number,
  dungeonHeight: number
): Position[] {
  const tiles: Position[] = [];
  
  switch (config.pattern) {
    case 'self':
      tiles.push(origin);
      break;
      
    case 'single':
      tiles.push(target);
      break;
      
    case 'line': {
      // Line from origin towards target
      const dx = Math.sign(target.x - origin.x);
      const dy = Math.sign(target.y - origin.y);
      
      for (let i = 1; i <= config.range; i++) {
        const x = origin.x + dx * i;
        const y = origin.y + dy * i;
        if (x >= 0 && x < dungeonWidth && y >= 0 && y < dungeonHeight) {
          tiles.push({ x, y });
        }
      }
      break;
    }
    
    case 'cone': {
      // Cone spreading from origin towards target
      const dx = Math.sign(target.x - origin.x);
      const dy = Math.sign(target.y - origin.y);
      const width = config.width || 1;
      
      for (let i = 1; i <= config.range; i++) {
        // Central line
        const centerX = origin.x + dx * i;
        const centerY = origin.y + dy * i;
        
        // Spread perpendicular to direction
        const spreadAmount = Math.floor(i * 0.5);
        for (let spread = -spreadAmount; spread <= spreadAmount; spread++) {
          let x = centerX;
          let y = centerY;
          
          if (dx !== 0) {
            y += spread;
          } else {
            x += spread;
          }
          
          if (x >= 0 && x < dungeonWidth && y >= 0 && y < dungeonHeight) {
            tiles.push({ x, y });
          }
        }
      }
      break;
    }
    
    case 'cross': {
      // Cross pattern centered on target
      tiles.push(target);
      const directions = [
        { dx: 0, dy: -1 }, // up
        { dx: 0, dy: 1 },  // down
        { dx: -1, dy: 0 }, // left
        { dx: 1, dy: 0 },  // right
      ];
      
      for (const dir of directions) {
        for (let i = 1; i <= (config.width || 1); i++) {
          const x = target.x + dir.dx * i;
          const y = target.y + dir.dy * i;
          if (x >= 0 && x < dungeonWidth && y >= 0 && y < dungeonHeight) {
            tiles.push({ x, y });
          }
        }
      }
      break;
    }
    
    case 'area': {
      // Square area centered on target
      const radius = config.width || 1;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const x = target.x + dx;
          const y = target.y + dy;
          if (x >= 0 && x < dungeonWidth && y >= 0 && y < dungeonHeight) {
            tiles.push({ x, y });
          }
        }
      }
      break;
    }
  }
  
  return tiles;
}

// Check if a position is within attack range
export function isInRange(origin: Position, target: Position, range: number): boolean {
  const distance = Math.abs(target.x - origin.x) + Math.abs(target.y - origin.y);
  return distance <= range;
}

// Get valid target tiles for an attack
export function getValidTargets(
  origin: Position,
  config: AttackConfig,
  tiles: DungeonTile[][],
  width: number,
  height: number,
  targetEnemies: boolean = true // true = player attacking enemies, false = enemy attacking player
): Position[] {
  const validTiles: Position[] = [];
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Skip origin tile unless self-targeting
      if (x === origin.x && y === origin.y && config.pattern !== 'self') continue;
      
      // Check range
      if (!isInRange(origin, { x, y }, config.range)) continue;
      
      const tile = tiles[y][x];
      
      // For player attacks, only target visible tiles
      if (targetEnemies && !tile.visible) continue;
      
      // Check if tile has a valid target
      if (config.pattern === 'self') {
        if (x === origin.x && y === origin.y) {
          validTiles.push({ x, y });
        }
      } else if (targetEnemies) {
        // Valid if floor, enemy, or we can path there
        if (tile.type === 'floor' || tile.type === 'enemy' || tile.type === 'water' || tile.type === 'plant') {
          validTiles.push({ x, y });
        }
      } else {
        // Enemy targeting player
        if (tile.type === 'player' || tile.type === 'floor') {
          validTiles.push({ x, y });
        }
      }
    }
  }
  
  return validTiles;
}

// Enemy AI - Simple behavior patterns
export type EnemyBehavior = 'aggressive' | 'defensive' | 'ranged' | 'support';

export interface EnemyAction {
  type: 'move' | 'attack' | 'idle';
  direction?: 'up' | 'down' | 'left' | 'right';
  target?: Position;
  move?: Move;
}

// Determine enemy behavior based on species
export function getEnemyBehavior(monster: Monster): EnemyBehavior {
  // Ranged species prefer distance
  const rangedSpecies = ['wisp', 'crow', 'bat', 'spider', 'jellyfish'];
  if (rangedSpecies.includes(monster.species)) return 'ranged';
  
  // Tanky species are aggressive
  const aggressiveSpecies = ['golem', 'dragon', 'wolf', 'shark', 'beetle'];
  if (aggressiveSpecies.includes(monster.species)) return 'aggressive';
  
  // Support species stay back
  const supportSpecies = ['mushroom', 'ghost', 'slime'];
  if (supportSpecies.includes(monster.species)) return 'support';
  
  return 'aggressive';
}

// Calculate enemy's next action
export function calculateEnemyAction(
  enemy: Monster,
  enemyPos: Position,
  playerPos: Position,
  tiles: DungeonTile[][],
  width: number,
  height: number
): EnemyAction {
  const distance = Math.abs(playerPos.x - enemyPos.x) + Math.abs(playerPos.y - enemyPos.y);
  const behavior = getEnemyBehavior(enemy);
  
  // Check if player is in attack range (1 for melee, more for ranged)
  const attackRange = behavior === 'ranged' ? 4 : 1;
  
  if (distance <= attackRange) {
    // In range - attack!
    return { type: 'attack', target: playerPos };
  }
  
  // Not in range - move towards player (or away for ranged)
  if (behavior === 'ranged' && distance < 3) {
    // Move away from player
    return getMovementAway(enemyPos, playerPos, tiles, width, height);
  }
  
  // Move towards player
  return getMovementTowards(enemyPos, playerPos, tiles, width, height);
}

// Get movement direction towards a target
function getMovementTowards(
  from: Position,
  to: Position,
  tiles: DungeonTile[][],
  width: number,
  height: number
): EnemyAction {
  const dx = Math.sign(to.x - from.x);
  const dy = Math.sign(to.y - from.y);
  
  // Try horizontal movement first if further horizontally
  const horizontalFirst = Math.abs(to.x - from.x) >= Math.abs(to.y - from.y);
  
  const attempts: Array<{ dx: number; dy: number; dir: 'up' | 'down' | 'left' | 'right' }> = horizontalFirst
    ? [
        { dx, dy: 0, dir: dx > 0 ? 'right' : 'left' },
        { dx: 0, dy, dir: dy > 0 ? 'down' : 'up' },
        { dx: 0, dy: -dy || 1, dir: (-dy || 1) > 0 ? 'down' : 'up' },
        { dx: -dx || 1, dy: 0, dir: (-dx || 1) > 0 ? 'right' : 'left' },
      ]
    : [
        { dx: 0, dy, dir: dy > 0 ? 'down' : 'up' },
        { dx, dy: 0, dir: dx > 0 ? 'right' : 'left' },
        { dx: -dx || 1, dy: 0, dir: (-dx || 1) > 0 ? 'right' : 'left' },
        { dx: 0, dy: -dy || 1, dir: (-dy || 1) > 0 ? 'down' : 'up' },
      ];
  
  for (const attempt of attempts) {
    if (attempt.dx === 0 && attempt.dy === 0) continue;
    
    const newX = from.x + attempt.dx;
    const newY = from.y + attempt.dy;
    
    if (canMoveTo(newX, newY, tiles, width, height)) {
      return { type: 'move', direction: attempt.dir };
    }
  }
  
  return { type: 'idle' };
}

// Get movement direction away from a target
function getMovementAway(
  from: Position,
  to: Position,
  tiles: DungeonTile[][],
  width: number,
  height: number
): EnemyAction {
  // Invert direction
  const dx = Math.sign(from.x - to.x);
  const dy = Math.sign(from.y - to.y);
  
  const attempts: Array<{ dx: number; dy: number; dir: 'up' | 'down' | 'left' | 'right' }> = [
    { dx, dy: 0, dir: dx > 0 ? 'right' : 'left' },
    { dx: 0, dy, dir: dy > 0 ? 'down' : 'up' },
    { dx: 0, dy: -dy || 1, dir: (-dy || 1) > 0 ? 'down' : 'up' },
    { dx: -dx || 1, dy: 0, dir: (-dx || 1) > 0 ? 'right' : 'left' },
  ];
  
  for (const attempt of attempts) {
    if (attempt.dx === 0 && attempt.dy === 0) continue;
    
    const newX = from.x + attempt.dx;
    const newY = from.y + attempt.dy;
    
    if (canMoveTo(newX, newY, tiles, width, height)) {
      return { type: 'move', direction: attempt.dir };
    }
  }
  
  return { type: 'idle' };
}

// Check if an enemy can move to a tile
function canMoveTo(x: number, y: number, tiles: DungeonTile[][], width: number, height: number): boolean {
  if (x < 0 || x >= width || y < 0 || y >= height) return false;
  
  const tile = tiles[y][x];
  // Enemies can move through floor, water (with damage?), plants, but not walls, other enemies, player, treasure, etc.
  return tile.type === 'floor' || tile.type === 'water' || (tile.type === 'plant' && tile.harvested);
}

// Move an enemy in the dungeon
export function moveEnemy(
  dungeon: DungeonState,
  enemyId: string,
  direction: 'up' | 'down' | 'left' | 'right'
): { dungeon: DungeonState; newPos: Position | null } {
  const enemy = dungeon.enemies.find(e => e.id === enemyId);
  if (!enemy) return { dungeon, newPos: null };
  
  // Find enemy's current position
  let currentPos: Position | null = null;
  for (let y = 0; y < dungeon.height; y++) {
    for (let x = 0; x < dungeon.width; x++) {
      if (dungeon.tiles[y][x].enemyId === enemyId) {
        currentPos = { x, y };
        break;
      }
    }
    if (currentPos) break;
  }
  
  if (!currentPos) return { dungeon, newPos: null };
  
  const dx = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
  const dy = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;
  
  const newX = currentPos.x + dx;
  const newY = currentPos.y + dy;
  
  if (!canMoveTo(newX, newY, dungeon.tiles, dungeon.width, dungeon.height)) {
    return { dungeon, newPos: null };
  }
  
  // Create new tiles
  const newTiles = dungeon.tiles.map(row => row.map(tile => ({ ...tile })));
  
  // Clear old position
  newTiles[currentPos.y][currentPos.x].type = 'floor';
  newTiles[currentPos.y][currentPos.x].enemyId = undefined;
  
  // Set new position
  newTiles[newY][newX].type = 'enemy';
  newTiles[newY][newX].enemyId = enemyId;
  
  return {
    dungeon: { ...dungeon, tiles: newTiles },
    newPos: { x: newX, y: newY }
  };
}

// Get position of an enemy in the dungeon
export function getEnemyPosition(dungeon: DungeonState, enemyId: string): Position | null {
  for (let y = 0; y < dungeon.height; y++) {
    for (let x = 0; x < dungeon.width; x++) {
      if (dungeon.tiles[y][x].enemyId === enemyId) {
        return { x, y };
      }
    }
  }
  return null;
}

// Check if player is visible to an enemy (for aggro)
export function canSeePlayer(
  enemyPos: Position,
  playerPos: Position,
  tiles: DungeonTile[][],
  sightRange: number = 5
): boolean {
  const distance = Math.abs(playerPos.x - enemyPos.x) + Math.abs(playerPos.y - enemyPos.y);
  if (distance > sightRange) return false;
  
  // Simple line-of-sight check
  const dx = Math.sign(playerPos.x - enemyPos.x);
  const dy = Math.sign(playerPos.y - enemyPos.y);
  
  let x = enemyPos.x;
  let y = enemyPos.y;
  
  while (x !== playerPos.x || y !== playerPos.y) {
    if (x !== playerPos.x) x += dx;
    if (y !== playerPos.y) y += dy;
    
    // Hit a wall before reaching player
    if (tiles[y]?.[x]?.type === 'wall') return false;
  }
  
  return true;
}
