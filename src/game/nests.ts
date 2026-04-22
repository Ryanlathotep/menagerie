// Monster Nests - Special overworld tiles that spawn waves of enemies
// Nests have an element theme, spawn enemies periodically, and can be destroyed for bonus loot

import { ElementType, Monster, SpeciesType, SPECIES_DATA, Position } from './types';
import { generateRandomMonster } from './utils';
import { CraftingMaterial, CRAFTING_MATERIALS } from './equipment';
import { getBiomeElement, getWorldSeed } from './overworld';

// ============= TYPES =============

export interface NestState {
  id: string;
  worldX: number;
  worldY: number;
  element: ElementType;
  hp: number;
  maxHp: number;
  level: number;               // Difficulty level (scales with distance)
  spawnCooldown: number;       // Steps until next spawn
  maxSpawnCooldown: number;    // Base steps between spawns
  totalSpawned: number;        // Total enemies spawned (for scaling)
  destroyed: boolean;          // Permanently destroyed
  destroyedAt?: number;        // Step count when destroyed (for respawn timer)
}

// ============= CONSTANTS =============

const NEST_BASE_HP = 30;
const NEST_HP_PER_LEVEL = 15;
const NEST_BASE_SPAWN_COOLDOWN = 12;  // Steps between spawns
const NEST_MIN_SPAWN_COOLDOWN = 6;
const NEST_RESPAWN_STEPS = 200;       // Steps before a destroyed nest respawns on overworld
const NEST_MIN_DISTANCE = 8;          // Minimum distance from origin for nests to appear
const NEST_MAX_NEARBY_ENEMIES = 4;    // Max enemies a nest will have active nearby

// ============= NEST PLACEMENT =============

// Deterministic check: should a nest exist at this position?
export function isNestAt(worldX: number, worldY: number): boolean {
  if (worldX === 0 && worldY === 0) return false;
  
  const dist = Math.sqrt(worldX * worldX + worldY * worldY);
  if (dist < NEST_MIN_DISTANCE) return false;

  // Grid-based placement: one nest per ~8x8 region, offset from dungeon grid
  const regionSize = 8;
  const regionX = Math.floor((worldX + 4) / regionSize); // Offset so nests don't overlap dungeons
  const regionY = Math.floor((worldY + 4) / regionSize);
  const hash = seededRandom(regionX * 54321 + regionY * 12345 + 77777);

  // Only ~20% of regions get a nest (reduced from 40% to lower clutter)
  if (hash > 0.2) return false;

  const nestLocalX = Math.floor(seededRandom(hash * 99991 + 11111) * regionSize);
  const nestLocalY = Math.floor(seededRandom(hash * 88883 + 22222) * regionSize);
  const nestWorldX = (regionX * regionSize - 4) + nestLocalX;
  const nestWorldY = (regionY * regionSize - 4) + nestLocalY;

  return worldX === nestWorldX && worldY === nestWorldY;
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// ============= NEST CREATION =============

export function createNest(worldX: number, worldY: number): NestState {
  const dist = Math.sqrt(worldX * worldX + worldY * worldY);
  const level = Math.max(1, Math.floor(dist / 4));
  const element = getBiomeElement(worldX, worldY) || 'normal';
  
  return {
    id: `nest_${worldX}_${worldY}`,
    worldX,
    worldY,
    element,
    hp: NEST_BASE_HP + level * NEST_HP_PER_LEVEL,
    maxHp: NEST_BASE_HP + level * NEST_HP_PER_LEVEL,
    level,
    spawnCooldown: NEST_BASE_SPAWN_COOLDOWN,
    maxSpawnCooldown: Math.max(NEST_MIN_SPAWN_COOLDOWN, NEST_BASE_SPAWN_COOLDOWN - level),
    totalSpawned: 0,
    destroyed: false,
  };
}

// ============= NEST SPAWNING =============

// Get species that match the nest's element theme
function getNestSpecies(element: ElementType): SpeciesType[] {
  // All species can spawn, but biome-matched ones are preferred
  return Object.keys(SPECIES_DATA) as SpeciesType[];
}

// Tick a nest each player step, potentially spawning an enemy
export function tickNest(nest: NestState): { shouldSpawn: boolean } {
  if (nest.destroyed) return { shouldSpawn: false };
  
  nest.spawnCooldown--;
  if (nest.spawnCooldown <= 0) {
    nest.spawnCooldown = nest.maxSpawnCooldown;
    return { shouldSpawn: true };
  }
  return { shouldSpawn: false };
}

// Generate a monster from a nest
export function spawnNestMonster(nest: NestState): Monster {
  const species = getNestSpecies(nest.element);
  const monster = generateRandomMonster(species, nest.level);
  
  // 70% chance to match nest element
  if (nest.element !== 'normal' && Math.random() < 0.7) {
    monster.element = nest.element;
  }
  
  monster.id = `nest_spawn_${nest.id}_${nest.totalSpawned}_${Date.now()}`;
  nest.totalSpawned++;
  return monster;
}

// Find a valid spawn position around a nest (adjacent grass tile, not visible)
export function findNestSpawnPosition(
  nestX: number, nestY: number,
  getTile: (x: number, y: number) => { type: string; visible: boolean } | null,
): Position | null {
  // Try adjacent tiles first, then expand
  const offsets = [
    { dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 },
    { dx: 1, dy: -1 }, { dx: 1, dy: 1 }, { dx: -1, dy: 1 }, { dx: -1, dy: -1 },
    { dx: 0, dy: -2 }, { dx: 2, dy: 0 }, { dx: 0, dy: 2 }, { dx: -2, dy: 0 },
  ];
  
  // Shuffle for variety
  for (let i = offsets.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [offsets[i], offsets[j]] = [offsets[j], offsets[i]];
  }
  
  for (const { dx, dy } of offsets) {
    const tile = getTile(nestX + dx, nestY + dy);
    if (tile && tile.type === 'grass' && !tile.visible) {
      return { x: nestX + dx, y: nestY + dy };
    }
  }
  
  return null;
}

// ============= NEST COMBAT =============

// Damage a nest (returns true if destroyed)
export function damageNest(nest: NestState, damage: number): boolean {
  nest.hp = Math.max(0, nest.hp - damage);
  if (nest.hp <= 0) {
    nest.destroyed = true;
    return true;
  }
  return false;
}

// ============= NEST REWARDS =============

// Bonus loot when destroying a nest
export function getNestDestroyRewards(nest: NestState): {
  xp: number;
  gold: number;
  materials: CraftingMaterial[];
} {
  const xp = 50 + nest.level * 30;
  const gold = 10 + nest.level * 8;
  
  const materials: CraftingMaterial[] = [];
  // Guaranteed 1-2 materials, plus chance for more
  const numMaterials = 1 + Math.floor(Math.random() * 2) + (nest.level >= 5 ? 1 : 0);
  
  const availableMaterials = CRAFTING_MATERIALS.filter(m => 
    m.type === 'ore' || m.type === 'hide' || m.type === 'gem' || m.type === 'fabric'
  );
  
  for (let i = 0; i < numMaterials; i++) {
    const mat = availableMaterials[Math.floor(Math.random() * availableMaterials.length)];
    if (mat) materials.push({ ...mat });
  }
  
  return { xp, gold, materials };
}

// Count enemies near a nest position
export function countNearbyNestEnemies(
  nestX: number, nestY: number,
  nestId: string,
  getTile: (x: number, y: number) => { type: string; enemyId?: string } | null,
): number {
  let count = 0;
  const range = 4;
  for (let dy = -range; dy <= range; dy++) {
    for (let dx = -range; dx <= range; dx++) {
      const tile = getTile(nestX + dx, nestY + dy);
      if (tile?.type === 'enemy' && tile.enemyId?.startsWith(`nest_spawn_${nestId}`)) {
        count++;
      }
    }
  }
  return count;
}
