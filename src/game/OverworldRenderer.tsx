// Overworld Renderer - Renders the chunk-based overworld with tile graphics

import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { OverworldState, OverworldTile, getOverworldTile, CHUNK_SIZE, BUILDING_UPGRADES } from './overworld';
import { Position, Monster, UnlockedMonster, ELEMENT_ADVANTAGES, CLASS_ADVANTAGES_CORRECTED } from './types';
import { MonsterSprite } from './sprites';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface OverworldRendererProps {
  overworld: OverworldState;
  playerElement: string;
  playerClass?: string;
  playerSpecies?: string;
  zoom?: number;
  unlockedMonsters?: UnlockedMonster[];
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
function getTileEmoji(tile: OverworldTile): string {
  switch (tile.type) {
    case 'grass': return tile.harvested ? '🟫' : '🟩';
    case 'tree': return '🌲';
    case 'rock': return '🪨';
    case 'water': return '🌊';
    case 'building': return BUILDING_UPGRADES[tile.buildingType || 'campfire']?.emoji || '🔥';
    case 'dungeon_entrance': return '🗼';
    case 'enemy': return '';
    case 'player': return '';
    default: return '⬛';
  }
}

function getTileBg(tile: OverworldTile): string {
  if (!tile.visible && tile.explored) return 'bg-muted/50';
  if (!tile.visible) return 'bg-background';
  switch (tile.type) {
    case 'grass': return tile.harvested ? 'bg-amber-900/30' : 'bg-green-900/30';
    case 'tree': return 'bg-green-800/40';
    case 'rock': return 'bg-stone-700/40';
    case 'water': return 'bg-blue-800/40';
    case 'building': return 'bg-amber-600/30';
    case 'dungeon_entrance': return 'bg-purple-800/30';
    case 'enemy': return 'bg-red-900/20';
    default: return 'bg-green-900/30';
  }
}

export const OverworldRenderer = forwardRef<OverworldRendererHandle, OverworldRendererProps>(({
  overworld,
  playerElement,
  playerClass,
  playerSpecies,
  zoom = 100,
  unlockedMonsters = [],
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
          
          return (
            <div
              key={`${worldX},${worldY}`}
              className={`absolute flex items-center justify-center cursor-pointer transition-colors border border-border/20 ${getTileBg(tile)} ${
                isTargetable ? 'ring-2 ring-red-500/50' : ''
              } ${isAffected ? 'bg-red-500/30' : ''} ${isHovered ? 'ring-2 ring-yellow-400' : ''} ${
                !tile.visible ? 'opacity-40' : ''
              }`}
              style={{
                left: relX * tileSize,
                top: relY * tileSize,
                width: tileSize,
                height: tileSize,
                fontSize: tileSize * 0.5,
              }}
              onClick={() => onTileClick?.(worldX, worldY)}
              onContextMenu={(e) => {
                e.preventDefault();
                onTileRightClick?.(worldX, worldY);
              }}
              onMouseEnter={() => onTileHover?.(worldX, worldY)}
              onMouseLeave={() => onTileHoverEnd?.()}
            >
              {isPlayer ? (
                <MonsterSprite
                  species={(playerSpecies || 'slime') as any}
                  element={(playerElement || 'normal') as any}
                  classType={(playerClass || 'normal') as any}
                  size={tileSize * 0.8}
                />
              ) : enemy ? (
                <MonsterSprite
                  species={enemy.species}
                  element={enemy.element}
                  classType={enemy.class}
                  size={tileSize * 0.7}
                />
              ) : (
                <span className="select-none">{getTileEmoji(tile)}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

OverworldRenderer.displayName = 'OverworldRenderer';
