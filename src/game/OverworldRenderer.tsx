// Overworld Renderer - Renders the chunk-based overworld with tile graphics

import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { OverworldState, OverworldTile, getOverworldTile } from './overworld';
import { Position, Monster, UnlockedMonster } from './types';
import { MonsterSprite } from './sprites';
import {
  OverworldGrassTile, OverworldHarvestedTile, OverworldTreeTile,
  OverworldRockTile, OverworldWaterTile, OverworldBuildingTile,
  OverworldDungeonTile, OverworldFogTile, OverworldNestTile,
  OverworldDirtRoadTile, OverworldStoneRoadTile,
  OverworldCliffTile, OverworldRampTile, OverworldWaterfallTile,
} from './OverworldTileGraphics';
import { OverworldBuildingTileGraphic } from './OverworldBuildingTileGraphics';
import { PlayerBuilding, isWallActingAsGate, getGateAxis, getGateInsideDirection, wallConnectsTo, roadConnectsTo } from './buildings';
import { connectorDirFor } from './wallTop';
import { fitFromNeighbors } from './autoTiling';
import { NestState } from './nests';
import { MatchupIndicator } from './MatchupIndicator';
import { ElementType, ClassType } from './types';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { BuildingTooltipContent } from './BuildingTooltip';
import { OverworldTooltipContent } from './OverworldTooltip';
import { isDowsingEffective, onDowsingChange, DOWSING_HIGHLIGHT_COUNT } from './dowsingRod';
import { ParticleLayer } from './particles/ParticleLayer';

interface OverworldRendererProps {
  overworld: OverworldState;
  playerElement: string;
  playerClass?: string;
  playerSpecies?: string;
  zoom?: number;
  unlockedMonsters?: UnlockedMonster[];
  party?: Monster[];
  onTileClick?: (worldX: number, worldY: number) => void;
  onTileRightClick?: (worldX: number, worldY: number) => void;
  // Targeting
  targetingMode?: boolean;
  targetingTiles?: Position[];
  affectedTiles?: Position[];
  hoveredTile?: Position | null;
  onTileHover?: (worldX: number, worldY: number) => void;
  onTileHoverEnd?: () => void;
}

export interface OverworldRendererHandle {
  scrollToPlayer: () => void;
}

const TILE_SIZE = 40;
const VIEW_RANGE = 8;

// Tile rendering
function renderTileGraphic(
  tile: OverworldTile,
  tileSize: number,
  seed: number,
  worldX: number,
  worldY: number,
  state: OverworldState,
  dungeonDepth?: number,
  playerBuilding?: PlayerBuilding,
  nest?: NestState,
): React.ReactNode {
  if (!tile.visible && !tile.explored) {
    return <OverworldFogTile size={tileSize} />;
  }
  switch (tile.type) {
    case 'grass': {
      // Ramps are walkable grass with a slope graphic.
      if (tile.isRamp) {
        return <OverworldRampTile size={tileSize} seed={seed}
                  direction={tile.rampDirection} hasStairs={tile.hasStairs} />;
      }
      return tile.harvested
        ? <OverworldHarvestedTile size={tileSize} seed={seed} />
        : <OverworldGrassTile size={tileSize} seed={seed} />;
    }
    case 'cliff':
      return <OverworldCliffTile size={tileSize} seed={seed}
                drops={tile.cliffDrops} elevation={tile.elevation} />;
    case 'waterfall':
      return <OverworldWaterfallTile size={tileSize} seed={seed} direction={tile.waterfallDir} />;
    case 'tree': {
      const isTree = (x: number, y: number) => getOverworldTile(state, x, y)?.type === 'tree';
      const fit = fitFromNeighbors(
        isTree(worldX, worldY - 1),
        isTree(worldX + 1, worldY),
        isTree(worldX, worldY + 1),
        isTree(worldX - 1, worldY),
      );
      return <OverworldTreeTile size={tileSize} seed={seed} tier={tile.treeTier} fit={fit} />;
    }
    case 'rock': {
      const isRock = (x: number, y: number) => getOverworldTile(state, x, y)?.type === 'rock';
      const fit = fitFromNeighbors(
        isRock(worldX, worldY - 1),
        isRock(worldX + 1, worldY),
        isRock(worldX, worldY + 1),
        isRock(worldX - 1, worldY),
      );
      return <OverworldRockTile size={tileSize} seed={seed} tier={tile.stoneTier} fit={fit} />;
    }
    case 'water': {
      const isWater = (x: number, y: number) => getOverworldTile(state, x, y)?.type === 'water';
      const fit = fitFromNeighbors(
        isWater(worldX, worldY - 1),
        isWater(worldX + 1, worldY),
        isWater(worldX, worldY + 1),
        isWater(worldX - 1, worldY),
      );
      return <OverworldWaterTile size={tileSize} seed={seed} fit={fit} />;
    }
    case 'building': return <OverworldBuildingTile size={tileSize} buildingType={tile.buildingType} seed={seed} />;
    case 'dungeon_entrance': return <OverworldDungeonTile size={tileSize} seed={seed} depth={dungeonDepth} />;
    case 'player_building': {
      if (!playerBuilding) return <OverworldGrassTile size={tileSize} seed={seed} />;
      if (playerBuilding.type === 'wall') {
        const fit = fitFromNeighbors(
          wallConnectsTo(state, worldX, worldY - 1),
          wallConnectsTo(state, worldX + 1, worldY),
          wallConnectsTo(state, worldX, worldY + 1),
          wallConnectsTo(state, worldX - 1, worldY),
        );
        const isGate = isWallActingAsGate(playerBuilding, state);
        const gateAxis = isGate ? getGateAxis(playerBuilding, state) : undefined;
        const gateInsideDir = isGate ? getGateInsideDirection(playerBuilding, state) : undefined;
        const damaged = playerBuilding.hp < playerBuilding.maxHp;
        return (
          <OverworldBuildingTileGraphic
            type={playerBuilding.type}
            size={tileSize}
            seed={seed}
            wallFit={fit}
            isGate={isGate}
            gateAxis={gateAxis}
            gateInsideDir={gateInsideDir}
            damaged={damaged}
          />
        );
      }
      // For scout towers, compute which sides have a wall (or another tower) so we can
      // render short stone stubs that visually merge tower + wall into one structure.
      let wallAttachments: { n: boolean; e: boolean; s: boolean; w: boolean } | undefined;
      if (playerBuilding.type === 'scout_tower') {
        wallAttachments = {
          n: wallConnectsTo(state, worldX, worldY - 1),
          e: wallConnectsTo(state, worldX + 1, worldY),
          s: wallConnectsTo(state, worldX, worldY + 1),
          w: wallConnectsTo(state, worldX - 1, worldY),
        };
      }
      // For stair/ladder, figure out which side has the wall/cliff so the
      // tile rotates to face it.
      const connectorDir = (playerBuilding.type === 'stone_staircase' || playerBuilding.type === 'ladder')
        ? connectorDirFor(state, worldX, worldY)
        : undefined;
      return (
        <OverworldBuildingTileGraphic
          type={playerBuilding.type}
          size={tileSize}
          seed={seed}
          harvestReady={playerBuilding.harvestReady}
          wallAttachments={wallAttachments}
          connectorDir={connectorDir}
        />
      );
    }
    case 'nest': return nest
      ? <OverworldNestTile size={tileSize} seed={seed} element={nest.element} hpPercent={Math.floor((nest.hp / nest.maxHp) * 100)} />
      : <OverworldGrassTile size={tileSize} seed={seed} />;
    case 'enemy': return <OverworldGrassTile size={tileSize} seed={seed} />;
    case 'player': return <OverworldGrassTile size={tileSize} seed={seed} />;
    case 'dirt_road':
    case 'stone_road': {
      const fit = fitFromNeighbors(
        roadConnectsTo(state, worldX, worldY - 1),
        roadConnectsTo(state, worldX + 1, worldY),
        roadConnectsTo(state, worldX, worldY + 1),
        roadConnectsTo(state, worldX - 1, worldY),
      );
      return tile.type === 'dirt_road'
        ? <OverworldDirtRoadTile size={tileSize} seed={seed} fit={fit} />
        : <OverworldStoneRoadTile size={tileSize} seed={seed} fit={fit} />;
    }
    default: return <OverworldFogTile size={tileSize} />;
  }
}

export const OverworldRenderer = forwardRef<OverworldRendererHandle, OverworldRendererProps>(({
  overworld,
  playerElement,
  playerClass,
  playerSpecies,
  zoom = 100,
  unlockedMonsters = [],
  party = [],
  onTileClick,
  onTileRightClick,
  targetingMode,
  targetingTiles,
  affectedTiles,
  hoveredTile,
  onTileHover,
  onTileHoverEnd,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const { x: px, y: py } = overworld.playerPosition;

  // Touch devices: skip HoverCard wrappers entirely. Hover-cards open on
  // touch and have no clean dismiss gesture there, so they end up covering
  // the map. Mobile users still get the same info via double-tap → context
  // menu (which routes to the dedicated tooltip/menu UI).
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia('(hover: none), (pointer: coarse)');
    const update = () => setIsTouch(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  // Dowsing Rod: re-render on toggle + tick every 5s so the buff auto-clears.
  const [dowsingOn, setDowsingOn] = useState(() => isDowsingEffective());
  useEffect(() => {
    const off = onDowsingChange(() => setDowsingOn(isDowsingEffective()));
    const interval = setInterval(() => setDowsingOn(isDowsingEffective()), 5000);
    return () => { off(); clearInterval(interval); };
  }, []);

  const scale = zoom / 100;
  const tileSize = Math.floor(TILE_SIZE * scale);

  useImperativeHandle(ref, () => ({
    scrollToPlayer: () => {
      // No-op: player is always centered via CSS transform
    },
  }));

  // Mobile double-tap → fire the right-click handler (context menu).
  // A second tap on the SAME tile within 300ms is treated as right-click.
  const handleTileTap = (worldX: number, worldY: number) => {
    const now = Date.now();
    const last = lastTapRef.current;
    if (last && last.x === worldX && last.y === worldY && now - last.time < 300) {
      lastTapRef.current = null;
      onTileRightClick?.(worldX, worldY);
      return;
    }
    lastTapRef.current = { x: worldX, y: worldY, time: now };
    onTileClick?.(worldX, worldY);
  };
  
  // Build visible tile array
  const tiles: { worldX: number; worldY: number; tile: OverworldTile; relX: number; relY: number }[] = [];
  for (let dy = -VIEW_RANGE; dy <= VIEW_RANGE; dy++) {
    for (let dx = -VIEW_RANGE; dx <= VIEW_RANGE; dx++) {
      const worldX = px + dx;
      const worldY = py + dy;
      const tile = getOverworldTile(overworld, worldX, worldY);
      if (tile) {
        tiles.push({ worldX, worldY, tile, relX: dx + VIEW_RANGE, relY: dy + VIEW_RANGE });
      }
    }
  }

  const gridSize = VIEW_RANGE * 2 + 1;

  // Dowsed enemy positions: nearest 5 enemy tiles by Manhattan distance.
  // Scans a wider square around the player than the visible viewport so
  // off-screen targets still count toward the 5.
  const dowsedKeys = (() => {
    if (!dowsingOn) return new Set<string>();
    const SCAN = VIEW_RANGE * 3;
    const candidates: { x: number; y: number; d: number }[] = [];
    for (let dy = -SCAN; dy <= SCAN; dy++) {
      for (let dx = -SCAN; dx <= SCAN; dx++) {
        const wx = px + dx;
        const wy = py + dy;
        const t = getOverworldTile(overworld, wx, wy);
        if (t && t.type === 'enemy' && t.enemyId) {
          candidates.push({ x: wx, y: wy, d: Math.abs(dx) + Math.abs(dy) });
        }
      }
    }
    candidates.sort((a, b) => a.d - b.d);
    return new Set(candidates.slice(0, DOWSING_HIGHLIGHT_COUNT).map(c => `${c.x},${c.y}`));
  })();

  // Find enemies for rendering
  const getEnemy = (enemyId: string): Monster | null => {
    for (const chunk of Object.values(overworld.chunks)) {
      const enemy = chunk.enemies.find(e => e.id === enemyId);
      if (enemy) return enemy;
    }
    return null;
  };
  
  // Player is always at (VIEW_RANGE, VIEW_RANGE) in the grid.
  // We translate the grid so the player tile is centered in the container.
  
  return (
    <div 
      ref={containerRef}
      className="overflow-hidden border border-border rounded-lg bg-background w-full h-full relative"
    >
      <div
        className="absolute"
        style={{
          width: gridSize * tileSize,
          height: gridSize * tileSize,
          left: '50%',
          top: '50%',
          transform: `translate(-${VIEW_RANGE * tileSize + tileSize / 2}px, -${VIEW_RANGE * tileSize + tileSize / 2}px)`,
        }}
      >
        {tiles.map(({ worldX, worldY, tile, relX, relY }) => {
          const isPlayer = worldX === px && worldY === py;
          const isTargetable = targetingMode && targetingTiles?.some(t => t.x === worldX && t.y === worldY);
          const isAffected = affectedTiles?.some(t => t.x === worldX && t.y === worldY);
          const isHovered = hoveredTile?.x === worldX && hoveredTile?.y === worldY;
          
          const enemy = tile.type === 'enemy' && tile.enemyId ? getEnemy(tile.enemyId) : null;
          
          const tileSeed = worldX * 1000 + worldY;
          
          // Look up dungeon depth if this is a dungeon entrance
          const dungeonDepth = tile.type === 'dungeon_entrance' && tile.dungeonId
            ? overworld.dungeonEntrances?.[tile.dungeonId]?.deepestFloor
            : undefined;
          
          // Look up player building data
          const playerBuilding = tile.type === 'player_building' && tile.playerBuildingId
            ? overworld.playerBuildings?.find(b => b.id === tile.playerBuildingId)
            : undefined;
          
          // Look up nest data
          const nestData = tile.type === 'nest' && tile.nestId
            ? overworld.nests?.[tile.nestId]
            : undefined;
          
          const tileContent = (
            <div
              key={`${worldX},${worldY}`}
              className={`absolute cursor-pointer overflow-hidden lp-tile ${
                isTargetable && !isAffected ? 'ring-1 ring-red-500/40' : ''
              } ${isAffected ? 'ring-2 ring-red-500' : ''} ${isHovered ? 'ring-2 ring-yellow-400' : ''} ${
                !tile.visible && tile.explored ? 'opacity-40' : ''
              }`}
              style={{
                left: relX * tileSize,
                top: relY * tileSize,
                width: tileSize,
                height: tileSize,
              }}
              onClick={(e) => {
                // If a long-press just fired, swallow the synthetic click.
                const el = e.currentTarget as HTMLDivElement;
                if (el.dataset.longPressFired) {
                  delete el.dataset.longPressFired;
                  e.preventDefault();
                  e.stopPropagation();
                  return;
                }
                handleTileTap(worldX, worldY);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                lastTapRef.current = null;
                onTileRightClick?.(worldX, worldY);
              }}
              onTouchStart={(e) => {
                const el = e.currentTarget;
                const timer = setTimeout(() => {
                  el.dataset.longPressFired = '1';
                  lastTapRef.current = null;
                  onTileRightClick?.(worldX, worldY);
                }, 450);
                el.dataset.longPressTimer = String(timer);
              }}
              onTouchMove={(e) => {
                const el = e.currentTarget;
                if (el.dataset.longPressTimer) {
                  clearTimeout(Number(el.dataset.longPressTimer));
                  delete el.dataset.longPressTimer;
                }
              }}
              onTouchEnd={(e) => {
                const el = e.currentTarget;
                if (el.dataset.longPressTimer) {
                  clearTimeout(Number(el.dataset.longPressTimer));
                  delete el.dataset.longPressTimer;
                }
                if (el.dataset.longPressFired) {
                  // Keep the flag for the click handler to swallow, but
                  // also stop the touchend chain so the menu stays open.
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
              onTouchCancel={(e) => {
                const el = e.currentTarget;
                if (el.dataset.longPressTimer) {
                  clearTimeout(Number(el.dataset.longPressTimer));
                  delete el.dataset.longPressTimer;
                }
              }}
              onMouseEnter={() => onTileHover?.(worldX, worldY)}
              onMouseLeave={() => onTileHoverEnd?.()}
            >
              {/* Background tile graphic */}
              {renderTileGraphic(tile, tileSize, tileSeed, worldX, worldY, overworld, dungeonDepth, playerBuilding, nestData)}
              {/* Overlay: player or enemy sprite */}
              {isPlayer ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <MonsterSprite
                    species={(playerSpecies || 'slime') as any}
                    element={(playerElement || 'normal') as any}
                    classType={(playerClass || 'normal') as any}
                    size={tileSize * 0.8}
                  />
                </div>
              ) : enemy ? (
                <>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <MonsterSprite
                      species={enemy.species}
                      element={enemy.element}
                      classType={enemy.class}
                      size={tileSize * 0.7}
                    />
                  </div>
                  <MatchupIndicator
                    playerElement={playerElement as ElementType}
                    playerClass={playerClass as ClassType | undefined}
                    enemyElement={enemy.element}
                    enemyClass={enemy.class}
                    size={tileSize}
                  />
                </>
              ) : null}
              {/* Assigned monster on scout towers */}
              {tile.type === 'player_building' && playerBuilding?.type === 'scout_tower' && playerBuilding.assignedMonsterId && (() => {
                const assigned = party.find(m => m.id === playerBuilding.assignedMonsterId);
                return assigned ? (
                  <div className="absolute inset-0 flex items-end justify-center" style={{ paddingBottom: tileSize * 0.05 }}>
                    <MonsterSprite
                      species={assigned.species}
                      element={assigned.element}
                      classType={assigned.class}
                      size={tileSize * 0.5}
                    />
                  </div>
                ) : null;
              })()}
              {/* Harvest-ready glow on farms */}
              {tile.type === 'player_building' && playerBuilding?.type === 'farm' && playerBuilding.harvestReady && (
                <div className="absolute inset-0 ring-2 ring-yellow-400 animate-pulse pointer-events-none" />
              )}
              {/* Player-dropped waypoint pin (emerald pulsing ring). */}
              {(overworld.waypoints || []).some(w => w.x === worldX && w.y === worldY) && (
                <div
                  className="absolute inset-0 pointer-events-none z-20 flex items-center justify-center"
                  aria-label="Pinned waypoint"
                >
                  <div className="absolute inset-0 pointer-events-none rounded-full border-2 border-emerald-400 animate-ping opacity-60" />
                  <div className="absolute inset-1 pointer-events-none rounded-full border-2 border-emerald-300 opacity-90" />
                  <span className="relative pointer-events-none text-sm drop-shadow-[0_0_4px_rgba(52,211,153,0.9)]">📍</span>
                </div>
              )}
              {/* AoE / area-of-effect shading — drawn on top so it's clearly visible.
                  Center (hovered) tile gets a slightly darker red so it stands out. */}
              {isAffected && (
                <div
                  className={`absolute inset-0 pointer-events-none ${
                    isHovered ? 'bg-red-600/55' : 'bg-red-500/40'
                  }`}
                />
              )}
            </div>
          );


          // Pick the right tooltip body for this tile
          const dungeonEntrance = tile.type === 'dungeon_entrance' && tile.dungeonId
            ? overworld.dungeonEntrances?.[tile.dungeonId]
            : undefined;

          // Suppress hover tooltips on plain grass — they get in the way of exploration.
          // Right-click on grass still opens a tile context menu (handled by OverworldView).
          const suppressTooltip = tile.type === 'grass';

          if (suppressTooltip) {
            return <div key={`${worldX},${worldY}`}>{tileContent}</div>;
          }

          // Touch devices: skip the hover-card. They open on tap and obscure
          // the map; mobile users open the same info via double-tap → context menu.
          if (isTouch) {
            return <div key={`${worldX},${worldY}`}>{tileContent}</div>;
          }

          const tooltipBody = tile.type === 'player_building' && playerBuilding
            ? <BuildingTooltipContent building={playerBuilding} party={party} />
            : <OverworldTooltipContent
                tile={tile}
                worldX={worldX}
                worldY={worldY}
                dungeonEntrance={dungeonEntrance}
                enemy={enemy}
                nest={nestData}
                playerBuilding={playerBuilding}
              />;

          return (
            <HoverCard key={`${worldX},${worldY}`} openDelay={250} closeDelay={80}>
              <HoverCardTrigger asChild>{tileContent}</HoverCardTrigger>
              <HoverCardContent
                side="top"
                className={tile.type === 'player_building' ? 'w-72 p-3' : 'w-64 p-3'}
              >
                {tooltipBody}
              </HoverCardContent>
            </HoverCard>
          );
        })}
      </div>
      {/* Edge-of-screen arrows for off-screen player waypoints. */}
      {(overworld.waypoints || []).length > 0 && (
        <div className="absolute inset-0 pointer-events-none z-30">
          {(overworld.waypoints || []).map((wp, i) => {
            const dx = wp.x - px;
            const dy = wp.y - py;
            if (dx === 0 && dy === 0) return null;
            if (Math.abs(dx) <= VIEW_RANGE && Math.abs(dy) <= VIEW_RANGE) return null;
            const angle = Math.atan2(dy, dx);
            const dist = Math.abs(dx) + Math.abs(dy);
            const radius = 42;
            const left = `calc(50% + ${Math.cos(angle) * radius}%)`;
            const top = `calc(50% + ${Math.sin(angle) * radius}%)`;
            return (
              <div
                key={i}
                className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{ left, top }}
                title={`${wp.name ? wp.name + ' — ' : 'Waypoint '}(${wp.x}, ${wp.y}) — ${dist} tiles`}
              >
                <div className="pointer-events-none flex items-center gap-1 px-1.5 py-0.5 rounded-full border backdrop-blur-sm shadow-md text-[10px] font-medium leading-none text-emerald-300 bg-emerald-500/15 border-emerald-400/60">
                  <span
                    className="pointer-events-none inline-block text-[12px] leading-none"
                    style={{ transform: `rotate(${(angle * 180) / Math.PI}deg)` }}
                  >➤</span>
                  <span className="pointer-events-none text-base leading-none">📍</span>
                  <span className="pointer-events-none tabular-nums opacity-90">{dist}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});


OverworldRenderer.displayName = 'OverworldRenderer';
