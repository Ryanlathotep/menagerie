// Overworld system - infinite chunk-based exploration world

import { Monster, Position, SpeciesType, SPECIES_DATA } from './types';
import { generateRandomMonster } from './utils';

const ALL_SPECIES = Object.keys(SPECIES_DATA) as SpeciesType[];

// ============= TYPES =============

export type OverworldTileType = 'grass' | 'tree' | 'rock' | 'water' | 'building' | 'enemy' | 'player' | 'dungeon_entrance';

export type BuildingType = 'campfire' | 'log_cabin' | 'town_hall';

export interface OverworldTile {
  type: OverworldTileType;
  explored: boolean;
  visible: boolean;
  enemyId?: string;
  buildingType?: BuildingType;
  resourceAmount?: number; // For trees/rocks - how much resource is left
  harvested?: boolean;
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

// ============= CHUNK GENERATION =============

function getChunkKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function generateChunk(cx: number, cy: number, difficulty: number): OverworldChunk {
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
      
      // Special tiles
      // Home base at (0,0) - handled externally
      if (worldX === 0 && worldY === 0) {
        row.push({ type: 'building', explored: false, visible: false, buildingType: 'campfire' });
        continue;
      }
      
      // Dungeon entrance at (2,0)
      if (worldX === 2 && worldY === 0) {
        row.push({ type: 'dungeon_entrance', explored: false, visible: false });
        continue;
      }
      
      // Generate terrain based on noise
      let type: OverworldTileType = 'grass';
      
      if (r < 0.12) {
        type = 'tree';
      } else if (r < 0.18) {
        type = 'rock';
      } else if (r < 0.22) {
        type = 'water';
      } else if (r < 0.22 + Math.min(0.08, difficulty * 0.01)) {
        // Enemy spawn chance increases with distance
        type = 'enemy';
      }
      
      const tile: OverworldTile = { type, explored: false, visible: false };
      
      if (type === 'tree') tile.resourceAmount = 3;
      if (type === 'rock') tile.resourceAmount = 3;
      
      if (type === 'enemy') {
        const level = Math.max(1, Math.floor(difficulty));
        const enemy = generateRandomMonster(ALL_SPECIES, level);
        enemy.id = `ow_enemy_${worldX}_${worldY}`;
        enemies.push(enemy);
        tile.enemyId = enemy.id;
      }
      
      row.push(tile);
    }
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
  };
  
  // Generate starting chunk and surrounding chunks
  ensureChunksLoaded(state, 0, 0);
  
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
        state.chunks[key] = generateChunk(cx + dx, cy + dy, difficulty);
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
  | { type: 'moved' }
  | { type: 'blocked'; reason: string }
  | { type: 'enemy'; enemy: Monster }
  | { type: 'resource'; resourceType: 'wood' | 'stone'; amount: number }
  | { type: 'building'; buildingType: BuildingType }
  | { type: 'dungeon_entrance' };

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
      return { type: 'dungeon_entrance' };
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
