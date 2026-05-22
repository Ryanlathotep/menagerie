// Dungeon Combat System - Attack targeting, enemy AI, and real-time combat on the map

import { DungeonState, Monster, Position, DungeonTile } from './types';
import { Move, TargetingPattern } from './moves';
import { EvolvedMove } from './moveMastery';

// Attack pattern shapes (internal representation)
export type AttackPattern = 'single' | 'line' | 'cone' | 'cross' | 'area' | 'aura' | 'self' | 'custom' | 'movement';

// Attack range and pattern configuration
export interface AttackConfig {
  pattern: AttackPattern;
  range: number;
  width?: number;           // For cone/area patterns
  piercing?: boolean;       // Hits all enemies in line
  wallPenetrate?: boolean;  // Can pass through walls (very rare)
  /** Custom-shape offsets relative to origin (used when pattern === 'custom' or 'movement'). */
  customOffsets?: { dx: number; dy: number }[];
  /** For 'custom' pattern: whether offsets are anchored to the caster ('self') or target tile ('target'). */
  customOrigin?: 'self' | 'target';
  /** For 'movement' pattern: blink ignores wall/unit blockers between caster and destination. */
  blink?: boolean;
}

// Check line of sight between two positions (returns true if unblocked)
export function hasLineOfSight(
  from: Position,
  to: Position,
  tiles: DungeonTile[][],
  width: number,
  height: number,
  ignoreWalls: boolean = false
): boolean {
  if (ignoreWalls) return true;
  
  // Use Bresenham's line algorithm to trace the path
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
    // Check if current position is a wall (but not the starting or ending position)
    if ((x0 !== from.x || y0 !== from.y) && (x0 !== to.x || y0 !== to.y)) {
      if (x0 < 0 || x0 >= width || y0 < 0 || y0 >= height) return false;
      if (tiles[y0][x0].type === 'wall') return false;
    }
    
    if (x0 === x1 && y0 === y1) break;
    
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }
  
  return true;
}

// Get tiles hit by a line attack (stops at wall unless piercing through walls)
export function getLineHitTiles(
  from: Position,
  direction: Position, // normalized direction
  range: number,
  tiles: DungeonTile[][],
  width: number,
  height: number,
  piercing: boolean = false,
  wallPenetrate: boolean = false
): Position[] {
  const hitTiles: Position[] = [];
  
  for (let i = 1; i <= range; i++) {
    const x = from.x + direction.x * i;
    const y = from.y + direction.y * i;
    
    if (x < 0 || x >= width || y < 0 || y >= height) break;
    
    const tile = tiles[y][x];
    
    // Wall blocks unless we can penetrate
    if (tile.type === 'wall' && !wallPenetrate) break;
    
    hitTiles.push({ x, y });
    
    // If not piercing and we hit an enemy, stop
    if (!piercing && tile.type === 'enemy') break;
  }
  
  return hitTiles;
}

// Get attack configuration based on move type and targeting properties
export function getAttackConfig(move: Move | EvolvedMove): AttackConfig {
  const isAoE = 'isAoE' in move && move.isAoE;
  const targeting = 'targeting' in move ? (move as Move).targeting : undefined;
  const aoeRadius = 'aoeRadius' in move ? (move as Move).aoeRadius : undefined;
  const piercing = 'piercing' in move ? (move as Move).piercing : false;
  const wallPenetrate = 'wallPenetrate' in move ? (move as Move).wallPenetrate : false;
  
  const customShape = 'customShape' in move ? (move as Move).customShape : undefined;
  const movement = 'movement' in move ? (move as Move).movement : undefined;

  // Admin-designed movement skill: caster picks one of the listed offsets as a destination.
  if (movement && movement.offsets.length > 0) {
    const maxR = Math.max(...movement.offsets.map(o => Math.max(Math.abs(o.dx), Math.abs(o.dy))));
    return {
      pattern: 'movement',
      range: maxR,
      customOffsets: movement.offsets,
      blink: !!movement.blink,
      wallPenetrate: !!movement.blink,
    };
  }

  // Admin-designed AoE shape (origin = self for melee bursts, target for ranged strikes).
  if (customShape && customShape.offsets.length > 0) {
    const maxR = Math.max(...customShape.offsets.map(o => Math.max(Math.abs(o.dx), Math.abs(o.dy))));
    return {
      pattern: 'custom',
      // For self-origin, range bounds the shape itself; for target-origin, range bounds
      // how far the player can place the target tile from themselves.
      range: customShape.origin === 'self' ? maxR : (customShape.range ?? (move.type === 'melee' ? 1 : 5)),
      customOffsets: customShape.offsets,
      customOrigin: customShape.origin,
      wallPenetrate: !!customShape.wallPenetrate,
    };
  }

  // Self-targeting for buffs and heals (unless they target enemies)
  if (move.type === 'heal') {
    return { pattern: 'self', range: 0 };
  }
  
  if (move.type === 'status' && !move.effect?.includes('lower_')) {
    return { pattern: 'self', range: 0 };
  }
  
  // Use explicit targeting pattern if set
  if (targeting) {
    switch (targeting) {
      case 'self':
        return { pattern: 'self', range: 0 };
      case 'single':
        return { 
          pattern: 'single', 
          range: move.type === 'melee' ? 1 : 5,
          piercing,
          wallPenetrate 
        };
      case 'piercing':
        return { pattern: 'line', range: move.type === 'melee' ? 2 : 5, piercing: true, wallPenetrate };
      case 'cone':
        // Melee cones are short sweeps in front of the attacker
        return { pattern: 'cone', range: move.type === 'melee' ? 2 : 3, width: 2, wallPenetrate };
      case 'aura':
        return { pattern: 'aura', range: aoeRadius || (move.type === 'melee' ? 1 : 2), wallPenetrate: true }; // Auras ignore walls
      case 'area':
        return { pattern: 'area', range: move.type === 'melee' ? 1 : 4, width: aoeRadius || 2, wallPenetrate };
      case 'arc':
        return { pattern: 'single', range: 4, wallPenetrate: true }; // Arc ignores walls
    }
  }
  
  // Fallback to inferred targeting based on move type
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
    // Default ranged: straight line, hits first target only, blocked by walls
    return { pattern: 'single', range: 5, piercing: false, wallPenetrate: false };
  }
  
  // Status moves that target enemies
  if (move.type === 'status' && move.effect?.includes('lower_')) {
    return { pattern: 'single', range: 3, wallPenetrate: false };
  }
  
  return { pattern: 'single', range: 1 };
}

// Get all tiles affected by an attack pattern (with wall blocking)
export function getAffectedTiles(
  origin: Position,
  target: Position,
  config: AttackConfig,
  dungeonWidth: number,
  dungeonHeight: number,
  tiles?: DungeonTile[][]
): Position[] {
  const affectedTiles: Position[] = [];
  
  switch (config.pattern) {
    case 'self':
      affectedTiles.push(origin);
      break;
      
    case 'single': {
      // For ranged single-target, check line of sight
      if (tiles && !config.wallPenetrate) {
        const hasLOS = hasLineOfSight(origin, target, tiles, dungeonWidth, dungeonHeight, false);
        if (hasLOS) {
          affectedTiles.push(target);
        }
      } else {
        affectedTiles.push(target);
      }
      break;
    }
      
    case 'line': {
      // Line from origin towards target - respects walls unless wallPenetrate
      const dx = Math.sign(target.x - origin.x);
      const dy = Math.sign(target.y - origin.y);
      
      if (tiles) {
        const hitTiles = getLineHitTiles(
          origin,
          { x: dx, y: dy },
          config.range,
          tiles,
          dungeonWidth,
          dungeonHeight,
          config.piercing || false,
          config.wallPenetrate || false
        );
        affectedTiles.push(...hitTiles);
      } else {
        // Fallback without tile data
        for (let i = 1; i <= config.range; i++) {
          const x = origin.x + dx * i;
          const y = origin.y + dy * i;
          if (x >= 0 && x < dungeonWidth && y >= 0 && y < dungeonHeight) {
            affectedTiles.push({ x, y });
          }
        }
      }
      break;
    }
    
    case 'cone': {
      // Cone spreading from origin towards target
      const dx = Math.sign(target.x - origin.x);
      const dy = Math.sign(target.y - origin.y);
      
      for (let i = 1; i <= config.range; i++) {
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
            // Check LOS for each tile in cone (unless wall penetrate)
            if (tiles && !config.wallPenetrate) {
              if (hasLineOfSight(origin, { x, y }, tiles, dungeonWidth, dungeonHeight, false)) {
                affectedTiles.push({ x, y });
              }
            } else {
              affectedTiles.push({ x, y });
            }
          }
        }
      }
      break;
    }
    
    case 'aura': {
      // Circle around the caster (always ignores walls - it's around you!)
      const radius = config.range || 2;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          // Circular check
          if (dx * dx + dy * dy <= radius * radius) {
            const x = origin.x + dx;
            const y = origin.y + dy;
            if (x >= 0 && x < dungeonWidth && y >= 0 && y < dungeonHeight) {
              if (x !== origin.x || y !== origin.y) { // Don't include self
                affectedTiles.push({ x, y });
              }
            }
          }
        }
      }
      break;
    }
    
    case 'cross': {
      // Cross pattern centered on target — splash is blocked by walls
      // propagating out from the target tile.
      affectedTiles.push(target);
      const directions = [
        { dx: 0, dy: -1 },
        { dx: 0, dy: 1 },
        { dx: -1, dy: 0 },
        { dx: 1, dy: 0 },
      ];

      for (const dir of directions) {
        for (let i = 1; i <= (config.width || 1); i++) {
          const x = target.x + dir.dx * i;
          const y = target.y + dir.dy * i;
          if (x < 0 || x >= dungeonWidth || y < 0 || y >= dungeonHeight) break;
          // Stop the arm of the cross at the first wall (unless wallPenetrate)
          if (tiles && !config.wallPenetrate && tiles[y][x].type === 'wall') break;
          affectedTiles.push({ x, y });
        }
      }
      break;
    }

    case 'area': {
      // Square area centered on target - check LOS to target first
      if (tiles && !config.wallPenetrate) {
        if (!hasLineOfSight(origin, target, tiles, dungeonWidth, dungeonHeight, false)) {
          break; // Can't target an area you can't see
        }
      }

      const radius = config.width || 1;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const x = target.x + dx;
          const y = target.y + dy;
          if (x < 0 || x >= dungeonWidth || y < 0 || y >= dungeonHeight) continue;
          // Splash radius is independent of player range, but blocked by
          // walls propagating from the target outward.
          if (tiles && !config.wallPenetrate) {
            if (!hasLineOfSight(target, { x, y }, tiles, dungeonWidth, dungeonHeight, false)) continue;
          }
          affectedTiles.push({ x, y });
        }
      }
      break;
    }
  }
  
  return affectedTiles;
}

// Check if a position is within attack range
export function isInRange(origin: Position, target: Position, range: number): boolean {
  const distance = Math.abs(target.x - origin.x) + Math.abs(target.y - origin.y);
  return distance <= range;
}

// Get valid target tiles for an attack (respects line of sight unless wallPenetrate)
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
      
      // Check line of sight (unless attack penetrates walls)
      if (!config.wallPenetrate && config.pattern !== 'self' && config.pattern !== 'aura') {
        if (!hasLineOfSight(origin, { x, y }, tiles, width, height, false)) {
          continue; // Can't target through walls
        }
      }
      
      // Check if tile has a valid target
      if (config.pattern === 'self') {
        if (x === origin.x && y === origin.y) {
          validTiles.push({ x, y });
        }
      } else if (targetEnemies) {
        // Valid if floor, enemy, or we can path there
        if (tile.type === 'floor' || tile.type === 'enemy' || tile.type === 'terrain' || tile.type === 'plant') {
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

// Enemy AI — behavior patterns. Kept for back-compat; new code should use
// archetype + IQ from src/game/enemyAI.ts.
export type EnemyBehavior = 'aggressive' | 'defensive' | 'ranged' | 'support';

export interface EnemyAction {
  type: 'move' | 'attack' | 'idle';
  direction?: 'up' | 'down' | 'left' | 'right';
  target?: Position;
  move?: Move; // chosen attack move (when type === 'attack' and AI picked one)
}

// Legacy helper retained — overworld and dungeon still call this to classify
// movement behavior. New move/tactic decisions flow through enemyAI.ts.
export function getEnemyBehavior(monster: Monster): EnemyBehavior {
  const rangedSpecies = ['wisp', 'crow', 'bat', 'spider', 'jellyfish'];
  if (rangedSpecies.includes(monster.species)) return 'ranged';

  const aggressiveSpecies = ['golem', 'dragon', 'wolf', 'shark', 'beetle'];
  if (aggressiveSpecies.includes(monster.species)) return 'aggressive';

  const supportSpecies = ['mushroom', 'ghost', 'slime'];
  if (supportSpecies.includes(monster.species)) return 'support';

  return 'aggressive';
}

// Optional context allowing AI to factor player state into decisions.
export interface EnemyAIContext {
  playerMonster?: Monster; // used to compute element matchup & HP ratio
}

// Calculate enemy's next action. Now archetype + IQ aware (enemyAI.ts).
// Falls back to legacy positional logic if context is missing.
export function calculateEnemyAction(
  enemy: Monster,
  enemyPos: Position,
  playerPos: Position,
  tiles: DungeonTile[][],
  width: number,
  height: number,
  ctx?: EnemyAIContext,
): EnemyAction {
  // Lazy require to avoid circular import surface
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ai = require('./enemyAI') as typeof import('./enemyAI');

  const distance = Math.abs(playerPos.x - enemyPos.x) + Math.abs(playerPos.y - enemyPos.y);
  const archetype = ai.getEnemyArchetype(enemy);
  const iq = ai.getEnemyIQ(enemy.level);
  const hint = ai.getMovementHint(archetype, iq);

  const enemyHpRatio = enemy.stats.currentHp / Math.max(1, enemy.stats.maxHp);
  const enemyStaminaRatio = (enemy.stats.currentStamina ?? enemy.stats.stamina ?? 0) /
                            Math.max(1, enemy.stats.stamina ?? 1);

  // Retreat if HP is below archetype threshold — but only if smart enough to know better
  const shouldRetreat = enemyHpRatio < hint.retreatHpThreshold && iq > 0.25;
  if (shouldRetreat) {
    return getMovementAway(enemyPos, playerPos, tiles, width, height);
  }

  // Pick the best affordable move for the situation
  const tacticCtx = ctx?.playerMonster
    ? {
        distance,
        iq,
        archetype,
        enemyHpRatio,
        enemyStaminaRatio,
        playerHpRatio: ctx.playerMonster.stats.currentHp / Math.max(1, ctx.playerMonster.stats.maxHp),
        playerElement: ctx.playerMonster.element,
      }
    : {
        distance,
        iq,
        archetype,
        enemyHpRatio,
        enemyStaminaRatio,
        playerHpRatio: 1,
        playerElement: enemy.element,
      };
  const decision = ai.chooseEnemyMove(enemy, tacticCtx);
  const chosen = decision.move ?? undefined;

  // Determine effective attack range from chosen move (or archetype fallback)
  let attackRange = 1;
  if (chosen) {
    attackRange = chosen.type === 'ranged' ? 4 : 1;
  } else {
    attackRange = hint.idealRange > 1 ? 4 : 1;
  }

  if (distance <= attackRange) {
    return { type: 'attack', target: playerPos, move: chosen };
  }

  // Out of range → archetype-driven movement
  if (hint.prefer === 'retreat' && distance < hint.idealRange) {
    return getMovementAway(enemyPos, playerPos, tiles, width, height);
  }

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
  // Enemies can move through floor, terrain (with damage?), plants, but not walls, other enemies, player, treasure, etc.
  return tile.type === 'floor' || tile.type === 'terrain' || (tile.type === 'plant' && tile.harvested);
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

// ============= ENEMY STAMINA =============
// Cost an enemy pays each time it attacks. If the enemy is below this
// threshold, it must rest (regen) instead. Tuned to roughly the same
// economy as player melee moves so combat with stamina-drain moves matters.
export const ENEMY_ATTACK_STAMINA_COST = 8;
export const ENEMY_REST_STAMINA_REGEN = 5;

// Returns true if the enemy can pay the attack cost.
export function enemyHasStaminaToAttack(enemy: Monster): boolean {
  const cur = enemy.stats.currentStamina ?? enemy.stats.stamina ?? 0;
  return cur >= ENEMY_ATTACK_STAMINA_COST;
}
