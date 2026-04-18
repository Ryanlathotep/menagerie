// City Building System - Walls, Traps, Scout Towers, Farms
// Phase 3 of the Overworld Expansion Plan

import { ElementType } from './types';
import type { OverworldState } from './overworld';

// ============= BUILDING TYPES =============

export type PlayerBuildingType = 'wall' | 'spike_trap' | 'poison_trap' | 'fire_trap' | 'ice_trap' | 'scout_tower' | 'farm';

export interface BuildingCost {
  wood: number;
  stone: number;
  materials?: { materialId: string; quantity: number }[];
}

export interface PlayerBuilding {
  id: string;
  type: PlayerBuildingType;
  worldX: number;
  worldY: number;
  hp: number;
  maxHp: number;
  assignedMonsterId?: string;   // For scout towers and farms
  // Farm-specific
  farmElement?: ElementType;     // Element of assigned monster determines output
  growthProgress?: number;       // Steps until harvest (0 = ready)
  harvestReady?: boolean;
  harvestOutput?: { materialId: string; quantity: number }[];
  // Gate-specific (only meaningful when wall is acting as a gate):
  // true → "inside" face is flipped to the opposite side of the road axis.
  // Defaults to auto-orientation toward the home base when undefined.
  gateFlipped?: boolean;
}

// ============= BUILDING DEFINITIONS =============

export interface BuildingDefinition {
  type: PlayerBuildingType;
  name: string;
  emoji: string;
  description: string;
  cost: BuildingCost;
  maxHp: number;
  category: 'defense' | 'utility';
  requiresMonster?: boolean;
}

export const BUILDING_DEFINITIONS: Record<PlayerBuildingType, BuildingDefinition> = {
  wall: {
    type: 'wall',
    name: 'Stone Wall',
    emoji: '🧱',
    description: 'Blocks enemy movement. Can be destroyed.',
    cost: { wood: 5, stone: 10 },
    maxHp: 50,
    category: 'defense',
  },
  spike_trap: {
    type: 'spike_trap',
    name: 'Spike Trap',
    emoji: '📌',
    description: 'Deals 15 damage to enemies that walk over it.',
    cost: { wood: 3, stone: 5 },
    maxHp: 1,
    category: 'defense',
  },
  poison_trap: {
    type: 'poison_trap',
    name: 'Poison Trap',
    emoji: '☠️',
    description: 'Poisons enemies for 5 damage/turn for 3 turns.',
    cost: { wood: 3, stone: 3 },
    maxHp: 1,
    category: 'defense',
  },
  fire_trap: {
    type: 'fire_trap',
    name: 'Fire Trap',
    emoji: '🔥',
    description: 'Burns enemies for 20 fire damage.',
    cost: { wood: 5, stone: 3 },
    maxHp: 1,
    category: 'defense',
  },
  ice_trap: {
    type: 'ice_trap',
    name: 'Ice Trap',
    emoji: '❄️',
    description: 'Freezes enemy in place for 2 turns.',
    cost: { wood: 3, stone: 5 },
    maxHp: 1,
    category: 'defense',
  },
  scout_tower: {
    type: 'scout_tower',
    name: 'Scout Tower',
    emoji: '🗼',
    description: 'Extends visibility. Assign a monster to auto-attack nearby enemies.',
    cost: { wood: 15, stone: 20 },
    maxHp: 80,
    category: 'utility',
    requiresMonster: true,
  },
  farm: {
    type: 'farm',
    name: 'Farm Plot',
    emoji: '🌾',
    description: 'Assign a monster to grow crafting materials based on its element.',
    cost: { wood: 10, stone: 5 },
    maxHp: 30,
    category: 'utility',
    requiresMonster: true,
  },
};

// ============= FARM OUTPUT =============

// Materials produced per harvest cycle, keyed by assigned monster's element
export const FARM_OUTPUTS: Record<ElementType, { materialId: string; name: string; quantity: number }[]> = {
  normal: [{ materialId: 'herb_bundle', name: 'Herb Bundle', quantity: 2 }],
  fire: [{ materialId: 'fire_pepper', name: 'Fire Pepper', quantity: 2 }],
  water: [{ materialId: 'ice_mint', name: 'Ice Mint', quantity: 2 }],
  earth: [{ materialId: 'stone_root', name: 'Stone Root', quantity: 2 }],
  air: [{ materialId: 'wind_seed', name: 'Wind Seed', quantity: 2 }],
  void: [{ materialId: 'void_spore', name: 'Void Spore', quantity: 2 }],
};

// Steps between harvests
export const FARM_GROWTH_STEPS = 30;

// ============= SCOUT TOWER =============

export const SCOUT_TOWER_VISION_RADIUS = 4;
export const SCOUT_TOWER_ATTACK_RADIUS = 3;
export const SCOUT_TOWER_DAMAGE = 10;

// ============= PLACEMENT LOGIC =============

// Max Manhattan distance from any existing building/home where new buildings may be placed.
// (No longer a hard radius from the home base — buildings extend the buildable zone.)
export const MAX_BUILD_RADIUS = 10;

export function canPlaceBuilding(
  worldX: number,
  worldY: number,
  existingBuildings: PlayerBuilding[],
  homePosition: { x: number; y: number },
  woodAvailable: number,
  stoneAvailable: number,
  buildingType: PlayerBuildingType,
): { canPlace: boolean; reason?: string } {
  const def = BUILDING_DEFINITIONS[buildingType];
  // Inline import to keep this file dependency-free at module load time.
  // Creative mode bypasses ONLY the cost check — placement rules (no overlap,
  // not on home tile, within build radius) still apply so the world stays sane.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const creative = (require('./creativeMode') as typeof import('./creativeMode')).isCreativeMode();

  // Check resources (skipped in creative mode)
  if (!creative) {
    if (woodAvailable < def.cost.wood) return { canPlace: false, reason: `Need ${def.cost.wood} wood (have ${woodAvailable})` };
    if (stoneAvailable < def.cost.stone) return { canPlace: false, reason: `Need ${def.cost.stone} stone (have ${stoneAvailable})` };
  }

  // Cannot build on the home tile itself
  if (worldX === homePosition.x && worldY === homePosition.y) {
    return { canPlace: false, reason: 'Cannot build on home tile' };
  }

  // Check if tile already has a building
  if (existingBuildings.some(b => b.worldX === worldX && b.worldY === worldY)) {
    return { canPlace: false, reason: 'Already a building here' };
  }

  // Must be within MAX_BUILD_RADIUS Manhattan steps of the home base or any existing building.
  const distToHome = Math.abs(worldX - homePosition.x) + Math.abs(worldY - homePosition.y);
  const nearHome = distToHome <= MAX_BUILD_RADIUS;
  const nearBuilding = existingBuildings.some(b =>
    Math.abs(b.worldX - worldX) + Math.abs(b.worldY - worldY) <= MAX_BUILD_RADIUS
  );
  if (!nearHome && !nearBuilding) {
    return { canPlace: false, reason: `Must build within ${MAX_BUILD_RADIUS} steps of home or another building` };
  }

  return { canPlace: true };
}

export function createBuilding(type: PlayerBuildingType, worldX: number, worldY: number): PlayerBuilding {
  const def = BUILDING_DEFINITIONS[type];
  // Unique ID (timestamp + random) so a disassembled-then-rebuilt tile never
  // shares an ID with the previous building. Coord-only IDs caused stale
  // chunk tiles to silently link back to "the same" building.
  const uid = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  return {
    id: `building_${worldX}_${worldY}_${uid}`,
    type,
    worldX,
    worldY,
    hp: def.maxHp,
    maxHp: def.maxHp,
  };
}

// Advance farm growth by 1 step. Returns materials if ready to harvest.
export function tickFarm(building: PlayerBuilding): { materialId: string; quantity: number }[] | null {
  if (building.type !== 'farm' || !building.assignedMonsterId || !building.farmElement) return null;

  const progress = (building.growthProgress ?? FARM_GROWTH_STEPS) - 1;
  if (progress <= 0) {
    building.growthProgress = FARM_GROWTH_STEPS;
    building.harvestReady = true;
    building.harvestOutput = FARM_OUTPUTS[building.farmElement] || FARM_OUTPUTS.normal;
    return building.harvestOutput;
  }

  building.growthProgress = progress;
  building.harvestReady = false;
  return null;
}

// Refund ratio when disassembling a building (50% of original cost)
export const DISASSEMBLE_REFUND_RATIO = 0.5;

// Repair cost ratio: spend 30% of build cost to fully restore HP
export const REPAIR_COST_RATIO = 0.3;

export function getDisassembleRefund(building: PlayerBuilding): { wood: number; stone: number } {
  const def = BUILDING_DEFINITIONS[building.type];
  // Scale refund by current HP fraction so destroyed/damaged buildings refund less
  const hpFrac = Math.max(0.25, building.hp / building.maxHp); // floor 25% so partially damaged still gives something
  return {
    wood: Math.max(0, Math.floor(def.cost.wood * DISASSEMBLE_REFUND_RATIO * hpFrac)),
    stone: Math.max(0, Math.floor(def.cost.stone * DISASSEMBLE_REFUND_RATIO * hpFrac)),
  };
}

export function getRepairCost(building: PlayerBuilding): { wood: number; stone: number } {
  const def = BUILDING_DEFINITIONS[building.type];
  const missingFrac = 1 - building.hp / building.maxHp;
  return {
    wood: Math.max(0, Math.ceil(def.cost.wood * REPAIR_COST_RATIO * missingFrac)),
    stone: Math.max(0, Math.ceil(def.cost.stone * REPAIR_COST_RATIO * missingFrac)),
  };
}

// Process all scout tower attacks. Returns damage events.
export function processScoutTowerAttacks(
  buildings: PlayerBuilding[],
  getEnemiesInRadius: (cx: number, cy: number, radius: number) => { id: string; name: string; distance: number }[],
): { towerId: string; enemyId: string; damage: number }[] {
  const events: { towerId: string; enemyId: string; damage: number }[] = [];

  for (const b of buildings) {
    if (b.type !== 'scout_tower' || !b.assignedMonsterId) continue;

    const nearbyEnemies = getEnemiesInRadius(b.worldX, b.worldY, SCOUT_TOWER_ATTACK_RADIUS);
    if (nearbyEnemies.length > 0) {
      // Attack closest enemy
      const target = nearbyEnemies.sort((a, b) => a.distance - b.distance)[0];
      events.push({ towerId: b.id, enemyId: target.id, damage: SCOUT_TOWER_DAMAGE });
    }
  }

  return events;
}

// ============= AUTO-TILING / GATE DETECTION =============

// Look up the player building (if any) at a specific overworld coordinate.
function buildingAt(state: OverworldState, x: number, y: number): PlayerBuilding | undefined {
  return state.playerBuildings?.find(b => b.worldX === x && b.worldY === y);
}

function isRoadAt(state: OverworldState, x: number, y: number): boolean {
  return !!state.roads?.[`${x},${y}`];
}

// True iff this wall sits between two roads on opposite sides (N+S or E+W).
// A wall acting as a gate is passable by the player but still blocks enemies.
// Centralizing this in one helper makes the future "tower controller settings"
// pass trivial: that pass can override which players are allowed through.
export function isWallActingAsGate(building: PlayerBuilding, state: OverworldState): boolean {
  if (building.type !== 'wall') return false;
  const { worldX: x, worldY: y } = building;
  const horizontal = isRoadAt(state, x - 1, y) && isRoadAt(state, x + 1, y);
  const vertical   = isRoadAt(state, x, y - 1) && isRoadAt(state, x, y + 1);
  return horizontal || vertical;
}

// Returns the gate's road axis: true = horizontal (E-W), false = vertical (N-S).
// Only meaningful when isWallActingAsGate() returns true.
export function getGateAxis(building: PlayerBuilding, state: OverworldState): 'horizontal' | 'vertical' {
  const { worldX: x, worldY: y } = building;
  if (isRoadAt(state, x - 1, y) && isRoadAt(state, x + 1, y)) return 'horizontal';
  return 'vertical';
}

// Which side of the gate is the "inside" (banner-bearing, home-facing) side?
// Returns 'n' | 's' for vertical gates (E-W road), 'e' | 'w' for horizontal gates (N-S road).
// Auto-orients so the inside faces the home base; gateFlipped inverts that choice.
export function getGateInsideDirection(
  building: PlayerBuilding,
  state: OverworldState,
): 'n' | 's' | 'e' | 'w' {
  const axis = getGateAxis(building, state);
  const home = state.homeBase?.position ?? { x: 0, y: 0 };
  const flipped = !!building.gateFlipped;
  if (axis === 'horizontal') {
    // Road runs E-W → walls/banners sit on N or S edge.
    const homeIsNorth = home.y <= building.worldY;
    const inside: 'n' | 's' = homeIsNorth ? 'n' : 's';
    return flipped ? (inside === 'n' ? 's' : 'n') : inside;
  }
  // Vertical road (N-S) → walls/banners sit on E or W edge.
  const homeIsWest = home.x <= building.worldX;
  const inside: 'e' | 'w' = homeIsWest ? 'w' : 'e';
  return flipped ? (inside === 'w' ? 'e' : 'w') : inside;
}

// Wall connects to other walls AND to scout towers (towers anchor castle corners).
export function wallConnectsTo(state: OverworldState, x: number, y: number): boolean {
  const b = buildingAt(state, x, y);
  if (!b) return false;
  return b.type === 'wall' || b.type === 'scout_tower';
}

// Anything that should make a road auto-tile point at it:
//   - other roads (any type connects to any type so dirt/stone meet cleanly)
//   - any player building (campfire/cabin/town hall via home tile, plus walls,
//     scout towers, farms — entrances/anchors)
//   - the home base tile at (0,0) treated as a building hub
export function roadConnectsTo(state: OverworldState, x: number, y: number): boolean {
  if (isRoadAt(state, x, y)) return true;
  if (buildingAt(state, x, y)) return true;
  if (state.homeBase && state.homeBase.position.x === x && state.homeBase.position.y === y) return true;
  return false;
}

// Hook for the future "tower controller / build permissions" pass.
// Today: per-run only — dungeon-built structures never persist.
// Future: consult the dungeon's controller (player with deepest cleared floor)
// and their friend/guild/whitelist settings to decide.
export function shouldPersistDungeonBuild(_dungeonId: string, _userId: string | null): boolean {
  return false;
}
