// Resolve station modifier stats and inventor bonus stats into an item's
// separate `stationStats` bucket. Kept independent from grid.ts so it can
// be invoked either at craft time (workshop) or later at inspection time.

import type { EquipmentStats } from '../equipment';
import { getEffectiveMaterialEffect } from './materialEffects';

/** Multiply station modifier stats vs plain grid fillers so stations "feel". */
const MODIFIER_STAT_MULTIPLIER = 2;

/** Sum up stat contributions from a list of station modifier materials. */
export function resolveStationModifierStats(
  modifiers: { materialId: string; quantity: number }[],
): EquipmentStats {
  const out: Record<string, number> = {};
  for (const m of modifiers) {
    const eff = getEffectiveMaterialEffect(m.materialId);
    for (const [k, v] of Object.entries(eff.perUnit)) {
      if (typeof v !== 'number') continue;
      if (k === 'levelBonus' || k === 'durabilityBonus') continue;
      out[k] = (out[k] ?? 0) + v * m.quantity * MODIFIER_STAT_MULTIPLIER;
    }
  }
  const rounded: EquipmentStats = {};
  for (const [k, v] of Object.entries(out)) {
    if (v > 0) (rounded as Record<string, number>)[k] = Math.round(v);
  }
  return rounded;
}

/** Merge multiple EquipmentStats objects (used for previews). */
export function mergeStats(...parts: (EquipmentStats | undefined)[]): EquipmentStats {
  const out: Record<string, number> = {};
  for (const p of parts) {
    if (!p) continue;
    for (const [k, v] of Object.entries(p)) {
      if (typeof v === 'number') out[k] = (out[k] ?? 0) + v;
    }
  }
  return out as EquipmentStats;
}
