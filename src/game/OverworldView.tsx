// Overworld View - Main overworld exploration component

import { useState, useEffect, useCallback, useRef } from 'react';
import { useGame } from './state';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  createOverworldState, 
  movePlayer, 
  updateVisibility,
  ensureChunksLoaded,
  OverworldState, 
  BUILDING_UPGRADES,
  canUpgradeBase,
  upgradeBase,
} from './overworld';
import { OverworldRenderer, OverworldRendererHandle } from './OverworldRenderer';
import { toast } from 'sonner';

interface OverworldViewProps {
  addLog: (text: string) => void;
}

export function OverworldView({ addLog }: OverworldViewProps) {
  const { state, dispatch } = useGame();
  const rendererRef = useRef<OverworldRendererHandle>(null);
  
  // Initialize or load overworld state
  const [overworld, setOverworld] = useState<OverworldState>(() => {
    let ow: OverworldState;
    if (state.saveData.overworldState) {
      ow = JSON.parse(JSON.stringify(state.saveData.overworldState));
    } else {
      ow = createOverworldState();
    }
    // Always ensure chunks around player are loaded and visibility is set
    ensureChunksLoaded(ow, ow.playerPosition.x, ow.playerPosition.y);
    updateVisibility(ow);
    return ow;
  });
  
  const [showBuildingMenu, setShowBuildingMenu] = useState(false);
  const [showDungeonPrompt, setShowDungeonPrompt] = useState(false);
  
  const monster = state.run?.currentMonster;
  
  // Save overworld state on changes
  const saveOverworld = useCallback((ow: OverworldState) => {
    dispatch({ type: 'UPDATE_OVERWORLD', overworld: { ...ow } });
  }, [dispatch]);
  
  // Handle movement
  const handleMove = useCallback((dx: number, dy: number) => {
    setOverworld(prev => {
      const newState = JSON.parse(JSON.stringify(prev)) as OverworldState;
      const result = movePlayer(newState, dx, dy);
      
      switch (result.type) {
        case 'moved':
          break;
        case 'blocked':
          toast.info(result.reason);
          return prev; // Don't update state
        case 'resource':
          addLog(`🪓 Gathered ${result.amount} ${result.resourceType}!`);
          toast.success(`+${result.amount} ${result.resourceType === 'wood' ? '🪵' : '🪨'} ${result.resourceType}`);
          break;
        case 'enemy':
          toast.warning(`An enemy ${result.enemy.name} blocks the way! Use attacks to fight.`);
          return prev;
        case 'building':
          setShowBuildingMenu(true);
          break;
        case 'dungeon_entrance':
          setShowDungeonPrompt(true);
          break;
      }
      
      // Step-based recovery for conscious party members
      if (state.run && result.type === 'moved') {
        // Recovery handled by game state
      }
      
      saveOverworld(newState);
      return newState;
    });
  }, [addLog, saveOverworld, state.run]);
  
  // Keyboard movement
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showBuildingMenu || showDungeonPrompt) return;
      
      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W':
          e.preventDefault();
          handleMove(0, -1);
          break;
        case 'ArrowDown': case 's': case 'S':
          e.preventDefault();
          handleMove(0, 1);
          break;
        case 'ArrowLeft': case 'a': case 'A':
          e.preventDefault();
          handleMove(-1, 0);
          break;
        case 'ArrowRight': case 'd': case 'D':
          e.preventDefault();
          handleMove(1, 0);
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleMove, showBuildingMenu, showDungeonPrompt]);
  
  // Handle tile click for movement
  const handleTileClick = useCallback((worldX: number, worldY: number) => {
    const dx = worldX - overworld.playerPosition.x;
    const dy = worldY - overworld.playerPosition.y;
    
    // Only move one step at a time for adjacent tiles
    if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && (dx !== 0 || dy !== 0)) {
      handleMove(dx, dy);
    }
  }, [overworld.playerPosition, handleMove]);
  
  const handleUpgrade = () => {
    setOverworld(prev => {
      const newState = JSON.parse(JSON.stringify(prev)) as OverworldState;
      const result = upgradeBase(newState);
      if (result) {
        const info = BUILDING_UPGRADES[result];
        toast.success(`Upgraded to ${info.label}! ${info.emoji}`);
        addLog(`🏗️ Upgraded base to ${info.label}!`);
        saveOverworld(newState);
        return newState;
      }
      return prev;
    });
  };
  
  const handleEnterDungeon = () => {
    setShowDungeonPrompt(false);
    dispatch({ type: 'SET_PHASE', phase: 'dungeon' });
  };
  
  const handleReturnToMenu = () => {
    saveOverworld(overworld);
    dispatch({ type: 'SET_PHASE', phase: 'main_menu' });
  };
  
  const baseInfo = BUILDING_UPGRADES[overworld.homeBase.buildingType];
  const canUpgrade = canUpgradeBase(overworld);
  const upgradeInfo = baseInfo.next ? BUILDING_UPGRADES[baseInfo.next] : null;
  
  return (
    <div className="min-h-screen w-full bg-background flex flex-col p-2 gap-2">
      {/* Top HUD */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleReturnToMenu}>
            ← Menu
          </Button>
          <span className="text-xs text-muted-foreground">
            🗺️ Overworld ({overworld.playerPosition.x}, {overworld.playerPosition.y})
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span>🪵 {overworld.woodCollected}</span>
          <span>🪨 {overworld.stoneCollected}</span>
          <span>💰 {state.saveData.gold || 0}</span>
          <span>{baseInfo.emoji} {baseInfo.label}</span>
        </div>
      </div>
      
      {/* Monster info */}
      {monster && (
        <div className="flex items-center gap-2 px-2 text-xs">
          <span className="capitalize font-medium">{monster.name}</span>
          <span className="text-muted-foreground">Lv.{monster.level}</span>
          <span className="text-red-400">❤️ {monster.stats.currentHp}/{monster.stats.maxHp}</span>
          <span className="text-blue-400">⚡ {monster.stats.currentStamina}/{monster.stats.stamina}</span>
        </div>
      )}
      
      {/* Map */}
      <div className="flex-1 min-h-0">
        <OverworldRenderer
          ref={rendererRef}
          overworld={overworld}
          playerElement={monster?.element || 'normal'}
          playerClass={monster?.class}
          playerSpecies={monster?.species}
          unlockedMonsters={state.saveData.unlockedMonsters}
          onTileClick={handleTileClick}
        />
      </div>
      
      {/* Controls hint */}
      <p className="text-center text-[10px] text-muted-foreground">
        WASD / Arrow keys to move • Click adjacent tiles • 🌲 Trees = wood • 🪨 Rocks = stone • 🗼 Dungeon entrance
      </p>
      
      {/* Building menu overlay */}
      {showBuildingMenu && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="p-6 max-w-md w-full space-y-4">
            <h2 className="text-lg font-bold text-center">
              {baseInfo.emoji} {baseInfo.label}
            </h2>
            
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Features:</p>
              <div className="flex flex-wrap gap-1">
                {baseInfo.features.map(f => (
                  <span key={f} className="text-xs px-2 py-1 bg-muted rounded">{f}</span>
                ))}
              </div>
            </div>
            
            {baseInfo.next && baseInfo.upgradeCost && (
              <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                <p className="text-sm font-medium">
                  Upgrade to {upgradeInfo?.emoji} {upgradeInfo?.label}
                </p>
                <p className="text-xs text-muted-foreground">
                  Cost: 🪵 {baseInfo.upgradeCost.wood} wood, 🪨 {baseInfo.upgradeCost.stone} stone
                </p>
                <p className="text-xs text-muted-foreground">
                  You have: 🪵 {overworld.woodCollected} / 🪨 {overworld.stoneCollected}
                </p>
                <Button 
                  size="sm" 
                  disabled={!canUpgrade}
                  onClick={handleUpgrade}
                  className="w-full"
                >
                  {canUpgrade ? `Upgrade to ${upgradeInfo?.label}` : 'Not enough resources'}
                </Button>
              </div>
            )}
            
            {/* Town features for upgraded buildings */}
            {(overworld.homeBase.buildingType === 'log_cabin' || overworld.homeBase.buildingType === 'town_hall') && (
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => {
                    setShowBuildingMenu(false);
                    dispatch({ type: 'SET_PHASE', phase: 'main_menu' });
                  }}
                >
                  🏪 Town Hub
                </Button>
              </div>
            )}
            
            <Button variant="ghost" className="w-full" onClick={() => setShowBuildingMenu(false)}>
              Close
            </Button>
          </Card>
        </div>
      )}
      
      {/* Dungeon entrance prompt */}
      {showDungeonPrompt && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="p-6 max-w-sm w-full space-y-4 text-center">
            <h2 className="text-lg font-bold">🗼 Dungeon Entrance</h2>
            <p className="text-sm text-muted-foreground">
              Enter the dungeon to fight monsters, collect loot, and unlock new creatures!
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowDungeonPrompt(false)}>
                Stay
              </Button>
              <Button className="flex-1 bg-gradient-to-r from-primary to-secondary" onClick={handleEnterDungeon}>
                Enter Dungeon
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
