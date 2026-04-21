// Overworld system - infinite chunk-based exploration world

import { Monster, Position, SpeciesType, ElementType, SPECIES_DATA, DungeonEntrance, createAllThemedTowers } from './types';
import { generateRandomMonster } from './utils';
import { PlayerBuilding, isWallActingAsGate } from './buildings';
import { NestState, isNestAt, createNest } from './nests';
import {
  TreeTier, StoneTier, ResourceUpgradeState,
  TREE_TIER_DATA, STONE_TIER_DATA,
  getInitialTreeTier, getInitialStoneTier,
  tickResourceUpgrades, jitterUpgradeSteps,
} from './resourceHierarchy';
import { isCreativeMode } from './creativeMode';
import { getTileElevation, getCliffDrops, pickRampHere, shouldBeWaterfall } from './elevation';

const ALL_SPECIES = Object.keys(SPECIES_DATA) as SpeciesType[];

// ============= TYPES =============

export type OverworldTileType = 'grass' | 'tree' | 'rock' | 'water' | 'building' | 'enemy' | 'player' | 'dungeon_entrance' | 'player_building' | 'nest' | 'dirt_road' | 'stone_road' | 'cliff' | 'waterfall';

export type BuildingType = 'campfire' | 'log_cabin' | 'town_hall';

export interface OverworldTile {
  type: OverworldTileType;
  explored: boolean;
  visible: boolean;
  enemyId?: string;
  buildingType?: BuildingType;
  resourceAmount?: number; // For trees/rocks - how much resource is left
  harvested?: boolean;
  lastHarvestType?: 'tree' | 'rock'; // What was harvested here — used by regrowth pass
  dungeonId?: string; // For dungeon_entrance tiles - links to DungeonEntrance
  playerBuildingId?: string; // For player_building tiles
  nestId?: string; // For nest tiles
  treeTier?: TreeTier;   // Resource hierarchy tier for trees
  stoneTier?: StoneTier; // Resource hierarchy tier for rocks
  // ─── Elevation system ───
  elevation?: number;             // 0-5; undefined treated as 0 (legacy saves)
  cliffDrops?: { n: boolean; e: boolean; s: boolean; w: boolean }; // sides that drop down
  isRamp?: boolean;               // Passable cliff opening — connects two elevation levels
  rampDirection?: 'n' | 's' | 'e' | 'w'; // direction the ramp climbs UP toward
  hasStairs?: boolean;            // Stair-style stone road laid on a ramp
  waterfallDir?: 'n' | 's' | 'e' | 'w'; // direction water cascades toward (for waterfall tiles)
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
  // Persisted per-tile overrides applied AFTER chunks regenerate from seed.
  // Keyed by "x,y". Used so refresh-time chunk regeneration doesn't wipe
  // player edits (water-fills, harvested grass, depleted resources, fog-of-war).
  tileOverrides?: Record<string, OverworldTile>;
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

// ============= ELEVATION / RIVER NOISE (rivers, ponds, lakes, islands) =============
//
// Inspired by the Genesis Forge worldgen approach: a single elevation field
// drives BOTH water and stone placement on opposite ends of the same scalar.
// This naturally makes rivers/ponds form away from rocky outcrops because they
// sit at opposite extremes of the same noise.
//
//   elevation < WATER_LEVEL  -> water (rivers, ponds, lakes, ocean cells)
//   elevation > STONE_LEVEL  -> rock outcrop bias
//
// A second "river" noise (ridged) carves thin meandering water channels into
// any tile whose elevation is just barely above water level. The result is a
// mix of fat lakes (deep elevation valleys) and skinny rivers (ridged carve).

// Multi-octave value-noise approximation built on the existing seededRandom.
// Smooth bilinear interpolation between integer lattice samples.
function smoothNoise(x: number, y: number, salt: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const v00 = seededRandom(ix * 73856093 + iy * 19349663 + salt);
  const v10 = seededRandom((ix + 1) * 73856093 + iy * 19349663 + salt);
  const v01 = seededRandom(ix * 73856093 + (iy + 1) * 19349663 + salt);
  const v11 = seededRandom((ix + 1) * 73856093 + (iy + 1) * 19349663 + salt);
  // Smoothstep weights for nicer (less blocky) interpolation.
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = v00 + (v10 - v00) * sx;
  const b = v01 + (v11 - v01) * sx;
  return a + (b - a) * sy;
}

function fbm(x: number, y: number, salt: number, octaves: number = 3): number {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += smoothNoise(x * freq, y * freq, salt + i * 1013) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm; // 0..1
}

// Elevation field. Returns 0 (deep water) → 1 (high stone).
// Scale ~0.04 gives blob radii of roughly 6-10 tiles, matching pond/lake size.
export function getElevation(worldX: number, worldY: number): number {
  return fbm(worldX * 0.04, worldY * 0.04, 31337, 3);
}

// Ridged "river" noise — peaks on long thin lines through the elevation field.
// 1 - |2*n - 1| turns smooth noise into a ridge value (high along the ridges).
function ridgedNoise(x: number, y: number, salt: number): number {
  const n = fbm(x, y, salt, 2);
  return 1 - Math.abs(2 * n - 1);
}

// Returns true if this tile sits on a thin meandering river channel.
// Rivers prefer low-elevation valleys (so they "flow away" from stone peaks).
export function isRiverTile(worldX: number, worldY: number): boolean {
  const elev = getElevation(worldX, worldY);
  // Anything already a lake/pond elevation is handled by the elevation pass.
  if (elev < 0.34) return false;
  // Don't carve rivers through high terrain — they should follow valleys.
  if (elev > 0.55) return false;
  const ridge = ridgedNoise(worldX * 0.06 + 100, worldY * 0.06 - 50, 91173);
  // Tight threshold → narrow river. Loosen near elevation lows so rivers
  // widen into ponds where they pool.
  const threshold = 0.93 - (0.55 - elev) * 0.4; // 0.85..0.93
  return ridge > threshold;
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

      // ---- Elevation-driven water & stone (Genesis-Forge style) ----
      // The elevation noise field drives BOTH water and stone, on opposite ends.
      // Low elevation = water (lakes / ponds / ocean); high elevation = stone
      // outcrops. Because they share the same field, water naturally forms
      // away from rocky peaks, and rivers (ridged noise) follow valleys.
      const elevation = getElevation(worldX, worldY);
      // Don't drown the spawn area — push elevation up near (0,0) so home
      // base is reliably surrounded by walkable land.
      const distFromHome = Math.sqrt(worldX * worldX + worldY * worldY);
      const homeLandBias = distFromHome < 6 ? (6 - distFromHome) * 0.12 : 0;
      const adjElev = Math.min(1, elevation + homeLandBias);

      // Biome tweaks the thresholds slightly so a "water" biome has more lakes,
      // an "earth" biome has more crags, etc. — but the core anti-correlation
      // between water and stone is preserved.
      let waterCutoff = 0.34; // adjElev below this -> water (lake)
      let stoneCutoff = 0.72; // adjElev above this -> rock (outcrop)
      if (biome === 'water') { waterCutoff = 0.42; stoneCutoff = 0.78; }
      else if (biome === 'earth') { waterCutoff = 0.26; stoneCutoff = 0.62; }
      else if (biome === 'fire') { waterCutoff = 0.20; stoneCutoff = 0.66; }
      else if (biome === 'air') { waterCutoff = 0.30; stoneCutoff = 0.74; }
      else if (biome === 'void') { waterCutoff = 0.30; stoneCutoff = 0.70; }

      const isLake = adjElev < waterCutoff && distFromHome > 4;
      const isStone = adjElev > stoneCutoff;
      // Rivers carve thin meandering water through mid-elevation valleys.
      // They don't run through high stone (the noise rejects elev > 0.55),
      // so rivers naturally flow AWAY from rocky terrain.
      const isRiver = !isStone && distFromHome > 5 && isRiverTile(worldX, worldY);

      // Trees are governed by classic random + biome bias (independent system).
      let treeChance = 0.12;
      if (biome === 'water') treeChance = 0.06;
      else if (biome === 'fire') treeChance = 0.04;
      else if (biome === 'air') treeChance = 0.05;
      else if (biome === 'earth') treeChance = 0.08;

      // Cluster bias for trees (forests). Stone clustering already comes from
      // the elevation field, so we no longer need a separate outcrop noise.
      const forestNoise = biomeNoise(worldX, worldY, 0.18);
      if (forestNoise > 0.55) treeChance += (forestNoise - 0.55) * 0.9;

      // Decide tile type. Order matters:
      //   water (lake or river)  >  stone  >  tree  >  enemy  >  grass
      if (isLake || isRiver) {
        type = 'water';
      } else if (isStone) {
        type = 'rock';
      } else if (r < treeChance) {
        type = 'tree';
      } else if (r < treeChance + Math.min(0.06, Math.max(0, (difficulty - 1) * 0.012))) {
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
            resourceUpgrades[resKey] = {
              treeTier,
              stepsUntilUpgrade: jitterUpgradeSteps(TREE_TIER_DATA[treeTier].upgradeSteps!, worldX, worldY, 1),
            };
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
            resourceUpgrades[resKey] = {
              stoneTier,
              stepsUntilUpgrade: jitterUpgradeSteps(STONE_TIER_DATA[stoneTier].upgradeSteps!, worldX, worldY, 2),
            };
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
      
      // ─── Elevation pass ───
      // Compute elevation for this tile and decide whether it should become a
      // cliff face, ramp, or waterfall. Cliffs/waterfalls override tree/rock
      // (so a high-elevation crag becomes a sheer cliff instead of a rock
      // outcrop). Ramps stay walkable grass underneath but carry directional
      // metadata for the renderer.
      const tileElev = getTileElevation(worldX, worldY, biome);
      tile.elevation = tileElev;
      // Use a chunk-local biome lookup that doesn't trigger recursive
      // chunk-load: if a neighbor is in this chunk we read its elevation
      // directly from biome noise, never from state.
      const getBiomeAtLocal = (qx: number, qy: number) => getBiomeElement(qx, qy);
      const drops = getCliffDrops(worldX, worldY, biome, getBiomeAtLocal);

      if (drops.any) {
        tile.cliffDrops = { n: drops.n, e: drops.e, s: drops.s, w: drops.w };

        // Waterfall takes priority: a water tile dropping to a lower neighbor
        // becomes a passable-looking but movement-blocking cascade.
        if (shouldBeWaterfall(worldX, worldY, biome, (qx, qy) => {
          // Approximate "is water" using the same logic as the main pass
          // (lake or river). Cheap & deterministic.
          const e = getTileElevation(qx, qy, getBiomeElement(qx, qy));
          if (e === 0) return true;
          return false;
        }, getBiomeAtLocal)) {
          tile.type = 'waterfall';
          tile.waterfallDir = drops.s ? 's' : drops.e ? 'e' : drops.w ? 'w' : 'n';
          // Strip resource metadata from the overridden tile.
          tile.treeTier = undefined;
          tile.stoneTier = undefined;
          tile.resourceAmount = undefined;
          if (resourceUpgrades) delete resourceUpgrades[`${worldX},${worldY}`];
        } else {
          // Decide between cliff and ramp. Ramps are rarer — exactly one per
          // small ring of cliff tiles at the same elevation step.
          const ramp = pickRampHere(worldX, worldY, biome, getBiomeAtLocal);
          if (ramp) {
            // Ramp = passable grass with directional metadata. Strip any
            // tree/rock that would have spawned here.
            tile.type = 'grass';
            tile.isRamp = true;
            tile.rampDirection = ramp;
            tile.harvested = false;
            tile.lastHarvestType = undefined;
            tile.treeTier = undefined;
            tile.stoneTier = undefined;
            tile.resourceAmount = undefined;
            if (resourceUpgrades) delete resourceUpgrades[`${worldX},${worldY}`];
          } else {
            // Cliff face — impassable, no resources.
            tile.type = 'cliff';
            tile.treeTier = undefined;
            tile.stoneTier = undefined;
            tile.resourceAmount = undefined;
            if (resourceUpgrades) delete resourceUpgrades[`${worldX},${worldY}`];
          }
        }
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

// ─── Resource spreading & regrowth ───
// Mature trees and rocks slowly seed nearby grass tiles, growing groves and
// outcrops over time. Harvested patches also have a small independent chance
// to regrow into an entry-tier resource so the world never strip-mines bare.
// Called every 500 player steps.
//   - Considers tiles within an 8-tile box of the player so off-screen worlds
//     don't churn (and unloaded chunks are simply skipped).
//   - Spread: only mature (Maple/Elder, or Copper+) tiles are fertile.
//     10% chance per fertile tile, then a single random adjacent grass cell
//     (plain OR harvested, no road/building) becomes a brand-new Oak / Stone.
//   - Regrowth: every harvested grass tile rolls 4% per pass to spontaneously
//     grow back as an Oak (or Stone if its neighbors are mostly rocky).
function spreadResources(state: OverworldState, centerX: number, centerY: number): void {
  const RANGE = 8;
  const SPREAD_CHANCE = 0.10;
  const REGROW_CHANCE = 0.04;
  const seedBase = state.totalSteps * 31;

  // Pass 1: harvested-tile regrowth (independent of mature neighbors)
  for (let dy = -RANGE; dy <= RANGE; dy++) {
    for (let dx = -RANGE; dx <= RANGE; dx++) {
      const wx = centerX + dx;
      const wy = centerY + dy;
      const tile = getOverworldTile(state, wx, wy);
      if (!tile || tile.type !== 'grass' || !tile.harvested) continue;
      if (state.roads?.[`${wx},${wy}`]) continue;
      if (wx === state.playerPosition.x && wy === state.playerPosition.y) continue;

      const roll = seededRandom(seedBase + wx * 197 + wy * 311 + 5);
      if (roll > REGROW_CHANCE) continue;

      // Decide tree vs rock based on what type was harvested last (stored in
      // tile.lastHarvestType if present), else weighted toward trees on grass.
      const wantsRock = tile.lastHarvestType === 'rock'
        || (!tile.lastHarvestType && seededRandom(seedBase + wx * 41 + wy * 67) < 0.25);

      if (wantsRock) {
        const newTier: StoneTier = 'stone';
        setOverworldTile(state, wx, wy, {
          ...tile,
          type: 'rock',
          stoneTier: newTier,
          resourceAmount: STONE_TIER_DATA[newTier].totalHits,
          harvested: false,
        });
        if (STONE_TIER_DATA[newTier].upgradeSteps) {
          state.resourceUpgrades[`${wx},${wy}`] = {
            stoneTier: newTier,
            stepsUntilUpgrade: jitterUpgradeSteps(STONE_TIER_DATA[newTier].upgradeSteps!, wx, wy, state.totalSteps),
          };
        }
      } else {
        const newTier: TreeTier = 'oak';
        setOverworldTile(state, wx, wy, {
          ...tile,
          type: 'tree',
          treeTier: newTier,
          resourceAmount: TREE_TIER_DATA[newTier].totalHits,
          harvested: false,
        });
        if (TREE_TIER_DATA[newTier].upgradeSteps) {
          state.resourceUpgrades[`${wx},${wy}`] = {
            treeTier: newTier,
            stepsUntilUpgrade: jitterUpgradeSteps(TREE_TIER_DATA[newTier].upgradeSteps!, wx, wy, state.totalSteps),
          };
        }
      }
    }
  }

  // Pass 2: mature-tile spread to adjacent grass
  for (let dy = -RANGE; dy <= RANGE; dy++) {
    for (let dx = -RANGE; dx <= RANGE; dx++) {
      const wx = centerX + dx;
      const wy = centerY + dy;
      const tile = getOverworldTile(state, wx, wy);
      if (!tile) continue;

      const isFertileTree = tile.type === 'tree' && tile.treeTier && tile.treeTier !== 'oak';
      const isFertileRock = tile.type === 'rock' && tile.stoneTier && tile.stoneTier !== 'stone';
      if (!isFertileTree && !isFertileRock) continue;

      const roll = seededRandom(seedBase + wx * 73 + wy * 131);
      if (roll > SPREAD_CHANCE) continue;

      // Pick one of the 4 cardinal neighbors that is grass and free.
      const dirs: Array<[number, number]> = [[0, -1], [1, 0], [0, 1], [-1, 0]];
      const pick = Math.floor(seededRandom(seedBase + wx * 17 + wy * 53 + 7) * 4);
      for (let i = 0; i < 4; i++) {
        const [ddx, ddy] = dirs[(pick + i) % 4];
        const nx = wx + ddx;
        const ny = wy + ddy;
        const nTile = getOverworldTile(state, nx, ny);
        if (!nTile) continue;
        // Allow seeding onto plain OR harvested grass (regrowing the dirt patch).
        if (nTile.type !== 'grass') continue;
        if (state.roads?.[`${nx},${ny}`]) continue;
        if (nx === state.playerPosition.x && ny === state.playerPosition.y) continue;

        if (isFertileTree) {
          const newTier: TreeTier = 'oak';
          setOverworldTile(state, nx, ny, {
            ...nTile,
            type: 'tree',
            treeTier: newTier,
            resourceAmount: TREE_TIER_DATA[newTier].totalHits,
            harvested: false,
          });
          if (TREE_TIER_DATA[newTier].upgradeSteps) {
            state.resourceUpgrades[`${nx},${ny}`] = {
              treeTier: newTier,
              stepsUntilUpgrade: jitterUpgradeSteps(TREE_TIER_DATA[newTier].upgradeSteps!, nx, ny, state.totalSteps),
            };
          }
        } else if (isFertileRock) {
          const newTier: StoneTier = 'stone';
          setOverworldTile(state, nx, ny, {
            ...nTile,
            type: 'rock',
            stoneTier: newTier,
            resourceAmount: STONE_TIER_DATA[newTier].totalHits,
            harvested: false,
          });
          if (STONE_TIER_DATA[newTier].upgradeSteps) {
            state.resourceUpgrades[`${nx},${ny}`] = {
              stoneTier: newTier,
              stepsUntilUpgrade: jitterUpgradeSteps(STONE_TIER_DATA[newTier].upgradeSteps!, nx, ny, state.totalSteps),
            };
          }
        }
        break; // Spread to at most one neighbor per fertile tile per tick.
      }
    }
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

  // ─── Z-transition gate ───
  // The player can only change elevation at known connectors (ramps, stairs,
  // ladders) or by walking laterally at the same z. Drops/climbs anywhere
  // else are blocked. We check this BEFORE the per-tile-type switch so the
  // existing per-type logic doesn't have to repeat the rule.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const __wt = require('./wallTop') as typeof import('./wallTop');
  const fromTile = getOverworldTile(state, state.playerPosition.x, state.playerPosition.y);
  const fromZ = state.playerPosition.z ?? __wt.getTileEffectiveZ(state, state.playerPosition.x, state.playerPosition.y, fromTile);
  const toZ = __wt.getTileEffectiveZ(state, newX, newY, tile);
  if (fromZ !== toZ) {
    // Allowed if EITHER tile is a connector that bridges the two z values,
    // OR either tile is a ramp (natural cliff connector) at the right z.
    const fromIsConnector = !!fromTile && fromTile.type === 'player_building'
      && __wt.isElevationConnectorAt(state, state.playerPosition.x, state.playerPosition.y);
    const toIsConnector = tile.type === 'player_building'
      && __wt.isElevationConnectorAt(state, newX, newY);
    const fromIsRamp = !!fromTile?.isRamp;
    const toIsRamp = !!tile.isRamp;
    if (!fromIsConnector && !toIsConnector && !fromIsRamp && !toIsRamp) {
      if (toZ > fromZ) return { type: 'blocked', reason: 'You need stairs or a ladder to climb up here' };
      return { type: 'blocked', reason: 'Too far to drop down — find stairs or a ladder' };
    }
  }

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

  // Slow forest/outcrop spread: every 500 steps, mature trees & rocks within
  // sight have a 10% chance to seed an adjacent grass tile. Keeps groves
  // growing organically without overrunning the map.
  if (state.totalSteps % 500 === 0) {
    spreadResources(state, newX, newY);
  }
  
  // Check if destination is a road
  const roadKey = `${newX},${newY}`;
  const isRoad = state.roads && state.roads[roadKey];
  
  switch (tile.type) {
    case 'water':
      return { type: 'blocked', reason: 'Water blocks your path' };

    case 'cliff':
      return { type: 'blocked', reason: 'A sheer cliff face blocks your path' };

    case 'waterfall':
      return { type: 'blocked', reason: 'A waterfall crashes down — no way through' };
      
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
        tile.lastHarvestType = 'tree';
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
        tile.lastHarvestType = 'rock';
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
      // Stale enemy tile (enemy was removed but tile not cleared) — self-heal and walk through.
      setOverworldTile(state, newX, newY, { ...tile, type: 'grass', enemyId: undefined });
      state.playerPosition = { x: newX, y: newY };
      updateVisibility(state);
      return { type: 'moved' };
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
        // Walls acting as gates are passable for the player (but not for enemies — see overworldCombat).
        // Walls that form a walkable wall-top are passable IF the player is
        // already on the same wall-top (z+1) — otherwise blocked.
        const isGate = isWallActingAsGate(building, state);
        if (!isGate) {
          // Lazy import to avoid a circular dep at module load.
          // (overworld → wallTop → overworld would loop.)
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { isWalkableWallTop, getTileEffectiveZ } = require('./wallTop') as typeof import('./wallTop');
          const fromTile = getOverworldTile(state, state.playerPosition.x, state.playerPosition.y);
          const fromZ = getTileEffectiveZ(state, state.playerPosition.x, state.playerPosition.y, fromTile);
          const targetIsWalkableTop = isWalkableWallTop(state, newX, newY);
          const targetGroundZ = tile.elevation ?? 0;
          const targetTopZ = targetGroundZ + 1;
          if (!(targetIsWalkableTop && fromZ === targetTopZ)) {
            return { type: 'blocked', reason: 'A wall blocks your path' };
          }
        }
      }
      // Connector / surrounded-building / wall-top step:
      // Update player's z based on where they end up.
      state.playerPosition = { x: newX, y: newY };
      // Refresh z derived from new tile.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { getTileEffectiveZ: gtez } = require('./wallTop') as typeof import('./wallTop');
      state.playerPosition.z = gtez(state, newX, newY, tile);
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
  const creative = isCreativeMode();
  if (!creative) {
    if (state.woodCollected < def.cost.wood) return { canPlace: false, reason: `Need ${def.cost.wood} wood` };
    if (state.stoneCollected < def.cost.stone) return { canPlace: false, reason: `Need ${def.cost.stone} stone` };
  }

  const key = `${worldX},${worldY}`;
  if (state.roads[key]) return { canPlace: false, reason: 'Road already exists here' };

  const tile = getOverworldTile(state, worldX, worldY);
  if (!tile) return { canPlace: false, reason: 'Invalid location' };

  // Cliffs/waterfalls reject all roads.
  if (tile.type === 'cliff')     return { canPlace: false, reason: 'Cannot lay a road on a cliff face' };
  if (tile.type === 'waterfall') return { canPlace: false, reason: 'Cannot lay a road on a waterfall' };

  // Ramps accept ONLY stone roads — they become "stairs" matching the road
  // aesthetic. Dirt roads on a slope wouldn't make sense.
  if (tile.isRamp) {
    if (roadType !== 'stone_road') {
      return { canPlace: false, reason: 'Ramps only accept stone-road stairs' };
    }
    return { canPlace: true };
  }

  if (tile.type !== 'grass') {
    return { canPlace: false, reason: 'Can only place roads on open ground' };
  }

  return { canPlace: true };
}

export function placeRoad(state: OverworldState, worldX: number, worldY: number, roadType: RoadType): boolean {
  const check = canPlaceRoad(state, worldX, worldY, roadType);
  if (!check.canPlace) return false;

  const def = ROAD_DEFINITIONS[roadType];
  if (!isCreativeMode()) {
    state.woodCollected -= def.cost.wood;
    state.stoneCollected -= def.cost.stone;
  }

  const key = `${worldX},${worldY}`;
  if (!state.roads) state.roads = {};
  state.roads[key] = roadType;

  // Stair-on-ramp: keep the ramp tile (renders as ramp+stairs), don't
  // overwrite the elevation metadata.
  const existing = getOverworldTile(state, worldX, worldY);
  if (existing?.isRamp) {
    setOverworldTile(state, worldX, worldY, {
      ...existing,
      hasStairs: true,
      explored: true,
      visible: true,
    });
    return true;
  }

  // Update the tile type so the renderer picks it up
  setOverworldTile(state, worldX, worldY, {
    type: roadType,
    explored: true,
    visible: true,
  });

  return true;
}

// Refund for disassembling a road (50% of original cost, rounded down, min 0)
export function getRoadRefund(roadType: RoadType): { wood: number; stone: number } {
  const cost = ROAD_DEFINITIONS[roadType].cost;
  return {
    wood: Math.floor(cost.wood * 0.5),
    stone: Math.floor(cost.stone * 0.5),
  };
}

// Remove a road tile, refunding partial materials and restoring grass.
export function removeRoad(state: OverworldState, worldX: number, worldY: number): boolean {
  const key = `${worldX},${worldY}`;
  const roadType = state.roads?.[key];
  if (!roadType) return false;

  const refund = getRoadRefund(roadType);
  state.woodCollected += refund.wood;
  state.stoneCollected += refund.stone;

  delete state.roads[key];

  // Restore the underlying tile to grass (harvested, since it was cleared to build).
  setOverworldTile(state, worldX, worldY, {
    type: 'grass',
    explored: true,
    visible: true,
    harvested: true,
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

// ============= SAVE / LOAD SLIMMING =============
// Chunks contain mostly regenerable data (terrain types, enemies). Storing
// every explored chunk in localStorage blows past the ~5MB quota and silently
// drops the entire save — including player buildings. We strip chunks before
// save and regenerate them on load. Anything the player can modify
// (water-fills, harvested grass, depleted resources, fog of war) is captured
// in `tileOverrides` so it survives the round-trip.

const CHUNK_SIZE_LOCAL = CHUNK_SIZE;

// Compute the "default" tile a generator would have produced at (worldX, worldY).
// We then compare against the live chunk tile and persist a delta if they differ.
// To keep the helper simple and side-effect free, we re-run the same chunk
// generator in a throwaway state for that single chunk.
function generateChunkTilesForCompare(
  cx: number, cy: number,
  dungeonEntrances: Record<string, DungeonEntrance>,
  nests: Record<string, NestState>,
  resourceUpgrades: Record<string, ResourceUpgradeState>,
): OverworldTile[][] {
  const difficulty = getDifficulty(cx * CHUNK_SIZE_LOCAL, cy * CHUNK_SIZE_LOCAL);
  // Pass *copies* of the records so the comparison run doesn't mutate live state.
  const fakeEntrances = { ...dungeonEntrances };
  const fakeNests = { ...nests };
  const fakeUpgrades = { ...resourceUpgrades };
  const chunk = generateChunk(cx, cy, difficulty, fakeEntrances, fakeNests, fakeUpgrades);
  return chunk.tiles;
}

function tilesDiffer(a: OverworldTile, b: OverworldTile): boolean {
  if (a.type !== b.type) return true;
  if ((a.harvested ?? false) !== (b.harvested ?? false)) return true;
  if ((a.resourceAmount ?? -1) !== (b.resourceAmount ?? -1)) return true;
  if ((a.treeTier ?? '') !== (b.treeTier ?? '')) return true;
  if ((a.stoneTier ?? '') !== (b.stoneTier ?? '')) return true;
  if ((a.playerBuildingId ?? '') !== (b.playerBuildingId ?? '')) return true;
  if ((a.dungeonId ?? '') !== (b.dungeonId ?? '')) return true;
  if ((a.nestId ?? '') !== (b.nestId ?? '')) return true;
  if ((a.buildingType ?? '') !== (b.buildingType ?? '')) return true;
  // We track explored separately so we don't blow up override count on every step.
  return false;
}

// Strip chunks from the overworld state for compact serialization.
// Returns a NEW object — does not mutate input. Captures the bare minimum
// (tileOverrides + explored set) needed to faithfully restore on load.
export function slimOverworldForSave(state: OverworldState): OverworldState {
  const overrides: Record<string, OverworldTile> = {};
  const explored: string[] = [];

  for (const [chunkKey, chunk] of Object.entries(state.chunks)) {
    const [cxStr, cyStr] = chunkKey.split(',');
    const cx = parseInt(cxStr);
    const cy = parseInt(cyStr);
    const defaults = generateChunkTilesForCompare(cx, cy, state.dungeonEntrances || {}, state.nests || {}, state.resourceUpgrades || {});

    for (let y = 0; y < CHUNK_SIZE_LOCAL; y++) {
      for (let x = 0; x < CHUNK_SIZE_LOCAL; x++) {
        const tile = chunk.tiles[y]?.[x];
        if (!tile) continue;
        const worldX = cx * CHUNK_SIZE_LOCAL + x;
        const worldY = cy * CHUNK_SIZE_LOCAL + y;
        const key = `${worldX},${worldY}`;
        if (tile.explored) explored.push(key);
        const def = defaults[y]?.[x];
        if (!def || tilesDiffer(tile, def)) {
          // Strip transient `visible` flag (recomputed on load via updateVisibility).
          const { visible, ...rest } = tile;
          overrides[key] = { ...rest, visible: false };
        }
      }
    }
  }

  return {
    ...state,
    chunks: {}, // Stripped — regenerated on load
    tileOverrides: { ...(state.tileOverrides || {}), ...overrides },
    // Stash the explored set inside tileOverrides via a sentinel key so we
    // don't need to widen the SaveData type. We use an unlikely coord string.
    // Stored separately as __explored to keep restore logic clean.
    ...(explored.length > 0 ? { __exploredTiles: explored } as any : {}),
  } as OverworldState;
}

// Re-hydrate an overworld state coming out of slimOverworldForSave.
// Generates chunks around the player, applies tile overrides, and re-marks
// explored tiles. Safe to call on any state (no-op if chunks already exist).
export function expandOverworldFromSave(state: OverworldState): OverworldState {
  // Make sure base maps exist.
  if (!state.chunks) state.chunks = {};
  if (!state.dungeonEntrances) state.dungeonEntrances = {};
  if (!state.playerBuildings) state.playerBuildings = [];
  if (!state.nests) state.nests = {};
  if (!state.roads) state.roads = {};
  if (!state.resourceUpgrades) state.resourceUpgrades = {};

  // Generate the chunk around the player so getOverworldTile/setOverworldTile work.
  ensureChunksLoaded(state, state.playerPosition.x, state.playerPosition.y);

  // Apply per-tile overrides — but only for chunks that are loaded. Overrides
  // for unloaded chunks stay in the map and will apply when those chunks load.
  const overrides = state.tileOverrides || {};
  for (const [coord, tile] of Object.entries(overrides)) {
    const [xStr, yStr] = coord.split(',');
    const wx = parseInt(xStr);
    const wy = parseInt(yStr);
    const cx = Math.floor(wx / CHUNK_SIZE_LOCAL);
    const cy = Math.floor(wy / CHUNK_SIZE_LOCAL);
    if (state.chunks[`${cx},${cy}`]) {
      setOverworldTile(state, wx, wy, { ...tile });
    }
  }

  // Restore explored flags
  const explored = (state as any).__exploredTiles as string[] | undefined;
  if (Array.isArray(explored)) {
    for (const key of explored) {
      const [xStr, yStr] = key.split(',');
      const wx = parseInt(xStr);
      const wy = parseInt(yStr);
      const cx = Math.floor(wx / CHUNK_SIZE_LOCAL);
      const cy = Math.floor(wy / CHUNK_SIZE_LOCAL);
      if (state.chunks[`${cx},${cy}`]) {
        const tile = getOverworldTile(state, wx, wy);
        if (tile) tile.explored = true;
      }
    }
  }

  return state;
}
