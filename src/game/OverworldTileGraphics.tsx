// Overworld Tile Graphics - Hand-drawn ink & watercolor SVG tiles
// Matches the dungeon TileGraphics aesthetic

import { OverworldTileType, BuildingType, BUILDING_UPGRADES } from './overworld';
import { TreeTier, StoneTier, TREE_TIER_COLORS, STONE_TIER_COLORS } from './resourceHierarchy';

interface TileGraphicProps {
  size: number;
  seed?: number;
}

// Sepia ink palette (matching TileGraphics.tsx)
const INK = {
  dark: 'hsl(30 15% 20%)',
  medium: 'hsl(30 20% 35%)',
  light: 'hsl(30 25% 50%)',
  faint: 'hsl(30 30% 70%)',
};

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

// ─── Grass ───
export function OverworldGrassTile({ size, seed = 0 }: TileGraphicProps & { harvested?: boolean }) {
  const r1 = seededRandom(seed);
  const r2 = seededRandom(seed + 1);
  const r3 = seededRandom(seed + 2);

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="block">
      {/* Base wash */}
      <rect width="24" height="24" fill="hsl(90 35% 55%)" opacity={0.25} />
      {/* Subtle grass blades */}
      <path d={`M${4+r1*3} 20 Q${5+r2} ${14-r1*3} ${6+r3} ${10+r1*2}`} stroke="hsl(100 40% 45%)" strokeWidth={0.8} fill="none" opacity={0.5} strokeLinecap="round"/>
      <path d={`M${10+r2*2} 21 Q${11+r1} ${13-r2*2} ${12+r3} ${9+r2}`} stroke="hsl(105 35% 50%)" strokeWidth={0.7} fill="none" opacity={0.45} strokeLinecap="round"/>
      <path d={`M${16+r3*2} 20 Q${17+r1} ${15-r3*2} ${18+r2} ${11+r1*2}`} stroke="hsl(95 38% 48%)" strokeWidth={0.6} fill="none" opacity={0.4} strokeLinecap="round"/>
      {r1 > 0.5 && (
        <circle cx={8+r2*8} cy={16+r3*4} r={0.6} fill="hsl(50 60% 60%)" opacity={0.5}/>
      )}
      {/* Grid line */}
      <line x1="0" y1="0" x2="24" y2="0" stroke={INK.faint} strokeWidth={0.3} opacity={0.3}/>
      <line x1="0" y1="0" x2="0" y2="24" stroke={INK.faint} strokeWidth={0.3} opacity={0.3}/>
    </svg>
  );
}

// ─── Harvested Grass ───
export function OverworldHarvestedTile({ size, seed = 0 }: TileGraphicProps) {
  const r1 = seededRandom(seed);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="block">
      <rect width="24" height="24" fill="hsl(35 40% 45%)" opacity={0.25}/>
      <ellipse cx={12} cy={14} rx={8} ry={5} fill="hsl(30 35% 50%)" opacity={0.15}/>
      {/* Small dirt marks */}
      <circle cx={8+r1*3} cy={16} r={1} fill={INK.faint} opacity={0.3}/>
      <circle cx={15+r1*2} cy={12} r={0.8} fill={INK.faint} opacity={0.25}/>
      <line x1="0" y1="0" x2="24" y2="0" stroke={INK.faint} strokeWidth={0.3} opacity={0.3}/>
      <line x1="0" y1="0" x2="0" y2="24" stroke={INK.faint} strokeWidth={0.3} opacity={0.3}/>
    </svg>
  );
}

// ─── Tree (with tier support + auto-merging into a forest canopy) ───
// When `fit` is supplied, the tile blends with same-type neighbors: trunks
// shrink to make room for connecting canopy, and a "forest floor" patch
// bleeds into open sides so groves of trees read as one continuous mass.
export function OverworldTreeTile({ size, seed = 0, tier = 'oak', fit }: TileGraphicProps & { tier?: TreeTier; fit?: AutoTileFit }) {
  const r1 = seededRandom(seed);
  const r2 = seededRandom(seed + 1);
  const r3 = seededRandom(seed + 2);
  const colors = TREE_TIER_COLORS[tier];
  const isElder = tier === 'elder_oak';
  const isMaple = tier === 'maple';

  // Determine which sides have a same-type neighbor (canopy bleeds across).
  let n = false, e = false, s = false, w = false;
  if (fit) {
    const opens = openSidesFromFit(fit);
    n = opens.n; e = opens.e; s = opens.s; w = opens.w;
  }
  const anyNeighbor = n || e || s || w;
  const neighborCount = (n ? 1 : 0) + (e ? 1 : 0) + (s ? 1 : 0) + (w ? 1 : 0);
  // Heavily-surrounded tiles drop the trunk entirely and become "deep canopy"
  // so the forest interior reads as a continuous green mass instead of a grid
  // of repeated trees.
  const isInterior = neighborCount >= 3;

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="block">
      <rect width="24" height="24" fill="hsl(90 30% 50%)" opacity={0.15}/>
      {/* Forest-floor wash that bleeds into adjacent forest tiles */}
      {anyNeighbor && (
        <rect
          x={w ? -1 : 2} y={n ? -1 : 2}
          width={(e ? 25 : 22) - (w ? -1 : 2)}
          height={(s ? 25 : 22) - (n ? -1 : 2)}
          fill={colors.canopy2} opacity={0.18} rx={1}
        />
      )}
      {/* Trunk — hidden in deep interior so we don't get repeating sticks */}
      {!isInterior && <>
        <rect x={isElder ? "9.5" : "10.5"} y={isElder ? "12" : "14"} width={isElder ? 5 : 3} height={isElder ? 9 : 7} rx={0.5} fill={colors.trunk} opacity={0.8}/>
        <line x1="12" y1={isElder ? 12 : 14} x2="12" y2="21" stroke={INK.medium} strokeWidth={isElder ? 0.6 : 0.4} opacity={0.5}/>
      </>}
      {/* Canopy lobes — extend toward each connected neighbor so adjacent
          trees visually fuse. Lobe centers are pushed toward the tile edge
          on the connecting side. */}
      <ellipse
        cx={12 + (e ? 2 : 0) - (w ? 2 : 0)}
        cy={(isElder ? 8 : 10) + (s ? 2 : 0) - (n ? 2 : 0)}
        rx={isElder ? 9+r1 : 7+r1}
        ry={isElder ? 7+r2*0.5 : 6+r2*0.5}
        fill={colors.canopy} opacity={0.6}
      />
      <ellipse cx={10+r1*2} cy={(isElder ? 6 : 8)+r2} rx={isElder ? 6 : 5} ry={isElder ? 5 : 4} fill={colors.canopy2} opacity={0.5}/>
      <ellipse cx={14+r2} cy={(isElder ? 7 : 9)+r1} rx={4.5} ry={3.5} fill={colors.canopy} opacity={0.45}/>
      {/* Side-bleed lobes: thick canopy patches that extend past the tile
          edge on connected sides so seams disappear. */}
      {n && <ellipse cx={11+r1*2} cy={-1} rx={6} ry={5} fill={colors.canopy} opacity={0.55}/>}
      {s && <ellipse cx={12+r2*2} cy={25} rx={6} ry={5} fill={colors.canopy} opacity={0.55}/>}
      {e && <ellipse cx={25} cy={10+r1*2} rx={5} ry={6} fill={colors.canopy} opacity={0.55}/>}
      {w && <ellipse cx={-1} cy={11+r2*2} rx={5} ry={6} fill={colors.canopy} opacity={0.55}/>}
      {/* Diagonal blob fillers for nicer corner blending when both axes connect */}
      {n && e && <ellipse cx={22} cy={2} rx={5} ry={4} fill={colors.canopy2} opacity={0.5}/>}
      {n && w && <ellipse cx={2} cy={2} rx={5} ry={4} fill={colors.canopy2} opacity={0.5}/>}
      {s && e && <ellipse cx={22} cy={22} rx={5} ry={4} fill={colors.canopy2} opacity={0.5}/>}
      {s && w && <ellipse cx={2} cy={22} rx={5} ry={4} fill={colors.canopy2} opacity={0.5}/>}
      {isMaple && <>
        <circle cx={8+r1*3} cy={7+r2*2} r={1.2} fill="hsl(25 80% 55%)" opacity={0.6}/>
        <circle cx={15+r2*2} cy={9+r1} r={1} fill="hsl(10 75% 50%)" opacity={0.5}/>
      </>}
      {isElder && <ellipse cx={12} cy={8} rx={10} ry={8} fill="hsl(160 40% 50%)" opacity={0.08}/>}
      {/* Outline only on isolated trees so forests feel like a soft mass */}
      {!anyNeighbor && (
        <ellipse cx={12} cy={isElder ? 8 : 10} rx={isElder ? 9+r1 : 7+r1} ry={isElder ? 7+r2*0.5 : 6+r2*0.5} stroke={INK.medium} strokeWidth={isElder ? 0.7 : 0.5} fill="none" opacity={0.5}/>
      )}
      {/* Tier badge stays only on edge tiles so the badge isn't repeated all
          over a forest — interior tiles drop it. */}
      {tier !== 'oak' && !isInterior && (
        <text x="22" y="5" fontSize="4" fill={INK.dark} opacity={0.6} textAnchor="end" fontWeight="bold">
          {isMaple ? '★' : '★★'}
        </text>
      )}
      <line x1="0" y1="0" x2="24" y2="0" stroke={INK.faint} strokeWidth={0.3} opacity={0.3}/>
      <line x1="0" y1="0" x2="0" y2="24" stroke={INK.faint} strokeWidth={0.3} opacity={0.3}/>
    </svg>
  );
}

// ─── Rock (with tier support + auto-merging into a mountain mass) ───
export function OverworldRockTile({ size, seed = 0, tier = 'stone', fit }: TileGraphicProps & { tier?: StoneTier; fit?: AutoTileFit }) {
  const r1 = seededRandom(seed);
  const r2 = seededRandom(seed + 1);
  const colors = STONE_TIER_COLORS[tier];
  const tierIdx = ['stone', 'copper', 'iron', 'gold', 'mithril'].indexOf(tier);

  let n = false, e = false, s = false, w = false;
  if (fit) {
    const opens = openSidesFromFit(fit);
    n = opens.n; e = opens.e; s = opens.s; w = opens.w;
  }
  const anyNeighbor = n || e || s || w;
  const neighborCount = (n ? 1 : 0) + (e ? 1 : 0) + (s ? 1 : 0) + (w ? 1 : 0);

  // Inset the main rock body on closed sides; full-bleed on open sides so
  // adjacent rocks fuse into a continuous ridge.
  const left   = w ? -1 : 3;
  const right  = e ? 25 : 21;
  const top    = n ? -1 : 4;
  const bottom = s ? 25 : 20;

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="block">
      <rect width="24" height="24" fill="hsl(30 10% 60%)" opacity={0.15}/>
      {/* Solid rock mass — full-bleed on connected sides */}
      <rect x={left} y={top} width={right - left} height={bottom - top} rx={3} fill={colors.main} opacity={0.55}/>
      {/* Lighter highlight cap (offset inward) */}
      <rect x={left + 1.5} y={top + 1.5} width={Math.max(0, right - left - 3)} height={Math.max(0, (bottom - top) * 0.55)} rx={2} fill={colors.highlight} opacity={0.35}/>
      {/* Cracks and veins (interior only — busy rocks don't tile cleanly) */}
      {neighborCount < 3 && tierIdx >= 1 && <>
        <path d={`M${7+r1*2} ${11+r2} L${12} ${14} L${16+r1} ${11+r2*2}`} stroke={colors.vein} strokeWidth={0.8} fill="none" opacity={0.6}/>
        <path d={`M${9+r2} ${15} L${14+r1} ${12}`} stroke={colors.vein} strokeWidth={0.6} fill="none" opacity={0.5}/>
      </>}
      {neighborCount < 3 && tierIdx >= 3 && <>
        <circle cx={9+r1*3} cy={10+r2*2} r={0.8} fill="white" opacity={0.6}/>
        <circle cx={14+r2*2} cy={12+r1} r={0.6} fill="white" opacity={0.5}/>
      </>}
      {tier === 'mithril' && <ellipse cx={12} cy={13} rx={9} ry={7} fill="hsl(200 60% 70%)" opacity={0.1}/>}
      {/* Outline only on closed (cliff) edges so interiors merge seamlessly */}
      {!n && <line x1={left} y1={top} x2={right} y2={top} stroke={INK.medium} strokeWidth={0.5} opacity={0.55}/>}
      {!s && <line x1={left} y1={bottom} x2={right} y2={bottom} stroke={INK.medium} strokeWidth={0.5} opacity={0.55}/>}
      {!w && <line x1={left} y1={top} x2={left} y2={bottom} stroke={INK.medium} strokeWidth={0.5} opacity={0.55}/>}
      {!e && <line x1={right} y1={top} x2={right} y2={bottom} stroke={INK.medium} strokeWidth={0.5} opacity={0.55}/>}
      {/* Tier badge only on edge tiles */}
      {tierIdx >= 1 && neighborCount < 3 && (
        <text x="22" y="5" fontSize="4" fill={INK.dark} opacity={0.6} textAnchor="end" fontWeight="bold">
          {'★'.repeat(Math.min(tierIdx, 4))}
        </text>
      )}
      <line x1="0" y1="0" x2="24" y2="0" stroke={INK.faint} strokeWidth={0.3} opacity={0.3}/>
      <line x1="0" y1="0" x2="0" y2="24" stroke={INK.faint} strokeWidth={0.3} opacity={0.3}/>
    </svg>
  );
}

// ─── Water ───
// Optional auto-tile shape: when supplied, draws a sandy shoreline on the
// "closed" sides so adjacent water cells flow into each other and isolated
// puddles get a full beach ring.
import type { AutoTileFit, AutoTileShape } from './autoTiling';

export function OverworldWaterTile({ size, seed = 0, fit }: TileGraphicProps & { fit?: AutoTileFit }) {
  const r1 = seededRandom(seed);
  const r2 = seededRandom(seed + 1);
  const r3 = seededRandom(seed + 2);
  const r4 = seededRandom(seed + 3);

  // Determine which sides have water neighbors. Defaults to "all open" so
  // legacy callers without auto-tiling still render the original look.
  let n = true, e = true, s = true, w = true;
  if (fit) {
    const opens = openSidesFromFit(fit);
    n = opens.n; e = opens.e; s = opens.s; w = opens.w;
  }
  const isolated = !n && !e && !s && !w;
  const SHORE = 'hsl(40 55% 70%)';
  const SHORE_DARK = 'hsl(35 50% 60%)';
  const WATER_DEEP = 'hsl(200 55% 45%)';
  const WATER_MID = 'hsl(195 60% 50%)';

  // Build a rounded water silhouette path. On closed sides we pull inward
  // and use a wavy/scalloped curve to mimic a natural pond/river edge; on
  // open sides we full-bleed to the tile edge so adjacent water seams
  // perfectly. Corner radius is large when both adjacent sides are closed
  // (an outer corner of the body) and 0 when at least one is open.
  const inset = 3.2; // shore thickness on closed sides
  const xL = w ? 0 : inset;
  const xR = e ? 24 : 24 - inset;
  const yT = n ? 0 : inset;
  const yB = s ? 24 : 24 - inset;

  // Per-corner radius: round only where BOTH sides meeting at that corner are closed.
  const rTL = !n && !w ? 4 + r1 * 1.5 : 0;
  const rTR = !n && !e ? 4 + r2 * 1.5 : 0;
  const rBR = !s && !e ? 4 + r3 * 1.5 : 0;
  const rBL = !s && !w ? 4 + r4 * 1.5 : 0;

  // Closed-edge waviness — small sinusoidal bulge in the middle of the edge.
  // Gives ponds/rivers a hand-drawn organic feel rather than a clean rect.
  const wave = (open: boolean, amp: number) => (open ? 0 : amp);
  const topWave = wave(n, 0.6 + r1 * 0.8);
  const rightWave = wave(e, 0.6 + r2 * 0.8);
  const botWave = wave(s, 0.6 + r3 * 0.8);
  const leftWave = wave(w, 0.6 + r4 * 0.8);

  // Compose the water silhouette as a single closed path with quadratic
  // curves on closed edges and rounded corners between two closed edges.
  // Coordinates are walked clockwise from top-left + rTL.
  const cxMid = (xL + xR) / 2;
  const cyMid = (yT + yB) / 2;
  const path = [
    `M ${xL + rTL} ${yT}`,
    // Top edge → top-right corner
    n
      ? `L ${xR - rTR} ${yT}`
      : `Q ${cxMid} ${yT - topWave} ${xR - rTR} ${yT}`,
    rTR > 0 ? `Q ${xR} ${yT} ${xR} ${yT + rTR}` : '',
    // Right edge → bottom-right
    e
      ? `L ${xR} ${yB - rBR}`
      : `Q ${xR + rightWave} ${cyMid} ${xR} ${yB - rBR}`,
    rBR > 0 ? `Q ${xR} ${yB} ${xR - rBR} ${yB}` : '',
    // Bottom edge → bottom-left
    s
      ? `L ${xL + rBL} ${yB}`
      : `Q ${cxMid} ${yB + botWave} ${xL + rBL} ${yB}`,
    rBL > 0 ? `Q ${xL} ${yB} ${xL} ${yB - rBL}` : '',
    // Left edge → close
    w
      ? `L ${xL} ${yT + rTL}`
      : `Q ${xL - leftWave} ${cyMid} ${xL} ${yT + rTL}`,
    rTL > 0 ? `Q ${xL} ${yT} ${xL + rTL} ${yT}` : '',
    'Z',
  ].filter(Boolean).join(' ');

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="block">
      {/* Sand base — only visible where the water shape is inset (closed sides) */}
      <rect width="24" height="24" fill={SHORE} opacity={0.85} />
      {/* Slightly darker shore band right against the water for depth */}
      <path d={path} fill={SHORE_DARK} opacity={0.5} transform="scale(1.06) translate(-0.72 -0.72)" />
      {/* Deep water fill */}
      <path d={path} fill={WATER_DEEP} opacity={0.6} />
      <path d={path} fill={WATER_MID} opacity={0.35} />
      {/* Soft inner ripple — only for isolated puddles, otherwise it segments connected bodies */}
      {isolated && <ellipse cx="12" cy="12" rx="7" ry="6" fill={WATER_MID} opacity={0.25} />}
      {/* Wave lines — extend to edges on open sides so they flow into neighbors */}
      <path
        d={`M${w ? -1 : 4} ${10 + r1 * 3} Q7 ${8 + r2 * 2} 12 ${10 + r1 * 2} T${e ? 25 : 20} ${9 + r2 * 3}`}
        stroke="hsl(190 50% 70%)" strokeWidth={1.2} fill="none" opacity={0.6}
      />
      <path
        d={`M${w ? -1 : 4} ${14 + r2 * 2} Q8 ${12 + r1 * 2} 13 ${14 + r2} T${e ? 25 : 20} ${13 + r1 * 2}`}
        stroke="white" strokeWidth={0.7} fill="none" opacity={0.4}
      />
      {/* Vertical shimmer on N/S open sides for axis variety */}
      {(n || s) && (
        <path
          d={`M${10 + r1 * 2} ${n ? -1 : 4} Q${11 + r2} 12 ${10 + r2 * 2} ${s ? 25 : 20}`}
          stroke="hsl(190 50% 75%)" strokeWidth={0.6} fill="none" opacity={0.35}
        />
      )}
      {/* Soft ink outline on the water silhouette to sell the hand-drawn look */}
      <path d={path} stroke={INK.medium} strokeWidth={0.35} fill="none" opacity={0.45} />
      {/* Soft pebble specks on shores */}
      {!n && <circle cx={6 + r1 * 8} cy={1.5} r={0.5} fill={INK.medium} opacity={0.5} />}
      {!s && <circle cx={10 + r2 * 8} cy={22.5} r={0.5} fill={INK.medium} opacity={0.5} />}
      {!w && <circle cx={1.5} cy={8 + r1 * 8} r={0.5} fill={INK.medium} opacity={0.5} />}
      {!e && <circle cx={22.5} cy={12 + r2 * 8} r={0.5} fill={INK.medium} opacity={0.5} />}
      <line x1="0" y1="0" x2="24" y2="0" stroke={INK.faint} strokeWidth={0.3} opacity={0.3} />
      <line x1="0" y1="0" x2="0" y2="24" stroke={INK.faint} strokeWidth={0.3} opacity={0.3} />
    </svg>
  );
}

// Compute which cardinal sides are "open" (i.e., connect to a same-type neighbor)
// based on the inverse-encoded AutoTileFit (since water uses "open = connection").
function openSidesFromFit(fit: AutoTileFit): { n: boolean; e: boolean; s: boolean; w: boolean } {
  // Convert shape+rotation back into NESW open-flags. Keep this in sync with autoTiling.ts.
  const rotateNESW = (n: boolean, e: boolean, s: boolean, w: boolean, deg: number) => {
    // Rotate the open-flag vector clockwise by `deg`. After rotating the source
    // pattern by `deg` to get the rendered orientation, sides shift accordingly.
    const steps = ((deg / 90) % 4 + 4) % 4;
    let arr = [n, e, s, w];
    for (let i = 0; i < steps; i++) {
      arr = [arr[3], arr[0], arr[1], arr[2]]; // CW rotation
    }
    return { n: arr[0], e: arr[1], s: arr[2], w: arr[3] };
  };

  switch (fit.shape) {
    case 'cross':    return { n: true, e: true, s: true, w: true };
    case 'single':   return { n: false, e: false, s: false, w: false };
    case 'straight': return rotateNESW(false, true, false, true, fit.rotation); // base = E+W open
    case 'corner':   return rotateNESW(true, true, false, false, fit.rotation); // base = N+E open
    case 't':        return rotateNESW(false, true, true, true, fit.rotation);  // base = E+S+W open
    case 'end':      return rotateNESW(false, true, false, false, fit.rotation); // base = E open
  }
}

// ─── Building (campfire / cabin / town hall) ───
export function OverworldBuildingTile({ size, buildingType = 'campfire', seed = 0 }: TileGraphicProps & { buildingType?: BuildingType }) {
  const r1 = seededRandom(seed);

  const renderBuilding = () => {
    switch (buildingType) {
      case 'campfire':
        return (
          <>
            {/* Log circle */}
            <ellipse cx="12" cy="17" rx="6" ry="3" fill="hsl(25 45% 35%)" opacity={0.6}/>
            <ellipse cx="12" cy="17" rx="6" ry="3" stroke={INK.medium} strokeWidth={0.5} fill="none" opacity={0.5}/>
            {/* Flames */}
            <path d="M12 16 Q10 10 12 6 Q14 10 12 16" fill="hsl(30 90% 55%)" opacity={0.7}/>
            <path d="M12 16 Q11 12 12 8 Q13 12 12 16" fill="hsl(45 95% 65%)" opacity={0.6}/>
            {/* Glow */}
            <circle cx="12" cy="12" r="5" fill="hsl(40 80% 60%)" opacity={0.15}/>
          </>
        );
      case 'log_cabin':
        return (
          <>
            {/* Cabin body */}
            <rect x="5" y="10" width="14" height="10" rx={0.5} fill="hsl(25 50% 40%)" opacity={0.7}/>
            {/* Roof */}
            <path d="M3 11 L12 4 L21 11" fill="hsl(20 40% 30%)" opacity={0.7} stroke={INK.medium} strokeWidth={0.5}/>
            {/* Door */}
            <rect x="10" y="14" width="4" height="6" fill="hsl(25 35% 28%)" opacity={0.8}/>
            {/* Window */}
            <rect x="6.5" y="12.5" width="2.5" height="2.5" fill="hsl(50 60% 65%)" opacity={0.6} stroke={INK.medium} strokeWidth={0.3}/>
            {/* Ink outline */}
            <rect x="5" y="10" width="14" height="10" rx={0.5} stroke={INK.medium} strokeWidth={0.5} fill="none" opacity={0.5}/>
          </>
        );
      case 'town_hall':
        return (
          <>
            {/* Main body */}
            <rect x="4" y="9" width="16" height="12" rx={0.5} fill="hsl(35 30% 65%)" opacity={0.7}/>
            {/* Pillars */}
            <rect x="5" y="9" width="1.5" height="12" fill="hsl(35 25% 75%)" opacity={0.6}/>
            <rect x="17.5" y="9" width="1.5" height="12" fill="hsl(35 25% 75%)" opacity={0.6}/>
            {/* Pediment */}
            <path d="M3 10 L12 3 L21 10" fill="hsl(35 25% 70%)" opacity={0.7} stroke={INK.medium} strokeWidth={0.5}/>
            {/* Door */}
            <rect x="9.5" y="13" width="5" height="8" rx={2.5} fill="hsl(25 35% 30%)" opacity={0.7}/>
            {/* Outline */}
            <rect x="4" y="9" width="16" height="12" rx={0.5} stroke={INK.medium} strokeWidth={0.5} fill="none" opacity={0.5}/>
          </>
        );
    }
  };

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="block">
      <rect width="24" height="24" fill="hsl(40 35% 55%)" opacity={0.12}/>
      {renderBuilding()}
      <line x1="0" y1="0" x2="24" y2="0" stroke={INK.faint} strokeWidth={0.3} opacity={0.3}/>
      <line x1="0" y1="0" x2="0" y2="24" stroke={INK.faint} strokeWidth={0.3} opacity={0.3}/>
    </svg>
  );
}

// ─── Dungeon Entrance ───
export function OverworldDungeonTile({ size, seed = 0, depth }: TileGraphicProps & { depth?: number }) {
  const r1 = seededRandom(seed);

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="block">
      <rect width="24" height="24" fill="hsl(270 30% 30%)" opacity={0.2}/>
      {/* Stone archway */}
      <rect x="6" y="6" width="12" height="16" rx={0.5} fill="hsl(220 10% 40%)" opacity={0.6}/>
      <path d="M6 12 Q12 4 18 12" fill="hsl(220 10% 45%)" opacity={0.7} stroke={INK.medium} strokeWidth={0.6}/>
      {/* Dark opening */}
      <rect x="8" y="10" width="8" height="12" rx={0.3} fill="hsl(260 25% 12%)" opacity={0.85}/>
      <path d="M8 14 Q12 8 16 14" fill="hsl(260 20% 15%)" opacity={0.9}/>
      {/* Purple glow */}
      <ellipse cx="12" cy="16" rx="3" ry="4" fill="hsl(270 50% 50%)" opacity={0.15}/>
      {/* Steps */}
      <rect x="8" y="20" width="8" height="1.5" fill="hsl(220 10% 50%)" opacity={0.5}/>
      <rect x="9" y="21.5" width="6" height="1" fill="hsl(220 10% 45%)" opacity={0.4}/>
      {/* Ink outline */}
      <rect x="6" y="6" width="12" height="16" rx={0.5} stroke={INK.medium} strokeWidth={0.5} fill="none" opacity={0.5}/>
      {/* Depth indicator */}
      {depth !== undefined && depth > 0 && (
        <>
          <rect x="6" y="2" width="12" height="5" rx="1" fill="hsl(260 25% 15%)" opacity={0.85}/>
          <text x="12" y="6" textAnchor="middle" fontSize="4" fill="hsl(270 60% 75%)" fontWeight="bold">{depth}</text>
        </>
      )}
      <line x1="0" y1="0" x2="24" y2="0" stroke={INK.faint} strokeWidth={0.3} opacity={0.3}/>
      <line x1="0" y1="0" x2="0" y2="24" stroke={INK.faint} strokeWidth={0.3} opacity={0.3}/>
    </svg>
  );
}

// ─── Monster Nest ───
export function OverworldNestTile({ size, seed = 0, element = 'normal', hpPercent = 100 }: TileGraphicProps & { element?: string; hpPercent?: number }) {
  const r1 = seededRandom(seed);
  
  // Element-based colors
  const elementColors: Record<string, { glow: string; core: string }> = {
    normal: { glow: 'hsl(0 0% 60%)', core: 'hsl(0 0% 40%)' },
    fire: { glow: 'hsl(15 90% 55%)', core: 'hsl(0 80% 40%)' },
    water: { glow: 'hsl(200 85% 55%)', core: 'hsl(210 70% 40%)' },
    earth: { glow: 'hsl(35 70% 50%)', core: 'hsl(25 60% 35%)' },
    air: { glow: 'hsl(180 50% 65%)', core: 'hsl(190 40% 50%)' },
    void: { glow: 'hsl(270 50% 55%)', core: 'hsl(280 40% 35%)' },
  };
  
  const colors = elementColors[element] || elementColors.normal;
  const damaged = hpPercent < 100;
  
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="block">
      {/* Dark ground */}
      <rect width="24" height="24" fill="hsl(30 20% 25%)" opacity={0.3}/>
      {/* Pulsing glow */}
      <ellipse cx="12" cy="14" rx="8" ry="6" fill={colors.glow} opacity={0.2}>
        <animate attributeName="opacity" values="0.15;0.3;0.15" dur="2s" repeatCount="indefinite"/>
      </ellipse>
      {/* Nest base - organic mound shape */}
      <ellipse cx="12" cy="16" rx="9" ry="5" fill={colors.core} opacity={0.6}/>
      <ellipse cx="12" cy="15" rx="7" ry="4" fill={colors.core} opacity={0.5}/>
      {/* Tendrils / spikes around nest */}
      <path d={`M${5+r1} 14 Q${4} ${10} ${6+r1} ${7}`} stroke={colors.core} strokeWidth={1} fill="none" opacity={0.7} strokeLinecap="round"/>
      <path d={`M${18-r1} 13 Q${19} ${9} ${17-r1} ${6}`} stroke={colors.core} strokeWidth={1} fill="none" opacity={0.7} strokeLinecap="round"/>
      <path d={`M12 12 Q${12+r1} ${7} ${11+r1*2} ${4}`} stroke={colors.core} strokeWidth={0.8} fill="none" opacity={0.6} strokeLinecap="round"/>
      {/* Glowing core */}
      <ellipse cx="12" cy="13" rx="3" ry="2.5" fill={colors.glow} opacity={0.5}>
        <animate attributeName="opacity" values="0.4;0.7;0.4" dur="1.5s" repeatCount="indefinite"/>
      </ellipse>
      <ellipse cx="12" cy="13" rx="1.5" ry="1.2" fill="white" opacity={0.3}/>
      {/* Damage cracks */}
      {damaged && (
        <>
          <path d="M8 11 L10 14 L9 16" stroke={INK.dark} strokeWidth={0.6} fill="none" opacity={0.6}/>
          <path d="M15 10 L14 13 L16 15" stroke={INK.dark} strokeWidth={0.6} fill="none" opacity={0.6}/>
        </>
      )}
      {/* Ink outline */}
      <ellipse cx="12" cy="16" rx="9" ry="5" stroke={INK.medium} strokeWidth={0.5} fill="none" opacity={0.4}/>
      <line x1="0" y1="0" x2="24" y2="0" stroke={INK.faint} strokeWidth={0.3} opacity={0.3}/>
      <line x1="0" y1="0" x2="0" y2="24" stroke={INK.faint} strokeWidth={0.3} opacity={0.3}/>
    </svg>
  );
}

// ─── Dirt Road (with auto-tile shape) ───
export function OverworldDirtRoadTile({ size, seed = 0, fit }: TileGraphicProps & { fit?: AutoTileFit }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="block">
      {/* Grass surround so closed sides feel terminated, not floating */}
      <rect width="24" height="24" fill="hsl(90 35% 55%)" opacity={0.2}/>
      <g transform={fit ? `rotate(${fit.rotation} 12 12)` : undefined}>
        <DirtRoadShape shape={fit?.shape || 'cross'} seed={seed} />
      </g>
      <line x1="0" y1="0" x2="24" y2="0" stroke={INK.faint} strokeWidth={0.3} opacity={0.3}/>
      <line x1="0" y1="0" x2="0" y2="24" stroke={INK.faint} strokeWidth={0.3} opacity={0.3}/>
    </svg>
  );
}

// ─── Stone Road (with auto-tile shape) ───
export function OverworldStoneRoadTile({ size, seed = 0, fit }: TileGraphicProps & { fit?: AutoTileFit }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="block">
      <rect width="24" height="24" fill="hsl(90 35% 55%)" opacity={0.2}/>
      <g transform={fit ? `rotate(${fit.rotation} 12 12)` : undefined}>
        <StoneRoadShape shape={fit?.shape || 'cross'} seed={seed} />
      </g>
      <line x1="0" y1="0" x2="24" y2="0" stroke={INK.faint} strokeWidth={0.3} opacity={0.3}/>
      <line x1="0" y1="0" x2="0" y2="24" stroke={INK.faint} strokeWidth={0.3} opacity={0.3}/>
    </svg>
  );
}

// Internal: dirt-road body for a given canonical (unrotated) shape.
//   straight base = horizontal (E-W band)
//   corner   base = N+E (┘)
//   t        base = E+W+S (T opens south, trunk on top)
//   end      base = single connection on east; cap on west
//   cross    = plus
//   single   = round patch
function DirtRoadShape({ shape, seed }: { shape: AutoTileShape; seed: number }) {
  const DIRT = 'hsl(28 35% 48%)';
  const DIRT_DARK = 'hsl(25 30% 38%)';
  const PEBBLE = 'hsl(30 15% 55%)';
  const r1 = seededRandom(seed);

  switch (shape) {
    case 'cross':
      return (
        <>
          <rect x="0" y="7" width="24" height="10" fill={DIRT} opacity={0.55}/>
          <rect x="7" y="0" width="10" height="24" fill={DIRT} opacity={0.55}/>
          <circle cx={12} cy={12} r={5} fill={DIRT} opacity={0.6}/>
        </>
      );
    case 't':
      return (
        <>
          <rect x="0" y="7" width="24" height="10" fill={DIRT} opacity={0.55}/>
          <rect x="7" y="12" width="10" height="12" fill={DIRT} opacity={0.55}/>
        </>
      );
    case 'straight':
      return (
        <>
          <rect x="0" y="7" width="24" height="10" fill={DIRT} opacity={0.55}/>
          <line x1={0} y1={9+r1} x2={24} y2={9+r1} stroke={DIRT_DARK} strokeWidth={0.8} opacity={0.4} strokeDasharray="3 2"/>
          <line x1={0} y1={14-r1} x2={24} y2={14-r1} stroke={DIRT_DARK} strokeWidth={0.8} opacity={0.4} strokeDasharray="3 2"/>
          <circle cx={6+r1*4} cy={11} r={0.5} fill={PEBBLE} opacity={0.5}/>
          <circle cx={18-r1*3} cy={13} r={0.5} fill={PEBBLE} opacity={0.5}/>
        </>
      );
    case 'corner':
      // N+E open: vertical band on top, horizontal band on right, joined at NE
      return (
        <>
          <rect x="7" y="0"  width="10" height="14" fill={DIRT} opacity={0.55}/>
          <rect x="10" y="7" width="14" height="10" fill={DIRT} opacity={0.55}/>
          <circle cx={12} cy={12} r={5} fill={DIRT} opacity={0.55}/>
        </>
      );
    case 'end':
      // East-only connection: cap on west, road extends to east edge
      return (
        <>
          <rect x="6" y="7" width="18" height="10" fill={DIRT} opacity={0.55}/>
          <circle cx={8} cy={12} r={4.5} fill={DIRT} opacity={0.6}/>
        </>
      );
    case 'single':
      return <circle cx={12} cy={12} r={5} fill={DIRT} opacity={0.55}/>;
  }
}

// Internal: stone-road body. Uses a crisper cobble look with darker mortar.
function StoneRoadShape({ shape, seed }: { shape: AutoTileShape; seed: number }) {
  const STONE = 'hsl(218 10% 60%)';
  const STONE2 = 'hsl(212 10% 56%)';
  const STONE3 = 'hsl(220 9% 64%)';

  // Build a few cobbles inside a rectangle band.
  const cobbleBand = (x: number, y: number, w: number, h: number) => (
    <>
      <rect x={x} y={y} width={w} height={h} fill={STONE} opacity={0.6}/>
      <rect x={x+0.5} y={y+0.5} width={w/2 - 0.5} height={h/2 - 0.5} fill={STONE2} opacity={0.5} stroke={INK.faint} strokeWidth={0.25}/>
      <rect x={x+w/2} y={y+h/2} width={w/2 - 0.5} height={h/2 - 0.5} fill={STONE3} opacity={0.5} stroke={INK.faint} strokeWidth={0.25}/>
    </>
  );

  switch (shape) {
    case 'cross':
      return (
        <>
          {cobbleBand(0, 7, 24, 10)}
          {cobbleBand(7, 0, 10, 24)}
        </>
      );
    case 't':
      return (
        <>
          {cobbleBand(0, 7, 24, 10)}
          {cobbleBand(7, 12, 10, 12)}
        </>
      );
    case 'straight':
      return cobbleBand(0, 7, 24, 10);
    case 'corner':
      return (
        <>
          {cobbleBand(7, 0, 10, 14)}
          {cobbleBand(10, 7, 14, 10)}
        </>
      );
    case 'end':
      return cobbleBand(6, 7, 18, 10);
    case 'single':
      return cobbleBand(7, 7, 10, 10);
  }
}

// ─── Fog of war (unexplored) ───
export function OverworldFogTile({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="block">
      <rect width="24" height="24" fill="hsl(30 15% 25%)" opacity={0.7}/>
    </svg>
  );
}

// ─── Cliff face ───
// A vertical hatched stone face. Rendered taller than its tile so the south
// face spills over into the lower neighbor and creates the elevation illusion.
// `drops` tells us which sides drop down — that's where shadows go.
// `elevation` (0-5) adjusts the colour: higher = darker, more dramatic.
export function OverworldCliffTile({
  size,
  seed = 0,
  drops,
  elevation = 1,
}: TileGraphicProps & {
  drops?: { n: boolean; e: boolean; s: boolean; w: boolean };
  elevation?: number;
}) {
  const r1 = seededRandom(seed);
  const r2 = seededRandom(seed + 1);
  const r3 = seededRandom(seed + 2);
  // Higher elevations get progressively cooler/darker tones.
  const lightness = Math.max(35, 60 - elevation * 5);
  const baseFill = `hsl(30 12% ${lightness}%)`;
  const shadow   = `hsl(30 18% ${Math.max(20, lightness - 18)}%)`;
  const highlight = `hsl(40 20% ${Math.min(78, lightness + 18)}%)`;
  const dropS = drops?.s;
  const dropE = drops?.e;
  const dropW = drops?.w;
  const dropN = drops?.n;

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="block" style={{ overflow: 'visible' }}>
      {/* Base stone fill */}
      <rect width="24" height="24" fill={baseFill} opacity={0.95}/>
      {/* Vertical hatching — ink strokes suggesting a sheer face */}
      <line x1={4 + r1 * 2} y1={2} x2={4 + r1 * 2} y2={22} stroke={INK.dark} strokeWidth={0.7} opacity={0.55}/>
      <line x1={9 + r2 * 2} y1={2} x2={9 + r2 * 2} y2={22} stroke={INK.dark} strokeWidth={0.6} opacity={0.5}/>
      <line x1={14 + r3 * 2} y1={2} x2={14 + r3 * 2} y2={22} stroke={INK.dark} strokeWidth={0.7} opacity={0.55}/>
      <line x1={19 + r1 * 2} y1={2} x2={19 + r1 * 2} y2={22} stroke={INK.dark} strokeWidth={0.6} opacity={0.5}/>
      {/* Cracks */}
      <path d={`M${6 + r1 * 3} ${4 + r2 * 3} L${8 + r2 * 2} ${10 + r3 * 3} L${5 + r3 * 2} ${16 + r1 * 3}`}
            stroke={INK.dark} strokeWidth={0.4} fill="none" opacity={0.6}/>
      <path d={`M${15 + r2 * 3} ${5 + r1 * 3} L${17 + r3 * 2} ${12 + r2 * 3} L${14 + r1 * 2} ${18 + r3 * 3}`}
            stroke={INK.dark} strokeWidth={0.4} fill="none" opacity={0.5}/>
      {/* Edge highlights along the dropping sides — catches light from above */}
      {dropN && <line x1="0" y1="1" x2="24" y2="1" stroke={highlight} strokeWidth={1.2} opacity={0.8}/>}
      {dropS && (
        <>
          {/* Drop shadow spilling down into the lower neighbor */}
          <rect x="0" y="22" width="24" height="6" fill={shadow} opacity={0.55}/>
          <line x1="0" y1="23" x2="24" y2="23" stroke={INK.dark} strokeWidth={0.8} opacity={0.85}/>
        </>
      )}
      {dropE && (
        <>
          <rect x="22" y="0" width="6" height="24" fill={shadow} opacity={0.4}/>
          <line x1="23" y1="0" x2="23" y2="24" stroke={INK.dark} strokeWidth={0.7} opacity={0.75}/>
        </>
      )}
      {dropW && <line x1="1" y1="0" x2="1" y2="24" stroke={INK.dark} strokeWidth={0.7} opacity={0.75}/>}
      {/* Tile grid lines — lighter than usual so they don't dominate */}
      <line x1="0" y1="0" x2="24" y2="0" stroke={INK.faint} strokeWidth={0.3} opacity={0.2}/>
      <line x1="0" y1="0" x2="0" y2="24" stroke={INK.faint} strokeWidth={0.3} opacity={0.2}/>
    </svg>
  );
}

// ─── Ramp ───
// Walkable diagonal slope. Direction is which way it climbs UP (so a 's'
// ramp climbs up toward the south = its south edge is the high side).
// `hasStairs` overlays a stone-road style stair pattern.
export function OverworldRampTile({
  size,
  seed = 0,
  direction = 's',
  hasStairs,
}: TileGraphicProps & {
  direction?: 'n' | 's' | 'e' | 'w';
  hasStairs?: boolean;
}) {
  const r1 = seededRandom(seed);
  // Gradient runs from the LOW edge (lighter, sunlit) to the HIGH edge (darker, in shadow).
  // We draw a diagonal slope band using a linear gradient.
  const gradId = `ramp-grad-${seed}`;
  // Direction → from/to coordinates of the gradient.
  const grad = (() => {
    switch (direction) {
      case 'n': return { x1: '50%', y1: '100%', x2: '50%', y2: '0%' };  // climbs up = north
      case 's': return { x1: '50%', y1: '0%',   x2: '50%', y2: '100%' };
      case 'e': return { x1: '0%',  y1: '50%',  x2: '100%', y2: '50%' };
      case 'w': return { x1: '100%', y1: '50%', x2: '0%',  y2: '50%' };
    }
  })();
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="block">
      <defs>
        <linearGradient id={gradId} x1={grad.x1} y1={grad.y1} x2={grad.x2} y2={grad.y2}>
          <stop offset="0%" stopColor="hsl(40 25% 65%)" stopOpacity={0.85}/>
          <stop offset="100%" stopColor="hsl(30 18% 38%)" stopOpacity={0.9}/>
        </linearGradient>
      </defs>
      {/* Slope band */}
      <rect width="24" height="24" fill={`url(#${gradId})`}/>
      {/* Subtle edge stones along both flanks */}
      <circle cx={3} cy={4 + r1 * 2} r={1.2} fill={INK.medium} opacity={0.45}/>
      <circle cx={21} cy={20 - r1 * 2} r={1.0} fill={INK.medium} opacity={0.4}/>
      {/* Chevrons pointing UP the slope so the player can read the direction */}
      {(() => {
        const chev = (cx: number, cy: number) => {
          // Chevron rotated to point in `direction`.
          const rot =
            direction === 'n' ? 0 :
            direction === 'e' ? 90 :
            direction === 's' ? 180 :
            270;
          return (
            <g transform={`translate(${cx} ${cy}) rotate(${rot})`}>
              <path d="M-3 1 L0 -2 L3 1" stroke={INK.dark} strokeWidth={0.9} fill="none"
                    strokeLinecap="round" strokeLinejoin="round" opacity={0.7}/>
            </g>
          );
        };
        return (
          <>
            {chev(12, 8)}
            {chev(12, 14)}
          </>
        );
      })()}
      {/* Stair overlay (when the player has laid a stair-road on this ramp) */}
      {hasStairs && (() => {
        // Horizontal lines stepping up the slope. Aligns with road aesthetic.
        const lines: React.ReactNode[] = [];
        const isVertical = direction === 'n' || direction === 's';
        for (let i = 1; i < 6; i++) {
          if (isVertical) {
            lines.push(<line key={i} x1={3} y1={i * 4} x2={21} y2={i * 4}
              stroke="hsl(30 18% 28%)" strokeWidth={0.8} opacity={0.85}/>);
          } else {
            lines.push(<line key={i} x1={i * 4} y1={3} x2={i * 4} y2={21}
              stroke="hsl(30 18% 28%)" strokeWidth={0.8} opacity={0.85}/>);
          }
        }
        return <>{lines}</>;
      })()}
      {/* Grid lines */}
      <line x1="0" y1="0" x2="24" y2="0" stroke={INK.faint} strokeWidth={0.3} opacity={0.3}/>
      <line x1="0" y1="0" x2="0" y2="24" stroke={INK.faint} strokeWidth={0.3} opacity={0.3}/>
    </svg>
  );
}

// ─── Waterfall ───
// Animated cascading water. Direction is the side it cascades TOWARD (down
// to the lower neighbor). Uses CSS keyframes for the flow animation —
// reusing the same approach as the ambient water shimmer.
export function OverworldWaterfallTile({
  size,
  seed = 0,
  direction = 's',
}: TileGraphicProps & { direction?: 'n' | 's' | 'e' | 'w' }) {
  const r1 = seededRandom(seed);
  const animId = `waterfall-flow-${seed}`;
  // Flow goes from the HIGH side (top of cascade) to the LOW side (bottom).
  // For a 's' waterfall the water flows downward, so streaks animate top→bottom.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="block">
      <defs>
        <style>{`
          @keyframes ${animId} {
            0%   { transform: translateY(0); opacity: 0.85; }
            50%  { opacity: 1; }
            100% { transform: translateY(${direction === 's' ? 6 : direction === 'n' ? -6 : 0}px)
                              translateX(${direction === 'e' ? 6 : direction === 'w' ? -6 : 0}px);
                   opacity: 0.85; }
          }
          .wf-streak-${seed} { animation: ${animId} 0.8s ease-in-out infinite alternate; }
        `}</style>
      </defs>
      {/* Background water tone */}
      <rect width="24" height="24" fill="hsl(200 55% 68%)" opacity={0.55}/>
      {/* Cascading streaks — vertical for n/s, horizontal for e/w */}
      <g className={`wf-streak-${seed}`}>
        {(direction === 's' || direction === 'n') ? (
          <>
            <line x1={5 + r1 * 2}  y1={1} x2={5 + r1 * 2}  y2={23}
                  stroke="hsl(195 80% 90%)" strokeWidth={1.6} opacity={0.85} strokeLinecap="round"/>
            <line x1={11 + r1}     y1={2} x2={11 + r1}     y2={22}
                  stroke="hsl(200 90% 95%)" strokeWidth={2.0} opacity={0.95} strokeLinecap="round"/>
            <line x1={17 - r1 * 2} y1={1} x2={17 - r1 * 2} y2={23}
                  stroke="hsl(195 80% 90%)" strokeWidth={1.4} opacity={0.8} strokeLinecap="round"/>
            <line x1={20 - r1}     y1={3} x2={20 - r1}     y2={21}
                  stroke="hsl(200 75% 85%)" strokeWidth={1.2} opacity={0.7} strokeLinecap="round"/>
          </>
        ) : (
          <>
            <line x1={1} y1={5 + r1 * 2}  x2={23} y2={5 + r1 * 2}
                  stroke="hsl(195 80% 90%)" strokeWidth={1.6} opacity={0.85} strokeLinecap="round"/>
            <line x1={2} y1={11 + r1}     x2={22} y2={11 + r1}
                  stroke="hsl(200 90% 95%)" strokeWidth={2.0} opacity={0.95} strokeLinecap="round"/>
            <line x1={1} y1={17 - r1 * 2} x2={23} y2={17 - r1 * 2}
                  stroke="hsl(195 80% 90%)" strokeWidth={1.4} opacity={0.8} strokeLinecap="round"/>
          </>
        )}
      </g>
      {/* Foam at the impact edge */}
      {direction === 's' && (
        <ellipse cx={12} cy={22} rx={9} ry={1.6} fill="hsl(200 60% 96%)" opacity={0.85}/>
      )}
      {direction === 'n' && (
        <ellipse cx={12} cy={2} rx={9} ry={1.6} fill="hsl(200 60% 96%)" opacity={0.85}/>
      )}
      {direction === 'e' && (
        <ellipse cx={22} cy={12} rx={1.6} ry={9} fill="hsl(200 60% 96%)" opacity={0.85}/>
      )}
      {direction === 'w' && (
        <ellipse cx={2} cy={12} rx={1.6} ry={9} fill="hsl(200 60% 96%)" opacity={0.85}/>
      )}
      {/* Grid lines */}
      <line x1="0" y1="0" x2="24" y2="0" stroke={INK.faint} strokeWidth={0.3} opacity={0.3}/>
      <line x1="0" y1="0" x2="0" y2="24" stroke={INK.faint} strokeWidth={0.3} opacity={0.3}/>
    </svg>
  );
}
