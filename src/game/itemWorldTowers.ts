/**
 * Item World Towers - Three permanent, reusable progression dungeons
 * 
 * Design: One Prototyping Tower, one Training Tower, one Skill Forge.
 * Players bring an item/creature/move scroll and enter the tower to process it.
 * All three leverage the standard dungeon generation engine with no duplication.
 * 
 * The towers are placed near the starting area, always accessible, and track
 * which asset is currently being processed via SaveData.itemWorldTowerState.
 */

import { DungeonEntrance, DungeonTheme } from './types';

export type ItemWorldTowerType = 'prototyping' | 'training' | 'skill_creation';

/**
 * Current state of an item world tower - what's being processed and progress.
 * Stored in SaveData.itemWorldTowerState[towerType].
 */
export interface ItemWorldTowerState {
  type: ItemWorldTowerType;
  
  // The asset currently being processed (ID, name, level)
  baseAssetId: string;
  baseAssetName: string;
  baseAssetLevel: number;
  
  // Seeds for deterministic dungeon generation (from asset or generated fresh)
  generationSeed: string;
  
  // Progress tracking
  highestFloorReached: number;
  hasExtractedReward: boolean;
  
  // Timestamp of when this asset was last entered (for re-entry logic)
  lastEnteredTimestamp?: number;
}

/**
 * Storage shape: SaveData.itemWorldTowerState
 */
export type ItemWorldTowerStateMap = Partial<Record<ItemWorldTowerType, ItemWorldTowerState>>;

// ============= TOWER ENTRANCE FACTORIES =============

/**
 * Create the permanent Prototyping Tower entrance.
 * Positioned just west of home so it's one of the first things beta testers see.
 */
export function createPrototypingTowerEntrance(): DungeonEntrance {
  return {
    id: 'tower_prototyping',
    worldX: -5,
    worldY: 0,
    seed: 31337, // Fixed seed for this tower type
    deepestFloor: 0,
    difficulty: 1,
    name: '🔨 Prototyping Tower',
    discovered: false,
    theme: { kind: 'all' } as DungeonTheme,
    category: 'procedural',
  };
}

/**
 * Create the permanent Training Tower entrance.
 * Positioned just east of home.
 */
export function createTrainingTowerEntrance(): DungeonEntrance {
  return {
    id: 'tower_training',
    worldX: 5,
    worldY: 0,
    seed: 31338, // Fixed seed for this tower type
    deepestFloor: 0,
    difficulty: 1,
    name: '⚔️ Training Tower',
    discovered: false,
    theme: { kind: 'all' } as DungeonTheme,
    category: 'procedural',
  };
}

/**
 * Create the permanent Skill Forge entrance.
 * Positioned just south of home.
 */
export function createSkillCreationTowerEntrance(): DungeonEntrance {
  return {
    id: 'tower_skill_creation',
    worldX: 0,
    worldY: 5,
    seed: 31339, // Fixed seed for this tower type
    deepestFloor: 0,
    difficulty: 1,
    name: '✨ Skill Forge',
    discovered: false,
    theme: { kind: 'all' } as DungeonTheme,
    category: 'procedural',
  };
}

/**
 * Initialize all three towers for a new save.
 */
export function createAllItemWorldTowerEntrances(): Record<string, DungeonEntrance> {
  return {
    tower_prototyping: createPrototypingTowerEntrance(),
    tower_training: createTrainingTowerEntrance(),
    tower_skill_creation: createSkillCreationTowerEntrance(),
  };
}

/**
 * Check if a dungeon entrance ID is an item world tower.
 */
export function isItemWorldTower(id: string): boolean {
  return id === 'tower_prototyping' ||
         id === 'tower_training' ||
         id === 'tower_skill_creation';
}

/**
 * Extract tower type from entrance ID.
 */
export function getItemWorldTowerType(id: string): ItemWorldTowerType | null {
  if (id === 'tower_prototyping') return 'prototyping';
  if (id === 'tower_training') return 'training';
  if (id === 'tower_skill_creation') return 'skill_creation';
  return null;
}
