// Overworld Renderer - Renders the chunk-based overworld with tile graphics

import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { OverworldState, OverworldTile, getOverworldTile } from './overworld';
import { Position, Monster, UnlockedMonster } from './types';
import { MonsterSprite } from './sprites';
import {
  OverworldGrassTile, OverworldHarvestedTile, OverworldTreeTile,
  OverworldRockTile, OverworldWaterTile, OverworldBuildingTile,
  OverworldDungeonTile, OverworldFogTile, OverworldNestTile,
  OverworldDirtRoadTile, OverworldStoneRoadTile,
} from './OverworldTileGraphics';
import { OverworldBuildingTileGraphic } from './OverworldBuildingTileGraphics';
import { PlayerBuilding, isWallActingAsGate, getGateAxis, wallConnectsTo, roadConnectsTo } from './buildings';
import { fitFromNeighbors } from './autoTiling';
import { NestState } from './nests';
import { MatchupIndicator } from './MatchupIndicator';
import { ElementType, ClassType } from './types';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { BuildingTooltipContent } from './BuildingTooltip';
import { OverworldTooltipContent } from './OverworldTooltip';

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
    case 'grass': return tile.harvested
      ? <OverworldHarvestedTile size={tileSize} seed={seed} />
      : <OverworldGrassTile size={tileSize} seed={seed} />;
    case 'tree': return <OverworldTreeTile size={tileSize} seed={seed} tier={tile.treeTier} />;
    case 'rock': return <OverworldRockTile size={tileSize} seed={seed} tier={tile.stoneTier} />;
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
        const damaged = playerBuilding.hp < playerBuilding.maxHp;
        return (
          <OverworldBuildingTileGraphic
            type={playerBuilding.type}
            size={tileSize}
            seed={seed}
            wallFit={fit}
            isGate={isGate}
            gateAxis={gateAxis}
            damaged={damaged}
          />
        );
      }
      return <OverworldBuildingTileGraphic type={playerBuilding.type} size={tileSize} seed={seed} harvestReady={playerBuilding.harvestReady} />;
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
  const { x: px, y: py } = overworld.playerPosition;
  
  const scale = zoom / 100;
  const tileSize = Math.floor(TILE_SIZE * scale);
  
  useImperativeHandle(ref, () => ({
    scrollToPlayer: () => {
      // No-op: player is always centered via CSS transform
    },
  }));
  
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
              className={`absolute cursor-pointer overflow-hidden ${
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
              onClick={() => onTileClick?.(worldX, worldY)}
              onContextMenu={(e) => {
                e.preventDefault();
                onTileRightClick?.(worldX, worldY);
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
    </div>
  );
});

OverworldRenderer.displayName = 'OverworldRenderer';
