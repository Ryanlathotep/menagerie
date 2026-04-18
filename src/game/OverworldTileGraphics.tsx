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

// ─── Tree (with tier support) ───
export function OverworldTreeTile({ size, seed = 0, tier = 'oak' }: TileGraphicProps & { tier?: TreeTier }) {
  const r1 = seededRandom(seed);
  const r2 = seededRandom(seed + 1);
  const colors = TREE_TIER_COLORS[tier];
  const isElder = tier === 'elder_oak';
  const isMaple = tier === 'maple';

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="block">
      <rect width="24" height="24" fill="hsl(90 30% 50%)" opacity={0.15}/>
      <rect x={isElder ? "9.5" : "10.5"} y={isElder ? "12" : "14"} width={isElder ? 5 : 3} height={isElder ? 9 : 7} rx={0.5} fill={colors.trunk} opacity={0.8}/>
      <line x1="12" y1={isElder ? 12 : 14} x2="12" y2="21" stroke={INK.medium} strokeWidth={isElder ? 0.6 : 0.4} opacity={0.5}/>
      <ellipse cx={12} cy={isElder ? 8 : 10} rx={isElder ? 9+r1 : 7+r1} ry={isElder ? 7+r2*0.5 : 6+r2*0.5} fill={colors.canopy} opacity={0.55}/>
      <ellipse cx={10+r1*2} cy={(isElder ? 6 : 8)+r2} rx={isElder ? 6 : 5} ry={isElder ? 5 : 4} fill={colors.canopy2} opacity={0.45}/>
      <ellipse cx={14+r2} cy={(isElder ? 7 : 9)+r1} rx={4.5} ry={3.5} fill={colors.canopy} opacity={0.4}/>
      {isMaple && <>
        <circle cx={8+r1*3} cy={7+r2*2} r={1.2} fill="hsl(25 80% 55%)" opacity={0.6}/>
        <circle cx={15+r2*2} cy={9+r1} r={1} fill="hsl(10 75% 50%)" opacity={0.5}/>
      </>}
      {isElder && <ellipse cx={12} cy={8} rx={10} ry={8} fill="hsl(160 40% 50%)" opacity={0.08}/>}
      <ellipse cx={12} cy={isElder ? 8 : 10} rx={isElder ? 9+r1 : 7+r1} ry={isElder ? 7+r2*0.5 : 6+r2*0.5} stroke={INK.medium} strokeWidth={isElder ? 0.7 : 0.5} fill="none" opacity={0.5}/>
      {tier !== 'oak' && (
        <text x="22" y="5" fontSize="4" fill={INK.dark} opacity={0.6} textAnchor="end" fontWeight="bold">
          {isMaple ? '★' : '★★'}
        </text>
      )}
      <line x1="0" y1="0" x2="24" y2="0" stroke={INK.faint} strokeWidth={0.3} opacity={0.3}/>
      <line x1="0" y1="0" x2="0" y2="24" stroke={INK.faint} strokeWidth={0.3} opacity={0.3}/>
    </svg>
  );
}

// ─── Rock (with tier support) ───
export function OverworldRockTile({ size, seed = 0, tier = 'stone' }: TileGraphicProps & { tier?: StoneTier }) {
  const r1 = seededRandom(seed);
  const r2 = seededRandom(seed + 1);
  const colors = STONE_TIER_COLORS[tier];
  const tierIdx = ['stone', 'copper', 'iron', 'gold', 'mithril'].indexOf(tier);

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="block">
      <rect width="24" height="24" fill="hsl(30 10% 60%)" opacity={0.15}/>
      <ellipse cx={12} cy={13} rx={8+r1} ry={6+r2} fill={colors.main} opacity={0.5}/>
      <ellipse cx={11+r1} cy={12+r2} rx={6} ry={4.5} fill={colors.highlight} opacity={0.35}/>
      {tierIdx >= 1 && <>
        <path d={`M${7+r1*2} ${11+r2} L${12} ${14} L${16+r1} ${11+r2*2}`} stroke={colors.vein} strokeWidth={0.8} fill="none" opacity={0.6}/>
        <path d={`M${9+r2} ${15} L${14+r1} ${12}`} stroke={colors.vein} strokeWidth={0.6} fill="none" opacity={0.5}/>
      </>}
      {tierIdx >= 3 && <>
        <circle cx={9+r1*3} cy={10+r2*2} r={0.8} fill="white" opacity={0.6}/>
        <circle cx={14+r2*2} cy={12+r1} r={0.6} fill="white" opacity={0.5}/>
      </>}
      {tier === 'mithril' && <ellipse cx={12} cy={13} rx={9} ry={7} fill="hsl(200 60% 70%)" opacity={0.1}/>}
      <path d={`M${8+r1*2} ${11+r2} L${12} ${13} L${15+r1} ${10+r2*2}`} stroke={INK.medium} strokeWidth={0.5} fill="none" opacity={0.5}/>
      <ellipse cx={12} cy={13} rx={8+r1} ry={6+r2} stroke={INK.medium} strokeWidth={0.5} fill="none" opacity={0.45}/>
      {tierIdx >= 1 && (
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
import type { AutoTileFit } from './autoTiling';

export function OverworldWaterTile({ size, seed = 0, fit }: TileGraphicProps & { fit?: AutoTileFit }) {
  const r1 = seededRandom(seed);
  const r2 = seededRandom(seed + 1);

  // Determine which sides have water neighbors. Defaults to "all open" so
  // legacy callers without auto-tiling still render the original look.
  let n = true, e = true, s = true, w = true;
  if (fit) {
    const opens = openSidesFromFit(fit);
    n = opens.n; e = opens.e; s = opens.s; w = opens.w;
  }
  const SHORE = 'hsl(40 55% 70%)';

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="block">
      <rect width="24" height="24" fill="hsl(200 55% 45%)" opacity={0.35}/>
      {/* Water wash */}
      <ellipse cx="12" cy="12" rx="11" ry="11" fill="hsl(195 60% 50%)" opacity={0.3}/>
      {/* Wave lines */}
      <path d={`M2 ${10+r1*3} Q7 ${8+r2*2} 12 ${10+r1*2} T22 ${9+r2*3}`} stroke="hsl(190 50% 70%)" strokeWidth={1.2} fill="none" opacity={0.6}/>
      <path d={`M2 ${14+r2*2} Q8 ${12+r1*2} 13 ${14+r2} T23 ${13+r1*2}`} stroke="white" strokeWidth={0.7} fill="none" opacity={0.4}/>
      {/* Shoreline edges (drawn only on closed sides) */}
      {!n && <rect x="0" y="0"  width="24" height="2.5" fill={SHORE} opacity={0.85}/>}
      {!s && <rect x="0" y="21.5" width="24" height="2.5" fill={SHORE} opacity={0.85}/>}
      {!w && <rect x="0" y="0"  width="2.5" height="24" fill={SHORE} opacity={0.85}/>}
      {!e && <rect x="21.5" y="0" width="2.5" height="24" fill={SHORE} opacity={0.85}/>}
      {/* Soft pebble specks on shores */}
      {!n && <circle cx={6+r1*8} cy={1.5} r={0.5} fill={INK.medium} opacity={0.5}/>}
      {!s && <circle cx={10+r2*8} cy={22.5} r={0.5} fill={INK.medium} opacity={0.5}/>}
      <line x1="0" y1="0" x2="24" y2="0" stroke={INK.faint} strokeWidth={0.3} opacity={0.3}/>
      <line x1="0" y1="0" x2="0" y2="24" stroke={INK.faint} strokeWidth={0.3} opacity={0.3}/>
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
