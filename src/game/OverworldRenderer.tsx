// Overworld Renderer - Renders the chunk-based overworld with tile graphics

import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { OverworldState, OverworldTile, getOverworldTile } from './overworld';
import { Position, Monster, UnlockedMonster } from './types';
import { MonsterSprite } from './sprites';
import {
  OverworldGrassTile, OverworldHarvestedTile, OverworldTreeTile,
  OverworldRockTile, OverworldWaterTile, OverworldBuildingTile,
  OverworldDungeonTile, OverworldFogTile, OverworldNestTile,
} from './OverworldTileGraphics';
import { OverworldBuildingTileGraphic } from './OverworldBuildingTileGraphics';
import { PlayerBuilding } from './buildings';
import { NestState } from './nests';

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
function renderTileGraphic(tile: OverworldTile, tileSize: number, seed: number, dungeonDepth?: number, playerBuilding?: PlayerBuilding, nest?: NestState): React.ReactNode {
  if (!tile.visible && !tile.explored) {
    return <OverworldFogTile size={tileSize} />;
  }
  switch (tile.type) {
    case 'grass': return tile.harvested
      ? <OverworldHarvestedTile size={tileSize} seed={seed} />
      : <OverworldGrassTile size={tileSize} seed={seed} />;
    case 'tree': return <OverworldTreeTile size={tileSize} seed={seed} />;
    case 'rock': return <OverworldRockTile size={tileSize} seed={seed} />;
    case 'water': return <OverworldWaterTile size={tileSize} seed={seed} />;
    case 'building': return <OverworldBuildingTile size={tileSize} buildingType={tile.buildingType} seed={seed} />;
    case 'dungeon_entrance': return <OverworldDungeonTile size={tileSize} seed={seed} depth={dungeonDepth} />;
    case 'player_building': return playerBuilding
      ? <OverworldBuildingTileGraphic type={playerBuilding.type} size={tileSize} seed={seed} harvestReady={playerBuilding.harvestReady} />
      : <OverworldGrassTile size={tileSize} seed={seed} />;
    case 'nest': return nest
      ? <OverworldNestTile size={tileSize} seed={seed} element={nest.element} hpPercent={Math.floor((nest.hp / nest.maxHp) * 100)} />
      : <OverworldGrassTile size={tileSize} seed={seed} />;
    case 'enemy': return <OverworldGrassTile size={tileSize} seed={seed} />;
    case 'player': return <OverworldGrassTile size={tileSize} seed={seed} />;
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
      if (containerRef.current) {
        const container = containerRef.current;
        const centerX = VIEW_RANGE * tileSize;
        const centerY = VIEW_RANGE * tileSize;
        container.scrollLeft = centerX - container.clientWidth / 2 + tileSize / 2;
        container.scrollTop = centerY - container.clientHeight / 2 + tileSize / 2;
      }
    },
  }));
  
  useEffect(() => {
    if (containerRef.current) {
      const container = containerRef.current;
      const centerX = VIEW_RANGE * tileSize;
      const centerY = VIEW_RANGE * tileSize;
      container.scrollLeft = centerX - container.clientWidth / 2 + tileSize / 2;
      container.scrollTop = centerY - container.clientHeight / 2 + tileSize / 2;
    }
  }, [px, py, tileSize]);
  
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
  
  return (
    <div 
      ref={containerRef}
      className="overflow-auto border border-border rounded-lg bg-background"
      style={{ maxHeight: '70vh' }}
    >
      <div
        className="relative"
        style={{
          width: gridSize * tileSize,
          height: gridSize * tileSize,
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
          
          return (
            <div
              key={`${worldX},${worldY}`}
              className={`absolute cursor-pointer overflow-hidden ${
                isTargetable ? 'ring-2 ring-red-500/50' : ''
              } ${isAffected ? 'ring-2 ring-red-400' : ''} ${isHovered ? 'ring-2 ring-yellow-400' : ''} ${
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
              {renderTileGraphic(tile, tileSize, tileSeed, dungeonDepth, playerBuilding, nestData)}
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
                <div className="absolute inset-0 flex items-center justify-center">
                  <MonsterSprite
                    species={enemy.species}
                    element={enemy.element}
                    classType={enemy.class}
                    size={tileSize * 0.7}
                  />
                </div>
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
            </div>
          );
        })}
      </div>
    </div>
  );
});

OverworldRenderer.displayName = 'OverworldRenderer';
