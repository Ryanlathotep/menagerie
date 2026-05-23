// Public emit/subscribe API for particle effects. Combat code calls
// `playParticleEffect(...)`; the <ParticleLayer> mounted in each renderer
// subscribes and animates.

import type { Monster } from '../types';
import type { Move } from '../moves';
import type { ParticleEffect } from './types';
import { resolveEffectFor, getEffect } from './registry';

export type Surface = 'dungeon' | 'overworld';

export interface ParticleEmitRequest {
  surface: Surface;
  /** Caster tile coords (origin). */
  from: { x: number; y: number };
  /** Primary target tile (single-target or AoE centre). */
  to: { x: number; y: number };
  /** All affected tiles (for rain/burst patterns). Defaults to [to]. */
  affected?: { x: number; y: number }[];
  effect: ParticleEffect;
  /** Caster — used to resolve 'auto' colors via element. */
  monster?: Monster | null;
  id: number;
  startedAt: number;
}

type Listener = (req: ParticleEmitRequest) => void;
const listeners = new Set<Listener>();
let nextId = 1;

export function subscribeParticles(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** High-level helper: resolves the effect for a (monster, move) pair. */
export function playParticleEffectForMove(opts: {
  surface: Surface;
  monster: Monster | null | undefined;
  move: Move;
  from: { x: number; y: number };
  to: { x: number; y: number };
  affected?: { x: number; y: number }[];
}) {
  const fx = resolveEffectFor(opts.monster, opts.move);
  playParticleEffect({ ...opts, effect: fx });
}

/** Low-level: emit any effect by reference. */
export function playParticleEffect(opts: {
  surface: Surface;
  effect: ParticleEffect;
  monster?: Monster | null;
  from: { x: number; y: number };
  to: { x: number; y: number };
  affected?: { x: number; y: number }[];
}) {
  const req: ParticleEmitRequest = {
    surface: opts.surface,
    from: opts.from,
    to: opts.to,
    affected: opts.affected ?? [opts.to],
    effect: opts.effect,
    monster: opts.monster,
    id: nextId++,
    startedAt: performance.now(),
  };
  listeners.forEach((l) => {
    try { l(req); } catch (e) { console.error('particle listener error', e); }
  });
}

/** Used by admin preview pane. */
export function playEffectById(id: string, surface: Surface, from: { x: number; y: number }, to: { x: number; y: number }) {
  const fx = getEffect(id);
  if (!fx) return;
  playParticleEffect({ surface, effect: fx, from, to });
}
