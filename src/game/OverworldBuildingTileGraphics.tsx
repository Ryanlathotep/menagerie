// Overworld Building Tile Graphics - SVG tiles for player-placed structures
// Matches the hand-drawn ink & watercolor aesthetic

import { PlayerBuildingType, BUILDING_DEFINITIONS } from './buildings';
import { PlayerWallTile, GateTile } from './PlayerWallTileGraphics';
import type { AutoTileFit } from './autoTiling';
import { getAssetOverride } from './assetOverrides';


interface BuildingTileProps {
  size: number;
  seed?: number;
  harvestReady?: boolean;
}

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

// ─── Wall ───
export function WallTile({ size, seed = 0 }: BuildingTileProps) {
  const r1 = seededRandom(seed);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="block">
      <rect width="24" height="24" fill="hsl(30 10% 55%)" opacity={0.25}/>
      {/* Stone blocks */}
      <rect x="2" y="2" width="9" height="5" rx={0.5} fill="hsl(220 8% 50%)" opacity={0.65}/>
      <rect x="13" y="2" width="9" height="5" rx={0.5} fill="hsl(215 10% 55%)" opacity={0.6}/>
      <rect x="2" y="9" width="6" height="5" rx={0.5} fill="hsl(218 9% 48%)" opacity={0.6}/>
      <rect x="10" y="9" width="6" height="5" rx={0.5} fill="hsl(222 8% 52%)" opacity={0.65}/>
      <rect x="18" y="9" width="4" height="5" rx={0.5} fill="hsl(210 10% 50%)" opacity={0.55}/>
      <rect x="2" y="16" width="10" height="5" rx={0.5} fill="hsl(216 9% 53%)" opacity={0.6}/>
      <rect x="14" y="16" width="8" height="5" rx={0.5} fill="hsl(220 8% 48%)" opacity={0.65}/>
      {/* Mortar lines */}
      <line x1="0" y1="7" x2="24" y2="7" stroke={INK.medium} strokeWidth={0.4} opacity={0.4}/>
      <line x1="0" y1="14" x2="24" y2="14" stroke={INK.medium} strokeWidth={0.4} opacity={0.4}/>
      <line x1="11" y1="2" x2="11" y2="7" stroke={INK.medium} strokeWidth={0.3} opacity={0.3}/>
      <line x1="8" y1="9" x2="8" y2="14" stroke={INK.medium} strokeWidth={0.3} opacity={0.3}/>
      <line x1="12" y1="16" x2="12" y2="21" stroke={INK.medium} strokeWidth={0.3} opacity={0.3}/>
      {/* Grid */}
      <line x1="0" y1="0" x2="24" y2="0" stroke={INK.faint} strokeWidth={0.3} opacity={0.3}/>
      <line x1="0" y1="0" x2="0" y2="24" stroke={INK.faint} strokeWidth={0.3} opacity={0.3}/>
    </svg>
  );
}

// ─── Trap (generic spiky) ───
export function TrapTile({ size, seed = 0, trapVariant = 'spike' }: BuildingTileProps & { trapVariant?: string }) {
  const colors: Record<string, string> = {
    spike: 'hsl(0 0% 55%)',
    poison: 'hsl(120 50% 40%)',
    fire: 'hsl(15 85% 50%)',
    ice: 'hsl(200 70% 60%)',
  };
  const color = colors[trapVariant] || colors.spike;

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="block">
      <rect width="24" height="24" fill="hsl(90 35% 55%)" opacity={0.2}/>
      {/* Hidden trap plate */}
      <ellipse cx="12" cy="14" rx="7" ry="5" fill="hsl(30 20% 45%)" opacity={0.3}/>
      {/* Spike hints */}
      <path d="M8 16 L9 10 L10 16" fill={color} opacity={0.5}/>
      <path d="M11 15 L12 8 L13 15" fill={color} opacity={0.6}/>
      <path d="M14 16 L15 10 L16 16" fill={color} opacity={0.5}/>
      {/* Warning marks */}
      <circle cx="12" cy="12" r="1" fill={color} opacity={0.3}/>
      <line x1="0" y1="0" x2="24" y2="0" stroke={INK.faint} strokeWidth={0.3} opacity={0.3}/>
      <line x1="0" y1="0" x2="0" y2="24" stroke={INK.faint} strokeWidth={0.3} opacity={0.3}/>
    </svg>
  );
}

// ─── Scout Tower ───
// `wallAttachments` indicates which neighboring tiles contain a wall (or another tower).
// On those sides we draw a short sandstone stub so the wall visually merges into the tower.
export function ScoutTowerTile({
  size,
  wallAttachments,
}: BuildingTileProps & { wallAttachments?: { n: boolean; e: boolean; s: boolean; w: boolean } }) {
  const STUB = 'hsl(35 25% 55%)';
  const STUB_LIGHT = 'hsl(40 30% 65%)';
  const a = wallAttachments;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="block">
      <rect width="24" height="24" fill="hsl(40 30% 50%)" opacity={0.15}/>
      {/* Wall-merge stubs (drawn UNDER the tower body so the tower sits on top) */}
      {a?.n && <>
        <rect x="7" y="0"  width="10" height="8" fill={STUB} opacity={0.75}/>
        <rect x="7" y="0"  width="5"  height="8" fill={STUB_LIGHT} opacity={0.4} stroke={INK.medium} strokeWidth={0.3}/>
      </>}
      {a?.s && <>
        <rect x="7" y="16" width="10" height="8" fill={STUB} opacity={0.75}/>
        <rect x="12" y="16" width="5" height="8" fill={STUB_LIGHT} opacity={0.4} stroke={INK.medium} strokeWidth={0.3}/>
      </>}
      {a?.e && <>
        <rect x="16" y="7" width="8" height="10" fill={STUB} opacity={0.75}/>
        <rect x="16" y="7" width="8" height="5"  fill={STUB_LIGHT} opacity={0.4} stroke={INK.medium} strokeWidth={0.3}/>
      </>}
      {a?.w && <>
        <rect x="0" y="7"  width="8" height="10" fill={STUB} opacity={0.75}/>
        <rect x="0" y="12" width="8" height="5"  fill={STUB_LIGHT} opacity={0.4} stroke={INK.medium} strokeWidth={0.3}/>
      </>}
      {/* Tower base */}
      <rect x="6" y="14" width="12" height="9" fill="hsl(35 25% 45%)" opacity={0.85}/>
      {/* Tower body */}
      <rect x="8" y="6" width="8" height="10" fill="hsl(35 25% 55%)" opacity={0.9}/>
      {/* Battlement top — match wall sandstone tones */}
      <rect x="6"  y="3" width="2" height="3" fill="hsl(35 20% 45%)" opacity={0.85}/>
      <rect x="11" y="3" width="2" height="3" fill="hsl(35 20% 45%)" opacity={0.85}/>
      <rect x="16" y="3" width="2" height="3" fill="hsl(35 20% 45%)" opacity={0.85}/>
      <rect x="6"  y="5" width="12" height="2" fill="hsl(35 25% 50%)" opacity={0.8}/>
      {/* Window */}
      <rect x="10.5" y="9" width="3" height="3" fill="hsl(50 60% 65%)" opacity={0.7} stroke={INK.medium} strokeWidth={0.3}/>
      {/* Outline */}
      <rect x="6" y="6" width="12" height="17" stroke={INK.medium} strokeWidth={0.4} fill="none" opacity={0.5}/>
      <line x1="0" y1="0" x2="24" y2="0" stroke={INK.faint} strokeWidth={0.3} opacity={0.3}/>
      <line x1="0" y1="0" x2="0" y2="24" stroke={INK.faint} strokeWidth={0.3} opacity={0.3}/>
    </svg>
  );
}

// ─── Farm ───
export function FarmTile({ size, seed = 0, harvestReady = false }: BuildingTileProps) {
  const r1 = seededRandom(seed);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="block">
      <rect width="24" height="24" fill="hsl(35 40% 45%)" opacity={0.25}/>
      {/* Tilled soil rows */}
      <rect x="3" y="6" width="18" height="2" rx={0.5} fill="hsl(25 35% 35%)" opacity={0.5}/>
      <rect x="3" y="10" width="18" height="2" rx={0.5} fill="hsl(25 35% 35%)" opacity={0.5}/>
      <rect x="3" y="14" width="18" height="2" rx={0.5} fill="hsl(25 35% 35%)" opacity={0.5}/>
      <rect x="3" y="18" width="18" height="2" rx={0.5} fill="hsl(25 35% 35%)" opacity={0.5}/>
      {/* Plants */}
      {harvestReady ? (
        <>
          <circle cx={7} cy={5} r={2} fill="hsl(50 70% 55%)" opacity={0.7}/>
          <circle cx={12} cy={9} r={2} fill="hsl(50 70% 55%)" opacity={0.7}/>
          <circle cx={17} cy={5} r={2} fill="hsl(50 70% 55%)" opacity={0.7}/>
          <circle cx={7} cy={13} r={2} fill="hsl(50 70% 55%)" opacity={0.7}/>
          <circle cx={17} cy={13} r={2} fill="hsl(50 70% 55%)" opacity={0.7}/>
          <circle cx={12} cy={17} r={2} fill="hsl(50 70% 55%)" opacity={0.7}/>
        </>
      ) : (
        <>
          <path d={`M7 6 Q7 3 8 ${4+r1}`} stroke="hsl(120 40% 45%)" strokeWidth={0.8} fill="none" opacity={0.5}/>
          <path d={`M12 10 Q12 7 13 ${8+r1}`} stroke="hsl(120 40% 45%)" strokeWidth={0.8} fill="none" opacity={0.5}/>
          <path d={`M17 6 Q17 3 18 ${4+r1}`} stroke="hsl(120 40% 45%)" strokeWidth={0.8} fill="none" opacity={0.5}/>
        </>
      )}
      {/* Fence posts */}
      <rect x="1" y="3" width="1.5" height="18" fill="hsl(25 45% 35%)" opacity={0.4}/>
      <rect x="21.5" y="3" width="1.5" height="18" fill="hsl(25 45% 35%)" opacity={0.4}/>
      <line x1="0" y1="0" x2="24" y2="0" stroke={INK.faint} strokeWidth={0.3} opacity={0.3}/>
      <line x1="0" y1="0" x2="0" y2="24" stroke={INK.faint} strokeWidth={0.3} opacity={0.3}/>
    </svg>
  );
}

// ─── Stone Staircase ───
// A masonry climb attached to a wall/cliff. `attachDir` indicates the side
// the stairs LEAD UP to (i.e. the wall is north → stairs ascend north).
export function StoneStaircaseTile({
  size,
  attachDir = 'n',
}: BuildingTileProps & { attachDir?: 'n' | 's' | 'e' | 'w' }) {
  // Always draw base art as ascending NORTH, then rotate to match attachDir.
  const rot = attachDir === 'n' ? 0 : attachDir === 'e' ? 90 : attachDir === 's' ? 180 : 270;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="block">
      <rect width="24" height="24" fill="hsl(35 22% 45%)" opacity={0.2}/>
      <g transform={`rotate(${rot} 12 12)`}>
        {/* Slope shadow under the steps */}
        <path d="M3 22 L21 22 L18 4 L6 4 Z" fill="hsl(30 18% 35%)" opacity={0.55}/>
        {/* 5 stone steps, narrowing as they ascend (forced perspective) */}
        <rect x="3"   y="19" width="18" height="3" fill="hsl(35 25% 60%)" stroke={INK.medium} strokeWidth={0.4} opacity={0.95}/>
        <rect x="4"   y="15" width="16" height="3" fill="hsl(35 25% 58%)" stroke={INK.medium} strokeWidth={0.4} opacity={0.92}/>
        <rect x="5"   y="11" width="14" height="3" fill="hsl(35 25% 56%)" stroke={INK.medium} strokeWidth={0.4} opacity={0.9}/>
        <rect x="6"   y="7"  width="12" height="3" fill="hsl(35 25% 54%)" stroke={INK.medium} strokeWidth={0.4} opacity={0.88}/>
        <rect x="7"   y="3"  width="10" height="3" fill="hsl(35 25% 50%)" stroke={INK.medium} strokeWidth={0.4} opacity={0.85}/>
      </g>
      <line x1="0" y1="0" x2="24" y2="0" stroke={INK.faint} strokeWidth={0.3} opacity={0.3}/>
      <line x1="0" y1="0" x2="0" y2="24" stroke={INK.faint} strokeWidth={0.3} opacity={0.3}/>
    </svg>
  );
}

// ─── Wooden Ladder ───
export function LadderTile({
  size,
  attachDir = 'n',
}: BuildingTileProps & { attachDir?: 'n' | 's' | 'e' | 'w' }) {
  const rot = attachDir === 'n' ? 0 : attachDir === 'e' ? 90 : attachDir === 's' ? 180 : 270;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="block">
      <rect width="24" height="24" fill="hsl(90 30% 50%)" opacity={0.15}/>
      <g transform={`rotate(${rot} 12 12)`}>
        {/* Two long rails — wooden brown */}
        <rect x="7"  y="2" width="2" height="20" rx={0.5} fill="hsl(25 50% 35%)" opacity={0.95} stroke={INK.dark} strokeWidth={0.3}/>
        <rect x="15" y="2" width="2" height="20" rx={0.5} fill="hsl(25 50% 35%)" opacity={0.95} stroke={INK.dark} strokeWidth={0.3}/>
        {/* Rungs */}
        {[4, 8, 12, 16, 20].map((y, i) => (
          <rect key={i} x="7" y={y} width="10" height="1.4" fill="hsl(25 55% 40%)" stroke={INK.dark} strokeWidth={0.25} opacity={0.9}/>
        ))}
      </g>
      <line x1="0" y1="0" x2="24" y2="0" stroke={INK.faint} strokeWidth={0.3} opacity={0.3}/>
      <line x1="0" y1="0" x2="0" y2="24" stroke={INK.faint} strokeWidth={0.3} opacity={0.3}/>
    </svg>
  );
}

// ─── Generic emoji-on-parchment placeholder ───
// Used for crafting stations (forge / workbench / brewing stand / enchanting
// altar) and any future building that hasn't received bespoke art yet. Also
// serves as the fallback tile whenever an admin-uploaded image is not present.
function PlaceholderStationTile({
  size, seed = 0, type,
}: { size: number; seed?: number; type: PlayerBuildingType }) {
  const def = BUILDING_DEFINITIONS[type];
  const r1 = seededRandom(seed + 11);
  const r2 = seededRandom(seed + 23);
  // Per-station accent color so stations read at a glance on the map.
  const accent: Record<string, string> = {
    forge: 'hsl(20 70% 55%)',
    workbench: 'hsl(30 45% 45%)',
    brewing_stand: 'hsl(280 45% 55%)',
    enchanting_altar: 'hsl(210 60% 60%)',
  };
  const fill = accent[type] ?? 'hsl(30 25% 55%)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="block">
      {/* dirt / floor pad */}
      <rect width="24" height="24" fill="hsl(35 30% 78%)" opacity={0.35} />
      <rect x={2 + r1 * 0.6} y={2 + r2 * 0.6} width="20" height="20" rx="2"
            fill={fill} opacity={0.35}
            stroke={INK.dark} strokeWidth={0.5} />
      {/* corner posts to hint at a structure */}
      <rect x="2.5"  y="2.5"  width="2" height="2" fill={INK.dark} opacity={0.55} />
      <rect x="19.5" y="2.5"  width="2" height="2" fill={INK.dark} opacity={0.55} />
      <rect x="2.5"  y="19.5" width="2" height="2" fill={INK.dark} opacity={0.55} />
      <rect x="19.5" y="19.5" width="2" height="2" fill={INK.dark} opacity={0.55} />
      {/* emoji label so each station is instantly distinguishable */}
      <text x="12" y="16" textAnchor="middle" fontSize="12"
            style={{ userSelect: 'none' }}>{def.emoji}</text>
      <line x1="0" y1="0" x2="24" y2="0" stroke={INK.faint} strokeWidth={0.3} opacity={0.3}/>
      <line x1="0" y1="0" x2="0" y2="24" stroke={INK.faint} strokeWidth={0.3} opacity={0.3}/>
    </svg>
  );
}

// If an admin has uploaded a replacement image for this building type, render
// it verbatim in place of the built-in SVG art.
function OverrideImageTile({ url, size }: { url: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="block">
      <image href={url} x="0" y="0" width="24" height="24" preserveAspectRatio="xMidYMid meet" />
    </svg>
  );
}

// Dispatcher component
export function OverworldBuildingTileGraphic({
  type, size, seed = 0, harvestReady, wallFit, isGate, gateAxis, gateInsideDir, damaged, wallAttachments, connectorDir,
}: {
  type: PlayerBuildingType;
  size: number;
  seed?: number;
  harvestReady?: boolean;
  // Auto-tiling props (only walls use these)
  wallFit?: AutoTileFit;
  isGate?: boolean;
  gateAxis?: 'horizontal' | 'vertical';
  gateInsideDir?: 'n' | 's' | 'e' | 'w';
  damaged?: boolean;
  // Wall-merge props (only scout towers use this)
  wallAttachments?: { n: boolean; e: boolean; s: boolean; w: boolean };
  // Direction the stair/ladder ascends (the side with the wall/cliff).
  connectorDir?: 'n' | 's' | 'e' | 'w';
}) {
  // Admin-uploaded override wins for every building type EXCEPT walls/gates
  // (their auto-tiling is stateful and would break with a static image).
  if (type !== 'wall') {
    const overrideUrl = getAssetOverride('building', type);
    if (overrideUrl) return <OverrideImageTile url={overrideUrl} size={size} />;
  }
  switch (type) {
    case 'wall':
      // axisHorizontal=true means the road runs E-W. GateTile rotates its base
      // art 90° in that case so the opening lines up with the road.
      if (isGate) return <GateTile size={size} axisHorizontal={gateAxis === 'horizontal'} insideDir={gateInsideDir} />;
      return <PlayerWallTile size={size} fit={wallFit} damaged={damaged} />;
    case 'spike_trap': return <TrapTile size={size} seed={seed} trapVariant="spike" />;
    case 'poison_trap': return <TrapTile size={size} seed={seed} trapVariant="poison" />;
    case 'fire_trap': return <TrapTile size={size} seed={seed} trapVariant="fire" />;
    case 'ice_trap': return <TrapTile size={size} seed={seed} trapVariant="ice" />;
    case 'scout_tower': return <ScoutTowerTile size={size} seed={seed} wallAttachments={wallAttachments} />;
    case 'farm': return <FarmTile size={size} seed={seed} harvestReady={harvestReady} />;
    case 'stone_staircase': return <StoneStaircaseTile size={size} attachDir={connectorDir} />;
    case 'ladder': return <LadderTile size={size} attachDir={connectorDir} />;
    // Crafting stations — placeholder art until custom SVGs land or the admin
    // uploads replacements via the Asset Library ("Buildings" tab).
    case 'forge':
    case 'workbench':
    case 'brewing_stand':
    case 'enchanting_altar':
      return <PlaceholderStationTile size={size} seed={seed} type={type} />;
  }
}

