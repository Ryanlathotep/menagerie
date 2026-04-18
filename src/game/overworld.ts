// Overworld system - infinite chunk-based exploration world

import { Monster, Position, SpeciesType, ElementType, SPECIES_DATA, DungeonEntrance, createAllThemedTowers } from './types';
import { generateRandomMonster } from './utils';
import { PlayerBuilding } from './buildings';
import { NestState, isNestAt, createNest } from './nests';
import {
  TreeTier, StoneTier, ResourceUpgradeState,
  TREE_TIER_DATA, STONE_TIER_DATA,
  getInitialTreeTier, getInitialStoneTier,
  tickResourceUpgrades,
} from './resourceHierarchy';

const ALL_SPECIES = Object.keys(SPECIES_DATA) as SpeciesType[];

// ============= TYPES =============

export type OverworldTileType = 'grass' | 'tree' | 'rock' | 'water' | 'building' | 'enemy' | 'player' | 'dungeon_entrance' | 'player_building' | 'nest' | 'dirt_road' | 'stone_road';

export type BuildingType = 'campfire' | 'log_cabin' | 'town_hall';

export interface OverworldTile {
  type: OverworldTileType;
  explored: boolean;
  visible: boolean;
  enemyId?: string;
  buildingType?: BuildingType;
  resourceAmount?: number; // For trees/rocks - how much resource is left
  harvested?: boolean;
  dungeonId?: string; // For dungeon_entrance tiles - links to DungeonEntrance
  playerBuildingId?: string; // For player_building tiles
  nestId?: string; // For nest tiles
  treeTier?: TreeTier;   // Resource hierarchy tier for trees
  stoneTier?: StoneTier; // Resource hierarchy tier for rocks
}

export interface OverworldChunk {
  cx: number; // Chunk X coordinate
  cy: number; // Chunk Y coordinate
  tiles: OverworldTile[][];
  enemies: Monster[];
}

export interface OverworldState {
  playerPosition: Position;
  chunks: Record<string, OverworldChunk>; // key = "cx,cy"
  homeBase: {
    buildingType: BuildingType;
    position: Position; // Always (0,0) in world coords
  };
  woodCollected: number;
  stoneCollected: number;
  dungeonEntrances: Record<string, DungeonEntrance>; // Persistent dungeon data
  playerBuildings: PlayerBuilding[]; // Phase 3: Player-placed buildings
  nests: Record<string, NestState>; // Phase 4: Monster nests
  roads: Record<string, 'dirt_road' | 'stone_road'>; // Road tiles keyed by "x,y"
  resourceUpgrades: Record<string, ResourceUpgradeState>; // Resource tier tracking keyed by "x,y"
  totalSteps: number; // Total steps taken (for resource upgrade ticking)
}

// ============= CONSTANTS =============

export const CHUNK_SIZE = 16;
const VIEW_RADIUS = 5; // Visibility radius around player

export const BUILDING_UPGRADES: Record<BuildingType, {
  label: string;
  emoji: string;
  next?: BuildingType;
  upgradeCost?: { wood: number; stone: number };
  features: string[];
}> = {
  campfire: {
    label: 'Campfire',
    emoji: '🔥',
    next: 'log_cabin',
    upgradeCost: { wood: 20, stone: 10 },
    features: ['Rest point'],
  },
  log_cabin: {
    label: 'Log Cabin',
    emoji: '🏠',
    next: 'town_hall',
    upgradeCost: { wood: 50, stone: 30 },
    features: ['Rest point', 'Shop', 'Crafting'],
  },
  town_hall: {
    label: 'Town Hall',
    emoji: '🏛️',
    features: ['Rest point', 'Shop', 'Crafting', 'Party Management', 'Storage'],
  },
};

// ============= BIOME / NOISE SYSTEM (Phase 2) =============

const BIOME_ELEMENTS: ElementType[] = ['fire', 'water', 'earth', 'air', 'void'];

// Simple 2D value noise for biome assignment
function biomeNoise(worldX: number, worldY: number, scale: number = 0.04): number {
  // Use multiple octaves of seeded noise for organic regions
  const s1 = seededRandom(Math.floor(worldX * scale) * 73856093 + Math.floor(worldY * scale) * 19349663);
  const s2 = seededRandom(Math.floor(worldX * scale * 0.5) * 83492791 + Math.floor(worldY * scale * 0.5) * 47302831);
  return s1 * 0.6 + s2 * 0.4;
}

// Get the dominant biome element for a world position
export function getBiomeElement(worldX: number, worldY: number): ElementType | null {
  const dist = Math.sqrt(worldX * worldX + worldY * worldY);
  if (dist < 8) return null; // No biome near spawn

  const noise = biomeNoise(worldX, worldY, 0.03);
  // Map noise to element index
  const idx = Math.floor(noise * BIOME_ELEMENTS.length) % BIOME_ELEMENTS.length;
  return BIOME_ELEMENTS[idx];
}

// Determines if a dungeon entrance should exist at a given world coordinate
// Uses deterministic hashing so entrances are stable across chunk loads
function isDungeonEntranceAt(worldX: number, worldY: number): boolean {
  if (worldX === 0 && worldY === 0) return false; // Home base

  const dist = Math.sqrt(worldX * worldX + worldY * worldY);
  // Keep dungeons a healthy distance from town so players have room to level up first.
  if (dist < 18) return false;

  // Deterministic grid-based placement: one dungeon per ~12x12 region
  const regionSize = 12;
  const regionX = Math.floor(worldX / regionSize);
  const regionY = Math.floor(worldY / regionSize);
  const hash = seededRandom(regionX * 98765 + regionY * 54321 + 11111);

  // The dungeon is at a specific tile within the region
  const dungeonLocalX = Math.floor(hash * regionSize);
  const dungeonLocalY = Math.floor(seededRandom(hash * 77777 + 33333) * regionSize);
  const dungeonWorldX = regionX * regionSize + dungeonLocalX;
  const dungeonWorldY = regionY * regionSize + dungeonLocalY;

  return worldX === dungeonWorldX && worldY === dungeonWorldY;
}

// If any themed tower (home / element / class / species) lives at this world position,
// return its dungeon id so the chunk generator can place a `dungeon_entrance` tile.
function findThemedTowerAt(
  dungeonEntrances: Record<string, DungeonEntrance>,
  worldX: number,
  worldY: number,
): string | null {
  for (const id in dungeonEntrances) {
    const d = dungeonEntrances[id];
    if (!d || !d.category || d.category === 'procedural') continue;
    if (d.worldX === worldX && d.worldY === worldY) return id;
  }
  return null;
}

// Create a DungeonEntrance for a world position
function createDungeonEntrance(worldX: number, worldY: number): DungeonEntrance {
  const id = `dungeon_${worldX}_${worldY}`;
  const seed = Math.abs(worldX * 73856093 + worldY * 19349663) % 2147483647;
  const dist = Math.sqrt(worldX * worldX + worldY * worldY);
  // Procedural dungeons scale gently with distance from town.
  const difficulty = Math.max(2, Math.floor(dist / 6));
  const element = getBiomeElement(worldX, worldY) || undefined;
  // Friendly auto-generated name so it matches the list panel.
  const elementLabel = element ? `${element.charAt(0).toUpperCase()}${element.slice(1)} ` : '';
  const name = `${elementLabel}Wilderness Dungeon`;

  return { id, worldX, worldY, seed, deepestFloor: 0, difficulty, element, category: 'procedural', name };
}

// ============= CHUNK GENERATION =============

function getChunkKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function generateChunk(cx: number, cy: number, difficulty: number, dungeonEntrances: Record<string, DungeonEntrance>, nests: Record<string, NestState>, resourceUpgrades?: Record<string, ResourceUpgradeState>): OverworldChunk {
  const tiles: OverworldTile[][] = [];
  const enemies: Monster[] = [];
  const seed = cx * 10000 + cy * 100;
  
  for (let y = 0; y < CHUNK_SIZE; y++) {
    const row: OverworldTile[] = [];
    for (let x = 0; x < CHUNK_SIZE; x++) {
      const worldX = cx * CHUNK_SIZE + x;
      const worldY = cy * CHUNK_SIZE + y;
      const tileSeed = seed + y * CHUNK_SIZE + x;
      const r = seededRandom(tileSeed);
      
      // Home base at (0,0)
      if (worldX === 0 && worldY === 0) {
        row.push({ type: 'building', explored: false, visible: false, buildingType: 'campfire' });
        continue;
      }
      
      // Themed dungeon tower at this exact world position?
      // (Tower of the Infinite + element/class/species towers all live on the map.)
      const themedTowerId = findThemedTowerAt(dungeonEntrances, worldX, worldY);
      if (themedTowerId) {
        // Discovered by default so the main-menu list & arrows still know about it,
        // but we don't reveal the tile until the player walks within sight.
        row.push({ type: 'dungeon_entrance', explored: false, visible: false, dungeonId: themedTowerId });
        continue;
      }

      // Procedural dungeon entrance (deterministic hash placement).
      if (isDungeonEntranceAt(worldX, worldY)) {
        const dungeonId = `dungeon_${worldX}_${worldY}`;
        if (!dungeonEntrances[dungeonId]) {
          dungeonEntrances[dungeonId] = createDungeonEntrance(worldX, worldY);
        }
        row.push({ type: 'dungeon_entrance', explored: false, visible: false, dungeonId });
        continue;
      }
      
      // Monster nest (Phase 4)
      if (isNestAt(worldX, worldY)) {
        const nestId = `nest_${worldX}_${worldY}`;
        if (!nests[nestId]) {
          nests[nestId] = createNest(worldX, worldY);
        }
        if (!nests[nestId].destroyed) {
          row.push({ type: 'nest', explored: false, visible: false, nestId });
          continue;
        }
        // If destroyed, fall through to generate as grass
      }

      // Check if there's a road placed here
      const roadKey = `${worldX},${worldY}`;
      const road = (dungeonEntrances as any).__roads?.[roadKey];
      // Note: roads are applied as overlays in getOverworldTile, not during generation

      // Biome-influenced terrain generation
      const biome = getBiomeElement(worldX, worldY);
      let type: OverworldTileType = 'grass';
      
      // Bias terrain by biome
      let waterChance = 0.04;
      let treeChance = 0.12;
      let rockChance = 0.06;
      
      if (biome === 'water') { waterChance = 0.15; treeChance = 0.06; }
      else if (biome === 'earth') { rockChance = 0.15; treeChance = 0.08; }
      else if (biome === 'fire') { rockChance = 0.10; waterChance = 0.01; treeChance = 0.04; }
      else if (biome === 'air') { treeChance = 0.05; waterChance = 0.02; }
      else if (biome === 'void') { rockChance = 0.08; treeChance = 0.06; }

      // Reduce enemy spawns near roads (check 2-tile radius)
      let enemyChanceMultiplier = 1.0;
      if (typeof dungeonEntrances === 'object') {
        // We'll check road proximity during movement instead
      }
      
      if (r < treeChance) {
        type = 'tree';
      } else if (r < treeChance + rockChance) {
        type = 'rock';
      } else if (r < treeChance + rockChance + waterChance) {
        type = 'water';
      } else if (r < treeChance + rockChance + waterChance + Math.min(0.06, Math.max(0, (difficulty - 1) * 0.012))) {
        type = 'enemy';
      }
      
      const tile: OverworldTile = { type, explored: false, visible: false };
      
      if (type === 'tree') {
        const treeTier = getInitialTreeTier(worldX, worldY, tileSeed);
        tile.treeTier = treeTier;
        tile.resourceAmount = TREE_TIER_DATA[treeTier].totalHits;
        // Register for upgrade tracking
        if (resourceUpgrades && TREE_TIER_DATA[treeTier].upgradeSteps) {
          const resKey = `${worldX},${worldY}`;
          if (!resourceUpgrades[resKey]) {
            resourceUpgrades[resKey] = { treeTier, stepsUntilUpgrade: TREE_TIER_DATA[treeTier].upgradeSteps! };
          }
        }
      }
      if (type === 'rock') {
        const stoneTier = getInitialStoneTier(worldX, worldY, tileSeed);
        tile.stoneTier = stoneTier;
        tile.resourceAmount = STONE_TIER_DATA[stoneTier].totalHits;
        if (resourceUpgrades && STONE_TIER_DATA[stoneTier].upgradeSteps) {
          const resKey = `${worldX},${worldY}`;
          if (!resourceUpgrades[resKey]) {
            resourceUpgrades[resKey] = { stoneTier, stepsUntilUpgrade: STONE_TIER_DATA[stoneTier].upgradeSteps! };
          }
        }
      }
      
      if (type === 'enemy') {
        const level = Math.max(1, Math.floor(difficulty));
        // Biome-influenced enemy spawns
        const enemy = generateRandomMonster(ALL_SPECIES, level);
        // If biome exists, 60% chance to match biome element
        if (biome && seededRandom(tileSeed + 999) < 0.6) {
          enemy.element = biome;
        }
        enemy.id = `ow_enemy_${worldX}_${worldY}`;
        enemies.push(enemy);
        tile.enemyId = enemy.id;
      }
      
      row.push(tile);
    }
    tiles.push(row);
  }
  
  return { cx, cy, tiles, enemies };
}

// ============= OVERWORLD STATE MANAGEMENT =============

export function createOverworldState(): OverworldState {
  const state: OverworldState = {
    playerPosition: { x: 0, y: 0 },
    chunks: {},
    homeBase: {
      buildingType: 'campfire',
      position: { x: 0, y: 0 },
    },
    woodCollected: 0,
    stoneCollected: 0,
    playerBuildings: [],
    // Seed with the canonical themed-tower set so the initial chunk
    // generation places the Tower of the Infinite + element/class/species
    // towers on the map.
    dungeonEntrances: createAllThemedTowers(),
    nests: {},
    roads: {},
    resourceUpgrades: {},
    totalSteps: 0,
  };
  
  // Generate starting chunk and surrounding chunks
  ensureChunksLoaded(state, 0, 0);
  // Make tiles around player visible
  updateVisibility(state);
  
  return state;
}

// Overworld difficulty must stay <= the nearest dungeon's starting level so the
// open world is always a safer place to level up than the dungeons themselves.
// Procedural dungeons start at floor(dist/6); we keep wild enemies a bit gentler.
export function getDifficulty(worldX: number, worldY: number): number {
  const dist = Math.sqrt(worldX * worldX + worldY * worldY);
  // Floor 1 within ~8 tiles of town, then scales slowly with distance.
  if (dist < 8) return 1;
  return Math.max(1, Math.floor((dist - 8) / 7) + 1);
}

export function ensureChunksLoaded(state: OverworldState, worldX: number, worldY: number): void {
  const cx = Math.floor(worldX / CHUNK_SIZE);
  const cy = Math.floor(worldY / CHUNK_SIZE);
  
  // Load 3x3 grid of chunks around player
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const key = getChunkKey(cx + dx, cy + dy);
      if (!state.chunks[key]) {
        const difficulty = getDifficulty((cx + dx) * CHUNK_SIZE, (cy + dy) * CHUNK_SIZE);
        state.chunks[key] = generateChunk(cx + dx, cy + dy, difficulty, state.dungeonEntrances, state.nests, state.resourceUpgrades);
      }
    }
  }
}

export function getOverworldTile(state: OverworldState, worldX: number, worldY: number): OverworldTile | null {
  const cx = Math.floor(worldX / CHUNK_SIZE);
  const cy = Math.floor(worldY / CHUNK_SIZE);
  const key = getChunkKey(cx, cy);
  const chunk = state.chunks[key];
  if (!chunk) return null;
  
  const localX = ((worldX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  const localY = ((worldY % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  return chunk.tiles[localY]?.[localX] || null;
}

export function setOverworldTile(state: OverworldState, worldX: number, worldY: number, tile: OverworldTile): void {
  const cx = Math.floor(worldX / CHUNK_SIZE);
  const cy = Math.floor(worldY / CHUNK_SIZE);
  const key = getChunkKey(cx, cy);
  const chunk = state.chunks[key];
  if (!chunk) return;
  
  const localX = ((worldX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  const localY = ((worldY % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  if (chunk.tiles[localY]) {
    chunk.tiles[localY][localX] = tile;
  }
}

export function updateVisibility(state: OverworldState): void {
  const { x: px, y: py } = state.playerPosition;
  
  // First pass: hide all visible tiles in loaded chunks
  for (const chunk of Object.values(state.chunks)) {
    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        if (chunk.tiles[y]?.[x]) {
          chunk.tiles[y][x].visible = false;
        }
      }
    }
  }
  
  // Second pass: reveal tiles around player
  for (let dy = -VIEW_RADIUS; dy <= VIEW_RADIUS; dy++) {
    for (let dx = -VIEW_RADIUS; dx <= VIEW_RADIUS; dx++) {
      if (dx * dx + dy * dy > VIEW_RADIUS * VIEW_RADIUS) continue;
      const tile = getOverworldTile(state, px + dx, py + dy);
      if (tile) {
        tile.visible = true;
        tile.explored = true;
        // Mark dungeon entrances as discovered when first seen
        if (tile.type === 'dungeon_entrance' && tile.dungeonId && state.dungeonEntrances?.[tile.dungeonId]) {
          state.dungeonEntrances[tile.dungeonId].discovered = true;
        }
      }
    }
  }
}

export function getVisibleTiles(state: OverworldState): { worldX: number; worldY: number; tile: OverworldTile }[] {
  const { x: px, y: py } = state.playerPosition;
  const result: { worldX: number; worldY: number; tile: OverworldTile }[] = [];
  const viewRange = VIEW_RADIUS + 3; // Show a bit more than visibility for fog of war
  
  for (let dy = -viewRange; dy <= viewRange; dy++) {
    for (let dx = -viewRange; dx <= viewRange; dx++) {
      const tile = getOverworldTile(state, px + dx, py + dy);
      if (tile && (tile.visible || tile.explored)) {
        result.push({ worldX: px + dx, worldY: py + dy, tile });
      }
    }
  }
  
  return result;
}

export function getOverworldEnemy(state: OverworldState, enemyId: string): Monster | null {
  for (const chunk of Object.values(state.chunks)) {
    const enemy = chunk.enemies.find(e => e.id === enemyId);
    if (enemy) return enemy;
  }
  return null;
}

export function removeOverworldEnemy(state: OverworldState, enemyId: string): void {
  for (const chunk of Object.values(state.chunks)) {
    const idx = chunk.enemies.findIndex(e => e.id === enemyId);
    if (idx !== -1) {
      chunk.enemies.splice(idx, 1);
      break;
    }
  }
}

// Try to move player in overworld. Returns what happened.
export type MoveResult = 
  | { type: 'moved'; bonusMove?: boolean }
  | { type: 'blocked'; reason: string }
  | { type: 'enemy'; enemy: Monster }
  | { type: 'resource'; resourceType: 'wood' | 'stone'; amount: number; tierName?: string; materialDrop?: { materialId: string; name: string } }
  | { type: 'building'; buildingType: BuildingType }
  | { type: 'dungeon_entrance'; dungeonId?: string }
  | { type: 'player_building'; building: PlayerBuilding }
  | { type: 'nest'; nest: NestState };

export function movePlayer(state: OverworldState, dx: number, dy: number): MoveResult {
  const newX = state.playerPosition.x + dx;
  const newY = state.playerPosition.y + dy;
  
  ensureChunksLoaded(state, newX, newY);
  
  const tile = getOverworldTile(state, newX, newY);
  if (!tile) return { type: 'blocked', reason: 'Edge of the world' };
  
  // Increment total steps and tick resource upgrades
  state.totalSteps = (state.totalSteps || 0) + 1;
  if (!state.resourceUpgrades) state.resourceUpgrades = {};
  const upgrades = tickResourceUpgrades(state.resourceUpgrades);
  // Apply upgrades to tile data
  for (const upg of upgrades) {
    const [ux, uy] = upg.key.split(',').map(Number);
    const upgTile = getOverworldTile(state, ux, uy);
    if (upgTile) {
      if (upg.type === 'tree' && upgTile.type === 'tree') {
        upgTile.treeTier = upg.newTier as TreeTier;
        upgTile.resourceAmount = TREE_TIER_DATA[upg.newTier as TreeTier].totalHits;
      } else if (upg.type === 'stone' && upgTile.type === 'rock') {
        upgTile.stoneTier = upg.newTier as StoneTier;
        upgTile.resourceAmount = STONE_TIER_DATA[upg.newTier as StoneTier].totalHits;
      }
    }
  }
  
  // Check if destination is a road
  const roadKey = `${newX},${newY}`;
  const isRoad = state.roads && state.roads[roadKey];
  
  switch (tile.type) {
    case 'water':
      return { type: 'blocked', reason: 'Water blocks your path' };
      
    case 'tree': {
      const treeTier = tile.treeTier || 'oak';
      const tierData = TREE_TIER_DATA[treeTier];
      const amount = tierData.harvestYield;
      tile.resourceAmount = (tile.resourceAmount || 1) - 1;
      if (tile.resourceAmount <= 0) {
        // Remove resource tracking when depleted
        const resKey = `${newX},${newY}`;
        delete state.resourceUpgrades[resKey];
        tile.type = 'grass';
        tile.harvested = true;
        tile.treeTier = undefined;
      }
      state.woodCollected += amount;
      // Check for special material drop
      let materialDrop: { materialId: string; name: string } | undefined;
      if (tierData.materialId && tierData.materialChance) {
        const dropRoll = seededRandom(state.totalSteps * 13 + newX * 7 + newY);
        if (dropRoll < tierData.materialChance) {
          materialDrop = { materialId: tierData.materialId, name: tierData.name + ' material' };
        }
      }
      return { type: 'resource', resourceType: 'wood', amount, tierName: tierData.name, materialDrop };
    }
    
    case 'rock': {
      const stoneTier = tile.stoneTier || 'stone';
      const tierData = STONE_TIER_DATA[stoneTier];
      const amount = tierData.harvestYield;
      tile.resourceAmount = (tile.resourceAmount || 1) - 1;
      if (tile.resourceAmount <= 0) {
        const resKey = `${newX},${newY}`;
        delete state.resourceUpgrades[resKey];
        tile.type = 'grass';
        tile.harvested = true;
        tile.stoneTier = undefined;
      }
      state.stoneCollected += amount;
      let materialDrop: { materialId: string; name: string } | undefined;
      if (tierData.materialId && tierData.materialChance) {
        const dropRoll = seededRandom(state.totalSteps * 17 + newX * 11 + newY);
        if (dropRoll < tierData.materialChance) {
          materialDrop = { materialId: tierData.materialId, name: tierData.name + ' material' };
        }
      }
      return { type: 'resource', resourceType: 'stone', amount, tierName: tierData.name, materialDrop };
    }
    
    case 'enemy': {
      if (tile.enemyId) {
        const enemy = getOverworldEnemy(state, tile.enemyId);
        if (enemy) return { type: 'enemy', enemy };
      }
      return { type: 'blocked', reason: 'An enemy blocks your path' };
    }
    
    case 'building': {
      state.playerPosition = { x: newX, y: newY };
      updateVisibility(state);
      return { type: 'building', buildingType: tile.buildingType || 'campfire' };
    }
    
    case 'dungeon_entrance': {
      state.playerPosition = { x: newX, y: newY };
      updateVisibility(state);
      return { type: 'dungeon_entrance', dungeonId: tile.dungeonId };
    }
    
    case 'player_building': {
      const building = state.playerBuildings.find(b => b.id === tile.playerBuildingId);
      if (building && building.type === 'wall') {
        return { type: 'blocked', reason: 'A wall blocks your path' };
      }
      state.playerPosition = { x: newX, y: newY };
      updateVisibility(state);
      if (building) return { type: 'player_building', building };
      return { type: 'moved' };
    }
    
    case 'nest': {
      const nest = state.nests[tile.nestId || ''];
      if (nest && !nest.destroyed) {
        return { type: 'nest', nest };
      }
      state.playerPosition = { x: newX, y: newY };
      updateVisibility(state);
      return { type: 'moved' };
    }

    case 'dirt_road':
    case 'stone_road': {
      state.playerPosition = { x: newX, y: newY };
      updateVisibility(state);
      // Stone roads grant a bonus move (player moves 2 tiles)
      const bonusMove = tile.type === 'stone_road';
      return { type: 'moved', bonusMove };
    }
    
    default: {
      state.playerPosition = { x: newX, y: newY };
      updateVisibility(state);
      // Check if this grass tile has a road overlay
      if (isRoad) {
        const bonusMove = isRoad === 'stone_road';
        return { type: 'moved', bonusMove };
      }
      return { type: 'moved' };
    }
  }
}

// Upgrade home base building
export function canUpgradeBase(state: OverworldState): boolean {
  const info = BUILDING_UPGRADES[state.homeBase.buildingType];
  if (!info.next || !info.upgradeCost) return false;
  return state.woodCollected >= info.upgradeCost.wood && state.stoneCollected >= info.upgradeCost.stone;
}

export function upgradeBase(state: OverworldState): BuildingType | null {
  const info = BUILDING_UPGRADES[state.homeBase.buildingType];
  if (!info.next || !info.upgradeCost) return null;
  if (!canUpgradeBase(state)) return null;
  
  state.woodCollected -= info.upgradeCost.wood;
  state.stoneCollected -= info.upgradeCost.stone;
  state.homeBase.buildingType = info.next;
  
  // Update the tile
  const tile = getOverworldTile(state, 0, 0);
  if (tile) {
    tile.buildingType = info.next;
  }
  
  return info.next;
}

// ============= ROAD SYSTEM =============

export type RoadType = 'dirt_road' | 'stone_road';

export const ROAD_DEFINITIONS: Record<RoadType, {
  name: string;
  emoji: string;
  description: string;
  cost: { wood: number; stone: number };
}> = {
  dirt_road: {
    name: 'Dirt Road',
    emoji: '🟫',
    description: 'A simple path. Reduces enemy spawns nearby.',
    cost: { wood: 2, stone: 0 },
  },
  stone_road: {
    name: 'Stone Road',
    emoji: '🧱',
    description: 'A paved road. Grants speed boost (bonus move) and reduces enemy spawns.',
    cost: { wood: 1, stone: 3 },
  },
};

export function canPlaceRoad(
  state: OverworldState,
  worldX: number,
  worldY: number,
  roadType: RoadType,
): { canPlace: boolean; reason?: string } {
  const def = ROAD_DEFINITIONS[roadType];
  if (state.woodCollected < def.cost.wood) return { canPlace: false, reason: `Need ${def.cost.wood} wood` };
  if (state.stoneCollected < def.cost.stone) return { canPlace: false, reason: `Need ${def.cost.stone} stone` };

  const key = `${worldX},${worldY}`;
  if (state.roads[key]) return { canPlace: false, reason: 'Road already exists here' };

  const tile = getOverworldTile(state, worldX, worldY);
  if (!tile) return { canPlace: false, reason: 'Invalid location' };
  if (tile.type !== 'grass' || tile.harvested) {
    // Allow building on harvested grass too
    if (tile.type !== 'grass') return { canPlace: false, reason: 'Can only place roads on open ground' };
  }

  return { canPlace: true };
}

export function placeRoad(state: OverworldState, worldX: number, worldY: number, roadType: RoadType): boolean {
  const check = canPlaceRoad(state, worldX, worldY, roadType);
  if (!check.canPlace) return false;

  const def = ROAD_DEFINITIONS[roadType];
  state.woodCollected -= def.cost.wood;
  state.stoneCollected -= def.cost.stone;

  const key = `${worldX},${worldY}`;
  if (!state.roads) state.roads = {};
  state.roads[key] = roadType;

  // Update the tile type so the renderer picks it up
  setOverworldTile(state, worldX, worldY, {
    type: roadType,
    explored: true,
    visible: true,
  });

  return true;
}

// Check if a world position is near a road (within radius tiles)
export function isNearRoad(state: OverworldState, worldX: number, worldY: number, radius: number = 2): boolean {
  if (!state.roads) return false;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const key = `${worldX + dx},${worldY + dy}`;
      if (state.roads[key]) return true;
    }
  }
  return false;
}

// Restore road tiles after chunk reload (roads persist in state.roads but tiles regenerate)
export function applyRoadsToChunks(state: OverworldState): void {
  if (!state.roads) return;
  for (const [key, roadType] of Object.entries(state.roads)) {
    const [xStr, yStr] = key.split(',');
    const wx = parseInt(xStr);
    const wy = parseInt(yStr);
    const tile = getOverworldTile(state, wx, wy);
    if (tile && tile.type !== roadType) {
      setOverworldTile(state, wx, wy, {
        type: roadType,
        explored: true,
        visible: tile.visible,
      });
    }
  }
}

// Find the nearest tile to (originX, originY) that the player can stand on.
// Used to respawn the overworld player at home after a full party defeat.
// Walkable = grass / road / harvested ground / building (the home base tile).
export function findNearestEmptyOverworldTile(
  state: OverworldState,
  originX: number,
  originY: number,
): Position {
  const isStandable = (wx: number, wy: number): boolean => {
    ensureChunksLoaded(state, wx, wy);
    const tile = getOverworldTile(state, wx, wy);
    if (!tile) return false;
    // Building (home base) is always a valid respawn — player can stand on the campfire/town tile.
    if (tile.type === 'building') return true;
    if (tile.type === 'grass' || tile.type === 'dirt_road' || tile.type === 'stone_road') return true;
    return false;
  };

  // Spiral outward from origin up to a generous radius.
  if (isStandable(originX, originY)) return { x: originX, y: originY };
  for (let r = 1; r <= 30; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        // Only check the ring at distance r (Chebyshev) so we expand outward evenly
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const wx = originX + dx;
        const wy = originY + dy;
        if (isStandable(wx, wy)) return { x: wx, y: wy };
      }
    }
  }
  // Fallback: origin even if not strictly standable
  return { x: originX, y: originY };
}
