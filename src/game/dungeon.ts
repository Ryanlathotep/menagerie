// Dungeon generation and management

import { DungeonState, DungeonTile, Position, Monster, SpeciesType, TrapType, PlantType, DungeonTheme } from './types';
import { generateRandomMonster } from './utils';
import { generateEquipment, generateMaterialDrop, CraftingMaterial, EquipmentItem } from './equipment';
import { getRandomTerrainType, TerrainType } from './terrain';
import { getWallTierForFloor, MineableWallTier, hitsToBreak, rollWallDrop, PickaxeTier, MINEABLE_WALL_TIERS } from './tools';

// Larger dungeons with scrolling viewport
const DUNGEON_WIDTH = 30;
const DUNGEON_HEIGHT = 25;

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

// Simple room-based dungeon generation
export function generateDungeon(floor: number, theme?: DungeonTheme, startingFloor?: number): DungeonState {
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

  // Convert ~35% of internal walls that border a floor into mineable walls.
  // Skip the outer border (always bedrock) so dungeons can't be holed open
  // to nothing. Mineable walls cluster naturally on room edges because
  // those are the only walls touching open floors.
  for (let y = 1; y < DUNGEON_HEIGHT - 1; y++) {
    for (let x = 1; x < DUNGEON_WIDTH - 1; x++) {
      if (tiles[y][x].type !== 'wall') continue;
      // Only convert walls that touch at least one floor tile.
      const neighbors = [
        tiles[y - 1]?.[x], tiles[y + 1]?.[x],
        tiles[y]?.[x - 1], tiles[y]?.[x + 1],
      ];
      const touchesFloor = neighbors.some(n => n && n.type === 'floor');
      if (!touchesFloor) continue;
      if (Math.random() < 0.35) {
        const wallTier = getWallTierForFloor(floor);
        tiles[y][x].type = 'mineable_wall';
        tiles[y][x].wallTier = wallTier;
        tiles[y][x].wallHits = 0;
      }
    }
  }
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

  // Place terrain hazards (inside rooms only, in center areas to avoid blocking paths)
  const numTerrainTiles = 4 + Math.floor(floor / 2) + Math.floor(Math.random() * 4);
  for (let i = 0; i < numTerrainTiles; i++) {
    let placed = false;
    let attempts = 0;
    
    while (!placed && attempts < 50) {
      // Only place terrain inside rooms, not in first room (player start) or last room (stairs)
      const roomIndex = 1 + Math.floor(Math.random() * Math.max(1, rooms.length - 2));
      if (roomIndex >= rooms.length - 1) {
        attempts++;
        continue;
      }
      
      const room = rooms[roomIndex];
      // Only place in rooms that are at least 4x4 to have a proper center
      if (room.width < 4 || room.height < 4) {
        attempts++;
        continue;
      }
      
      // Place in center of room, not on edges (at least 1 tile from walls)
      const wx = room.x + 1 + Math.floor(Math.random() * Math.max(1, room.width - 2));
      const wy = room.y + 1 + Math.floor(Math.random() * Math.max(1, room.height - 2));
      
      if (tiles[wy]?.[wx]?.type === 'floor') {
        tiles[wy][wx].type = 'terrain';
        tiles[wy][wx].terrainType = getRandomTerrainType();
        placed = true;
      }
      attempts++;
    }
  }

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
export function updateVisibility(tiles: DungeonTile[][], position: Position, range: number = 3): void {
  // Reset visibility
  for (let y = 0; y < tiles.length; y++) {
    for (let x = 0; x < tiles[y].length; x++) {
      tiles[y][x].visible = false;
    }
  }

  // Simple square vision
  for (let dy = -range; dy <= range; dy++) {
    for (let dx = -range; dx <= range; dx++) {
      const ny = position.y + dy;
      const nx = position.x + dx;
      
      if (ny >= 0 && ny < tiles.length && nx >= 0 && nx < tiles[0].length) {
        tiles[ny][nx].visible = true;
        tiles[ny][nx].explored = true;
      }
    }
  }
}

// Move result with all possible events
export interface MoveResult {
  dungeon: DungeonState;
  encounter: Monster | null;
  treasure: boolean;
  stairs: boolean;
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
}

// Check if a tile should stop auto-run
export function shouldStopAutoRun(tiles: DungeonTile[][], x: number, y: number, width: number, height: number): boolean {
  // Out of bounds
  if (x < 0 || x >= width || y < 0 || y >= height) return true;
  
  const tile = tiles[y][x];
  
  // Stop on walls (bedrock + mineable both block movement)
  if (tile.type === 'wall' || tile.type === 'mineable_wall') return true;
  
  // Stop on anything interesting
  if (tile.type === 'enemy') return true;
  if (tile.type === 'treasure') return true;
  if (tile.type === 'trap' && !tile.triggered) return true;
  if (tile.type === 'stairs') return true;
  if (tile.type === 'shop') return true;
  if (tile.type === 'elevator') return true;
  
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
    return { dungeon, encounter: null, treasure: false, stairs: false, trap: null, terrain: null, shop: false, elevator: false, loot: null, blocked: true, plant: null, mineableBump: null };
  }

  const targetTile = tiles[newY][newX];

  // Bedrock walls — flat block, no mining possible
  if (targetTile.type === 'wall') {
    return { dungeon, encounter: null, treasure: false, stairs: false, trap: null, terrain: null, shop: false, elevator: false, loot: null, blocked: true, plant: null, mineableBump: null };
  }

  // Mineable walls — also block movement, but signal a "bump" so Index.tsx
  // can apply a Pickaxe hit if the player owns one strong enough.
  if (targetTile.type === 'mineable_wall' && targetTile.wallTier) {
    return {
      dungeon, encounter: null, treasure: false, stairs: false, trap: null,
      terrain: null, shop: false, elevator: false, loot: null, blocked: true,
      plant: null,
      mineableBump: { x: newX, y: newY, tier: targetTile.wallTier },
    };
  }

  // Create new tiles array
  const newTiles = tiles.map(row => row.map(tile => ({ ...tile })));
  
  // Clear old position - restore terrain if player was on one
  const oldTile = tiles[playerPosition.y][playerPosition.x];
  if (oldTile.terrainType) {
    // Player was on terrain - restore it
    newTiles[playerPosition.y][playerPosition.x].type = 'terrain';
  } else {
    newTiles[playerPosition.y][playerPosition.x].type = 'floor';
  }
  
  let encounter: Monster | null = null;
  let treasure = false;
  let stairs = false;
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
  
  const newPosition = { x: newX, y: newY };
  updateVisibility(newTiles, newPosition);

  return {
    dungeon: {
      ...dungeon,
      tiles: newTiles,
      playerPosition: newPosition,
    },
    encounter,
    treasure,
    stairs,
    trap,
    terrain,
    shop,
    elevator,
    loot,
    plant,
    blocked: false,
    mineableBump: null,
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
