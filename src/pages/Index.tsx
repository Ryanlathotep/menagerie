import { GameProvider, useGame } from '@/game/state';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SPECIES_DATA, getComboId, UnlockedMonster, InventoryItem, MonsterStats } from '@/game/types';
import { createMonster, calculateStats } from '@/game/utils';
import { generateDungeon, movePlayer, removeEnemy, LootItem, shouldStopAutoRun, LOOT_TABLE } from '@/game/dungeon';
import { useEffect, useCallback, useState, useRef } from 'react';
import { MonsterSprite } from '@/game/sprites';
import { DungeonRenderer } from '@/game/DungeonRenderer';
import { GameSidebar } from '@/game/GameSidebar';
import { getMonsterMoves, Move, STRUGGLE_MOVE } from '@/game/moves';
import { MoveTooltip } from '@/game/BattleTooltip';
import { ShopView } from '@/game/ShopView';
import { executeCombat, calculateXpReward, xpToNextLevel, checkLevelUp, getEffectiveness, hasPassive, checkSkeletonSurvival, applyMushroomRegen, checkImpSteal } from '@/game/combat';
import { toast } from 'sonner';
import { SettingsProvider, SettingsButton, useSettings } from '@/game/Settings';
import { MonsterStatsPreview } from '@/game/MonsterStatsPreview';
import { LevelUpScreen } from '@/game/LevelUpScreen';

// Main Menu Component
function MainMenu() {
  const {
    state,
    dispatch
  } = useGame();
  const handleResetSave = () => {
    if (confirm('Are you sure you want to reset all progress? This cannot be undone.')) {
      dispatch({
        type: 'RESET_SAVE'
      });
      toast.success('Save data reset!');
    }
  };
  return <div className="game-container text-7xl font-serif text-center">
      <div className="text-center space-y-8">
        <h1 className="text-7xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
          Menagerie
        </h1>
        <p className="text-muted-foreground text-lg">Play as the monsters. Unlock them all.</p>
        
        <div className="space-y-4">
          <Button size="lg" className="w-64 bg-gradient-to-r from-primary to-secondary hover:opacity-90" onClick={() => dispatch({
          type: 'SET_PHASE',
          phase: 'character_select'
        })}>
            ✨ Start Run
          </Button>
        </div>

        <div className="text-sm text-muted-foreground mt-8 space-y-1">
          <p>🔓 Unlocked: {state.saveData.unlockedMonsters?.length || 1} / 720 monsters</p>
          <p>🏔️ Highest Floor: {state.saveData.highestFloor}</p>
          <p>🎮 Total Runs: {state.saveData.totalRuns}</p>
        </div>

        <div className="flex gap-2 justify-center">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={handleResetSave}>
            Reset Save Data
          </Button>
          <SettingsButton />
        </div>
      </div>
    </div>;
}

// Character Select Component - Now uses unlocked monster combos
function CharacterSelect() {
  const {
    state,
    dispatch
  } = useGame();

  // Get all unlocked monsters (specific combos with levels)
  const unlockedMonsters = state.saveData.unlockedMonsters || [];
  const [selectedMonster, setSelectedMonster] = useState<typeof unlockedMonsters[0] | null>(unlockedMonsters.length > 0 ? unlockedMonsters[0] : null);
  const startRun = () => {
    if (!selectedMonster) return;
    // Create monster at the level it was unlocked at
    const monster = createMonster(selectedMonster.species, selectedMonster.classType, selectedMonster.element, selectedMonster.level);
    dispatch({
      type: 'START_RUN',
      monster
    });
  };
  return <div className="game-container">
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
              {unlockedMonsters.map(monster => <Card key={monster.comboId} className={`p-3 cursor-pointer transition-all ${selectedMonster?.comboId === monster.comboId ? 'ring-2 ring-primary bg-primary/10' : 'hover:border-primary/50'}`} onClick={() => setSelectedMonster(monster)}>
                  <div className="text-center">
                    <div className="flex justify-center mb-1">
                      <MonsterSprite species={monster.species} element={monster.element} classType={monster.classType} size={48} animated={false} />
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
                </Card>)}
            </div>
          </ScrollArea>
        </div>
        
        {/* Preview with Stats */}
        {selectedMonster && (
          <Card className="p-4">
            <div className="flex gap-4">
              {/* Left: Monster identity */}
              <div className="flex flex-col items-center gap-2">
                <MonsterSprite 
                  species={selectedMonster.species} 
                  element={selectedMonster.element} 
                  classType={selectedMonster.classType} 
                  size={100} 
                />
                <h3 className="font-bold text-lg capitalize text-center">
                  {selectedMonster.species}
                </h3>
                <div className="flex gap-1 flex-wrap justify-center">
                  <span className={`element-badge element-${selectedMonster.element} text-xs`}>
                    {selectedMonster.element}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-muted text-xs font-medium">
                    {selectedMonster.classType}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">
                  Level {selectedMonster.level}
                </span>
              </div>
              
              {/* Right: Stats and moves */}
              <div className="flex-1 min-w-0">
                <MonsterStatsPreview
                  species={selectedMonster.species}
                  classType={selectedMonster.classType}
                  element={selectedMonster.element}
                  level={selectedMonster.level}
                />
                
                {/* Type matchups - compact */}
                <div className="mt-3 p-2 bg-muted/50 rounded text-[10px] space-y-1">
                  <div>
                    <span className="font-medium">Class: </span>
                    {selectedMonster.classType === 'normal' && 'No strengths or weaknesses'}
                    {selectedMonster.classType === 'kinetic' && (
                      <><span className="text-green-600">Strong vs Energy/Bio</span> · <span className="text-red-500">Weak vs Chem/Pol</span></>
                    )}
                    {selectedMonster.classType === 'energy' && (
                      <><span className="text-green-600">Strong vs Bio/Chem</span> · <span className="text-red-500">Weak vs Pol/Kin</span></>
                    )}
                    {selectedMonster.classType === 'biological' && (
                      <><span className="text-green-600">Strong vs Chem/Pol</span> · <span className="text-red-500">Weak vs Kin/Energy</span></>
                    )}
                    {selectedMonster.classType === 'chemical' && (
                      <><span className="text-green-600">Strong vs Pol/Kin</span> · <span className="text-red-500">Weak vs Energy/Bio</span></>
                    )}
                    {selectedMonster.classType === 'political' && (
                      <><span className="text-green-600">Strong vs Kin/Energy</span> · <span className="text-red-500">Weak vs Bio/Chem</span></>
                    )}
                  </div>
                  <div>
                    <span className="font-medium">Element: </span>
                    {selectedMonster.element === 'normal' && 'No strengths or weaknesses'}
                    {selectedMonster.element === 'fire' && (
                      <><span className="text-green-600">Strong vs Air/Earth</span> · <span className="text-red-500">Weak vs Water/Void</span></>
                    )}
                    {selectedMonster.element === 'water' && (
                      <><span className="text-green-600">Strong vs Fire/Void</span> · <span className="text-red-500">Weak vs Earth/Air</span></>
                    )}
                    {selectedMonster.element === 'earth' && (
                      <><span className="text-green-600">Strong vs Water/Air</span> · <span className="text-red-500">Weak vs Fire/Void</span></>
                    )}
                    {selectedMonster.element === 'air' && (
                      <><span className="text-green-600">Strong vs Void/Water</span> · <span className="text-red-500">Weak vs Fire/Earth</span></>
                    )}
                    {selectedMonster.element === 'void' && (
                      <><span className="text-green-600">Strong vs Fire/Earth</span> · <span className="text-red-500">Weak vs Water/Air</span></>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => dispatch({
          type: 'SET_PHASE',
          phase: 'main_menu'
        })}>
            Back
          </Button>
          <Button className="flex-1 bg-gradient-to-r from-primary to-secondary" disabled={!selectedMonster} onClick={startRun}>
            Start Adventure! ✨
          </Button>
        </div>
      </div>
    </div>;
}

// Dungeon View Component with scrolling viewport
function DungeonView() {
  const {
    state,
    dispatch
  } = useGame();
  const { settings } = useSettings();
  const dungeon = state.run?.dungeon;
  const [showShop, setShowShop] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const autoRunDirection = useRef<'up' | 'down' | 'left' | 'right' | null>(null);
  const lastKeyPress = useRef<{ key: string; time: number } | null>(null);
  useEffect(() => {
    if (!dungeon) {
      const newDungeon = generateDungeon(1);
      dispatch({
        type: 'SET_DUNGEON',
        dungeon: newDungeon
      });
    }
  }, [dungeon, dispatch]);
  const handleMove = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (!dungeon || !state.run) return;
    const result = movePlayer(dungeon, direction);
    dispatch({
      type: 'SET_DUNGEON',
      dungeon: result.dungeon
    });
    if (result.encounter) {
      dispatch({
        type: 'START_BATTLE',
        enemy: result.encounter
      });
    } else if (result.treasure && result.loot) {
      if (result.loot.type === 'gold') {
        dispatch({
          type: 'ADD_GOLD',
          amount: result.loot.value
        });
        toast.success(`Found ${result.loot.value} gold!`);
      } else {
        // Add loot to real inventory
        const lootItem: InventoryItem = {
          id: result.loot.id,
          name: result.loot.name,
          type: result.loot.type,
          value: result.loot.value,
          effect: result.loot.effect,
          quantity: 1
        };
        dispatch({
          type: 'ADD_ITEM',
          item: lootItem
        });
        toast.success(`Found ${result.loot.name}!`);
      }
    } else if (result.stairs) {
      const newDungeon = generateDungeon(dungeon.floor + 1);
      dispatch({
        type: 'SET_DUNGEON',
        dungeon: newDungeon
      });
      toast.success(`Descended to Floor ${dungeon.floor + 1}!`);
    } else if (result.trap) {
      if (result.trap.type === 'spike' && result.trap.damage) {
        const newHp = Math.max(0, state.run.currentMonster.stats.currentHp - result.trap.damage);
        const updatedMonster = {
          ...state.run.currentMonster,
          stats: {
            ...state.run.currentMonster.stats,
            currentHp: newHp
          }
        };
        dispatch({
          type: 'UPDATE_PLAYER_MONSTER',
          monster: updatedMonster
        });
        toast.error(`Stepped on a spike trap! Took ${result.trap.damage} damage!`);
        if (newHp <= 0) {
          dispatch({
            type: 'END_RUN',
            victory: false
          });
          dispatch({
            type: 'SET_PHASE',
            phase: 'run_summary'
          });
        }
      } else if (result.trap.type === 'poison') {
        toast.error('Poisoned by a trap!');
        // Could add poison status effect here
      } else if (result.trap.type === 'alarm') {
        toast.error('Alarm trap! Enemies alerted!');
        // Could spawn additional enemies
      }
    } else if (result.water) {
      // Water hazard - Frogs are immune (Amphibious passive)
      const isFrog = state.run.currentMonster.species === 'frog';
      if (isFrog) {
        toast.success('Your Amphibious nature lets you swim through unharmed! 🐸');
      } else {
        const damage = result.water.damage;
        const newHp = Math.max(0, state.run.currentMonster.stats.currentHp - damage);
        const updatedMonster = {
          ...state.run.currentMonster,
          stats: {
            ...state.run.currentMonster.stats,
            currentHp: newHp
          }
        };
        dispatch({
          type: 'UPDATE_PLAYER_MONSTER',
          monster: updatedMonster
        });
        toast.error(`Waded through water! Took ${damage} damage! 🌊`);
        if (newHp <= 0) {
          dispatch({
            type: 'END_RUN',
            victory: false
          });
          dispatch({
            type: 'SET_PHASE',
            phase: 'run_summary'
          });
        }
      }
    } else if (result.shop) {
      setShowShop(true);
    }
  }, [dungeon, dispatch, state.run]);
  // Auto-run logic - runs in intervals when active
  useEffect(() => {
    if (!isAutoRunning || !autoRunDirection.current || !dungeon) return;
    
    const interval = setInterval(() => {
      if (!autoRunDirection.current || !dungeon) {
        setIsAutoRunning(false);
        return;
      }
      
      const direction = autoRunDirection.current;
      const dx = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
      const dy = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;
      const nextX = dungeon.playerPosition.x + dx;
      const nextY = dungeon.playerPosition.y + dy;
      
      // Check if we should stop before moving
      if (shouldStopAutoRun(dungeon.tiles, nextX, nextY, dungeon.width, dungeon.height)) {
        setIsAutoRunning(false);
        autoRunDirection.current = null;
        return;
      }
      
      handleMove(direction);
    }, settings.autoRunSpeed); // Use settings for speed
    
    return () => clearInterval(interval);
  }, [isAutoRunning, dungeon, handleMove, settings.autoRunSpeed]);

  // Keyboard input with double-tap detection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showShop) return;
      
      // If auto-running, any key stops it
      if (isAutoRunning) {
        setIsAutoRunning(false);
        autoRunDirection.current = null;
        return;
      }
      
      let direction: 'up' | 'down' | 'left' | 'right' | null = null;
      if (e.key === 'ArrowUp' || e.key === 'w') direction = 'up';
      if (e.key === 'ArrowDown' || e.key === 's') direction = 'down';
      if (e.key === 'ArrowLeft' || e.key === 'a') direction = 'left';
      if (e.key === 'ArrowRight' || e.key === 'd') direction = 'right';
      
      if (!direction) return;
      
      const now = Date.now();
      const lastPress = lastKeyPress.current;
      
      // Check for double-tap using settings delay
      if (lastPress && lastPress.key === e.key && now - lastPress.time < settings.autoRunDelay) {
        // Start auto-run
        autoRunDirection.current = direction;
        setIsAutoRunning(true);
        lastKeyPress.current = null;
        toast.success(`Auto-running ${direction}! Press any key to stop.`);
      } else {
        // Single press - normal move
        handleMove(direction);
        lastKeyPress.current = { key: e.key, time: now };
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleMove, showShop, isAutoRunning, settings.autoRunDelay]);
  const handleFlee = () => {
    dispatch({
      type: 'END_RUN',
      victory: false
    });
    dispatch({
      type: 'SET_PHASE',
      phase: 'run_summary'
    });
  };
  const handleBuyItem = (item: LootItem) => {
    const price = item.value * 1.5; // Shop markup
    if (state.run && state.run.gold >= price) {
      dispatch({
        type: 'ADD_GOLD',
        amount: -Math.floor(price)
      });
      const lootItem: InventoryItem = {
        id: item.id,
        name: item.name,
        type: item.type,
        value: item.value,
        effect: item.effect,
        quantity: 1
      };
      dispatch({
        type: 'ADD_ITEM',
        item: lootItem
      });
      toast.success(`Bought ${item.name}!`);
    }
  };
  if (!dungeon) return <div className="game-container">Loading...</div>;

  // Bottom offset: 64px for menu bar + 160px for controls + ~200px when panel is open
  const bottomOffset = menuOpen ? 'bottom-[420px]' : 'bottom-[224px]';
  const controlsOffset = menuOpen ? 'bottom-16' : 'bottom-0';
  const handleDropItem = (itemId: string) => {
    dispatch({
      type: 'DROP_ITEM',
      itemId
    });
    toast.success('Item dropped');
  };

  const handleUseItemOutOfCombat = (item: InventoryItem) => {
    if (!state.run) return;
    
    const monster = state.run.currentMonster;
    let message = '';
    let updatedMonster = { ...monster };
    
    if (item.effect === 'heal_hp') {
      const hpBefore = monster.stats.currentHp;
      const newHp = Math.min(monster.stats.maxHp, monster.stats.currentHp + (item.value || 0));
      const healed = newHp - hpBefore;
      if (healed <= 0) return toast.info('Already at full HP!');
      updatedMonster = {
        ...monster,
        stats: { ...monster.stats, currentHp: newHp }
      };
      message = `Restored ${healed} HP!`;
    } else if (item.effect === 'heal_full') {
      const hpBefore = monster.stats.currentHp;
      if (hpBefore >= monster.stats.maxHp) return toast.info('Already at full HP!');
      updatedMonster = {
        ...monster,
        stats: { ...monster.stats, currentHp: monster.stats.maxHp }
      };
      message = `Fully restored HP! (+${monster.stats.maxHp - hpBefore})`;
    } else if (item.effect === 'heal_stamina') {
      // Stamina restores outside combat - just inform user it will apply next battle
      message = `${item.name} will restore stamina in battle!`;
      toast.info(message);
      return; // Don't consume outside combat
    } else if (item.effect === 'cure_poison' || item.effect === 'cure_burn' || item.effect === 'cure_freeze' || item.effect === 'cure_all') {
      message = `Used ${item.name}!`;
    } else if (item.effect === 'boost_attack' || item.effect === 'boost_defense' || item.effect === 'boost_speed') {
      toast.info(`${item.name} can only be used in battle.`);
      return;
    } else {
      message = `Used ${item.name}!`;
    }
    
    dispatch({ type: 'UPDATE_PLAYER_MONSTER', monster: updatedMonster });
    dispatch({ type: 'USE_ITEM', itemId: item.id });
    toast.success(message);
  };

  return <>
      <GameSidebar monster={state.run?.currentMonster || null} gold={state.run?.gold || 0} floor={dungeon.floor} inventory={state.run?.inventory || []} moveOrder={state.run?.moveOrder || []} hiddenMoves={state.run?.hiddenMoves || []} experience={state.run?.experience || 0} experienceToNext={xpToNextLevel(state.run?.currentMonster?.level || 1)} onFlee={handleFlee} onDropItem={handleDropItem} onUseItem={handleUseItemOutOfCombat} onReorderMoves={order => dispatch({
      type: 'SET_MOVE_ORDER',
      order
    })} onToggleHideMove={moveId => dispatch({
      type: 'TOGGLE_HIDE_MOVE',
      moveId
    })} onPanelChange={setMenuOpen} />
      
      {showShop && <ShopView gold={state.run?.gold || 0} onBuy={handleBuyItem} onClose={() => setShowShop(false)} />}
      
      <div className={`fixed inset-0 ${bottomOffset} overflow-hidden transition-all duration-300`}>
        <div className="h-full flex flex-col">
          {/* Scrollable dungeon viewport - fills available space */}
          <div className="flex-1 overflow-hidden bg-card border-b-2 border-primary/20">
            <DungeonRenderer 
              dungeon={dungeon} 
              playerElement={state.run?.currentMonster.element || 'fire'} 
              playerSpecies={state.run?.currentMonster.species}
              playerDexterity={state.run?.currentMonster.stats.dodge || 10}
              zoom={settings.dungeonZoom}
              onDisarmTrap={(x, y, success) => {
                dispatch({ type: 'DISARM_TRAP', x, y, success });
                if (success) {
                  toast.success('Trap disarmed!');
                } else {
                  // Failed disarm triggers the trap
                  const tile = dungeon.tiles[y]?.[x];
                  if (tile?.trapType === 'spike') {
                    const damage = 10 + Math.floor(dungeon.floor * 2);
                    const newHp = Math.max(0, state.run!.currentMonster.stats.currentHp - damage);
                    dispatch({
                      type: 'UPDATE_PLAYER_MONSTER',
                      monster: {
                        ...state.run!.currentMonster,
                        stats: { ...state.run!.currentMonster.stats, currentHp: newHp }
                      }
                    });
                    toast.error(`Disarm failed! Triggered spike trap for ${damage} damage!`);
                    if (newHp <= 0) {
                      dispatch({ type: 'END_RUN', victory: false });
                      dispatch({ type: 'SET_PHASE', phase: 'run_summary' });
                    }
                  } else if (tile?.trapType === 'poison') {
                    toast.error('Disarm failed! You got poisoned!');
                  } else if (tile?.trapType === 'alarm') {
                    toast.error('Disarm failed! Alarm triggered!');
                  }
                }
              }}
            />
          </div>

          {/* Bottom bar with controls and legend */}
          <div className={`fixed ${controlsOffset} left-0 right-0 h-[160px] bg-card border-t-2 border-primary/20 p-4 z-40 transition-all duration-300`}>
            {/* Mobile controls */}
            <div className="grid grid-cols-3 gap-2 w-32 mx-auto sm:hidden mb-3">
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

            <p className="text-muted-foreground text-sm hidden sm:block text-center mb-2">Use WASD or Arrow keys to move</p>
            
            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground justify-center">
              <span>💎 Treasure</span>
              <span>⬇️ Stairs</span>
              <span>⚠️ Trap</span>
              <span>🏪 Shop</span>
            </div>
          </div>
        </div>
      </div>
    </>;
}

// Battle View Component with proper combat calculations
function BattleView() {
  const {
    state,
    dispatch
  } = useGame();
  const battle = state.run?.battle;
  const experience = state.run?.experience || 0;
  const [menuOpen, setMenuOpen] = useState(false);
  
  // Level up screen state
  const [levelUpData, setLevelUpData] = useState<{
    previousStats: MonsterStats;
    previousLevel: number;
    newMoves: Move[];
    monster: typeof battle.playerMonster;
  } | null>(null);
  
  if (!battle || !state.run) return null;
  const playerMoves = getMonsterMoves(battle.playerMonster.species, battle.playerMonster.element, battle.playerMonster.class);
  const experienceToNext = xpToNextLevel(battle.playerMonster.level);
  const currentStamina = battle.playerMonster.stats.currentStamina ?? battle.playerMonster.stats.stamina ?? 50;
  const maxStamina = battle.playerMonster.stats.stamina ?? 50;

  // Flee attempt based on speed comparison
  const handleFlee = () => {
    const playerSpeed = battle.playerMonster.stats.speed;
    const enemySpeed = battle.enemyMonster.stats.speed;
    const fleeChance = 50 + (playerSpeed - enemySpeed) * 2;
    const roll = Math.random() * 100;
    if (roll <= fleeChance) {
      toast.success('Got away safely!');
      dispatch({
        type: 'END_BATTLE',
        victory: false
      });
      // Don't end run, just return to dungeon without dying
      dispatch({
        type: 'SET_PHASE',
        phase: 'dungeon'
      });
    } else {
      // Failed to flee - enemy gets a free attack
      const enemyMoves = getMonsterMoves(battle.enemyMonster.species, battle.enemyMonster.element, battle.enemyMonster.class);
      const enemyMove = enemyMoves[Math.floor(Math.random() * Math.min(3, enemyMoves.length))];
      const enemyResult = executeCombat(enemyMove, battle.enemyMonster, battle.playerMonster);
      const newPlayerHp = Math.max(0, battle.playerMonster.stats.currentHp - enemyResult.damage);
      const newLog = [...battle.log, `Couldn't escape!`, enemyResult.message];
      if (newPlayerHp <= 0) {
        dispatch({
          type: 'END_BATTLE',
          victory: false
        });
        dispatch({
          type: 'END_RUN',
          victory: false
        });
      } else {
        dispatch({
          type: 'UPDATE_BATTLE',
          battle: {
            playerMonster: {
              ...battle.playerMonster,
              stats: {
                ...battle.playerMonster.stats,
                currentHp: newPlayerHp
              }
            },
            log: newLog
          }
        });
        toast.error("Couldn't escape!");
      }
    }
  };

  // Use item during battle
  const handleUseItem = (item: InventoryItem) => {
    let message = '';
    let newStats = {
      ...battle.playerMonster.stats
    };
    if (item.effect === 'heal_hp') {
      const healAmount = item.value || 30;
      const actualHeal = Math.min(healAmount, newStats.maxHp - newStats.currentHp);
      newStats.currentHp = Math.min(newStats.maxHp, newStats.currentHp + healAmount);
      message = `Restored ${actualHeal} HP!`;
    } else if (item.effect === 'heal_full') {
      const actualHeal = newStats.maxHp - newStats.currentHp;
      newStats.currentHp = newStats.maxHp;
      message = `Fully restored HP! (+${actualHeal})`;
    } else if (item.effect === 'heal_stamina') {
      const healAmount = item.value || 20;
      const actualHeal = Math.min(healAmount, (newStats.stamina || 50) - (newStats.currentStamina || 0));
      newStats.currentStamina = Math.min(newStats.stamina || 50, (newStats.currentStamina || 0) + healAmount);
      message = `Restored ${actualHeal} Stamina!`;
    } else if (item.effect === 'cure_poison') {
      message = 'Cured poison!';
    } else if (item.effect === 'boost_attack' || item.effect === 'boost_defense' || item.effect === 'boost_speed') {
      message = `${item.name} activated! Buff ready for next battle.`;
    } else {
      message = `Used ${item.name}!`;
    }
    dispatch({
      type: 'USE_ITEM',
      itemId: item.id
    });
    dispatch({
      type: 'UPDATE_BATTLE',
      battle: {
        playerMonster: {
          ...battle.playerMonster,
          stats: newStats
        },
        log: [...battle.log, message]
      }
    });
    toast.success(message);
    // Inventory panel will close automatically via GameSidebar

    // Enemy gets a turn after using item
    const enemyMoves = getMonsterMoves(battle.enemyMonster.species, battle.enemyMonster.element, battle.enemyMonster.class);
    const enemyMove = enemyMoves[Math.floor(Math.random() * Math.min(3, enemyMoves.length))];
    const enemyResult = executeCombat(enemyMove, battle.enemyMonster, {
      ...battle.playerMonster,
      stats: newStats
    });
    const newPlayerHp = Math.max(0, newStats.currentHp - enemyResult.damage);
    if (newPlayerHp <= 0) {
      dispatch({
        type: 'END_BATTLE',
        victory: false
      });
      dispatch({
        type: 'END_RUN',
        victory: false
      });
    } else {
      dispatch({
        type: 'UPDATE_BATTLE',
        battle: {
          playerMonster: {
            ...battle.playerMonster,
            stats: {
              ...newStats,
              currentHp: newPlayerHp
            }
          },
          log: [...battle.log, message, enemyResult.message]
        }
      });
    }
  };
  const executeMove = (move: Move) => {
    if (!state.run) return;

    // Check if player has enough stamina
    const staminaCost = move.staminaCost || 0;
    if (currentStamina < staminaCost) {
      toast.error('Not enough stamina!');
      return;
    }

    // Consume stamina
    let newPlayerStamina = currentStamina - staminaCost;

    // Handle special move effects
    let healAmount = 0;
    let staminaRecovery = 0;
    if (move.type === 'heal' && move.power > 0) {
      healAmount = move.power;
    }
    if (move.effect === 'heal_self' && move.power > 0) {
      // Drain attacks heal for portion of damage
      healAmount = Math.floor(move.power * 0.5);
    }
    if (move.effect === 'restore_stamina') {
      staminaRecovery = 15;
    }
    if (move.effect === 'restore_stamina_15') {
      staminaRecovery = 15;
    }
    if (move.effect === 'restore_stamina_20') {
      staminaRecovery = 20;
    }
    if (move.effect === 'restore_stamina_25') {
      staminaRecovery = 25;
    }
    if (move.effect === 'restore_stamina_30') {
      staminaRecovery = 30;
    }

    // Execute combat with proper calculations
    const result = executeCombat(move, battle.playerMonster, battle.enemyMonster);
    const newLog = [...battle.log, result.message];
    
    // Add passive ability message if triggered
    if (result.passiveTriggered) {
      newLog.push(result.passiveTriggered);
    }
    
    if (staminaCost > 0) {
      newLog.push(`Used ${staminaCost} stamina`);
    }

    // Apply heal if it's a heal move
    let newPlayerHp = battle.playerMonster.stats.currentHp;
    if (healAmount > 0 && move.type === 'heal') {
      const actualHeal = Math.min(healAmount, battle.playerMonster.stats.maxHp - newPlayerHp);
      newPlayerHp = Math.min(battle.playerMonster.stats.maxHp, newPlayerHp + healAmount);
      newLog.push(`Healed ${actualHeal} HP!`);
    }

    // Apply stamina recovery
    if (staminaRecovery > 0) {
      const actualRecovery = Math.min(staminaRecovery, maxStamina - newPlayerStamina);
      newPlayerStamina = Math.min(maxStamina, newPlayerStamina + staminaRecovery);
      newLog.push(`Recovered ${actualRecovery} stamina!`);
    }
    let newEnemyHp = Math.max(0, battle.enemyMonster.stats.currentHp - result.damage);
    let newEnemySpeed = battle.enemyMonster.stats.speed;
    let updatedEnemyMonster = { ...battle.enemyMonster };
    
    // Skeleton's Undead: 10% chance to survive fatal hit with 1 HP
    if (newEnemyHp <= 0 && checkSkeletonSurvival(battle.enemyMonster, result.damage)) {
      newEnemyHp = 1;
      newLog.push(`☠️ Undead will! ${battle.enemyMonster.name} refuses to fall!`);
    }
    
    // Jellyfish's Stinging Tendrils: Apply reflect damage to player
    if (result.reflectDamage && result.reflectDamage > 0) {
      newPlayerHp = Math.max(0, newPlayerHp - result.reflectDamage);
      newLog.push(`Took ${result.reflectDamage} reflect damage from stinging tendrils!`);
    }
    
    // Spider's Web Spinner: Slow enemy by 20%
    if (result.speedDebuff && result.speedDebuff > 0) {
      const speedReduction = Math.floor(newEnemySpeed * (result.speedDebuff / 100));
      newEnemySpeed = Math.max(1, newEnemySpeed - speedReduction);
      newLog.push(`🕸️ Web slows enemy! (-${speedReduction} speed)`);
    }
    
    // Imp's Mischievous: 15% chance to steal a stat boost
    const impSteal = checkImpSteal(battle.playerMonster);
    if (impSteal && result.hit) {
      const statBoost = 2;
      newLog.push(`😈 Mischievous! Stole enemy's ${impSteal.stat}!`);
      // Apply boost to player (tracked in monster stats update)
    }
    
    // Crow's Keen Eye: Attempt to steal enemy's item if they have one
    if (hasPassive(battle.playerMonster.species, 'keen_eye') && result.hit && updatedEnemyMonster.carriedItem) {
      if (Math.random() < 0.25) { // 25% steal chance on hit
        const stolenItem = updatedEnemyMonster.carriedItem;
        newLog.push(`🦅 Keen Eye! Stole ${stolenItem.name} from enemy!`);
        
        // Add stolen item to inventory
        if (stolenItem.type === 'gold') {
          dispatch({ type: 'ADD_GOLD', amount: stolenItem.value });
        } else {
          dispatch({
            type: 'ADD_ITEM',
            item: {
              id: stolenItem.id,
              name: stolenItem.name,
              type: stolenItem.type,
              value: stolenItem.value,
              effect: stolenItem.effect,
              quantity: 1,
            }
          });
        }
        
        // Remove item from enemy
        updatedEnemyMonster = { ...updatedEnemyMonster, carriedItem: undefined };
      }
    }
    
    // Chimera's Hybrid Nature: Gain resistance to element that hit it
    if (hasPassive(battle.enemyMonster.species, 'hybrid_nature') && result.elementHit && result.hit) {
      const currentResistances = updatedEnemyMonster.temporaryResistances || [];
      const existingRes = currentResistances.find(r => r.element === result.elementHit);
      if (!existingRes) {
        updatedEnemyMonster = {
          ...updatedEnemyMonster,
          temporaryResistances: [...currentResistances, { element: result.elementHit, turnsRemaining: 3 }]
        };
        newLog.push(`🦁 Chimera adapts! Gained ${result.elementHit} resistance!`);
      }
    }

    // Apply drain heal (after damage)
    if (move.effect === 'heal_self' && result.damage > 0) {
      const drainHeal = Math.floor(result.damage * 0.5);
      const actualDrainHeal = Math.min(drainHeal, battle.playerMonster.stats.maxHp - newPlayerHp);
      newPlayerHp = Math.min(battle.playerMonster.stats.maxHp, newPlayerHp + drainHeal);
      if (actualDrainHeal > 0) {
        newLog.push(`Drained ${actualDrainHeal} HP!`);
      }
    }
    if (newEnemyHp <= 0) {
      // Victory - unlock this specific monster combo with its level
      const comboId = getComboId({
        species: battle.enemyMonster.species,
        element: battle.enemyMonster.element,
        classType: battle.enemyMonster.class
      });

      // Unlock the full monster data with level
      const unlockedMonster: UnlockedMonster = {
        comboId,
        species: battle.enemyMonster.species,
        element: battle.enemyMonster.element,
        classType: battle.enemyMonster.class,
        level: battle.enemyMonster.level
      };
      dispatch({
        type: 'UNLOCK_MONSTER',
        monster: unlockedMonster
      });
      dispatch({
        type: 'UNLOCK_COMBO',
        comboId
      });
      dispatch({
        type: 'UNLOCK_SPECIES',
        species: battle.enemyMonster.species
      });
      toast.success(`Unlocked ${battle.enemyMonster.species} (Lv.${battle.enemyMonster.level})!`);

      // Award XP
      const xpGained = calculateXpReward(battle.enemyMonster.level, battle.playerMonster.level);
      const newXp = experience + xpGained;

      // Check for level up
      const levelUpResult = checkLevelUp(battle.playerMonster, newXp);
      if (levelUpResult.leveled) {
        // Level up! Store previous stats for comparison
        const previousStats = { ...battle.playerMonster.stats };
        const previousLevel = battle.playerMonster.level;
        
        const newStats = calculateStats(battle.playerMonster.species, battle.playerMonster.class, levelUpResult.newLevel);
        const leveledMonster = {
          ...battle.playerMonster,
          level: levelUpResult.newLevel,
          stats: {
            ...newStats,
            currentHp: Math.min(newPlayerHp + 10, newStats.maxHp), // Small HP boost on level up
            currentStamina: newStats.stamina // Full stamina restore on level up
          }
        };
        
        // Check for new moves (moves that require higher level - for now, all moves are available)
        const newMoves: Move[] = []; // Could implement level-gated moves in the future
        
        // Show level up screen
        setLevelUpData({
          previousStats,
          previousLevel,
          newMoves,
          monster: leveledMonster
        });
        
        dispatch({
          type: 'UPDATE_PLAYER_MONSTER',
          monster: leveledMonster
        });
        // Set XP to remainder after level up
        dispatch({ type: 'ADD_XP', amount: levelUpResult.xpRemaining - experience });
      } else {
        // Add XP to global state
        dispatch({ type: 'ADD_XP', amount: xpGained });
        // Update player monster with current HP/Stamina
        dispatch({
          type: 'UPDATE_PLAYER_MONSTER',
          monster: {
            ...battle.playerMonster,
            stats: {
              ...battle.playerMonster.stats,
              currentHp: newPlayerHp,
              currentStamina: newPlayerStamina
            }
          }
        });
      }
      toast.success(`+${xpGained} XP!`);
      if (state.run?.dungeon) {
        const updatedDungeon = removeEnemy(state.run.dungeon, battle.enemyMonster.id);
        dispatch({
          type: 'SET_DUNGEON',
          dungeon: updatedDungeon
        });
      }
      dispatch({
        type: 'END_BATTLE',
        victory: true
      });
      
      // Base gold reward
      const baseGold = 5 + battle.enemyMonster.level * 3;
      dispatch({
        type: 'ADD_GOLD',
        amount: baseGold
      });
      
      // Rat's Scavenger passive: Find extra items after battle
      const isRat = battle.playerMonster.species === 'rat';
      if (isRat && Math.random() < 0.5) { // 50% chance
        const extraLoot = LOOT_TABLE[Math.floor(Math.random() * LOOT_TABLE.length)];
        if (extraLoot.type === 'gold') {
          dispatch({
            type: 'ADD_GOLD',
            amount: extraLoot.value
          });
          toast.success(`🐀 Scavenger: Found ${extraLoot.value} extra gold!`);
        } else {
          const lootItem: InventoryItem = {
            id: extraLoot.id,
            name: extraLoot.name,
            type: extraLoot.type,
            value: extraLoot.value,
            effect: extraLoot.effect,
            quantity: 1
          };
          dispatch({
            type: 'ADD_ITEM',
            item: lootItem
          });
          toast.success(`🐀 Scavenger: Found a ${extraLoot.name}!`);
        }
      }
    } else {
      // Enemy turn - use random enemy move
      const enemyMoves = getMonsterMoves(updatedEnemyMonster.species, updatedEnemyMonster.element, updatedEnemyMonster.class);
      const enemyMove = enemyMoves[Math.floor(Math.random() * Math.min(3, enemyMoves.length))];
      
      // Use the updated enemy monster with potentially modified speed
      const attackingEnemy = {
        ...updatedEnemyMonster,
        stats: {
          ...updatedEnemyMonster.stats,
          currentHp: newEnemyHp,
          speed: newEnemySpeed,
        }
      };
      
      const enemyResult = executeCombat(enemyMove, attackingEnemy, battle.playerMonster);
      newPlayerHp = Math.max(0, newPlayerHp - enemyResult.damage);
      newLog.push(enemyResult.message);
      
      // Add passive ability message if triggered
      if (enemyResult.passiveTriggered) {
        newLog.push(enemyResult.passiveTriggered);
      }
      
      // Player's Skeleton survival: 10% chance to survive fatal hit
      if (newPlayerHp <= 0 && checkSkeletonSurvival(battle.playerMonster, enemyResult.damage)) {
        newPlayerHp = 1;
        newLog.push(`☠️ Undead will! You refuse to fall!`);
      }
      
      // Player's Jellyfish reflects damage back to enemy
      if (enemyResult.reflectDamage && enemyResult.reflectDamage > 0) {
        newEnemyHp = Math.max(0, newEnemyHp - enemyResult.reflectDamage);
        newLog.push(`Stinging tendrils reflect ${enemyResult.reflectDamage} damage back!`);
      }
      
      // Player's Chimera: Gain resistance to element that hit
      let updatedPlayerMonster = { ...battle.playerMonster };
      if (hasPassive(battle.playerMonster.species, 'hybrid_nature') && enemyResult.elementHit && enemyResult.hit) {
        const currentResistances = updatedPlayerMonster.temporaryResistances || [];
        const existingRes = currentResistances.find(r => r.element === enemyResult.elementHit);
        if (!existingRes) {
          updatedPlayerMonster = {
            ...updatedPlayerMonster,
            temporaryResistances: [...currentResistances, { element: enemyResult.elementHit, turnsRemaining: 3 }]
          };
          newLog.push(`🦁 You adapt! Gained ${enemyResult.elementHit} resistance!`);
        }
      }
      
      // Mushroom's Spore Cloud: Regenerate 5% HP at end of turn
      const mushroomRegen = applyMushroomRegen(battle.playerMonster);
      if (mushroomRegen > 0) {
        const actualRegen = Math.min(mushroomRegen, battle.playerMonster.stats.maxHp - newPlayerHp);
        newPlayerHp = Math.min(battle.playerMonster.stats.maxHp, newPlayerHp + mushroomRegen);
        newLog.push(`🍄 Spore Cloud: Regenerated ${actualRegen} HP!`);
      }
      
      // Enemy Mushroom regen
      const enemyMushroomRegen = applyMushroomRegen(updatedEnemyMonster);
      if (enemyMushroomRegen > 0 && newEnemyHp > 0) {
        const actualRegen = Math.min(enemyMushroomRegen, updatedEnemyMonster.stats.maxHp - newEnemyHp);
        newEnemyHp = Math.min(updatedEnemyMonster.stats.maxHp, newEnemyHp + enemyMushroomRegen);
        newLog.push(`🍄 Enemy regenerates ${actualRegen} HP!`);
      }
      
      // Decrement temporary resistances
      if (updatedPlayerMonster.temporaryResistances) {
        updatedPlayerMonster.temporaryResistances = updatedPlayerMonster.temporaryResistances
          .map(r => ({ ...r, turnsRemaining: r.turnsRemaining - 1 }))
          .filter(r => r.turnsRemaining > 0);
      }
      if (updatedEnemyMonster.temporaryResistances) {
        updatedEnemyMonster.temporaryResistances = updatedEnemyMonster.temporaryResistances
          .map(r => ({ ...r, turnsRemaining: r.turnsRemaining - 1 }))
          .filter(r => r.turnsRemaining > 0);
      }
      
      if (newPlayerHp <= 0) {
        dispatch({
          type: 'END_BATTLE',
          victory: false
        });
        dispatch({
          type: 'END_RUN',
          victory: false
        });
      } else {
        // Regenerate a bit of stamina each turn (2 stamina recovery)
        const recoveredStamina = Math.min(maxStamina, newPlayerStamina + 2);
        dispatch({
          type: 'UPDATE_BATTLE',
          battle: {
            enemyMonster: {
              ...updatedEnemyMonster,
              stats: {
                ...updatedEnemyMonster.stats,
                currentHp: newEnemyHp,
                speed: newEnemySpeed,
              },
              temporaryResistances: updatedEnemyMonster.temporaryResistances,
            },
            playerMonster: {
              ...updatedPlayerMonster,
              stats: {
                ...updatedPlayerMonster.stats,
                currentHp: newPlayerHp,
                currentStamina: recoveredStamina
              },
              temporaryResistances: updatedPlayerMonster.temporaryResistances,
            },
            log: newLog
          }
        });
      }
    }
  };

  // Get effectiveness indicator and aura class for each move
  const getMoveEffectiveness = (move: Move) => {
    const eff = getEffectiveness(move, battle.playerMonster, battle.enemyMonster);
    return {
      indicator: eff.overall === 'super-effective' ? '🔥' : eff.overall === 'effective' ? '✨' : eff.overall === 'weak' ? '⬇️' : '',
      auraClass: eff.overall === 'super-effective' 
        ? 'ring-2 ring-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.6)] animate-pulse' 
        : eff.overall === 'effective'
        ? 'ring-2 ring-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.5)]'
        : eff.overall === 'weak'
        ? 'opacity-60 border-muted'
        : '',
      overall: eff.overall
    };
  };

  // Apply user's move order and filter hidden moves
  const moveOrder = state.run?.moveOrder || [];
  const hiddenMoves = state.run?.hiddenMoves || [];
  
  const orderedMoves = [...playerMoves]
    .filter(move => !hiddenMoves.includes(move.id))
    .sort((a, b) => {
      const aIndex = moveOrder.indexOf(a.id);
      const bIndex = moveOrder.indexOf(b.id);
      // Moves not in order go to end, maintaining original order
      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });

  // Check if any VISIBLE move is affordable
  const canAffordAnyMove = orderedMoves.some(m => (m.staminaCost || 0) <= currentStamina);

  // Moves to show - include struggle if out of stamina for visible moves
  const availableMoves = canAffordAnyMove ? orderedMoves : [...orderedMoves, STRUGGLE_MOVE];
  const inventory = state.run.inventory || [];
  
  // Bottom offset based on menu state
  const bottomOffset = menuOpen ? 'pb-[280px]' : 'pb-[180px]';

  // Handle level up screen dismissal
  const handleLevelUpContinue = () => {
    setLevelUpData(null);
  };

  return (
    <>
      {/* Level up celebration screen */}
      {levelUpData && (
        <LevelUpScreen
          monster={levelUpData.monster}
          previousStats={levelUpData.previousStats}
          previousLevel={levelUpData.previousLevel}
          newMoves={levelUpData.newMoves}
          onContinue={handleLevelUpContinue}
        />
      )}
      
      <div className={`fixed inset-0 flex flex-col overflow-auto ${bottomOffset}`}>
        {/* Main battle area */}
        <div className="flex-1 flex flex-col p-4">
          {/* Header */}
          <h2 className="text-2xl font-bold text-center bg-gradient-to-r from-primary to-destructive bg-clip-text text-transparent mb-4">
            ⚔️ Battle!
          </h2>
        
        {/* Battle grid - enemy on left/top, player on right/bottom */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Enemy */}
          <Card className="p-4 flex flex-col">
            <div className="flex items-center gap-4 mb-3">
              <MonsterSprite species={battle.enemyMonster.species} element={battle.enemyMonster.element} classType={battle.enemyMonster.class} size={80} />
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-semibold text-lg">{battle.enemyMonster.name}</span>
                  <div className="flex gap-1">
                    <span className={`element-badge element-${battle.enemyMonster.element} text-xs`}>
                      {battle.enemyMonster.element}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted">
                      {battle.enemyMonster.class}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mb-2">Enemy • Lv.{battle.enemyMonster.level}</p>
                <div className="health-bar h-3">
                  <div className="health-bar-fill" style={{
                    width: `${battle.enemyMonster.stats.currentHp / battle.enemyMonster.stats.maxHp * 100}%`
                  }} />
                </div>
                <p className="text-sm mt-1 font-mono">{battle.enemyMonster.stats.currentHp} / {battle.enemyMonster.stats.maxHp} HP</p>
              </div>
            </div>
          </Card>

          {/* Player */}
          <Card className="p-4 border-2 border-primary/50 flex flex-col">
            <div className="flex items-center gap-4 mb-3">
              <MonsterSprite species={battle.playerMonster.species} element={battle.playerMonster.element} classType={battle.playerMonster.class} size={80} />
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-semibold text-lg">{battle.playerMonster.name}</span>
                  <span className={`element-badge element-${battle.playerMonster.element} text-xs`}>
                    {battle.playerMonster.element}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">You • Lv.{battle.playerMonster.level}</p>
                {/* HP Bar */}
                <div className="health-bar h-3">
                  <div className="health-bar-fill" style={{
                    width: `${battle.playerMonster.stats.currentHp / battle.playerMonster.stats.maxHp * 100}%`
                  }} />
                </div>
                <p className="text-sm mt-1 font-mono">{battle.playerMonster.stats.currentHp} / {battle.playerMonster.stats.maxHp} HP</p>
                {/* Stamina Bar */}
                <div className="h-3 bg-muted rounded-full overflow-hidden mt-2">
                  <div className="h-full bg-stat-special transition-all" style={{
                    width: `${currentStamina / maxStamina * 100}%`
                  }} />
                </div>
                <p className="text-sm mt-1 font-mono">{currentStamina} / {maxStamina} Stamina</p>
              </div>
            </div>
          </Card>
        </div>
        
        {/* Move selection area - above the sidebar */}
        <div className="mt-4 p-3 bg-card rounded-lg border-2 border-primary/20">
          <h3 className="font-semibold text-sm mb-2">Choose Your Move</h3>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {availableMoves.map(move => {
              const canAfford = (move.staminaCost || 0) <= currentStamina;
              const effectiveness = getMoveEffectiveness(move);
              return (
                <MoveTooltip key={move.id} move={move} attacker={battle.playerMonster} defender={battle.enemyMonster}>
                  <Button 
                    variant={canAfford ? "outline" : "ghost"} 
                    className={`h-auto py-2 px-3 text-left flex-shrink-0 transition-all ${!canAfford && move.id !== 'struggle' ? 'opacity-50' : ''} ${move.id === 'struggle' ? 'border-destructive text-destructive' : ''} ${canAfford ? effectiveness.auraClass : ''}`} 
                    onClick={() => executeMove(move)} 
                    disabled={!canAfford && move.id !== 'struggle'}
                  >
                    <div>
                      <p className="font-semibold text-xs">
                        {effectiveness.indicator && <span className="mr-1">{effectiveness.indicator}</span>}
                        {move.name}
                      </p>
                      <p className="text-[9px] opacity-70">
                        {move.power > 0 ? `⚔️${move.power} ` : ''} 
                        🎯{move.accuracy}% 
                        ⚡{move.staminaCost}
                        {move.type === 'heal' ? ' 💚' : ''}
                        {move.effect?.includes('stamina') ? ' ⚡+' : ''}
                      </p>
                    </div>
                  </Button>
                </MoveTooltip>
              );
            })}
          </div>
        </div>
      </div>

      {/* Unified GameSidebar for battle */}
      <GameSidebar 
        monster={battle.playerMonster}
        gold={state.run.gold}
        floor={state.run.dungeon?.floor || 1}
        inventory={inventory}
        moveOrder={state.run.moveOrder}
        hiddenMoves={state.run.hiddenMoves}
        onFlee={handleFlee}
        inBattle={true}
        experience={experience}
        experienceToNext={experienceToNext}
        battleLog={battle.log}
        onUseItem={handleUseItem}
        onPanelChange={setMenuOpen}
        expandedStats={{
          currentHp: battle.playerMonster.stats.currentHp,
          maxHp: battle.playerMonster.stats.maxHp,
          currentStamina,
          stamina: maxStamina,
          melee: battle.playerMonster.stats.attack,
          ranged: battle.playerMonster.stats.special,
          defense: battle.playerMonster.stats.defense,
          speed: battle.playerMonster.stats.speed,
          dodge: Math.floor(battle.playerMonster.stats.speed * 0.5),
        }}
        enemyMonster={battle.enemyMonster}
        enemyExpandedStats={{
          currentHp: battle.enemyMonster.stats.currentHp,
          maxHp: battle.enemyMonster.stats.maxHp,
          currentStamina: battle.enemyMonster.stats.currentStamina ?? battle.enemyMonster.stats.stamina ?? 50,
          stamina: battle.enemyMonster.stats.stamina ?? 50,
          melee: battle.enemyMonster.stats.attack,
          ranged: battle.enemyMonster.stats.special,
          defense: battle.enemyMonster.stats.defense,
          speed: battle.enemyMonster.stats.speed,
          dodge: Math.floor(battle.enemyMonster.stats.speed * 0.5),
        }}
      />
    </div>
    </>
  );
}

// Run Summary Component
function RunSummary() {
  const {
    state,
    dispatch
  } = useGame();
  return <div className="game-container">
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
        <Button className="w-full bg-gradient-to-r from-primary to-secondary" onClick={() => dispatch({
        type: 'SET_PHASE',
        phase: 'main_menu'
      })}>
          Return to Menu
        </Button>
      </Card>
    </div>;
}

// Game Component
function Game() {
  const {
    state
  } = useGame();
  switch (state.phase) {
    case 'main_menu':
      return <MainMenu />;
    case 'character_select':
      return <CharacterSelect />;
    case 'dungeon':
      return <DungeonView />;
    case 'battle':
      return <BattleView />;
    case 'defeat':
    case 'run_summary':
      return <RunSummary />;
    default:
      return <MainMenu />;
  }
}
export default function Index() {
  return (
    <SettingsProvider>
      <GameProvider>
        <Game />
      </GameProvider>
    </SettingsProvider>
  );
}