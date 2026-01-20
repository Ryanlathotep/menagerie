// Enhanced Dungeon Renderer with visual tiles

import { DungeonState, DungeonTile, TileType, ElementType, Monster } from './types';
import { MonsterSpriteSmall } from './sprites';

interface DungeonRendererProps {
  dungeon: DungeonState;
  playerElement: ElementType;
  playerSpecies?: string;
}

// Tile visual configurations
const TILE_VISUALS: Record<TileType, { bg: string; content: string; glow?: string }> = {
  floor: { bg: 'bg-tile-floor', content: '' },
  wall: { bg: 'bg-tile-wall', content: '' },
  door: { bg: 'bg-tile-floor', content: '🚪' },
  stairs: { bg: 'bg-tile-floor', content: '⬇️', glow: 'shadow-[0_0_8px_hsl(45_80%_55%)]' },
  trap: { bg: 'bg-destructive/30', content: '⚠️' },
  treasure: { bg: 'bg-tile-floor', content: '💎', glow: 'shadow-[0_0_6px_hsl(45_80%_55%)]' },
  enemy: { bg: 'bg-tile-visible', content: '' },
  player: { bg: 'bg-primary/30', content: '' },
};

// Wall texture patterns based on position
function getWallVariant(x: number, y: number, tiles: DungeonTile[][]): string {
  const hash = (x * 7 + y * 13) % 4;
  const baseClasses = 'bg-tile-wall';
  
  // Check if this is an edge wall (adjacent to floor)
  const isEdge = 
    (y > 0 && tiles[y-1]?.[x]?.type !== 'wall') ||
    (y < tiles.length - 1 && tiles[y+1]?.[x]?.type !== 'wall') ||
    (x > 0 && tiles[y]?.[x-1]?.type !== 'wall') ||
    (x < tiles[y].length - 1 && tiles[y]?.[x+1]?.type !== 'wall');
  
  if (isEdge) {
    return `${baseClasses} border-2 border-muted-foreground/20`;
  }
  
  // Interior walls get subtle variation
  switch (hash) {
    case 0: return `${baseClasses} opacity-95`;
    case 1: return `${baseClasses} opacity-90`;
    case 2: return `${baseClasses} opacity-85`;
    default: return baseClasses;
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
}

function Tile({ tile, x, y, tiles, enemies, isPlayer, playerElement }: TileProps) {
  if (!tile.explored) {
    return <div className="dungeon-tile bg-background" />;
  }
  
  // Wall tiles
  if (tile.type === 'wall') {
    return (
      <div className={`dungeon-tile ${getWallVariant(x, y, tiles)}`}>
        {tile.visible && (
          <span className="text-muted-foreground/30 text-[8px]">▓</span>
        )}
      </div>
    );
  }
  
  // Player tile
  if (isPlayer && playerElement) {
    return (
      <div className={`dungeon-tile bg-primary/20 ${tile.visible ? 'ring-2 ring-primary' : ''}`}>
        <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
          ◆
        </div>
      </div>
    );
  }
  
  // Enemy tiles
  if (tile.type === 'enemy' && tile.enemyId && tile.visible) {
    const enemy = enemies.find(e => e.id === tile.enemyId);
    if (enemy) {
      return (
        <div className={`dungeon-tile ${getFloorVariant(x, y, true)} relative`}>
          <MonsterSpriteSmall 
            species={enemy.species} 
            element={enemy.element} 
            size={20}
          />
        </div>
      );
    }
  }
  
  // Special tiles
  const visual = TILE_VISUALS[tile.type];
  const floorClass = getFloorVariant(x, y, tile.visible);
  
  return (
    <div className={`dungeon-tile ${tile.type === 'floor' ? floorClass : visual.bg} ${visual.glow || ''}`}>
      {tile.visible && visual.content && (
        <span className="text-sm">{visual.content}</span>
      )}
      {tile.visible && tile.type === 'floor' && (
        <span className="text-muted-foreground/20 text-[6px]">·</span>
      )}
    </div>
  );
}

export function DungeonRenderer({ dungeon, playerElement }: DungeonRendererProps) {
  return (
    <div className="bg-card rounded-lg p-3 border border-border shadow-xl">
      {/* Floor header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs text-muted-foreground">
          Floor {dungeon.floor}
        </span>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-primary" /> You
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-destructive" /> Enemy
          </span>
        </div>
      </div>
      
      {/* Dungeon grid */}
      <div className="inline-block rounded overflow-hidden border border-border/50">
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
              />
            ))}
          </div>
        ))}
      </div>
      
      {/* Minimap legend */}
      <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground justify-center">
        <span>💎 Treasure</span>
        <span>⬇️ Stairs</span>
        <span>⚠️ Trap</span>
      </div>
    </div>
  );
}