// Motion patterns. Each returns a function (t: 0..1, i: index, total: count)
// → { x, y, opacity, scale, rotate } in pixel-space relative to the layer.
//
// Inputs are pre-converted to pixel coords by the layer using its tileSize.

import type { ParticleMotion } from './types';

export interface MotionInput {
  fromPx: { x: number; y: number };
  toPx: { x: number; y: number };
  affectedPx: { x: number; y: number }[];
  tileSize: number;
  count: number;
  jitter: number;
  rngSeed: number;
}

export interface ParticleFrame {
  x: number; y: number;
  opacity: number;
  scale: number;
  rotate: number;
}

// Deterministic per-particle pseudo-random in [0,1).
function rand(seed: number, i: number, salt = 0): number {
  const h = Math.sin(seed * 9301 + i * 49297 + salt * 233280.7) * 43758.5453;
  return h - Math.floor(h);
}

export type MotionFn = (t: number, i: number, input: MotionInput) => ParticleFrame;

const projectile: MotionFn = (t, i, inp) => {
  const j = (rand(inp.rngSeed, i) - 0.5) * inp.jitter * inp.tileSize * 0.6;
  const j2 = (rand(inp.rngSeed, i, 1) - 0.5) * inp.jitter * inp.tileSize * 0.6;
  const dx = inp.toPx.x - inp.fromPx.x;
  const dy = inp.toPx.y - inp.fromPx.y;
  // Stagger by index so particles trail
  const local = Math.min(1, Math.max(0, t * 1.2 - (i / inp.count) * 0.2));
  return {
    x: inp.fromPx.x + dx * local + j * (1 - local),
    y: inp.fromPx.y + dy * local + j2 * (1 - local),
    opacity: local < 1 ? 1 - Math.pow(local, 3) * 0.3 : 0,
    scale: 1,
    rotate: t * 360 + i * 30,
  };
};

const beam: MotionFn = (t, i, inp) => {
  const along = (i / inp.count); // each particle sits at a fraction of the line
  const dx = inp.toPx.x - inp.fromPx.x;
  const dy = inp.toPx.y - inp.fromPx.y;
  const sweep = Math.min(1, t * 1.5);
  const visible = along <= sweep ? 1 : 0;
  const j = (rand(inp.rngSeed, i) - 0.5) * inp.jitter * inp.tileSize * 0.3;
  // Perp jitter
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len, py = dx / len;
  return {
    x: inp.fromPx.x + dx * along + px * j,
    y: inp.fromPx.y + dy * along + py * j,
    opacity: visible * (1 - Math.max(0, t - 0.7) / 0.3),
    scale: 1,
    rotate: 0,
  };
};

const burst: MotionFn = (t, i, inp) => {
  const angle = (i / inp.count) * Math.PI * 2 + rand(inp.rngSeed, i) * inp.jitter;
  const radius = t * inp.tileSize * 1.4 * (0.6 + rand(inp.rngSeed, i, 1) * 0.8);
  return {
    x: inp.toPx.x + Math.cos(angle) * radius,
    y: inp.toPx.y + Math.sin(angle) * radius,
    opacity: 1 - t,
    scale: 1 + t * 0.5,
    rotate: angle * 60,
  };
};

const rain: MotionFn = (t, i, inp) => {
  const tile = inp.affectedPx[i % inp.affectedPx.length] ?? inp.toPx;
  const stagger = (i / inp.count) * 0.4;
  const local = Math.min(1, Math.max(0, (t - stagger) / (1 - stagger)));
  const startY = tile.y - inp.tileSize * 2.5;
  const jx = (rand(inp.rngSeed, i) - 0.5) * inp.tileSize * 0.5;
  return {
    x: tile.x + jx,
    y: startY + (tile.y - startY) * local,
    opacity: local > 0 ? (1 - Math.pow(local, 4) * 0.5) : 0,
    scale: 1,
    rotate: 0,
  };
};

const spiral: MotionFn = (t, i, inp) => {
  const angle = (i / inp.count) * Math.PI * 2 + t * Math.PI * 4;
  const radius = inp.tileSize * 0.8 * (1 - t) + inp.tileSize * 0.2;
  // Lerp center from caster to target as t goes 0→1
  const cx = inp.fromPx.x + (inp.toPx.x - inp.fromPx.x) * t;
  const cy = inp.fromPx.y + (inp.toPx.y - inp.fromPx.y) * t;
  return {
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius,
    opacity: 1 - Math.pow(t, 2),
    scale: 1 - t * 0.4,
    rotate: angle * 57,
  };
};

const wave: MotionFn = (t, i, inp) => {
  const angle = (i / inp.count) * Math.PI * 2;
  const radius = t * inp.tileSize * 3.5;
  return {
    x: inp.fromPx.x + Math.cos(angle) * radius,
    y: inp.fromPx.y + Math.sin(angle) * radius,
    opacity: (1 - t) * 0.9,
    scale: 1,
    rotate: angle * 30,
  };
};

const arc: MotionFn = (t, i, inp) => {
  const stagger = (i / inp.count) * 0.2;
  const local = Math.min(1, Math.max(0, t * 1.2 - stagger));
  const dx = inp.toPx.x - inp.fromPx.x;
  const dy = inp.toPx.y - inp.fromPx.y;
  const x = inp.fromPx.x + dx * local;
  const y = inp.fromPx.y + dy * local - Math.sin(local * Math.PI) * inp.tileSize * 1.5;
  const j = (rand(inp.rngSeed, i) - 0.5) * inp.jitter * inp.tileSize * 0.4;
  return {
    x: x + j, y,
    opacity: local < 1 ? 1 : 0,
    scale: 1,
    rotate: local * 540,
  };
};

const orbit: MotionFn = (t, i, inp) => {
  const angle = (i / inp.count) * Math.PI * 2 + t * Math.PI * 2;
  const radius = inp.tileSize * 0.9;
  return {
    x: inp.fromPx.x + Math.cos(angle) * radius,
    y: inp.fromPx.y + Math.sin(angle) * radius,
    opacity: 1 - Math.max(0, t - 0.7) / 0.3,
    scale: 1,
    rotate: angle * 57,
  };
};

const rise: MotionFn = (t, i, inp) => {
  const tile = inp.affectedPx[i % inp.affectedPx.length] ?? inp.toPx;
  const stagger = (i / inp.count) * 0.4;
  const local = Math.min(1, Math.max(0, (t - stagger) / (1 - stagger)));
  const jx = (rand(inp.rngSeed, i) - 0.5) * inp.tileSize * 0.5;
  return {
    x: tile.x + jx,
    y: tile.y - local * inp.tileSize * 2.5,
    opacity: local > 0 ? 1 - local : 0,
    scale: 1 - local * 0.3,
    rotate: 0,
  };
};

const swirlStrike: MotionFn = (t, i, inp) => {
  if (t < 0.5) {
    // Spiral around caster
    const tt = t / 0.5;
    const angle = (i / inp.count) * Math.PI * 2 + tt * Math.PI * 3;
    const radius = inp.tileSize * 0.9 * (1 - tt * 0.5);
    return {
      x: inp.fromPx.x + Math.cos(angle) * radius,
      y: inp.fromPx.y + Math.sin(angle) * radius,
      opacity: 1,
      scale: 1,
      rotate: angle * 57,
    };
  }
  // Snap to target
  const tt = (t - 0.5) / 0.5;
  const angle = (i / inp.count) * Math.PI * 2;
  const radius = tt * inp.tileSize * 1.2;
  return {
    x: inp.toPx.x + Math.cos(angle) * radius,
    y: inp.toPx.y + Math.sin(angle) * radius,
    opacity: 1 - tt,
    scale: 1 + tt * 0.4,
    rotate: angle * 80,
  };
};

export const MOTIONS: Record<ParticleMotion, MotionFn> = {
  projectile, beam, burst, rain, spiral, wave, arc, orbit, rise,
  swirl_strike: swirlStrike,
};

export const MOTION_OPTIONS: { value: ParticleMotion; label: string; desc: string }[] = [
  { value: 'projectile', label: 'Projectile', desc: 'Shoots from caster toward target.' },
  { value: 'beam', label: 'Beam', desc: 'Streaking line of particles, caster → target.' },
  { value: 'burst', label: 'Burst', desc: 'Explodes outward from the target tile.' },
  { value: 'rain', label: 'Rain', desc: 'Falls onto every affected tile from above.' },
  { value: 'spiral', label: 'Spiral', desc: 'Orbits caster then spirals toward target.' },
  { value: 'wave', label: 'Wave', desc: 'Expanding ring from the caster.' },
  { value: 'arc', label: 'Arc / Toss', desc: 'Lobbed parabolic path.' },
  { value: 'orbit', label: 'Orbit', desc: 'Continuous halo around the caster.' },
  { value: 'rise', label: 'Rise', desc: 'Particles drift upward from the target.' },
  { value: 'swirl_strike', label: 'Swirl Strike', desc: 'Charges around caster then bursts on target.' },
];
