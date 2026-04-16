// Overworld system - infinite chunk-based exploration world

import { Monster, Position, SpeciesType, ElementType, SPECIES_DATA, DungeonEntrance } from './types';
import { generateRandomMonster } from './utils';
import { PlayerBuilding } from './buildings';
import { NestState, isNestAt, createNest } from './nests';

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
  if (worldX === 2 && worldY === 0) return true; // Legacy entrance

  const dist = Math.sqrt(worldX * worldX + worldY * worldY);
  if (dist < 10) return false; // No dungeons too close to spawn (except legacy)

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

// Create a DungeonEntrance for a world position
function createDungeonEntrance(worldX: number, worldY: number): DungeonEntrance {
  const id = `dungeon_${worldX}_${worldY}`;
  const seed = Math.abs(worldX * 73856093 + worldY * 19349663) % 2147483647;
  const dist = Math.sqrt(worldX * worldX + worldY * worldY);
  const difficulty = Math.max(1, Math.floor(dist / 5));
  const element = getBiomeElement(worldX, worldY) || undefined;

  return { id, worldX, worldY, seed, deepestFloor: 0, difficulty, element };
}

// ============= CHUNK GENERATION =============

function getChunkKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function generateChunk(cx: number, cy: number, difficulty: number, dungeonEntrances: Record<string, DungeonEntrance>, nests: Record<string, NestState>): OverworldChunk {
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
      
      // Dungeon entrance (procedural or legacy)
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
      } else if (r < treeChance + rockChance + waterChance + Math.min(0.08, difficulty * 0.01)) {
        type = 'enemy';
      }
      
      const tile: OverworldTile = { type, explored: false, visible: false };
      
      if (type === 'tree') tile.resourceAmount = 3;
      if (type === 'rock') tile.resourceAmount = 3;
      
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
    dungeonEntrances: {},
    nests: {},
    roads: {},
  };
  
  // Generate starting chunk and surrounding chunks
  ensureChunksLoaded(state, 0, 0);
  // Make tiles around player visible
  updateVisibility(state);
  
  return state;
}

function getDifficulty(worldX: number, worldY: number): number {
  return Math.max(1, Math.floor(Math.sqrt(worldX * worldX + worldY * worldY) / 3));
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
        state.chunks[key] = generateChunk(cx + dx, cy + dy, difficulty, state.dungeonEntrances, state.nests);
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
  | { type: 'resource'; resourceType: 'wood' | 'stone'; amount: number }
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
  
  switch (tile.type) {
    case 'water':
      return { type: 'blocked', reason: 'Water blocks your path' };
      
    case 'tree': {
      // Harvest wood
      const amount = Math.min(tile.resourceAmount || 1, 1);
      tile.resourceAmount = (tile.resourceAmount || 1) - amount;
      if (tile.resourceAmount <= 0) {
        tile.type = 'grass';
        tile.harvested = true;
      }
      state.woodCollected += amount;
      return { type: 'resource', resourceType: 'wood', amount };
    }
    
    case 'rock': {
      // Mine stone
      const amount = Math.min(tile.resourceAmount || 1, 1);
      tile.resourceAmount = (tile.resourceAmount || 1) - amount;
      if (tile.resourceAmount <= 0) {
        tile.type = 'grass';
        tile.harvested = true;
      }
      state.stoneCollected += amount;
      return { type: 'resource', resourceType: 'stone', amount };
    }
    
    case 'enemy': {
      // Don't walk into enemies - block movement and signal combat
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
      // Walk onto player buildings (farms to harvest, etc.)
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
      // Nests block movement — player must attack them
      const nest = state.nests[tile.nestId || ''];
      if (nest && !nest.destroyed) {
        return { type: 'nest', nest };
      }
      // Destroyed nest → walk through
      state.playerPosition = { x: newX, y: newY };
      updateVisibility(state);
      return { type: 'moved' };
    }
    
    default: {
      // grass - just move
      state.playerPosition = { x: newX, y: newY };
      updateVisibility(state);
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
