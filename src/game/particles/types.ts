// Particle FX type definitions. Stored in `game_data_overrides`:
//   data_type='particle_template' — visual atoms (shape + color + size + image)
//   data_type='particle_effect'   — template + motion pattern + params
//   data_type='particle_default'  — { key: 'element:fire' | 'class:mage' | 'species:slime', effectId }

import type { ElementType, ClassType, SpeciesType } from '../types';

/** Built-in glyph shapes (drawn as SVG primitives). */
export type ParticleShape =
  | 'circle' | 'spark' | 'star' | 'diamond' | 'droplet'
  | 'flame' | 'leaf' | 'snowflake' | 'rune' | 'bolt' | 'cross' | 'ring';

export interface ParticleTemplate {
  id: string;
  name: string;
  /** Built-in shape. Ignored if `imageUrl` is set. */
  shape: ParticleShape;
  /** Hex (e.g. '#ff8800') or 'auto' (resolves to monster element color at runtime). */
  color: string;
  /** Hex secondary used for trails/glow. 'auto' supported. */
  glow?: string;
  /** Particle visual size in px at tileSize=32 — scales with tile. */
  size: number;
  opacity?: number;
  /** Optional uploaded image URL (replaces shape entirely). */
  imageUrl?: string;
  /** Optional admin description. */
  notes?: string;
}

/** Built-in motion patterns. New ones added in motions.ts. */
export type ParticleMotion =
  | 'projectile'    // line caster → target
  | 'burst'         // explode outward at target
  | 'rain'          // fall onto every affected tile from above
  | 'spiral'        // orbit caster then snap outward
  | 'beam'          // streaks along path with trail
  | 'wave'          // expanding ring from caster
  | 'arc'           // lobbed parabola
  | 'orbit'         // continuous orbit around caster (auras)
  | 'rise'          // particles rise from target tiles
  | 'swirl_strike'; // spiral toward target then burst

export interface ParticleEffect {
  id: string;
  name: string;
  templateId: string;
  motion: ParticleMotion;
  /** Number of particles spawned. Default 18. */
  count?: number;
  /** Effect duration in ms. Default 600. */
  duration?: number;
  /** 0–1 random angular/positional jitter. Default 0.3. */
  jitter?: number;
  /** Trail length in frames (0 = no trail). Default 0. */
  trail?: number;
  /** Optional color override (hex or 'auto'). */
  colorOverride?: string;
  /** Optional admin notes. */
  notes?: string;
  /** Marks built-ins so admin UI can flag them. */
  builtin?: boolean;
}

export type ParticleDefaultKey =
  | `element:${ElementType}`
  | `class:${ClassType}`
  | `species:${SpeciesType}`
  | `move:${string}`;        // admin per-move override key
