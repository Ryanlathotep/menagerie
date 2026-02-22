// Overworld Tile Graphics - Hand-drawn ink & watercolor SVG tiles
// Matches the dungeon TileGraphics aesthetic

import { OverworldTileType, BuildingType, BUILDING_UPGRADES } from './overworld';

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

// ─── Tree ───
export function OverworldTreeTile({ size, seed = 0 }: TileGraphicProps) {
  const r1 = seededRandom(seed);
  const r2 = seededRandom(seed + 1);

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="block">
      {/* Ground */}
      <rect width="24" height="24" fill="hsl(90 30% 50%)" opacity={0.15}/>
      {/* Trunk */}
      <rect x="10.5" y="14" width="3" height="7" rx={0.5} fill="hsl(25 45% 35%)" opacity={0.8}/>
      <line x1="12" y1="14" x2="12" y2="21" stroke={INK.medium} strokeWidth={0.4} opacity={0.5}/>
      {/* Canopy – layered watercolor blobs */}
      <ellipse cx={12} cy={10} rx={7+r1} ry={6+r2*0.5} fill="hsl(130 45% 35%)" opacity={0.55}/>
      <ellipse cx={10+r1*2} cy={8+r2} rx={5} ry={4} fill="hsl(120 50% 40%)" opacity={0.45}/>
      <ellipse cx={14+r2} cy={9+r1} rx={4.5} ry={3.5} fill="hsl(110 40% 45%)" opacity={0.4}/>
      {/* Ink outline */}
      <ellipse cx={12} cy={10} rx={7+r1} ry={6+r2*0.5} stroke={INK.medium} strokeWidth={0.5} fill="none" opacity={0.5}/>
      <line x1="0" y1="0" x2="24" y2="0" stroke={INK.faint} strokeWidth={0.3} opacity={0.3}/>
      <line x1="0" y1="0" x2="0" y2="24" stroke={INK.faint} strokeWidth={0.3} opacity={0.3}/>
    </svg>
  );
}

// ─── Rock ───
export function OverworldRockTile({ size, seed = 0 }: TileGraphicProps) {
  const r1 = seededRandom(seed);
  const r2 = seededRandom(seed + 1);

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="block">
      <rect width="24" height="24" fill="hsl(30 10% 60%)" opacity={0.15}/>
      {/* Main boulder */}
      <ellipse cx={12} cy={13} rx={8+r1} ry={6+r2} fill="hsl(220 10% 50%)" opacity={0.5}/>
      <ellipse cx={11+r1} cy={12+r2} rx={6} ry={4.5} fill="hsl(215 12% 58%)" opacity={0.4}/>
      {/* Cracks */}
      <path d={`M${8+r1*2} ${11+r2} L${12} ${13} L${15+r1} ${10+r2*2}`} stroke={INK.medium} strokeWidth={0.5} fill="none" opacity={0.5}/>
      {/* Highlight */}
      <ellipse cx={10} cy={10} rx={3} ry={2} fill="hsl(210 8% 70%)" opacity={0.3}/>
      {/* Outline */}
      <ellipse cx={12} cy={13} rx={8+r1} ry={6+r2} stroke={INK.medium} strokeWidth={0.5} fill="none" opacity={0.45}/>
      <line x1="0" y1="0" x2="24" y2="0" stroke={INK.faint} strokeWidth={0.3} opacity={0.3}/>
      <line x1="0" y1="0" x2="0" y2="24" stroke={INK.faint} strokeWidth={0.3} opacity={0.3}/>
    </svg>
  );
}

// ─── Water ───
export function OverworldWaterTile({ size, seed = 0 }: TileGraphicProps) {
  const r1 = seededRandom(seed);
  const r2 = seededRandom(seed + 1);

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="block">
      <rect width="24" height="24" fill="hsl(200 55% 45%)" opacity={0.35}/>
      {/* Water wash */}
      <ellipse cx="12" cy="12" rx="11" ry="11" fill="hsl(195 60% 50%)" opacity={0.3}/>
      {/* Wave lines */}
      <path d={`M2 ${10+r1*3} Q7 ${8+r2*2} 12 ${10+r1*2} T22 ${9+r2*3}`} stroke="hsl(190 50% 70%)" strokeWidth={1.2} fill="none" opacity={0.6}/>
      <path d={`M2 ${14+r2*2} Q8 ${12+r1*2} 13 ${14+r2} T23 ${13+r1*2}`} stroke="white" strokeWidth={0.7} fill="none" opacity={0.4}/>
      <line x1="0" y1="0" x2="24" y2="0" stroke={INK.faint} strokeWidth={0.3} opacity={0.3}/>
      <line x1="0" y1="0" x2="0" y2="24" stroke={INK.faint} strokeWidth={0.3} opacity={0.3}/>
    </svg>
  );
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

// ─── Fog of war (unexplored) ───
export function OverworldFogTile({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="block">
      <rect width="24" height="24" fill="hsl(30 15% 25%)" opacity={0.7}/>
    </svg>
  );
}
