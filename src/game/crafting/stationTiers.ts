// Station tier ladder — shared by physical crafting buildings and their
// portable variants. Higher tier = bigger grid + more modifier slots.
//
// Buildings persist their tier + modifiers in PlayerBuilding.
// Portables freeze their tier + modifiers at craft time on the tool item.

import type { CraftingStationKind } from '../buildings';
import type { GridSize } from './types';

export type StationTier = 1 | 2 | 3 | 4 | 5;

export const STATION_TIER_ORDER: StationTier[] = [1, 2, 3, 4, 5];

export interface StationTierData {
  tier: StationTier;
  label: string;                                    // "Tier II — Uncommon"
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  grid: GridSize;                                   // grid size unlocked
  modifierSlots: number;                            // # station modifier chips
  namePrefix: string;                               // prepended to crafted item names when tier >= 3
  color: string;                                    // tailwind text class for badge
  /** Upgrade cost (materials + stone/wood) required to reach THIS tier from prev. */
  upgradeCost: {
    wood: number;
    stone: number;
    materials: { materialId: string; quantity: number }[];
  };
}

// Per-discipline "themed" material used for tier upgrades. Falls back cleanly
// if the player is missing the exact material — costs are looked up on the
// discipline map below.
const DISCIPLINE_MATERIALS: Record<CraftingStationKind, string[]> = {
  // idx = tier-2 (T2 upgrade = idx 0, T3 = idx 1, etc.)
  forge:      ['iron_ore',    'iron_ore',      'mythril_ore',   'adamant_ore',    'dragon_heart'],
  workbench:  ['hardwood',    'hardwood',      'ironwood',      'ironwood',       'phoenix_flower'],
  brewing:    ['herb_bundle', 'normal_essence','fire_pepper',   'void_spore',     'phoenix_flower'],
  enchanting: ['normal_essence','gem_shard',   'diamond',       'prismatic_gem',  'prismatic_gem'],
};

function buildTiers(kind: CraftingStationKind): Record<StationTier, StationTierData> {
  const mats = DISCIPLINE_MATERIALS[kind];
  const mk = (
    tier: StationTier,
    rarity: StationTierData['rarity'],
    grid: GridSize,
    slots: number,
    prefix: string,
    color: string,
  ): StationTierData => {
    const base = 10 * tier * tier;
    const matId = mats[tier - 2]; // undefined for T1
    return {
      tier, rarity, grid, modifierSlots: slots, namePrefix: prefix, color,
      label: `Tier ${['I','II','III','IV','V'][tier - 1]} — ${rarity[0].toUpperCase()}${rarity.slice(1)}`,
      upgradeCost: {
        wood: tier === 1 ? 0 : base,
        stone: tier === 1 ? 0 : base,
        materials: matId ? [{ materialId: matId, quantity: Math.max(2, tier * 2) }] : [],
      },
    };
  };
  return {
    1: mk(1, 'common',    3, 0, '',            'text-muted-foreground'),
    2: mk(2, 'uncommon',  3, 1, 'Fine ',       'text-green-400'),
    3: mk(3, 'rare',      4, 2, 'Superior ',   'text-blue-400'),
    4: mk(4, 'epic',      4, 3, 'Masterwork ', 'text-purple-400'),
    5: mk(5, 'legendary', 5, 4, 'Legendary ',  'text-amber-400'),
  };
}

export const STATION_TIERS: Record<CraftingStationKind, Record<StationTier, StationTierData>> = {
  forge:      buildTiers('forge'),
  workbench:  buildTiers('workbench'),
  brewing:    buildTiers('brewing'),
  enchanting: buildTiers('enchanting'),
};

export function getStationTierData(kind: CraftingStationKind, tier: StationTier): StationTierData {
  return STATION_TIERS[kind][tier];
}

export function getGridForTier(tier: StationTier): GridSize {
  return STATION_TIERS.forge[tier].grid;
}

export function getModifierSlotsForTier(tier: StationTier): number {
  return STATION_TIERS.forge[tier].modifierSlots;
}

export function getTierNamePrefix(tier: StationTier): string {
  return STATION_TIERS.forge[tier].namePrefix;
}
