// Runtime registry of admin-defined Move overrides + custom moves.
//
// `useGameDataOverrides` saves field patches to Supabase per move id. The boot
// loader (see App.tsx) pulls every row of data_type='moves' once and hands
// them to `setMoveOverrides`, which splits them into:
//   - overrides for built-in moves (merged via applyMoveOverride)
//   - fully custom moves (marked with `custom: true`), available via
//     getCustomMoves() and surfaced from getMonsterMoves() when their
//     availability arrays match the monster.

import type { Move } from './moves';
import type { SpeciesType, ElementType, ClassType } from './types';

const overrides = new Map<string, Partial<Move>>();
const customMoves = new Map<string, Move>();
let loaded = false;

export function setMoveOverrides(rows: { data_key: string; data_value: Record<string, unknown> }[]) {
  overrides.clear();
  customMoves.clear();
  for (const row of rows) {
    const value = row.data_value as Partial<Move>;
    if (value && (value as Move).custom) {
      customMoves.set(row.data_key, value as Move);
    } else {
      overrides.set(row.data_key, value);
    }
  }
  loaded = true;
}

export function setSingleMoveOverride(id: string, value: Partial<Move> | null) {
  if (!value) {
    overrides.delete(id);
    customMoves.delete(id);
    return;
  }
  if ((value as Move).custom) {
    customMoves.set(id, value as Move);
    overrides.delete(id);
  } else {
    overrides.set(id, value);
    customMoves.delete(id);
  }
}

export function getMoveOverride(id: string): Partial<Move> | undefined {
  return overrides.get(id);
}

export function applyMoveOverride<T extends Move>(move: T): T {
  const o = overrides.get(move.id);
  if (!o) return move;
  return { ...move, ...o } as T;
}

export function getCustomMoves(): Move[] {
  return Array.from(customMoves.values());
}

export function getCustomMovesFor(
  species: SpeciesType,
  element: ElementType,
  classType: ClassType,
  level: number
): Move[] {
  // Lazy import to avoid circular dep at module load.
  const { passesAvailability } = require('./moves') as typeof import('./moves');
  const out: Move[] = [];
  for (const m of customMoves.values()) {
    const lvl = m.unlockLevel ?? 1;
    if (lvl > level) continue;
    if (passesAvailability(m, species, element, classType)) out.push(m);
  }
  return out;
}

export function areMoveOverridesLoaded() {
  return loaded;
}

// ============================================================================
// Move power rating — heuristic used by the admin balancing UI.
// Higher = stronger. Numbers are tuned against existing SPECIES_MOVES (the
// pool typically ranges ~15 (weakest filler) up to ~120 (signature moves).
// ============================================================================
export function ratingFor(m: Partial<Move>): number {
  const power = m.power ?? 0;
  const acc = m.accuracy ?? 100;
  const stam = m.staminaCost ?? 0;
  const speed = m.speedMod ?? 0;
  const aoe = m.aoeRadius ?? 0;

  let r = 0;
  // Raw damage weighted by hit chance.
  r += power * (acc / 100);
  // Status/heal moves with no damage get value from their effect tag.
  if (power === 0 && m.effect) r += 25;
  // Stamina is the main cost.
  r -= stam * 1.6;
  // Priority is very strong.
  r += speed * 6;
  // Any tagged effect is worth something extra (DoT, stat changes, drains…).
  if (m.effect) r += 10;
  // AoE multiplies effective damage by expected targets (rough disc area).
  if (aoe > 0) {
    const tiles = Math.max(1, Math.PI * aoe * aoe * 0.5);
    r += power * 0.5 * (tiles - 1);
  }
  // Targeting modifiers.
  switch (m.targeting) {
    case 'piercing': r += 18; break;
    case 'cone':     r += 12; break;
    case 'aura':     r += 10; break;
    case 'area':     r += 8;  break;
    case 'arc':      r += 14; break;
  }
  if (m.piercing) r += 12;
  if (m.wallPenetrate) r += 10;
  if (m.customShape?.offsets?.length) {
    r += Math.min(40, m.customShape.offsets.length * 4);
  }
  if (m.movement?.offsets?.length) {
    r += 18 + Math.min(20, m.movement.offsets.length * 2);
    if (m.movement.blink) r += 10;
  }
  return Math.max(0, Math.round(r));
}

/** Returns rating + percentile vs the supplied comparison pool. */
export function rateAgainst(m: Partial<Move>, pool: Move[]): { rating: number; percentile: number; avg: number; min: number; max: number } {
  const rating = ratingFor(m);
  if (pool.length === 0) return { rating, percentile: 50, avg: rating, min: rating, max: rating };
  const ratings = pool.map(ratingFor).sort((a, b) => a - b);
  const below = ratings.filter((r) => r < rating).length;
  const percentile = Math.round((below / ratings.length) * 100);
  const avg = Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length);
  return { rating, percentile, avg, min: ratings[0], max: ratings[ratings.length - 1] };
}
