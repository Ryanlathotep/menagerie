import { GameProvider, useGame } from '@/game/state';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getComboId, UnlockedMonster, InventoryItem, MonsterStats, Monster, Position } from '@/game/types';
import { createMonster, calculateStats } from '@/game/utils';
import { generateDungeon, movePlayer, removeEnemy, LootItem, shouldStopAutoRun, LOOT_TABLE, generateLoot } from '@/game/dungeon';
import { useEffect, useCallback, useState, useRef } from 'react';
import { ScrollText } from 'lucide-react';
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
import { EquipmentItem, EquipmentSlot, MonsterEquipment } from '@/game/equipment';
import { EquipmentView } from '@/game/EquipmentView';
import { PreRunEquipment } from '@/game/PreRunEquipment';
import { 
  CombatEffects, 
  EMPTY_COMBAT_EFFECTS, 
  getMoveEffectResult, 
  applyStatusEffect, 
  applyStatModifier, 
  processStartOfTurn, 
  tickEffects,
  cureStatusEffect,
  cureAllStatusEffects,
  StatusEffectType,
} from '@/game/statusEffects';
import { StatusIcons } from '@/game/StatusEffectDisplay';
import { CraftingWorkshop } from '@/game/CraftingWorkshop';
import { CraftingRecipe, ConsumableRecipe } from '@/game/equipment';
import { findPath, getDirection } from '@/game/pathfinding';
import { PartyPanel } from '@/game/PartyPanel';
import { RecruitmentModal, calculateRecruitChance } from '@/game/RecruitmentModal';
import { PartySwitchModal } from '@/game/PartySwitchModal';
import { ReviveTargetModal } from '@/game/ReviveTargetModal';
import { CombatSwitchPanel } from '@/game/CombatSwitchPanel';
import { LogMessage, createLogMessage, parseLogMessage } from '@/game/GameLog';
import { TownShop } from '@/game/TownShop';

// Main Menu Component
function MainMenu() {
  const {
    state,
    dispatch
  } = useGame();
  const [showCrafting, setShowCrafting] = useState(false);
  const [showShop, setShowShop] = useState(false);
  
  const handleResetSave = () => {
    if (confirm('Are you sure you want to reset all progress? This cannot be undone.')) {
      dispatch({
        type: 'RESET_SAVE'
      });
      toast.success('Save data reset!');
    }
  };
  
  const handleCraft = (recipe: CraftingRecipe, result: import('@/game/equipment').EquipmentItem) => {
    // Deduct materials
    dispatch({
      type: 'USE_MATERIALS',
      materials: recipe.materials
    });
    // Store the crafted equipment
    dispatch({
      type: 'STORE_EQUIPMENT',
      item: result
    });
    toast.success(`Crafted ${result.name}!`);
  };
  
  const handleCraftConsumable = (recipe: ConsumableRecipe) => {
    // Deduct materials
    dispatch({
      type: 'USE_MATERIALS',
      materials: recipe.materials
    });
    // Create the consumable item and store it
    const consumableItem: InventoryItem = {
      id: recipe.resultId,
      name: recipe.name,
      type: 'potion',
      value: 0,
      effect: recipe.effect,
      quantity: 1,
    };
    dispatch({ type: 'STORE_ITEM', item: consumableItem });
    toast.success(`Brewed ${recipe.name}!`);
  };
  
  const handleDismantle = (itemId: string, materialsGained: { materialId: string; quantity: number }[]) => {
    dispatch({ type: 'DISMANTLE_EQUIPMENT', itemId });
    const materialNames = materialsGained.map(m => 
      `${m.quantity}x ${m.materialId.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')}`
    ).join(', ');
    toast.success(`Dismantled! Got ${materialNames}`);
  };
  
  const handleBuyItem = (item: InventoryItem, price: number) => {
    dispatch({ type: 'SPEND_TOWN_GOLD', amount: price });
    dispatch({ type: 'STORE_ITEM', item });
    toast.success(`Bought ${item.name}!`);
  };
  
  const handleBuyEquipment = (item: import('@/game/equipment').EquipmentItem, price: number) => {
    dispatch({ type: 'SPEND_TOWN_GOLD', amount: price });
    dispatch({ type: 'STORE_EQUIPMENT', item });
    toast.success(`Bought ${item.name}!`);
  };
  
  const handleSellEquipment = (itemId: string, price: number) => {
    dispatch({ type: 'SELL_EQUIPMENT', itemId, price });
    toast.success(`Sold for ${price} gold!`);
  };
  
  return (
    <div className="game-container text-7xl font-serif text-center">
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
          
          <div className="flex gap-2 justify-center">
            <Button 
              variant="outline" 
              className="w-32"
              onClick={() => setShowShop(true)}
            >
              🏪 Shop
            </Button>
            <Button 
              variant="outline" 
              className="w-32"
              onClick={() => setShowCrafting(true)}
            >
              🔨 Crafting
            </Button>
          </div>
        </div>

        <div className="text-sm text-muted-foreground mt-8 space-y-1">
          <p>💰 Gold: {state.saveData.gold || 0}</p>
          <p>🔓 Unlocked: {state.saveData.unlockedMonsters?.length || 1} / 720 monsters</p>
          <p>🏔️ Highest Floor: {state.saveData.highestFloor}</p>
          <p>🎮 Total Runs: {state.saveData.totalRuns}</p>
          <p>📦 Materials: {Object.keys(state.saveData.materials || {}).length} types</p>
          <p>🗃️ Stored Equipment: {state.saveData.storedEquipment?.length || 0} items</p>
          <p>🧪 Stored Consumables: {(state.saveData.storedItems || []).reduce((sum, item) => sum + (item.quantity || 1), 0)} items</p>
        </div>

        <div className="flex gap-2 justify-center">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={handleResetSave}>
            Reset Save Data
          </Button>
          <SettingsButton />
        </div>
      </div>
      
      {showShop && (
        <TownShop
          gold={state.saveData.gold || 0}
          storedEquipment={state.saveData.storedEquipment || []}
          onBuyItem={handleBuyItem}
          onBuyEquipment={handleBuyEquipment}
          onSellEquipment={handleSellEquipment}
          onClose={() => setShowShop(false)}
        />
      )}
      
      {showCrafting && (
        <CraftingWorkshop
          materials={state.saveData.materials || {}}
          playerLevel={1}
          storedEquipment={state.saveData.storedEquipment || []}
          unlockedRecipes={state.saveData.unlockedRecipes || []}
          onCraft={handleCraft}
          onCraftConsumable={handleCraftConsumable}
          onDismantle={handleDismantle}
          onClose={() => setShowCrafting(false)}
        />
      )}
    </div>
  );
}

// Character Select Component - Now uses unlocked monster combos
type SortOption = 'recent' | 'species' | 'element' | 'class' | 'level';

function CharacterSelect() {
  const {
    state,
    dispatch
  } = useGame();

  // Get all unlocked monsters (specific combos with levels)
  const unlockedMonsters = state.saveData.unlockedMonsters || [];
  const [selectedMonster, setSelectedMonster] = useState<typeof unlockedMonsters[0] | null>(unlockedMonsters.length > 0 ? unlockedMonsters[0] : null);
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [showEquipmentSelect, setShowEquipmentSelect] = useState(false);
  const [monsterForRun, setMonsterForRun] = useState<ReturnType<typeof createMonster> | null>(null);
  
  // Sort monsters based on selected option
  const sortedMonsters = [...unlockedMonsters].sort((a, b) => {
    switch (sortBy) {
      case 'species':
        return a.species.localeCompare(b.species);
      case 'element':
        return a.element.localeCompare(b.element);
      case 'class':
        return a.classType.localeCompare(b.classType);
      case 'level':
        return b.level - a.level; // Highest first
      case 'recent':
      default:
        // Recent = reverse order (last added first)
        return unlockedMonsters.indexOf(b) - unlockedMonsters.indexOf(a);
    }
  });
  
  const proceedToEquipment = () => {
    if (!selectedMonster) return;
    // Create monster at the level it was unlocked at
    const monster = createMonster(selectedMonster.species, selectedMonster.classType, selectedMonster.element, selectedMonster.level);
    setMonsterForRun(monster);
    setShowEquipmentSelect(true);
  };
  
  const startRun = (equipment: MonsterEquipment, withdrawnIds: string[], selectedItems: import('@/game/types').InventoryItem[]) => {
    if (!monsterForRun) return;
    dispatch({
      type: 'START_RUN',
      monster: monsterForRun,
      preEquipped: equipment,
      withdrawnIds,
      preSelectedItems: selectedItems,
    });
  };
  
  // Show equipment selection screen
  if (showEquipmentSelect && monsterForRun) {
    return (
      <PreRunEquipment
        monster={monsterForRun}
        storedEquipment={state.saveData.storedEquipment || []}
        storedItems={state.saveData.storedItems || []}
        onStart={startRun}
        onBack={() => setShowEquipmentSelect(false)}
      />
    );
  }
  return <div className="min-h-screen w-full bg-background flex flex-col p-4">
      <div className="flex-1 flex flex-col w-full max-w-7xl mx-auto space-y-4">
        <h2 className="text-3xl font-bold text-center bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          Choose Your Monster
        </h2>
        
        <p className="text-center text-muted-foreground text-sm">
          Defeat enemies to unlock them! Monsters are available at the level they were defeated.
        </p>

        {/* Preview with Stats - Moved to top */}
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
        
        {/* Unlocked monster selection */}
        <div className="flex flex-col min-h-0 max-h-[40vh] overflow-hidden">
          <div className="flex items-center justify-between mb-2 flex-shrink-0">
            <h3 className="text-sm font-semibold text-muted-foreground">
              Unlocked Monsters ({unlockedMonsters.length})
            </h3>
            
            {/* Sort controls */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground mr-1">Sort:</span>
              {(['recent', 'species', 'element', 'class', 'level'] as SortOption[]).map(option => (
                <Button
                  key={option}
                  variant={sortBy === option ? 'default' : 'ghost'}
                  size="sm"
                  className="h-6 px-2 text-xs capitalize"
                  onClick={() => setSortBy(option)}
                >
                  {option === 'recent' ? '🕐' : option === 'species' ? '🐾' : option === 'element' ? '🔥' : option === 'class' ? '⚔️' : '📈'}
                  <span className="ml-1 hidden sm:inline">{option}</span>
                </Button>
              ))}
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto scrollbar-none">
            <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2">
              {sortedMonsters.map(monster => <Card key={monster.comboId} className={`p-2 cursor-pointer transition-all ${selectedMonster?.comboId === monster.comboId ? 'ring-2 ring-primary bg-primary/10' : 'hover:border-primary/50'}`} onClick={() => setSelectedMonster(monster)}>
                  <div className="text-center">
                    <div className="flex justify-center mb-1">
                      <MonsterSprite species={monster.species} element={monster.element} classType={monster.classType} size={40} animated={false} />
                    </div>
                    <p className="text-[10px] font-medium capitalize truncate">{monster.species}</p>
                    <div className="flex gap-0.5 justify-center mt-0.5 flex-wrap">
                      <span className={`element-badge element-${monster.element} text-[8px] px-1 py-0`}>
                        {monster.element}
                      </span>
                    </div>
                    <p className="text-[8px] text-muted-foreground mt-0.5">
                      Lv.{monster.level} • {monster.classType}
                    </p>
                  </div>
                </Card>)}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => dispatch({
          type: 'SET_PHASE',
          phase: 'main_menu'
        })}>
            Back
          </Button>
          <Button className="flex-1 bg-gradient-to-r from-primary to-secondary" disabled={!selectedMonster} onClick={proceedToEquipment}>
            {state.saveData.storedEquipment?.length > 0 ? 'Select Equipment →' : 'Start Adventure! ✨'}
          </Button>
        </div>
      </div>
    </div>;
}

// Dungeon View Component with scrolling viewport
function DungeonView({
  gameLog,
  addLog,
}: {
  gameLog: LogMessage[];
  addLog: (text: string, type?: LogMessage['type']) => void;
}) {
  const {
    state,
    dispatch
  } = useGame();
  const { settings } = useSettings();
  const dungeon = state.run?.dungeon;
  const [showShop, setShowShop] = useState(false);
  const [showEquipment, setShowEquipment] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const autoRunDirection = useRef<'up' | 'down' | 'left' | 'right' | null>(null);
  const lastKeyPress = useRef<{ key: string; time: number } | null>(null);
  
  // Click-to-move state
  const [targetPath, setTargetPath] = useState<Position[]>([]);
  const [isPathWalking, setIsPathWalking] = useState(false);
  const pathWalkRef = useRef<Position[]>([]);
  
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
    
    // If not blocked, apply minor HP and Stamina regeneration to ALL conscious party members
    if (!result.blocked) {
      // Regenerate active monster
      const monster = state.run.currentMonster;
      const maxHp = monster.stats.maxHp;
      const maxStamina = monster.stats.stamina ?? 50;
      const currentHp = monster.stats.currentHp;
      const currentStamina = monster.stats.currentStamina ?? maxStamina;
      
      const regenHp = Math.min(1, maxHp - currentHp);
      const regenStamina = Math.min(1, maxStamina - currentStamina);
      
      if (regenHp > 0 || regenStamina > 0) {
        dispatch({
          type: 'UPDATE_PLAYER_MONSTER',
          monster: {
            ...monster,
            stats: {
              ...monster.stats,
              currentHp: currentHp + regenHp,
              currentStamina: currentStamina + regenStamina,
            }
          }
        });
      }
      
      // Regenerate all conscious inactive party members
      if (state.run.party && state.run.party.length > 0) {
        state.run.party.forEach((member, index) => {
          if (index === state.run!.activePartyIndex) return; // Skip active (already handled)
          if (member.stats.currentHp <= 0) return; // Skip fainted members
          
          const memberMaxHp = member.stats.maxHp;
          const memberMaxStamina = member.stats.stamina ?? 50;
          const memberCurrentHp = member.stats.currentHp;
          const memberCurrentStamina = member.stats.currentStamina ?? memberMaxStamina;
          
          const memberRegenHp = Math.min(1, memberMaxHp - memberCurrentHp);
          const memberRegenStamina = Math.min(1, memberMaxStamina - memberCurrentStamina);
          
          if (memberRegenHp > 0 || memberRegenStamina > 0) {
            dispatch({
              type: 'UPDATE_PARTY_MONSTER',
              index,
              monster: {
                ...member,
                stats: {
                  ...member.stats,
                  currentHp: memberCurrentHp + memberRegenHp,
                  currentStamina: memberCurrentStamina + memberRegenStamina,
                }
              }
            });
          }
        });
      }
    }
    
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
      // Handle different loot types
      if (result.loot.type === 'gold') {
        dispatch({
          type: 'ADD_GOLD',
          amount: result.loot.value
        });
        addLog(`💰 Found ${result.loot.value} gold!`, 'loot');
      } else if (result.loot.type === 'equipment' && result.loot.equipmentData) {
        dispatch({
          type: 'ADD_EQUIPMENT',
          item: result.loot.equipmentData
        });
        addLog(`⚔️ Found ${result.loot.name}!`, 'loot');
      } else if (result.loot.type === 'material' && result.loot.materialData) {
        dispatch({
          type: 'ADD_MATERIAL',
          materialId: result.loot.materialData.id,
          quantity: 1
        });
        addLog(`💎 Found ${result.loot.name}!`, 'loot');
      } else {
        // Regular consumables
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
        addLog(`📦 Found ${result.loot.name}!`, 'loot');
      }
    } else if (result.stairs) {
      const newDungeon = generateDungeon(dungeon.floor + 1);
      dispatch({
        type: 'SET_DUNGEON',
        dungeon: newDungeon
      });
      addLog(`⬇️ Descended to Floor ${dungeon.floor + 1}!`, 'system');
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
        addLog(`⚠️ Spike trap! Took ${result.trap.damage} damage!`, 'damage');
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
        addLog('☠️ Poisoned by a trap!', 'status');
      } else if (result.trap.type === 'alarm') {
        addLog('🔔 Alarm trap! Enemies alerted!', 'status');
      }
    } else if (result.water) {
      const isFrog = state.run.currentMonster.species === 'frog';
      if (isFrog) {
        addLog('🐸 Amphibious nature lets you swim unharmed!', 'system');
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
        addLog(`🌊 Waded through water! Took ${damage} damage!`, 'damage');
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
    } else if (result.plant) {
      // Harvest plant - add material to run materials
      dispatch({
        type: 'ADD_MATERIAL',
        materialId: result.plant.materialId,
        quantity: 1
      });
      addLog(`🌿 Harvested ${result.plant.plantType.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')}!`, 'loot');
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
      
      // If auto-running or path-walking, any key stops it
      if (isAutoRunning) {
        setIsAutoRunning(false);
        autoRunDirection.current = null;
        return;
      }
      
      if (isPathWalking) {
        setIsPathWalking(false);
        setTargetPath([]);
        pathWalkRef.current = [];
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
        addLog(`🏃 Auto-running ${direction}! Press any key to stop.`, 'system');
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
  }, [handleMove, showShop, isAutoRunning, isPathWalking, settings.autoRunDelay]);
  const handleFlee = () => {
    dispatch({
      type: 'FLEE_DUNGEON'
    });
    dispatch({
      type: 'SET_PHASE',
      phase: 'run_summary'
    });
    addLog('🚪 Escaped safely! Materials and equipment kept.', 'system');
  };
  
  // Click-to-move handler
  const handleTileClick = useCallback((x: number, y: number) => {
    if (!dungeon || isPathWalking || isAutoRunning) return;
    
    // Don't path to current position
    if (dungeon.playerPosition.x === x && dungeon.playerPosition.y === y) return;
    
    const path = findPath(dungeon, dungeon.playerPosition, { x, y });
    if (path && path.length > 0) {
      setTargetPath(path);
      pathWalkRef.current = path;
      setIsPathWalking(true);
    } else {
      addLog("❌ Can't reach that tile!", 'info');
    }
  }, [dungeon, isPathWalking, isAutoRunning]);
  
  // Path walking effect - walk one step at a time
  useEffect(() => {
    if (!isPathWalking || pathWalkRef.current.length === 0 || !dungeon) {
      setIsPathWalking(false);
      setTargetPath([]);
      return;
    }
    
    const walkInterval = setInterval(() => {
      const currentPath = pathWalkRef.current;
      if (currentPath.length === 0) {
        setIsPathWalking(false);
        setTargetPath([]);
        return;
      }
      
      const nextPos = currentPath[0];
      const direction = getDirection(dungeon.playerPosition, nextPos);
      
      if (!direction) {
        setIsPathWalking(false);
        setTargetPath([]);
        pathWalkRef.current = [];
        return;
      }
      
      // Check if we should stop (enemy, trap, etc.)
      if (shouldStopAutoRun(dungeon.tiles, nextPos.x, nextPos.y, dungeon.width, dungeon.height)) {
        // Still move to this tile, but stop after
        handleMove(direction);
        setIsPathWalking(false);
        setTargetPath([]);
        pathWalkRef.current = [];
        return;
      }
      
      handleMove(direction);
      pathWalkRef.current = currentPath.slice(1);
      setTargetPath(pathWalkRef.current);
    }, settings.autoRunSpeed);
    
    return () => clearInterval(walkInterval);
  }, [isPathWalking, dungeon, handleMove, settings.autoRunSpeed]);
  
  // Party switch handler
  const handlePartySwitch = useCallback((index: number) => {
    dispatch({ type: 'SWITCH_ACTIVE_MONSTER', index });
    addLog(`🔄 Switched to ${state.run?.party[index]?.species}!`, 'system');
  }, [dispatch, state.run?.party]);
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
      addLog(`🛒 Bought ${item.name}!`, 'loot');
    }
  };
  
  const handleBuyEquipment = (item: EquipmentItem, price: number) => {
    if (state.run && state.run.gold >= price) {
      dispatch({
        type: 'ADD_GOLD',
        amount: -price
      });
      dispatch({
        type: 'ADD_EQUIPMENT',
        item
      });
      addLog(`🛒 Bought ${item.name}!`, 'loot');
    }
  };
  if (!dungeon) return <div className="game-container">Loading...</div>;

  // Bottom offset: 64px for menu bar + 260px for controls + ~200px when panel is open
  const bottomOffset = menuOpen ? 'bottom-[520px]' : 'bottom-[324px]';
  const controlsOffset = menuOpen ? 'bottom-16' : 'bottom-0';
  const handleDropItem = (itemId: string) => {
    dispatch({
      type: 'DROP_ITEM',
      itemId
    });
    addLog('🗑️ Item dropped', 'info');
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
      if (healed <= 0) {
        addLog('❤️ Already at full HP!', 'info');
        return;
      }
      updatedMonster = {
        ...monster,
        stats: { ...monster.stats, currentHp: newHp }
      };
      message = `Restored ${healed} HP!`;
    } else if (item.effect === 'heal_full') {
      const hpBefore = monster.stats.currentHp;
      if (hpBefore >= monster.stats.maxHp) {
        addLog('❤️ Already at full HP!', 'info');
        return;
      }
      updatedMonster = {
        ...monster,
        stats: { ...monster.stats, currentHp: monster.stats.maxHp }
      };
      message = `Fully restored HP! (+${monster.stats.maxHp - hpBefore})`;
    } else if (item.effect === 'heal_stamina') {
      const maxStamina = monster.stats.stamina ?? 50;
      const staminaBefore = monster.stats.currentStamina ?? maxStamina;
      const newStamina = Math.min(maxStamina, staminaBefore + (item.value || 0));
      const restored = newStamina - staminaBefore;
      if (restored <= 0) {
        addLog('⚡ Already at full stamina!', 'info');
        return;
      }
      updatedMonster = {
        ...monster,
        stats: { ...monster.stats, currentStamina: newStamina }
      };
      message = `Restored ${restored} Stamina!`;
    } else if (item.effect === 'cure_poison' || item.effect === 'cure_burn' || item.effect === 'cure_freeze' || item.effect === 'cure_all') {
      message = `Used ${item.name}!`;
    } else if (item.effect === 'boost_attack' || item.effect === 'boost_defense' || item.effect === 'boost_speed') {
      addLog(`⚔️ ${item.name} can only be used in battle.`, 'info');
      return;
    } else {
      message = `Used ${item.name}!`;
    }
    
    dispatch({ type: 'UPDATE_PLAYER_MONSTER', monster: updatedMonster });
    dispatch({ type: 'USE_ITEM', itemId: item.id });
    addLog(`✨ ${message}`, 'heal');
  };

  return <>
      <GameSidebar 
        monster={state.run?.currentMonster || null} 
        gold={state.run?.gold || 0} 
        floor={dungeon.floor} 
        inventory={state.run?.inventory || []} 
        equipmentInventory={state.run?.equipmentInventory || []}
        equipment={state.run?.partyEquipment?.[state.run?.activePartyIndex || 0]}
        runMaterials={state.run?.runMaterials || {}}
        moveOrder={state.run?.moveOrder || []} 
        hiddenMoves={state.run?.hiddenMoves || []} 
        experience={state.run?.experience || 0} 
        experienceToNext={xpToNextLevel(state.run?.currentMonster?.level || 1)} 
        onFlee={handleFlee} 
        onDropItem={handleDropItem} 
        onUseItem={handleUseItemOutOfCombat} 
        onReorderMoves={order => dispatch({ type: 'SET_MOVE_ORDER', order })} 
        onToggleHideMove={moveId => dispatch({ type: 'TOGGLE_HIDE_MOVE', moveId })}
        onOpenEquipment={() => setShowEquipment(true)}
        onPanelChange={setMenuOpen}
        party={state.run?.party || []}
        activePartyIndex={state.run?.activePartyIndex || 0}
        onPartySwitch={handlePartySwitch}
        expandedStats={state.run?.currentMonster ? {
          currentHp: state.run.currentMonster.stats.currentHp,
          maxHp: state.run.currentMonster.stats.maxHp,
          currentStamina: state.run.currentMonster.stats.currentStamina ?? state.run.currentMonster.stats.stamina ?? 50,
          stamina: state.run.currentMonster.stats.stamina ?? 50,
          melee: state.run.currentMonster.stats.attack,
          ranged: state.run.currentMonster.stats.special,
          defense: state.run.currentMonster.stats.defense,
          speed: state.run.currentMonster.stats.speed,
          dodge: state.run.currentMonster.stats.dodge ?? Math.floor(state.run.currentMonster.stats.speed * 0.5),
        } : undefined}
      />
      
      {showShop && <ShopView 
        gold={state.run?.gold || 0} 
        floor={dungeon.floor}
        onBuy={handleBuyItem} 
        onBuyEquipment={handleBuyEquipment}
        onClose={() => setShowShop(false)} 
      />}
      
      {showEquipment && state.run && (
        <EquipmentView
          party={state.run.party}
          activePartyIndex={state.run.activePartyIndex}
          partyEquipment={state.run.partyEquipment}
          inventory={state.run.equipmentInventory}
          onEquip={(item, partyIndex) => dispatch({ type: 'EQUIP_ITEM', item, partyIndex })}
          onUnequip={(slot, partyIndex) => dispatch({ type: 'UNEQUIP_ITEM', slot, partyIndex })}
          onDrop={(itemId) => dispatch({ type: 'DROP_EQUIPMENT', itemId })}
          onBulkEquip={(partyIndex, equipment, usedIds) => dispatch({ type: 'BULK_EQUIP', partyIndex, equipment, usedIds })}
          onLog={(text) => addLog(text, 'system')}
          onClose={() => setShowEquipment(false)}
        />
      )}
      
      <div className={`fixed inset-0 ${bottomOffset} overflow-hidden transition-all duration-300`}>
        <div className="h-full flex flex-col">
          {/* Scrollable dungeon viewport - fills available space */}
          <div className="flex-1 overflow-hidden bg-card border-b-2 border-primary/20">
            <DungeonRenderer 
              dungeon={dungeon} 
              playerElement={state.run?.currentMonster.element || 'fire'} 
              playerClass={state.run?.currentMonster.class}
              playerSpecies={state.run?.currentMonster.species}
              playerDexterity={state.run?.currentMonster.stats.dodge || 10}
              zoom={settings.dungeonZoom}
              unlockedMonsters={state.saveData.unlockedMonsters}
              targetPath={targetPath}
              onTileClick={handleTileClick}
              onDisarmTrap={(x, y, success) => {
                dispatch({ type: 'DISARM_TRAP', x, y, success });
                if (success) {
                  addLog('🔧 Trap disarmed!', 'system');
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
                    addLog(`⚠️ Disarm failed! Spike trap dealt ${damage} damage!`, 'damage');
                    if (newHp <= 0) {
                      dispatch({ type: 'END_RUN', victory: false });
                      dispatch({ type: 'SET_PHASE', phase: 'run_summary' });
                    }
                  } else if (tile?.trapType === 'poison') {
                    addLog('☠️ Disarm failed! You got poisoned!', 'status');
                  } else if (tile?.trapType === 'alarm') {
                    addLog('🔔 Disarm failed! Alarm triggered!', 'status');
                  }
                }
              }}
            />
          </div>

          {/* Bottom bar with controls, legend, and game log */}
          <div className={`fixed ${controlsOffset} left-0 right-0 h-[260px] bg-card border-t-2 border-primary/20 p-3 z-40 transition-all duration-300`}>
            <div className="flex flex-col h-full gap-2">
              {/* Top row: Controls and legend */}
              <div className="flex justify-center items-center flex-shrink-0">
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
                <div className="hidden sm:flex flex-col items-center">
                  <p className="text-muted-foreground text-sm text-center mb-1">Use WASD or Arrow keys to move</p>
                  {/* Legend */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground justify-center">
                    <span>💎 Treasure</span>
                    <span>⬇️ Stairs</span>
                    <span>⚠️ Trap</span>
                    <span>🏪 Shop</span>
                  </div>
                </div>
              </div>

              {/* Full-width game log */}
              <div className="flex-1 w-full p-3 bg-muted/30 rounded-lg border border-border/50 overflow-hidden">
                <div className="flex items-center gap-1 mb-2">
                  <ScrollText className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-semibold text-muted-foreground">Game Log</span>
                </div>
                <div className="h-[calc(100%-28px)] overflow-y-auto scrollbar-none space-y-0.5">
                  {gameLog.slice(-12).map((msg, i) => (
                    <p key={msg.id} className={`text-sm ${i === gameLog.slice(-12).length - 1 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                      {msg.text}
                    </p>
                  ))}
                  {gameLog.length === 0 && (
                    <p className="text-sm text-muted-foreground italic">No events yet...</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>;
}

// Battle View Component with proper combat calculations
function BattleView({
  gameLog,
  addLog,
}: {
  gameLog: LogMessage[];
  addLog: (text: string, type?: LogMessage['type']) => void;
}) {
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
  
  // Recruitment modal state
  const [showRecruitment, setShowRecruitment] = useState(false);
  const [defeatedEnemy, setDefeatedEnemy] = useState<Monster | null>(null);
  const [recruitChance, setRecruitChance] = useState(0);
  
  // Party switch on defeat modal state
  const [showPartySwitchModal, setShowPartySwitchModal] = useState(false);
  const [defeatedPartyIndex, setDefeatedPartyIndex] = useState<number>(0);
  
  // Revive target modal state
  const [showReviveModal, setShowReviveModal] = useState(false);
  const [pendingReviveItem, setPendingReviveItem] = useState<InventoryItem | null>(null);
  
  // Combat switch mode state
  const [showCombatSwitch, setShowCombatSwitch] = useState(false);

  // Sync battle.log into the unified run log
  const lastBattleLogLen = useRef(0);
  useEffect(() => {
    if (!battle) {
      lastBattleLogLen.current = 0;
      return;
    }

    const current = battle.log ?? [];
    if (current.length < lastBattleLogLen.current) {
      lastBattleLogLen.current = 0;
    }

    const start = lastBattleLogLen.current;
    for (let i = start; i < current.length; i++) {
      const parsed = parseLogMessage(current[i]);
      addLog(parsed.text, parsed.type);
    }
    lastBattleLogLen.current = current.length;
  }, [battle, addLog]);
  
  // Battle stats tracking (local, synced to state at end)
  const [battleStats, setBattleStats] = useState({
    turnsUsed: 0,
    overkillDamage: 0,
    statusEffectsApplied: 0,
    criticalHits: 0,
  });
  
  // Combat effects tracking (local state synced with battle)
  const [playerEffects, setPlayerEffects] = useState<CombatEffects>(
    battle?.playerEffects as CombatEffects || EMPTY_COMBAT_EFFECTS
  );
  const [enemyEffects, setEnemyEffects] = useState<CombatEffects>(
    battle?.enemyEffects as CombatEffects || EMPTY_COMBAT_EFFECTS
  );
  
  if (!battle || !state.run) return null;
  const playerMoves = getMonsterMoves(battle.playerMonster.species, battle.playerMonster.element, battle.playerMonster.class);
  const experienceToNext = xpToNextLevel(battle.playerMonster.level);
  const currentStamina = battle.playerMonster.stats.currentStamina ?? battle.playerMonster.stats.stamina ?? 50;
  const maxStamina = battle.playerMonster.stats.stamina ?? 50;

  // Check if there are alive party members besides the active one
  const hasAlivePartyMembers = () => {
    return state.run!.party.some((m, i) => i !== state.run!.activePartyIndex && m.stats.currentHp > 0);
  };
  
  // Handle active monster defeat - show switch modal or end run
  const handleActiveMonsterDefeated = (updatedPlayerMonster: Monster, log: string[]) => {
    // Update the current monster's HP to 0 in state
    dispatch({
      type: 'UPDATE_PLAYER_MONSTER',
      monster: updatedPlayerMonster
    });
    
    if (hasAlivePartyMembers()) {
      // Show party switch modal
      setDefeatedPartyIndex(state.run!.activePartyIndex);
      setShowPartySwitchModal(true);
      // Update battle log
      dispatch({
        type: 'UPDATE_BATTLE',
        battle: {
          playerMonster: updatedPlayerMonster,
          log: [...log, `${updatedPlayerMonster.name} was defeated!`]
        }
      });
    } else {
      // All party members defeated - end run
      dispatch({ type: 'END_BATTLE', victory: false });
      dispatch({ type: 'END_RUN', victory: false });
    }
  };
  
  // Handle party switch from defeat modal
  const handlePartySwitchFromDefeat = (newIndex: number) => {
    dispatch({ type: 'SWITCH_ACTIVE_IN_BATTLE', index: newIndex });
    setShowPartySwitchModal(false);
    toast.success(`Go, ${state.run!.party[newIndex].species}!`);
    // Reset combat effects for the new monster
    setPlayerEffects(EMPTY_COMBAT_EFFECTS);
  };
  
  // Handle surrender from defeat modal
  const handleSurrenderFromDefeat = () => {
    setShowPartySwitchModal(false);
    dispatch({ type: 'END_BATTLE', victory: false });
    dispatch({ type: 'END_RUN', victory: false });
  };
  
  // Handle voluntary party switch during combat (uses a turn)
  const handleCombatSwitch = (newIndex: number) => {
    if (!state.run || !battle) return;
    
    setShowCombatSwitch(false);
    dispatch({ type: 'SWITCH_ACTIVE_IN_BATTLE', index: newIndex });
    setPlayerEffects(EMPTY_COMBAT_EFFECTS);
    toast.success(`Go, ${state.run.party[newIndex].species}!`);
    
    // Enemy gets a free attack when you switch
    const enemyMoves = getMonsterMoves(battle.enemyMonster.species, battle.enemyMonster.element, battle.enemyMonster.class);
    const enemyMove = enemyMoves[Math.floor(Math.random() * Math.min(3, enemyMoves.length))];
    const newMonster = state.run.party[newIndex];
    const enemyResult = executeCombat(enemyMove, battle.enemyMonster, newMonster);
    const newPlayerHp = Math.max(0, newMonster.stats.currentHp - enemyResult.damage);
    
    if (newPlayerHp <= 0) {
      const defeatedMonster = {
        ...newMonster,
        stats: { ...newMonster.stats, currentHp: 0 }
      };
      handleActiveMonsterDefeated(defeatedMonster, [...battle.log, `Switched to ${newMonster.name}!`, enemyResult.message]);
    } else {
      dispatch({
        type: 'UPDATE_BATTLE',
        battle: {
          playerMonster: {
            ...newMonster,
            stats: { ...newMonster.stats, currentHp: newPlayerHp }
          },
          log: [...battle.log, `Switched to ${newMonster.name}!`, enemyResult.message]
        }
      });
    }
  };
  
  // Handle revive target selection
  const handleReviveTarget = (partyIndex: number) => {
    if (!pendingReviveItem || !state.run) return;
    
    const revivePercent = pendingReviveItem.effect === 'revive_full' ? 100 : (pendingReviveItem.value || 25);
    
    // Revive the party member
    dispatch({ type: 'REVIVE_PARTY_MEMBER', index: partyIndex, hpPercent: revivePercent });
    
    // Consume the item
    dispatch({ type: 'USE_ITEM', itemId: pendingReviveItem.id });
    
    const revivedMonster = state.run.party[partyIndex];
    const revivedHp = Math.max(1, Math.floor(revivedMonster.stats.maxHp * (revivePercent / 100)));
    toast.success(`🌿 ${revivedMonster.species} was revived with ${revivedHp} HP!`);
    
    // Update battle log
    dispatch({
      type: 'UPDATE_BATTLE',
      battle: {
        log: [...battle.log, `${revivedMonster.name} was revived!`]
      }
    });
    
    setShowReviveModal(false);
    setPendingReviveItem(null);
    
    // Enemy gets a turn after using item
    const enemyMoves = getMonsterMoves(battle.enemyMonster.species, battle.enemyMonster.element, battle.enemyMonster.class);
    const enemyMove = enemyMoves[Math.floor(Math.random() * Math.min(3, enemyMoves.length))];
    const enemyResult = executeCombat(enemyMove, battle.enemyMonster, battle.playerMonster);
    const newPlayerHp = Math.max(0, battle.playerMonster.stats.currentHp - enemyResult.damage);
    
    if (newPlayerHp <= 0) {
      const defeatedMonster = {
        ...battle.playerMonster,
        stats: { ...battle.playerMonster.stats, currentHp: 0 }
      };
      handleActiveMonsterDefeated(defeatedMonster, [...battle.log, `${revivedMonster.name} was revived!`, enemyResult.message]);
    } else {
      dispatch({
        type: 'UPDATE_BATTLE',
        battle: {
          playerMonster: {
            ...battle.playerMonster,
            stats: { ...battle.playerMonster.stats, currentHp: newPlayerHp }
          },
          log: [...battle.log, `${revivedMonster.name} was revived!`, enemyResult.message]
        }
      });
    }
  };

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
        const defeatedMonster = {
          ...battle.playerMonster,
          stats: { ...battle.playerMonster.stats, currentHp: 0 }
        };
        handleActiveMonsterDefeated(defeatedMonster, newLog);
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
      const result = cureStatusEffect(playerEffects, 'poison');
      if (result.cured) {
        setPlayerEffects(result.effects);
        message = '🟣 Cured poison!';
      } else {
        message = 'Not poisoned!';
      }
    } else if (item.effect === 'cure_burn') {
      const result = cureStatusEffect(playerEffects, 'burn');
      if (result.cured) {
        setPlayerEffects(result.effects);
        message = '🔥 Cured burn!';
      } else {
        message = 'Not burned!';
      }
    } else if (item.effect === 'cure_freeze') {
      const result = cureStatusEffect(playerEffects, 'freeze');
      if (result.cured) {
        setPlayerEffects(result.effects);
        message = '❄️ Cured freeze!';
      } else {
        message = 'Not frozen!';
      }
    } else if (item.effect === 'cure_all') {
      setPlayerEffects(cureAllStatusEffects(playerEffects));
      message = '✨ Cured all status effects!';
    } else if (item.effect === 'boost_attack') {
      const result = applyStatModifier(playerEffects, 'attack', 'buff', 25, 5, item.name);
      setPlayerEffects(result.effects);
      message = '⚔️ Attack boosted!';
    } else if (item.effect === 'boost_defense') {
      const result = applyStatModifier(playerEffects, 'defense', 'buff', 25, 5, item.name);
      setPlayerEffects(result.effects);
      message = '🛡️ Defense boosted!';
    } else if (item.effect === 'boost_speed') {
      const result = applyStatModifier(playerEffects, 'speed', 'buff', 25, 5, item.name);
      setPlayerEffects(result.effects);
      message = '💨 Speed boosted!';
    } else if (item.effect === 'revive' || item.effect === 'revive_full') {
      // Check if there are fainted party members
      const hasFainted = state.run!.party.some(m => m.stats.currentHp <= 0);
      if (!hasFainted) {
        toast.error('No fainted party members to revive!');
        return;
      }
      // Show revive target modal
      setPendingReviveItem(item);
      setShowReviveModal(true);
      return; // Don't consume item yet - wait for selection
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
      const defeatedMonster = {
        ...battle.playerMonster,
        stats: { ...newStats, currentHp: 0 }
      };
      handleActiveMonsterDefeated(defeatedMonster, [...battle.log, message, enemyResult.message]);
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
    
    // Add all passive ability messages
    if (result.passiveMessages && result.passiveMessages.length > 0) {
      newLog.push(...result.passiveMessages);
    }
    
    if (staminaCost > 0) {
      newLog.push(`⚡ Used ${staminaCost} stamina`);
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

    // === APPLY STATUS EFFECTS FROM PLAYER'S MOVE ===
    let updatedEnemyEffects = { ...enemyEffects };
    let updatedPlayerEffects = { ...playerEffects };
    
    if (result.hit && move.effect) {
      const effectResult = getMoveEffectResult(move.effect);
      if (effectResult) {
        if (effectResult.statusEffect) {
          const targetEffects = effectResult.self ? updatedPlayerEffects : updatedEnemyEffects;
          const statusResult = applyStatusEffect(
            targetEffects, 
            effectResult.statusEffect.type, 
            effectResult.statusEffect.duration, 
            move.name
          );
          if (effectResult.self) {
            updatedPlayerEffects = statusResult.effects;
          } else {
            updatedEnemyEffects = statusResult.effects;
          }
          if (statusResult.applied) {
            newLog.push(statusResult.message);
          }
        }
        if (effectResult.statModifier) {
          const targetEffects = effectResult.self ? updatedPlayerEffects : updatedEnemyEffects;
          const modResult = applyStatModifier(
            targetEffects,
            effectResult.statModifier.stat,
            effectResult.statModifier.direction,
            effectResult.statModifier.percentage,
            effectResult.statModifier.duration,
            move.name
          );
          if (effectResult.self) {
            updatedPlayerEffects = modResult.effects;
          } else {
            updatedEnemyEffects = modResult.effects;
          }
          if (modResult.applied) {
            newLog.push(modResult.message);
          }
        }
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
    // Track battle stats for recruitment
    const updatedBattleStats = {
      turnsUsed: battleStats.turnsUsed + 1,
      overkillDamage: battleStats.overkillDamage,
      statusEffectsApplied: battleStats.statusEffectsApplied + (result.hit && move.effect && getMoveEffectResult(move.effect)?.statusEffect ? 1 : 0),
      criticalHits: battleStats.criticalHits + (result.critical ? 1 : 0),
    };
    setBattleStats(updatedBattleStats);
    
    if (newEnemyHp <= 0) {
      // Calculate overkill damage
      const overkill = Math.abs(newEnemyHp);
      const finalBattleStats = {
        ...updatedBattleStats,
        overkillDamage: overkill,
      };
      
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

      // Award XP to active monster
      const xpGained = calculateXpReward(battle.enemyMonster.level, battle.playerMonster.level);
      const newXp = experience + xpGained;
      
      // Award half XP to passive party members
      dispatch({
        type: 'ADD_PARTY_XP',
        xpGained: xpGained,
        excludeActiveIndex: state.run.activePartyIndex,
      });

      // Check for level up
      const levelUpResult = checkLevelUp(battle.playerMonster, newXp);
      
      // Remove enemy from dungeon
      if (state.run?.dungeon) {
        const updatedDungeon = removeEnemy(state.run.dungeon, battle.enemyMonster.id);
        dispatch({
          type: 'SET_DUNGEON',
          dungeon: updatedDungeon
        });
      }
      
      // Base gold reward
      const baseGold = 5 + battle.enemyMonster.level * 3;
      dispatch({
        type: 'ADD_GOLD',
        amount: baseGold
      });
      
      // Calculate recruitment chance
      const playerHpPercent = (newPlayerHp / battle.playerMonster.stats.maxHp) * 100;
      const calculatedRecruitChance = calculateRecruitChance({
        turnsUsed: finalBattleStats.turnsUsed,
        overkillDamage: finalBattleStats.overkillDamage,
        statusEffectsApplied: finalBattleStats.statusEffectsApplied,
        criticalHits: finalBattleStats.criticalHits,
        playerHpPercent,
        enemyLevel: battle.enemyMonster.level,
        playerLevel: battle.playerMonster.level,
      });
      
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
        
        dispatch({
          type: 'UPDATE_PLAYER_MONSTER',
          monster: leveledMonster
        });
        // Set XP to remainder after level up
        dispatch({ type: 'ADD_XP', amount: levelUpResult.xpRemaining - experience });
        
        toast.success(`🎉 LEVEL UP! Now level ${levelUpResult.newLevel}!`);
        toast.success(`+${xpGained} XP!`);
        
        // Show level up screen - DON'T end battle yet, let user see level up first
        setLevelUpData({
          previousStats,
          previousLevel,
          newMoves,
          monster: leveledMonster
        });
        
        // Store recruitment data for after level up
        setDefeatedEnemy(battle.enemyMonster);
        setRecruitChance(calculatedRecruitChance);
        
        // Battle will be ended when user clicks "Continue" on level up screen
        return;
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
        toast.success(`+${xpGained} XP!`);
      }
      
      // Show recruitment modal if party not full
      const partySize = state.run?.party.length || 1;
      if (partySize < 6) {
        setDefeatedEnemy(battle.enemyMonster);
        setRecruitChance(calculatedRecruitChance);
        setShowRecruitment(true);
        // Don't end battle yet - wait for recruitment decision
        return;
      }
      
      dispatch({
        type: 'END_BATTLE',
        victory: true
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
      
      // Enemy also has stamina - pick moves they can afford
      const enemyCurrentStamina = updatedEnemyMonster.stats.currentStamina ?? updatedEnemyMonster.stats.stamina ?? 50;
      const enemyMaxStamina = updatedEnemyMonster.stats.stamina ?? 50;
      const affordableMoves = enemyMoves.filter(m => (m.staminaCost || 0) <= enemyCurrentStamina);
      
      // Pick a random affordable move, or use STRUGGLE_MOVE if out of stamina
      const enemyMove = affordableMoves.length > 0 
        ? affordableMoves[Math.floor(Math.random() * Math.min(3, affordableMoves.length))]
        : STRUGGLE_MOVE;
      
      // Consume enemy stamina
      const enemyStaminaCost = enemyMove.staminaCost || 0;
      let newEnemyStamina = Math.max(0, enemyCurrentStamina - enemyStaminaCost);
      
      // Enemy also regenerates a bit of stamina each turn
      newEnemyStamina = Math.min(enemyMaxStamina, newEnemyStamina + 2);
      
      // Use the updated enemy monster with potentially modified speed and stamina
      const attackingEnemy = {
        ...updatedEnemyMonster,
        stats: {
          ...updatedEnemyMonster.stats,
          currentHp: newEnemyHp,
          speed: newEnemySpeed,
          currentStamina: newEnemyStamina,
        }
      };
      
      const enemyResult = executeCombat(enemyMove, attackingEnemy, battle.playerMonster);
      newPlayerHp = Math.max(0, newPlayerHp - enemyResult.damage);
      newLog.push(enemyResult.message);
      
      // Add all passive ability messages from enemy's attack
      if (enemyResult.passiveMessages && enemyResult.passiveMessages.length > 0) {
        newLog.push(...enemyResult.passiveMessages);
      }
      
      // === APPLY STATUS EFFECTS FROM ENEMY'S MOVE ===
      if (enemyResult.hit && enemyMove.effect) {
        const effectResult = getMoveEffectResult(enemyMove.effect);
        if (effectResult) {
          if (effectResult.statusEffect) {
            const targetEffects = effectResult.self ? updatedEnemyEffects : updatedPlayerEffects;
            const statusResult = applyStatusEffect(
              targetEffects, 
              effectResult.statusEffect.type, 
              effectResult.statusEffect.duration, 
              enemyMove.name
            );
            if (effectResult.self) {
              updatedEnemyEffects = statusResult.effects;
            } else {
              updatedPlayerEffects = statusResult.effects;
            }
            if (statusResult.applied) {
              newLog.push(statusResult.message);
            }
          }
          if (effectResult.statModifier) {
            const targetEffects = effectResult.self ? updatedEnemyEffects : updatedPlayerEffects;
            const modResult = applyStatModifier(
              targetEffects,
              effectResult.statModifier.stat,
              effectResult.statModifier.direction,
              effectResult.statModifier.percentage,
              effectResult.statModifier.duration,
              enemyMove.name
            );
            if (effectResult.self) {
              updatedEnemyEffects = modResult.effects;
            } else {
              updatedPlayerEffects = modResult.effects;
            }
            if (modResult.applied) {
              newLog.push(modResult.message);
            }
          }
        }
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
      
      // === PROCESS END-OF-TURN STATUS EFFECTS ===
      // Player status damage (poison, burn)
      const playerStatusResult = processStartOfTurn(battle.playerMonster, updatedPlayerEffects);
      if (playerStatusResult.damage > 0) {
        newPlayerHp = Math.max(0, newPlayerHp - playerStatusResult.damage);
        newLog.push(...playerStatusResult.messages);
      }
      
      // Enemy status damage
      const enemyStatusResult = processStartOfTurn(updatedEnemyMonster, updatedEnemyEffects);
      if (enemyStatusResult.damage > 0 && newEnemyHp > 0) {
        newEnemyHp = Math.max(0, newEnemyHp - enemyStatusResult.damage);
        newLog.push(...enemyStatusResult.messages.map(m => `Enemy: ${m}`));
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
      
      // === TICK EFFECT TIMERS ===
      const playerTickResult = tickEffects(updatedPlayerEffects);
      updatedPlayerEffects = playerTickResult.effects;
      if (playerTickResult.expiredMessages.length > 0) {
        newLog.push(...playerTickResult.expiredMessages);
      }
      
      const enemyTickResult = tickEffects(updatedEnemyEffects);
      updatedEnemyEffects = enemyTickResult.effects;
      if (enemyTickResult.expiredMessages.length > 0) {
        newLog.push(...enemyTickResult.expiredMessages.map(m => `Enemy: ${m}`));
      }
      
      // Update effect state
      setPlayerEffects(updatedPlayerEffects);
      setEnemyEffects(updatedEnemyEffects);
      
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
        const defeatedMonster = {
          ...updatedPlayerMonster,
          stats: { ...updatedPlayerMonster.stats, currentHp: 0 },
          temporaryResistances: updatedPlayerMonster.temporaryResistances,
        };
        handleActiveMonsterDefeated(defeatedMonster, newLog);
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
                currentStamina: attackingEnemy.stats.currentStamina,
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
    // Check if we should show recruitment after level up
    if (defeatedEnemy && state.run && state.run.party.length < 6) {
      setShowRecruitment(true);
    } else {
      // End the battle now that user has seen level up screen
      dispatch({
        type: 'END_BATTLE',
        victory: true
      });
      // Reset battle stats
      setBattleStats({ turnsUsed: 0, overkillDamage: 0, statusEffectsApplied: 0, criticalHits: 0 });
    }
  };
  
  // Handle recruitment attempt
  const handleRecruit = () => {
    if (!defeatedEnemy || !state.run) return;
    
    // Roll for recruitment
    const roll = Math.random() * 100;
    const success = roll < recruitChance;
    
    if (success) {
      // Create a fresh copy of the defeated enemy for the party
      const recruitedMonster: Monster = {
        ...defeatedEnemy,
        id: `party_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        stats: {
          ...defeatedEnemy.stats,
          currentHp: Math.floor(defeatedEnemy.stats.maxHp * 0.5), // Joins at 50% HP
          currentStamina: Math.floor((defeatedEnemy.stats.stamina || 50) * 0.5),
        }
      };
      
      dispatch({ type: 'ADD_TO_PARTY', monster: recruitedMonster });
      toast.success(`🎉 ${defeatedEnemy.name} joined your party!`);
    } else {
      toast.error(`${defeatedEnemy.name} wasn't impressed enough to join...`);
    }
    
    setShowRecruitment(false);
    setDefeatedEnemy(null);
    setBattleStats({ turnsUsed: 0, overkillDamage: 0, statusEffectsApplied: 0, criticalHits: 0 });
    
    dispatch({
      type: 'END_BATTLE',
      victory: true
    });
  };
  
  // Handle dismissing recruitment
  const handleDismissRecruitment = () => {
    setShowRecruitment(false);
    setDefeatedEnemy(null);
    setBattleStats({ turnsUsed: 0, overkillDamage: 0, statusEffectsApplied: 0, criticalHits: 0 });
    
    dispatch({
      type: 'END_BATTLE',
      victory: true
    });
  };

  return (
    <>
      {/* Party switch modal on defeat */}
      <PartySwitchModal
        open={showPartySwitchModal}
        party={state.run?.party || []}
        defeatedIndex={defeatedPartyIndex}
        onSwitch={handlePartySwitchFromDefeat}
        onSurrender={handleSurrenderFromDefeat}
      />
      
      {/* Revive target modal */}
      <ReviveTargetModal
        open={showReviveModal}
        onClose={() => {
          setShowReviveModal(false);
          setPendingReviveItem(null);
        }}
        party={state.run?.party || []}
        revivePercent={pendingReviveItem?.effect === 'revive_full' ? 100 : (pendingReviveItem?.value || 25)}
        itemName={pendingReviveItem?.name || 'Revive'}
        onRevive={handleReviveTarget}
      />
      
      {/* Recruitment modal */}
      {showRecruitment && defeatedEnemy && (
        <RecruitmentModal
          enemy={defeatedEnemy}
          recruitChance={recruitChance}
          impressiveStats={battleStats}
          partyFull={(state.run?.party.length || 0) >= 6}
          onRecruit={handleRecruit}
          onDismiss={handleDismissRecruitment}
        />
      )}
      
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
                {/* Status Effects */}
                {(enemyEffects.statusEffects.length > 0 || enemyEffects.statModifiers.length > 0) && (
                  <div className="mt-1">
                    <StatusIcons effects={enemyEffects} />
                  </div>
                )}
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
                {/* Status Effects */}
                {(playerEffects.statusEffects.length > 0 || playerEffects.statModifiers.length > 0) && (
                  <div className="mt-2">
                    <StatusIcons effects={playerEffects} />
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
        
        {/* Unified Log - visible scrolling area */}
        <div className="mt-3 p-2 bg-muted/30 rounded-lg border border-border/50 max-h-24 overflow-y-auto">
          <div className="flex items-center gap-1 mb-1">
            <ScrollText className="w-3 h-3 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">Log</span>
          </div>
          <div className="space-y-0.5">
            {gameLog.slice(-5).map((msg, i) => (
              <p key={msg.id} className={`text-xs ${i === gameLog.slice(-5).length - 1 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                {msg.text}
              </p>
            ))}
            {gameLog.length === 0 && (
              <p className="text-xs text-muted-foreground italic">No events yet...</p>
            )}
          </div>
        </div>
        
        {/* Move selection area - above the sidebar */}
        <div className="mt-4 p-3 bg-card rounded-lg border-2 border-primary/20">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">Choose Your Move</h3>
            {/* Party switch button - only show if more than 1 alive party member */}
            {state.run.party.filter((m, i) => i !== state.run.activePartyIndex && m.stats.currentHp > 0).length > 0 && (
              <Button
                variant={showCombatSwitch ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setShowCombatSwitch(!showCombatSwitch)}
              >
                🔄 Switch
              </Button>
            )}
          </div>
          
          {/* Combat switch panel */}
          {showCombatSwitch ? (
            <CombatSwitchPanel
              party={state.run.party}
              activeIndex={state.run.activePartyIndex}
              onSwitch={handleCombatSwitch}
              onCancel={() => setShowCombatSwitch(false)}
            />
          ) : (
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
          )}
        </div>
      </div>

      {/* Unified GameSidebar for battle */}
      <GameSidebar 
        monster={battle.playerMonster}
        gold={state.run.gold}
        floor={state.run.dungeon?.floor || 1}
        inventory={inventory}
        equipmentInventory={state.run.equipmentInventory}
        equipment={state.run.partyEquipment[state.run.activePartyIndex]}
        runMaterials={state.run.runMaterials}
        moveOrder={state.run.moveOrder}
        hiddenMoves={state.run.hiddenMoves}
        onFlee={handleFlee}
        inBattle={true}
        experience={experience}
        experienceToNext={experienceToNext}
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
  const { state } = useGame();

  // Unified run log (dungeon + battle + notable UI events)
  const [gameLog, setGameLog] = useState<LogMessage[]>([]);
  const addLog = useCallback((text: string, type: LogMessage['type'] = 'info') => {
    setGameLog(prev => [...prev.slice(-199), createLogMessage(text, type)]);
  }, []);

  // Mirror Sonner toasts into the unified log
  useEffect(() => {
    const originalSuccess = toast.success;
    const originalError = toast.error;
    const originalInfo = (toast as any).info;

    toast.success = ((message: any, options?: any) => {
      const parsed = parseLogMessage(String(message));
      addLog(parsed.text, parsed.type);
      return originalSuccess(message, options);
    }) as any;

    toast.error = ((message: any, options?: any) => {
      const parsed = parseLogMessage(String(message));
      addLog(parsed.text, parsed.type);
      return originalError(message, options);
    }) as any;

    if (typeof originalInfo === 'function') {
      (toast as any).info = (message: any, options?: any) => {
        const parsed = parseLogMessage(String(message));
        addLog(parsed.text, parsed.type);
        return originalInfo(message, options);
      };
    }

    return () => {
      toast.success = originalSuccess;
      toast.error = originalError;
      if (typeof originalInfo === 'function') {
        (toast as any).info = originalInfo;
      }
    };
  }, [addLog]);

  switch (state.phase) {
    case 'main_menu':
      return <MainMenu />;
    case 'character_select':
      return <CharacterSelect />;
    case 'dungeon':
      return <DungeonView gameLog={gameLog} addLog={addLog} />;
    case 'battle':
      return <BattleView gameLog={gameLog} addLog={addLog} />;
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