// Streaming-style dungeon expansion. When the player approaches an edge of the
// current dungeon grid, this module appends a fresh strip of procedural content
// to that side so the world feels endless. Width / height grow over time and
// any code that already uses `dungeon.width` / `dungeon.height` keeps working
// because the existing tile array is simply extended.
//
// We are not paging chunks in / out — we just keep the dungeon growing. There
// is NO width/length cap: floors stream new strips forever as the player
// approaches any edge.
//
// Seeded: strip content is generated with a mulberry32 RNG derived from
// (dungeon.seed, floor, side, current dimension) so the streamed world is
// reproducible for a given tower seed.

import { DungeonState, DungeonTile, Position, Monster, SpeciesType } from './types';
import { generateRandomMonster } from './utils';
import { generateLoot, updateVisibility } from './dungeon';
import { getRandomTerrainType } from './terrain';
import { MineableWallTier } from './tools';
import { mulberry32, withSeededRandom } from './autobattle/seeded';

const EDGE_TRIGGER = 4;       // Expand when player is within this many tiles of an edge.
const STRIP_WIDTH = 12;       // How many new tiles to append per expansion event.

// Deterministic RNG for one expansion event. Mixes the tower seed, floor,
// which side grew, and how big the grid already was (so repeated strips on
// the same side differ).
function stripRng(dungeon: DungeonState, side: Side, dim: number): () => number {
  const sideCode = side === 'north' ? 1 : side === 'south' ? 2 : side === 'west' ? 3 : 4;
  const base = typeof dungeon.seed === 'number' ? dungeon.seed >>> 0 : 0x51f15e;
  const mixed = base
    ^ Math.imul((dungeon.floor + 1) >>> 0, 0x9e3779b1)
    ^ Math.imul(sideCode, 0x85ebca6b)
    ^ Math.imul(dim >>> 0, 0xc2b2ae35);
  return mulberry32(mixed >>> 0);
}

type Side = 'north' | 'south' | 'east' | 'west';

function blankTile(): DungeonTile {
  return { type: 'wall', explored: false, visible: false };
}

function makeStripRow(width: number): DungeonTile[] {
  return Array.from({ length: width }, blankTile);
}

// Carve a small room into a freshly added strip and decorate it with floor +
// optional features. We connect every carved room to the existing dungeon by
// punching a 1-tile wide tunnel back into the seam.
function carveStripContent(
  tiles: DungeonTile[][],
  side: Side,
  floor: number,
  newEnemies: Monster[],
  availableSpecies: SpeciesType[],
  theme: DungeonState['theme'],
) {
  const H = tiles.length;
  const W = tiles[0].length;

  // Determine the rectangular region we just appended.
  let rx0: number, ry0: number, rx1: number, ry1: number;
  if (side === 'north') { rx0 = 0; rx1 = W - 1; ry0 = 0; ry1 = STRIP_WIDTH - 1; }
  else if (side === 'south') { rx0 = 0; rx1 = W - 1; ry0 = H - STRIP_WIDTH; ry1 = H - 1; }
  else if (side === 'west') { rx0 = 0; rx1 = STRIP_WIDTH - 1; ry0 = 0; ry1 = H - 1; }
  else { rx0 = W - STRIP_WIDTH; rx1 = W - 1; ry0 = 0; ry1 = H - 1; }

  const stripIsHorizontal = side === 'north' || side === 'south';
  const stripLong = stripIsHorizontal ? (rx1 - rx0 + 1) : (ry1 - ry0 + 1);

  // Plant 2-3 small rooms inside the strip.
  const roomCount = 2 + Math.floor(Math.random() * 2);
  const rooms: { x: number; y: number; w: number; h: number }[] = [];
  for (let i = 0; i < roomCount * 4 && rooms.length < roomCount; i++) {
    const w = 3 + Math.floor(Math.random() * 4);
    const h = 3 + Math.floor(Math.random() * 3);
    const x = rx0 + 1 + Math.floor(Math.random() * Math.max(1, (rx1 - rx0 - w)));
    const y = ry0 + 1 + Math.floor(Math.random() * Math.max(1, (ry1 - ry0 - h)));
    if (x + w > W - 1 || y + h > H - 1) continue;
    rooms.push({ x, y, w, h });
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        tiles[yy][xx] = { type: 'floor', explored: false, visible: false };
      }
    }
  }

  // Connect rooms to each other with simple L-corridors.
  for (let i = 1; i < rooms.length; i++) {
    const a = rooms[i - 1];
    const b = rooms[i];
    const ax = a.x + Math.floor(a.w / 2);
    const ay = a.y + Math.floor(a.h / 2);
    const bx = b.x + Math.floor(b.w / 2);
    const by = b.y + Math.floor(b.h / 2);
    for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) {
      tiles[ay][x] = { type: 'floor', explored: false, visible: false };
    }
    for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++) {
      tiles[y][bx] = { type: 'floor', explored: false, visible: false };
    }
  }

  // Punch a tunnel from the strip into the existing dungeon along the seam so
  // the new area is reachable. We aim at any floor tile along the seam edge.
  if (rooms.length > 0) {
    const seedRoom = rooms[Math.floor(Math.random() * rooms.length)];
    const seedX = seedRoom.x + Math.floor(seedRoom.w / 2);
    const seedY = seedRoom.y + Math.floor(seedRoom.h / 2);

    if (side === 'north') {
      // Tunnel from seedY down to row STRIP_WIDTH (the seam), in column seedX.
      for (let y = seedY; y <= STRIP_WIDTH; y++) {
        if (tiles[y]?.[seedX]) tiles[y][seedX] = { type: 'floor', explored: false, visible: false };
      }
      // And one tile into the existing dungeon to ensure connection.
      if (tiles[STRIP_WIDTH + 1]?.[seedX]) tiles[STRIP_WIDTH + 1][seedX] = { type: 'floor', explored: false, visible: false };
    } else if (side === 'south') {
      const seam = H - STRIP_WIDTH - 1;
      for (let y = seam; y <= seedY; y++) {
        if (tiles[y]?.[seedX]) tiles[y][seedX] = { type: 'floor', explored: false, visible: false };
      }
    } else if (side === 'west') {
      for (let x = seedX; x <= STRIP_WIDTH; x++) {
        if (tiles[seedY]?.[x]) tiles[seedY][x] = { type: 'floor', explored: false, visible: false };
      }
      if (tiles[seedY]?.[STRIP_WIDTH + 1]) tiles[seedY][STRIP_WIDTH + 1] = { type: 'floor', explored: false, visible: false };
    } else {
      const seam = W - STRIP_WIDTH - 1;
      for (let x = seam; x <= seedX; x++) {
        if (tiles[seedY]?.[x]) tiles[seedY][x] = { type: 'floor', explored: false, visible: false };
      }
    }
  }

  // Convert remaining wall tiles in the strip into mineable walls (matches the
  // base generator's "no permanent dead-ends" feel) with tier varying by depth.
  for (let y = ry0; y <= ry1; y++) {
    for (let x = rx0; x <= rx1; x++) {
      if (tiles[y][x].type !== 'wall') continue;
      // Tiles touching a floor become Cavestone; deeper pockets get harder.
      let touchesFloor = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
        if (tiles[ny][nx].type === 'floor') { touchesFloor = true; break; }
      }
      const tier: MineableWallTier = touchesFloor ? 1 : (Math.random() < 0.5 ? 2 : 3);
      tiles[y][x] = {
        type: 'mineable_wall',
        explored: false,
        visible: false,
        wallTier: tier,
        wallHits: 0,
      };
    }
  }

  // Sprinkle a couple of enemies + treasures + terrain so new strips feel
  // alive but don't overwhelm the player.
  for (const room of rooms) {
    if (Math.random() < 0.7) {
      const ex = room.x + Math.floor(Math.random() * room.w);
      const ey = room.y + Math.floor(Math.random() * room.h);
      if (tiles[ey]?.[ex]?.type === 'floor') {
        const enemy = generateRandomMonster(availableSpecies, floor, theme);
        tiles[ey][ex] = { type: 'enemy', explored: false, visible: false, enemyId: enemy.id };
        newEnemies.push(enemy);
      }
    }
    if (Math.random() < 0.5) {
      const tx = room.x + Math.floor(Math.random() * room.w);
      const ty = room.y + Math.floor(Math.random() * room.h);
      if (tiles[ty]?.[tx]?.type === 'floor') {
        const loot = generateLoot(floor);
        tiles[ty][tx] = {
          type: 'treasure',
          explored: false,
          visible: false,
          lootId: loot.id,
          lootData: loot,
        };
      }
    }
    if (Math.random() < 0.35 && room.w >= 4 && room.h >= 4) {
      const tx = room.x + 1 + Math.floor(Math.random() * (room.w - 2));
      const ty = room.y + 1 + Math.floor(Math.random() * (room.h - 2));
      if (tiles[ty]?.[tx]?.type === 'floor') {
        tiles[ty][tx] = {
          type: 'terrain',
          explored: false,
          visible: false,
          terrainType: getRandomTerrainType(),
        };
      }
    }
  }

  void stripLong;
}

function getAvailableSpeciesForFloor(floor: number): SpeciesType[] {
  const allSpecies: SpeciesType[] = [
    'slime', 'rat', 'beetle', 'frog',
    'goblin', 'spider', 'bat', 'mushroom',
    'snake', 'skeleton', 'crow', 'imp',
    'wolf', 'ghost', 'wisp', 'jellyfish',
    'golem', 'shark', 'chimera', 'dragon',
  ];
  const speciesPerFloor = 4;
  const maxIndex = Math.min(allSpecies.length, speciesPerFloor * Math.ceil(floor));
  return allSpecies.slice(0, maxIndex);
}

// Returns the dungeon state with extra strips appended on whichever sides the
// player is currently close to. May expand multiple sides in one call. The
// player's coordinates are shifted whenever we prepend rows / columns.
export function expandDungeonIfNeeded(dungeon: DungeonState): DungeonState {
  let { tiles, playerPosition, width, height, enemies } = dungeon;
  let entryPosition = dungeon.entryPosition ? { ...dungeon.entryPosition } : undefined;
  let compassWaypoint = dungeon.compassWaypoint ? { ...dungeon.compassWaypoint } : undefined;
  let compassWaypoints = dungeon.compassWaypoints ? dungeon.compassWaypoints.map(p => ({ ...p })) : undefined;
  const newEnemies = [...enemies];

  const theme = dungeon.theme;
  const availableSpecies = theme?.kind === 'species' && theme.value
    ? [theme.value as SpeciesType]
    : getAvailableSpeciesForFloor(dungeon.floor);

  let mutated = false;

  // West (prepend columns) — player x close to 0.
  if (playerPosition.x <= EDGE_TRIGGER) {
    const newTiles: DungeonTile[][] = tiles.map(row => {
      const prefix = Array.from({ length: STRIP_WIDTH }, blankTile);
      return [...prefix, ...row];
    });
    width += STRIP_WIDTH;
    playerPosition = { ...playerPosition, x: playerPosition.x + STRIP_WIDTH };
    if (entryPosition) entryPosition = { ...entryPosition, x: entryPosition.x + STRIP_WIDTH };
    if (compassWaypoint) compassWaypoint = { ...compassWaypoint, x: compassWaypoint.x + STRIP_WIDTH };
    if (compassWaypoints) compassWaypoints = compassWaypoints.map(p => ({ ...p, x: p.x + STRIP_WIDTH }));
    withSeededRandom(stripRng(dungeon, 'west', width), () =>
      carveStripContent(newTiles, 'west', dungeon.floor, newEnemies, availableSpecies, theme));
    tiles = newTiles;
    mutated = true;
  }

  // East (append columns) — player x close to width-1.
  if (playerPosition.x >= width - 1 - EDGE_TRIGGER) {
    const newTiles: DungeonTile[][] = tiles.map(row => {
      const suffix = Array.from({ length: STRIP_WIDTH }, blankTile);
      return [...row, ...suffix];
    });
    width += STRIP_WIDTH;
    withSeededRandom(stripRng(dungeon, 'east', width), () =>
      carveStripContent(newTiles, 'east', dungeon.floor, newEnemies, availableSpecies, theme));
    tiles = newTiles;
    mutated = true;
  }

  // North (prepend rows) — player y close to 0.
  if (playerPosition.y <= EDGE_TRIGGER) {
    const prefixRows: DungeonTile[][] = Array.from({ length: STRIP_WIDTH }, () => makeStripRow(width));
    const newTiles = [...prefixRows, ...tiles];
    height += STRIP_WIDTH;
    playerPosition = { ...playerPosition, y: playerPosition.y + STRIP_WIDTH };
    if (entryPosition) entryPosition = { ...entryPosition, y: entryPosition.y + STRIP_WIDTH };
    if (compassWaypoint) compassWaypoint = { ...compassWaypoint, y: compassWaypoint.y + STRIP_WIDTH };
    if (compassWaypoints) compassWaypoints = compassWaypoints.map(p => ({ ...p, y: p.y + STRIP_WIDTH }));
    withSeededRandom(stripRng(dungeon, 'north', height), () =>
      carveStripContent(newTiles, 'north', dungeon.floor, newEnemies, availableSpecies, theme));
    tiles = newTiles;
    mutated = true;
  }

  // South (append rows) — player y close to height-1.
  if (playerPosition.y >= height - 1 - EDGE_TRIGGER) {
    const suffixRows: DungeonTile[][] = Array.from({ length: STRIP_WIDTH }, () => makeStripRow(width));
    const newTiles = [...tiles, ...suffixRows];
    height += STRIP_WIDTH;
    withSeededRandom(stripRng(dungeon, 'south', height), () =>
      carveStripContent(newTiles, 'south', dungeon.floor, newEnemies, availableSpecies, theme));
    tiles = newTiles;
    mutated = true;
  }

  if (!mutated) return dungeon;

  // Recompute visibility on the freshly-expanded grid so newly-carved tiles
  // within the player's sight range light up immediately rather than waiting
  // for the next step.
  updateVisibility(tiles, playerPosition);

  return {
    ...dungeon,
    tiles,
    width,
    height,
    playerPosition,
    enemies: newEnemies,
    entryPosition,
    compassWaypoint,
    compassWaypoints,
  };
}

// Find the stairs tile in the current dungeon. Returns null if none exists
// (e.g. they were mined over). Used by the Dungeon Compass item.
export function findStairsPosition(dungeon: DungeonState): Position | null {
  for (let y = 0; y < dungeon.tiles.length; y++) {
    const row = dungeon.tiles[y];
    for (let x = 0; x < row.length; x++) {
      if (row[x].type === 'stairs') return { x, y };
    }
  }
  return null;
}
