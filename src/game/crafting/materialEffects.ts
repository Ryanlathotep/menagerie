// Per-material filler effects. When a material sits in an EMPTY cell (not
// required by the pattern), each unit contributes these stat deltas — scaled
// by material rarity. Admins can override individual materials in Supabase.

import { CRAFTING_MATERIALS, RARITY_MULTIPLIERS, type MaterialType } from '../equipment';
import type { MaterialEffect } from './types';

const TYPE_DEFAULTS: Record<MaterialType, MaterialEffect> = {
  ore:      { perUnit: { attack: 1 },            label: '+1 min damage' },
  metal:    { perUnit: { attack: 2, defense: 1 },label: '+2 attack / +1 defense' },
  wood:     { perUnit: { speed: 1 },             label: '+1 speed' },
  bone:     { perUnit: { attack: 1, maxHp: 2 }, label: '+1 attack / +2 HP' },
  hide:     { perUnit: { maxHp: 4, defense: 1 },label: '+4 HP / +1 defense' },
  fabric:   { perUnit: { dodge: 1 },             label: '+1 dodge' },
  herb:     { perUnit: { stamina: 2 },           label: '+2 stamina' },
  essence:  { perUnit: { special: 2 },           label: '+2 special' },
  mote:     { perUnit: { special: 1 },           label: '+1 special' },
  gem:      { perUnit: { special: 3, levelBonus: 1 }, label: '+3 special / +1 level' },
  monster:  { perUnit: { attack: 3, maxHp: 3 }, label: '+3 attack / +3 HP' },
  species:  { perUnit: { special: 2 },           label: '+2 special (species-aligned)' },
  class:    { perUnit: { attack: 2 },            label: '+2 attack (class-aligned)' },
  element:  { perUnit: { special: 4 },           label: '+4 special (elemental)' },
  rune:     { perUnit: { special: 3, defense: 2 },label: '+3 special / +2 defense' },
  soil:     { perUnit: { maxHp: 1 },             label: '+1 HP' },
  seed:     { perUnit: { stamina: 1 },           label: '+1 stamina' },
};

// Per-material overrides — special cases (Gold Ore boosts starting level,
// Diamond gives huge stats, etc.). Any material not listed here falls back
// to its MaterialType default above.
const MATERIAL_OVERRIDES: Record<string, Partial<MaterialEffect>> = {
  gold_ore:     { perUnit: { levelBonus: 1, attack: 1 }, label: '+1 starting level' },
  mythril_ore:  { perUnit: { attack: 3, special: 2 },    label: '+3 attack / +2 special' },
  adamant_ore:  { perUnit: { attack: 5, defense: 3 },    label: '+5 attack / +3 defense' },
  diamond:      { perUnit: { special: 6, levelBonus: 1 },label: '+6 special / +1 level' },
  prismatic_gem:{ perUnit: { special: 10, levelBonus: 2 }, label: '+10 special / +2 level' },
  dragon_heart: { perUnit: { attack: 8, maxHp: 20 },     label: '+8 attack / +20 HP' },
  phoenix_flower:{ perUnit: { maxHp: 15 },               label: '+15 HP' },
};

/** Get the *effective* effect for a material id (applies rarity multiplier). */
export function getMaterialEffect(materialId: string): MaterialEffect {
  const mat = CRAFTING_MATERIALS.find((m) => m.id === materialId);
  if (!mat) return { perUnit: {}, label: 'no effect' };
  const base = TYPE_DEFAULTS[mat.type] ?? { perUnit: {}, label: 'no effect' };
  const override = MATERIAL_OVERRIDES[materialId];
  const merged: MaterialEffect = override
    ? { perUnit: { ...base.perUnit, ...override.perUnit }, label: override.label ?? base.label }
    : base;
  const mult = RARITY_MULTIPLIERS[mat.rarity] ?? 1;
  const scaled: MaterialEffect['perUnit'] = {};
  for (const [k, v] of Object.entries(merged.perUnit)) {
    if (typeof v === 'number') (scaled as Record<string, number>)[k] = Math.round(v * mult);
  }
  return { perUnit: scaled, label: merged.label };
}

// ---------------- Admin overrides ----------------
// The admin editor persists per-material overrides in game_data_overrides
// under data_type='material_effect'. We expose a setter/getter so the
// hook can inject them before resolve() is called.
const runtimeOverrides = new Map<string, MaterialEffect>();

export function setMaterialEffectOverride(id: string, eff: MaterialEffect | null) {
  if (!eff) runtimeOverrides.delete(id);
  else runtimeOverrides.set(id, eff);
}

export function getEffectiveMaterialEffect(id: string): MaterialEffect {
  return runtimeOverrides.get(id) ?? getMaterialEffect(id);
}

export function listDefaultEffects(): Array<{ id: string; effect: MaterialEffect }> {
  return CRAFTING_MATERIALS.map((m) => ({ id: m.id, effect: getMaterialEffect(m.id) }));
}
