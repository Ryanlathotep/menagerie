// Enhanced Dungeon Renderer with visual tiles - Bright Anime Style

import { DungeonState, DungeonTile, TileType, ElementType, Monster, SpeciesType } from './types';
import { MonsterSpriteSmall } from './sprites';

interface DungeonRendererProps {
  dungeon: DungeonState;
  playerElement: ElementType;
  playerSpecies?: SpeciesType;
}

// Tile visual configurations - Bright anime colors
const TILE_VISUALS: Record<TileType, { bg: string; content: string; glow?: string }> = {
  floor: { bg: 'bg-tile-floor', content: '' },
  wall: { bg: 'bg-tile-wall', content: '' },
  door: { bg: 'bg-tile-floor', content: '🚪' },
  stairs: { bg: 'bg-gradient-to-br from-amber-200 to-yellow-300', content: '⬇️', glow: 'shadow-lg shadow-amber-300/50' },
  trap: { bg: 'bg-red-200/80', content: '⚠️' },
  treasure: { bg: 'bg-gradient-to-br from-yellow-100 to-amber-200', content: '💎', glow: 'shadow-lg shadow-yellow-300/50' },
  enemy: { bg: 'bg-tile-visible', content: '' },
  player: { bg: 'bg-gradient-to-br from-pink-200 to-primary/30', content: '' },
  shop: { bg: 'bg-gradient-to-br from-green-200 to-emerald-300', content: '🏪', glow: 'shadow-lg shadow-green-300/50' },
};

// Wall texture patterns - softer anime style
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
  playerSpecies?: SpeciesType;
}

function Tile({ tile, x, y, tiles, enemies, isPlayer, playerElement, playerSpecies }: TileProps) {
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
  
  // Player tile - show player's monster sprite
  if (isPlayer && playerElement && playerSpecies) {
    return (
      <div className={`dungeon-tile bg-gradient-to-br from-pink-100 to-primary/20 ${tile.visible ? 'ring-2 ring-primary shadow-lg shadow-primary/30' : ''}`}>
        <MonsterSpriteSmall 
          species={playerSpecies} 
          element={playerElement} 
          size={22}
        />
      </div>
    );
  }
  
  // Enemy tiles - show monster sprite
  if (tile.type === 'enemy' && tile.enemyId && tile.visible) {
    const enemy = enemies.find(e => e.id === tile.enemyId);
    if (enemy) {
      return (
        <div className={`dungeon-tile ${getFloorVariant(x, y, true)} relative hover:scale-110 transition-transform`}>
          <MonsterSpriteSmall 
            species={enemy.species} 
            element={enemy.element} 
            size={22}
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

export function DungeonRenderer({ dungeon, playerElement, playerSpecies }: DungeonRendererProps) {
  return (
    <div className="bg-card rounded-2xl p-4 border-2 border-primary/20 shadow-xl shadow-primary/10">
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
      
      {/* Dungeon grid - softer borders */}
      <div className="inline-block rounded-xl overflow-hidden border-2 border-border/30 bg-tile-floor/50">
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