import { GameProvider, useGame } from '@/game/state';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SPECIES_DATA, SpeciesType, ClassType, ElementType, getComboId, UnlockedMonster } from '@/game/types';
import { createMonster, calculateStats } from '@/game/utils';
import { generateDungeon, movePlayer, removeEnemy, LootItem } from '@/game/dungeon';
import { useEffect, useCallback, useState, useRef } from 'react';
import { MonsterSprite } from '@/game/sprites';
import { DungeonRenderer } from '@/game/DungeonRenderer';
import { GameSidebar } from '@/game/GameSidebar';
import { getMonsterMoves, Move } from '@/game/moves';
import { MoveTooltip } from '@/game/BattleTooltip';
import { ShopView } from '@/game/ShopView';
import { 
  executeCombat, 
  calculateXpReward, 
  xpToNextLevel, 
  checkLevelUp,
  getEffectiveness 
} from '@/game/combat';
import { toast } from 'sonner';

// Main Menu Component
function MainMenu() {
  const { state, dispatch } = useGame();

  return (
    <div className="game-container">
      <div className="text-center space-y-8">
        <h1 className="text-5xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
          Monster Roguelike
        </h1>
        <p className="text-muted-foreground text-lg">Play as the monsters. Unlock them all.</p>
        
        <div className="space-y-4">
          <Button 
            size="lg" 
            className="w-64 bg-gradient-to-r from-primary to-secondary hover:opacity-90"
            onClick={() => dispatch({ type: 'SET_PHASE', phase: 'character_select' })}
          >
            ✨ Start Run
          </Button>
        </div>

        <div className="text-sm text-muted-foreground mt-8 space-y-1">
          <p>🔓 Unlocked: {state.saveData.unlockedMonsters?.length || 1} / 500 monsters</p>
          <p>🏔️ Highest Floor: {state.saveData.highestFloor}</p>
          <p>🎮 Total Runs: {state.saveData.totalRuns}</p>
        </div>
      </div>
    </div>
  );
}

// Character Select Component - Now uses unlocked monster combos
function CharacterSelect() {
  const { state, dispatch } = useGame();
  
  // Get all unlocked monsters (specific combos with levels)
  const unlockedMonsters = state.saveData.unlockedMonsters || [];
  
  const [selectedMonster, setSelectedMonster] = useState<typeof unlockedMonsters[0] | null>(
    unlockedMonsters.length > 0 ? unlockedMonsters[0] : null
  );

  const startRun = () => {
    if (!selectedMonster) return;
    // Create monster at the level it was unlocked at
    const monster = createMonster(
      selectedMonster.species, 
      selectedMonster.classType, 
      selectedMonster.element, 
      selectedMonster.level
    );
    dispatch({ type: 'START_RUN', monster });
  };

  return (
    <div className="game-container">
      <div className="space-y-6 max-w-4xl">
        <h2 className="text-3xl font-bold text-center bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          Choose Your Monster
        </h2>
        
        <p className="text-center text-muted-foreground text-sm">
          Defeat enemies to unlock them! Monsters are available at the level they were defeated.
        </p>
        
        {/* Unlocked monster selection */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">
            Unlocked Monsters ({unlockedMonsters.length})
          </h3>
          <ScrollArea className="h-48">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {unlockedMonsters.map((monster) => (
                <Card 
                  key={monster.comboId}
                  className={`p-3 cursor-pointer transition-all ${
                    selectedMonster?.comboId === monster.comboId 
                      ? 'ring-2 ring-primary bg-primary/10' 
                      : 'hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedMonster(monster)}
                >
                  <div className="text-center">
                    <div className="flex justify-center mb-1">
                      <MonsterSprite 
                        species={monster.species} 
                        element={monster.element} 
                        classType={monster.classType} 
                        size={48} 
                        animated={false} 
                      />
                    </div>
                    <p className="text-xs font-medium capitalize">{monster.species}</p>
                    <div className="flex gap-1 justify-center mt-1 flex-wrap">
                      <span className={`element-badge element-${monster.element} text-[10px] px-1 py-0`}>
                        {monster.element}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Lv.{monster.level} • {monster.classType}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>
        
        {/* Preview */}
        {selectedMonster && (
          <Card className="p-4">
            <div className="flex items-center gap-4">
              <MonsterSprite 
                species={selectedMonster.species} 
                element={selectedMonster.element} 
                classType={selectedMonster.classType} 
                size={80} 
              />
              <div className="flex-1">
                <h3 className="font-bold text-lg capitalize">
                  {selectedMonster.species}
                </h3>
                <p className="text-sm text-muted-foreground mb-2">
                  {SPECIES_DATA[selectedMonster.species].passiveDescription}
                </p>
                <div className="flex gap-2 flex-wrap items-center">
                  <span className={`element-badge element-${selectedMonster.element} text-xs`}>
                    {selectedMonster.element}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-muted text-xs font-medium">
                    {selectedMonster.classType}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Level {selectedMonster.level}
                  </span>
                </div>
                
                {/* Class type info tooltip */}
                <div className="mt-2 text-xs text-muted-foreground">
                  <span className="font-medium">Class Bonus: </span>
                  {selectedMonster.classType === 'kinetic' && 'Strong vs Energy & Biological'}
                  {selectedMonster.classType === 'energy' && 'Strong vs Biological & Chemical'}
                  {selectedMonster.classType === 'biological' && 'Strong vs Chemical & Political'}
                  {selectedMonster.classType === 'chemical' && 'Strong vs Political & Kinetic'}
                  {selectedMonster.classType === 'political' && 'Strong vs Kinetic & Energy'}
                </div>
              </div>
            </div>
          </Card>
        )}

        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={() => dispatch({ type: 'SET_PHASE', phase: 'main_menu' })}
          >
            Back
          </Button>
          <Button 
            className="flex-1 bg-gradient-to-r from-primary to-secondary"
            disabled={!selectedMonster}
            onClick={startRun}
          >
            Start Adventure! ✨
          </Button>
        </div>
      </div>
    </div>
  );
}

// Dungeon View Component with scrolling viewport
function DungeonView() {
  const { state, dispatch } = useGame();
  const dungeon = state.run?.dungeon;
  const [experience, setExperience] = useState(0);
  const [showShop, setShowShop] = useState(false);
  const [inventory, setInventory] = useState<LootItem[]>([]);
  const experienceToNext = xpToNextLevel(state.run?.currentMonster.level || 1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dungeon) {
      const newDungeon = generateDungeon(1);
      dispatch({ type: 'SET_DUNGEON', dungeon: newDungeon });
    }
  }, [dungeon, dispatch]);

  // Scroll dungeon view to center on player
  useEffect(() => {
    if (dungeon && containerRef.current) {
      const tileSize = 28; // Match CSS
      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;
      
      const scrollX = (dungeon.playerPosition.x * tileSize) - (containerWidth / 2) + (tileSize / 2);
      const scrollY = (dungeon.playerPosition.y * tileSize) - (containerHeight / 2) + (tileSize / 2);
      
      containerRef.current.scrollTo({
        left: Math.max(0, scrollX),
        top: Math.max(0, scrollY),
        behavior: 'smooth',
      });
    }
  }, [dungeon?.playerPosition]);

  const handleMove = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (!dungeon || !state.run) return;
    
    const result = movePlayer(dungeon, direction);
    dispatch({ type: 'SET_DUNGEON', dungeon: result.dungeon });

    if (result.encounter) {
      dispatch({ type: 'START_BATTLE', enemy: result.encounter });
    } else if (result.treasure && result.loot) {
      if (result.loot.type === 'gold') {
        dispatch({ type: 'ADD_GOLD', amount: result.loot.value });
        toast.success(`Found ${result.loot.value} gold!`);
      } else {
        setInventory(prev => [...prev, result.loot!]);
        toast.success(`Found ${result.loot.name}!`);
      }
    } else if (result.stairs) {
      const newDungeon = generateDungeon(dungeon.floor + 1);
      dispatch({ type: 'SET_DUNGEON', dungeon: newDungeon });
      toast.success(`Descended to Floor ${dungeon.floor + 1}!`);
    } else if (result.trap) {
      if (result.trap.type === 'spike' && result.trap.damage) {
        const newHp = Math.max(0, state.run.currentMonster.stats.currentHp - result.trap.damage);
        const updatedMonster = {
          ...state.run.currentMonster,
          stats: { ...state.run.currentMonster.stats, currentHp: newHp },
        };
        dispatch({ type: 'UPDATE_PLAYER_MONSTER', monster: updatedMonster });
        toast.error(`Stepped on a spike trap! Took ${result.trap.damage} damage!`);
        
        if (newHp <= 0) {
          dispatch({ type: 'END_RUN', victory: false });
          dispatch({ type: 'SET_PHASE', phase: 'run_summary' });
        }
      } else if (result.trap.type === 'poison') {
        toast.error('Poisoned by a trap!');
        // Could add poison status effect here
      } else if (result.trap.type === 'alarm') {
        toast.error('Alarm trap! Enemies alerted!');
        // Could spawn additional enemies
      }
    } else if (result.shop) {
      setShowShop(true);
    }
  }, [dungeon, dispatch, state.run]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showShop) return;
      if (e.key === 'ArrowUp' || e.key === 'w') handleMove('up');
      if (e.key === 'ArrowDown' || e.key === 's') handleMove('down');
      if (e.key === 'ArrowLeft' || e.key === 'a') handleMove('left');
      if (e.key === 'ArrowRight' || e.key === 'd') handleMove('right');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleMove, showShop]);

  const handleFlee = () => {
    dispatch({ type: 'END_RUN', victory: false });
    dispatch({ type: 'SET_PHASE', phase: 'run_summary' });
  };

  const handleBuyItem = (item: LootItem) => {
    const price = item.value * 1.5; // Shop markup
    if (state.run && state.run.gold >= price) {
      dispatch({ type: 'ADD_GOLD', amount: -Math.floor(price) });
      setInventory(prev => [...prev, item]);
      toast.success(`Bought ${item.name}!`);
    }
  };

  if (!dungeon) return <div className="game-container">Loading...</div>;

  return (
    <>
      <GameSidebar 
        monster={state.run?.currentMonster || null}
        gold={state.run?.gold || 0}
        floor={dungeon.floor}
        onFlee={handleFlee}
        experience={experience}
        experienceToNext={experienceToNext}
      />
      
      {showShop && (
        <ShopView 
          gold={state.run?.gold || 0}
          onBuy={handleBuyItem}
          onClose={() => setShowShop(false)}
        />
      )}
      
      <div className="game-container pl-20">
        <div className="flex flex-col items-center gap-4">
          {/* Scrollable dungeon viewport */}
          <div 
            ref={containerRef}
            className="w-full max-w-[600px] h-[400px] overflow-auto bg-card rounded-2xl p-4 border-2 border-primary/20 shadow-xl"
          >
            <DungeonRenderer 
              dungeon={dungeon} 
              playerElement={state.run?.currentMonster.element || 'fire'}
              playerSpecies={state.run?.currentMonster.species}
            />
          </div>

          {/* Mobile controls */}
          <div className="grid grid-cols-3 gap-2 w-32 sm:hidden">
            <div />
            <Button size="sm" onClick={() => handleMove('up')}>↑</Button>
            <div />
            <Button size="sm" onClick={() => handleMove('left')}>←</Button>
            <div />
            <Button size="sm" onClick={() => handleMove('right')}>→</Button>
            <div />
            <Button size="sm" onClick={() => handleMove('down')}>↓</Button>
            <div />
          </div>

          <p className="text-muted-foreground text-sm hidden sm:block">Use WASD or Arrow keys to move</p>
          
          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground justify-center">
            <span>💎 Treasure</span>
            <span>⬇️ Stairs</span>
            <span>⚠️ Trap</span>
            <span>🏪 Shop</span>
          </div>
        </div>
      </div>
    </>
  );
}

// Battle View Component with proper combat calculations
function BattleView() {
  const { state, dispatch } = useGame();
  const battle = state.run?.battle;
  const [experience, setExperience] = useState(0);

  if (!battle || !state.run) return null;

  const playerMoves = getMonsterMoves(
    battle.playerMonster.species,
    battle.playerMonster.element,
    battle.playerMonster.class
  );

  const experienceToNext = xpToNextLevel(battle.playerMonster.level);

  const executeMove = (move: Move) => {
    if (!state.run) return;
    
    // Execute combat with proper calculations
    const result = executeCombat(move, battle.playerMonster, battle.enemyMonster);
    const newLog = [...battle.log, result.message];
    
    const newEnemyHp = Math.max(0, battle.enemyMonster.stats.currentHp - result.damage);
    
    if (newEnemyHp <= 0) {
      // Victory - unlock this specific monster combo with its level
      const comboId = getComboId({
        species: battle.enemyMonster.species,
        element: battle.enemyMonster.element,
        classType: battle.enemyMonster.class,
      });
      
      // Unlock the full monster data with level
      const unlockedMonster: UnlockedMonster = {
        comboId,
        species: battle.enemyMonster.species,
        element: battle.enemyMonster.element,
        classType: battle.enemyMonster.class,
        level: battle.enemyMonster.level,
      };
      dispatch({ type: 'UNLOCK_MONSTER', monster: unlockedMonster });
      dispatch({ type: 'UNLOCK_COMBO', comboId });
      dispatch({ type: 'UNLOCK_SPECIES', species: battle.enemyMonster.species });
      
      toast.success(`Unlocked ${battle.enemyMonster.species} (Lv.${battle.enemyMonster.level})!`);
      
      // Award XP
      const xpGained = calculateXpReward(battle.enemyMonster.level, battle.playerMonster.level);
      const newXp = experience + xpGained;
      
      // Check for level up
      const levelUpResult = checkLevelUp(battle.playerMonster, newXp);
      
      if (levelUpResult.leveled) {
        // Level up!
        const newStats = calculateStats(
          battle.playerMonster.species,
          battle.playerMonster.class,
          levelUpResult.newLevel
        );
        const leveledMonster = {
          ...battle.playerMonster,
          level: levelUpResult.newLevel,
          stats: { ...newStats, currentHp: battle.playerMonster.stats.currentHp },
        };
        dispatch({ type: 'UPDATE_PLAYER_MONSTER', monster: leveledMonster });
        setExperience(levelUpResult.xpRemaining);
        toast.success(`🎉 Level Up! Now level ${levelUpResult.newLevel}!`);
      } else {
        setExperience(newXp);
      }
      
      toast.success(`+${xpGained} XP!`);
      
      if (state.run?.dungeon) {
        const updatedDungeon = removeEnemy(state.run.dungeon, battle.enemyMonster.id);
        dispatch({ type: 'SET_DUNGEON', dungeon: updatedDungeon });
      }
      dispatch({ type: 'END_BATTLE', victory: true });
      dispatch({ type: 'ADD_GOLD', amount: 5 + battle.enemyMonster.level * 3 });
    } else {
      // Enemy turn - use random enemy move
      const enemyMoves = getMonsterMoves(
        battle.enemyMonster.species,
        battle.enemyMonster.element,
        battle.enemyMonster.class
      );
      const enemyMove = enemyMoves[Math.floor(Math.random() * Math.min(3, enemyMoves.length))];
      
      const enemyResult = executeCombat(
        enemyMove,
        { ...battle.enemyMonster, stats: { ...battle.enemyMonster.stats, currentHp: newEnemyHp } },
        battle.playerMonster
      );
      
      const newPlayerHp = Math.max(0, battle.playerMonster.stats.currentHp - enemyResult.damage);
      newLog.push(enemyResult.message);
      
      if (newPlayerHp <= 0) {
        dispatch({ type: 'END_BATTLE', victory: false });
        dispatch({ type: 'END_RUN', victory: false });
      } else {
        dispatch({ 
          type: 'UPDATE_BATTLE', 
          battle: {
            enemyMonster: { ...battle.enemyMonster, stats: { ...battle.enemyMonster.stats, currentHp: newEnemyHp }},
            playerMonster: { ...battle.playerMonster, stats: { ...battle.playerMonster.stats, currentHp: newPlayerHp }},
            log: newLog,
          }
        });
      }
    }
  };

  // Get effectiveness indicator for each move
  const getMoveEffectivenessIndicator = (move: Move) => {
    const eff = getEffectiveness(move, battle.playerMonster, battle.enemyMonster);
    if (eff.overall === 'super') return '🔥';
    if (eff.overall === 'weak') return '⬇️';
    return '';
  };

  return (
    <>
      <GameSidebar 
        monster={state.run?.currentMonster || null}
        gold={state.run?.gold || 0}
        floor={state.run?.dungeon?.floor || 1}
        inBattle={true}
        experience={experience}
        experienceToNext={experienceToNext}
      />
      
      <div className="game-container pl-20">
        <div className="space-y-4 max-w-2xl w-full">
          <h2 className="text-2xl font-bold text-center bg-gradient-to-r from-primary to-destructive bg-clip-text text-transparent">
            ⚔️ Battle!
          </h2>
          
          {/* Enemy */}
          <Card className="p-4">
            <div className="flex items-center gap-4 mb-2">
              <MonsterSprite 
                species={battle.enemyMonster.species}
                element={battle.enemyMonster.element}
                classType={battle.enemyMonster.class}
                size={64}
              />
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-semibold">{battle.enemyMonster.name}</span>
                  <div className="flex gap-1">
                    <span className={`element-badge element-${battle.enemyMonster.element} text-xs`}>
                      {battle.enemyMonster.element}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted">
                      {battle.enemyMonster.class}
                    </span>
                  </div>
                </div>
                <div className="health-bar">
                  <div 
                    className="health-bar-fill" 
                    style={{ width: `${(battle.enemyMonster.stats.currentHp / battle.enemyMonster.stats.maxHp) * 100}%` }}
                  />
                </div>
                <p className="text-xs mt-1">{battle.enemyMonster.stats.currentHp} / {battle.enemyMonster.stats.maxHp}</p>
              </div>
            </div>
          </Card>

          {/* Player */}
          <Card className="p-4 border-2 border-primary/50">
            <div className="flex items-center gap-4 mb-2">
              <MonsterSprite 
                species={battle.playerMonster.species}
                element={battle.playerMonster.element}
                classType={battle.playerMonster.class}
                size={64}
              />
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-semibold">{battle.playerMonster.name}</span>
                  <span className={`element-badge element-${battle.playerMonster.element} text-xs`}>
                    {battle.playerMonster.element}
                  </span>
                </div>
                <div className="health-bar">
                  <div 
                    className="health-bar-fill" 
                    style={{ width: `${(battle.playerMonster.stats.currentHp / battle.playerMonster.stats.maxHp) * 100}%` }}
                  />
                </div>
                <p className="text-xs mt-1">{battle.playerMonster.stats.currentHp} / {battle.playerMonster.stats.maxHp}</p>
              </div>
            </div>
          </Card>

          {/* Move selection - ALL moves with tooltips */}
          <ScrollArea className="h-48">
            <div className="grid grid-cols-2 gap-2 pr-4">
              {playerMoves.map((move) => (
                <MoveTooltip 
                  key={move.id} 
                  move={move} 
                  attacker={battle.playerMonster} 
                  defender={battle.enemyMonster}
                >
                  <Button 
                    variant="outline"
                    className="h-auto py-2 px-3 text-left justify-start hover:bg-primary/10"
                    onClick={() => executeMove(move)}
                  >
                    <div className="w-full">
                      <div className="flex justify-between items-center">
                        <p className="font-semibold text-sm">{move.name}</p>
                        <span>{getMoveEffectivenessIndicator(move)}</span>
                      </div>
                      <p className="text-[10px] opacity-70">
                        {move.power > 0 ? `⚔️${move.power} ` : ''} 🎯{move.accuracy}% ⚡{move.staminaCost}
                      </p>
                    </div>
                  </Button>
                </MoveTooltip>
              ))}
            </div>
          </ScrollArea>

          {/* Battle log */}
          <div className="bg-muted rounded-lg p-3 text-xs max-h-24 overflow-y-auto">
            {battle.log.slice(-4).map((msg, i) => <p key={i}>{msg}</p>)}
          </div>
        </div>
      </div>
    </>
  );
}

// Run Summary Component
function RunSummary() {
  const { state, dispatch } = useGame();

  return (
    <div className="game-container">
      <Card className="p-8 text-center space-y-4 max-w-md">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-destructive bg-clip-text text-transparent">
          Run Over
        </h2>
        <div className="space-y-2 text-muted-foreground">
          <p>⚔️ Enemies Defeated: {state.run?.enemiesDefeated}</p>
          <p>🏔️ Floor Reached: {state.run?.dungeon?.floor || 1}</p>
          <p>💰 Gold Collected: {state.run?.gold}</p>
          <p>🔓 Monsters Unlocked: {state.saveData.unlockedCombos.length}</p>
        </div>
        <Button 
          className="w-full bg-gradient-to-r from-primary to-secondary"
          onClick={() => dispatch({ type: 'SET_PHASE', phase: 'main_menu' })}
        >
          Return to Menu
        </Button>
      </Card>
    </div>
  );
}

// Game Component
function Game() {
  const { state } = useGame();

  switch (state.phase) {
    case 'main_menu': return <MainMenu />;
    case 'character_select': return <CharacterSelect />;
    case 'dungeon': return <DungeonView />;
    case 'battle': return <BattleView />;
    case 'defeat':
    case 'run_summary': return <RunSummary />;
    default: return <MainMenu />;
  }
}

export default function Index() {
  return (
    <GameProvider>
      <Game />
    </GameProvider>
  );
}
