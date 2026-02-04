// Respawn system - spawns new monsters in unseen rooms based on steps taken
// Spawn rate accelerates the more steps player takes on a floor

import { DungeonState, DungeonTile, Monster, SpeciesType, Position } from './types';
import { generateRandomMonster } from './utils';

// Respawn configuration (step-based)
export const RESPAWN_CONFIG = {
  baseSteps: 25,            // 25 steps before first respawn
  minSteps: 8,              // 8 steps minimum (fastest spawn rate)
  accelerationRate: 0.85,   // Multiply steps by this each spawn
  warningThreshold: 0.7,    // Show "attracting attention" when steps below this % of base
};

// Get species available for the current floor
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

// Find all floor tiles that are not visible to the player (explored or not)
function getHiddenFloorTiles(tiles: DungeonTile[][]): Position[] {
  const hiddenTiles: Position[] = [];
  
  for (let y = 0; y < tiles.length; y++) {
    for (let x = 0; x < tiles[y].length; x++) {
      const tile = tiles[y][x];
      // Spawn on any floor tile the player can't currently see
      if (tile.type === 'floor' && !tile.visible) {
        hiddenTiles.push({ x, y });
      }
    }
  }
  
  return hiddenTiles;
}

// Spawn a new monster in a hidden location
export function spawnMonsterInHiddenRoom(dungeon: DungeonState): {
  dungeon: DungeonState;
  spawned: boolean;
  monster?: Monster;
} {
  const hiddenTiles = getHiddenFloorTiles(dungeon.tiles);
  
  if (hiddenTiles.length === 0) {
    // No valid spawn locations
    return { dungeon, spawned: false };
  }
  
  // Pick a random hidden tile
  const spawnPos = hiddenTiles[Math.floor(Math.random() * hiddenTiles.length)];
  
  // Generate a monster appropriate for this floor
  const availableSpecies = getAvailableSpeciesForFloor(dungeon.floor);
  const monster = generateRandomMonster(availableSpecies, dungeon.floor);
  
  // Create new tiles array with the spawned monster
  const newTiles = dungeon.tiles.map((row, y) =>
    row.map((tile, x) => {
      if (x === spawnPos.x && y === spawnPos.y) {
        return {
          ...tile,
          type: 'enemy' as const,
          enemyId: monster.id,
        };
      }
      return tile;
    })
  );
  
  return {
    dungeon: {
      ...dungeon,
      tiles: newTiles,
      enemies: [...dungeon.enemies, monster],
    },
    spawned: true,
    monster,
  };
}

// Calculate the next respawn step threshold based on steps taken on floor
export function calculateNextStepThreshold(currentThreshold: number): number {
  const nextThreshold = Math.floor(currentThreshold * RESPAWN_CONFIG.accelerationRate);
  return Math.max(RESPAWN_CONFIG.minSteps, nextThreshold);
}

// Check if player should be warned about attracting attention
export function shouldWarnAttention(currentThreshold: number): boolean {
  const threshold = RESPAWN_CONFIG.baseSteps * RESPAWN_CONFIG.warningThreshold;
  return currentThreshold <= threshold;
}

// Get attention level for UI display (0 = safe, 1 = max danger)
export function getAttentionLevel(currentThreshold: number): number {
  const range = RESPAWN_CONFIG.baseSteps - RESPAWN_CONFIG.minSteps;
  const fromMin = currentThreshold - RESPAWN_CONFIG.minSteps;
  return 1 - (fromMin / range);
}

// Check if a respawn should occur based on steps taken
export function shouldRespawn(stepsTaken: number, stepThreshold: number): boolean {
  return stepsTaken >= stepThreshold;
}
