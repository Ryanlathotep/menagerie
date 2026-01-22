import { GameProvider, useGame } from '@/game/state';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SPECIES_DATA, getComboId, UnlockedMonster, InventoryItem } from '@/game/types';
import { createMonster, calculateStats } from '@/game/utils';
import { generateDungeon, movePlayer, removeEnemy, LootItem } from '@/game/dungeon';
import { useEffect, useCallback, useState, useRef } from 'react';
import { MonsterSprite } from '@/game/sprites';
import { DungeonRenderer } from '@/game/DungeonRenderer';
import { GameSidebar } from '@/game/GameSidebar';
import { getMonsterMoves, Move, STRUGGLE_MOVE } from '@/game/moves';
import { MoveTooltip } from '@/game/BattleTooltip';
import { ShopView } from '@/game/ShopView';
import { executeCombat, calculateXpReward, xpToNextLevel, checkLevelUp, getEffectiveness } from '@/game/combat';
import { toast } from 'sonner';
import { Backpack, DoorOpen } from 'lucide-react';

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
  return <div className="game-container">
      <div className="text-center space-y-8">
        <h1 className="text-5xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
          Monster Roguelike
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

        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={handleResetSave}>
          Reset Save Data
        </Button>
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
        
        {/* Preview */}
        {selectedMonster && <Card className="p-4">
            <div className="flex items-center gap-4">
              <MonsterSprite species={selectedMonster.species} element={selectedMonster.element} classType={selectedMonster.classType} size={80} />
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
          </Card>}

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
  const dungeon = state.run?.dungeon;
  const [showShop, setShowShop] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!dungeon) {
      const newDungeon = generateDungeon(1);
      dispatch({
        type: 'SET_DUNGEON',
        dungeon: newDungeon
      });
    }
  }, [dungeon, dispatch]);

  // Scroll dungeon view to center on player
  useEffect(() => {
    if (dungeon && containerRef.current) {
      const tileSize = 28; // Match CSS
      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;
      const scrollX = dungeon.playerPosition.x * tileSize - containerWidth / 2 + tileSize / 2;
      const scrollY = dungeon.playerPosition.y * tileSize - containerHeight / 2 + tileSize / 2;
      containerRef.current.scrollTo({
        left: Math.max(0, scrollX),
        top: Math.max(0, scrollY),
        behavior: 'smooth'
      });
    }
  }, [dungeon?.playerPosition]);
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
  
  return <>
      <GameSidebar 
        monster={state.run?.currentMonster || null} 
        gold={state.run?.gold || 0} 
        floor={dungeon.floor} 
        onFlee={handleFlee} 
        onPanelChange={setMenuOpen}
      />
      
      {showShop && <ShopView gold={state.run?.gold || 0} onBuy={handleBuyItem} onClose={() => setShowShop(false)} />}
      
      <div className={`fixed inset-0 ${bottomOffset} overflow-hidden transition-all duration-300`}>
        <div className="h-full flex flex-col">
          {/* Scrollable dungeon viewport - fills available space */}
          <div ref={containerRef} className="flex-1 overflow-auto bg-card border-b-2 border-primary/20">
            <DungeonRenderer dungeon={dungeon} playerElement={state.run?.currentMonster.element || 'fire'} playerSpecies={state.run?.currentMonster.species} />
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
  const [experience, setExperience] = useState(0);
  const [showInventory, setShowInventory] = useState(false);
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
    if (item.effect === 'heal_hp' || item.effect === 'heal_30') {
      const healAmount = item.value || 30;
      const actualHeal = Math.min(healAmount, newStats.maxHp - newStats.currentHp);
      newStats.currentHp = Math.min(newStats.maxHp, newStats.currentHp + healAmount);
      message = `Restored ${actualHeal} HP!`;
    } else if (item.effect === 'heal_stamina' || item.effect === 'stamina_20') {
      const healAmount = item.value || 20;
      const actualHeal = Math.min(healAmount, (newStats.stamina || 50) - (newStats.currentStamina || 0));
      newStats.currentStamina = Math.min(newStats.stamina || 50, (newStats.currentStamina || 0) + healAmount);
      message = `Restored ${actualHeal} Stamina!`;
    } else if (item.effect === 'cure_poison') {
      message = 'Cured poison!';
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
    setShowInventory(false);

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
    const newEnemyHp = Math.max(0, battle.enemyMonster.stats.currentHp - result.damage);

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
        // Level up!
        const newStats = calculateStats(battle.playerMonster.species, battle.playerMonster.class, levelUpResult.newLevel);
        const leveledMonster = {
          ...battle.playerMonster,
          level: levelUpResult.newLevel,
          stats: {
            ...newStats,
            currentHp: newPlayerHp,
            currentStamina: newPlayerStamina
          }
        };
        dispatch({
          type: 'UPDATE_PLAYER_MONSTER',
          monster: leveledMonster
        });
        setExperience(levelUpResult.xpRemaining);
        toast.success(`🎉 Level Up! Now level ${levelUpResult.newLevel}!`);
      } else {
        setExperience(newXp);
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
      dispatch({
        type: 'ADD_GOLD',
        amount: 5 + battle.enemyMonster.level * 3
      });
    } else {
      // Enemy turn - use random enemy move
      const enemyMoves = getMonsterMoves(battle.enemyMonster.species, battle.enemyMonster.element, battle.enemyMonster.class);
      const enemyMove = enemyMoves[Math.floor(Math.random() * Math.min(3, enemyMoves.length))];
      const enemyResult = executeCombat(enemyMove, {
        ...battle.enemyMonster,
        stats: {
          ...battle.enemyMonster.stats,
          currentHp: newEnemyHp
        }
      }, battle.playerMonster);
      newPlayerHp = Math.max(0, newPlayerHp - enemyResult.damage);
      newLog.push(enemyResult.message);
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
              ...battle.enemyMonster,
              stats: {
                ...battle.enemyMonster.stats,
                currentHp: newEnemyHp
              }
            },
            playerMonster: {
              ...battle.playerMonster,
              stats: {
                ...battle.playerMonster.stats,
                currentHp: newPlayerHp,
                currentStamina: recoveredStamina
              }
            },
            log: newLog
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

  // Check if any move is affordable
  const canAffordAnyMove = playerMoves.some(m => (m.staminaCost || 0) <= currentStamina);

  // Moves to show - include struggle if out of stamina
  const availableMoves = canAffordAnyMove ? playerMoves : [...playerMoves, STRUGGLE_MOVE];
  const inventory = state.run.inventory || [];
  return <div className="fixed inset-0 flex flex-col" style={{
    height: 'calc(100vh - 180px)'
  }}>
      {/* Main battle area - fills available space */}
      <div className="flex-1 flex flex-col p-4 overflow-auto">
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
      </div>

      {/* Bottom action bar - fixed at bottom, full width like GameSidebar */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t-2 border-primary/20 shadow-lg z-50">
        {/* Battle log - above menu items */}
        <div className="bg-muted/50 border-b border-primary/10 p-3 text-sm max-h-32 overflow-y-auto my-0">
          <p className="text-xs text-muted-foreground mb-2 font-semibold">Battle Log</p>
          {battle.log.slice(-5).map((msg, i) => <p key={i} className="py-1 text-sm">{msg}</p>)}
        </div>
        
        {/* Expandable panel for inventory */}
        {showInventory && <div className="border-b border-primary/10 p-3">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-sm">Items</h3>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowInventory(false)}>✕</Button>
            </div>
            {inventory.length === 0 ? <p className="text-xs text-muted-foreground">No items in inventory</p> : <div className="flex gap-2 flex-wrap">
                {inventory.map((item, i) => <Button key={i} variant="outline" size="sm" className="text-xs" onClick={() => handleUseItem(item)}>
                    {item.name} x{item.quantity}
                  </Button>)}
              </div>}
          </div>}
        
        {/* Main bottom bar content */}
        <div className="p-4">
          {/* Moves header */}
          <h3 className="font-semibold text-base mb-3">Move Set</h3>
          {/* Moves grid + action buttons in one row */}
          <div className="grid grid-cols-[1fr_auto] gap-3 items-start">
            {/* Move selection - horizontal scroll */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {availableMoves.map(move => {
              const canAfford = (move.staminaCost || 0) <= currentStamina;
              return <MoveTooltip key={move.id} move={move} attacker={battle.playerMonster} defender={battle.enemyMonster}>
                    <Button variant={canAfford ? "outline" : "ghost"} className={`h-auto py-2 px-3 text-left flex-shrink-0 ${!canAfford && move.id !== 'struggle' ? 'opacity-50' : ''} ${move.id === 'struggle' ? 'border-destructive text-destructive' : ''}`} onClick={() => executeMove(move)} disabled={!canAfford && move.id !== 'struggle'}>
                      <div>
                        <p className="font-semibold text-xs">{move.name}</p>
                        <p className="text-[9px] opacity-70">
                          {getMoveEffectivenessIndicator(move)}
                          {move.power > 0 ? `⚔️${move.power} ` : ''} 
                          🎯{move.accuracy}% 
                          ⚡{move.staminaCost}
                          {move.type === 'heal' ? ' 💚' : ''}
                          {move.effect?.includes('stamina') ? ' ⚡+' : ''}
                        </p>
                      </div>
                    </Button>
                  </MoveTooltip>;
            })}
            </div>
            
            {/* Action buttons - right side */}
            <div className="flex gap-2 flex-shrink-0">
              <Button variant={showInventory ? "default" : "outline"} size="sm" onClick={() => setShowInventory(!showInventory)} className="flex items-center gap-1">
                <Backpack className="w-4 h-4" />
                <span className="hidden sm:inline">Items</span> ({inventory.length})
              </Button>
              <Button variant="destructive" size="sm" onClick={handleFlee} className="flex items-center gap-1">
                <DoorOpen className="w-4 h-4" />
                <span className="hidden sm:inline">Flee</span> ({Math.min(95, Math.max(5, 50 + (battle.playerMonster.stats.speed - battle.enemyMonster.stats.speed) * 2))}%)
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>;
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
  return <GameProvider>
      <Game />
    </GameProvider>;
}