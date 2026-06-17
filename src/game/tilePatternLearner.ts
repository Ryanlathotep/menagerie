// Example-based tile selection.
//
// Patterns are small grids the user paints (cell -> tileKey or EMPTY).
// We turn each painted cell into a rule:
//   "when the 8 neighbors look like this signature, use this tileKey"
//
// At render time, the dungeon asks: "given these 8 neighbors, what tile?"
// We pick a candidate, preferring exact-signature matches first, then
// progressively fuzzier matches (cardinal-only, then count-based, then any).
//
// This file is renderer-agnostic. No React, no Supabase.

export const EMPTY = '__empty__';

export interface PatternCell {
  x: number;
  y: number;
  tileKey: string; // a TileAssetMeta key (storage path) or EMPTY
}

export interface TilePattern {
  id: string;
  name: string;
  family: string; // e.g. "stone_wall"
  width: number;
  height: number;
  cells: PatternCell[];
}

// Deterministic small hash so seeded picks are stable.
function hash(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// 8-neighbor order: N, NE, E, SE, S, SW, W, NW
const DX = [0, 1, 1, 1, 0, -1, -1, -1];
const DY = [-1, -1, 0, 1, 1, 1, 0, -1];

function gridLookup(cells: PatternCell[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const c of cells) m.set(`${c.x},${c.y}`, c.tileKey);
  return m;
}

// A neighbor signature is "is each neighbor the same tileKey as me?
// or empty? or a different tile?" We classify each of the 8 slots as:
//   'S' = same family group (i.e. non-empty), 'E' = empty, 'O' = off-grid
// Off-grid is treated as empty for matching purposes.
function neighborSignature(
  cx: number,
  cy: number,
  lookup: Map<string, string>,
): string {
  let sig = '';
  for (let i = 0; i < 8; i++) {
    const nx = cx + DX[i];
    const ny = cy + DY[i];
    const v = lookup.get(`${nx},${ny}`);
    if (v == null || v === EMPTY) sig += 'E';
    else sig += 'S';
  }
  return sig;
}

export interface LearnedRule {
  signature: string;        // 8 chars of S/E
  cardinal: string;         // N/E/S/W only, 4 chars
  filled: number;           // count of S in cardinal
  candidates: string[];     // tileKeys that appeared in this signature
}

export interface LearnedFamily {
  family: string;
  // Exact 8-neighbor signature -> candidate tileKeys
  exact: Map<string, string[]>;
  // 4-neighbor (cardinal) signature -> candidate tileKeys (fallback)
  cardinal: Map<string, string[]>;
  // Filled-count -> candidate tileKeys (last-resort fallback)
  byCount: Map<number, string[]>;
  // Any non-empty tile in the family
  anyTile: string[];
  ruleCount: number;
}

export function learnFamily(family: string, patterns: TilePattern[]): LearnedFamily {
  const exact = new Map<string, string[]>();
  const cardinal = new Map<string, string[]>();
  const byCount = new Map<number, string[]>();
  const anyTile = new Set<string>();
  let ruleCount = 0;

  for (const p of patterns.filter((p) => p.family === family)) {
    const lookup = gridLookup(p.cells);
    for (const cell of p.cells) {
      if (cell.tileKey === EMPTY) continue;
      anyTile.add(cell.tileKey);
      const sig = neighborSignature(cell.x, cell.y, lookup);
      const card = sig[0] + sig[2] + sig[4] + sig[6];
      const filled = card.split('').filter((c) => c === 'S').length;

      const addTo = (m: Map<string, string[]>, k: string) => {
        const arr = m.get(k);
        if (arr) { if (!arr.includes(cell.tileKey)) arr.push(cell.tileKey); }
        else m.set(k, [cell.tileKey]);
      };
      addTo(exact, sig);
      addTo(cardinal, card);
      const arr = byCount.get(filled);
      if (arr) { if (!arr.includes(cell.tileKey)) arr.push(cell.tileKey); }
      else byCount.set(filled, [cell.tileKey]);
      ruleCount++;
    }
  }

  return {
    family,
    exact, cardinal, byCount,
    anyTile: Array.from(anyTile),
    ruleCount,
  };
}

export interface PickContext {
  // 8 booleans in N, NE, E, SE, S, SW, W, NW order: is neighbor a wall?
  neighbors: boolean[];
  // Stable seed for variation (e.g. tile coordinates)
  seed?: string;
}

export interface PickResult {
  tileKey: string | null;
  matchQuality: 'exact' | 'cardinal' | 'count' | 'any' | 'none';
}

export function pickTile(family: LearnedFamily, ctx: PickContext): PickResult {
  const sig = ctx.neighbors.map((b) => (b ? 'S' : 'E')).join('');
  const card = sig[0] + sig[2] + sig[4] + sig[6];
  const filled = card.split('').filter((c) => c === 'S').length;
  const seed = ctx.seed ?? sig;

  const pickFrom = (arr: string[] | undefined, q: PickResult['matchQuality']): PickResult | null => {
    if (!arr || arr.length === 0) return null;
    const idx = hash(seed + q) % arr.length;
    return { tileKey: arr[idx], matchQuality: q };
  };

  return (
    pickFrom(family.exact.get(sig), 'exact') ||
    pickFrom(family.cardinal.get(card), 'cardinal') ||
    pickFrom(family.byCount.get(filled), 'count') ||
    pickFrom(family.anyTile, 'any') ||
    { tileKey: null, matchQuality: 'none' }
  );
}
