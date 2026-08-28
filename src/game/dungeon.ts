// Dungeon generation and management

import { DungeonState, DungeonTile, Position, Monster, SpeciesType, TrapType, PlantType, DungeonTheme, ElementType } from './types';
import { generateRandomMonster } from './utils';
import { generateEquipment, generateMaterialDrop, CraftingMaterial, EquipmentItem } from './equipment';
import { getRandomTerrainType, TerrainType } from './terrain';
import { getWallTierForFloor, MineableWallTier, hitsToBreak, rollWallDrop, PickaxeTier, MINEABLE_WALL_TIERS } from './tools';
import { NestState } from './nests';
import { mulberry32, withSeededRandom } from './autobattle/seeded';

// Larger dungeons with scrolling viewport
const DUNGEON_WIDTH = 30;
const DUNGEON_HEIGHT = 25;

// Create a dungeon nest, themed by element if the dungeon theme is elemental.
function createDungeonNest(floor: number, theme?: DungeonTheme): NestState {
  const themeElement = theme?.kind === 'element' && theme.value
    ? (theme.value as ElementType)
    : undefined;
  const elements: ElementType[] = ['fire','water','earth','air','void','normal'];
  const element = themeElement || elements[Math.floor(Math.random() * elements.length)];
  const level = Math.max(1, floor);
  const baseHp = 30 + level * 15;
  return {
    id: `dnest_${floor}_${Math.floor(Math.random() * 1e9)}`,
    worldX: 0, worldY: 0,
    element,
    hp: baseHp,
    maxHp: baseHp,
    level,
    spawnCooldown: 12,
    maxSpawnCooldown: Math.max(6, 12 - Math.floor(level / 3)),
    totalSpawned: 0,
    destroyed: false,
  };
}

// Item types for loot
export interface LootItem {
  id: string;
  name: string;
  type: 'potion' | 'equipment' | 'gold' | 'material';
  value: number;
  effect?: string;
  equipmentData?: EquipmentItem;
  materialData?: CraftingMaterial;
}

export const LOOT_TABLE: LootItem[] = [
  { id: 'health_potion', name: 'Health Potion', type: 'potion', value: 30, effect: 'heal_hp' },
  { id: 'stamina_potion', name: 'Stamina Potion', type: 'potion', value: 20, effect: 'heal_stamina' },
  { id: 'antidote', name: 'Antidote', type: 'potion', value: 10, effect: 'cure_poison' },
  { id: 'power_berry', name: 'Power Berry', type: 'potion', value: 25, effect: 'boost_attack' },
  { id: 'gold_coin', name: 'Gold Coins', type: 'gold', value: 15 },
  { id: 'gold_pile', name: 'Gold Pile', type: 'gold', value: 30 },
];

// Generate random loot based on floor (includes equipment and materials)
export function generateLoot(floor: number): LootItem {
  const roll = Math.random();
  
  // 25% chance for equipment
  if (roll < 0.25) {
    const equipment = generateEquipment(undefined, floor);
    return {
      id: equipment.id,
      name: equipment.name,
      type: 'equipment',
      value: Math.floor(equipment.level * 10 * (equipment.rarity === 'common' ? 1 : equipment.rarity === 'uncommon' ? 2 : equipment.rarity === 'rare' ? 4 : equipment.rarity === 'epic' ? 8 : 15)),
      equipmentData: equipment,
    };
  }
  
  // 30% chance for material
  if (roll < 0.55) {
    const material = generateMaterialDrop(floor);
    if (material) {
      return {
        id: `mat_${material.id}_${Date.now()}`,
        name: material.name,
        type: 'material',
        value: material.value,
        materialData: material,
      };
    }
  }
  
  // Otherwise regular loot
  return LOOT_TABLE[Math.floor(Math.random() * LOOT_TABLE.length)];
}

// Simple room-based dungeon generation.
//
// Seeded: when a `seed` is provided (from the DungeonEntrance), the entire
// layout — rooms, enemies, loot, traps, terrain — is deterministic for a
// given (seed, floor) pair via a mulberry32 RNG. With no seed we fall back
// to Math.random() (legacy behavior).
export function generateDungeon(floor: number, theme?: DungeonTheme, startingFloor?: number, seed?: number): DungeonState {
  if (typeof seed !== 'number') return generateDungeonInternal(floor, theme, startingFloor, seed);
  // Mix the floor into the seed so every floor of the same tower differs
  // but remains reproducible.
  const mixed = (seed >>> 0) ^ Math.imul((floor + 1) >>> 0, 0x9e3779b1);
  return withSeededRandom(mulberry32(mixed), () => generateDungeonInternal(floor, theme, startingFloor, seed));
}

function generateDungeonInternal(floor: number, theme?: DungeonTheme, startingFloor?: number, seed?: number): DungeonState {
  // Initialize with walls
  const tiles: DungeonTile[][] = Array(DUNGEON_HEIGHT).fill(null).map(() =>
    Array(DUNGEON_WIDTH).fill(null).map(() => ({
      type: 'wall' as const,
      explored: false,
      visible: false,
    }))
  );

  // Generate rooms
  const rooms: { x: number; y: number; width: number; height: number }[] = [];
  const numRooms = 5 + Math.floor(floor / 2);

  for (let i = 0; i < numRooms * 3; i++) {
    if (rooms.length >= numRooms) break;

    const roomWidth = 3 + Math.floor(Math.random() * 4);
    const roomHeight = 3 + Math.floor(Math.random() * 3);
    const x = 1 + Math.floor(Math.random() * (DUNGEON_WIDTH - roomWidth - 2));
    const y = 1 + Math.floor(Math.random() * (DUNGEON_HEIGHT - roomHeight - 2));

    // Check for overlap
    const overlaps = rooms.some(room => 
      x < room.x + room.width + 1 &&
      x + roomWidth + 1 > room.x &&
      y < room.y + room.height + 1 &&
      y + roomHeight + 1 > room.y
    );

    if (!overlaps) {
      rooms.push({ x, y, width: roomWidth, height: roomHeight });

      // Carve out the room
      for (let ry = y; ry < y + roomHeight; ry++) {
        for (let rx = x; rx < x + roomWidth; rx++) {
          tiles[ry][rx].type = 'floor';
        }
      }
    }
  }

  // Connect rooms with corridors
  for (let i = 1; i < rooms.length; i++) {
    const prevRoom = rooms[i - 1];
    const currRoom = rooms[i];

    const prevCenterX = Math.floor(prevRoom.x + prevRoom.width / 2);
    const prevCenterY = Math.floor(prevRoom.y + prevRoom.height / 2);
    const currCenterX = Math.floor(currRoom.x + currRoom.width / 2);
    const currCenterY = Math.floor(currRoom.y + currRoom.height / 2);

    // Horizontal corridor
    const startX = Math.min(prevCenterX, currCenterX);
    const endX = Math.max(prevCenterX, currCenterX);
    for (let x = startX; x <= endX; x++) {
      tiles[prevCenterY][x].type = 'floor';
    }

    // Vertical corridor
    const startY = Math.min(prevCenterY, currCenterY);
    const endY = Math.max(prevCenterY, currCenterY);
    for (let y = startY; y <= endY; y++) {
      tiles[y][currCenterX].type = 'floor';
    }
  }

  // ===== Mazes-within-mazes wall layer =====
  // Players are NEVER permanently walled in. Bedrock is reserved for tiny
  // structural pillars only; everything else (including the outer border)
  // is mineable, with hardness scaling by distance from the nearest open
  // floor. Close to rooms = Cavestone (soft); middle bands = Deepstone;
  // deep pockets and the outer frame = Coreshard (toughest mineable —
  // slows outward expansion without ever blocking it).

  // BFS distance from any floor tile.
  const dist: number[][] = Array(DUNGEON_HEIGHT).fill(null).map(() =>
    Array(DUNGEON_WIDTH).fill(Infinity)
  );
  const bfsQueue: { x: number; y: number }[] = [];
  for (let y = 0; y < DUNGEON_HEIGHT; y++) {
    for (let x = 0; x < DUNGEON_WIDTH; x++) {
      if (tiles[y][x].type === 'floor') {
        dist[y][x] = 0;
        bfsQueue.push({ x, y });
      }
    }
  }
  while (bfsQueue.length > 0) {
    const { x, y } = bfsQueue.shift()!;
    const d = dist[y][x];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= DUNGEON_WIDTH || ny < 0 || ny >= DUNGEON_HEIGHT) continue;
      if (dist[ny][nx] <= d + 1) continue;
      dist[ny][nx] = d + 1;
      bfsQueue.push({ x: nx, y: ny });
    }
  }

  const pickTier = (d: number, isBorder: boolean): MineableWallTier => {
    if (isBorder) return 3;          // outer frame: always toughest mineable
    if (d <= 1) return 1;            // direct room edge: Cavestone
    if (d <= 3) return Math.random() < 0.7 ? 1 : 2;
    if (d <= 5) return Math.random() < 0.5 ? 2 : 3;
    return 3;                        // deep pockets: Coreshard
  };

  for (let y = 0; y < DUNGEON_HEIGHT; y++) {
    for (let x = 0; x < DUNGEON_WIDTH; x++) {
      if (tiles[y][x].type !== 'wall') continue;
      const isBorder = x === 0 || y === 0 || x === DUNGEON_WIDTH - 1 || y === DUNGEON_HEIGHT - 1;
      const d = dist[y][x];

      // Tiny interior bedrock pillars (~6%) for maze backbone. Never on the
      // border (must stay expandable) and never adjacent to a floor (so a
      // single bedrock tile can't seal off a room).
      if (!isBorder && d > 2 && Math.random() < 0.06) continue;

      const tier = pickTier(d, isBorder);
      tiles[y][x].type = 'mineable_wall';
      tiles[y][x].wallTier = tier;
      tiles[y][x].wallHits = 0;
    }
  }
  // `getWallTierForFloor` is no longer used here but kept exported for tools.
  void getWallTierForFloor;
  if (rooms.length > 0) {
    const lastRoom = rooms[rooms.length - 1];
    const stairsX = lastRoom.x + Math.floor(lastRoom.width / 2);
    const stairsY = lastRoom.y + Math.floor(lastRoom.height / 2);
    tiles[stairsY][stairsX].type = 'stairs';
  }

  // Player starts in first room
  const firstRoom = rooms[0];
  const playerPosition: Position = {
    x: firstRoom.x + Math.floor(firstRoom.width / 2),
    y: firstRoom.y + Math.floor(firstRoom.height / 2),
  };
  tiles[playerPosition.y][playerPosition.x].type = 'player';

  // Generate enemies based on floor
  const numEnemies = 2 + Math.floor(floor / 2);
  const enemies: Monster[] = [];
  
  // Determine which species can appear based on floor (species towers ignore this)
  const availableSpecies: SpeciesType[] = theme?.kind === 'species' && theme.value
    ? [theme.value as SpeciesType]
    : getAvailableSpeciesForFloor(floor);

  for (let i = 0; i < numEnemies; i++) {
    // Find a valid floor tile for enemy
    let placed = false;
    let attempts = 0;
    
    while (!placed && attempts < 100) {
      const roomIndex = 1 + Math.floor(Math.random() * (rooms.length - 1)); // Skip first room
      if (roomIndex >= rooms.length) {
        attempts++;
        continue;
      }
      
      const room = rooms[roomIndex];
      const ex = room.x + Math.floor(Math.random() * room.width);
      const ey = room.y + Math.floor(Math.random() * room.height);

      if (tiles[ey][ex].type === 'floor') {
        const enemy = generateRandomMonster(availableSpecies, floor, theme);
        tiles[ey][ex].type = 'enemy';
        tiles[ey][ex].enemyId = enemy.id;
        enemies.push(enemy);
        placed = true;
      }
      attempts++;
    }
  }

  // Place some treasure
  const numTreasure = 2 + Math.floor(Math.random() * 3) + Math.floor(floor / 2);
  for (let i = 0; i < numTreasure; i++) {
    let placed = false;
    let attempts = 0;
    
    while (!placed && attempts < 50) {
      const room = rooms[Math.floor(Math.random() * rooms.length)];
      const tx = room.x + Math.floor(Math.random() * room.width);
      const ty = room.y + Math.floor(Math.random() * room.height);

      if (tiles[ty][tx].type === 'floor') {
        tiles[ty][tx].type = 'treasure';
        // Generate dynamic loot (includes equipment and materials)
        const loot = generateLoot(floor);
        tiles[ty][tx].lootId = loot.id;
        tiles[ty][tx].lootData = loot;
        placed = true;
      }
      attempts++;
    }
  }

  // Place traps (more on higher floors)
  const numTraps = Math.floor(floor / 2) + Math.floor(Math.random() * 2);
  for (let i = 0; i < numTraps; i++) {
    let placed = false;
    let attempts = 0;
    
    while (!placed && attempts < 50) {
      // Place traps in corridors preferably
      const rx = 1 + Math.floor(Math.random() * (DUNGEON_WIDTH - 2));
      const ry = 1 + Math.floor(Math.random() * (DUNGEON_HEIGHT - 2));

      if (tiles[ry][rx].type === 'floor') {
        tiles[ry][rx].type = 'trap';
        tiles[ry][rx].trapType = ['spike', 'poison', 'alarm'][Math.floor(Math.random() * 3)] as 'spike' | 'poison' | 'alarm';
        placed = true;
      }
      attempts++;
    }
  }

  // Place rune pools. To make pools read as a single body and to keep the
  // floor uncluttered, we restrict each floor to AT MOST 2 distinct rune
  // types and grow each one into a contiguous multi-tile pool via a random
  // flood-fill, instead of scattering many independent single-rune tiles.
  const allRuneTypes: TerrainType[] = [
    'water', 'lava', 'rubble', 'vents', 'shadows',
    'spikes', 'lasers', 'acid', 'tendrils', 'psychic',
  ];
  // 1–2 rune types per floor (lower floors lean toward 1).
  const numRuneTypes = Math.random() < (floor < 3 ? 0.4 : 0.7) ? 2 : 1;
  // Some terrain visuals (rubble, spikes, laser beams) intentionally do not
  // share a continuous pool — they look fine scattered. Others (water, lava,
  // shadows, vents, acid, tendrils, psychic) read best as connected pools.
  const isPoolType = (t: TerrainType) =>
    t === 'water' || t === 'lava' || t === 'shadows' || t === 'vents' ||
    t === 'acid' || t === 'tendrils' || t === 'psychic';
  const chosenTypes: TerrainType[] = [];
  const shuffled = [...allRuneTypes].sort(() => Math.random() - 0.5);
  for (const t of shuffled) {
    if (chosenTypes.length >= numRuneTypes) break;
    chosenTypes.push(t);
  }

  for (const runeType of chosenTypes) {
    // Pick a room (not first/last) with enough room to host a pool.
    let attempts = 0;
    let chosenRoom: typeof rooms[number] | null = null;
    while (!chosenRoom && attempts < 30) {
      const idx = 1 + Math.floor(Math.random() * Math.max(1, rooms.length - 2));
      if (idx >= rooms.length - 1) { attempts++; continue; }
      const room = rooms[idx];
      if (room.width >= 4 && room.height >= 4) chosenRoom = room;
      attempts++;
    }
    if (!chosenRoom) continue;

    // Seed point near the center of the room.
    const sx = chosenRoom.x + 1 + Math.floor(Math.random() * Math.max(1, chosenRoom.width - 2));
    const sy = chosenRoom.y + 1 + Math.floor(Math.random() * Math.max(1, chosenRoom.height - 2));
    if (tiles[sy]?.[sx]?.type !== 'floor') continue;

    // Pool size scales with floor depth. Scattered types stay small.
    const targetSize = isPoolType(runeType)
      ? 4 + Math.floor(Math.random() * 4) + Math.floor(floor / 3) // 4–11 tiles
      : 2 + Math.floor(Math.random() * 2);                         // 2–3 tiles

    // Flood-grow the pool: start from seed, repeatedly pick a random
    // already-placed pool tile and extend into a random orthogonal floor
    // neighbor that's still inside the chosen room.
    const placed: { x: number; y: number }[] = [];
    tiles[sy][sx].type = 'terrain';
    tiles[sy][sx].terrainType = runeType;
    placed.push({ x: sx, y: sy });

    let growAttempts = 0;
    while (placed.length < targetSize && growAttempts < targetSize * 12) {
      growAttempts++;
      const seed = placed[Math.floor(Math.random() * placed.length)];
      const dirs = [[0,-1],[1,0],[0,1],[-1,0]].sort(() => Math.random() - 0.5);
      let extended = false;
      for (const [dx, dy] of dirs) {
        const nx = seed.x + dx;
        const ny = seed.y + dy;
        // Stay inside the chosen room (and 1 tile from its walls).
        if (nx < chosenRoom.x + 1 || nx > chosenRoom.x + chosenRoom.width - 2) continue;
        if (ny < chosenRoom.y + 1 || ny > chosenRoom.y + chosenRoom.height - 2) continue;
        if (tiles[ny]?.[nx]?.type !== 'floor') continue;
        tiles[ny][nx].type = 'terrain';
        tiles[ny][nx].terrainType = runeType;
        placed.push({ x: nx, y: ny });
        extended = true;
        break;
      }
      if (!extended) {
        // Local dead-end — keep trying from another existing tile.
        continue;
      }
    }
  }

  // Silence unused-import warning when nothing else references it.
  void getRandomTerrainType;

  // Place harvestable plants
  const numPlants = 3 + Math.floor(floor / 2) + Math.floor(Math.random() * 3);
  for (let i = 0; i < numPlants; i++) {
    let placed = false;
    let attempts = 0;
    
    while (!placed && attempts < 50) {
      const room = rooms[Math.floor(Math.random() * rooms.length)];
      const px = room.x + Math.floor(Math.random() * room.width);
      const py = room.y + Math.floor(Math.random() * room.height);
      
      if (tiles[py]?.[px]?.type === 'floor') {
        tiles[py][px].type = 'plant';
        tiles[py][px].plantType = getRandomPlantForFloor(floor);
        placed = true;
      }
      attempts++;
    }
  }

  // Place a shop room every 3 floors
  if (floor % 3 === 0 && rooms.length > 2) {
    const shopRoom = rooms[Math.floor(rooms.length / 2)]; // Middle room
    const shopX = shopRoom.x + Math.floor(shopRoom.width / 2);
    const shopY = shopRoom.y + Math.floor(shopRoom.height / 2);
    if (tiles[shopY][shopX].type === 'floor') {
      tiles[shopY][shopX].type = 'shop';
    }
  }
  
  // Place an elevator every 2 floors (different from shop floors for variety)
  if (floor >= 2 && floor % 2 === 0 && rooms.length > 3) {
    // Find a room that's not the start, end, or shop room
    const eligibleRooms = rooms.slice(1, -1).filter((_, i) => i !== Math.floor(rooms.length / 2) - 1);
    if (eligibleRooms.length > 0) {
      const elevatorRoom = eligibleRooms[Math.floor(Math.random() * eligibleRooms.length)];
      const elevatorX = elevatorRoom.x + Math.floor(elevatorRoom.width / 2);
      const elevatorY = elevatorRoom.y + Math.floor(elevatorRoom.height / 2);
      if (tiles[elevatorY][elevatorX].type === 'floor') {
        tiles[elevatorY][elevatorX].type = 'elevator';
      }
    }
  }

  // ===== Monster nests (uncommon, mostly on floors %5 and %10) =====
  // Frequency: floor%10===0 → 80%, floor%5===0 → 40%, otherwise none.
  // 50% of placed nests are biased toward blocking a feature
  // (stairs, shop, elevator, treasure); the other 50% are scattered.
  const nestChance = floor > 0 && floor % 10 === 0
    ? 0.8
    : floor > 0 && floor % 5 === 0
      ? 0.4
      : 0;
  if (nestChance > 0 && Math.random() < nestChance) {
    const numNests = floor % 10 === 0 ? 1 + (Math.random() < 0.4 ? 1 : 0) : 1;

    // Collect feature tiles to potentially block
    const featureTiles: { x: number; y: number }[] = [];
    for (let y = 0; y < DUNGEON_HEIGHT; y++) {
      for (let x = 0; x < DUNGEON_WIDTH; x++) {
        const t = tiles[y][x].type;
        if (t === 'stairs' || t === 'stairs_up' || t === 'shop' || t === 'elevator' || t === 'treasure') {
          featureTiles.push({ x, y });
        }
      }
    }

    for (let n = 0; n < numNests; n++) {
      let placed = false;
      const blocking = Math.random() < 0.5 && featureTiles.length > 0;

      if (blocking) {
        // Try to place adjacent to a random feature tile (cardinal neighbour)
        const feature = featureTiles[Math.floor(Math.random() * featureTiles.length)];
        const dirs = [[0,-1],[1,0],[0,1],[-1,0]].sort(() => Math.random() - 0.5);
        for (const [dx, dy] of dirs) {
          const nx = feature.x + dx, ny = feature.y + dy;
          if (nx < 1 || nx >= DUNGEON_WIDTH - 1 || ny < 1 || ny >= DUNGEON_HEIGHT - 1) continue;
          if (tiles[ny][nx].type !== 'floor') continue;
          // Don't block the player's first room
          if (firstRoom && nx >= firstRoom.x && nx < firstRoom.x + firstRoom.width &&
              ny >= firstRoom.y && ny < firstRoom.y + firstRoom.height) continue;
          tiles[ny][nx].type = 'nest';
          tiles[ny][nx].nestState = createDungeonNest(floor, theme);
          placed = true;
          break;
        }
      }

      if (!placed) {
        // Scatter: random floor tile in any non-first room
        let attempts = 0;
        while (!placed && attempts < 50) {
          const roomIndex = 1 + Math.floor(Math.random() * Math.max(1, rooms.length - 1));
          if (roomIndex >= rooms.length) { attempts++; continue; }
          const room = rooms[roomIndex];
          const nx = room.x + Math.floor(Math.random() * room.width);
          const ny = room.y + Math.floor(Math.random() * room.height);
          if (tiles[ny]?.[nx]?.type === 'floor') {
            tiles[ny][nx].type = 'nest';
            tiles[ny][nx].nestState = createDungeonNest(floor, theme);
            placed = true;
          }
          attempts++;
        }
      }
    }
  }

  // Reveal tiles around player
  updateVisibility(tiles, playerPosition);

  return {
    floor,
    tiles,
    playerPosition,
    enemies,
    width: DUNGEON_WIDTH,
    height: DUNGEON_HEIGHT,
    theme,
    startingFloor,
    seed,
    entryPosition: { ...playerPosition },
  };
}

// Get species that can appear on a given floor
function getAvailableSpeciesForFloor(floor: number): SpeciesType[] {
  const allSpecies: SpeciesType[] = [
    'slime', 'rat', 'beetle', 'frog', // Floor 1+
    'goblin', 'spider', 'bat', 'mushroom', // Floor 2+
    'snake', 'skeleton', 'crow', 'imp', // Floor 3+
    'wolf', 'ghost', 'wisp', 'jellyfish', // Floor 4+
    'golem', 'shark', 'chimera', 'dragon', // Floor 5+
  ];

  const speciesPerFloor = 4;
  const maxIndex = Math.min(allSpecies.length, speciesPerFloor * Math.ceil(floor));
  
  return allSpecies.slice(0, maxIndex);
}

// Get a random plant type based on floor level
function getRandomPlantForFloor(floor: number): PlantType {
  // Plants available by floor
  const commonPlants: PlantType[] = ['healing_herb', 'stamina_root', 'antidote_leaf'];
  const uncommonPlants: PlantType[] = ['mana_blossom', 'fire_pepper', 'ice_mint', 'revive_moss'];
  const rarePlants: PlantType[] = ['golden_ginseng', 'phoenix_flower', 'panacea_petal'];
  const epicPlants: PlantType[] = ['miracle_lotus'];
  
  // Build pool based on floor
  let pool: PlantType[] = [...commonPlants];
  if (floor >= 2) pool = pool.concat(uncommonPlants);
  if (floor >= 4) pool = pool.concat(rarePlants);
  if (floor >= 6) pool = pool.concat(epicPlants);
  
  // Weighted random - common plants more likely
  const weights: number[] = pool.map(p => {
    if (commonPlants.includes(p)) return 50;
    if (uncommonPlants.includes(p)) return 30;
    if (rarePlants.includes(p)) return 15;
    return 5; // epic
  });
  
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * totalWeight;
  
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return pool[i];
  }
  
  return pool[0];
}

// Update visibility around a position
export function updateVisibility(
  tiles: DungeonTile[][],
  position: Position,
  range: number = 3,
  extraSources?: Array<{ x: number; y: number; range: number }>,
): void {
  // Reset visibility
  for (let y = 0; y < tiles.length; y++) {
    for (let x = 0; x < tiles[y].length; x++) {
      tiles[y][x].visible = false;
    }
  }

  const reveal = (cx: number, cy: number, r: number) => {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const ny = cy + dy;
        const nx = cx + dx;
        if (ny >= 0 && ny < tiles.length && nx >= 0 && nx < tiles[0].length) {
          tiles[ny][nx].visible = true;
          tiles[ny][nx].explored = true;
        }
      }
    }
  };

  reveal(position.x, position.y, range);
  if (extraSources) {
    for (const src of extraSources) reveal(src.x, src.y, src.range);
  }
}

// Find the nearest walkable (floor / stairs / etc) tile to (cx, cy) using a
// breadth-first scan. Returns the original position if it's already walkable,
// or null if nothing nearby is reachable. Used by both the entry-prep helper
// and the player-facing "Get Unstuck" action.
export function findNearestWalkableTile(
  tiles: DungeonTile[][],
  cx: number, cy: number,
  maxRadius = 60,
): Position | null {
  const H = tiles.length;
  if (H === 0) return null;
  const W = tiles[0].length;
  const isWalkable = (t: DungeonTile | undefined) => {
    if (!t) return false;
    if (t.type === 'wall' || t.type === 'mineable_wall' || t.type === 'nest') return false;
    return true;
  };
  if (cx >= 0 && cy >= 0 && cx < W && cy < H && isWalkable(tiles[cy][cx])) {
    return { x: cx, y: cy };
  }
  const seen = new Set<string>();
  const queue: Position[] = [{ x: cx, y: cy }];
  seen.add(`${cx},${cy}`);
  let head = 0;
  while (head < queue.length) {
    const { x, y } = queue[head++];
    if (Math.abs(x - cx) + Math.abs(y - cy) > maxRadius) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const key = `${nx},${ny}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (isWalkable(tiles[ny][nx])) return { x: nx, y: ny };
      queue.push({ x: nx, y: ny });
    }
  }
  return null;
}

// Prepare a dungeon for the player to enter / resume on. Ensures the player
// tile marker is set, the player isn't stranded inside a wall (snapshot
// hydration or mining edge cases can leave them on a wall), and the
// visibility radius is refreshed around the player. Idempotent.
export function prepareDungeonForEntry(dungeon: DungeonState): DungeonState {
  if (!dungeon.tiles || dungeon.tiles.length === 0) return dungeon;
  const tiles = dungeon.tiles.map(row => row.map(t => ({ ...t })));
  let { playerPosition } = dungeon;
  const at = tiles[playerPosition.y]?.[playerPosition.x];
  const stuck = !at || at.type === 'wall' || at.type === 'mineable_wall' || at.type === 'nest';
  if (stuck) {
    const safe = findNearestWalkableTile(tiles, playerPosition.x, playerPosition.y);
    if (safe) playerPosition = safe;
  }
  // Clear any stray 'player' tiles that may exist from a stale snapshot.
  for (let y = 0; y < tiles.length; y++) {
    for (let x = 0; x < tiles[y].length; x++) {
      if (tiles[y][x].type === 'player' && (x !== playerPosition.x || y !== playerPosition.y)) {
        if (tiles[y][x].stairsBeneath === 'down') tiles[y][x].type = 'stairs';
        else if (tiles[y][x].stairsBeneath === 'up') tiles[y][x].type = 'stairs_up';
        else if (tiles[y][x].terrainType) tiles[y][x].type = 'terrain';
        else tiles[y][x].type = 'floor';
        tiles[y][x].stairsBeneath = undefined;
      }
    }
  }
  // ─── Purge orphan up-stairs ────────────────────────────────────────────
  // Snapshot rehydration + per-entry stairs-planting can leave stale
  // `stairs_up` tiles that don't correspond to any overworld exit. Keep
  // only the up-stair closest to entryPosition (or the player if entry is
  // unknown); convert every other player-facing up-stair to plain floor.
  // Portal stairs (`tile.portal` set) are always preserved — they're the
  // player's craftable exits and their destinations are validated
  // separately.
  {
    const anchor = dungeon.entryPosition ?? playerPosition;
    let bestX = -1, bestY = -1, bestD = Infinity;
    for (let y = 0; y < tiles.length; y++) {
      for (let x = 0; x < tiles[y].length; x++) {
        const t = tiles[y][x];
        if (t.type !== 'stairs_up' || t.portal) continue;
        const d = Math.abs(x - anchor.x) + Math.abs(y - anchor.y);
        if (d < bestD) { bestD = d; bestX = x; bestY = y; }
      }
    }
    if (bestX >= 0) {
      for (let y = 0; y < tiles.length; y++) {
        for (let x = 0; x < tiles[y].length; x++) {
          const t = tiles[y][x];
          if (t.type !== 'stairs_up' || t.portal) continue;
          if (x === bestX && y === bestY) continue;
          // Preserve the player's current tile — restore its underlying
          // form (stairsBeneath will keep the intended state).
          if (x === playerPosition.x && y === playerPosition.y) continue;
          t.type = 'floor';
          if (t.stairsBeneath === 'up') t.stairsBeneath = undefined;
        }
      }
    }
  }
  // Mark player tile (preserve stairsBeneath / terrainType under it).
  const pTile = tiles[playerPosition.y][playerPosition.x];
  if (pTile.type === 'stairs') { pTile.stairsBeneath = 'down'; }
  else if (pTile.type === 'stairs_up') { pTile.stairsBeneath = 'up'; }
  pTile.type = 'player';
  updateVisibility(tiles, playerPosition, 3, getDungeonTowerVisionSources(dungeon));
  return { ...dungeon, tiles, playerPosition };
}

/**
 * Returns vision sources contributed by player-built scout towers on this floor.
 * Any built scout tower reveals fog around itself — assigning a monster only
 * enables the tower's auto-attack, not its line-of-sight.
 */
export function getDungeonTowerVisionSources(
  dungeon: Pick<DungeonState, 'playerBuildings'> | { playerBuildings?: any[] },
): Array<{ x: number; y: number; range: number }> {
  const buildings = (dungeon as any).playerBuildings as any[] | undefined;
  if (!buildings || buildings.length === 0) return [];
  // SCOUT_TOWER_VISION_RADIUS = 4 (kept inline to avoid circular import)
  const VISION = 4;
  return buildings
    .filter(b => b && b.type === 'scout_tower' && b.built !== false)
    .map(b => ({ x: b.worldX, y: b.worldY, range: VISION }));
}

// Move result with all possible events
export interface MoveResult {
  dungeon: DungeonState;
  encounter: Monster | null;
  treasure: boolean;
  stairs: boolean;
  stairsUp: boolean;
  trap: { type: TrapType; damage?: number } | null;
  terrain: { type: TerrainType } | null; // Terrain tile stepped on
  shop: boolean;
  elevator: boolean; // Elevator to send party members back
  loot: LootItem | null;
  blocked: boolean; // True if move was blocked by wall
  plant: { plantType: PlantType; materialId: string } | null; // Harvested plant
  // Bumped into a mineable wall (player did NOT move). Index.tsx uses this
  // to apply a Pickaxe hit if the player owns one strong enough.
  mineableBump: { x: number; y: number; tier: MineableWallTier } | null;
  // Bumped into a rune tile (terrain). The caller decides whether to dig
  // (if a strong enough Shovel is held) or step onto it normally.
  runeBump: { x: number; y: number; terrainType: TerrainType } | null;
  // Bumped into a monster nest. Caller deals damage based on player's attack stat.
  nestBump: { x: number; y: number } | null;
}

// Check if a tile should stop auto-run
export function shouldStopAutoRun(
  tiles: DungeonTile[][],
  x: number,
  y: number,
  width: number,
  height: number,
  options: { allowMineable?: boolean; allowInteract?: boolean } = {},
): boolean {
  // Out of bounds
  if (x < 0 || x >= width || y < 0 || y >= height) return true;

  const tile = tiles[y][x];

  // Stop on bedrock walls always.
  if (tile.type === 'wall') return true;
  // Mineable walls: only stop if the caller doesn't want to auto-chip through
  // them. When Auto-Harvest is on, the path-walker chips them turn-by-turn.
  if (tile.type === 'mineable_wall' && !options.allowMineable) return true;

  // Stop on anything interesting
  if (tile.type === 'enemy') return true;
  // Auto-Hunt mode (allowInteract) walks through treasure and traps — treasure
  // is auto-looted on the step, traps are auto-triggered (and become passable
  // after firing once), and rune terrain is walked over. This lets Auto-Hunt
  // keep chasing enemies through cluttered floors instead of halting at every
  // pickup or hazard.
  if (tile.type === 'treasure' && !options.allowInteract) return true;
  if (tile.type === 'trap' && !tile.triggered && !options.allowInteract) return true;
  if (tile.type === 'stairs') return true;
  if (tile.type === 'stairs_up') return true;
  if (tile.type === 'shop') return true;
  if (tile.type === 'elevator') return true;
  if (tile.type === 'nest') return true;

  return false;
}

// Check if any enemy is visible in the current view (for stopping auto-run on enemy sight)
export function hasVisibleEnemy(tiles: DungeonTile[][]): boolean {
  for (let y = 0; y < tiles.length; y++) {
    for (let x = 0; x < tiles[y].length; x++) {
      const tile = tiles[y][x];
      if (tile.visible && tile.type === 'enemy') {
        return true;
      }
    }
  }
  return false;
}

// Move player in dungeon
export function movePlayer(
  dungeon: DungeonState, 
  direction: 'up' | 'down' | 'left' | 'right'
): MoveResult {
  const { playerPosition, tiles, enemies } = dungeon;
  
  const dx = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
  const dy = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;
  
  const newX = playerPosition.x + dx;
  const newY = playerPosition.y + dy;

  // Check bounds
  if (newX < 0 || newX >= dungeon.width || newY < 0 || newY >= dungeon.height) {
    return { dungeon, encounter: null, treasure: false, stairs: false, stairsUp: false, trap: null, terrain: null, shop: false, elevator: false, loot: null, blocked: true, plant: null, mineableBump: null, runeBump: null, nestBump: null };
  }

  const targetTile = tiles[newY][newX];

  // Bedrock walls — flat block, no mining possible
  if (targetTile.type === 'wall') {
    return { dungeon, encounter: null, treasure: false, stairs: false, stairsUp: false, trap: null, terrain: null, shop: false, elevator: false, loot: null, blocked: true, plant: null, mineableBump: null, runeBump: null, nestBump: null };
  }

  // Mineable walls — also block movement, but signal a "bump" so Index.tsx
  // can apply a Pickaxe hit if the player owns one strong enough.
  if (targetTile.type === 'mineable_wall' && targetTile.wallTier) {
    return {
      dungeon, encounter: null, treasure: false, stairs: false, stairsUp: false, trap: null,
      terrain: null, shop: false, elevator: false, loot: null, blocked: true,
      plant: null,
      mineableBump: { x: newX, y: newY, tier: targetTile.wallTier },
      runeBump: null,
      nestBump: null,
    };
  }

  // Nest tiles block movement; caller deals damage based on player attack.
  if (targetTile.type === 'nest') {
    return {
      dungeon, encounter: null, treasure: false, stairs: false, stairsUp: false, trap: null,
      terrain: null, shop: false, elevator: false, loot: null, blocked: true,
      plant: null, mineableBump: null, runeBump: null,
      nestBump: { x: newX, y: newY },
    };
  }

  // Create new tiles array
  const newTiles = tiles.map(row => row.map(tile => ({ ...tile })));
  
  // Clear old position - restore terrain / stairs if player was on one
  const oldTile = tiles[playerPosition.y][playerPosition.x];
  if (oldTile.terrainType) {
    // Player was on terrain - restore it
    newTiles[playerPosition.y][playerPosition.x].type = 'terrain';
  } else if (oldTile.stairsBeneath === 'down') {
    newTiles[playerPosition.y][playerPosition.x].type = 'stairs';
    newTiles[playerPosition.y][playerPosition.x].stairsBeneath = undefined;
  } else if (oldTile.stairsBeneath === 'up') {
    newTiles[playerPosition.y][playerPosition.x].type = 'stairs_up';
    newTiles[playerPosition.y][playerPosition.x].stairsBeneath = undefined;
  } else {
    newTiles[playerPosition.y][playerPosition.x].type = 'floor';
  }
  
  let encounter: Monster | null = null;
  let treasure = false;
  let stairs = false;
  let stairsUp = false;
  let trap: { type: TrapType; damage?: number } | null = null;
  let terrain: { type: TerrainType } | null = null;
  let shop = false;
  let elevator = false;
  let loot: LootItem | null = null;
  let plant: { plantType: PlantType; materialId: string } | null = null;
  // Handle different tile types
  if (targetTile.type === 'enemy' && targetTile.enemyId) {
    encounter = enemies.find(e => e.id === targetTile.enemyId) || null;
  } else if (targetTile.type === 'treasure') {
    treasure = true;
    // Use stored loot data if available, otherwise fall back to LOOT_TABLE
    if (targetTile.lootData) {
      loot = targetTile.lootData;
    } else if (targetTile.lootId) {
      loot = LOOT_TABLE.find(l => l.id === targetTile.lootId) || null;
    }
  } else if (targetTile.type === 'stairs') {
    stairs = true;
  } else if (targetTile.type === 'stairs_up') {
    stairsUp = true;
  } else if (targetTile.type === 'trap' && !targetTile.triggered) {
    const trapType = targetTile.trapType || 'spike';
    const damage = trapType === 'spike' ? 10 + Math.floor(dungeon.floor * 2) : 0;
    trap = { type: trapType, damage };
    newTiles[newY][newX].triggered = true;
  } else if (targetTile.type === 'terrain' && targetTile.terrainType) {
    // Terrain hazard - damage is calculated in Index.tsx based on creature immunity
    terrain = { type: targetTile.terrainType };
  } else if (targetTile.type === 'shop') {
    shop = true;
  } else if (targetTile.type === 'elevator') {
    elevator = true;
  } else if (targetTile.type === 'plant' && !targetTile.harvested && targetTile.plantType) {
    // Harvest plant
    plant = { plantType: targetTile.plantType, materialId: targetTile.plantType };
    newTiles[newY][newX].harvested = true;
  }

  // Set new position (terrain tiles persist - don't overwrite them)
  if (targetTile.type === 'terrain') {
    // Keep terrain type when standing on it
    newTiles[newY][newX].type = 'player';
    // terrainType stays preserved
  } else {
    newTiles[newY][newX].type = 'player';
  }
  // Remember if there's a staircase under the player so it gets restored on
  // step-off (player tile overwrites the stairs tile while standing).
  if (targetTile.type === 'stairs') {
    newTiles[newY][newX].stairsBeneath = 'down';
  } else if (targetTile.type === 'stairs_up') {
    newTiles[newY][newX].stairsBeneath = 'up';
  }
  
  const newPosition = { x: newX, y: newY };
  updateVisibility(newTiles, newPosition, 3, getDungeonTowerVisionSources(dungeon));

  // Emit a runeBump alongside `terrain` whenever the player walks onto a rune.
  // Index.tsx uses it to optionally dig the rune with a sufficient Shovel —
  // mismatched diggers still take the rune backlash damage from `terrain`.
  const runeBump = (targetTile.type === 'terrain' && targetTile.terrainType)
    ? { x: newX, y: newY, terrainType: targetTile.terrainType }
    : null;

  return {
    dungeon: {
      ...dungeon,
      tiles: newTiles,
      playerPosition: newPosition,
    },
    encounter,
    treasure,
    stairs,
    stairsUp,
    trap,
    terrain,
    shop,
    elevator,
    loot,
    plant,
    blocked: false,
    mineableBump: null,
    runeBump,
    nestBump: null,
  };
}

// ============= MINING =============
// Apply one Pickaxe hit to a mineable wall. Returns the updated dungeon and,
// if the wall broke, the material drop. Returns null if the pickaxe is too
// weak for this wall's tier (caller should show a "need a better pickaxe"
// message instead). Caller is responsible for actually granting the drop.
export interface MineResult {
  dungeon: DungeonState;
  broken: boolean;
  drop: { materialId: string; quantity: number } | null;
  hits: number;
  hitsNeeded: number;
  tier: MineableWallTier;
}

export function mineWall(
  dungeon: DungeonState,
  x: number,
  y: number,
  pickaxeTier: PickaxeTier,
  hitCount: number = 1,
): MineResult | null {
  const tile = dungeon.tiles[y]?.[x];
  if (!tile || tile.type !== 'mineable_wall' || !tile.wallTier) return null;

  const needed = hitsToBreak(tile.wallTier, pickaxeTier);
  if (!isFinite(needed)) return null; // pickaxe too weak

  const newTiles = dungeon.tiles.map(row => row.map(t => ({ ...t })));
  const target = newTiles[y][x];
  const newHits = (target.wallHits || 0) + hitCount;

  if (newHits >= needed) {
    // Break: convert to floor and drop material.
    target.type = 'floor';
    target.wallTier = undefined;
    target.wallHits = undefined;
    const drop = rollWallDrop(tile.wallTier);
    return {
      dungeon: { ...dungeon, tiles: newTiles },
      broken: true,
      drop,
      hits: newHits,
      hitsNeeded: needed,
      tier: tile.wallTier,
    };
  }

  // Just chip: increment hit counter
  target.wallHits = newHits;
  return {
    dungeon: { ...dungeon, tiles: newTiles },
    broken: false,
    drop: null,
    hits: newHits,
    hitsNeeded: needed,
    tier: tile.wallTier,
  };
}

// Convenience: pretty name for a mineable wall tier (for log messages).
export function mineableWallName(tier: MineableWallTier): string {
  return MINEABLE_WALL_TIERS[tier].name;
}

// ============= RUNE DIGGING =============
// Strip the rune (terrainType) from a tile, converting it back to floor.
// Player-occupied tiles are handled too — the player keeps standing where
// they are but no longer atop a rune. Returns the updated dungeon, or null
// if the tile is not a rune.
export function digRune(
  dungeon: DungeonState,
  x: number,
  y: number,
): DungeonState | null {
  const tile = dungeon.tiles[y]?.[x];
  if (!tile || !tile.terrainType) return null;
  const newTiles = dungeon.tiles.map(row => row.map(t => ({ ...t })));
  const target = newTiles[y][x];
  target.terrainType = undefined;
  // If the tile currently shows the player or an enemy, preserve that;
  // otherwise it becomes a plain floor.
  if (target.type === 'terrain') {
    target.type = 'floor';
  }
  return { ...dungeon, tiles: newTiles };
}

// Remove enemy from dungeon after defeat
export function removeEnemy(dungeon: DungeonState, enemyId: string): DungeonState {
  const newTiles = dungeon.tiles.map(row => 
    row.map(tile => {
      if (tile.enemyId === enemyId) {
        // Restore terrain if enemy was on one, otherwise floor
        const newType = tile.terrainType ? 'terrain' : 'floor';
        return { 
          ...tile, 
          type: newType as 'terrain' | 'floor', 
          enemyId: undefined 
        };
      }
      return tile;
    })
  );

  const newEnemies = dungeon.enemies.filter(e => e.id !== enemyId);

  return {
    ...dungeon,
    tiles: newTiles,
    enemies: newEnemies,
  };
}

// ============= DUNGEON NESTS =============
// Apply damage to a nest tile. Returns the updated dungeon and whether the nest was destroyed.
export function damageDungeonNest(
  dungeon: DungeonState,
  x: number,
  y: number,
  damage: number,
): { dungeon: DungeonState; destroyed: boolean; nest: NestState | null } {
  const tile = dungeon.tiles[y]?.[x];
  if (!tile || tile.type !== 'nest' || !tile.nestState) {
    return { dungeon, destroyed: false, nest: null };
  }
  const newTiles = dungeon.tiles.map(row => row.map(t => ({ ...t, nestState: t.nestState ? { ...t.nestState } : undefined })));
  const target = newTiles[y][x];
  const nest = target.nestState!;
  nest.hp = Math.max(0, nest.hp - damage);
  if (nest.hp <= 0) {
    nest.destroyed = true;
    target.type = 'floor';
    target.nestState = undefined;
    return { dungeon: { ...dungeon, tiles: newTiles }, destroyed: true, nest };
  }
  return { dungeon: { ...dungeon, tiles: newTiles }, destroyed: false, nest };
}

// Tick all visible nests on the current floor; returns list of spawn requests.
export function tickDungeonNests(
  dungeon: DungeonState,
): { dungeon: DungeonState; spawns: { nestX: number; nestY: number; nest: NestState }[] } {
  const newTiles = dungeon.tiles.map(row => row.map(t => ({ ...t, nestState: t.nestState ? { ...t.nestState } : undefined })));
  const spawns: { nestX: number; nestY: number; nest: NestState }[] = [];
  for (let y = 0; y < newTiles.length; y++) {
    for (let x = 0; x < newTiles[y].length; x++) {
      const t = newTiles[y][x];
      if (t.type !== 'nest' || !t.nestState || t.nestState.destroyed) continue;
      // Only tick when player has discovered the nest (visible or explored)
      if (!t.explored) continue;
      t.nestState.spawnCooldown -= 1;
      if (t.nestState.spawnCooldown <= 0) {
        t.nestState.spawnCooldown = t.nestState.maxSpawnCooldown;
        spawns.push({ nestX: x, nestY: y, nest: t.nestState });
      }
    }
  }
  return { dungeon: { ...dungeon, tiles: newTiles }, spawns };
}
