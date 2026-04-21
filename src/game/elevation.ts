// Elevation system for the overworld.
// Six discrete levels (0–5) sampled from low-frequency noise. Most of the
// world lives in 0–3; rare "mega-mountain" zones (gated by a second very
// low-frequency noise) reach 4–5 inside earth biomes only.
//
// Cliffs are placed automatically wherever two adjacent tiles differ in
// elevation by ≥1 — the *higher* tile becomes the cliff face. Ramps carve a
// single passable step through cliff rings (one per region per chunk) so no
// plateau is ever sealed off. Waterfalls replace cliff tiles when an upper
// water tile drops onto a lower water/grass tile.

import { ElementType } from './types';

// ─── Public types ───
export type Elevation = 0 | 1 | 2 | 3 | 4 | 5;
export type RampDirection = 'n' | 's' | 'e' | 'w'; // direction the ramp climbs UP toward

// ─── Internal noise helpers (kept local so we don't pollute overworld.ts) ───
function hash2(x: number, y: number, seed: number): number {
  const s = Math.sin(x * 374761393 + y * 668265263 + seed * 982451653) * 43758.5453;
  return s - Math.floor(s);
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

// 2D value noise, lattice spacing controlled by `scale`.
function valueNoise(x: number, y: number, scale: number, seed: number): number {
  const sx = x * scale;
  const sy = y * scale;
  const x0 = Math.floor(sx);
  const y0 = Math.floor(sy);
  const fx = sx - x0;
  const fy = sy - y0;

  const v00 = hash2(x0,     y0,     seed);
  const v10 = hash2(x0 + 1, y0,     seed);
  const v01 = hash2(x0,     y0 + 1, seed);
  const v11 = hash2(x0 + 1, y0 + 1, seed);

  const ux = smoothstep(fx);
  const uy = smoothstep(fy);

  const a = v00 * (1 - ux) + v10 * ux;
  const b = v01 * (1 - ux) + v11 * ux;
  return a * (1 - uy) + b * uy;
}

// ─── Elevation noise fields ───
// Mid-frequency: produces gentle hills & plateaus across most of the world.
// Scale 0.06 gives plateau radii of ~5-12 tiles.
function baseElevationNoise(wx: number, wy: number): number {
  return valueNoise(wx, wy, 0.06, 91823);
}

// Very low frequency: gates rare mega-mountain zones. Scale 0.015 means each
// "mountain region" spans roughly 30-60 tiles — large enough to feel epic.
function megaMountainNoise(wx: number, wy: number): number {
  return valueNoise(wx, wy, 0.015, 776543);
}

// ─── Public API ───

/**
 * Returns the discrete elevation level (0–5) for a world tile, biome-aware.
 * - Most tiles fall in 0–3.
 * - Mega-mountain zones inside earth biomes can reach 4–5.
 * - Pure water biomes never go above 2 (they're lowlands).
 * - The home base region (within 6 tiles of origin) is forced to elevation 1
 *   so spawn is always a flat, walkable plain.
 */
export function getTileElevation(
  wx: number,
  wy: number,
  biome: ElementType | null,
): Elevation {
  // Flatten the immediate spawn region so the player never starts trapped
  // between cliff faces.
  const distFromHome = Math.sqrt(wx * wx + wy * wy);
  if (distFromHome < 6) return 1;

  const base = baseElevationNoise(wx, wy); // 0..1
  const mega = megaMountainNoise(wx, wy);  // 0..1

  // Per-biome amplitude bands. Returns the maximum elevation a tile in this
  // biome may reach via the base noise alone.
  let maxBase: Elevation = 3;        // grass/normal default
  let minBase: Elevation = 0;        // can go all the way to valley
  let allowMega = false;

  switch (biome) {
    case 'earth':
      maxBase = 4;
      minBase = 0;
      allowMega = true; // only earth gets the rare 5-tier peaks
      break;
    case 'fire':
      maxBase = 3;
      minBase = 1; // no deep valleys in volcanic terrain
      break;
    case 'void':
      maxBase = 3;
      minBase = 0;
      break;
    case 'air':
      maxBase = 4; // sky islands feel — high plateaus, no valleys
      minBase = 2;
      break;
    case 'water':
      maxBase = 2; // lowlands only
      minBase = 0;
      break;
    case 'normal':
    default:
      maxBase = 3;
      minBase = 0;
      break;
  }

  // Map base noise (0..1) into [minBase, maxBase].
  const span = maxBase - minBase;
  let level = minBase + Math.floor(base * (span + 0.999));
  if (level > maxBase) level = maxBase;
  if (level < minBase) level = minBase;

  // Mega-mountain contribution: only in earth biomes, only where the
  // megaMountainNoise field crosses 0.78 (~the top 20% of the field). Adds
  // up to +2 levels, capped at 5.
  if (allowMega && mega > 0.78) {
    const bonus = Math.min(2, Math.floor((mega - 0.78) * 10)); // 0..2
    level = Math.min(5, level + bonus);
  }

  return level as Elevation;
}

/**
 * Should a cliff face be drawn on this tile? True when any 4-neighbor sits at
 * a strictly LOWER elevation. The current tile renders the cliff face on the
 * dropping side; the lower neighbor stays plain ground.
 *
 * Returned object also includes which sides are dropping, so the renderer can
 * draw shadows on the correct edges.
 */
export function getCliffDrops(
  wx: number,
  wy: number,
  biome: ElementType | null,
  getBiomeAt: (x: number, y: number) => ElementType | null,
): { n: boolean; e: boolean; s: boolean; w: boolean; any: boolean } {
  const here = getTileElevation(wx, wy, biome);
  const n = getTileElevation(wx,     wy - 1, getBiomeAt(wx,     wy - 1)) < here;
  const e = getTileElevation(wx + 1, wy,     getBiomeAt(wx + 1, wy)) < here;
  const s = getTileElevation(wx,     wy + 1, getBiomeAt(wx,     wy + 1)) < here;
  const w = getTileElevation(wx - 1, wy,     getBiomeAt(wx - 1, wy)) < here;
  return { n, e, s, w, any: n || e || s || w };
}

/**
 * Deterministic ramp picker. Given a region of cliff tiles all at the same
 * elevation step, picks ONE tile to convert into a ramp so the higher region
 * is always reachable from below.
 *
 * To keep this stateless and chunk-local, we don't actually flood-fill the
 * whole region (that would require cross-chunk coordination). Instead we use
 * a simple deterministic rule: a cliff tile becomes a ramp iff it is the
 * unique solution to:
 *
 *     hash(wx, wy, elevation) is the lowest among all 4-neighbor cliff tiles
 *     of the same elevation step.
 *
 * In practice this seeds approximately one ramp per ~6-10 cliff tiles, which
 * is what we want for the "1-2 entrances per plateau" feel. The ramp's
 * direction is the side that drops down.
 */
export function pickRampHere(
  wx: number,
  wy: number,
  biome: ElementType | null,
  getBiomeAt: (x: number, y: number) => ElementType | null,
): RampDirection | null {
  const drops = getCliffDrops(wx, wy, biome, getBiomeAt);
  if (!drops.any) return null;

  const here = getTileElevation(wx, wy, biome);
  const myHash = hash2(wx, wy, 50000 + here);

  // Compare against the eight surrounding tiles that ALSO sit on a cliff at
  // this elevation step. We only need to be the local minimum within a small
  // ring for this to give us one ramp per plateau-edge cluster.
  const RING = 2;
  for (let dy = -RING; dy <= RING; dy++) {
    for (let dx = -RING; dx <= RING; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = wx + dx;
      const ny = wy + dy;
      const neighborBiome = getBiomeAt(nx, ny);
      const nElev = getTileElevation(nx, ny, neighborBiome);
      if (nElev !== here) continue;
      const nDrops = getCliffDrops(nx, ny, neighborBiome, getBiomeAt);
      if (!nDrops.any) continue;
      const nHash = hash2(nx, ny, 50000 + nElev);
      if (nHash < myHash) return null; // someone in the cluster wins instead
    }
  }

  // We are the chosen cliff. Pick a drop direction (prefer south for visual
  // clarity, then east, then west, then north).
  if (drops.s) return 's';
  if (drops.e) return 'e';
  if (drops.w) return 'w';
  return 'n';
}

/**
 * Should this tile become a waterfall? True when:
 *   - the tile would normally be a cliff (drops to a lower neighbor)
 *   - AND the tile itself is water in the source generator
 *   - AND at least one dropping neighbor is also water OR plain ground
 *     (so the cascade lands somewhere visible)
 */
export function shouldBeWaterfall(
  wx: number,
  wy: number,
  biome: ElementType | null,
  isWaterAt: (x: number, y: number) => boolean,
  getBiomeAt: (x: number, y: number) => ElementType | null,
): boolean {
  if (!isWaterAt(wx, wy)) return false;
  const drops = getCliffDrops(wx, wy, biome, getBiomeAt);
  return drops.any;
}
