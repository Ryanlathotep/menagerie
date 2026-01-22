// Enhanced Dungeon Renderer with visual tiles - Bright Anime Style

import { forwardRef, useEffect, useRef, useImperativeHandle } from 'react';
import { DungeonState, DungeonTile, TileType, ElementType, Monster, SpeciesType, SPECIES_DATA } from './types';
import { MonsterSpriteSmall } from './sprites';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface DungeonRendererProps {
  dungeon: DungeonState;
  playerElement: ElementType;
  playerSpecies?: SpeciesType;
  zoom?: number; // 50-200, 100 = default
}

export interface DungeonRendererHandle {
  scrollToPlayer: () => void;
}

// Tile visual configurations - Bright anime colors
const TILE_VISUALS: Record<TileType, {
  bg: string;
  content: string;
  glow?: string;
}> = {
  floor: {
    bg: 'bg-tile-floor',
    content: ''
  },
  wall: {
    bg: 'bg-tile-wall',
    content: ''
  },
  door: {
    bg: 'bg-tile-floor',
    content: '🚪'
  },
  stairs: {
    bg: 'bg-gradient-to-br from-amber-200 to-yellow-300',
    content: '⬇️',
    glow: 'shadow-lg shadow-amber-300/50'
  },
  trap: {
    bg: 'bg-red-200/80',
    content: '⚠️'
  },
  treasure: {
    bg: 'bg-gradient-to-br from-yellow-100 to-amber-200',
    content: '💎',
    glow: 'shadow-lg shadow-yellow-300/50'
  },
  enemy: {
    bg: 'bg-tile-visible',
    content: ''
  },
  player: {
    bg: 'bg-gradient-to-br from-pink-200 to-primary/30',
    content: ''
  },
  shop: {
    bg: 'bg-gradient-to-br from-green-200 to-emerald-300',
    content: '🏪',
    glow: 'shadow-lg shadow-green-300/50'
  }
};

// Wall texture patterns - softer anime style
function getWallVariant(x: number, y: number, tiles: DungeonTile[][]): string {
  const hash = (x * 7 + y * 13) % 4;
  const baseClasses = 'bg-tile-wall';

  // Check if this is an edge wall (adjacent to floor)
  const isEdge = y > 0 && tiles[y - 1]?.[x]?.type !== 'wall' || y < tiles.length - 1 && tiles[y + 1]?.[x]?.type !== 'wall' || x > 0 && tiles[y]?.[x - 1]?.type !== 'wall' || x < tiles[y].length - 1 && tiles[y]?.[x + 1]?.type !== 'wall';
  if (isEdge) {
    return `${baseClasses} border-2 border-muted-foreground/20`;
  }

  // Interior walls get subtle variation
  switch (hash) {
    case 0:
      return `${baseClasses} opacity-95`;
    case 1:
      return `${baseClasses} opacity-90`;
    case 2:
      return `${baseClasses} opacity-85`;
    default:
      return baseClasses;
  }
}

// Floor texture variation
function getFloorVariant(x: number, y: number, visible: boolean): string {
  const hash = (x * 11 + y * 17) % 6;
  const baseClasses = visible ? 'bg-tile-visible' : 'bg-tile-explored';

  // Occasional floor details
  if (hash === 0) {
    return `${baseClasses} opacity-90`;
  }
  if (hash === 1 && visible) {
    return `${baseClasses} opacity-95`;
  }
  return baseClasses;
}
interface TileProps {
  tile: DungeonTile;
  x: number;
  y: number;
  tiles: DungeonTile[][];
  enemies: Monster[];
  isPlayer: boolean;
  playerElement?: ElementType;
  playerSpecies?: SpeciesType;
  tileSize: number;
  spriteSize: number;
}
function Tile({
  tile,
  x,
  y,
  tiles,
  enemies,
  isPlayer,
  playerElement,
  playerSpecies,
  tileSize,
  spriteSize
}: TileProps) {
  const tileStyle = {
    width: `${tileSize}px`,
    height: `${tileSize}px`,
    minWidth: `${tileSize}px`,
    minHeight: `${tileSize}px`,
  };

  if (!tile.explored) {
    return <div className="flex items-center justify-center bg-background" style={tileStyle} />;
  }

  // Wall tiles
  if (tile.type === 'wall') {
    return <div className={`flex items-center justify-center ${getWallVariant(x, y, tiles)}`} style={tileStyle}>
        {tile.visible && <span className="text-muted-foreground/30" style={{ fontSize: `${Math.max(6, tileSize * 0.3)}px` }}>▓</span>}
      </div>;
  }

  // Player tile - show player's monster sprite
  if (isPlayer && playerElement && playerSpecies) {
    return <div className={`flex items-center justify-center bg-gradient-to-br from-pink-100 to-primary/20 ${tile.visible ? 'ring-2 ring-primary shadow-lg shadow-primary/30' : ''}`} style={tileStyle}>
        <MonsterSpriteSmall species={playerSpecies} element={playerElement} size={spriteSize} />
      </div>;
  }

  // Enemy tiles - show monster sprite with tooltip
  if (tile.type === 'enemy' && tile.enemyId && tile.visible) {
    const enemy = enemies.find(e => e.id === tile.enemyId);
    if (enemy) {
      const speciesData = SPECIES_DATA[enemy.species];
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`flex items-center justify-center ${getFloorVariant(x, y, true)} relative hover:scale-110 transition-transform cursor-pointer`} style={tileStyle}>
              <MonsterSpriteSmall species={enemy.species} element={enemy.element} size={spriteSize} />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[200px] p-2">
            <div className="space-y-1">
              <p className="font-bold text-sm">{enemy.name}</p>
              <p className="text-xs text-muted-foreground capitalize">
                Lv.{enemy.level} {enemy.element} {speciesData.name}
              </p>
              <p className="text-xs">HP: {enemy.stats.currentHp}/{enemy.stats.maxHp}</p>
              <p className="text-[10px] text-muted-foreground italic">{speciesData.passiveDescription}</p>
            </div>
          </TooltipContent>
        </Tooltip>
      );
    }
  }

  // Special tiles with tooltips
  const visual = TILE_VISUALS[tile.type];
  const floorClass = getFloorVariant(x, y, tile.visible);
  
  // Tiles that should have tooltips
  const tileTooltips: Partial<Record<TileType, { title: string; description: string }>> = {
    treasure: { title: '💎 Treasure', description: 'Walk over to collect loot!' },
    stairs: { title: '⬇️ Stairs', description: 'Descend to the next floor' },
    trap: { title: '⚠️ Trap', description: tile.triggered ? 'Already triggered' : 'Watch your step!' },
    shop: { title: '🏪 Shop', description: 'Buy items and equipment' },
  };
  
  const tooltipInfo = tile.visible ? tileTooltips[tile.type] : null;
  
  if (tooltipInfo) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center justify-center ${tile.type === 'floor' ? floorClass : visual.bg} ${visual.glow || ''} cursor-pointer`} style={tileStyle}>
            {visual.content && <span style={{ fontSize: `${Math.max(10, tileSize * 0.5)}px` }}>{visual.content}</span>}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="p-2">
          <p className="font-bold text-sm">{tooltipInfo.title}</p>
          <p className="text-xs text-muted-foreground">{tooltipInfo.description}</p>
        </TooltipContent>
      </Tooltip>
    );
  }
  
  return <div className={`flex items-center justify-center ${tile.type === 'floor' ? floorClass : visual.bg} ${visual.glow || ''}`} style={tileStyle}>
      {tile.visible && visual.content && <span style={{ fontSize: `${Math.max(10, tileSize * 0.5)}px` }}>{visual.content}</span>}
      {tile.visible && tile.type === 'floor' && <span className="text-muted-foreground/20" style={{ fontSize: `${Math.max(4, tileSize * 0.2)}px` }}>·</span>}
    </div>;
}
export const DungeonRenderer = forwardRef<DungeonRendererHandle, DungeonRendererProps>(({
  dungeon,
  playerElement,
  playerSpecies,
  zoom = 100
}, ref) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Calculate tile size based on zoom (base size is 28px at 100%)
  const baseTileSize = 28;
  const tileSize = Math.round(baseTileSize * (zoom / 100));
  const spriteSize = Math.round(22 * (zoom / 100));
  
  // Expose scroll method to parent
  useImperativeHandle(ref, () => ({
    scrollToPlayer: () => {
      if (scrollRef.current) {
        const scrollContainer = scrollRef.current;
        const playerPixelX = dungeon.playerPosition.x * tileSize + tileSize / 2;
        const playerPixelY = dungeon.playerPosition.y * tileSize + tileSize / 2;
        const scrollX = playerPixelX - scrollContainer.clientWidth / 2;
        const scrollY = playerPixelY - scrollContainer.clientHeight / 2;
        scrollContainer.scrollTo({
          left: Math.max(0, scrollX),
          top: Math.max(0, scrollY),
          behavior: 'smooth'
        });
      }
    }
  }), [dungeon.playerPosition.x, dungeon.playerPosition.y, tileSize]);
  
  // Auto-scroll when player moves or zoom changes
  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current;
      const scrollContent = scrollContainer.firstElementChild as HTMLElement;
      
      if (!scrollContent) return;
      
      // Calculate player position in pixels
      const playerPixelX = dungeon.playerPosition.x * tileSize + tileSize / 2;
      const playerPixelY = dungeon.playerPosition.y * tileSize + tileSize / 2;
      
      // Calculate scroll position to center player
      const scrollX = playerPixelX - scrollContainer.clientWidth / 2;
      const scrollY = playerPixelY - scrollContainer.clientHeight / 2;
      
      scrollContainer.scrollTo({
        left: Math.max(0, scrollX),
        top: Math.max(0, scrollY),
        behavior: 'smooth'
      });
    }
  }, [dungeon.playerPosition.x, dungeon.playerPosition.y, tileSize]);
  
  return (
    <TooltipProvider delayDuration={200}>
    <div className="w-full h-full flex flex-col">
      {/* Floor header - anime style */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Floor {dungeon.floor}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-secondary/20 text-secondary-foreground">
            ⭐ Adventure!
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-gradient-to-br from-pink-400 to-primary" /> You
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-gradient-to-br from-red-400 to-orange-400" /> Enemy
          </span>
        </div>
      </div>
      
      {/* Dungeon grid - fills available space */}
      <div ref={scrollRef} className="flex-1 w-full overflow-auto">
        <div className="inline-block min-w-full min-h-full">
          {dungeon.tiles.map((row, y) => (
            <div key={y} className="flex">
              {row.map((tile, x) => (
                <Tile 
                  key={`${x}-${y}`} 
                  tile={tile} 
                  x={x} 
                  y={y} 
                  tiles={dungeon.tiles} 
                  enemies={dungeon.enemies} 
                  isPlayer={dungeon.playerPosition.x === x && dungeon.playerPosition.y === y} 
                  playerElement={playerElement} 
                  playerSpecies={playerSpecies}
                  tileSize={tileSize}
                  spriteSize={spriteSize}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      
      {/* Minimap legend */}
      <div className="flex items-center gap-3 mt-3 text-[10px] text-muted-foreground justify-center">
        <span>💎 Treasure</span>
        <span>⬇️ Stairs</span>
        <span>⚠️ Trap</span>
      </div>
    </div>
    </TooltipProvider>
  );
});

DungeonRenderer.displayName = 'DungeonRenderer';