// Dungeon generation and management

import { DungeonState, DungeonTile, Position, Monster, SpeciesType, TrapType } from './types';
import { generateRandomMonster } from './utils';

// Larger dungeons with scrolling viewport
const DUNGEON_WIDTH = 30;
const DUNGEON_HEIGHT = 25;

// Item types for loot
export interface LootItem {
  id: string;
  name: string;
  type: 'potion' | 'equipment' | 'gold';
  value: number;
  effect?: string;
}

export const LOOT_TABLE: LootItem[] = [
  { id: 'health_potion', name: 'Health Potion', type: 'potion', value: 30, effect: 'heal_hp' },
  { id: 'stamina_potion', name: 'Stamina Potion', type: 'potion', value: 20, effect: 'heal_stamina' },
  { id: 'antidote', name: 'Antidote', type: 'potion', value: 10, effect: 'cure_poison' },
  { id: 'power_berry', name: 'Power Berry', type: 'potion', value: 25, effect: 'boost_attack' },
  { id: 'gold_coin', name: 'Gold Coins', type: 'gold', value: 15 },
  { id: 'gold_pile', name: 'Gold Pile', type: 'gold', value: 30 },
];

// Simple room-based dungeon generation
export function generateDungeon(floor: number): DungeonState {
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

  // Place stairs in last room
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
  
  // Determine which species can appear based on floor
  const availableSpecies: SpeciesType[] = getAvailableSpeciesForFloor(floor);

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
        const enemy = generateRandomMonster(availableSpecies, floor);
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
        // Assign random loot
        tiles[ty][tx].lootId = LOOT_TABLE[Math.floor(Math.random() * LOOT_TABLE.length)].id;
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

  // Place water hazards (inside rooms only, never in corridors to avoid blocking paths)
  const numWaterTiles = 2 + Math.floor(floor / 3) + Math.floor(Math.random() * 3);
  for (let i = 0; i < numWaterTiles; i++) {
    let placed = false;
    let attempts = 0;
    
    while (!placed && attempts < 50) {
      // Only place water inside rooms, not in first room (player start) or last room (stairs)
      const roomIndex = 1 + Math.floor(Math.random() * Math.max(1, rooms.length - 2));
      if (roomIndex >= rooms.length - 1) {
        attempts++;
        continue;
      }
      
      const room = rooms[roomIndex];
      // Place inside room, not on edges
      const wx = room.x + 1 + Math.floor(Math.random() * Math.max(1, room.width - 2));
      const wy = room.y + 1 + Math.floor(Math.random() * Math.max(1, room.height - 2));
      
      if (tiles[wy]?.[wx]?.type === 'floor') {
        tiles[wy][wx].type = 'water';
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

  // Reveal tiles around player
  updateVisibility(tiles, playerPosition);

  return {
    floor,
    tiles,
    playerPosition,
    enemies,
    width: DUNGEON_WIDTH,
    height: DUNGEON_HEIGHT,
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
  water: { damage: number } | null; // Water hazard damage (0 if immune)
  shop: boolean;
  loot: LootItem | null;
  blocked: boolean; // True if move was blocked by wall
}

// Check if a tile should stop auto-run
export function shouldStopAutoRun(tiles: DungeonTile[][], x: number, y: number, width: number, height: number): boolean {
  // Out of bounds
  if (x < 0 || x >= width || y < 0 || y >= height) return true;
  
  const tile = tiles[y][x];
  
  // Stop on walls
  if (tile.type === 'wall') return true;
  
  // Stop on anything interesting
  if (tile.type === 'enemy') return true;
  if (tile.type === 'treasure') return true;
  if (tile.type === 'trap' && !tile.triggered) return true;
  if (tile.type === 'stairs') return true;
  if (tile.type === 'shop') return true;
  
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
    return { dungeon, encounter: null, treasure: false, stairs: false, trap: null, water: null, shop: false, loot: null, blocked: true };
  }

  const targetTile = tiles[newY][newX];
  
  // Can't move into walls
  if (targetTile.type === 'wall') {
    return { dungeon, encounter: null, treasure: false, stairs: false, trap: null, water: null, shop: false, loot: null, blocked: true };
  }

  // Create new tiles array
  const newTiles = tiles.map(row => row.map(tile => ({ ...tile })));
  
  // Clear old position
  newTiles[playerPosition.y][playerPosition.x].type = 'floor';
  
  let encounter: Monster | null = null;
  let treasure = false;
  let stairs = false;
  let trap: { type: TrapType; damage?: number } | null = null;
  let water: { damage: number } | null = null;
  let shop = false;
  let loot: LootItem | null = null;

  // Handle different tile types
  if (targetTile.type === 'enemy' && targetTile.enemyId) {
    encounter = enemies.find(e => e.id === targetTile.enemyId) || null;
  } else if (targetTile.type === 'treasure') {
    treasure = true;
    if (targetTile.lootId) {
      loot = LOOT_TABLE.find(l => l.id === targetTile.lootId) || null;
    }
  } else if (targetTile.type === 'stairs') {
    stairs = true;
  } else if (targetTile.type === 'trap' && !targetTile.triggered) {
    const trapType = targetTile.trapType || 'spike';
    const damage = trapType === 'spike' ? 10 + Math.floor(dungeon.floor * 2) : 0;
    trap = { type: trapType, damage };
    newTiles[newY][newX].triggered = true;
  } else if (targetTile.type === 'water') {
    // Water hazard - damage is calculated in Index.tsx based on species immunity
    const waterDamage = 5 + Math.floor(dungeon.floor * 1.5);
    water = { damage: waterDamage };
  } else if (targetTile.type === 'shop') {
    shop = true;
  }

  // Set new position
  newTiles[newY][newX].type = 'player';
  
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
    water,
    shop,
    loot,
    blocked: false,
  };
}

// Remove enemy from dungeon after defeat
export function removeEnemy(dungeon: DungeonState, enemyId: string): DungeonState {
  const newTiles = dungeon.tiles.map(row => 
    row.map(tile => {
      if (tile.enemyId === enemyId) {
        return { ...tile, type: 'floor' as const, enemyId: undefined };
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
