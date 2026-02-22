// City Building System - Walls, Traps, Scout Towers, Farms
// Phase 3 of the Overworld Expansion Plan

import { ElementType } from './types';

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

// Max building radius from home base (0,0)
export const MAX_BUILD_RADIUS = 20;

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

  // Check resources
  if (woodAvailable < def.cost.wood) return { canPlace: false, reason: `Need ${def.cost.wood} wood (have ${woodAvailable})` };
  if (stoneAvailable < def.cost.stone) return { canPlace: false, reason: `Need ${def.cost.stone} stone (have ${stoneAvailable})` };

  // Check distance from home
  const dist = Math.abs(worldX - homePosition.x) + Math.abs(worldY - homePosition.y);
  if (dist > MAX_BUILD_RADIUS) return { canPlace: false, reason: 'Too far from base' };
  if (dist === 0) return { canPlace: false, reason: 'Cannot build on home tile' };

  // Check if tile already has a building
  if (existingBuildings.some(b => b.worldX === worldX && b.worldY === worldY)) {
    return { canPlace: false, reason: 'Already a building here' };
  }

  // Must be adjacent to existing building or home base
  const adjacentToBuilding = existingBuildings.some(b =>
    Math.abs(b.worldX - worldX) <= 1 && Math.abs(b.worldY - worldY) <= 1
  );
  const adjacentToHome = Math.abs(worldX - homePosition.x) <= 1 && Math.abs(worldY - homePosition.y) <= 1;
  if (!adjacentToBuilding && !adjacentToHome) {
    return { canPlace: false, reason: 'Must build adjacent to existing structures' };
  }

  return { canPlace: true };
}

export function createBuilding(type: PlayerBuildingType, worldX: number, worldY: number): PlayerBuilding {
  const def = BUILDING_DEFINITIONS[type];
  return {
    id: `building_${worldX}_${worldY}`,
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
