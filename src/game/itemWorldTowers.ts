/**
 * Item World Towers - Three permanent, reusable progression dungeons.
 *
 * Players slot a base asset (item / monster / move scroll) at the entrance,
 * then climb a procedurally generated tower seeded from that asset. Crossing
 * REWARD_FLOOR_DELTA new floors beyond your personal best with that asset
 * spawns an Extraction Altar — claim the reward to forge a permanent
 * recipe / stat boost / scroll.
 *
 * Greed-risk (lose-everything-on-wipe) is intentionally OPT-IN — see
 * GameSettings.itemWorldTowerGreedRisk (default off). When off, defeats
 * follow the normal No-Death-Losses rule.
 */

import { DungeonEntrance, DungeonTheme } from './types';

export type ItemWorldTowerType = 'prototyping' | 'training' | 'skill_creation';

/** How many floors above your personal best with this asset before the
 *  Extraction Altar spawns. Design bible says 50; we use 10 during beta so
 *  testers can actually reach the reward loop. */
export const ITEM_WORLD_REWARD_FLOOR_DELTA = 10;

export interface ItemWorldTowerState {
  type: ItemWorldTowerType;
  baseAssetId: string;
  baseAssetName: string;
  baseAssetLevel: number;
  /** Deterministic seed derived from the asset — drives dungeon generation. */
  generationSeed: string;
  /** Highest floor reached on the current asset run. */
  highestFloorReached: number;
  /** True after the player has claimed the Floor-N reward at least once for this asset. */
  hasExtractedReward: boolean;
  lastEnteredTimestamp?: number;
}

export type ItemWorldTowerStateMap = Partial<Record<ItemWorldTowerType, ItemWorldTowerState>>;

// ============= ENTRANCE FACTORIES =============

export const PROTOTYPING_TOWER_ID = 'tower_prototyping';
export const TRAINING_TOWER_ID = 'tower_training';
export const SKILL_FORGE_TOWER_ID = 'tower_skill_creation';

export function createPrototypingTowerEntrance(): DungeonEntrance {
  return {
    id: PROTOTYPING_TOWER_ID,
    worldX: -4,
    worldY: -1,
    seed: 31337,
    deepestFloor: 0,
    difficulty: 1,
    name: '🔨 Prototyping Tower',
    discovered: false,
    theme: { kind: 'all' } as DungeonTheme,
    category: 'item_world',
  };
}

export function createTrainingTowerEntrance(): DungeonEntrance {
  return {
    id: TRAINING_TOWER_ID,
    worldX: 4,
    worldY: -1,
    seed: 31338,
    deepestFloor: 0,
    difficulty: 1,
    name: '⚔️ Training Tower',
    discovered: false,
    theme: { kind: 'all' } as DungeonTheme,
    category: 'item_world',
  };
}

export function createSkillForgeEntrance(): DungeonEntrance {
  return {
    id: SKILL_FORGE_TOWER_ID,
    worldX: 0,
    worldY: 4,
    seed: 31339,
    deepestFloor: 0,
    difficulty: 1,
    name: '✨ Skill Forge',
    discovered: false,
    theme: { kind: 'all' } as DungeonTheme,
    category: 'item_world',
  };
}

export function createAllItemWorldTowerEntrances(): Record<string, DungeonEntrance> {
  return {
    [PROTOTYPING_TOWER_ID]: createPrototypingTowerEntrance(),
    [TRAINING_TOWER_ID]: createTrainingTowerEntrance(),
    [SKILL_FORGE_TOWER_ID]: createSkillForgeEntrance(),
  };
}

export function isItemWorldTower(id: string): boolean {
  return id === PROTOTYPING_TOWER_ID ||
         id === TRAINING_TOWER_ID ||
         id === SKILL_FORGE_TOWER_ID;
}

export function getItemWorldTowerType(id: string): ItemWorldTowerType | null {
  if (id === PROTOTYPING_TOWER_ID) return 'prototyping';
  if (id === TRAINING_TOWER_ID) return 'training';
  if (id === SKILL_FORGE_TOWER_ID) return 'skill_creation';
  return null;
}

export function getItemWorldTowerIdForType(type: ItemWorldTowerType): string {
  if (type === 'prototyping') return PROTOTYPING_TOWER_ID;
  if (type === 'training') return TRAINING_TOWER_ID;
  return SKILL_FORGE_TOWER_ID;
}

/** Stable 31-bit hash of an arbitrary string. Used to derive a per-asset
 *  dungeon seed so the same item always produces the same maze. */
export function hashAssetSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h & 0x7fffffff;
}
