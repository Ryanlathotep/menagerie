// Generic auto-tiling helpers shared by roads, water, and walls.
// Given a 4-bit NESW bitmask of which neighbors "connect," we map to one of
// 6 visual shapes plus a rotation in degrees (0/90/180/270).
//
// Bit layout: bit 0 = North, bit 1 = East, bit 2 = South, bit 3 = West.

export type AutoTileShape = 'single' | 'end' | 'straight' | 'corner' | 't' | 'cross';

export interface AutoTileFit {
  shape: AutoTileShape;
  rotation: 0 | 90 | 180 | 270;
}

export const NORTH = 0b0001;
export const EAST = 0b0010;
export const SOUTH = 0b0100;
export const WEST = 0b1000;

export function makeMask(north: boolean, east: boolean, south: boolean, west: boolean): number {
  return (north ? NORTH : 0) | (east ? EAST : 0) | (south ? SOUTH : 0) | (west ? WEST : 0);
}

// Convention for base orientations (rotation = 0):
//   straight = horizontal (East-West connections)
//   corner   = North + East (┘ rotated 180 → ┐ etc.)
//   t        = T pointing south (East + West + South open)
//   end      = end-cap pointing east (only East connection — "tail" extends east)
//   cross    = all four
//   single   = no connections
export function bitmaskToShape(mask: number): AutoTileFit {
  const n = !!(mask & NORTH);
  const e = !!(mask & EAST);
  const s = !!(mask & SOUTH);
  const w = !!(mask & WEST);
  const count = (n ? 1 : 0) + (e ? 1 : 0) + (s ? 1 : 0) + (w ? 1 : 0);

  if (count === 0) return { shape: 'single', rotation: 0 };
  if (count === 4) return { shape: 'cross', rotation: 0 };

  if (count === 1) {
    // Base end-cap "points" east (its single connection is east).
    if (e) return { shape: 'end', rotation: 0 };
    if (s) return { shape: 'end', rotation: 90 };
    if (w) return { shape: 'end', rotation: 180 };
    return { shape: 'end', rotation: 270 }; // n
  }

  if (count === 2) {
    // Straight (opposite sides connected)
    if (e && w) return { shape: 'straight', rotation: 0 };
    if (n && s) return { shape: 'straight', rotation: 90 };

    // Corner. Base = N+E (┘ shape, opens toward NE).
    if (n && e) return { shape: 'corner', rotation: 0 };
    if (e && s) return { shape: 'corner', rotation: 90 };
    if (s && w) return { shape: 'corner', rotation: 180 };
    if (w && n) return { shape: 'corner', rotation: 270 };
  }

  // count === 3 → T-junction. Base = E+W+S (T opens south, trunk on top).
  if (e && w && s) return { shape: 't', rotation: 0 };
  if (n && s && w) return { shape: 't', rotation: 90 };  // trunk on right (east), opens west
  if (e && w && n) return { shape: 't', rotation: 180 }; // T opens north
  return { shape: 't', rotation: 270 };                  // n + s + e → trunk on left, opens east
}

// Convenience: build mask from a 4-tuple of [N, E, S, W] booleans.
export function fitFromNeighbors(north: boolean, east: boolean, south: boolean, west: boolean): AutoTileFit {
  return bitmaskToShape(makeMask(north, east, south, west));
}
