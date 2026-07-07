// Enhanced Dungeon Renderer with hand-drawn ink/watercolor tile graphics

import { forwardRef, useImperativeHandle, useRef, useState, useEffect } from 'react';
import { DungeonState, DungeonTile, TileType, ElementType, ClassType, Monster, SpeciesType, SPECIES_DATA, ELEMENT_ADVANTAGES, CLASS_ADVANTAGES_CORRECTED, TrapType, PlantType, UnlockedMonster, DungeonEntrance } from './types';
import { CRAFTING_MATERIALS } from './equipment';
import { MonsterSprite } from './sprites';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MINEABLE_WALL_TIERS, PICKAXE_TIERS, hitsToBreak, type PickaxeTier } from './tools';
import { TERRAIN_CONFIG } from './terrain';
import { MatchupIndicator } from './MatchupIndicator';
import { 
  FloorTile, 
  WallTile, 
  MineableWallTile,
  TerrainTile, 
  StairsTile, 
  StairsUpTile,
  PortalStairsTile,
  TreasureTile, 
  TrapTile, 
  PlantTile, 
  ShopTile, 
  ElevatorTile,
  DoorTile 
} from './TileGraphics';
import { OverworldNestTile } from './OverworldTileGraphics';
import { fitFromNeighbors } from './autoTiling';
import { isAdminCompass, onAdminCompassChange } from './adminCompass';
import { isDowsingEffective, onDowsingChange, DOWSING_HIGHLIGHT_COUNT } from './dowsingRod';
import { BUILDING_DEFINITIONS } from './buildings';
import { ParticleLayer } from './particles/ParticleLayer';


// Check if a monster combo has been captured at equal or lower level
function isCaptured(enemy: Monster, unlockedMonsters: UnlockedMonster[]): {
  captured: boolean;
  capturedLevel?: number;
} {
  const match = unlockedMonsters.find(m => m.species === enemy.species && m.element === enemy.element && m.classType === enemy.class);
  if (match && match.level >= enemy.level) {
    return {
      captured: true,
      capturedLevel: match.level
    };
  }
  return {
    captured: false
  };
}

// Calculate matchup between player and enemy
function getMatchupInfo(playerElement: ElementType, playerClass: ClassType, enemyElement: ElementType, enemyClass: ClassType): {
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
    playerStrongVsClass: playerBeatsEnemyClass
  };
}
interface DungeonRendererProps {
  dungeon: DungeonState;
  playerElement: ElementType;
  playerClass?: ClassType;
  playerSpecies?: SpeciesType;
  playerDexterity?: number; // For disarm calculations
  zoom?: number; // 50-400, 100 = default
  unlockedMonsters?: UnlockedMonster[]; // For showing captured status
  targetPath?: {
    x: number;
    y: number;
  }[]; // Path for click-to-move
  onDisarmTrap?: (x: number, y: number, success: boolean) => void;
  onTileClick?: (x: number, y: number) => void; // Click-to-move handler
  onTileRightClick?: (x: number, y: number) => void; // Right-click handler (e.g. open enemy attack menu)
  // Targeting mode for attacks
  targetingMode?: boolean;
  targetingTiles?: { x: number; y: number }[]; // Valid target tiles
  affectedTiles?: { x: number; y: number }[]; // Preview of affected area
  hoveredTile?: { x: number; y: number } | null;
  onTileHover?: (x: number, y: number) => void;
  onTileHoverEnd?: () => void;
  dungeonEntrance?: DungeonEntrance | null; // For rich header info (name/theme/best floor)
  playerPickaxeTier?: PickaxeTier; // For mineable wall tooltips
}
export interface DungeonRendererHandle {
  scrollToPlayer: () => void;
}

// Trap info for tooltips
const TRAP_INFO: Record<TrapType, {
  name: string;
  icon: string;
  description: string;
}> = {
  spike: {
    name: 'Spike Trap',
    icon: '🔺',
    description: 'Deals physical damage when triggered',
  },
  poison: {
    name: 'Poison Trap',
    icon: '☠️',
    description: 'Inflicts poison status when triggered',
  },
  alarm: {
    name: 'Alarm Trap',
    icon: '🔔',
    description: 'Alerts nearby enemies when triggered',
  }
};

// Plant info for tooltips
function getPlantInfo(plantType: PlantType): {
  name: string;
  icon: string;
  description: string;
  rarity: string;
} {
  const material = CRAFTING_MATERIALS.find(m => m.id === plantType);
  return {
    name: material?.name || plantType,
    icon: material?.icon || '🌿',
    description: material?.description || 'A harvestable plant.',
    rarity: material?.rarity || 'common',
  };
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
  unlockedMonsters?: UnlockedMonster[];
  isOnPath?: boolean; // Is this tile part of the click-to-move path?
  onDisarmTrap?: (x: number, y: number, success: boolean) => void;
  onClick?: () => void;
  playerPickaxeTier?: PickaxeTier; // For mineable wall tooltips
  forceTooltipOpen?: boolean; // Touch tap-to-preview override
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
  unlockedMonsters = [],
  isOnPath = false,
  onDisarmTrap,
  onClick,
  playerPickaxeTier,
  forceTooltipOpen,
}: TileProps) {
  // When tap-to-preview forces a tooltip open, we still let hover toggle it on desktop.
  const tooltipOpenProps = forceTooltipOpen ? { open: true } : {};
  const tileStyle = {
    width: `${tileSize}px`,
    height: `${tileSize}px`,
    minWidth: `${tileSize}px`,
    minHeight: `${tileSize}px`
  };

  // Path indicator overlay style
  const pathOverlayClass = isOnPath ? 'ring-2 ring-amber-400/70 ring-inset' : '';
  if (!tile.explored) {
    return <div className="flex items-center justify-center bg-background" style={tileStyle} onClick={onClick} />;
  }

  const tileSeed = x * 127 + y * 311; // Consistent seed per tile position

  // Wall tiles - SVG ink texture (bedrock — unmineable)
  if (tile.type === 'wall') {
    return (
      <Tooltip {...tooltipOpenProps}>
        <TooltipTrigger asChild>
          <div className={`flex items-center justify-center overflow-hidden ${pathOverlayClass}`} style={tileStyle}>
            {tile.visible ? (
              <WallTile size={tileSize} seed={tileSeed} />
            ) : (
              <div className="w-full h-full bg-tile-wall opacity-60" />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px] p-2">
          <p className="font-bold text-sm">🪨 Bedrock</p>
          <p className="text-xs text-muted-foreground">
            Unbreakable structural rock. Cannot be mined with any pickaxe — route around it.
          </p>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Mineable wall — tier-tinted with ore veins and crack overlay for hits.
  if (tile.type === 'mineable_wall' && tile.wallTier) {
    const wallData = MINEABLE_WALL_TIERS[tile.wallTier];
    const needed = playerPickaxeTier ? hitsToBreak(tile.wallTier, playerPickaxeTier) : Infinity;
    const canMine = isFinite(needed);
    const hits = tile.wallHits || 0;
    const pickaxeName = playerPickaxeTier ? PICKAXE_TIERS[playerPickaxeTier].name : 'a Pickaxe';
    return (
      <Tooltip {...tooltipOpenProps}>
        <TooltipTrigger asChild>
          <div className={`flex items-center justify-center overflow-hidden ${pathOverlayClass} ${canMine ? 'cursor-pointer' : ''}`} style={tileStyle} onClick={onClick}>
            {tile.visible ? (
              <MineableWallTile
                size={tileSize}
                seed={tileSeed}
                tier={tile.wallTier}
                hits={hits}
                hitsNeeded={canMine ? needed : 3}
              />
            ) : (
              <div className="w-full h-full bg-tile-wall opacity-60" />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[240px] p-2">
          <p className="font-bold text-sm">⛏️ {wallData.name} <span className="text-xs text-muted-foreground font-normal">(Tier {tile.wallTier})</span></p>
          <p className="text-xs text-muted-foreground">
            Drops {wallData.name} when broken. Walk into it or attack it to mine.
          </p>
          {!playerPickaxeTier && (
            <p className="text-xs text-destructive mt-1">⚠️ You need a Pickaxe to mine this.</p>
          )}
          {playerPickaxeTier && !canMine && (
            <p className="text-xs text-destructive mt-1">⚠️ Your {pickaxeName} is too weak — needs tier {tile.wallTier}+.</p>
          )}
          {canMine && (
            <p className="text-xs text-primary mt-1">
              Progress: {hits} / {needed} hits with {pickaxeName}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    );
  }

  // Player tile - show player's monster sprite on floor graphic
  if (isPlayer && playerElement && playerSpecies) {
    return (
      <div 
        className={`flex items-center justify-center relative ${tile.visible ? 'ring-2 ring-primary shadow-lg shadow-primary/30' : ''}`} 
        style={tileStyle}
      >
        <div className="absolute inset-0">
          <FloorTile size={tileSize} seed={tileSeed} />
        </div>
        <div className="relative z-10">
          <MonsterSprite species={playerSpecies} element={playerElement} classType={playerClass || 'normal'} size={spriteSize} />
        </div>
      </div>
    );
  }

  // Enemy tiles - show monster sprite with enhanced tooltip on floor background
  if (tile.type === 'enemy' && tile.enemyId && tile.visible) {
    const enemy = enemies.find(e => e.id === tile.enemyId);
    if (enemy) {
      const speciesData = SPECIES_DATA[enemy.species];
      const matchup = playerElement && playerClass ? getMatchupInfo(playerElement, playerClass, enemy.element, enemy.class) : null;
      const hasWeakness = matchup && (matchup.playerWeakToElement || matchup.playerWeakToClass);
      const hasStrength = matchup && (matchup.playerStrongVsElement || matchup.playerStrongVsClass);
      const captureStatus = isCaptured(enemy, unlockedMonsters);
      return <Tooltip {...tooltipOpenProps}>
          <TooltipTrigger asChild>
            <div 
              className={`flex items-center justify-center relative hover:scale-110 transition-transform cursor-pointer`} 
              style={tileStyle}
              onClick={onClick}
            >
              <div className="absolute inset-0">
                <FloorTile size={tileSize} seed={tileSeed} />
              </div>
              <div className="relative z-10">
                <MonsterSprite species={enemy.species} element={enemy.element} classType={enemy.class} size={spriteSize} />
              </div>
              <MatchupIndicator
                playerElement={playerElement}
                playerClass={playerClass}
                enemyElement={enemy.element}
                enemyClass={enemy.class}
                size={tileSize}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[260px] p-3">
            <div className="space-y-2">
              {/* Header with name and level */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-sm">{enemy.name}</p>
                  <p className="text-xs text-muted-foreground">Lv.{enemy.level}</p>
                </div>
                {captureStatus.captured && <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/20 border border-primary/40 text-primary shrink-0">
                    <span className="text-xs">✓</span>
                    <span className="text-[10px] font-medium">Captured</span>
                  </div>}
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
                  <div className="h-full bg-destructive transition-all" style={{
                  width: `${enemy.stats.currentHp / enemy.stats.maxHp * 100}%`
                }} />
                </div>
              </div>

              {/* Stamina bar */}
              {(() => {
                const sMax = enemy.stats.stamina ?? 0;
                const sCur = enemy.stats.currentStamina ?? sMax;
                if (sMax <= 0) return null;
                return (
                  <div className="space-y-0.5">
                    <div className="flex justify-between text-xs">
                      <span>⚡ Stamina</span>
                      <span className="font-mono">{sCur}/{sMax}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 transition-all" style={{ width: `${(sCur / sMax) * 100}%` }} />
                    </div>
                  </div>
                );
              })()}
              
              {/* Stats row */}
              <div className="flex gap-2 text-[10px] text-muted-foreground">
                <span>⚔️{enemy.stats.attack}</span>
                <span>🛡️{enemy.stats.defense}</span>
                <span>💨{enemy.stats.speed}</span>
              </div>
              
              {/* Matchup section */}
              {matchup && <div className="border-t border-border pt-2 space-y-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase">Matchup</p>
                  
                  {/* Danger warning */}
                  {hasWeakness && <div className="bg-destructive/20 border border-destructive/40 rounded p-1.5 space-y-0.5">
                      <p className="text-xs font-bold text-destructive flex items-center gap-1">
                        ⚠️ You're weak!
                      </p>
                      {matchup.playerWeakToElement && <p className="text-[10px] text-destructive/90">
                          • {enemy.element.charAt(0).toUpperCase() + enemy.element.slice(1)} beats your element (1.5x dmg)
                        </p>}
                      {matchup.playerWeakToClass && <p className="text-[10px] text-destructive/90">
                          • {enemy.class.charAt(0).toUpperCase() + enemy.class.slice(1)} beats your class (1.3x dmg)
                        </p>}
                    </div>}
                  
                  {/* Strength indicator */}
                  {hasStrength && <div className="bg-green-500/20 border border-green-500/40 rounded p-1.5 space-y-0.5">
                      <p className="text-xs font-bold text-green-600 dark:text-green-400 flex items-center gap-1">
                        ✨ You have advantage!
                      </p>
                      {matchup.playerStrongVsElement && <p className="text-[10px] text-green-600 dark:text-green-400">
                          • Your element beats {enemy.element} (1.5x dmg)
                        </p>}
                      {matchup.playerStrongVsClass && <p className="text-[10px] text-green-600 dark:text-green-400">
                          • Your class beats {enemy.class} (1.3x dmg)
                        </p>}
                    </div>}
                  
                  {/* Neutral matchup */}
                  {!hasWeakness && !hasStrength && <p className="text-[10px] text-muted-foreground">
                      ⚖️ Neutral matchup
                    </p>}
                </div>}
              
              {/* Passive ability */}
              <div className="border-t border-border pt-2">
                <p className="text-[10px] font-semibold text-primary">{speciesData.passiveAbility}</p>
                <p className="text-[10px] text-muted-foreground italic">{speciesData.passiveDescription}</p>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>;
    }
  }

  // Trap tiles with detailed tooltips.
  // Unified actions now live upstream in the shared tile menu, so traps should
  // no longer intercept right-click / long-press here.
  if (tile.type === 'trap' && tile.visible) {
    const trapType = tile.trapType || 'spike';
    const trapInfo = TRAP_INFO[trapType];
    const isTriggered = tile.triggered;
    const disarmChance = Math.min(95, Math.max(5, playerDexterity * 3 + 20)); // 20-95% based on dexterity

    return <Tooltip {...tooltipOpenProps}>
        <TooltipTrigger asChild>
          <div 
            className={`flex items-center justify-center relative ${isTriggered ? 'opacity-50' : 'cursor-pointer hover:scale-105'} transition-transform`} 
            style={tileStyle} 
            onClick={onClick}
          >
            <TrapTile size={tileSize} trapType={trapType} triggered={isTriggered} seed={tileSeed} />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px] p-2">
          <div className="space-y-1">
            <p className="font-bold text-sm">{trapInfo.icon} {trapInfo.name}</p>
            <p className="text-xs text-muted-foreground">{trapInfo.description}</p>
            {isTriggered ? <p className="text-xs text-green-600 font-medium">Already triggered</p> : <div className="pt-1 border-t border-border mt-1">
                <p className="text-xs font-medium"><span className="hidden sm:inline">Right-click for actions</span><span className="sm:hidden">Long-press for actions</span></p>
                <p className="text-[10px] text-muted-foreground">
                  Disarm chance: <span className={disarmChance >= 60 ? 'text-green-600' : disarmChance >= 30 ? 'text-yellow-600' : 'text-red-600'}>{disarmChance}%</span> (based on Dexterity)
                </p>
              </div>}
          </div>
        </TooltipContent>
      </Tooltip>;
  }

  // Plant tiles with tooltips
  if (tile.type === 'plant' && tile.visible && tile.plantType) {
    const plantInfo = getPlantInfo(tile.plantType);
    const isHarvested = tile.harvested;
    
    return <Tooltip {...tooltipOpenProps}>
        <TooltipTrigger asChild>
          <div 
            className={`flex items-center justify-center relative ${isHarvested ? 'opacity-60' : 'cursor-pointer hover:scale-105'} transition-transform ${pathOverlayClass}`} 
            style={tileStyle} 
            onClick={onClick}
          >
            <PlantTile size={tileSize} plantType={tile.plantType} harvested={isHarvested} seed={tileSeed} />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px] p-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="font-bold text-sm">{plantInfo.icon} {plantInfo.name}</p>
              <span className={`text-[10px] px-1.5 py-0.5 rounded capitalize ${
                plantInfo.rarity === 'common' ? 'bg-green-100 text-green-700' :
                plantInfo.rarity === 'uncommon' ? 'bg-teal-100 text-teal-700' :
                plantInfo.rarity === 'rare' ? 'bg-amber-100 text-amber-700' :
                'bg-purple-100 text-purple-700'
              }`}>
                {plantInfo.rarity}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{plantInfo.description}</p>
            {isHarvested ? 
              <p className="text-xs text-muted-foreground italic">Already harvested</p> : 
              <p className="text-xs text-primary font-medium">Walk over to harvest!</p>
            }
          </div>
        </TooltipContent>
      </Tooltip>;
  }

  // Terrain tiles with SVG watercolor graphics and tooltips
  if (tile.type === 'terrain' && tile.visible && tile.terrainType) {
    const terrainConfig = TERRAIN_CONFIG[tile.terrainType];
    // Auto-tile fit: same terrain type in adjacent tile = "open" side, so the
    // watercolor wash bleeds across the seam and connected pools read as one.
    const sameTerrain = (tx: number, ty: number) =>
      ty >= 0 && ty < tiles.length && tx >= 0 && tx < tiles[0].length &&
      tiles[ty][tx].type === 'terrain' && tiles[ty][tx].terrainType === tile.terrainType;
    const terrainFit = fitFromNeighbors(
      sameTerrain(x, y - 1),
      sameTerrain(x + 1, y),
      sameTerrain(x, y + 1),
      sameTerrain(x - 1, y),
    );

    return <Tooltip {...tooltipOpenProps}>
      <TooltipTrigger asChild>
        <div
          className={`flex items-center justify-center relative ${pathOverlayClass} cursor-pointer hover:brightness-110`}
          style={tileStyle}
          onClick={onClick}
        >
          <TerrainTile size={tileSize} terrainType={tile.terrainType} seed={tileSeed} fit={terrainFit} />
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[240px] p-2">
        <p className="font-bold text-sm">{terrainConfig.icon} {terrainConfig.name}</p>
        <p className="text-xs text-muted-foreground">{terrainConfig.description}</p>
        <div className="mt-1 pt-1 border-t border-border">
          {terrainConfig.favoredElement && (
            <p className="text-[10px] text-green-600">✨ {terrainConfig.favoredElement.charAt(0).toUpperCase() + terrainConfig.favoredElement.slice(1)} element immune & gets damage bonus</p>
          )}
          {terrainConfig.favoredClass && (
            <p className="text-[10px] text-green-600">✨ {terrainConfig.favoredClass.charAt(0).toUpperCase() + terrainConfig.favoredClass.slice(1)} class immune & gets damage bonus</p>
          )}
          <p className="text-[10px] text-destructive">⚠️ Others take 2 damage when ending turn here</p>
        </div>
      </TooltipContent>
    </Tooltip>;
  }

  // Special tiles with SVG graphics and tooltips
  // Tiles that should have tooltips
  const tileTooltips: Partial<Record<TileType, {
    title: string;
    description: string;
  }>> = {
    treasure: {
      title: '💎 Treasure',
      description: 'Walk over to collect loot!'
    },
    stairs: {
      title: '⬇️ Stairs Down',
      description: 'Descend to the next floor'
    },
    stairs_up: tile.portal
      ? {
          title: tile.portal.destKind === 'tower' ? '🌀 Portal (Tower)' : '🌀 Portal (Overworld)',
          description: tile.portal.validated === false
            ? `Blocked — ${tile.portal.invalidReason || 'destination unavailable'}`
            : tile.portal.destKind === 'tower'
              ? `Warps to Tower ${tile.portal.destTowerId || '(unresolved)'}`
              : tile.portal.destOverworld
                ? `Warps to Overworld (${tile.portal.destOverworld.x}, ${tile.portal.destOverworld.y})`
                : 'Warps to overworld',
        }
      : {
          title: '⬆️ Stairs Up',
          description: 'Ascend back to the previous floor',
        },
    shop: {
      title: '🏪 Shop',
      description: 'Buy items and equipment'
    },
    elevator: {
      title: '🛗 Elevator',
      description: 'Send party members back to town'
    },
    door: {
      title: '🚪 Door',
      description: 'A passageway'
    },
    nest: {
      title: '🪺 Monster Nest',
      description: tile.nestState
        ? `${tile.nestState.element} nest — HP ${tile.nestState.hp}/${tile.nestState.maxHp}. Attack to destroy.`
        : 'Spawns enemies. Attack to destroy.',
    }
  };
  
  const tooltipInfo = tile.visible ? tileTooltips[tile.type] : null;
  
  // Render special tile types with SVG graphics
  const renderSpecialTile = () => {
    switch (tile.type) {
      case 'treasure':
        return <TreasureTile size={tileSize} seed={tileSeed} />;
      case 'stairs':
        return <StairsTile size={tileSize} seed={tileSeed} />;
      case 'stairs_up':
        return tile.portal
          ? <PortalStairsTile
              size={tileSize}
              seed={tileSeed}
              blocked={tile.portal.validated === false}
              destKind={tile.portal.destKind}
            />
          : <StairsUpTile size={tileSize} seed={tileSeed} />;
      case 'shop':
        return <ShopTile size={tileSize} seed={tileSeed} />;
      case 'elevator':
        return <ElevatorTile size={tileSize} seed={tileSeed} />;
      case 'door':
        return <DoorTile size={tileSize} seed={tileSeed} />;
      case 'nest': {
        const ns = tile.nestState;
        const hpPct = ns ? Math.round((ns.hp / ns.maxHp) * 100) : 100;
        return <OverworldNestTile size={tileSize} seed={tileSeed} element={ns?.element || 'normal'} hpPercent={hpPct} />;
      }
      default:
        return null;
    }
  };
  
  const specialTileGraphic = tile.visible ? renderSpecialTile() : null;
  
  if (tooltipInfo && specialTileGraphic) {
    return <Tooltip {...tooltipOpenProps}>
        <TooltipTrigger asChild>
          <div 
            className={`flex items-center justify-center relative cursor-pointer hover:scale-105 transition-transform ${pathOverlayClass}`} 
            style={tileStyle}
            onClick={onClick}
          >
            {specialTileGraphic}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="p-2">
          <p className="font-bold text-sm">{tooltipInfo.title}</p>
          <p className="text-xs text-muted-foreground">{tooltipInfo.description}</p>
        </TooltipContent>
      </Tooltip>;
  }
  
  // Floor tiles with SVG graphics
  return (
    <div 
      className={`flex items-center justify-center relative ${pathOverlayClass} ${onClick ? 'cursor-pointer hover:brightness-110' : ''}`} 
      style={tileStyle} 
      onClick={onClick}
    >
      {tile.visible ? (
        <>
          <FloorTile size={tileSize} seed={tileSeed} />
          {isOnPath && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-amber-600" style={{ fontSize: `${Math.max(6, tileSize * 0.3)}px` }}>•</span>
            </div>
          )}
        </>
      ) : (
        <div className="w-full h-full bg-tile-explored opacity-70">
          <FloorTile size={tileSize} seed={tileSeed} />
        </div>
      )}
    </div>
  );
}
export const DungeonRenderer = forwardRef<DungeonRendererHandle, DungeonRendererProps>(({
  dungeon,
  playerElement,
  playerClass,
  playerSpecies,
  playerDexterity = 10,
  zoom = 100,
  unlockedMonsters = [],
  targetPath = [],
  onDisarmTrap,
  onTileClick,
  onTileRightClick,
  targetingMode = false,
  targetingTiles = [],
  affectedTiles = [],
  hoveredTile,
  onTileHover,
  onTileHoverEnd,
  dungeonEntrance,
  playerPickaxeTier,
}, ref) => {
  // Calculate tile size based on zoom (base size is 28px at 100%)
  const baseTileSize = 28;
  const tileSize = Math.round(baseTileSize * (zoom / 100));
  const spriteSize = Math.round(22 * (zoom / 100));

  const { x: px, y: py } = dungeon.playerPosition;
  const gridWidth = dungeon.width;
  const gridHeight = dungeon.height;

  // Disable the centering transition whenever the dungeon grid is resized
  // (infinite-streaming prepends rows/cols and shifts player coords),
  // the floor changes (persistent stair descend/ascend), or the player
  // jumps more than 1 tile (teleport, floor reload). Without this the
  // camera slides for 120ms instead of snapping, briefly showing the map
  // off-center with the wrong tiles around the player.
  const prevCamRef = useRef<{ w: number; h: number; floor: number; px: number; py: number }>({
    w: gridWidth, h: gridHeight, floor: dungeon.floor, px, py,
  });
  const [skipTransition, setSkipTransition] = useState(false);
  useEffect(() => {
    const prev = prevCamRef.current;
    const dimsChanged = prev.w !== gridWidth || prev.h !== gridHeight;
    const floorChanged = prev.floor !== dungeon.floor;
    const jumped = Math.abs(prev.px - px) > 1 || Math.abs(prev.py - py) > 1;
    prevCamRef.current = { w: gridWidth, h: gridHeight, floor: dungeon.floor, px, py };
    if (dimsChanged || floorChanged || jumped) {
      setSkipTransition(true);
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setSkipTransition(false));
      });
      return () => cancelAnimationFrame(id);
    }
  }, [gridWidth, gridHeight, dungeon.floor, px, py]);

  // Admin override: re-render when the always-on-compass toggle flips so the
  // exit marker appears/disappears immediately.
  const [adminCompassOn, setAdminCompassOn] = useState(() => isAdminCompass());
  useEffect(() => onAdminCompassChange(setAdminCompassOn), []);

  // Dowsing Rod: re-render when the buff toggles, and tick every 5s so the
  // buff auto-clears when its timer expires.
  const [dowsingOn, setDowsingOn] = useState(() => isDowsingEffective());
  useEffect(() => {
    const off = onDowsingChange(() => setDowsingOn(isDowsingEffective()));
    const interval = setInterval(() => setDowsingOn(isDowsingEffective()), 5000);
    return () => { off(); clearInterval(interval); };
  }, []);

  // Effective compass waypoint: real one (from item) takes priority; otherwise
  // if the admin toggle is on we scan the floor for the down-stairs tile.
  let effectiveWaypoint = dungeon.compassWaypoint;
  if (!effectiveWaypoint && adminCompassOn) {
    outer: for (let yy = 0; yy < dungeon.tiles.length; yy++) {
      const row = dungeon.tiles[yy];
      for (let xx = 0; xx < row.length; xx++) {
        if (row[xx].type === 'stairs') {
          effectiveWaypoint = { x: xx, y: yy };
          break outer;
        }
      }
    }
  }

  // Compute the set of tile positions to highlight when dowsing is active:
  // the nearest DOWSING_HIGHLIGHT_COUNT enemy tiles by Manhattan distance.
  const dowsedTiles = (() => {
    if (!dowsingOn) return [] as { x: number; y: number }[];
    const candidates: { x: number; y: number; d: number }[] = [];
    for (let yy = 0; yy < dungeon.tiles.length; yy++) {
      const row = dungeon.tiles[yy];
      for (let xx = 0; xx < row.length; xx++) {
        if (row[xx].type === 'enemy' && row[xx].enemyId) {
          candidates.push({ x: xx, y: yy, d: Math.abs(xx - px) + Math.abs(yy - py) });
        }
      }
    }
    candidates.sort((a, b) => a.d - b.d);
    return candidates.slice(0, DOWSING_HIGHLIGHT_COUNT).map(c => ({ x: c.x, y: c.y }));
  })();

  // Mobile double-tap → treat as right-click. A second tap on the SAME tile
  // within 300ms calls onTileRightClick instead of onTileClick.
  const lastTapRef = useRef<{ x: number; y: number; time: number } | null>(null);
  // Touch tap-to-preview: on touch input, the first tap on a tile shows its
  // tooltip without acting; a second tap on the same tile within ~3s performs
  // the click. Mouse / keyboard input bypasses this entirely.
  const lastInputWasTouchRef = useRef(false);
  const [previewTile, setPreviewTile] = useState<{ x: number; y: number } | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPreview = () => {
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    setPreviewTile(null);
  };

  // Cancel the preview when the player moves (position changes) so a stale
  // preview tile doesn't linger.
  useEffect(() => {
    clearPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [px, py]);

  const handleTileTap = (x: number, y: number) => {
    const now = Date.now();
    const last = lastTapRef.current;
    if (last && last.x === x && last.y === y && now - last.time < 300) {
      lastTapRef.current = null;
      clearPreview();
      onTileRightClick?.(x, y);
      return;
    }
    lastTapRef.current = { x, y, time: now };

    // Touch input → first tap on a NEW tile previews the tooltip instead of
    // acting. Second tap on the same previewed tile performs the action.
    if (lastInputWasTouchRef.current) {
      const isPreviewed = previewTile && previewTile.x === x && previewTile.y === y;
      if (!isPreviewed) {
        if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
        setPreviewTile({ x, y });
        // Auto-dismiss preview after a few seconds so it doesn't linger.
        previewTimerRef.current = setTimeout(() => setPreviewTile(null), 3500);
        return;
      }
      // Second tap on previewed tile → act. Clear the preview first.
      clearPreview();
    }

    onTileClick?.(x, y);
  };

  // No-op: player is always centered via CSS transform (matches OverworldRenderer behavior)
  useImperativeHandle(ref, () => ({
    scrollToPlayer: () => {},
  }), []);

  return <TooltipProvider delayDuration={200}>
    <div className="w-full h-full flex flex-col">
      {/* Floor header - rich dungeon info */}
      {(() => {
        // Compute average enemy level on this floor (alive enemies on the map)
        const aliveEnemies = dungeon.enemies.filter(e => e.stats.currentHp > 0);
        const avgLevel = aliveEnemies.length > 0
          ? Math.round(aliveEnemies.reduce((sum, e) => sum + e.level, 0) / aliveEnemies.length)
          : Math.max(1, dungeon.floor + (dungeon.startingFloor ?? 0));

        // Theme display
        const theme = dungeonEntrance?.theme ?? dungeon.theme;
        const themeChips: { label: string; emoji?: string }[] = [];
        if (theme) {
          if (theme.kind === 'all') {
            themeChips.push({ label: 'All Types', emoji: '🌌' });
          } else if (theme.kind === 'element' && theme.value) {
            const ELEMENT_EMOJI: Record<string, string> = {
              fire: '🔥', water: '💧', earth: '🪨', air: '💨', electric: '⚡',
              ice: '❄️', poison: '☠️', light: '✨', dark: '🌑', neutral: '⚪',
            };
            themeChips.push({ label: `${theme.value} element`, emoji: ELEMENT_EMOJI[theme.value as string] || '🔮' });
          } else if (theme.kind === 'class' && theme.value) {
            themeChips.push({ label: `${theme.value} class`, emoji: '⚔️' });
          } else if (theme.kind === 'species' && theme.value) {
            themeChips.push({ label: `${theme.value} species`, emoji: '🐾' });
          }
        }

        // Title: prefer entrance name, then theme-derived, then fallback
        const dungeonTitle = dungeonEntrance?.name
          ?? (theme?.kind === 'all' ? 'Tower of the Infinite' : null)
          ?? (theme?.kind === 'element' && theme.value ? `${theme.value} Tower` : null)
          ?? (theme?.kind === 'class' && theme.value ? `${theme.value} Tower` : null)
          ?? (theme?.kind === 'species' && theme.value ? `${theme.value} Tower` : null)
          ?? (dungeonEntrance?.element ? `${dungeonEntrance.element} Wilderness Dungeon` : null)
          ?? 'Dungeon';

        const startingFloor = dungeonEntrance?.difficulty ?? dungeon.startingFloor ?? 1;
        const deepestFloor = dungeonEntrance?.deepestFloor ?? 0;

        return (
          <div className="mb-3 px-1 space-y-1">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  {dungeonTitle}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary font-semibold">
                  Floor {dungeon.floor}
                </span>
                {themeChips.map((chip, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-secondary/20 text-secondary-foreground capitalize">
                    {chip.emoji ? `${chip.emoji} ` : ''}{chip.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
              <span>
                Avg monster lvl: <span className="text-foreground font-semibold">{avgLevel}</span>
              </span>
              <span className="opacity-60">•</span>
              <span>
                Starting floor: <span className="text-foreground font-semibold">{startingFloor}</span>
              </span>
              <span className="opacity-60">•</span>
              <span>
                Best reached: <span className={deepestFloor > 0 ? 'text-foreground font-semibold' : 'text-muted-foreground/60'}>
                  {deepestFloor > 0 ? `Floor ${deepestFloor}` : '—'}
                </span>
              </span>
              <span className="opacity-60">•</span>
              <span>
                Enemies on floor: <span className="text-foreground font-semibold">{aliveEnemies.length}</span>
              </span>
              <span className="opacity-60">•</span>
              <span>
                Pos:{' '}
                <span className="text-foreground font-semibold tabular-nums">
                  ({dungeon.playerPosition.x - (dungeon.entryPosition?.x ?? dungeon.playerPosition.x)},{' '}
                  {dungeon.playerPosition.y - (dungeon.entryPosition?.y ?? dungeon.playerPosition.y)})
                </span>
              </span>
            </div>
          </div>
        );
      })()}

      {/* Dungeon grid - player always centered via CSS transform (same as OverworldRenderer) */}
      <div className="flex-1 w-full overflow-hidden border border-border rounded-lg bg-background relative">
        <div
          className="absolute"
          style={{
            width: gridWidth * tileSize,
            height: gridHeight * tileSize,
            left: '50%',
            top: '50%',
            transform: `translate(${-(px * tileSize + tileSize / 2)}px, ${-(py * tileSize + tileSize / 2)}px)`,
            transition: skipTransition ? 'none' : 'transform 120ms ease-out',
          }}
        >
          <ParticleLayer surface="dungeon" tileSize={tileSize} />
          {dungeon.tiles.map((row, y) => (
            <div key={y} className="flex" style={{ height: tileSize }}>
              {row.map((tile, x) => {
                const isTargetable = targetingTiles.some(t => t.x === x && t.y === y);
                const isAffected = affectedTiles.some(t => t.x === x && t.y === y);
                const isHovered = hoveredTile?.x === x && hoveredTile?.y === y;

                // Mobile long-press → opens right-click menu (e.g. enemy attack menu).
                // Use the dataset on the DOM element so the timer survives any
                // React re-renders during the 450ms hold.
                return (
                  <div
                    key={`${x}-${y}`}
                    className="relative lp-tile"
                    style={{ width: tileSize, height: tileSize }}
                    onMouseEnter={() => targetingMode && onTileHover?.(x, y)}
                    onMouseLeave={() => targetingMode && onTileHoverEnd?.()}
                    onContextMenu={(e) => {
                      if (!onTileRightClick || !tile.explored) return;
                      e.preventDefault();
                      lastTapRef.current = null;
                      onTileRightClick(x, y);
                    }}
                    onTouchStart={(e) => {
                      lastInputWasTouchRef.current = true;
                      if (!onTileRightClick || !tile.explored) return;
                      const el = e.currentTarget;
                      const timer = setTimeout(() => {
                        el.dataset.longPressFired = '1';
                        lastTapRef.current = null;
                        onTileRightClick(x, y);
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
                    onMouseDown={() => { lastInputWasTouchRef.current = false; }}
                    onClickCapture={(e) => {
                      const el = e.currentTarget as HTMLDivElement;
                      if (el.dataset.longPressFired) {
                        delete el.dataset.longPressFired;
                        e.preventDefault();
                        e.stopPropagation();
                      }
                    }}
                  >
                    <Tile
                      tile={tile}
                      x={x}
                      y={y}
                      tiles={dungeon.tiles}
                      enemies={dungeon.enemies}
                      isPlayer={px === x && py === y}
                      playerElement={playerElement}
                      playerClass={playerClass}
                      playerSpecies={playerSpecies}
                      playerDexterity={playerDexterity}
                      tileSize={tileSize}
                      spriteSize={spriteSize}
                      unlockedMonsters={unlockedMonsters}
                      isOnPath={targetPath.some(p => p.x === x && p.y === y)}
                      onDisarmTrap={onDisarmTrap}
                      onClick={tile.explored && tile.type !== 'wall' ? () => handleTileTap(x, y) : undefined}
                      playerPickaxeTier={playerPickaxeTier}
                      forceTooltipOpen={previewTile?.x === x && previewTile?.y === y}
                    />
                    {/* Targeting overlay */}
                    {targetingMode && isTargetable && (
                      <div
                        className={`absolute inset-0 pointer-events-none z-10 border-2 ${
                          isAffected
                            ? 'bg-destructive/40 border-destructive animate-pulse'
                            : 'bg-primary/20 border-primary/40'
                        } ${isHovered ? 'ring-2 ring-offset-1 ring-destructive' : ''}`}
                      />
                    )}
                    {/* Non-targetable range indicator */}
                    {targetingMode && !isTargetable && tile.visible && tile.type !== 'wall' && (
                      <div className="absolute inset-0 pointer-events-none z-5 bg-muted/30" />
                    )}
                    {/* Dungeon Compass waypoint: pulsing ring on the pinned tile.
                        Visible even through fog so the player can chase the exit. */}
                    {effectiveWaypoint
                      && effectiveWaypoint.x === x
                      && effectiveWaypoint.y === y && (
                        <div
                          className="absolute inset-0 pointer-events-none z-20 flex items-center justify-center"
                          aria-label="Compass waypoint"
                        >
                          <div className="absolute inset-0 pointer-events-none rounded-full border-2 border-amber-400 animate-ping opacity-70" />
                          <div className="absolute inset-1 pointer-events-none rounded-full border-2 border-amber-300 opacity-90" />
                          <span className="relative pointer-events-none text-base drop-shadow-[0_0_4px_rgba(251,191,36,0.9)]">🧭</span>
                        </div>
                    )}
                    {/* Player-pinned waypoints (right-click on tile). Same
                        pulsing-ring treatment as the compass, in emerald. */}
                    {(dungeon.compassWaypoints || []).some(p => p.x === x && p.y === y) && (
                      <div
                        className="absolute inset-0 pointer-events-none z-20 flex items-center justify-center"
                        aria-label="Pinned waypoint"
                      >
                        <div className="absolute inset-0 pointer-events-none rounded-full border-2 border-emerald-400 animate-ping opacity-60" />
                        <div className="absolute inset-1 pointer-events-none rounded-full border-2 border-emerald-300 opacity-90" />
                        <span className="relative pointer-events-none text-sm drop-shadow-[0_0_4px_rgba(52,211,153,0.9)]">📍</span>
                      </div>
                    )}
                    {/* Dowsing Rod: highlight the nearest 5 enemy tiles. */}
                    {dowsedTiles.some(p => p.x === x && p.y === y) && (
                      <div
                        className="absolute inset-0 pointer-events-none z-20"
                        aria-label="Dowsed enemy"
                      >
                        <div className="absolute inset-0 rounded-md ring-2 ring-fuchsia-400 animate-pulse shadow-[0_0_10px_rgba(232,121,249,0.7)]" />
                      </div>
                    )}
                    {/* Player-placed buildings on this dungeon floor */}
                    {(() => {
                      const b = ((dungeon as any).playerBuildings as any[] || [])
                        .find(pb => pb.worldX === x && pb.worldY === y);
                      if (!b) return null;
                      const def = BUILDING_DEFINITIONS[b.type as keyof typeof BUILDING_DEFINITIONS];
                      if (!def) return null;
                      return (
                        <div
                          className="absolute inset-0 pointer-events-none z-15 flex items-center justify-center"
                          aria-label={def.name}
                          title={def.name}
                        >
                          <span style={{ fontSize: Math.round(tileSize * 0.7) }}>{def.emoji}</span>
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        {/* Edge-of-screen arrow for the active dungeon compass (stairs). */}
        {effectiveWaypoint && (() => {
          const wp = effectiveWaypoint;
          const dx = wp.x - px;
          const dy = wp.y - py;
          if (dx === 0 && dy === 0) return null;
          if (Math.abs(dx) <= 8 && Math.abs(dy) <= 8) return null;
          const angle = Math.atan2(dy, dx);
          const dist = Math.abs(dx) + Math.abs(dy);
          const radius = 42;
          const left = `calc(50% + ${Math.cos(angle) * radius}%)`;
          const top = `calc(50% + ${Math.sin(angle) * radius}%)`;
          return (
            <div className="absolute inset-0 pointer-events-none z-30">
              <div
                className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{ left, top }}
                title={`Stairs — ${dist} tiles`}
              >
                <div className="pointer-events-none flex items-center gap-1 px-1.5 py-0.5 rounded-full border backdrop-blur-sm shadow-md text-[10px] font-medium leading-none text-amber-200 bg-amber-500/20 border-amber-400/60">
                  <span
                    className="pointer-events-none inline-block text-[12px] leading-none"
                    style={{ transform: `rotate(${(angle * 180) / Math.PI}deg)` }}
                  >➤</span>
                  <span className="pointer-events-none text-base leading-none">⬇️</span>
                  <span className="pointer-events-none tabular-nums opacity-90">{dist}</span>
                </div>
              </div>
            </div>
          );
        })()}
        {/* Edge-of-screen arrows pointing to off-screen pinned waypoints. */}
        {(dungeon.compassWaypoints || []).length > 0 && (
          <div className="absolute inset-0 pointer-events-none z-30">
            {(dungeon.compassWaypoints || []).map((wp, i) => {
              const dx = wp.x - px;
              const dy = wp.y - py;
              if (dx === 0 && dy === 0) return null;
              // Only show arrow if tile is off-screen (rough check via tileSize).
              // Actual visible range depends on viewport size; approximate with 8 tiles.
              if (Math.abs(dx) <= 8 && Math.abs(dy) <= 8) return null;
              const angle = Math.atan2(dy, dx);
              const ex = wp.x - (dungeon.entryPosition?.x ?? 0);
              const ey = wp.y - (dungeon.entryPosition?.y ?? 0);
              const dist = Math.abs(dx) + Math.abs(dy);
              // Position card at 45% offset from center along the angle.
              const radius = 42; // % of half-viewport
              const left = `calc(50% + ${Math.cos(angle) * radius}%)`;
              const top = `calc(50% + ${Math.sin(angle) * radius}%)`;
              return (
                <div
                  key={i}
                  className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ left, top }}
                  title={`${wp.name ? wp.name + ' — ' : 'Waypoint '}(${ex}, ${ey}) — ${dist} tiles`}
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
      {/* Map key - centered below the grid */}
      <div className="flex items-center justify-center gap-4 mt-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-gradient-to-br from-pink-400 to-primary" /> You
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-gradient-to-br from-red-400 to-orange-400" /> Enemy
        </span>
        <span>💎 Treasure</span>
        <span>⬇️ Stairs</span>
        <span>⚠️ Trap</span>
        <span>🏪 Shop</span>
      </div>
    </div>
    </TooltipProvider>;
});
DungeonRenderer.displayName = 'DungeonRenderer';
