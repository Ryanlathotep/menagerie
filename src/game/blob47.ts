// Blob-47 (Wang 2-edge) autotile helpers.
//
// 8-neighbor bitmask layout (bit -> neighbor):
//   0 = N, 1 = NE, 2 = E, 3 = SE, 4 = S, 5 = SW, 6 = W, 7 = NW
//
// Of the 256 possible 8-neighbor masks, only 47 are "valid" because a
// diagonal neighbor only contributes a corner piece when BOTH of its
// adjacent cardinal neighbors are also present. Otherwise the diagonal
// is effectively absent and the mask reduces.
//
// `reduceMask` collapses any of the 256 raw masks to its canonical Blob-47
// representative. `BLOB47_MASKS` is the sorted list of the 47 canonical
// masks. `MASK_LABEL` gives a human-readable name.

export const NEIGHBOR_BITS = {
  N: 1 << 0,
  NE: 1 << 1,
  E: 1 << 2,
  SE: 1 << 3,
  S: 1 << 4,
  SW: 1 << 5,
  W: 1 << 6,
  NW: 1 << 7,
} as const;

/** Strip diagonals whose adjacent cardinals are not both present. */
export function reduceMask(raw: number): number {
  let m = raw & 0xff;
  // NE requires N + E
  if ((m & NEIGHBOR_BITS.NE) && !((m & NEIGHBOR_BITS.N) && (m & NEIGHBOR_BITS.E))) m &= ~NEIGHBOR_BITS.NE;
  // SE requires S + E
  if ((m & NEIGHBOR_BITS.SE) && !((m & NEIGHBOR_BITS.S) && (m & NEIGHBOR_BITS.E))) m &= ~NEIGHBOR_BITS.SE;
  // SW requires S + W
  if ((m & NEIGHBOR_BITS.SW) && !((m & NEIGHBOR_BITS.S) && (m & NEIGHBOR_BITS.W))) m &= ~NEIGHBOR_BITS.SW;
  // NW requires N + W
  if ((m & NEIGHBOR_BITS.NW) && !((m & NEIGHBOR_BITS.N) && (m & NEIGHBOR_BITS.W))) m &= ~NEIGHBOR_BITS.NW;
  return m;
}

/** All 47 canonical Blob-47 masks, sorted ascending. */
export const BLOB47_MASKS: readonly number[] = (() => {
  const set = new Set<number>();
  for (let i = 0; i < 256; i++) set.add(reduceMask(i));
  return Array.from(set).sort((a, b) => a - b);
})();

export function isValidBlob47(mask: number): boolean {
  return reduceMask(mask) === (mask & 0xff);
}

/** Short label like "N E S" or "all" or "isolated". */
export function maskLabel(mask: number): string {
  if (mask === 0) return 'isolated';
  if (mask === 0xff) return 'all';
  const parts: string[] = [];
  if (mask & NEIGHBOR_BITS.NW) parts.push('NW');
  if (mask & NEIGHBOR_BITS.N) parts.push('N');
  if (mask & NEIGHBOR_BITS.NE) parts.push('NE');
  if (mask & NEIGHBOR_BITS.W) parts.push('W');
  if (mask & NEIGHBOR_BITS.E) parts.push('E');
  if (mask & NEIGHBOR_BITS.SW) parts.push('SW');
  if (mask & NEIGHBOR_BITS.S) parts.push('S');
  if (mask & NEIGHBOR_BITS.SE) parts.push('SE');
  return parts.join(' ');
}

/**
 * Pick the best asset key for a given runtime neighbor mask from a family
 * of tagged assets. Tries exact reduced mask first, then any mask that
 * matches the cardinal-only portion (drops corners), then mask 0.
 */
export function pickBlob47<T>(
  family: Map<number, T>,
  rawNeighborMask: number,
): T | undefined {
  const exact = reduceMask(rawNeighborMask);
  const hit = family.get(exact);
  if (hit) return hit;
  // Drop diagonals
  const cardinal = exact & (NEIGHBOR_BITS.N | NEIGHBOR_BITS.E | NEIGHBOR_BITS.S | NEIGHBOR_BITS.W);
  const hit2 = family.get(cardinal);
  if (hit2) return hit2;
  return family.get(0);
}
