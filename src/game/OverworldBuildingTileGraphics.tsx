// Overworld Building Tile Graphics - SVG tiles for player-placed structures
// Matches the hand-drawn ink & watercolor aesthetic

import { PlayerBuildingType } from './buildings';
import { PlayerWallTile, GateTile } from './PlayerWallTileGraphics';
import type { AutoTileFit } from './autoTiling';

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

// Dispatcher component
export function OverworldBuildingTileGraphic({
  type, size, seed = 0, harvestReady, wallFit, isGate, gateAxis, damaged, wallAttachments,
}: {
  type: PlayerBuildingType;
  size: number;
  seed?: number;
  harvestReady?: boolean;
  // Auto-tiling props (only walls use these)
  wallFit?: AutoTileFit;
  isGate?: boolean;
  gateAxis?: 'horizontal' | 'vertical';
  damaged?: boolean;
  // Wall-merge props (only scout towers use this)
  wallAttachments?: { n: boolean; e: boolean; s: boolean; w: boolean };
}) {
  switch (type) {
    case 'wall':
      if (isGate) return <GateTile size={size} axisHorizontal={gateAxis !== 'vertical'} />;
      return <PlayerWallTile size={size} fit={wallFit} damaged={damaged} />;
    case 'spike_trap': return <TrapTile size={size} seed={seed} trapVariant="spike" />;
    case 'poison_trap': return <TrapTile size={size} seed={seed} trapVariant="poison" />;
    case 'fire_trap': return <TrapTile size={size} seed={seed} trapVariant="fire" />;
    case 'ice_trap': return <TrapTile size={size} seed={seed} trapVariant="ice" />;
    case 'scout_tower': return <ScoutTowerTile size={size} seed={seed} wallAttachments={wallAttachments} />;
    case 'farm': return <FarmTile size={size} seed={seed} harvestReady={harvestReady} />;
  }
}
