// Hand-drawn ink style tile graphics with watercolor accents
// Inspired by tabletop RPG map aesthetics

import { TerrainType, TERRAIN_CONFIG } from './terrain';
import { TrapType, PlantType } from './types';

interface TileGraphicProps {
  size: number;
  seed?: number; // For consistent randomization
}

// Sepia-toned ink colors
const INK_COLORS = {
  dark: 'hsl(30 15% 20%)',
  medium: 'hsl(30 20% 35%)',
  light: 'hsl(30 25% 50%)',
  faint: 'hsl(30 30% 70%)',
};

// Watercolor accent colors for terrain
const WATERCOLOR = {
  water: { main: 'hsl(190 70% 55%)', light: 'hsl(185 60% 75%)' },
  lava: { main: 'hsl(15 85% 50%)', light: 'hsl(25 80% 65%)' },
  rubble: { main: 'hsl(35 50% 45%)', light: 'hsl(40 45% 60%)' },
  vents: { main: 'hsl(200 30% 70%)', light: 'hsl(195 25% 85%)' },
  shadows: { main: 'hsl(270 40% 30%)', light: 'hsl(265 35% 50%)' },
  spikes: { main: 'hsl(0 5% 40%)', light: 'hsl(0 5% 55%)' },
  lasers: { main: 'hsl(50 90% 55%)', light: 'hsl(45 85% 70%)' },
  acid: { main: 'hsl(100 65% 45%)', light: 'hsl(105 55% 60%)' },
  tendrils: { main: 'hsl(340 50% 50%)', light: 'hsl(335 45% 65%)' },
  psychic: { main: 'hsl(280 60% 55%)', light: 'hsl(275 50% 70%)' },
};

// Generate pseudo-random number from seed
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

// Floor tile with grid lines
export function FloorTile({ size, seed = 0 }: TileGraphicProps) {
  const strokeWidth = Math.max(0.5, size * 0.02);
  const r1 = seededRandom(seed);
  const r2 = seededRandom(seed + 1);
  
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="block">
      {/* Subtle floor texture variation */}
      {r1 > 0.7 && (
        <circle 
          cx={4 + r2 * 16} 
          cy={4 + r1 * 16} 
          r={0.5 + r2 * 0.5} 
          fill={INK_COLORS.faint} 
          opacity={0.3}
        />
      )}
      {/* Grid lines - subtle ink strokes */}
      <line x1="0" y1="0" x2="24" y2="0" stroke={INK_COLORS.faint} strokeWidth={strokeWidth} opacity={0.4} />
      <line x1="0" y1="0" x2="0" y2="24" stroke={INK_COLORS.faint} strokeWidth={strokeWidth} opacity={0.4} />
      {/* Occasional floor crack */}
      {r1 > 0.85 && (
        <path 
          d={`M${3 + r2 * 5} ${8 + r1 * 4} Q${12} ${12 + r2 * 2} ${18 - r1 * 4} ${16 + r2 * 3}`}
          stroke={INK_COLORS.faint}
          strokeWidth={0.3}
          fill="none"
          opacity={0.5}
        />
      )}
    </svg>
  );
}

// Wall tile with rocky ink texture
export function WallTile({ size, seed = 0 }: TileGraphicProps) {
  const r1 = seededRandom(seed);
  const r2 = seededRandom(seed + 1);
  const r3 = seededRandom(seed + 2);
  
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="block">
      {/* Dark rocky fill */}
      <rect width="24" height="24" fill="hsl(220 15% 30%)" />
      
      {/* Rocky texture with irregular shapes */}
      <circle cx={5 + r1 * 3} cy={5 + r2 * 3} r={3 + r3} fill="hsl(220 15% 35%)" />
      <circle cx={15 + r2 * 4} cy={8 + r1 * 3} r={2.5 + r1 * 1.5} fill="hsl(220 15% 25%)" />
      <circle cx={8 + r3 * 4} cy={17 + r1 * 3} r={3 + r2} fill="hsl(220 15% 33%)" />
      <circle cx={18 + r1 * 2} cy={18 + r3 * 2} r={2 + r2 * 1.5} fill="hsl(220 15% 28%)" />
      
      {/* Ink outline strokes for hand-drawn feel */}
      <path 
        d={`M${2 + r1 * 2} ${6 + r2} Q${6} ${4 + r3 * 2} ${10 + r1 * 2} ${5 + r2}`}
        stroke={INK_COLORS.dark}
        strokeWidth={0.8}
        fill="none"
        strokeLinecap="round"
        opacity={0.7}
      />
      <path 
        d={`M${14 + r2} ${3 + r1} Q${18} ${6 + r3} ${21 + r1} ${8 + r2 * 2}`}
        stroke={INK_COLORS.dark}
        strokeWidth={0.6}
        fill="none"
        strokeLinecap="round"
        opacity={0.6}
      />
      <path 
        d={`M${3 + r3} ${14 + r1} Q${8 + r2} ${16} ${12 + r1} ${18 + r3}`}
        stroke={INK_COLORS.dark}
        strokeWidth={0.7}
        fill="none"
        strokeLinecap="round"
        opacity={0.65}
      />
    </svg>
  );
}

// Terrain tile with watercolor wash effect.
//
// Auto-tiling: when `fit` is supplied, the watercolor "pool" extends to the
// edge of the tile on sides where the same terrain type is present in a
// neighboring tile, and stays inset on closed sides. This makes connected
// terrain (lava lakes, water rivers, shadow voids, etc.) read as a single
// continuous body instead of a grid of disconnected circles.
import type { AutoTileFit } from './autoTiling';

export function TerrainTile({
  size,
  terrainType,
  seed = 0,
  fit,
}: TileGraphicProps & { terrainType: TerrainType; fit?: AutoTileFit }) {
  const colors = WATERCOLOR[terrainType];
  const config = TERRAIN_CONFIG[terrainType];
  const r1 = seededRandom(seed);
  const r2 = seededRandom(seed + 1);
  const r3 = seededRandom(seed + 2);

  // Determine open sides (default = all open ⇒ tile bleeds in every direction,
  // matching the legacy uniform look for unconnected terrain).
  let n = true, e = true, s = true, w = true;
  if (fit) {
    const opens = openSidesFromTerrainFit(fit);
    n = opens.n; e = opens.e; s = opens.s; w = opens.w;
  }
  const isolated = !n && !e && !s && !w;
  const inset = 1.5;
  const left   = w ? 0 : inset;
  const right  = e ? 24 : 24 - inset;
  const top    = n ? 0 : inset;
  const bottom = s ? 24 : 24 - inset;
  const wWidth  = right - left;
  const wHeight = bottom - top;
  const cx = (left + right) / 2;
  const cy = (top + bottom) / 2;
  // For isolated tiles we keep the soft round-ish shape; for connected ones we use
  // a full rect so adjoining edges meet seamlessly.
  const baseShape = isolated
    ? <ellipse cx="12" cy="12" rx="10" ry="10" fill={colors.main} opacity={0.55} />
    : <rect x={left} y={top} width={wWidth} height={wHeight} fill={colors.main} opacity={0.5} />;

  // Different patterns based on terrain type — decorations only; the watercolor
  // wash above handles the connected silhouette.
  const getTerrainPattern = () => {
    switch (terrainType) {
      case 'water':
        return (
          <>
            {baseShape}
            <path d={`M${w ? -1 : 3} ${cy - 2 + r1 * 3} Q${cx - 4} ${cy - 4 + r2 * 3} ${cx} ${cy - 1 + r1 * 2} T${e ? 25 : 21} ${cy - 2 + r2 * 3}`}
                  stroke={colors.light} strokeWidth={1.5} fill="none" opacity={0.7} />
            <path d={`M${w ? -1 : 2} ${cy + 2 + r2 * 2} Q${cx - 4} ${cy + r1 * 2} ${cx} ${cy + 2 + r2} T${e ? 25 : 22} ${cy + 1 + r1 * 2}`}
                  stroke="white" strokeWidth={0.8} fill="none" opacity={0.5} />
          </>
        );
      case 'lava':
        return (
          <>
            {baseShape}
            <circle cx={cx - 4 + r1 * 4} cy={cy - 3 + r2 * 4} r={2 + r3} fill={colors.light} opacity={0.7} />
            <circle cx={cx + 2 + r2 * 4} cy={cy + 2 + r1 * 3} r={1.5 + r1} fill="hsl(45 95% 60%)" opacity={0.6} />
            <circle cx={cx - 1 + r3 * 2} cy={cy + 4 + r1 * 2} r={1 + r2 * 0.5} fill={colors.light} opacity={0.5} />
          </>
        );
      case 'rubble':
        // Rubble = scattered debris; never want it to "merge" visually, so always isolated-look.
        return (
          <>
            <ellipse cx={8 + r1 * 3} cy={10 + r2 * 2} rx={4 + r3} ry={3 + r1} fill={colors.main} opacity={0.7} />
            <ellipse cx={15 + r2} cy={8 + r1 * 2} rx={3 + r1} ry={2.5 + r2} fill={colors.light} opacity={0.6} />
            <ellipse cx={12 + r3 * 2} cy={16 + r1} rx={3.5 + r2} ry={2 + r3 * 0.5} fill={colors.main} opacity={0.5} />
            <path d={`M${6 + r1 * 2} ${9 + r2} L${10 + r1} ${7 + r2 * 2} L${9 + r2 * 2} ${12 + r1}`}
                  stroke={INK_COLORS.medium} strokeWidth={0.5} fill="none" />
          </>
        );
      case 'vents':
        return (
          <>
            {baseShape}
            <path d={`M${cx - 4} ${cy + 4} Q${cx - 5 + r1 * 2} ${cy - 2} ${cx - 3 + r2} ${cy - 8}`}
                  stroke={colors.light} strokeWidth={2} fill="none" opacity={0.5} strokeLinecap="round" />
            <path d={`M${cx} ${cy + 4} Q${cx - 1 + r2} ${cy - 4} ${cx + 1 + r1} ${cy - 10}`}
                  stroke="white" strokeWidth={1.5} fill="none" opacity={0.4} strokeLinecap="round" />
            <path d={`M${cx + 4} ${cy + 4} Q${cx + 3 + r3} ${cy - 1} ${cx + 2 + r1 * 2} ${cy - 7}`}
                  stroke={colors.light} strokeWidth={1.5} fill="none" opacity={0.45} strokeLinecap="round" />
          </>
        );
      case 'shadows':
        return (
          <>
            {baseShape}
            {isolated && <ellipse cx="12" cy="12" rx="7" ry="7" fill="hsl(270 50% 15%)" opacity={0.5} />}
            {!isolated && <rect x={left} y={top} width={wWidth} height={wHeight} fill="hsl(270 50% 15%)" opacity={0.35} />}
            <circle cx={cx - 2 + r1 * 4} cy={cy - 2 + r2 * 4} r={2} fill={colors.light} opacity={0.3} />
          </>
        );
      case 'spikes':
        // Spikes are physical protrusions, not a fluid — keep per-tile.
        return (
          <>
            <polygon points={`6,20 8,${6 + r1 * 3} 10,20`} fill={colors.main} opacity={0.8} />
            <polygon points={`10,20 12,${4 + r2 * 2} 14,20`} fill={colors.light} opacity={0.7} />
            <polygon points={`14,20 16,${7 + r3 * 2} 18,20`} fill={colors.main} opacity={0.75} />
            <path d={`M6 20 L8 ${6 + r1 * 3} L10 20`} stroke={INK_COLORS.dark} strokeWidth={0.5} fill="none" />
            <path d={`M10 20 L12 ${4 + r2 * 2} L14 20`} stroke={INK_COLORS.dark} strokeWidth={0.5} fill="none" />
          </>
        );
      case 'lasers':
        // Lasers are beams — bleed across edges on open sides for continuous beams.
        return (
          <>
            <line x1={w ? -1 : 4} y1={n ? -1 : 4} x2={e ? 25 : 20} y2={s ? 25 : 20}
                  stroke={colors.main} strokeWidth={3} opacity={0.6} />
            <line x1={w ? -1 : 4} y1={n ? -1 : 4} x2={e ? 25 : 20} y2={s ? 25 : 20}
                  stroke={colors.light} strokeWidth={1.5} opacity={0.8} />
            <line x1={e ? 25 : 20} y1={n ? -1 : 4} x2={w ? -1 : 4} y2={s ? 25 : 20}
                  stroke={colors.main} strokeWidth={2.5} opacity={0.5} />
            <circle cx="12" cy="12" r="3" fill={colors.light} opacity={0.5} />
          </>
        );
      case 'acid':
        return (
          <>
            {baseShape}
            <circle cx={cx - 4 + r1 * 2} cy={cy - 2 + r2 * 3} r={1.5 + r3 * 0.5} fill={colors.light} opacity={0.7} />
            <circle cx={cx + 3 + r2} cy={cy - 1 + r1 * 2} r={1 + r1 * 0.5} fill="white" opacity={0.4} />
            <circle cx={cx - 1 + r3} cy={cy + 3 + r2} r={0.8 + r2 * 0.3} fill={colors.light} opacity={0.6} />
            <circle cx={cx - 3 + r1 * 3} cy={cy - 4 + r3 * 2} r={0.6} fill="white" opacity={0.5} />
          </>
        );
      case 'tendrils':
        // Tendrils = vines; keep per-tile but lengthen to edges on open sides.
        return (
          <>
            {!isolated && <rect x={left} y={top} width={wWidth} height={wHeight} fill={colors.main} opacity={0.18} />}
            <path d={`M${w ? -1 : 4} 20 Q${8 + r1 * 4} ${12 - r2 * 4} ${6 + r3 * 2} ${n ? -1 : 4}`}
                  stroke={colors.main} strokeWidth={2.5} fill="none" strokeLinecap="round" opacity={0.7} />
            <path d={`M10 ${s ? 25 : 22} Q${12 + r2 * 2} ${10 - r1 * 3} ${14 + r3} ${n ? -1 : 2}`}
                  stroke={colors.light} strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.6} />
            <path d={`M${e ? 25 : 18} 20 Q${16 - r3 * 2} ${14 - r2 * 3} ${20 - r1 * 2} ${n ? -1 : 6}`}
                  stroke={colors.main} strokeWidth={1.8} fill="none" strokeLinecap="round" opacity={0.65} />
            <circle cx={6 + r3 * 2} cy={5} r={1.5} fill={colors.light} opacity={0.5} />
          </>
        );
      case 'psychic':
        return (
          <>
            {baseShape}
            {isolated && (
              <>
                <circle cx="12" cy="12" r="7" fill={colors.light} opacity={0.25} />
                <circle cx="12" cy="12" r="4" fill={colors.main} opacity={0.4} />
                <circle cx="12" cy="12" r="9" stroke={colors.light} strokeWidth={0.5} fill="none" opacity={0.4} />
                <circle cx="12" cy="12" r="6" stroke={colors.light} strokeWidth={0.4} fill="none" opacity={0.5} />
              </>
            )}
            <circle cx="12" cy="12" r="2" fill="white" opacity={0.5} />
          </>
        );
      default:
        return baseShape;
    }
  };

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="block">
      {/* Base floor grid */}
      <line x1="0" y1="0" x2="24" y2="0" stroke={INK_COLORS.faint} strokeWidth={0.3} opacity={0.3} />
      <line x1="0" y1="0" x2="0" y2="24" stroke={INK_COLORS.faint} strokeWidth={0.3} opacity={0.3} />

      {/* Terrain pattern */}
      {getTerrainPattern()}
    </svg>
  );
}

// Convert an AutoTileFit (shape + rotation) back into NESW open-flags.
// Kept local to avoid coupling to the overworld file. Mirrors the logic
// in OverworldTileGraphics.tsx#openSidesFromFit.
function openSidesFromTerrainFit(fit: AutoTileFit): { n: boolean; e: boolean; s: boolean; w: boolean } {
  const rotateNESW = (n: boolean, e: boolean, s: boolean, w: boolean, deg: number) => {
    const steps = ((deg / 90) % 4 + 4) % 4;
    let arr = [n, e, s, w];
    for (let i = 0; i < steps; i++) arr = [arr[3], arr[0], arr[1], arr[2]]; // CW
    return { n: arr[0], e: arr[1], s: arr[2], w: arr[3] };
  };
  switch (fit.shape) {
    case 'cross':    return { n: true, e: true, s: true, w: true };
    case 'single':   return { n: false, e: false, s: false, w: false };
    case 'straight': return rotateNESW(false, true, false, true, fit.rotation);
    case 'corner':   return rotateNESW(true, true, false, false, fit.rotation);
    case 't':        return rotateNESW(false, true, true, true, fit.rotation);
    case 'end':      return rotateNESW(false, true, false, false, fit.rotation);
  }
}

// Stairs tile
export function StairsTile({ size, seed = 0 }: TileGraphicProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="block">
      {/* Grid lines */}
      <line x1="0" y1="0" x2="24" y2="0" stroke={INK_COLORS.faint} strokeWidth={0.3} opacity={0.4} />
      <line x1="0" y1="0" x2="0" y2="24" stroke={INK_COLORS.faint} strokeWidth={0.3} opacity={0.4} />
      
      {/* Descending stairs - hand drawn style */}
      <rect x="4" y="4" width="16" height="3" fill="hsl(35 40% 75%)" stroke={INK_COLORS.medium} strokeWidth={0.5} />
      <rect x="5" y="7" width="14" height="3" fill="hsl(35 40% 70%)" stroke={INK_COLORS.medium} strokeWidth={0.5} />
      <rect x="6" y="10" width="12" height="3" fill="hsl(35 40% 65%)" stroke={INK_COLORS.medium} strokeWidth={0.5} />
      <rect x="7" y="13" width="10" height="3" fill="hsl(35 40% 55%)" stroke={INK_COLORS.medium} strokeWidth={0.5} />
      <rect x="8" y="16" width="8" height="3" fill="hsl(35 40% 45%)" stroke={INK_COLORS.medium} strokeWidth={0.5} />
      
      {/* Down arrow */}
      <path d="M12 19 L9 15 L15 15 Z" fill={INK_COLORS.dark} opacity={0.7} />
    </svg>
  );
}

// Treasure tile
export function TreasureTile({ size, seed = 0 }: TileGraphicProps) {
  const r1 = seededRandom(seed);
  
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="block">
      {/* Grid lines */}
      <line x1="0" y1="0" x2="24" y2="0" stroke={INK_COLORS.faint} strokeWidth={0.3} opacity={0.4} />
      <line x1="0" y1="0" x2="0" y2="24" stroke={INK_COLORS.faint} strokeWidth={0.3} opacity={0.4} />
      
      {/* Treasure chest - watercolor style */}
      <rect x="5" y="10" width="14" height="10" rx="1" fill="hsl(30 60% 35%)" />
      <rect x="5" y="8" width="14" height="5" rx="1" fill="hsl(30 55% 45%)" />
      {/* Lid highlight */}
      <path d="M6 8 Q12 6 18 8" stroke="hsl(40 50% 60%)" strokeWidth={0.8} fill="none" />
      {/* Lock */}
      <circle cx="12" cy="14" r="2" fill="hsl(45 80% 55%)" stroke={INK_COLORS.medium} strokeWidth={0.4} />
      <rect x="11" y="14" width="2" height="3" fill="hsl(45 80% 55%)" stroke={INK_COLORS.medium} strokeWidth={0.3} />
      {/* Sparkle */}
      <circle cx={7 + r1 * 2} cy={7} r={0.8} fill="hsl(45 90% 70%)" opacity={0.8} />
      {/* Ink outline */}
      <rect x="5" y="8" width="14" height="12" rx="1" stroke={INK_COLORS.dark} strokeWidth={0.6} fill="none" />
    </svg>
  );
}

// Trap tile
export function TrapTile({ size, trapType, triggered = false, seed = 0 }: TileGraphicProps & { trapType: TrapType; triggered?: boolean }) {
  const r1 = seededRandom(seed);
  
  const getTrapGraphic = () => {
    switch (trapType) {
      case 'spike':
        return (
          <>
            <polygon points="8,18 10,6 12,18" fill={triggered ? 'hsl(0 5% 50%)' : 'hsl(0 5% 40%)'} opacity={0.8} />
            <polygon points="12,18 14,8 16,18" fill={triggered ? 'hsl(0 5% 55%)' : 'hsl(0 5% 35%)'} opacity={0.75} />
            <path d="M8 18 L10 6 L12 18 M12 18 L14 8 L16 18" stroke={INK_COLORS.dark} strokeWidth={0.5} fill="none" />
            {!triggered && <circle cx="12" cy="5" r="1" fill="hsl(0 70% 50%)" opacity={0.6} />}
          </>
        );
      case 'poison':
        return (
          <>
            <ellipse cx="12" cy="14" rx="7" ry="5" fill={triggered ? 'hsl(120 30% 40%)' : 'hsl(280 50% 40%)'} opacity={0.5} />
            <circle cx={9 + r1 * 2} cy={12} r={1.5} fill={triggered ? 'hsl(120 25% 50%)' : 'hsl(280 45% 55%)'} opacity={0.6} />
            <circle cx={14} cy={14 + r1} r={1} fill="white" opacity={0.3} />
            {!triggered && (
              <path d="M10 8 L12 4 L14 8 M11 6 L12 4 L13 6" stroke="hsl(280 50% 50%)" strokeWidth={0.8} fill="none" />
            )}
          </>
        );
      case 'alarm':
        return (
          <>
            <ellipse cx="12" cy="15" rx="5" ry="3" fill="hsl(40 70% 50%)" opacity={0.4} />
            <path d="M12 6 L12 12" stroke="hsl(40 60% 45%)" strokeWidth={1.5} />
            <circle cx="12" cy="12" r="3" fill="hsl(40 65% 55%)" stroke={INK_COLORS.medium} strokeWidth={0.4} />
            {!triggered && (
              <>
                <path d="M7 8 Q6 6 8 5" stroke="hsl(50 80% 60%)" strokeWidth={0.6} fill="none" />
                <path d="M17 8 Q18 6 16 5" stroke="hsl(50 80% 60%)" strokeWidth={0.6} fill="none" />
              </>
            )}
          </>
        );
    }
  };
  
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="block">
      {/* Grid lines */}
      <line x1="0" y1="0" x2="24" y2="0" stroke={INK_COLORS.faint} strokeWidth={0.3} opacity={0.4} />
      <line x1="0" y1="0" x2="0" y2="24" stroke={INK_COLORS.faint} strokeWidth={0.3} opacity={0.4} />
      
      {/* Warning highlight if not triggered */}
      {!triggered && <ellipse cx="12" cy="14" rx="9" ry="7" fill="hsl(0 60% 60%)" opacity={0.15} />}
      
      {getTrapGraphic()}
    </svg>
  );
}

// Plant tile
export function PlantTile({ size, plantType, harvested = false, seed = 0 }: TileGraphicProps & { plantType: PlantType; harvested?: boolean }) {
  const r1 = seededRandom(seed);
  const r2 = seededRandom(seed + 1);
  
  if (harvested) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" className="block">
        <line x1="0" y1="0" x2="24" y2="0" stroke={INK_COLORS.faint} strokeWidth={0.3} opacity={0.4} />
        <line x1="0" y1="0" x2="0" y2="24" stroke={INK_COLORS.faint} strokeWidth={0.3} opacity={0.4} />
        {/* Harvested stump */}
        <ellipse cx="12" cy="18" rx="4" ry="2" fill="hsl(30 35% 40%)" opacity={0.5} />
        <rect x="10" y="14" width="4" height="4" fill="hsl(30 35% 45%)" />
      </svg>
    );
  }
  
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="block">
      {/* Grid lines */}
      <line x1="0" y1="0" x2="24" y2="0" stroke={INK_COLORS.faint} strokeWidth={0.3} opacity={0.4} />
      <line x1="0" y1="0" x2="0" y2="24" stroke={INK_COLORS.faint} strokeWidth={0.3} opacity={0.4} />
      
      {/* Plant base */}
      <ellipse cx="12" cy="19" rx="5" ry="2" fill="hsl(100 40% 35%)" opacity={0.5} />
      
      {/* Stem */}
      <path d={`M12 19 Q${11 + r1} 14 12 10`} stroke="hsl(100 45% 35%)" strokeWidth={1.5} fill="none" />
      
      {/* Leaves */}
      <ellipse cx={9} cy={12} rx={3} ry={2} fill="hsl(110 55% 45%)" opacity={0.7} transform={`rotate(-30 9 12)`} />
      <ellipse cx={15} cy={11} rx={3} ry={2} fill="hsl(115 50% 50%)" opacity={0.65} transform={`rotate(25 15 11)`} />
      
      {/* Flower/fruit highlight based on type */}
      <circle cx={12} cy={7 + r2} r={2.5} fill="hsl(340 60% 60%)" opacity={0.6} />
      <circle cx={12} cy={7 + r2} r={1.2} fill="hsl(50 70% 65%)" opacity={0.7} />
    </svg>
  );
}

// Shop tile
export function ShopTile({ size, seed = 0 }: TileGraphicProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="block">
      {/* Grid lines */}
      <line x1="0" y1="0" x2="24" y2="0" stroke={INK_COLORS.faint} strokeWidth={0.3} opacity={0.4} />
      <line x1="0" y1="0" x2="0" y2="24" stroke={INK_COLORS.faint} strokeWidth={0.3} opacity={0.4} />
      
      {/* Shop stall */}
      <rect x="4" y="10" width="16" height="10" fill="hsl(30 50% 45%)" stroke={INK_COLORS.medium} strokeWidth={0.5} />
      {/* Awning */}
      <path d="M3 10 L12 4 L21 10 Z" fill="hsl(140 45% 45%)" stroke={INK_COLORS.medium} strokeWidth={0.5} />
      <path d="M3 10 L12 4" stroke="hsl(140 40% 55%)" strokeWidth={0.6} />
      {/* Counter */}
      <rect x="5" y="12" width="14" height="2" fill="hsl(35 45% 55%)" />
      {/* Items on display */}
      <circle cx="8" cy="11" r="1.5" fill="hsl(45 70% 60%)" />
      <rect x="11" y="9" width="2" height="3" fill="hsl(200 50% 50%)" rx="0.3" />
      <circle cx="16" cy="11" r="1.2" fill="hsl(0 60% 55%)" />
    </svg>
  );
}

// Elevator tile
export function ElevatorTile({ size, seed = 0 }: TileGraphicProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="block">
      {/* Grid lines */}
      <line x1="0" y1="0" x2="24" y2="0" stroke={INK_COLORS.faint} strokeWidth={0.3} opacity={0.4} />
      <line x1="0" y1="0" x2="0" y2="24" stroke={INK_COLORS.faint} strokeWidth={0.3} opacity={0.4} />
      
      {/* Elevator platform */}
      <rect x="4" y="4" width="16" height="16" rx="2" fill="hsl(260 40% 50%)" opacity={0.4} stroke={INK_COLORS.medium} strokeWidth={0.5} />
      <rect x="6" y="6" width="12" height="12" rx="1" fill="hsl(260 35% 60%)" opacity={0.3} />
      
      {/* Elevator mechanism */}
      <line x1="12" y1="2" x2="12" y2="7" stroke="hsl(260 30% 40%)" strokeWidth={1.5} />
      <rect x="8" y="8" width="8" height="10" rx="1" fill="hsl(260 45% 55%)" stroke={INK_COLORS.medium} strokeWidth={0.4} />
      
      {/* Arrow indicators */}
      <path d="M12 10 L10 13 L14 13 Z" fill="white" opacity={0.7} />
      <path d="M12 16 L10 13 L14 13 Z" fill="white" opacity={0.5} />
    </svg>
  );
}

// Door tile  
export function DoorTile({ size, seed = 0 }: TileGraphicProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="block">
      {/* Grid lines */}
      <line x1="0" y1="0" x2="24" y2="0" stroke={INK_COLORS.faint} strokeWidth={0.3} opacity={0.4} />
      <line x1="0" y1="0" x2="0" y2="24" stroke={INK_COLORS.faint} strokeWidth={0.3} opacity={0.4} />
      
      {/* Door frame */}
      <rect x="6" y="2" width="12" height="20" fill="hsl(25 45% 35%)" stroke={INK_COLORS.dark} strokeWidth={0.6} />
      {/* Door panels */}
      <rect x="8" y="4" width="8" height="6" fill="hsl(25 40% 40%)" stroke={INK_COLORS.medium} strokeWidth={0.3} />
      <rect x="8" y="12" width="8" height="8" fill="hsl(25 40% 40%)" stroke={INK_COLORS.medium} strokeWidth={0.3} />
      {/* Handle */}
      <circle cx="14" cy="12" r="1" fill="hsl(45 60% 50%)" stroke={INK_COLORS.medium} strokeWidth={0.3} />
    </svg>
  );
}
