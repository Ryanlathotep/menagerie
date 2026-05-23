// Built-in particle templates, effects, and per-(element/class/species)
// default assignments. Admins can override any of these via game_data_overrides.

import { ELEMENT_COLORS } from '../types';
import type { ParticleTemplate, ParticleEffect, ParticleDefaultKey } from './types';
import type { ElementType, ClassType, SpeciesType } from '../types';

const hsl = (raw: string) => `hsl(${raw})`;

// ── Templates ──────────────────────────────────────────────────────────────
// One per element (12 mapped from 6 element types via colors).
function elementTemplate(el: ElementType, shape: ParticleTemplate['shape']): ParticleTemplate {
  return {
    id: `tpl_el_${el}`,
    name: `${el} ${shape}`,
    shape,
    color: hsl(ELEMENT_COLORS[el].primary),
    glow: hsl(ELEMENT_COLORS[el].secondary),
    size: 7,
    opacity: 0.95,
  };
}

const ELEMENT_SHAPES: Record<ElementType, ParticleTemplate['shape']> = {
  normal: 'spark',
  fire: 'flame',
  water: 'droplet',
  earth: 'diamond',
  air: 'snowflake',
  void: 'rune',
};

const CLASS_SHAPES: Record<ClassType, ParticleTemplate['shape']> = {
  normal: 'circle',
  kinetic: 'bolt',
  energy: 'star',
  biological: 'leaf',
  chemical: 'droplet',
  political: 'cross',
};

const CLASS_COLORS: Record<ClassType, string> = {
  normal: '#cccccc',
  kinetic: '#f5a623',
  energy: '#7df9ff',
  biological: '#7ed957',
  chemical: '#b266ff',
  political: '#ffd700',
};

const SPECIES_SHAPES: Record<SpeciesType, ParticleTemplate['shape']> = {
  slime: 'droplet', skeleton: 'cross', goblin: 'spark', mushroom: 'circle', ghost: 'ring',
  imp: 'flame', golem: 'diamond', wisp: 'star', chimera: 'bolt', dragon: 'flame',
  rat: 'spark', spider: 'star', bat: 'leaf', snake: 'spark', wolf: 'bolt',
  beetle: 'diamond', crow: 'leaf', shark: 'droplet', frog: 'circle', jellyfish: 'ring',
};

export const BUILTIN_TEMPLATES: ParticleTemplate[] = [
  // element-coloured atoms
  ...(Object.keys(ELEMENT_SHAPES) as ElementType[]).map((el) =>
    elementTemplate(el, ELEMENT_SHAPES[el])
  ),
  // class atoms
  ...(Object.keys(CLASS_SHAPES) as ClassType[]).map((cls) => ({
    id: `tpl_cls_${cls}`,
    name: `${cls} sigil`,
    shape: CLASS_SHAPES[cls],
    color: CLASS_COLORS[cls],
    glow: CLASS_COLORS[cls],
    size: 6,
    opacity: 0.9,
  } satisfies ParticleTemplate)),
  // species atoms — share class palette as a default tint
  ...(Object.keys(SPECIES_SHAPES) as SpeciesType[]).map((sp) => ({
    id: `tpl_sp_${sp}`,
    name: `${sp} motif`,
    shape: SPECIES_SHAPES[sp],
    color: 'auto', // resolves to caster element color
    glow: 'auto',
    size: 6,
    opacity: 0.85,
  } satisfies ParticleTemplate)),
  // generic fallback
  { id: 'tpl_generic', name: 'Generic spark', shape: 'spark', color: 'auto', glow: 'auto', size: 6, opacity: 0.9 },
];

// ── Effects ────────────────────────────────────────────────────────────────
// Each element gets a thematic motion preset. Class/species fall back to projectile/orbit.
const ELEMENT_MOTION: Record<ElementType, ParticleEffect['motion']> = {
  normal: 'projectile',
  fire: 'projectile',
  water: 'rain',
  earth: 'arc',
  air: 'wave',
  void: 'spiral',
};

export const BUILTIN_EFFECTS: ParticleEffect[] = [
  ...(Object.keys(ELEMENT_SHAPES) as ElementType[]).map((el) => ({
    id: `fx_el_${el}`,
    name: `${el} default`,
    templateId: `tpl_el_${el}`,
    motion: ELEMENT_MOTION[el],
    count: el === 'air' ? 22 : 16,
    duration: 650,
    jitter: 0.35,
    trail: el === 'fire' || el === 'void' ? 3 : 0,
    builtin: true,
  } satisfies ParticleEffect)),
  ...(Object.keys(CLASS_SHAPES) as ClassType[]).map((cls) => ({
    id: `fx_cls_${cls}`,
    name: `${cls} default`,
    templateId: `tpl_cls_${cls}`,
    motion: cls === 'energy' ? 'beam' : cls === 'kinetic' ? 'swirl_strike' : 'projectile',
    count: 14,
    duration: 600,
    jitter: 0.3,
    trail: cls === 'energy' ? 4 : 0,
    builtin: true,
  } satisfies ParticleEffect)),
  ...(Object.keys(SPECIES_SHAPES) as SpeciesType[]).map((sp) => ({
    id: `fx_sp_${sp}`,
    name: `${sp} default`,
    templateId: `tpl_sp_${sp}`,
    motion: 'projectile' as const,
    count: 12,
    duration: 580,
    jitter: 0.35,
    builtin: true,
  } satisfies ParticleEffect)),
  { id: 'fx_generic', name: 'Generic spark', templateId: 'tpl_generic', motion: 'projectile', count: 12, duration: 500, builtin: true },
];

// ── Default chain ──────────────────────────────────────────────────────────
export const BUILTIN_DEFAULTS: Record<ParticleDefaultKey, string> = {
  ...Object.fromEntries(
    (Object.keys(ELEMENT_SHAPES) as ElementType[]).map((el) => [`element:${el}`, `fx_el_${el}`])
  ),
  ...Object.fromEntries(
    (Object.keys(CLASS_SHAPES) as ClassType[]).map((cls) => [`class:${cls}`, `fx_cls_${cls}`])
  ),
  ...Object.fromEntries(
    (Object.keys(SPECIES_SHAPES) as SpeciesType[]).map((sp) => [`species:${sp}`, `fx_sp_${sp}`])
  ),
} as Record<ParticleDefaultKey, string>;
