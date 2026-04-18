// Auto-tiled wall + gate SVGs for player-built overworld walls.
// Walls connect to other walls and to scout towers (so towers anchor castle
// corners). When a wall sits between two roads (N+S or E+W) it visually
// becomes a gate — see isWallActingAsGate() in buildings.ts.

import type { AutoTileFit } from './autoTiling';

const INK = {
  dark: 'hsl(30 15% 20%)',
  medium: 'hsl(30 20% 35%)',
  light: 'hsl(30 25% 50%)',
  faint: 'hsl(30 30% 70%)',
};

interface WallTileProps {
  size: number;
  seed?: number;
  fit?: AutoTileFit;
  damaged?: boolean;
}

// Player-built wall — uses warmer sandstone tones to distinguish from dungeon walls.
export function PlayerWallTile({ size, fit, damaged }: WallTileProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="block">
      <rect width="24" height="24" fill="hsl(35 30% 50%)" opacity={0.18}/>
      <g transform={fit ? `rotate(${fit.rotation} 12 12)` : undefined}>
        <PlayerWallShape shape={fit?.shape || 'cross'} />
      </g>
      {damaged && (
        <path d="M5 6 L10 13 L7 18" stroke={INK.dark} strokeWidth={0.7} fill="none" opacity={0.7}/>
      )}
      <line x1="0" y1="0" x2="24" y2="0" stroke={INK.faint} strokeWidth={0.3} opacity={0.3}/>
      <line x1="0" y1="0" x2="0" y2="24" stroke={INK.faint} strokeWidth={0.3} opacity={0.3}/>
    </svg>
  );
}

// Gate — visually a wall with a wooden door + arch oriented along the road axis.
// `axisHorizontal` indicates whether the road runs east-west (true) or north-south (false).
// `insideDir` marks which edge faces the player's home (banner side); the opposite
// edge gets a portcullis "spike" lip so two adjacent gates can be told apart.
export function GateTile({
  size,
  axisHorizontal,
  insideDir = 's',
}: {
  size: number;
  axisHorizontal: boolean;
  insideDir?: 'n' | 's' | 'e' | 'w';
}) {
  // Base art is drawn as if road runs N-S (pillars on left/right edges, opening top→bottom).
  // For an E-W road we rotate the whole pillar/door group 90° so the opening lines up.
  const rotateForHorizontalRoad = axisHorizontal ? 'rotate(90 12 12)' : undefined;

  // Asymmetric edge marks (drawn in screen-space, after rotation, so they
  // always point at the correct world direction).
  const edge = (dir: 'n' | 's' | 'e' | 'w', kind: 'banner' | 'spikes') => {
    const banner = kind === 'banner';
    const color = banner ? 'hsl(0 60% 40%)' : 'hsl(35 15% 25%)';
    if (dir === 'n') {
      return banner ? (
        <g key="in-n">
          <path d="M10 0 L14 0 L14 5 L12 4 L10 5 Z" fill={color} opacity={0.9}/>
          <line x1="12" y1="0" x2="12" y2="4" stroke={INK.dark} strokeWidth={0.3} opacity={0.7}/>
        </g>
      ) : (
        <g key="out-n" stroke={color} strokeWidth={0.6} opacity={0.85}>
          <line x1="7"  y1="0" x2="7"  y2="2"/>
          <line x1="10" y1="0" x2="10" y2="2.5"/>
          <line x1="14" y1="0" x2="14" y2="2.5"/>
          <line x1="17" y1="0" x2="17" y2="2"/>
        </g>
      );
    }
    if (dir === 's') {
      return banner ? (
        <g key="in-s">
          <path d="M10 24 L14 24 L14 19 L12 20 L10 19 Z" fill={color} opacity={0.9}/>
          <line x1="12" y1="24" x2="12" y2="20" stroke={INK.dark} strokeWidth={0.3} opacity={0.7}/>
        </g>
      ) : (
        <g key="out-s" stroke={color} strokeWidth={0.6} opacity={0.85}>
          <line x1="7"  y1="24" x2="7"  y2="22"/>
          <line x1="10" y1="24" x2="10" y2="21.5"/>
          <line x1="14" y1="24" x2="14" y2="21.5"/>
          <line x1="17" y1="24" x2="17" y2="22"/>
        </g>
      );
    }
    if (dir === 'w') {
      return banner ? (
        <g key="in-w">
          <path d="M0 10 L0 14 L5 14 L4 12 L5 10 Z" fill={color} opacity={0.9}/>
          <line x1="0" y1="12" x2="4" y2="12" stroke={INK.dark} strokeWidth={0.3} opacity={0.7}/>
        </g>
      ) : (
        <g key="out-w" stroke={color} strokeWidth={0.6} opacity={0.85}>
          <line x1="0" y1="7"  x2="2"   y2="7"/>
          <line x1="0" y1="10" x2="2.5" y2="10"/>
          <line x1="0" y1="14" x2="2.5" y2="14"/>
          <line x1="0" y1="17" x2="2"   y2="17"/>
        </g>
      );
    }
    // 'e'
    return banner ? (
      <g key="in-e">
        <path d="M24 10 L24 14 L19 14 L20 12 L19 10 Z" fill={color} opacity={0.9}/>
        <line x1="24" y1="12" x2="20" y2="12" stroke={INK.dark} strokeWidth={0.3} opacity={0.7}/>
      </g>
    ) : (
      <g key="out-e" stroke={color} strokeWidth={0.6} opacity={0.85}>
        <line x1="24" y1="7"  x2="22"   y2="7"/>
        <line x1="24" y1="10" x2="21.5" y2="10"/>
        <line x1="24" y1="14" x2="21.5" y2="14"/>
        <line x1="24" y1="17" x2="22"   y2="17"/>
      </g>
    );
  };

  const opposite: Record<'n' | 's' | 'e' | 'w', 'n' | 's' | 'e' | 'w'> = {
    n: 's', s: 'n', e: 'w', w: 'e',
  };
  const outsideDir = opposite[insideDir];

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="block">
      <rect width="24" height="24" fill="hsl(35 30% 50%)" opacity={0.18}/>
      <g transform={rotateForHorizontalRoad}>
        {/* Two stone pillars flanking the gate (oriented for N-S road by default) */}
        <rect x="0"  y="4" width="6" height="16" fill="hsl(35 25% 55%)" opacity={0.75}/>
        <rect x="18" y="4" width="6" height="16" fill="hsl(35 25% 55%)" opacity={0.75}/>
        <rect x="0"  y="4" width="6" height="16" stroke={INK.medium} strokeWidth={0.4} fill="none" opacity={0.55}/>
        <rect x="18" y="4" width="6" height="16" stroke={INK.medium} strokeWidth={0.4} fill="none" opacity={0.55}/>
        {/* Battlement crenellations on top */}
        <rect x="0"  y="3" width="2" height="2" fill="hsl(35 20% 45%)" opacity={0.7}/>
        <rect x="3"  y="3" width="2" height="2" fill="hsl(35 20% 45%)" opacity={0.7}/>
        <rect x="19" y="3" width="2" height="2" fill="hsl(35 20% 45%)" opacity={0.7}/>
        <rect x="22" y="3" width="2" height="2" fill="hsl(35 20% 45%)" opacity={0.7}/>
        {/* Stone arch */}
        <path d="M6 8 Q12 2 18 8 L18 12 L6 12 Z" fill="hsl(35 25% 60%)" opacity={0.7}/>
        <path d="M6 8 Q12 2 18 8" stroke={INK.medium} strokeWidth={0.5} fill="none" opacity={0.55}/>
        {/* Wooden double-door */}
        <rect x="7" y="10" width="10" height="11" fill="hsl(25 50% 35%)" opacity={0.85}/>
        <line x1="12" y1="10" x2="12" y2="21" stroke={INK.dark} strokeWidth={0.5} opacity={0.7}/>
        <line x1="9"  y1="13" x2="9"  y2="20" stroke={INK.dark} strokeWidth={0.3} opacity={0.5}/>
        <line x1="15" y1="13" x2="15" y2="20" stroke={INK.dark} strokeWidth={0.3} opacity={0.5}/>
        {/* Door handles */}
        <circle cx="10.5" cy="16" r="0.5" fill={INK.dark} opacity={0.8}/>
        <circle cx="13.5" cy="16" r="0.5" fill={INK.dark} opacity={0.8}/>
      </g>
      {/* Asymmetric inside (banner) + outside (spikes) — drawn in screen-space. */}
      {edge(insideDir, 'banner')}
      {edge(outsideDir, 'spikes')}
      <line x1="0" y1="0" x2="24" y2="0" stroke={INK.faint} strokeWidth={0.3} opacity={0.3}/>
      <line x1="0" y1="0" x2="0" y2="24" stroke={INK.faint} strokeWidth={0.3} opacity={0.3}/>
    </svg>
  );
}

// Internal shape body. Base orientations:
//   straight = horizontal (E-W)
//   corner   = N+E
//   t        = E+W+S (T opens south)
//   end      = single connection on east
function PlayerWallShape({ shape }: { shape: AutoTileFit['shape'] }) {
  const STONE = 'hsl(35 25% 55%)';
  const STONE_DARK = 'hsl(35 20% 45%)';
  const STONE_LIGHT = 'hsl(40 30% 65%)';

  // Blocks for a horizontal band (E-W). Used to compose all shapes via rotation.
  const horizontalBand = (
    <>
      <rect x="0" y="7"  width="24" height="10" fill={STONE} opacity={0.75}/>
      {/* Stone block divisions */}
      <rect x="0" y="7"  width="6" height="5" fill={STONE_LIGHT} opacity={0.4} stroke={INK.medium} strokeWidth={0.3}/>
      <rect x="6" y="7"  width="6" height="5" fill={STONE} opacity={0.5} stroke={INK.medium} strokeWidth={0.3}/>
      <rect x="12" y="7" width="6" height="5" fill={STONE_LIGHT} opacity={0.4} stroke={INK.medium} strokeWidth={0.3}/>
      <rect x="18" y="7" width="6" height="5" fill={STONE} opacity={0.5} stroke={INK.medium} strokeWidth={0.3}/>
      <rect x="0" y="12" width="3" height="5" fill={STONE_DARK} opacity={0.5} stroke={INK.medium} strokeWidth={0.3}/>
      <rect x="3" y="12" width="6" height="5" fill={STONE} opacity={0.5} stroke={INK.medium} strokeWidth={0.3}/>
      <rect x="9" y="12" width="6" height="5" fill={STONE_LIGHT} opacity={0.4} stroke={INK.medium} strokeWidth={0.3}/>
      <rect x="15" y="12" width="6" height="5" fill={STONE} opacity={0.5} stroke={INK.medium} strokeWidth={0.3}/>
      <rect x="21" y="12" width="3" height="5" fill={STONE_DARK} opacity={0.5} stroke={INK.medium} strokeWidth={0.3}/>
    </>
  );

  // Vertical band block for the stem of T/corner/cross shapes.
  const verticalStem = (yStart: number, yEnd: number) => (
    <>
      <rect x="7"  y={yStart} width="10" height={yEnd - yStart} fill={STONE} opacity={0.75}/>
      <rect x="7"  y={yStart} width="5"  height={(yEnd - yStart) / 2} fill={STONE_LIGHT} opacity={0.4} stroke={INK.medium} strokeWidth={0.3}/>
      <rect x="12" y={yStart} width="5"  height={(yEnd - yStart) / 2} fill={STONE_DARK} opacity={0.4} stroke={INK.medium} strokeWidth={0.3}/>
    </>
  );

  switch (shape) {
    case 'cross':
      return <>{horizontalBand}{verticalStem(0, 7)}{verticalStem(17, 24)}</>;
    case 't':
      return <>{horizontalBand}{verticalStem(17, 24)}</>;
    case 'straight':
      return horizontalBand;
    case 'corner':
      // N+E open: horizontal band on right + vertical stem on top
      return (
        <>
          <rect x="10" y="7" width="14" height="10" fill={STONE} opacity={0.75}/>
          <rect x="10" y="7" width="14" height="5" fill={STONE_LIGHT} opacity={0.4} stroke={INK.medium} strokeWidth={0.3}/>
          <rect x="10" y="12" width="14" height="5" fill={STONE} opacity={0.5} stroke={INK.medium} strokeWidth={0.3}/>
          {verticalStem(0, 12)}
        </>
      );
    case 'end':
      // East-only connection. Cap on west side.
      return (
        <>
          <rect x="6" y="7" width="18" height="10" fill={STONE} opacity={0.75}/>
          <rect x="6" y="7" width="18" height="5" fill={STONE_LIGHT} opacity={0.4} stroke={INK.medium} strokeWidth={0.3}/>
          <rect x="6" y="12" width="18" height="5" fill={STONE} opacity={0.5} stroke={INK.medium} strokeWidth={0.3}/>
          {/* End-cap battlement */}
          <rect x="6" y="5" width="2" height="3" fill={STONE_DARK} opacity={0.7}/>
          <rect x="6" y="16" width="2" height="3" fill={STONE_DARK} opacity={0.7}/>
        </>
      );
    case 'single':
      return (
        <>
          <rect x="6" y="6" width="12" height="12" rx={1} fill={STONE} opacity={0.75}/>
          <rect x="6" y="6" width="12" height="12" rx={1} stroke={INK.medium} strokeWidth={0.5} fill="none" opacity={0.6}/>
          <rect x="6" y="4" width="2" height="3" fill={STONE_DARK} opacity={0.7}/>
          <rect x="11" y="4" width="2" height="3" fill={STONE_DARK} opacity={0.7}/>
          <rect x="16" y="4" width="2" height="3" fill={STONE_DARK} opacity={0.7}/>
        </>
      );
  }
}
