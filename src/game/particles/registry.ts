// Runtime registry for particle templates, effects, and the default-resolution
// chain. Hydrated on boot from game_data_overrides; mutated by admin edits.

import type { ParticleTemplate, ParticleEffect, ParticleDefaultKey } from './types';
import { BUILTIN_TEMPLATES, BUILTIN_EFFECTS, BUILTIN_DEFAULTS } from './defaults';
import type { Monster } from '../types';
import type { Move } from '../moves';

const templates = new Map<string, ParticleTemplate>();
const effects = new Map<string, ParticleEffect>();
const defaults = new Map<string, string>(); // key → effectId

// Seed built-ins.
function reseedBuiltins() {
  templates.clear();
  effects.clear();
  defaults.clear();
  for (const t of BUILTIN_TEMPLATES) templates.set(t.id, t);
  for (const e of BUILTIN_EFFECTS) effects.set(e.id, e);
  for (const [k, v] of Object.entries(BUILTIN_DEFAULTS)) defaults.set(k, v);
}
reseedBuiltins();

type Row = { data_key: string; data_value: Record<string, unknown> };

export function setParticleTemplateOverrides(rows: Row[]) {
  // Rehydrate built-ins so removed rows revert.
  for (const t of BUILTIN_TEMPLATES) templates.set(t.id, t);
  for (const r of rows) {
    const v = r.data_value as Partial<ParticleTemplate>;
    if (v && v.id) templates.set(v.id, { ...templates.get(v.id), ...v } as ParticleTemplate);
    else if (r.data_key) templates.set(r.data_key, v as ParticleTemplate);
  }
}

export function setParticleEffectOverrides(rows: Row[]) {
  for (const e of BUILTIN_EFFECTS) effects.set(e.id, e);
  for (const r of rows) {
    const v = r.data_value as Partial<ParticleEffect>;
    if (v && v.id) effects.set(v.id, { ...effects.get(v.id), ...v } as ParticleEffect);
    else if (r.data_key) effects.set(r.data_key, v as ParticleEffect);
  }
}

export function setParticleDefaultOverrides(rows: Row[]) {
  // Re-seed builtins so deletions revert.
  for (const [k, v] of Object.entries(BUILTIN_DEFAULTS)) defaults.set(k, v);
  for (const r of rows) {
    const v = r.data_value as { effectId?: string } | null;
    if (v && v.effectId) defaults.set(r.data_key, v.effectId);
    else defaults.delete(r.data_key);
  }
}

export function getAllTemplates(): ParticleTemplate[] {
  return Array.from(templates.values()).sort((a, b) => a.name.localeCompare(b.name));
}
export function getAllEffects(): ParticleEffect[] {
  return Array.from(effects.values()).sort((a, b) => a.name.localeCompare(b.name));
}
export function getAllDefaults(): Record<string, string> {
  return Object.fromEntries(defaults.entries());
}

export function getTemplate(id: string | undefined | null): ParticleTemplate | undefined {
  if (!id) return undefined;
  return templates.get(id);
}
export function getEffect(id: string | undefined | null): ParticleEffect | undefined {
  if (!id) return undefined;
  return effects.get(id);
}

// Local writes from admin UI (mirrors what overrides loader does for one row).
export function upsertTemplate(t: ParticleTemplate) { templates.set(t.id, t); }
export function deleteTemplate(id: string) {
  templates.delete(id);
  const b = BUILTIN_TEMPLATES.find((x) => x.id === id);
  if (b) templates.set(id, b);
}
export function upsertEffect(e: ParticleEffect) { effects.set(e.id, e); }
export function deleteEffect(id: string) {
  effects.delete(id);
  const b = BUILTIN_EFFECTS.find((x) => x.id === id);
  if (b) effects.set(id, b);
}
export function setDefault(key: string, effectId: string | null) {
  if (effectId) defaults.set(key, effectId);
  else {
    defaults.delete(key);
    if (BUILTIN_DEFAULTS[key as ParticleDefaultKey]) defaults.set(key, BUILTIN_DEFAULTS[key as ParticleDefaultKey]);
  }
}

/**
 * Resolve the particle effect for a (monster, move) pair.
 * Priority: admin per-move override > move.particleEffectId > element default >
 *           class default > species default > generic fallback.
 */
export function resolveEffectFor(monster: Monster | null | undefined, move: Move): ParticleEffect {
  // 1. Admin move override
  const adminMove = defaults.get(`move:${move.id}`);
  if (adminMove) {
    const fx = effects.get(adminMove);
    if (fx) return fx;
  }
  // 2. Move-authored
  const moveOwn = (move as Move & { particleEffectId?: string }).particleEffectId;
  if (moveOwn) {
    const fx = effects.get(moveOwn);
    if (fx) return fx;
  }
  // 3. Element default (move's element overrides monster's)
  const el = move.element ?? monster?.element;
  if (el) {
    const fx = effects.get(defaults.get(`element:${el}`) ?? '');
    if (fx) return fx;
  }
  // 4. Class default
  const cls = (monster as { class?: import('../types').ClassType } | undefined)?.class;
  if (cls) {
    const fx = effects.get(defaults.get(`class:${cls}`) ?? '');
    if (fx) return fx;
  }
  // 5. Species default
  const sp = monster?.species;
  if (sp) {
    const fx = effects.get(defaults.get(`species:${sp}`) ?? '');
    if (fx) return fx;
  }
  return effects.get('fx_generic')!;
}
