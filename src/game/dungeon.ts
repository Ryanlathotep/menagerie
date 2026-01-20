// Dungeon generation and management

import { DungeonState, DungeonTile, Position, Monster, SpeciesType } from './types';
import { generateRandomMonster } from './utils';

const DUNGEON_WIDTH = 20;
const DUNGEON_HEIGHT = 15;

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
  const numTreasure = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < numTreasure; i++) {
    let placed = false;
    let attempts = 0;
    
    while (!placed && attempts < 50) {
      const room = rooms[Math.floor(Math.random() * rooms.length)];
      const tx = room.x + Math.floor(Math.random() * room.width);
      const ty = room.y + Math.floor(Math.random() * room.height);

      if (tiles[ty][tx].type === 'floor') {
        tiles[ty][tx].type = 'treasure';
        placed = true;
      }
      attempts++;
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

// Move player in dungeon
export function movePlayer(
  dungeon: DungeonState, 
  direction: 'up' | 'down' | 'left' | 'right'
): { dungeon: DungeonState; encounter: Monster | null; treasure: boolean; stairs: boolean } {
  const { playerPosition, tiles, enemies } = dungeon;
  
  const dx = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
  const dy = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;
  
  const newX = playerPosition.x + dx;
  const newY = playerPosition.y + dy;

  // Check bounds
  if (newX < 0 || newX >= dungeon.width || newY < 0 || newY >= dungeon.height) {
    return { dungeon, encounter: null, treasure: false, stairs: false };
  }

  const targetTile = tiles[newY][newX];
  
  // Can't move into walls
  if (targetTile.type === 'wall') {
    return { dungeon, encounter: null, treasure: false, stairs: false };
  }

  // Create new tiles array
  const newTiles = tiles.map(row => row.map(tile => ({ ...tile })));
  
  // Clear old position
  newTiles[playerPosition.y][playerPosition.x].type = 'floor';
  
  let encounter: Monster | null = null;
  let treasure = false;
  let stairs = false;

  // Handle different tile types
  if (targetTile.type === 'enemy' && targetTile.enemyId) {
    encounter = enemies.find(e => e.id === targetTile.enemyId) || null;
  } else if (targetTile.type === 'treasure') {
    treasure = true;
  } else if (targetTile.type === 'stairs') {
    stairs = true;
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
