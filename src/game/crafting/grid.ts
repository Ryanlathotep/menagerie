// Pure grid logic: hashing, pattern matching, resolving a grid → item.

import { CRAFTING_MATERIALS, RARITY_MULTIPLIERS, type EquipmentStats, type Rarity } from '../equipment';
import { DEFAULT_BLUEPRINTS, getBlueprint } from './patterns';
import type { CraftGrid, GridSize, ItemBlueprint, PatternSlot, ResolvedCraft, StationContext } from './types';
import { getEffectiveMaterialEffect, getPerUnitForBlueprint } from './materialEffects';
import { resolveStationModifierStats, mergeStats } from './stationEffects';

// ---- Grid helpers ----
export function makeEmptyGrid(size: GridSize): CraftGrid {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => null));
}

export function cloneGrid(g: CraftGrid): CraftGrid {
  return g.map((row) => row.map((c) => (c ? { ...c } : null)));
}

/** Stable canonical hash of a grid (order-independent by position). */
export function hashGrid(g: CraftGrid): string {
  const parts: string[] = [];
  for (let r = 0; r < g.length; r++) {
    for (let c = 0; c < g[r].length; c++) {
      const cell = g[r][c];
      parts.push(cell ? `${r},${c}:${cell.materialId}x${cell.count}` : `${r},${c}:_`);
    }
  }
  return parts.join('|');
}

/** True if the material's type is in the pattern slot's acceptTypes. */
function cellMatches(materialId: string, slot: PatternSlot): boolean {
  const mat = CRAFTING_MATERIALS.find((m) => m.id === materialId);
  if (!mat) return false;
  return slot.acceptTypes.includes(mat.type);
}

/**
 * Try to locate a blueprint pattern inside the grid at any origin.
 * Returns the origin (row/col) where every pattern slot is satisfied,
 * or null if not present.
 */
export function findPatternOrigin(
  grid: CraftGrid,
  blueprint: ItemBlueprint,
): { row: number; col: number } | null {
  const size = grid.length;
  let maxDx = 0, maxDy = 0;
  for (const s of blueprint.pattern) {
    if (s.dx > maxDx) maxDx = s.dx;
    if (s.dy > maxDy) maxDy = s.dy;
  }
  for (let r = 0; r + maxDy < size; r++) {
    for (let c = 0; c + maxDx < size; c++) {
      let ok = true;
      for (const s of blueprint.pattern) {
        const cell = grid[r + s.dy]?.[c + s.dx];
        if (!cell || !cellMatches(cell.materialId, s)) { ok = false; break; }
      }
      if (ok) return { row: r, col: c };
    }
  }
  return null;
}

/** Find the first blueprint whose pattern matches this grid. */
export function detectBlueprint(grid: CraftGrid, blueprints = DEFAULT_BLUEPRINTS): {
  blueprint: ItemBlueprint;
  origin: { row: number; col: number };
} | null {
  // Prefer bigger patterns first so a chestplate isn't confused for a helm.
  const sorted = [...blueprints].sort((a, b) => b.pattern.length - a.pattern.length);
  for (const bp of sorted) {
    const origin = findPatternOrigin(grid, bp);
    if (origin) return { blueprint: bp, origin };
  }
  return null;
}

/** Resolve a grid into a concrete craftable item, or null if invalid. */
export function resolveGrid(grid: CraftGrid, station?: StationContext): ResolvedCraft | null {
  const match = detectBlueprint(grid);
  if (!match) return null;
  const { blueprint, origin } = match;

  // Mark which cells were consumed by the required pattern.
  const consumed = new Set<string>();
  for (const s of blueprint.pattern) {
    consumed.add(`${origin.row + s.dy},${origin.col + s.dx}`);
  }

  // Track base stats.
  const stats: Required<EquipmentStats> = {
    maxHp: 0, attack: 0, defense: 0, speed: 0, dodge: 0, special: 0, stamina: 0,
  };
  for (const [k, v] of Object.entries(blueprint.baseStats)) {
    if (typeof v === 'number') (stats as Record<string, number>)[k] += v;
  }

  // Add per-pattern-slot material contributions (required cells also count once
  // toward stats — otherwise using Iron in a Sword's blade slot wouldn't matter
  // versus using Copper). We use a small "required" contribution: 1x their
  // effect.
  const usedMap = new Map<string, number>();
  for (const s of blueprint.pattern) {
    const cell = grid[origin.row + s.dy][origin.col + s.dx]!;
    const eff = getEffectiveMaterialEffect(cell.materialId);
    for (const [k, v] of Object.entries(eff.perUnit)) {
      if (typeof v === 'number' && k in stats) (stats as Record<string, number>)[k] += v;
    }
    usedMap.set(cell.materialId, (usedMap.get(cell.materialId) ?? 0) + cell.count);
  }

  // Fillers: every non-consumed cell adds its effect per unit.
  const fillerBreakdown: ResolvedCraft['fillerBreakdown'] = [];
  let levelBonus = 0;
  const fillerCounts = new Map<string, number>();
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const cell = grid[r][c];
      if (!cell) continue;
      const key = `${r},${c}`;
      if (consumed.has(key)) continue;
      const eff = getEffectiveMaterialEffect(cell.materialId);
      for (const [k, v] of Object.entries(eff.perUnit)) {
        if (typeof v !== 'number') continue;
        if (k === 'levelBonus') levelBonus += v * cell.count;
        else if (k in stats) (stats as Record<string, number>)[k] += v * cell.count;
      }
      usedMap.set(cell.materialId, (usedMap.get(cell.materialId) ?? 0) + cell.count);
      fillerCounts.set(cell.materialId, (fillerCounts.get(cell.materialId) ?? 0) + cell.count);
    }
  }
  for (const [id, count] of fillerCounts) {
    fillerBreakdown.push({ materialId: id, count, label: getEffectiveMaterialEffect(id).label });
  }

  // Determine rarity from average material rarity multiplier.
  const usedRarities: Rarity[] = [];
  for (const [id] of usedMap) {
    const mat = CRAFTING_MATERIALS.find((m) => m.id === id);
    if (mat) usedRarities.push(mat.rarity);
  }
  const rarity: Rarity = pickRarity(usedRarities);

  // Round non-negative ints.
  const cleanStats: EquipmentStats = {};
  for (const [k, v] of Object.entries(stats)) {
    if (v > 0) (cleanStats as Record<string, number>)[k] = Math.round(v);
  }

  const usedMaterials = Array.from(usedMap.entries()).map(([materialId, quantity]) => ({
    materialId, quantity,
  }));

  // Station provenance: combine current station modifiers + inventor's frozen mods.
  const stationStatsCurrent = station ? resolveStationModifierStats(station.modifiers) : {};
  const stationStatsInventor = station?.inventor?.stationStats ?? {};
  const stationStats = mergeStats(stationStatsCurrent, stationStatsInventor);

  return {
    blueprint,
    hash: hashGrid(grid),
    name: '', // filled in by naming.ts (called from consumer)
    stats: cleanStats,
    stationStats: Object.keys(stationStats).length ? stationStats : undefined,
    levelBonus,
    usedMaterials,
    fillerBreakdown,
    rarity,
  };
}

function pickRarity(rarities: Rarity[]): Rarity {
  if (rarities.length === 0) return 'common';
  const avg =
    rarities.reduce((sum, r) => sum + (RARITY_MULTIPLIERS[r] ?? 1), 0) / rarities.length;
  if (avg >= 2.1) return 'legendary';
  if (avg >= 1.7) return 'epic';
  if (avg >= 1.4) return 'rare';
  if (avg >= 1.15) return 'uncommon';
  return 'common';
}

export { getBlueprint };
