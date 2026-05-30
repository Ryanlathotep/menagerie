// Resource Hierarchy System - Trees and stones upgrade over time
// Trees: Oak → Maple → Elder Oak
// Stones: Stone → Copper → Iron → Gold → Mithril
import { getOverworldGen } from './worldGenConfig';


export type TreeTier = 'oak' | 'maple' | 'elder_oak';
export type StoneTier = 'stone' | 'copper' | 'iron' | 'gold' | 'mithril';
export type ResourceTier = TreeTier | StoneTier;

export interface ResourceTierData {
  name: string;
  emoji: string;
  harvestYield: number;         // Base amount per harvest hit
  totalHits: number;            // Hits to fully deplete
  upgradeSteps: number | null;  // Player steps until upgrade (null = max tier)
  materialId?: string;          // Special material dropped (in addition to wood/stone)
  materialChance?: number;      // Chance (0-1) to drop special material per hit
}

// ============= TREE TIERS =============

export const TREE_TIERS: TreeTier[] = ['oak', 'maple', 'elder_oak'];

export const TREE_TIER_DATA: Record<TreeTier, ResourceTierData> = {
  oak: {
    name: 'Oak',
    emoji: '🌳',
    harvestYield: 1,
    totalHits: 3,
    upgradeSteps: 200,
  },
  maple: {
    name: 'Maple',
    emoji: '🍁',
    harvestYield: 2,
    totalHits: 4,
    upgradeSteps: 400,
    materialId: 'maple_sap',
    materialChance: 0.3,
  },
  elder_oak: {
    name: 'Elder Oak',
    emoji: '🌲',
    harvestYield: 3,
    totalHits: 5,
    upgradeSteps: null, // Max tier
    materialId: 'elder_bark',
    materialChance: 0.4,
  },
};

// ============= STONE TIERS =============

export const STONE_TIERS: StoneTier[] = ['stone', 'copper', 'iron', 'gold', 'mithril'];

export const STONE_TIER_DATA: Record<StoneTier, ResourceTierData> = {
  stone: {
    name: 'Stone',
    emoji: '🪨',
    harvestYield: 1,
    totalHits: 3,
    upgradeSteps: 150,
  },
  copper: {
    name: 'Copper Ore',
    emoji: '🟤',
    harvestYield: 1,
    totalHits: 4,
    upgradeSteps: 300,
    materialId: 'copper_ore',
    materialChance: 0.5,
  },
  iron: {
    name: 'Iron Ore',
    emoji: '⬛',
    harvestYield: 2,
    totalHits: 4,
    upgradeSteps: 500,
    materialId: 'iron_ore',
    materialChance: 0.5,
  },
  gold: {
    name: 'Gold Vein',
    emoji: '🟡',
    harvestYield: 2,
    totalHits: 5,
    upgradeSteps: 800,
    materialId: 'gold_ore',
    materialChance: 0.6,
  },
  mithril: {
    name: 'Mithril Deposit',
    emoji: '💎',
    harvestYield: 3,
    totalHits: 6,
    upgradeSteps: null, // Max tier
    materialId: 'mithril_ore',
    materialChance: 0.7,
  },
};

// ============= TIER COLORS (for tile rendering) =============

export const TREE_TIER_COLORS: Record<TreeTier, { canopy: string; canopy2: string; trunk: string }> = {
  oak: { canopy: 'hsl(130 45% 35%)', canopy2: 'hsl(120 50% 40%)', trunk: 'hsl(25 45% 35%)' },
  maple: { canopy: 'hsl(15 70% 50%)', canopy2: 'hsl(30 75% 55%)', trunk: 'hsl(20 50% 30%)' },
  elder_oak: { canopy: 'hsl(150 55% 25%)', canopy2: 'hsl(160 45% 30%)', trunk: 'hsl(25 40% 25%)' },
};

export const STONE_TIER_COLORS: Record<StoneTier, { main: string; highlight: string; vein: string }> = {
  stone: { main: 'hsl(220 10% 50%)', highlight: 'hsl(210 8% 70%)', vein: 'hsl(220 10% 40%)' },
  copper: { main: 'hsl(25 60% 45%)', highlight: 'hsl(30 55% 60%)', vein: 'hsl(20 65% 35%)' },
  iron: { main: 'hsl(220 15% 40%)', highlight: 'hsl(215 12% 55%)', vein: 'hsl(0 0% 30%)' },
  gold: { main: 'hsl(45 80% 50%)', highlight: 'hsl(50 85% 65%)', vein: 'hsl(40 75% 40%)' },
  mithril: { main: 'hsl(200 60% 60%)', highlight: 'hsl(195 70% 75%)', vein: 'hsl(210 55% 50%)' },
};

// ============= HELPER FUNCTIONS =============

export function getNextTreeTier(current: TreeTier): TreeTier | null {
  const idx = TREE_TIERS.indexOf(current);
  return idx < TREE_TIERS.length - 1 ? TREE_TIERS[idx + 1] : null;
}

export function getNextStoneTier(current: StoneTier): StoneTier | null {
  const idx = STONE_TIERS.indexOf(current);
  return idx < STONE_TIERS.length - 1 ? STONE_TIERS[idx + 1] : null;
}

// Determine initial tier based on distance from origin and biome
export function getInitialTreeTier(worldX: number, worldY: number, tileSeed: number): TreeTier {
  const dist = Math.sqrt(worldX * worldX + worldY * worldY);
  const r = seededRandom(tileSeed + 7777);
  const cfg = getOverworldGen().treeTierRolls;
  if (dist > cfg.elderOak.minDist && r < cfg.elderOak.chance) return 'elder_oak';
  if (dist > cfg.maple.minDist && r < cfg.maple.chance) return 'maple';
  return 'oak';
}

export function getInitialStoneTier(worldX: number, worldY: number, tileSeed: number): StoneTier {
  const dist = Math.sqrt(worldX * worldX + worldY * worldY);
  const r = seededRandom(tileSeed + 8888);
  const cfg = getOverworldGen().stoneTierRolls;
  if (dist > cfg.mithril.minDist && r < cfg.mithril.chance) return 'mithril';
  if (dist > cfg.gold.minDist && r < cfg.gold.chance) return 'gold';
  if (dist > cfg.iron.minDist && r < cfg.iron.chance) return 'iron';
  if (dist > cfg.copper.minDist && r < cfg.copper.chance) return 'copper';
  return 'stone';
}



function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// Apply ±40% jitter to a base step count so a freshly-generated cluster of
// trees/stones doesn't all upgrade on the same tick. Deterministic per tile.
export function jitterUpgradeSteps(baseSteps: number, worldX: number, worldY: number, salt = 0): number {
  if (baseSteps <= 0) return baseSteps;
  const r = seededRandom(worldX * 374761393 + worldY * 668265263 + salt + 9173);
  const factor = 0.6 + r * 0.8; // 0.6x — 1.4x
  return Math.max(1, Math.round(baseSteps * factor));
}

// ============= RESOURCE UPGRADE TRACKING =============
// Stored in OverworldState, keyed by "x,y"

export interface ResourceUpgradeState {
  treeTier?: TreeTier;
  stoneTier?: StoneTier;
  stepsUntilUpgrade: number; // Steps remaining until next tier
}

// Tick all tracked resources. Called each player step.
// Returns list of upgrades that happened.
export function tickResourceUpgrades(
  resources: Record<string, ResourceUpgradeState>,
): { key: string; type: 'tree' | 'stone'; newTier: ResourceTier }[] {
  const upgrades: { key: string; type: 'tree' | 'stone'; newTier: ResourceTier }[] = [];

  for (const [key, res] of Object.entries(resources)) {
    if (res.stepsUntilUpgrade <= 0) continue; // Already at max or not set

    res.stepsUntilUpgrade -= 1;
    if (res.stepsUntilUpgrade <= 0) {
      const [kx, ky] = key.split(',').map(Number);
      if (res.treeTier) {
        const next = getNextTreeTier(res.treeTier);
        if (next) {
          res.treeTier = next;
          const tierData = TREE_TIER_DATA[next];
          // Jitter the next-tier countdown so siblings don't re-sync.
          res.stepsUntilUpgrade = tierData.upgradeSteps
            ? jitterUpgradeSteps(tierData.upgradeSteps, kx, ky, 1)
            : 0;
          upgrades.push({ key, type: 'tree', newTier: next });
        }
      } else if (res.stoneTier) {
        const next = getNextStoneTier(res.stoneTier);
        if (next) {
          res.stoneTier = next;
          const tierData = STONE_TIER_DATA[next];
          res.stepsUntilUpgrade = tierData.upgradeSteps
            ? jitterUpgradeSteps(tierData.upgradeSteps, kx, ky, 2)
            : 0;
          upgrades.push({ key, type: 'stone', newTier: next });
        }
      }
    }
  }

  return upgrades;
}

// Get display name for a resource tile
export function getResourceDisplayName(tier: ResourceTier): string {
  if (tier in TREE_TIER_DATA) return TREE_TIER_DATA[tier as TreeTier].name;
  if (tier in STONE_TIER_DATA) return STONE_TIER_DATA[tier as StoneTier].name;
  return 'Unknown';
}
