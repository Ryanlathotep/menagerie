// Enhanced Dungeon Renderer with visual tiles - Bright Anime Style

import { forwardRef, useEffect, useRef, useImperativeHandle } from 'react';
import { DungeonState, DungeonTile, TileType, ElementType, ClassType, Monster, SpeciesType, SPECIES_DATA, ELEMENT_ADVANTAGES, CLASS_ADVANTAGES_CORRECTED, TrapType } from './types';
import { MonsterSprite } from './sprites';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Calculate matchup between player and enemy
function getMatchupInfo(
  playerElement: ElementType,
  playerClass: ClassType,
  enemyElement: ElementType,
  enemyClass: ClassType
): {
  elementAdvantage: 'player' | 'enemy' | 'neutral';
  classAdvantage: 'player' | 'enemy' | 'neutral';
  playerWeakToElement: boolean;
  playerWeakToClass: boolean;
  playerStrongVsElement: boolean;
  playerStrongVsClass: boolean;
} {
  // Element matchup
  const playerBeatsEnemyElement = ELEMENT_ADVANTAGES[playerElement]?.includes(enemyElement) || false;
  const enemyBeatsPlayerElement = ELEMENT_ADVANTAGES[enemyElement]?.includes(playerElement) || false;
  
  // Class matchup
  const playerBeatsEnemyClass = CLASS_ADVANTAGES_CORRECTED[playerClass]?.includes(enemyClass) || false;
  const enemyBeatsPlayerClass = CLASS_ADVANTAGES_CORRECTED[enemyClass]?.includes(playerClass) || false;
  
  return {
    elementAdvantage: playerBeatsEnemyElement ? 'player' : enemyBeatsPlayerElement ? 'enemy' : 'neutral',
    classAdvantage: playerBeatsEnemyClass ? 'player' : enemyBeatsPlayerClass ? 'enemy' : 'neutral',
    playerWeakToElement: enemyBeatsPlayerElement,
    playerWeakToClass: enemyBeatsPlayerClass,
    playerStrongVsElement: playerBeatsEnemyElement,
    playerStrongVsClass: playerBeatsEnemyClass,
  };
}

interface DungeonRendererProps {
  dungeon: DungeonState;
  playerElement: ElementType;
  playerClass?: ClassType;
  playerSpecies?: SpeciesType;
  playerDexterity?: number; // For disarm calculations
  zoom?: number; // 50-400, 100 = default
  onDisarmTrap?: (x: number, y: number, success: boolean) => void;
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
  },
  water: {
    bg: 'bg-gradient-to-br from-blue-300 to-cyan-400',
    content: '🌊',
    glow: 'shadow-md shadow-blue-400/40'
  }
};

// Trap info for tooltips and visuals
const TRAP_INFO: Record<TrapType, { name: string; icon: string; description: string; color: string }> = {
  spike: { 
    name: 'Spike Trap', 
    icon: '🔺', 
    description: 'Deals physical damage when triggered',
    color: 'from-red-200 to-red-300'
  },
  poison: { 
    name: 'Poison Trap', 
    icon: '☠️', 
    description: 'Inflicts poison status when triggered',
    color: 'from-purple-200 to-purple-300'
  },
  alarm: { 
    name: 'Alarm Trap', 
    icon: '🔔', 
    description: 'Alerts nearby enemies when triggered',
    color: 'from-yellow-200 to-orange-300'
  },
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
  playerClass?: ClassType;
  playerSpecies?: SpeciesType;
  playerDexterity?: number;
  tileSize: number;
  spriteSize: number;
  onDisarmTrap?: (x: number, y: number, success: boolean) => void;
}
function Tile({
  tile,
  x,
  y,
  tiles,
  enemies,
  isPlayer,
  playerElement,
  playerClass,
  playerSpecies,
  playerDexterity = 10,
  tileSize,
  spriteSize,
  onDisarmTrap
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
        <MonsterSprite species={playerSpecies} element={playerElement} classType={playerClass || 'normal'} size={spriteSize} />
      </div>;
  }

  // Enemy tiles - show monster sprite with enhanced tooltip
  if (tile.type === 'enemy' && tile.enemyId && tile.visible) {
    const enemy = enemies.find(e => e.id === tile.enemyId);
    if (enemy) {
      const speciesData = SPECIES_DATA[enemy.species];
      const matchup = playerElement && playerClass 
        ? getMatchupInfo(playerElement, playerClass, enemy.element, enemy.class)
        : null;
      
      const hasWeakness = matchup && (matchup.playerWeakToElement || matchup.playerWeakToClass);
      const hasStrength = matchup && (matchup.playerStrongVsElement || matchup.playerStrongVsClass);
      
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`flex items-center justify-center ${getFloorVariant(x, y, true)} relative hover:scale-110 transition-transform cursor-pointer`} style={tileStyle}>
              <MonsterSprite species={enemy.species} element={enemy.element} classType={enemy.class} size={spriteSize} />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[260px] p-3">
            <div className="space-y-2">
              {/* Header with name and level */}
              <div>
                <p className="font-bold text-sm">{enemy.name}</p>
                <p className="text-xs text-muted-foreground">Lv.{enemy.level}</p>
              </div>
              
              {/* Type badges */}
              <div className="flex flex-wrap gap-1">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary capitalize">
                  {enemy.element}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary capitalize">
                  {enemy.class}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary">
                  {speciesData.name}
                </span>
              </div>
              
              {/* HP bar */}
              <div className="space-y-0.5">
                <div className="flex justify-between text-xs">
                  <span>HP</span>
                  <span className="font-mono">{enemy.stats.currentHp}/{enemy.stats.maxHp}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-destructive transition-all" 
                    style={{ width: `${(enemy.stats.currentHp / enemy.stats.maxHp) * 100}%` }}
                  />
                </div>
              </div>
              
              {/* Stats row */}
              <div className="flex gap-2 text-[10px] text-muted-foreground">
                <span>⚔️{enemy.stats.attack}</span>
                <span>🛡️{enemy.stats.defense}</span>
                <span>💨{enemy.stats.speed}</span>
              </div>
              
              {/* Matchup section */}
              {matchup && (
                <div className="border-t border-border pt-2 space-y-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase">Matchup</p>
                  
                  {/* Danger warning */}
                  {hasWeakness && (
                    <div className="bg-destructive/20 border border-destructive/40 rounded p-1.5 space-y-0.5">
                      <p className="text-xs font-bold text-destructive flex items-center gap-1">
                        ⚠️ You're weak!
                      </p>
                      {matchup.playerWeakToElement && (
                        <p className="text-[10px] text-destructive/90">
                          • {enemy.element.charAt(0).toUpperCase() + enemy.element.slice(1)} beats your element (1.5x dmg)
                        </p>
                      )}
                      {matchup.playerWeakToClass && (
                        <p className="text-[10px] text-destructive/90">
                          • {enemy.class.charAt(0).toUpperCase() + enemy.class.slice(1)} beats your class (1.3x dmg)
                        </p>
                      )}
                    </div>
                  )}
                  
                  {/* Strength indicator */}
                  {hasStrength && (
                    <div className="bg-green-500/20 border border-green-500/40 rounded p-1.5 space-y-0.5">
                      <p className="text-xs font-bold text-green-600 dark:text-green-400 flex items-center gap-1">
                        ✨ You have advantage!
                      </p>
                      {matchup.playerStrongVsElement && (
                        <p className="text-[10px] text-green-600 dark:text-green-400">
                          • Your element beats {enemy.element} (1.5x dmg)
                        </p>
                      )}
                      {matchup.playerStrongVsClass && (
                        <p className="text-[10px] text-green-600 dark:text-green-400">
                          • Your class beats {enemy.class} (1.3x dmg)
                        </p>
                      )}
                    </div>
                  )}
                  
                  {/* Neutral matchup */}
                  {!hasWeakness && !hasStrength && (
                    <p className="text-[10px] text-muted-foreground">
                      ⚖️ Neutral matchup
                    </p>
                  )}
                </div>
              )}
              
              {/* Passive ability */}
              <div className="border-t border-border pt-2">
                <p className="text-[10px] font-semibold text-primary">{speciesData.passiveAbility}</p>
                <p className="text-[10px] text-muted-foreground italic">{speciesData.passiveDescription}</p>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      );
    }
  }

  // Trap tiles with detailed tooltips and right-click disarm
  if (tile.type === 'trap' && tile.visible) {
    const trapType = tile.trapType || 'spike';
    const trapInfo = TRAP_INFO[trapType];
    const isTriggered = tile.triggered;
    const disarmChance = Math.min(95, Math.max(5, playerDexterity * 3 + 20)); // 20-95% based on dexterity
    
    const handleRightClick = (e: React.MouseEvent) => {
      e.preventDefault();
      if (isTriggered || !onDisarmTrap) return;
      
      // Calculate disarm success
      const roll = Math.random() * 100;
      const success = roll < disarmChance;
      onDisarmTrap(x, y, success);
    };
    
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className={`flex items-center justify-center bg-gradient-to-br ${trapInfo.color} ${isTriggered ? 'opacity-50' : 'cursor-pointer hover:scale-110'} transition-transform`} 
            style={tileStyle}
            onContextMenu={handleRightClick}
          >
            <span style={{ fontSize: `${Math.max(10, tileSize * 0.5)}px` }}>
              {isTriggered ? '✓' : trapInfo.icon}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px] p-2">
          <div className="space-y-1">
            <p className="font-bold text-sm">{trapInfo.icon} {trapInfo.name}</p>
            <p className="text-xs text-muted-foreground">{trapInfo.description}</p>
            {isTriggered ? (
              <p className="text-xs text-green-600 font-medium">Already triggered</p>
            ) : (
              <div className="pt-1 border-t border-border mt-1">
                <p className="text-xs font-medium">Right-click to disarm</p>
                <p className="text-[10px] text-muted-foreground">
                  Success chance: <span className={disarmChance >= 60 ? 'text-green-600' : disarmChance >= 30 ? 'text-yellow-600' : 'text-red-600'}>{disarmChance}%</span> (based on Dexterity)
                </p>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Special tiles with tooltips (excluding traps which are handled above)
  const visual = TILE_VISUALS[tile.type];
  const floorClass = getFloorVariant(x, y, tile.visible);
  
  // Tiles that should have tooltips
  const tileTooltips: Partial<Record<TileType, { title: string; description: string }>> = {
    treasure: { title: '💎 Treasure', description: 'Walk over to collect loot!' },
    stairs: { title: '⬇️ Stairs', description: 'Descend to the next floor' },
    water: { title: '🌊 Water Hazard', description: 'Deals damage when walked through. Frogs are immune!' },
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
  playerClass,
  playerSpecies,
  playerDexterity = 10,
  zoom = 100,
  onDisarmTrap
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
                  playerClass={playerClass}
                  playerSpecies={playerSpecies}
                  playerDexterity={playerDexterity}
                  tileSize={tileSize}
                  spriteSize={spriteSize}
                  onDisarmTrap={onDisarmTrap}
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