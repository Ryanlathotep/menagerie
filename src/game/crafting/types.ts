// Grid-based crafting system — core types.
// A CraftGrid is a fixed-size sparse map of {row,col} -> materialId+count.
// A RecipePattern is the minimum required layout for an item blueprint.
// Fillers (extra materials in empty cells) grant per-material stat effects.

import type { EquipmentSlot, EquipmentStats, MaterialType, Rarity } from '../equipment';

export type GridSize = 3 | 4 | 5;

// Local alias so we don't create a circular type dep between equipment.ts
// and buildings.ts (equipment.ts imports crafting/types.ts).
export type CraftingStationKindLite = 'forge' | 'workbench' | 'brewing' | 'enchanting';

export interface CraftCell {
  materialId: string;
  count: number; // usually 1 per cell; stacks allow more
}

export type CraftGrid = (CraftCell | null)[][]; // grid[row][col]

export type SlotRole =
  | 'blade'     // sharp part — swords, daggers, axes
  | 'handle'    // grip
  | 'guard'     // metal reinforcement
  | 'binder'    // fabric/leather that ties things together
  | 'catalyst'  // magical component (essence/gem/mote)
  | 'base'      // liquid/herb base for potions
  | 'seal';     // sealing wax / paper for scrolls

export interface PatternSlot {
  dx: number; // 0-based offset within pattern bounding box
  dy: number;
  role: SlotRole;
  /** Any material whose MaterialType is in this list satisfies the slot. */
  acceptTypes: MaterialType[];
}

export type BlueprintCategory =
  | 'weapon_blade'   // sword/dagger/axe — receive blade fillers
  | 'weapon_ranged'  // bow/staff
  | 'armor_light'    // hide-based
  | 'armor_heavy'    // metal-based
  | 'accessory'      // ring/amulet
  | 'consumable'     // potion
  | 'scroll'         // scroll
  | 'building';      // craftable building kits (Town Hall only)

export interface ItemBlueprint {
  id: string;
  name: string;                 // e.g. "Dagger"
  icon: string;
  slot: EquipmentSlot | 'consumable' | 'scroll';
  category: BlueprintCategory;
  pattern: PatternSlot[];       // required cells
  baseStats: EquipmentStats;    // stats before fillers
  /** Minimum station tier grid size required to craft (3 = portable, 4 = station, 5 = master). */
  minGrid: GridSize;
  /** Consumables/scrolls need effectId + duration; we store loosely. */
  effectId?: string;
}

/** Per-unit stat delta a material contributes when placed as a filler. */
export interface MaterialEffect {
  /** Extra stats added per unit beyond the required-slot use. */
  perUnit: EquipmentStats & { levelBonus?: number; durabilityBonus?: number };
  /** Descriptive label ("+min damage", "+starting level"). */
  label: string;
  /** Which blueprint categories the effect applies to (empty = all). */
  categories?: BlueprintCategory[];
  /** Name prefix contributed by this material when it's the top filler (e.g. "Blazing "). */
  namePrefix?: string;
  /**
   * Per-blueprint overrides: when this material is used in the named blueprint,
   * these stat contributions REPLACE the default `perUnit`. Missing entries
   * fall through to the default.
   */
  perItemPerUnit?: Record<string, EquipmentStats & { levelBonus?: number; durabilityBonus?: number }>;
}

export interface ResolvedCraft {
  blueprint: ItemBlueprint;
  hash: string;                 // stable id of this exact grid
  name: string;                 // generated name
  stats: EquipmentStats;        // baseStats + all fillers
  stationStats?: EquipmentStats; // From current crafter's station modifiers + inventor's frozen modifiers
  levelBonus: number;
  usedMaterials: { materialId: string; quantity: number }[];
  fillerBreakdown: { materialId: string; count: number; label: string }[];
  rarity: Rarity;
}

/** Optional station context passed to `resolveGrid` for stat provenance. */
export interface StationContext {
  kind: CraftingStationKindLite | null;
  tier: 1 | 2 | 3 | 4 | 5;
  modifiers: { materialId: string; quantity: number }[];
  /** Inventor snapshot (from cloud recipe row). Always applied regardless of local station. */
  inventor?: {
    username: string;
    stationKind: CraftingStationKindLite | null;
    stationTier: 1 | 2 | 3 | 4 | 5;
    stationStats: EquipmentStats;
  };
}

export interface DiscoveredRecipe {
  hash: string;
  blueprintId: string;
  gridSize: GridSize;
  grid: CraftGrid;
  itemName: string;
  discoveredBy?: string | null; // username
  discoveredAt?: string;        // ISO
  worldSeed?: string | null;
  local?: boolean;              // discovered locally but not yet synced
  // Inventor's station snapshot — persists forever, added to any future craft.
  inventorStationKind?: CraftingStationKindLite | null;
  inventorStationTier?: 1 | 2 | 3 | 4 | 5;
  inventorStationStats?: EquipmentStats;
}
