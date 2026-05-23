import { GameProvider, useGame, buildProgressSnapshot } from '@/game/state';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getComboId, UnlockedMonster, InventoryItem, MonsterStats, Monster, Position, DungeonState, hydrateDungeonFromSnapshot } from '@/game/types';
import { createMonster, calculateStats } from '@/game/utils';
import { generateDungeon, movePlayer, removeEnemy, LootItem, shouldStopAutoRun, hasVisibleEnemy, LOOT_TABLE, mineWall, mineableWallName, digRune, damageDungeonNest, tickDungeonNests } from '@/game/dungeon';
import { spawnNestMonster, getNestDestroyRewards } from '@/game/nests';
import { expandDungeonIfNeeded, findStairsPosition } from '@/game/dungeonExpansion';
import { PICKAXE_TIERS, hitsToBreak } from '@/game/tools';
import { useEffect, useCallback, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScrollText, Flag, FlagOff, Swords, Footprints, Pickaxe, Hammer, DoorOpen, ChevronDown, ChevronUp, ShoppingBag, Trees, Shovel } from 'lucide-react';
import { UnifiedTileMenu, UnifiedTileAction, UnifiedTileInfo, UnifiedTileCreature } from '@/game/UnifiedTileMenu';
import { MonsterSprite } from '@/game/sprites';
import { DungeonRenderer } from '@/game/DungeonRenderer';
import { GameSidebar } from '@/game/GameSidebar';
import { getMonsterMoves, Move, STRUGGLE_MOVE, getNewMovesAtLevel } from '@/game/moves';
import { MoveTooltip } from '@/game/BattleTooltip';
import { MoveTierSelector } from '@/game/MoveTierSelector';
import { UnifiedMovePanel } from '@/game/UnifiedMovePanel';
import { getAvailableTiers, hasAoEUnlocked, createEvolvedMove, getHighestTier, EvolvedMove } from '@/game/moveMastery';
import { ShopView } from '@/game/ShopView';
import { executeCombat, calculateXpReward, xpToNextLevel, checkLevelUp, getEffectiveness, hasPassive, checkSkeletonSurvival, applyMushroomRegen, checkImpSteal } from '@/game/combat';
import { toast } from 'sonner';
import { SettingsProvider, SettingsButton, useSettings } from '@/game/Settings';
import { submitTowerFloor, submitDiscoveryCount, submitExplorationCount } from '@/hooks/useUsername';
import { countExploredTiles } from '@/game/overworld';
import { MonsterStatsPreview } from '@/game/MonsterStatsPreview';
import { LevelUpScreen } from '@/game/LevelUpScreen';
import { EquipmentItem, MonsterEquipment, createEmptyEquipment } from '@/game/equipment';
import { isPickupUpgrade } from '@/game/equipmentUtils';

import { calculateMonsterDrops, getEnemyEquipmentDrops } from '@/game/monsterDrops';
import { rollEnemyMoveDamage } from '@/game/enemyAI';
import { EquipmentView } from '@/game/EquipmentView';
import { PreRunEquipment } from '@/game/PreRunEquipment';
import { BUILDING_DEFINITIONS, createBuilding, PlayerBuildingType, PlayerBuilding, getRepairCost, getDisassembleRefund } from '@/game/buildings';
import { DungeonBuildPanel } from '@/game/DungeonBuildPanel';
import { BuildingAssignModal } from '@/game/BuildingAssignModal';
import { BuildingContextMenu } from '@/game/BuildingContextMenu';
import { OverworldView } from '@/game/OverworldView';
import { DungeonListPanel } from '@/game/DungeonListPanel';
import { EnemyAttackMenu, EnemyAttackTarget } from '@/game/EnemyAttackMenu';
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
} from '@/game/statusEffects';
import { StatusIcons } from '@/game/StatusEffectDisplay';
import { CraftingWorkshop } from '@/game/CraftingWorkshop';
import { CraftingRecipe, ConsumableRecipe } from '@/game/equipment';
import { isCreativeMode, effectiveTools } from '@/game/creativeMode';
import { findPath, getDirection } from '@/game/pathfinding';
import { RecruitmentModal, calculateRecruitChance } from '@/game/RecruitmentModal';
import { PartySwitchModal } from '@/game/PartySwitchModal';
import { ReviveTargetModal } from '@/game/ReviveTargetModal';
import { CombatSwitchPanel } from '@/game/CombatSwitchPanel';
import { LogMessage, createLogMessage, parseLogMessage } from '@/game/GameLog';
import { isMonsterFavoredOnTerrain, calculateTerrainDamage, TERRAIN_CONFIG, shovelHitsToBreak, rollRuneDrop } from '@/game/terrain';
import { isAutoShovelEnabled, setAutoShovelEnabled } from '@/game/autoShovel';
import { 
  RESPAWN_CONFIG, 
  spawnMonsterInHiddenRoom,
  calculateNextStepThreshold, 
  shouldWarnAttention,
  getAttentionLevel,
  shouldRespawn,
} from '@/game/respawnSystem';
import { TownShop } from '@/game/TownShop';
import { ElevatorModal } from '@/game/ElevatorModal';
import { 
  getAttackConfig, 
  getValidTargets, 
  getAffectedTiles, 
  calculateEnemyAction, 
  moveEnemy, 
  getEnemyPosition, 
  canSeePlayer,
  ENEMY_ATTACK_STAMINA_COST,
  ENEMY_REST_STAMINA_REGEN,
  enemyHasStaminaToAttack,
  getPathTiles,
} from '@/game/dungeonCombat';
import { playParticleEffectForMove } from '@/game/particles/api';
import { MoveInfoPanel } from '@/game/AttackTargeting';
import { loadKeybinds, getMonsterKeybinds as getMonsterKeybindsImport } from '@/game/keybinds';
import { useAuth } from '@/hooks/useAuth';
import { useCloudSave } from '@/hooks/useCloudSave';
import { useCloudAutosave } from '@/hooks/useCloudAutosave';
import { useAdminRole } from '@/hooks/useAdminRole';

// Main Menu Component
function MainMenu() {
  const {
    state,
    dispatch
  } = useGame();
  const [showCrafting, setShowCrafting] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const { user, signOut, isAuthenticated } = useAuth();
  const { syncSave, saveToCloud, syncing, lastSyncTime } = useCloudSave();
  const navigate = useNavigate();
  
  const handleResetSave = () => {
    if (confirm('Are you sure you want to reset all progress? This cannot be undone.')) {
      dispatch({
        type: 'RESET_SAVE'
      });
      toast.success('Save data reset!');
    }
  };
  
  const handleCraft = (recipe: CraftingRecipe, result: import('@/game/equipment').EquipmentItem) => {
    // Creative mode: skip the material deduction entirely.
    if (!isCreativeMode()) {
      dispatch({
        type: 'USE_MATERIALS',
        materials: recipe.materials
      });
    }
    // Store the crafted equipment
    dispatch({
      type: 'STORE_EQUIPMENT',
      item: result
    });
    toast.success(`Crafted ${result.name}!`);
  };
  
  const handleCraftConsumable = (recipe: ConsumableRecipe) => {
    if (!isCreativeMode()) {
      dispatch({
        type: 'USE_MATERIALS',
        materials: recipe.materials
      });
    }
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
    // Creative mode: admins skip the gold cost entirely.
    if (!isCreativeMode()) {
      dispatch({ type: 'SPEND_TOWN_GOLD', amount: price });
    }
    dispatch({ type: 'STORE_ITEM', item });
    toast.success(`Bought ${item.name}!`);
  };
  
  const handleBuyEquipment = (item: import('@/game/equipment').EquipmentItem, price: number) => {
    if (!isCreativeMode()) {
      dispatch({ type: 'SPEND_TOWN_GOLD', amount: price });
    }
    dispatch({ type: 'STORE_EQUIPMENT', item });
    toast.success(`Bought ${item.name}!`);
  };
  
  const handleSellEquipment = (itemId: string, price: number) => {
    dispatch({ type: 'SELL_EQUIPMENT', itemId, price });
    toast.success(`Sold for ${price} gold!`);
  };

  // Quick-start: skip both character-select and pre-run equipment screens
  // when the player already has a saved party they're happy with.
  const savedPartyIds: string[] = (() => {
    try {
      const raw = localStorage.getItem('menagerie_last_party');
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch { return []; }
  })();
  const quickStartParty = savedPartyIds
    .map(id => state.saveData.unlockedMonsters.find(u => u.comboId === id))
    .filter(Boolean) as UnlockedMonster[];
  const canQuickStart = quickStartParty.length > 0;

  const quickStart = (destination: 'dungeon' | 'overworld', entranceId?: string) => {
    if (!canQuickStart) return;
    localStorage.setItem('menagerie_run_destination', destination);
    localStorage.setItem('menagerie_run_origin', 'main_menu');
    if (destination === 'dungeon' && entranceId) {
      const entrance = state.saveData.dungeonEntrances?.[entranceId];
      localStorage.setItem('menagerie_active_dungeon_id', entranceId);
      localStorage.setItem('menagerie_active_dungeon_difficulty', String(entrance?.difficulty || 1));
    } else {
      localStorage.removeItem('menagerie_active_dungeon_id');
    }
    localStorage.removeItem('menagerie_selected_start_floor');

    const monsters = quickStartParty.map(saved =>
      createMonster(
        saved.species,
        saved.classType,
        saved.element,
        saved.level,
        saved.equipment,
        saved.experience,
        saved.moveMastery,
      )
    );
    // Carry each member's persisted equipment so the START_RUN reducer
    // doesn't blank slots 2-N.
    const partyPreEquipped: MonsterEquipment[] = monsters.map(m => m.equipment || createEmptyEquipment());

    dispatch({
      type: 'START_RUN',
      monster: monsters[0],
      party: monsters,
      partyPreEquipped,
      withdrawnIds: [],
      preSelectedItems: [],
      destination,
    });
  };

  
  return (
    <div className="game-container font-serif text-center">
      <div className="w-full max-w-md mx-auto text-center space-y-6 sm:space-y-8 px-2">
        <div className="relative inline-block">
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent pb-2 break-words">
            Menagerie
          </h1>
          <span
            aria-label="Beta"
            className="absolute -bottom-1 -right-3 sm:-right-6 rotate-[-12deg] text-sm sm:text-base font-bold text-accent tracking-wider uppercase drop-shadow-sm"
          >
            Beta
          </span>
        </div>
        <p className="text-muted-foreground text-base sm:text-lg">Play as the monsters. Unlock them all.</p>

        <div className="space-y-4">
          {/* Resume button — only when a run is suspended in memory. Drops the
              player back into dungeon/battle/overworld at the exact spot they
              left from. */}
          {state.run && (
            <div className="flex gap-2 justify-center">
              <Button
                size="lg"
                className="w-full max-w-xs sm:w-64 bg-gradient-to-r from-accent to-primary hover:opacity-90 animate-pulse"
                onClick={() => {
                  // Pick the right phase based on what the run was doing.
                  const phase = state.run?.battle
                    ? 'battle'
                    : state.run?.dungeon
                      ? 'dungeon'
                      : 'overworld';
                  dispatch({ type: 'SET_PHASE', phase });
                }}
              >
                ▶️ Resume Run
              </Button>
            </div>
          )}

          {/* Overworld button moved to top */}
          <div className="flex gap-2 justify-center flex-wrap">
            <Button
              size="lg"
              className="w-full max-w-xs sm:w-64 bg-gradient-to-r from-secondary to-primary hover:opacity-90"
              onClick={() => {
                localStorage.setItem('menagerie_run_destination', 'overworld');
                localStorage.setItem('menagerie_run_origin', 'main_menu');
                localStorage.removeItem('menagerie_active_dungeon_id');
                dispatch({ type: 'SET_PHASE', phase: 'character_select' });
              }}
            >
              🗺️ Enter Overworld
            </Button>
            {canQuickStart && (
              <Button
                size="lg"
                variant="secondary"
                className="w-full max-w-xs sm:w-64"
                onClick={() => quickStart('overworld')}
                title={`Start with last party (${quickStartParty.length}): ${quickStartParty.map(m => m.species).join(', ')}`}
              >
                ▶️ Start Adventure
              </Button>
            )}
          </div>

          {/* Dungeon list replaces the single Start Run button */}
          <DungeonListPanel
            dungeonEntrances={state.saveData.dungeonEntrances || {}}
            onLaunch={(entrance) => {
              localStorage.setItem('menagerie_run_destination', 'dungeon');
              localStorage.setItem('menagerie_run_origin', 'main_menu');
              localStorage.setItem('menagerie_active_dungeon_id', entrance.id);
              localStorage.setItem('menagerie_active_dungeon_difficulty', String(entrance.difficulty || 1));
              dispatch({ type: 'SET_PHASE', phase: 'character_select' });
            }}
            onQuickStart={canQuickStart ? (entrance) => quickStart('dungeon', entrance.id) : undefined}
            quickStartPartySize={quickStartParty.length}
          />


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
        
        {/* Account & Cloud Sync Status */}
        <div className="pt-4 border-t border-border/50 space-y-2">
          {isAuthenticated ? (
            <>
              <p className="text-sm text-green-500 flex items-center justify-center gap-2">
                ☁️ {syncing ? 'Syncing...' : 'Cloud Save Active'}
                {lastSyncTime && (
                  <span className="text-xs text-muted-foreground">
                    (Last: {lastSyncTime.toLocaleTimeString()})
                  </span>
                )}
              </p>
              <div className="flex gap-2 justify-center flex-wrap">
                <Button
                  variant="default"
                  size="sm"
                  onClick={async () => {
                    const snapshot = buildProgressSnapshot(state.saveData, state.run, state.saveData.overworldState);
                    const result = await saveToCloud(snapshot);
                    if (result.success) {
                      toast.success('Quick saved to cloud!');
                    } else {
                      toast.error(`Save failed: ${result.error || 'unknown error'}`);
                    }
                  }}
                  disabled={syncing}
                >
                  💾 Quick Save
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const snapshot = buildProgressSnapshot(state.saveData, state.run, state.saveData.overworldState);
                    const result = await syncSave(snapshot);
                    if (result.action === 'downloaded' && result.data) {
                      dispatch({ type: 'LOAD_SAVE', saveData: result.data });
                    }
                  }}
                  disabled={syncing}
                >
                  🔄 Sync Now
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={signOut}
                >
                  Sign Out
                </Button>
              </div>
            </>
          ) : (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate('/auth')}
            >
              ☁️ Sign In / Create Account
            </Button>
          )}
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
          gold={isCreativeMode() ? Number.MAX_SAFE_INTEGER : (state.saveData.gold || 0)}
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
          tools={effectiveTools(state.saveData.tools)}
          onCraft={handleCraft}
          onCraftConsumable={handleCraftConsumable}
          onDismantle={handleDismantle}
          onUpgradePickaxe={(tier, mats) => {
            if (!isCreativeMode()) {
              dispatch({ type: 'USE_MATERIALS', materials: mats });
            }
            dispatch({ type: 'SET_PICKAXE_TIER', tier });
            toast.success(`${tier.charAt(0).toUpperCase() + tier.slice(1)} Pickaxe ready!`);
          }}
          onUpgradeShovel={(tier, mats) => {
            if (!isCreativeMode()) {
              dispatch({ type: 'USE_MATERIALS', materials: mats });
            }
            dispatch({ type: 'SET_SHOVEL_TIER', tier });
            toast.success(`${tier.charAt(0).toUpperCase() + tier.slice(1)} Shovel ready!`);
          }}
          onCraftWorkstation={(mats) => {
            if (!isCreativeMode()) {
              dispatch({ type: 'USE_MATERIALS', materials: mats });
            }
            dispatch({ type: 'SET_WORKSTATION_OWNED' });
            toast.success('🛠️ Portable Workstation ready! Use it from the dungeon HUD.');
          }}
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

  // Auto-submit unique discovery count + current world seed to public leaderboard.
  // No-op for signed-out users or those without a username (handled server-side).
  const currentWorldSeed = state.saveData?.overworldState?.worldSeed ?? null;
  useEffect(() => {
    void submitDiscoveryCount(unlockedMonsters.length, currentWorldSeed);
  }, [unlockedMonsters.length, currentWorldSeed]);

  // Auto-submit explored-tile count to public exploration leaderboard.
  // Recomputes when the overworld state object changes (after movement / chunk gen).
  // Server only persists when the new count is higher, so spammy submits are fine.
  const exploredTileCount = countExploredTiles(state.saveData?.overworldState);
  useEffect(() => {
    if (exploredTileCount > 0) {
      void submitExplorationCount(exploredTileCount, currentWorldSeed);
    }
  }, [exploredTileCount, currentWorldSeed]);


  
  // Restore last party selection from localStorage
  const [selectedParty, setSelectedParty] = useState<typeof unlockedMonsters>(() => {
    try {
      const saved = localStorage.getItem('menagerie_last_party');
      if (saved) {
        const savedIds: string[] = JSON.parse(saved);
        // Re-hydrate from current unlocked monsters (levels may have changed)
        return savedIds
          .map(id => unlockedMonsters.find(m => m.comboId === id))
          .filter(Boolean) as typeof unlockedMonsters;
      }
    } catch {}
    return [];
  });
  const [previewMonster, setPreviewMonster] = useState<typeof unlockedMonsters[0] | null>(unlockedMonsters.length > 0 ? unlockedMonsters[0] : null);
  
  // Restore last sort option
  const [sortBy, setSortBy] = useState<SortOption>(() => {
    try {
      const saved = localStorage.getItem('menagerie_party_sort');
      if (saved && ['recent', 'species', 'element', 'class', 'level'].includes(saved)) {
        return saved as SortOption;
      }
    } catch {}
    return 'recent';
  });
  
  const [showEquipmentSelect, setShowEquipmentSelect] = useState(false);
  const [partyForRun, setPartyForRun] = useState<ReturnType<typeof createMonster>[]>([]);
  
  // Persist party selection and sort to localStorage
  useEffect(() => {
    localStorage.setItem('menagerie_last_party', JSON.stringify(selectedParty.map(m => m.comboId)));
  }, [selectedParty]);
  
  useEffect(() => {
    localStorage.setItem('menagerie_party_sort', sortBy);
  }, [sortBy]);
  
  const MAX_PARTY_SIZE = 6;
  
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
        return b.level - a.level;
      case 'recent':
      default:
        return unlockedMonsters.indexOf(b) - unlockedMonsters.indexOf(a);
    }
  });
  
  const togglePartyMember = (monster: typeof unlockedMonsters[0]) => {
    setPreviewMonster(monster);
    const isSelected = selectedParty.some(m => m.comboId === monster.comboId);
    if (isSelected) {
      setSelectedParty(prev => prev.filter(m => m.comboId !== monster.comboId));
    } else if (selectedParty.length < MAX_PARTY_SIZE) {
      setSelectedParty(prev => [...prev, monster]);
    }
  };
  
  const proceedToEquipment = () => {
    if (selectedParty.length === 0) return;
    // Hydrate each picked monster with its persisted equipment from save data
    // so previously equipped gear is still equipped at the pre-run screen.
    const monsters = selectedParty.map(m => {
      const saved = state.saveData.unlockedMonsters.find(u => u.comboId === m.comboId);
      // Always pull level from the latest saveData entry — `selectedParty`
      // is captured at mount time and its `m.level` can lag behind levels
      // gained on previous runs, which would silently downgrade monsters.
      return createMonster(
        m.species,
        m.classType,
        m.element,
        saved?.level ?? m.level,
        saved?.equipment,
        saved?.experience,
        saved?.moveMastery,
      );
    });
    setPartyForRun(monsters);
    setShowEquipmentSelect(true);
  };
  
  const runDestination = (localStorage.getItem('menagerie_run_destination') || 'dungeon') as 'dungeon' | 'overworld';



  
  const startRun = (
    partyEquipment: MonsterEquipment[],
    withdrawnIds: string[],
    selectedItems: import('@/game/types').InventoryItem[],
    selectedStartFloor?: number,
  ) => {
    if (partyForRun.length === 0) return;
    // Persist the player's chosen starting floor so the dungeon-init effect picks it up.
    if (typeof window !== 'undefined') {
      if (selectedStartFloor && selectedStartFloor > 0) {
        localStorage.setItem('menagerie_selected_start_floor', String(selectedStartFloor));
      } else {
        localStorage.removeItem('menagerie_selected_start_floor');
      }
    }
    dispatch({
      type: 'START_RUN',
      monster: partyForRun[0],
      party: partyForRun,
      partyPreEquipped: partyEquipment,
      withdrawnIds,
      preSelectedItems: selectedItems,
      destination: runDestination,
    });
  };
  
  // Resolve the active dungeon entrance + max selectable floor (formula:
  // entrance.difficulty + floor(highestPartyLevelEverReached / 2)).
  const activeDungeonIdForPrep = typeof window !== 'undefined'
    ? localStorage.getItem('menagerie_active_dungeon_id')
    : null;
  const activeEntranceForPrep = activeDungeonIdForPrep
    ? state.saveData.dungeonEntrances?.[activeDungeonIdForPrep]
    : undefined;
  const entranceFloorForPrep = runDestination === 'dungeon'
    ? Math.max(1, activeEntranceForPrep?.difficulty ?? 1)
    : undefined;
  const highestMonsterLevelEver = state.saveData.unlockedMonsters.reduce(
    (max, m) => Math.max(max, m.level ?? 1),
    1,
  );
  const maxStartFloorForPrep = entranceFloorForPrep !== undefined
    ? entranceFloorForPrep + Math.floor(highestMonsterLevelEver / 2)
    : undefined;
  
  // Show equipment selection screen
  if (showEquipmentSelect && partyForRun.length > 0) {
    const isHomeTower = activeEntranceForPrep?.isHome === true;
    const ownedScrollCount = (state.saveData.storedItems || [])
      .filter(i => i.id === 'town_portal_scroll')
      .reduce((sum, i) => sum + (i.quantity || 1), 0);
    const TOWN_PORTAL_PRICE = 80;
    return (
      <PreRunEquipment
        party={partyForRun}
        storedEquipment={state.saveData.storedEquipment || []}
        storedItems={state.saveData.storedItems || []}
        entranceFloor={entranceFloorForPrep}
        maxStartFloor={maxStartFloorForPrep}
        isHomeTower={runDestination === 'dungeon' ? isHomeTower : undefined}
        townGold={state.saveData.gold || 0}
        townPortalScrollPrice={TOWN_PORTAL_PRICE}
        ownedScrollCount={ownedScrollCount}
        onBuyTownPortalScroll={() => {
          if (!isCreativeMode()) {
            dispatch({ type: 'SPEND_TOWN_GOLD', amount: TOWN_PORTAL_PRICE });
          }
          dispatch({
            type: 'STORE_ITEM',
            item: { id: 'town_portal_scroll', name: 'Town Portal Scroll', quantity: 1, type: 'potion', effect: 'town_portal', value: 0 },
          });
          toast.success('Bought Town Portal Scroll!');
        }}
        onStart={startRun}
        onBack={() => setShowEquipmentSelect(false)}
      />
    );
  }
  
  const partyOrder = selectedParty.map(m => m.comboId);
  
  return <div className="min-h-screen w-full bg-background flex flex-col p-4">
      <div className="flex-1 flex flex-col w-full max-w-7xl mx-auto space-y-4">
        <h2 className="text-3xl font-bold text-center bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          Build Your Party {runDestination === 'overworld' ? '🗺️' : '🗼'}
        </h2>
        
        <p className="text-center text-muted-foreground text-sm">
          Select up to {MAX_PARTY_SIZE} monsters for your party. Click to add/remove, right-click to preview.
        </p>
        
        {/* Party slots */}
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-sm font-semibold">Party ({selectedParty.length}/{MAX_PARTY_SIZE})</h3>
            {selectedParty.length > 0 && (
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setSelectedParty([])}>
                Clear
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {Array.from({ length: MAX_PARTY_SIZE }).map((_, i) => {
              const member = selectedParty[i];
              return (
                <div
                  key={i}
                  className={`w-16 h-16 rounded-lg border-2 border-dashed flex items-center justify-center transition-all ${
                    member ? 'border-primary bg-primary/10 cursor-pointer' : 'border-muted-foreground/30'
                  }`}
                  onClick={() => member && togglePartyMember(member)}
                >
                  {member ? (
                    <div className="text-center">
                      <MonsterSprite species={member.species} element={member.element} classType={member.classType} size={36} animated={false} />
                      <p className="text-[8px] text-muted-foreground">Lv.{member.level}</p>
                    </div>
                  ) : (
                    <span className="text-muted-foreground/50 text-lg">+</span>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Preview with Stats */}
        {previewMonster && (
          <Card className="p-4">
            <div className="flex gap-4">
              <div className="flex flex-col items-center gap-2">
                <MonsterSprite 
                  species={previewMonster.species} 
                  element={previewMonster.element} 
                  classType={previewMonster.classType} 
                  size={100} 
                />
                <h3 className="font-bold text-lg capitalize text-center">
                  {previewMonster.species}
                </h3>
                <div className="flex gap-1 flex-wrap justify-center">
                  <span className={`element-badge element-${previewMonster.element} text-xs`}>
                    {previewMonster.element}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-muted text-xs font-medium">
                    {previewMonster.classType}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">
                  Level {previewMonster.level}
                </span>
              </div>
              
              <div className="flex-1 min-w-0">
                <MonsterStatsPreview
                  species={previewMonster.species}
                  classType={previewMonster.classType}
                  element={previewMonster.element}
                  level={previewMonster.level}
                />
                
                <div className="mt-3 p-2 bg-muted/50 rounded text-[10px] space-y-1">
                  <div>
                    <span className="font-medium">Class: </span>
                    {previewMonster.classType === 'normal' && 'No strengths or weaknesses'}
                    {previewMonster.classType === 'kinetic' && (
                      <><span className="text-green-600">Strong vs Energy/Bio</span> · <span className="text-red-500">Weak vs Chem/Pol</span></>
                    )}
                    {previewMonster.classType === 'energy' && (
                      <><span className="text-green-600">Strong vs Bio/Chem</span> · <span className="text-red-500">Weak vs Pol/Kin</span></>
                    )}
                    {previewMonster.classType === 'biological' && (
                      <><span className="text-green-600">Strong vs Chem/Pol</span> · <span className="text-red-500">Weak vs Kin/Energy</span></>
                    )}
                    {previewMonster.classType === 'chemical' && (
                      <><span className="text-green-600">Strong vs Pol/Kin</span> · <span className="text-red-500">Weak vs Energy/Bio</span></>
                    )}
                    {previewMonster.classType === 'political' && (
                      <><span className="text-green-600">Strong vs Kin/Energy</span> · <span className="text-red-500">Weak vs Bio/Chem</span></>
                    )}
                  </div>
                  <div>
                    <span className="font-medium">Element: </span>
                    {previewMonster.element === 'normal' && 'No strengths or weaknesses'}
                    {previewMonster.element === 'fire' && (
                      <><span className="text-green-600">Strong vs Air/Earth</span> · <span className="text-red-500">Weak vs Water/Void</span></>
                    )}
                    {previewMonster.element === 'water' && (
                      <><span className="text-green-600">Strong vs Fire/Void</span> · <span className="text-red-500">Weak vs Earth/Air</span></>
                    )}
                    {previewMonster.element === 'earth' && (
                      <><span className="text-green-600">Strong vs Water/Air</span> · <span className="text-red-500">Weak vs Fire/Void</span></>
                    )}
                    {previewMonster.element === 'air' && (
                      <><span className="text-green-600">Strong vs Void/Water</span> · <span className="text-red-500">Weak vs Fire/Earth</span></>
                    )}
                    {previewMonster.element === 'void' && (
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
              {sortedMonsters.map(monster => {
                const isInParty = selectedParty.some(m => m.comboId === monster.comboId);
                const partyIndex = partyOrder.indexOf(monster.comboId);
                return (
                  <Card 
                    key={monster.comboId} 
                    className={`p-2 cursor-pointer transition-all relative ${
                      isInParty 
                        ? 'ring-2 ring-primary bg-primary/10' 
                        : previewMonster?.comboId === monster.comboId 
                          ? 'border-primary/50' 
                          : 'hover:border-primary/50'
                    }`} 
                    onClick={() => togglePartyMember(monster)}
                    onContextMenu={(e) => { e.preventDefault(); setPreviewMonster(monster); }}
                  >
                    {isInParty && (
                      <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
                        {partyIndex + 1}
                      </span>
                    )}
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
                  </Card>
                );
              })}
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
          <Button className="flex-1 bg-gradient-to-r from-primary to-secondary" disabled={selectedParty.length === 0} onClick={proceedToEquipment}>
            {selectedParty.length === 0 
              ? 'Select at least 1 monster' 
              : state.saveData.storedEquipment?.length > 0 
                ? `Equip Party (${selectedParty.length}) →` 
                : `Start with ${selectedParty.length} monster${selectedParty.length > 1 ? 's' : ''}! ✨`
            }
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
  const { settings, updateSetting } = useSettings();
  const dungeon = state.run?.dungeon;
  const [showShop, setShowShop] = useState(false);
  const [showEquipment, setShowEquipment] = useState(false);
  const [showElevator, setShowElevator] = useState(false);
  // Workshop modal — opened by walking onto a workshop tile (rare) or by
  // consuming a Portable Workstation item from inventory.
  const [showWorkshop, setShowWorkshop] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const autoRunDirection = useRef<'up' | 'down' | 'left' | 'right' | null>(null);
  const stopAutoRun = useRef(false); // Immediate stop flag for auto-run
  const lastKeyPress = useRef<{ key: string; time: number } | null>(null);
  
  // Cloud save hook for admin save button
  const { saveToCloud, syncing: cloudSyncing, isAuthenticated } = useCloudSave();
  const { isAdmin } = useAdminRole();

  // ── Auto-equip on pickup ─────────────────────────────────────────────────
  // Watches run.equipmentInventory for newly added items. When the setting is
  // on, each new pickup is compared against the active monster's current piece
  // in that slot under the chosen focus and equipped if it's an upgrade. The
  // displaced item flows back into inventory automatically via EQUIP_ITEM.
  const prevInventoryIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const inv = state.run?.equipmentInventory;
    if (!inv) {
      prevInventoryIdsRef.current = new Set();
      return;
    }
    const prev = prevInventoryIdsRef.current;
    const currentIds = new Set(inv.map(i => i.id));
    if (!settings.autoEquipOnPickup) {
      prevInventoryIdsRef.current = currentIds;
      return;
    }
    const activeIdx = state.run.activePartyIndex;
    const activeMonster = state.run.party[activeIdx];
    if (!activeMonster || activeMonster.stats.currentHp <= 0) {
      prevInventoryIdsRef.current = currentIds;
      return;
    }
    const currentEquipment = state.run.partyEquipment[activeIdx] || createEmptyEquipment();
    const newItems = inv.filter(i => !prev.has(i.id));
    // Track slots already auto-equipped in this batch so two pickups in the
    // same tick don't both try to overwrite the same slot.
    const claimedSlots = new Set<string>();
    for (const item of newItems) {
      if (claimedSlots.has(item.slot)) continue;
      if (isPickupUpgrade(item, activeMonster, currentEquipment, settings.autoEquipFocus)) {
        claimedSlots.add(item.slot);
        dispatch({ type: 'EQUIP_ITEM', item, partyIndex: activeIdx });
      }
    }
    prevInventoryIdsRef.current = currentIds;
  }, [state.run?.equipmentInventory, settings.autoEquipOnPickup, settings.autoEquipFocus, state.run?.activePartyIndex, state.run?.party, state.run?.partyEquipment, dispatch]);


  
  // Click-to-move state
  const [targetPath, setTargetPath] = useState<Position[]>([]);
  const [isPathWalking, setIsPathWalking] = useState(false);
  const pathWalkRef = useRef<Position[]>([]);
  // Goal tile in CURRENT dungeon coordinates. Updated whenever the dungeon
  // expands (which shifts existing coordinates) so we can re-pathfind to the
  // correct destination instead of getting confused by stale path entries.
  const pathGoalRef = useRef<Position | null>(null);
  
  // Attack targeting state
  const [targetingMove, setTargetingMove] = useState<Move | null>(null);
  // When a combo move has both movement and attack, we stash the "next phase"
  // move here. After the current targeting phase resolves we re-enter targeting
  // with this clone (movement-only or attack-only) to complete the combo.
  const [pendingComboMove, setPendingComboMove] = useState<Move | null>(null);
  const [hoveredTile, setHoveredTile] = useState<Position | null>(null);
  const [targetingTiles, setTargetingTiles] = useState<Position[]>([]);
  const [affectedTiles, setAffectedTiles] = useState<Position[]>([]);
  // On touch devices, AoE moves require two taps on the same tile: first tap
  // previews the affected area, second tap (within window) commits the attack.
  // Single-target moves still fire on the first tap. Tracks { x, y, time }.
  const aoePendingConfirmRef = useRef<{ x: number; y: number; time: number } | null>(null);
  // Right-click an enemy → opens this attack menu
  const [attackMenuTarget, setAttackMenuTarget] = useState<EnemyAttackTarget | null>(null);
  // Right-click any other tile → opens the unified tile menu (waypoint, etc.)
  const [dungeonTileMenu, setDungeonTileMenu] = useState<{ x: number; y: number } | null>(null);
  
  // Level up screen queue state - supports multiple level-ups (active + passive party members)
  interface LevelUpEntry {
    previousStats: MonsterStats;
    previousLevel: number;
    newMoves: Move[];
    monster: Monster;
    isPassive?: boolean;
  }
  const [levelUpQueue, setLevelUpQueue] = useState<LevelUpEntry[]>([]);
  
  // Recruitment modal state
  const [showRecruitment, setShowRecruitment] = useState(false);
  const [defeatedEnemy, setDefeatedEnemy] = useState<Monster | null>(null);
  const [recruitChance, setRecruitChance] = useState(0);
  const [battleStats, setBattleStats] = useState({
    turnsUsed: 1, // Map kills are instant
    overkillDamage: 0,
    statusEffectsApplied: 0,
    criticalHits: 0,
  });
  // Queue of additional defeated enemies awaiting their own recruitment modal
  // (populated when a single AoE attack defeats multiple enemies at once).
  type RecruitQueueEntry = {
    enemy: Monster;
    chance: number;
    stats: { turnsUsed: number; overkillDamage: number; statusEffectsApplied: number; criticalHits: number };
  };
  const [recruitQueue, setRecruitQueue] = useState<RecruitQueueEntry[]>([]);
  
  // Dungeon revive modal state
  const [showDungeonReviveModal, setShowDungeonReviveModal] = useState(false);
  const [pendingDungeonReviveItem, setPendingDungeonReviveItem] = useState<InventoryItem | null>(null);
  const [stairExitDialogOpen, setStairExitDialogOpen] = useState(false);

  // Dungeon build mode (per-floor buildings persisted via snapshots)
  const [dungeonBuildPanelOpen, setDungeonBuildPanelOpen] = useState(false);
  const [dungeonBuildMode, setDungeonBuildMode] = useState(false);
  const [selectedDungeonBuildType, setSelectedDungeonBuildType] = useState<PlayerBuildingType | null>(null);
  // Dungeon building assign / context menus (mirror of OverworldView's flow).
  const [dungeonAssignBuilding, setDungeonAssignBuilding] = useState<import('@/game/buildings').PlayerBuilding | null>(null);
  const [dungeonContextBuilding, setDungeonContextBuilding] = useState<import('@/game/buildings').PlayerBuilding | null>(null);
  
  // Respawn state - tracks steps and threshold for step-based spawning
  const [stepsSinceLastSpawn, setStepsSinceLastSpawn] = useState(0);
  const [respawnStepThreshold, setRespawnStepThreshold] = useState(RESPAWN_CONFIG.baseSteps);
  const lastFloorRef = useRef<number>(dungeon?.floor ?? 1);
  const lastDungeonRunRef = useRef<unknown>(state.run);
  
  // Ref for enemy processing to avoid circular dependency
  const processEnemyTurnsRef = useRef<((dungeon: import('@/game/types').DungeonState | null) => void) | null>(null);
  
  useEffect(() => {
    if (!dungeon) {
      // Look up the active dungeon entrance to apply theme + starting floor.
      const activeId = typeof window !== 'undefined'
        ? localStorage.getItem('menagerie_active_dungeon_id')
        : null;
      const entrance = activeId ? state.saveData.dungeonEntrances?.[activeId] : undefined;
      const baseFloor = Math.max(1, entrance?.difficulty ?? 1);

      // Honour the player's chosen start floor from the pre-run prep, clamped
      // to the legal range [baseFloor, baseFloor + floor(highestLevel / 2)].
      const rawSelected = typeof window !== 'undefined'
        ? Number(localStorage.getItem('menagerie_selected_start_floor') || '0')
        : 0;
      const highestLevelEver = state.saveData.unlockedMonsters.reduce(
        (max, m) => Math.max(max, m.level ?? 1),
        1,
      );
      const maxAllowed = baseFloor + Math.floor(highestLevelEver / 2);
      const startingFloor = rawSelected > 0
        ? Math.min(maxAllowed, Math.max(baseFloor, rawSelected))
        : baseFloor;

      // Consume the choice so subsequent floors / fresh runs aren't affected.
      if (typeof window !== 'undefined') {
        localStorage.removeItem('menagerie_selected_start_floor');
      }

      const freshDungeon = generateDungeon(startingFloor, entrance?.theme, startingFloor);
      // Hydrate from persistent floor snapshot (mined walls, opened tiles,
      // collected chests survive across runs). Enemies stay fresh from gen.
      const hydrated = hydrateDungeonFromSnapshot(freshDungeon, entrance);
      // Mark the entry tile so an "up" staircase appears beneath the player —
      // stepping back onto it exits the dungeon to the overworld / summary.
      const spawn = hydrated.playerPosition;
      const entryTiles = hydrated.tiles.map((row, y) =>
        row.map((t, x) => (x === spawn.x && y === spawn.y ? { ...t, stairsBeneath: 'up' as const } : t))
      );
      dispatch({
        type: 'SET_DUNGEON',
        dungeon: { ...hydrated, tiles: entryTiles }
      });
    }
  }, [dungeon, dispatch, state.saveData.dungeonEntrances, state.saveData.unlockedMonsters]);
  
  // ─── Manual save for admins: flush in-memory dungeon/run into saveData ───
  const handleManualSave = useCallback(async () => {
    if (!isAdmin) return; // Only admins can manual save from dungeon
    
    // Build snapshot from current run (dungeon state is in state.run)
    const snapshot = buildProgressSnapshot(state.saveData, state.run, null);
    dispatch({ type: 'SNAPSHOT_RUN_PROGRESS', overworld: null });
    
    if (!isAuthenticated) {
      toast.success('💾 Saved locally (sign in to back up to cloud)');
      addLog('💾 Game saved locally', 'system');
      return;
    }
    
    const result = await saveToCloud(snapshot);
    if (result.success) {
      toast.success('☁️ Saved to cloud');
      addLog('☁️ Game saved to cloud', 'system');
    } else {
      toast.error(`Save failed: ${result.error || 'unknown error'}`);
    }
  }, [dispatch, state.saveData, state.run, isAdmin, isAuthenticated, saveToCloud, addLog]);

  // ─── Suspend run and return to main menu ───
  // Snapshots the current run into saveData (no END_RUN) and switches to the
  // main menu phase. Resume from the main menu drops the player back into the
  // dungeon at the exact same spot. Pushes to cloud if signed in.
  const handleMainMenu = useCallback(async () => {
    addLog('💾 Saving and returning to main menu...', 'system');
    const snapshot = buildProgressSnapshot(state.saveData, state.run, null);
    dispatch({ type: 'SNAPSHOT_RUN_PROGRESS', overworld: null });
    if (isAuthenticated) {
      const result = await saveToCloud(snapshot);
      if (result.success) toast.success('☁️ Saved — returning to menu');
      else toast.error(`Save failed: ${result.error || 'unknown'} — returning anyway`);
    } else {
      toast.success('💾 Saved locally — returning to menu');
    }
    dispatch({ type: 'SET_PHASE', phase: 'main_menu' });
  }, [dispatch, state.saveData, state.run, isAuthenticated, saveToCloud, addLog]);

  // Reset respawn counter when floor changes OR a new run starts (so a fresh
  // dungeon doesn't inherit the accelerated spawn threshold from the prior run).
  useEffect(() => {
    if (!dungeon) return;
    const runChanged = state.run !== lastDungeonRunRef.current;
    const floorChanged = dungeon.floor !== lastFloorRef.current;
    if (runChanged || floorChanged) {
      lastFloorRef.current = dungeon.floor;
      lastDungeonRunRef.current = state.run;
      setStepsSinceLastSpawn(0);
      setRespawnStepThreshold(RESPAWN_CONFIG.baseSteps);
      if (floorChanged) {
        addLog('🔄 Respawn counter reset on new floor.', 'system');
      }
    }
  }, [dungeon, state.run, addLog]);
  
  // Step-based respawn check - called when player moves
  const checkStepRespawn = useCallback(() => {
    if (!dungeon) return;
    
    const newStepCount = stepsSinceLastSpawn + 1;
    
    if (shouldRespawn(newStepCount, respawnStepThreshold)) {
      // Attempt to spawn a monster
      const result = spawnMonsterInHiddenRoom(dungeon);
      
      if (result.spawned && result.monster) {
        dispatch({
          type: 'SET_DUNGEON',
          dungeon: result.dungeon
        });
        
        // Check if we should warn about attracting attention
        const nextThreshold = calculateNextStepThreshold(respawnStepThreshold);
        if (shouldWarnAttention(nextThreshold) && !shouldWarnAttention(respawnStepThreshold)) {
          addLog('⚠️ You are attracting more attention! Monsters spawn faster now.', 'status');
        } else if (getAttentionLevel(nextThreshold) > 0.8) {
          addLog('🚨 The dungeon is swarming with activity!', 'status');
        } else {
          addLog(`👁️ Something stirs in the darkness...`, 'info');
        }
        
        setRespawnStepThreshold(nextThreshold);
        setStepsSinceLastSpawn(0); // Reset step counter after spawn
      } else {
        // No spawn location available, keep counting
        setStepsSinceLastSpawn(newStepCount);
      }
    } else {
      setStepsSinceLastSpawn(newStepCount);
    }
  }, [dungeon, stepsSinceLastSpawn, respawnStepThreshold, dispatch, addLog]);
  
  // When the active monster falls outside of turn-based battle (trap, terrain hazard,
  // ranged enemy attack, etc.), try to switch to the next conscious party member
  // instead of immediately ending the run. The run only truly ends when the entire
  // party is wiped out.
  const handleActiveMonsterDownOnMap = useCallback((cause: string) => {
    if (!state.run) return;
    const party = state.run.party;
    const activeIndex = state.run.activePartyIndex;
    const nextAliveIndex = party.findIndex((m, i) => i !== activeIndex && m.stats.currentHp > 0);
    
    if (nextAliveIndex >= 0) {
      const next = party[nextAliveIndex];
      addLog(`💀 ${state.run.currentMonster.name} fell to ${cause}! ${next.name} steps up!`, 'damage');
      dispatch({ type: 'SWITCH_ACTIVE_MONSTER', index: nextAliveIndex });
      toast.success(`Go, ${next.species}!`);
    } else {
      addLog(`☠️ Your entire party has fallen! Returning to town...`, 'damage');
      dispatch({ type: 'END_RUN', victory: false });
      dispatch({ type: 'SET_PHASE', phase: 'run_summary' });
    }
  }, [state.run, dispatch, addLog]);
  const handleMove = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (!dungeon || !state.run) return;
    const result = movePlayer(dungeon, direction);

    // Mining: bumped into a mineable wall. If the player owns a strong enough
    // pickaxe, apply a hit (consumes the turn). Otherwise show a hint toast.
    if (result.mineableBump) {
      const pickaxeTier = effectiveTools(state.saveData.tools).pickaxe;
      const wallTier = result.mineableBump.tier;
      const wallName = mineableWallName(wallTier);
      if (!pickaxeTier) {
        toast.info(`This is ${wallName}. You need a Pickaxe to mine it.`);
        return;
      }
      const needed = hitsToBreak(wallTier, pickaxeTier);
      if (!isFinite(needed)) {
        toast.info(`Your ${PICKAXE_TIERS[pickaxeTier].name} is too weak for ${wallName}.`);
        return;
      }
      const mineResult = mineWall(dungeon, result.mineableBump.x, result.mineableBump.y, pickaxeTier);
      if (!mineResult) return;
      dispatch({ type: 'SET_DUNGEON', dungeon: mineResult.dungeon });
      if (mineResult.broken && mineResult.drop) {
        dispatch({
          type: 'ADD_MATERIAL',
          materialId: mineResult.drop.materialId,
          quantity: mineResult.drop.quantity,
        });
        addLog(`⛏️ Mined ${wallName}! +${mineResult.drop.quantity} ${wallName}`, 'loot');
      } else {
        addLog(`⛏️ Chipped ${wallName} (${mineResult.hits}/${mineResult.hitsNeeded})`, 'system');
      }
      return;
    }

    // Nest bump: attack the nest with the active monster's attack stat (consumes the turn).
    if (result.nestBump) {
      const monster = state.run.currentMonster;
      const attack = monster.stats.attack ?? 5;
      const damage = Math.max(1, Math.floor(attack));
      const damageResult = damageDungeonNest(dungeon, result.nestBump.x, result.nestBump.y, damage);
      dispatch({ type: 'SET_DUNGEON', dungeon: damageResult.dungeon });
      if (damageResult.destroyed && damageResult.nest) {
        const rewards = getNestDestroyRewards(damageResult.nest);
        dispatch({ type: 'ADD_GOLD', amount: rewards.gold });
        for (const mat of rewards.materials) {
          dispatch({ type: 'ADD_MATERIAL', materialId: mat.id, quantity: 1 });
        }
        addLog(`💥 Destroyed the ${damageResult.nest.element} nest! +${rewards.gold} gold, +${rewards.materials.length} materials`, 'loot');
      } else if (damageResult.nest) {
        addLog(`⚔️ Hit the ${damageResult.nest.element} nest for ${damage}! (${damageResult.nest.hp}/${damageResult.nest.maxHp} HP)`, 'damage');
      }
      // Let enemies act after this attack
      setTimeout(() => {
        processEnemyTurnsRef.current?.(damageResult.dungeon);
      }, 100);
      return;
    }

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
    
    // Stream new dungeon strips on whichever sides the player is now near.
    // expandDungeonIfNeeded is a no-op when no edge is close, so this is cheap.
    const expandedDungeon = expandDungeonIfNeeded(result.dungeon);
    dispatch({
      type: 'SET_DUNGEON',
      dungeon: expandedDungeon,
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
      // Persistent staircases: snapshot current floor, then descend.
      const visited = { ...(dungeon.visitedFloors || {}) };
      visited[dungeon.floor] = {
        tiles: dungeon.tiles,
        enemies: dungeon.enemies,
        playerPosition: dungeon.playerPosition,
        width: dungeon.width,
        height: dungeon.height,
        entryPosition: dungeon.entryPosition,
        playerBuildings: dungeon.playerBuildings,
        roads: dungeon.roads,
      };
      const nextFloorNum = dungeon.floor + 1;
      const cached = visited[nextFloorNum];
      let newDungeon: DungeonState;
      if (cached) {
        newDungeon = {
          floor: nextFloorNum,
          tiles: cached.tiles,
          enemies: cached.enemies,
          playerPosition: cached.playerPosition,
          width: cached.width,
          height: cached.height,
          theme: dungeon.theme,
          startingFloor: dungeon.startingFloor,
          entryPosition: cached.entryPosition ?? cached.playerPosition,
          visitedFloors: visited,
          playerBuildings: cached.playerBuildings,
          roads: cached.roads,
        };
      } else {
        const activeId = typeof window !== 'undefined' ? localStorage.getItem('menagerie_active_dungeon_id') : null;
        const entrance = activeId ? state.saveData.dungeonEntrances?.[activeId] : undefined;
        const fresh = hydrateDungeonFromSnapshot(
          generateDungeon(nextFloorNum, dungeon.theme, dungeon.startingFloor),
          entrance,
        );
        const tiles = fresh.tiles.map(row => row.map(t => ({ ...t })));
        const spawn = fresh.playerPosition;
        tiles[spawn.y][spawn.x].stairsBeneath = 'up';
        newDungeon = { ...fresh, tiles, entryPosition: { ...spawn }, visitedFloors: visited };
      }
      dispatch({ type: 'SET_DUNGEON', dungeon: newDungeon });
      addLog(`⬇️ Descended to Floor ${nextFloorNum}!`, 'system');
      const towerId = typeof window !== 'undefined' ? localStorage.getItem('menagerie_active_dungeon_id') : null;
      if (towerId) {
        const partySnapshot = state.run?.party?.map(m => ({
          species: m.species, class: m.class, element: m.element, level: m.level,
        })) ?? null;
        void submitTowerFloor(towerId, nextFloorNum, partySnapshot);
      }
      return;
    } else if (result.stairsUp && dungeon.floor <= (dungeon.startingFloor ?? 1)) {
      // Stepped onto the entry staircase — ask where to exit to.
      setStairExitDialogOpen(true);
      return;
    } else if (result.stairsUp && dungeon.floor > 1) {
      const visited = { ...(dungeon.visitedFloors || {}) };
      visited[dungeon.floor] = {
        tiles: dungeon.tiles,
        enemies: dungeon.enemies,
        playerPosition: dungeon.playerPosition,
        width: dungeon.width,
        height: dungeon.height,
        entryPosition: dungeon.entryPosition,
        playerBuildings: dungeon.playerBuildings,
        roads: dungeon.roads,
      };
      const prevFloorNum = dungeon.floor - 1;
      const cached = visited[prevFloorNum];
      const newDungeon: DungeonState = cached
        ? {
            floor: prevFloorNum,
            tiles: cached.tiles,
            enemies: cached.enemies,
            playerPosition: cached.playerPosition,
            width: cached.width,
            height: cached.height,
            theme: dungeon.theme,
            startingFloor: dungeon.startingFloor,
            entryPosition: cached.entryPosition ?? cached.playerPosition,
            visitedFloors: visited,
            playerBuildings: cached.playerBuildings,
            roads: cached.roads,
          }
        : (() => {
            const activeId = typeof window !== 'undefined' ? localStorage.getItem('menagerie_active_dungeon_id') : null;
            const entrance = activeId ? state.saveData.dungeonEntrances?.[activeId] : undefined;
            const fresh = hydrateDungeonFromSnapshot(
              generateDungeon(prevFloorNum, dungeon.theme, dungeon.startingFloor),
              entrance,
            );
            return { ...fresh, visitedFloors: visited };
          })();
      dispatch({ type: 'SET_DUNGEON', dungeon: newDungeon });
      addLog(`⬆️ Ascended to Floor ${prevFloorNum}.`, 'system');
      return;
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
          handleActiveMonsterDownOnMap('a spike trap');
        }
      } else if (result.trap.type === 'poison') {
        addLog('☠️ Poisoned by a trap!', 'status');
      } else if (result.trap.type === 'alarm') {
        addLog('🔔 Alarm trap! Enemies alerted!', 'status');
      }
    } else if (result.terrain) {
      const terrainConfig = TERRAIN_CONFIG[result.terrain.type];
      const isFavored = isMonsterFavoredOnTerrain(state.run.currentMonster, result.terrain.type);
      
      if (isFavored) {
        addLog(`${terrainConfig.icon} You thrive on ${terrainConfig.name}! Damage bonus active!`, 'system');
      } else {
        const damage = calculateTerrainDamage(state.run.currentMonster, result.terrain.type);
        if (damage > 0) {
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
          addLog(`${terrainConfig.icon} ${terrainConfig.name} hazard! Took ${damage} damage!`, 'damage');
          if (newHp <= 0) {
            handleActiveMonsterDownOnMap(`${terrainConfig.name} hazard`);
          }
        }
      }
    } else if (result.shop) {
      setShowShop(true);
    } else if (result.elevator) {
      setShowElevator(true);
    } else if (result.plant) {
      // Harvest plant - add material to run materials
      dispatch({
        type: 'ADD_MATERIAL',
        materialId: result.plant.materialId,
        quantity: 1
      });
      addLog(`🌿 Harvested ${result.plant.plantType.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')}!`, 'loot');
    }

    // Shovel rune harvest: if the player walked onto a rune AND owns a strong
    // enough shovel AND auto-shovel is enabled, instantly dig it up.
    // Mismatched diggers still took the backlash damage above (handled in the
    // terrain branch). Single-hit by design — runes are surface inscriptions,
    // not bedrock.
    if (result.runeBump && isAutoShovelEnabled()) {
      const shovelTier = effectiveTools(state.saveData.tools).shovel;
      const runeType = result.runeBump.terrainType;
      const needed = shovelHitsToBreak(runeType, shovelTier);
      if (shovelTier && isFinite(needed)) {
        const newDungeon = digRune(result.dungeon, result.runeBump.x, result.runeBump.y);
        if (newDungeon) {
          const drop = rollRuneDrop(runeType);
          dispatch({ type: 'SET_DUNGEON', dungeon: newDungeon });
          dispatch({
            type: 'ADD_MATERIAL',
            materialId: drop.materialId,
            quantity: drop.quantity,
          });
          const cfg = TERRAIN_CONFIG[runeType];
          addLog(`🪏 Dug up ${cfg.name}! +${drop.quantity} ${cfg.name} Stone`, 'loot');
          // Mutate result.dungeon so downstream steps (nest tick, enemy turn)
          // operate on the post-dig map and don't overwrite the removal.
          result.dungeon = newDungeon;
        }
      }
    }

    // Check for step-based respawn (only on successful moves)
    if (!result.blocked) {
      checkStepRespawn();
    }
    
    // Tick dungeon nests on successful, non-event moves: explored nests may spawn an adjacent enemy.
    let dungeonForEnemyTurn = result.dungeon;
    if (!result.blocked && !result.encounter) {
      const tickResult = tickDungeonNests(result.dungeon);
      if (tickResult.spawns.length > 0) {
        let workingDungeon = tickResult.dungeon;
        const newEnemies = [...workingDungeon.enemies];
        const newTiles = workingDungeon.tiles.map(row => row.map(t => ({ ...t })));
        for (const { nestX, nestY, nest } of tickResult.spawns) {
          // Find an adjacent floor tile to spawn on
          const offsets = [[0,-1],[1,0],[0,1],[-1,0],[1,-1],[1,1],[-1,1],[-1,-1]].sort(() => Math.random() - 0.5);
          for (const [dx, dy] of offsets) {
            const sx = nestX + dx, sy = nestY + dy;
            if (sy < 0 || sy >= newTiles.length || sx < 0 || sx >= newTiles[0].length) continue;
            if (newTiles[sy][sx].type !== 'floor') continue;
            const enemy = spawnNestMonster(nest);
            newTiles[sy][sx].type = 'enemy';
            newTiles[sy][sx].enemyId = enemy.id;
            newEnemies.push(enemy);
            addLog(`🪺 A ${enemy.name} emerges from a nearby nest!`, 'damage');
            break;
          }
        }
        workingDungeon = { ...workingDungeon, tiles: newTiles, enemies: newEnemies };
        dispatch({ type: 'SET_DUNGEON', dungeon: workingDungeon });
        dungeonForEnemyTurn = workingDungeon;
      } else {
        dispatch({ type: 'SET_DUNGEON', dungeon: tickResult.dungeon });
        dungeonForEnemyTurn = tickResult.dungeon;
      }
    }

    // Process enemy turns after player moves (if not entering battle/shop/etc.)
    if (!result.blocked && !result.encounter && !result.shop && !result.elevator && !result.stairs) {
      // Delay enemy processing slightly to allow UI update
      setTimeout(() => {
        processEnemyTurnsRef.current?.(dungeonForEnemyTurn);
      }, 100);
    }
  }, [dungeon, dispatch, state.run, checkStepRespawn]);
  // Use refs to always have fresh state for auto-run (avoids stale closures)
  const dungeonRef = useRef(dungeon);
  const handleMoveRef = useRef(handleMove);
  const autoHarvestTargetRef = useRef<(Position & { tileType: 'mineable_wall' | 'terrain' }) | null>(null);
  const autoHarvestTimerRef = useRef<number | null>(null);
  
  useEffect(() => {
    dungeonRef.current = dungeon;
  }, [dungeon]);
  
  useEffect(() => {
    handleMoveRef.current = handleMove;
  }, [handleMove]);

  const cancelAutoHarvest = useCallback((reason?: string) => {
    if (typeof window !== 'undefined' && autoHarvestTimerRef.current !== null) {
      window.clearInterval(autoHarvestTimerRef.current);
      autoHarvestTimerRef.current = null;
    }
    if (autoHarvestTargetRef.current && reason) addLog(reason, 'info');
    autoHarvestTargetRef.current = null;
  }, [addLog]);

  const startDungeonAutoHarvest = useCallback((targetX: number, targetY: number) => {
    if (typeof window === 'undefined') return;
    cancelAutoHarvest();
    const currentDungeon = dungeonRef.current;
    const tile = currentDungeon?.tiles[targetY]?.[targetX];
    if (!currentDungeon || !tile || (tile.type !== 'mineable_wall' && tile.type !== 'terrain')) return;
    autoHarvestTargetRef.current = { x: targetX, y: targetY, tileType: tile.type };
    const stepDelay = Math.max(120, settings.autoRunSpeed || 100);
    autoHarvestTimerRef.current = window.setInterval(() => {
      const target = autoHarvestTargetRef.current;
      const liveDungeon = dungeonRef.current;
      if (!target || !liveDungeon) {
        cancelAutoHarvest();
        return;
      }
      if (hasVisibleEnemy(liveDungeon.tiles)) {
        cancelAutoHarvest('⚠️ Auto-Harvest stopped — enemy spotted!');
        return;
      }
      const liveTile = liveDungeon.tiles[target.y]?.[target.x];
      if (!liveTile || liveTile.type !== target.tileType) {
        cancelAutoHarvest('✅ Auto-Harvest finished — resource depleted.');
        return;
      }
      const direction = getDirection(liveDungeon.playerPosition, { x: target.x, y: target.y });
      if (!direction) {
        cancelAutoHarvest('⚠️ Auto-Harvest stopped — moved out of range.');
        return;
      }
      if (isMovingRef.current) return;
      isMovingRef.current = true;
      handleMoveRef.current(direction);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        isMovingRef.current = false;
      }));
      setTimeout(() => { isMovingRef.current = false; }, 250);
    }, stepDelay);
  }, [cancelAutoHarvest, settings.autoRunSpeed]);

  useEffect(() => () => cancelAutoHarvest(), [cancelAutoHarvest]);

  // Auto-run logic - uses requestAnimationFrame for smooth timing
  // Track if a move is currently being processed to prevent overlapping moves
  const isMovingRef = useRef(false);
  
  useEffect(() => {
    if (!isAutoRunning || !autoRunDirection.current) return;
    
    // Reset stop flag when starting auto-run
    stopAutoRun.current = false;
    
    let lastMoveTime = 0;
    let animationFrameId: number;
    
    const runStep = (timestamp: number) => {
      // Check stop flag first (immediate response)
      if (stopAutoRun.current) {
        setIsAutoRunning(false);
        autoRunDirection.current = null;
        stopAutoRun.current = false;
        return;
      }
      
      const currentDungeon = dungeonRef.current;
      if (!autoRunDirection.current || !currentDungeon) {
        setIsAutoRunning(false);
        return;
      }
      
      // Skip if a move is still being processed
      if (isMovingRef.current) {
        animationFrameId = requestAnimationFrame(runStep);
        return;
      }
      
        // Only move after enough time has passed
        if (timestamp - lastMoveTime >= settings.autoRunSpeed) {
          const direction = autoRunDirection.current;
          const dx = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
          const dy = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;
          const nextX = currentDungeon.playerPosition.x + dx;
          const nextY = currentDungeon.playerPosition.y + dy;
          
          // Check if we should stop before moving
          if (shouldStopAutoRun(currentDungeon.tiles, nextX, nextY, currentDungeon.width, currentDungeon.height)) {
            setIsAutoRunning(false);
            autoRunDirection.current = null;
            return;
          }
          
          // Also stop if any enemy is currently visible (spotted!)
          if (hasVisibleEnemy(currentDungeon.tiles)) {
            setIsAutoRunning(false);
            autoRunDirection.current = null;
            return;
          }
        
        isMovingRef.current = true;
        handleMoveRef.current(direction);
        // Allow next move after a short delay for state to settle. Use BOTH
        // rAF and a setTimeout fallback — on mobile, rAF is paused when the
        // tab/screen goes to background, which would otherwise leave the
        // movement lock stuck `true` forever and freeze the player.
        requestAnimationFrame(() => {
          isMovingRef.current = false;
        });
        setTimeout(() => { isMovingRef.current = false; }, 200);
        lastMoveTime = timestamp;
      }
      
      // Continue the loop
      animationFrameId = requestAnimationFrame(runStep);
    };
    
    // Start the animation loop
    animationFrameId = requestAnimationFrame(runStep);
    
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isAutoRunning, settings.autoRunSpeed]);

  // Keyboard input with double-tap detection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showShop) return;
      
      // If auto-running or path-walking, any key stops it
      if (isAutoRunning) {
       stopAutoRun.current = true; // Stop immediately
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
  const handleFlee = (destination: 'entrance' | 'town' | 'menu' = 'entrance', skipConfirm = false) => {
    const origin = typeof window !== 'undefined'
      ? localStorage.getItem('menagerie_run_origin')
      : null;
    const activeId = typeof window !== 'undefined'
      ? localStorage.getItem('menagerie_active_dungeon_id')
      : null;
    const activeEntrance = activeId ? state.saveData?.dungeonEntrances?.[activeId] : undefined;
    const isHomeTower = activeEntrance?.isHome === true;

    // Confirm before leaving — exiting abandons floor progress in this run.
    const currentFloor = dungeon?.floor ?? 1;
    if (!skipConfirm) {
      const confirmMsg =
        `Exit the dungeon on Floor ${currentFloor}?\n\n` +
        `You'll keep your gold, materials, items, and equipment, but you'll lose your place on every floor of this run. Stairs you've placed will be regenerated next time.`;
      if (typeof window !== 'undefined' && !window.confirm(confirmMsg)) {
        return;
      }
    }

    // Non-home towers require a Town Portal Scroll to escape.
    // Creative Mode bypasses the scroll requirement entirely.
    if (!isHomeTower && !isCreativeMode()) {
      const scroll = state.run?.inventory.find(i => i.id === 'town_portal_scroll');
      if (!scroll) {
        toast.error('You need a Town Portal Scroll to flee this tower!', {
          description: 'Only the Tower of the Infinite can be exited freely. Buy or craft a scroll in town next time.',
        });
        addLog('📜 You have no Town Portal Scroll — you cannot escape this tower!', 'info');
        return;
      }
      dispatch({ type: 'USE_ITEM', itemId: 'town_portal_scroll' });
      addLog('📜 You tear open a Town Portal Scroll — a swirling gateway home appears!', 'system');
    }

    dispatch({ type: 'FLEE_DUNGEON' });

    if (destination === 'menu') {
      dispatch({ type: 'SET_PHASE', phase: 'main_menu' });
      addLog('🚪 Exited the dungeon — returned to the main menu.', 'system');
      return;
    }

    if (destination === 'town') {
      // Move overworld player to home base, then enter overworld.
      const ow = state.saveData.overworldState;
      if (ow?.homeBase?.position) {
        dispatch({
          type: 'UPDATE_OVERWORLD',
          overworld: { ...ow, playerPosition: { ...ow.homeBase.position } },
        });
      }
      dispatch({ type: 'SET_PHASE', phase: 'overworld' });
      addLog('🚪 Exited the dungeon — back to the starting town.', 'system');
      return;
    }

    // destination === 'entrance' (default)
    if (origin === 'overworld') {
      // FLEE_DUNGEON already respawns the player next to the entrance.
      dispatch({ type: 'SET_PHASE', phase: 'overworld' });
      addLog('🚪 Exited the dungeon — back to the overworld.', 'system');
    } else {
      dispatch({ type: 'SET_PHASE', phase: 'run_summary' });
      addLog('🚪 Escaped safely! Materials and equipment kept.', 'system');
    }
  };

  
  // Click-to-move handler
  const handleTileClick = useCallback((x: number, y: number) => {
   if (!dungeon) return;
   
   // Cancel any active auto-run or path-walking first
   if (isAutoRunning) {
     stopAutoRun.current = true; // Stop immediately
     setIsAutoRunning(false);
     autoRunDirection.current = null;
   }
   if (isPathWalking) {
     setIsPathWalking(false);
     setTargetPath([]);
     pathWalkRef.current = [];
     pathGoalRef.current = null;
   }
    
    // Don't path to current position
    if (dungeon.playerPosition.x === x && dungeon.playerPosition.y === y) return;
    
    const path = findPath(dungeon, dungeon.playerPosition, { x, y });
    if (path && path.length > 0) {
      setTargetPath(path);
      pathWalkRef.current = path;
      pathGoalRef.current = { x, y };
      setIsPathWalking(true);
    } else {
      addLog("❌ Can't reach that tile!", 'info');
    }
 }, [dungeon, isPathWalking, isAutoRunning, setIsPathWalking, setIsAutoRunning]);
  
  // Path walking effect — position-driven so it stays in sync with React state
  // updates even on slower mobile devices. Each tick:
  //   1. Read the live player position from dungeonRef
  //   2. Drop any leading path nodes the player is already standing on
  //   3. Only step when adjacent to path[0]; otherwise wait for state to catch up
  // This prevents the "weird zig-zag" bug where the path advanced before the
  // player's tile actually moved, causing direction to be computed from a stale
  // position to a non-adjacent goal.
  useEffect(() => {
    if (!isPathWalking || pathWalkRef.current.length === 0) {
      if (isPathWalking) {
        setIsPathWalking(false);
        setTargetPath([]);
      }
      return;
    }

    let lastMoveTime = 0;
    let animationFrameId: number;
    // Track dungeon dimensions to detect coordinate shifts caused by
    // expandDungeonIfNeeded prepending rows/columns at the west/north edges.
    // When dimensions change, both the player position AND the goal position
    // get shifted by the same offset, so we recompute the path.
    let lastWidth = dungeonRef.current?.width ?? 0;
    let lastHeight = dungeonRef.current?.height ?? 0;

    const walkStep = (timestamp: number) => {
      const currentDungeon = dungeonRef.current;
      let currentPath = pathWalkRef.current;

      if (currentPath.length === 0 || !currentDungeon) {
        setIsPathWalking(false);
        setTargetPath([]);
        return;
      }

      // Detect dungeon expansion. West/north prepends shift coordinates by
      // STRIP_WIDTH (12). The player position is shifted automatically inside
      // expandDungeonIfNeeded; we just need to shift the stored goal and
      // re-pathfind so the stale path doesn't send us in the wrong direction.
      if (currentDungeon.width !== lastWidth || currentDungeon.height !== lastHeight) {
        const dx = currentDungeon.width - lastWidth;   // columns added (west prepend if x shifted)
        const dy = currentDungeon.height - lastHeight; // rows added (north prepend if y shifted)
        // Heuristic: if a strip was prepended on west/north, the player x/y
        // jumped by STRIP_WIDTH. We shift the goal by the same delta only when
        // a prepend likely happened. We can detect prepend by checking whether
        // the player is now near the *opposite* edge or not — but simpler:
        // just re-pathfind from current player to goal (translated by the same
        // delta if the prepend happened on that axis).
        if (pathGoalRef.current) {
          // Try goal as-is first; if no path, try shifted goal (covers prepend).
          let goal = pathGoalRef.current;
          let repath = findPath(currentDungeon, currentDungeon.playerPosition, goal);
          if (!repath || repath.length === 0) {
            const shifted = { x: goal.x + dx, y: goal.y + dy };
            repath = findPath(currentDungeon, currentDungeon.playerPosition, shifted);
            if (repath && repath.length > 0) {
              goal = shifted;
              pathGoalRef.current = shifted;
            }
          }
          if (repath && repath.length > 0) {
            pathWalkRef.current = repath;
            setTargetPath(repath);
            currentPath = repath;
          } else {
            pathWalkRef.current = [];
            setIsPathWalking(false);
            setTargetPath([]);
            pathGoalRef.current = null;
            return;
          }
        }
        lastWidth = currentDungeon.width;
        lastHeight = currentDungeon.height;
      }

      const playerPos = currentDungeon.playerPosition;

      // Trim any path nodes the player has already reached. Handles the case
      // where dungeonRef catches up across multiple frames in one go.
      while (currentPath.length > 0 && currentPath[0].x === playerPos.x && currentPath[0].y === playerPos.y) {
        currentPath = currentPath.slice(1);
      }
      pathWalkRef.current = currentPath;

      if (currentPath.length === 0) {
        pathWalkRef.current = [];
        setIsPathWalking(false);
        setTargetPath([]);
        pathGoalRef.current = null;
        return;
      }

      // Skip if a move is still being processed
      if (isMovingRef.current) {
        animationFrameId = requestAnimationFrame(walkStep);
        return;
      }

      // Only move after enough time has passed
      if (timestamp - lastMoveTime >= settings.autoRunSpeed) {
        const nextPos = currentPath[0];
        const direction = getDirection(playerPos, nextPos);

        // Not adjacent — wait one frame for the dungeon ref to catch up. If
        // it's still not adjacent next tick, the trim loop will eventually
        // resolve it (or expansion-handling above will repath).
        if (!direction) {
          animationFrameId = requestAnimationFrame(walkStep);
          return;
        }

        // Check if we should stop (enemy, trap, etc.)
        const shouldStop = shouldStopAutoRun(currentDungeon.tiles, nextPos.x, nextPos.y, currentDungeon.width, currentDungeon.height);

        isMovingRef.current = true;
        handleMoveRef.current(direction);
        // Hold the move-lock for two frames so React commits the dungeon update
        // before the next direction is computed. Add a setTimeout fallback so
        // the lock can never stay stuck if rAF is paused (mobile background tab).
        requestAnimationFrame(() => requestAnimationFrame(() => {
          isMovingRef.current = false;
        }));
        setTimeout(() => { isMovingRef.current = false; }, 250);
        lastMoveTime = timestamp;

        // Don't slice the path here — the next tick trims based on actual
        // player position, which is the source of truth.
        if (shouldStop) {
          pathWalkRef.current = [];
          setIsPathWalking(false);
          setTargetPath([]);
          pathGoalRef.current = null;
          return;
        }
      }

      // Continue the loop
      animationFrameId = requestAnimationFrame(walkStep);
    };

    // Start the animation loop
    animationFrameId = requestAnimationFrame(walkStep);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isPathWalking, settings.autoRunSpeed]);
  
  // Party switch handler
  const handlePartySwitch = useCallback((index: number) => {
    dispatch({ type: 'SWITCH_ACTIVE_MONSTER', index });
    addLog(`🔄 Switched to ${state.run?.party[index]?.species}!`, 'system');
  }, [dispatch, state.run?.party]);
  const handleBuyItem = (item: LootItem, price: number) => {
    // Use the price the shop UI showed the player — not a recomputed value.
    // Recomputing here previously caused the displayed price (e.g. 50g) to
    // diverge from the deducted price (e.g. 1498g for a Full Heal), making
    // it look like gold "wasn't updating" because the click silently no-op'd
    // when the player couldn't actually afford the hidden true cost.
    const creative = isCreativeMode();
    if (state.run && (creative || state.run.gold >= price)) {
      if (!creative) {
        dispatch({
          type: 'ADD_GOLD',
          amount: -Math.floor(price)
        });
      }
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
      addLog(`🛒 Bought ${item.name} for ${Math.floor(price)}g!`, 'loot');
    }
  };

  const handleBuyEquipment = (item: EquipmentItem, price: number) => {
    const creative = isCreativeMode();
    if (state.run && (creative || state.run.gold >= price)) {
      if (!creative) {
        dispatch({
          type: 'ADD_GOLD',
          amount: -price
        });
      }
      dispatch({
        type: 'ADD_EQUIPMENT',
        item
      });
      addLog(`🛒 Bought ${item.name}!`, 'loot');
    }
  };
  // Resizable bottom bar
  const isMobileLayout = typeof window !== 'undefined' && window.innerWidth < 640;
  const sidebarHeight = isMobileLayout ? 108 : 96;
  const defaultBarHeight = isMobileLayout ? 240 : 180;
  const [controlsBarHeight, setControlsBarHeight] = useState(() => {
    const saved = localStorage.getItem('menagerie-dungeon-bar-height');
    return saved ? parseInt(saved) : defaultBarHeight;
  });
  const barResizing = useRef(false);
  const barStartY = useRef(0);
  const barStartH = useRef(0);
  
  const handleBarResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    barResizing.current = true;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    barStartY.current = clientY;
    barStartH.current = controlsBarHeight;
    
    const onMove = (ev: MouseEvent | TouchEvent) => {
      if (!barResizing.current) return;
      const y = 'touches' in ev ? ev.touches[0].clientY : ev.clientY;
      const delta = barStartY.current - y;
      const newH = Math.max(100, Math.min(500, barStartH.current + delta));
      setControlsBarHeight(newH);
    };
    const onEnd = () => {
      barResizing.current = false;
      setControlsBarHeight(h => { localStorage.setItem('menagerie-dungeon-bar-height', String(h)); return h; });
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onEnd);
  }, [controlsBarHeight]);
  
  const dungeonBottomStyle = {
    bottom: `${sidebarHeight}px`,
    // Expose to GameSidebar so the slide-up menu panel can perfectly overlay the log box's right half
    ['--menagerie-bar-h' as string]: `${controlsBarHeight}px`,
    ['--menagerie-sidebar-h' as string]: `${sidebarHeight}px`,
  } as React.CSSProperties;
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
    } else if (item.effect === 'reveal_stairs') {
      // Dungeon Compass: pin a waypoint to the current floor's stairs tile.
      const stairsPos = findStairsPosition(dungeon!);
      if (!stairsPos) {
        addLog('🧭 The compass spins wildly — no stairs on this floor!', 'info');
        return;
      }
      dispatch({
        type: 'UPDATE_DUNGEON',
        dungeon: { compassWaypoint: stairsPos },
      });
      dispatch({ type: 'USE_ITEM', itemId: item.id });
      addLog(`🧭 The compass needle locks onto the exit (${stairsPos.x}, ${stairsPos.y})!`, 'system');
      toast.success('Compass waypoint set!');
      return;
    } else if (item.effect === 'open_workshop') {
      // Portable Workstation: open the crafting modal in the dungeon.
      // Reusable — does NOT consume the item.
      setShowWorkshop(true);
      addLog(`🛠️ You unfold the portable workshop.`, 'system');
      return;
    } else if (item.effect === 'dowse') {
      // Dowsing Rod: activate the 5-minute buff and consume the item.
      // Buff persists across floors + overworld via localStorage.
      import('@/game/dowsingRod').then(({ activateDowsing, DOWSING_DURATION_MS }) => {
        activateDowsing(DOWSING_DURATION_MS);
      });
      dispatch({ type: 'USE_ITEM', itemId: item.id });
      addLog('🔮 The Dowsing Rod hums — the nearest threats glow for 5 minutes.', 'system');
      toast.success('Dowsing Rod activated!');
      return;
    } else if (item.effect === 'town_portal') {
      // Consume the scroll and exit the dungeon back to town/overworld.
      const origin = typeof window !== 'undefined'
        ? localStorage.getItem('menagerie_run_origin')
        : null;
      dispatch({ type: 'USE_ITEM', itemId: item.id });
      addLog('📜 You tear open the Town Portal Scroll — a swirling gateway home appears!', 'system');
      dispatch({ type: 'FLEE_DUNGEON' });
      if (origin === 'overworld') {
        dispatch({ type: 'SET_PHASE', phase: 'overworld' });
      } else {
        dispatch({ type: 'SET_PHASE', phase: 'run_summary' });
      }
      return;
    } else if (item.effect === 'revive' || item.effect === 'revive_full') {
      // Check if there are fainted party members
      const hasFainted = state.run!.party.some(m => m.stats.currentHp <= 0);
      if (!hasFainted) {
        addLog('🌿 No fainted party members to revive!', 'info');
        return;
      }
      // Show revive target modal
      setPendingDungeonReviveItem(item);
      setShowDungeonReviveModal(true);
      return; // Don't consume item yet - wait for selection
    } else if (item.effect === 'boost_attack' || item.effect === 'boost_defense' || item.effect === 'boost_speed') {
      addLog(`⚔️ ${item.name} can only be used in close combat.`, 'info');
      return;
    } else {
      message = `Used ${item.name}!`;
    }
    
    dispatch({ type: 'UPDATE_PLAYER_MONSTER', monster: updatedMonster });
    dispatch({ type: 'USE_ITEM', itemId: item.id });
    addLog(`✨ ${message}`, 'heal');
  };
  
  // Handle revive target selection in dungeon
  const handleDungeonReviveTarget = (partyIndex: number) => {
    if (!pendingDungeonReviveItem || !state.run) return;
    
    const revivePercent = pendingDungeonReviveItem.effect === 'revive_full' ? 100 : (pendingDungeonReviveItem.value || 25);
    
    // Revive the party member
    dispatch({ type: 'REVIVE_PARTY_MEMBER', index: partyIndex, hpPercent: revivePercent });
    
    // Consume the item
    dispatch({ type: 'USE_ITEM', itemId: pendingDungeonReviveItem.id });
    
    const revivedMonster = state.run.party[partyIndex];
    const revivedHp = Math.max(1, Math.floor(revivedMonster.stats.maxHp * (revivePercent / 100)));
    addLog(`🌿 ${revivedMonster.species} was revived with ${revivedHp} HP!`, 'heal');
    toast.success(`${revivedMonster.species} revived!`);
    
    setShowDungeonReviveModal(false);
    setPendingDungeonReviveItem(null);
  };

  const handleUseMoveOutOfCombat = (move: Move) => {
    if (!state.run || !dungeon) return;
    
    const monster = state.run.currentMonster;
    const maxStamina = monster.stats.stamina ?? 50;
    const currentStamina = monster.stats.currentStamina ?? maxStamina;
    
    // Check stamina cost
    const staminaCost = move.staminaCost || 0;
    if (currentStamina < staminaCost) {
      toast.error('Not enough stamina!');
      return;
    }
    
    // ── Combo move (movement + attack): start the configured first phase and
    // stash the other half as `pendingComboMove` for after the first resolves.
    if (isComboMove(move)) {
      const order = move.comboOrder ?? 'move_then_attack';
      if (order === 'move_then_attack') {
        // Phase 1: pick destination using the movement pattern.
        const phase1 = stripAttack(move);
        if (!enterTargetingFor(phase1, `🎯 ${move.name}: pick a destination tile…`)) {
          toast.error('No valid movement destinations!');
          return;
        }
        setPendingComboMove(move); // full move; we'll continue with attack phase
      } else {
        // Phase 1: aim the attack from current position.
        const phase1 = stripMovement(move);
        if (!enterTargetingFor(phase1, `🎯 ${move.name}: aim the attack, then choose a retreat tile.`)) {
          toast.error('No valid targets in range!');
          return;
        }
        setPendingComboMove(move);
      }
      return;
    }

    // For attack moves (melee/ranged), enter targeting mode instead of executing
    if (move.type === 'melee' || move.type === 'ranged' || (move.type === 'status' && move.effect?.includes('lower_'))) {
      // Enter targeting mode
      const config = getAttackConfig(move);
      const validTargets = getValidTargets(
        dungeon.playerPosition, 
        config, 
        dungeon.tiles, 
        dungeon.width, 
        dungeon.height, 
        true
      );
      
      if (validTargets.length === 0) {
        toast.error('No valid targets in range!');
        return;
      }
      
      setTargetingMove(move);
      setTargetingTiles(validTargets);
      setAffectedTiles([]);
      setHoveredTile(null);
      addLog(`🎯 Targeting ${move.name}... Click a tile to attack!`, 'system');
      return;
    }
    
    let message = '';
    let updatedStats = { ...monster.stats, currentStamina: currentStamina - staminaCost };
    let canUse = false;
    
    // Handle different move types
    if (move.type === 'heal' && move.power > 0) {
      const hpBefore = monster.stats.currentHp;
      if (hpBefore >= monster.stats.maxHp) {
        addLog('❤️ Already at full HP!', 'info');
        return;
      }
      const newHp = Math.min(monster.stats.maxHp, hpBefore + move.power);
      const healed = newHp - hpBefore;
      updatedStats.currentHp = newHp;
      message = `${move.name} restored ${healed} HP!`;
      canUse = true;
    } else if (move.effect?.includes('restore_stamina')) {
      // Parse stamina recovery amount
      let recovery = 15;
      if (move.effect === 'restore_stamina_15') recovery = 15;
      else if (move.effect === 'restore_stamina_20') recovery = 20;
      else if (move.effect === 'restore_stamina_25') recovery = 25;
      else if (move.effect === 'restore_stamina_30') recovery = 30;
      
      // Net recovery = recovery - cost
      const netRecovery = recovery - staminaCost;
      if (netRecovery <= 0 && currentStamina >= maxStamina) {
        addLog('⚡ Already at full stamina!', 'info');
        return;
      }
      
      updatedStats.currentStamina = Math.min(maxStamina, currentStamina - staminaCost + recovery);
      message = `${move.name} recovered ${recovery} stamina!`;
      canUse = true;
    } else if (move.effect?.startsWith('raise_')) {
      // Buff moves - can use but no immediate effect outside combat
      message = `${move.name} prepared for next battle!`;
      canUse = true;
    }
    
    if (!canUse) {
      addLog(`⚔️ ${move.name} can only be used in close combat.`, 'info');
      return;
    }
    
    // Track move mastery
    const baseMoveId = (move as any).baseMoveId || move.id;
    const currentMastery = monster.moveMastery || {};
    const moveMasteryEntry = currentMastery[baseMoveId] || {
      uses: 0,
      currentTier: 'lesser' as const,
      hasAoE: false,
    };
    const newUses = moveMasteryEntry.uses + 1;
    
    // Calculate new tier
    const THRESHOLDS = { lesser: 0, minor: 10, base: 25, greater: 50, omega: 100 };
    let newTier: 'lesser' | 'minor' | 'base' | 'greater' | 'omega' = 'lesser';
    const tierOrder = ['lesser', 'minor', 'base', 'greater', 'omega'] as const;
    for (const tier of tierOrder) {
      if (newUses >= THRESHOLDS[tier]) {
        newTier = tier;
      }
    }
    const hasAoE = newUses >= 30;
    
    // Check for tier unlocks
    if (newTier !== moveMasteryEntry.currentTier) {
      const tierNames: Record<string, string> = {
        lesser: 'Lesser', minor: 'Minor', base: 'Standard', greater: 'Greater', omega: 'Omega'
      };
      toast.success(`🎯 ${move.name} mastered to ${tierNames[newTier]} tier!`);
    }
    if (hasAoE && !moveMasteryEntry.hasAoE) {
      toast.success(`⚔️ ${move.name} Mass variant unlocked!`);
    }
    
    const updatedMonster = {
      ...monster,
      stats: updatedStats,
      moveMastery: {
        ...currentMastery,
        [baseMoveId]: { uses: newUses, currentTier: newTier, hasAoE },
      },
    };
    
    dispatch({ type: 'UPDATE_PLAYER_MONSTER', monster: updatedMonster });
    addLog(`✨ ${message} (⚡-${staminaCost})`, 'heal');
  };
  
  // Cancel targeting mode (and abort any pending combo phase)
  const cancelTargeting = useCallback(() => {
    setTargetingMove(null);
    setPendingComboMove(null);
    setTargetingTiles([]);
    setAffectedTiles([]);
    setHoveredTile(null);
    aoePendingConfirmRef.current = null;
  }, []);

  // ── Combo move helpers ─────────────────────────────────────────────────────
  // A move is a combo when it has BOTH a movement pattern AND an attack shape
  // (custom AoE, explicit AoE radius, or any non-self targeting with power>0).
  const hasMovementPhase = (m: Move) =>
    !!(m.movement && m.movement.offsets && m.movement.offsets.length > 0);
  const hasAttackPhase = (m: Move) => {
    if (m.customShape && m.customShape.offsets.length > 0) return true;
    if ((m.aoeRadius ?? 0) > 0) return true;
    if (m.type === 'melee' || m.type === 'ranged') return m.power > 0;
    if (m.type === 'status' && m.effect?.includes('lower_')) return true;
    return false;
  };
  const isComboMove = (m: Move) => hasMovementPhase(m) && hasAttackPhase(m);
  // Strip movement so getAttackConfig falls through to the attack shape branch.
  const stripMovement = (m: Move): Move => ({ ...m, movement: undefined, staminaCost: 0 });
  // Strip attack data so getAttackConfig hits the movement branch.
  const stripAttack = (m: Move): Move => ({
    ...m,
    customShape: undefined,
    aoeRadius: 0,
    targeting: undefined,
    staminaCost: 0,
  });

  // Begin a targeting phase for an arbitrary move (used to re-enter targeting
  // for the second half of a combo). Returns false if no valid targets exist.
  const enterTargetingFor = useCallback((move: Move, label?: string): boolean => {
    if (!dungeon) return false;
    const config = getAttackConfig(move);
    const validTargets = getValidTargets(
      dungeon.playerPosition,
      config,
      dungeon.tiles,
      dungeon.width,
      dungeon.height,
      true,
    );
    if (validTargets.length === 0) return false;
    setTargetingMove(move);
    setTargetingTiles(validTargets);
    setAffectedTiles([]);
    setHoveredTile(null);
    aoePendingConfirmRef.current = null;
    if (label) addLog(label, 'system');
    return true;
  }, [dungeon]);

  // While aiming a skill, recompute valid target tiles (and the AoE preview
  // under the cursor) whenever the player moves. This lets the player walk
  // and aim simultaneously without having to re-open the move.
  useEffect(() => {
    if (!targetingMove || !dungeon) return;
    const config = getAttackConfig(targetingMove);
    const newValid = getValidTargets(
      dungeon.playerPosition,
      config,
      dungeon.tiles,
      dungeon.width,
      dungeon.height,
      true,
    );
    setTargetingTiles(newValid);
    if (hoveredTile) {
      const tiles = getAffectedTiles(
        dungeon.playerPosition,
        hoveredTile,
        config,
        dungeon.width,
        dungeon.height,
        dungeon.tiles,
      );
      setAffectedTiles(tiles);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dungeon?.playerPosition.x, dungeon?.playerPosition.y, targetingMove]);
  
  // Handle tile hover during targeting
  const handleTileHover = useCallback((x: number, y: number) => {
    if (!targetingMove || !dungeon) return;
    
    const config = getAttackConfig(targetingMove);
    const tiles = getAffectedTiles(
      dungeon.playerPosition, 
      { x, y }, 
      config, 
      dungeon.width, 
      dungeon.height
    );
    
    setHoveredTile({ x, y });
    setAffectedTiles(tiles);
  }, [targetingMove, dungeon]);
  
  // Execute attack on tile click during targeting mode
  const handleTargetingClick = useCallback((x: number, y: number) => {
    if (!targetingMove || !state.run || !dungeon) return;
    
    // Check if it's a valid target
    const isValid = targetingTiles.some(t => t.x === x && t.y === y);
    if (!isValid) {
      addLog('❌ Invalid target!', 'info');
      return;
    }

    const config = getAttackConfig(targetingMove);

    // ── Movement skill: relocate the player to the chosen offset destination ──
    if (config.pattern === 'movement') {
      const monster = state.run.currentMonster;
      const staminaCost = targetingMove.staminaCost || 0;
      const curStam = monster.stats.currentStamina ?? monster.stats.stamina ?? 50;
      if (curStam < staminaCost) {
        addLog('❌ Not enough stamina!', 'info');
        return;
      }
      // Clone tiles and clear the player's old tile (restore floor/terrain/stairs).
      const newTiles = dungeon.tiles.map(row => row.map(t => ({ ...t })));
      const oldP = dungeon.playerPosition;
      const oldTile = newTiles[oldP.y][oldP.x];
      if (oldTile.terrainType) oldTile.type = 'terrain';
      else if (oldTile.stairsBeneath === 'down') { oldTile.type = 'stairs'; oldTile.stairsBeneath = undefined; }
      else if (oldTile.stairsBeneath === 'up') { oldTile.type = 'stairs_up'; oldTile.stairsBeneath = undefined; }
      else oldTile.type = 'floor';

      // ── Path traversal effects (traps fire, plants harvest) ──
      let pathDamage = 0;
      const harvested: string[] = [];
      const harvestKinds = new Set(config.harvestsResources ?? []);
      const path = getPathTiles(oldP, { x, y });
      // Walk intermediate tiles (skip origin & destination — destination handled below).
      for (let i = 1; i < path.length - 1; i++) {
        const pt = newTiles[path[i].y]?.[path[i].x];
        if (!pt) continue;
        if (config.triggersTrapsOnPath && pt.type === 'trap' && !pt.triggered) {
          const dmg = pt.trapType === 'spike' ? 10 + Math.floor((dungeon.floor ?? 1) * 2) : 0;
          pathDamage += dmg;
          pt.triggered = true;
          addLog(`💥 Trap triggered on path! (-${dmg} HP)`, 'damage');
        }
        if (harvestKinds.has('plant') && pt.type === 'plant' && !pt.harvested && pt.plantType) {
          pt.harvested = true;
          harvested.push(pt.plantType);
        }
        if (harvestKinds.has('trap') && pt.type === 'trap' && !pt.triggered) {
          pt.triggered = true;
          harvested.push('trap');
        }
        if (harvestKinds.has('terrain') && pt.type === 'terrain' && pt.terrainType) {
          harvested.push(pt.terrainType);
          pt.terrainType = undefined;
          pt.type = 'floor';
        }
      }

      // Place player on destination (keep underlying type metadata if any).
      const destTile = newTiles[y][x];
      // Destination trap auto-triggers unless explicitly passed through.
      if (destTile.type === 'trap' && !destTile.triggered && !config.passThroughTraps) {
        const dmg = destTile.trapType === 'spike' ? 10 + Math.floor((dungeon.floor ?? 1) * 2) : 0;
        pathDamage += dmg;
        destTile.triggered = true;
        addLog(`💥 Landed on a trap! (-${dmg} HP)`, 'damage');
      }
      // Harvest plant on landing if configured.
      if (harvestKinds.has('plant') && destTile.type === 'plant' && !destTile.harvested && destTile.plantType) {
        destTile.harvested = true;
        harvested.push(destTile.plantType);
      }
      if (destTile.type === 'stairs') destTile.stairsBeneath = 'down';
      else if (destTile.type === 'stairs_up') destTile.stairsBeneath = 'up';
      destTile.type = 'player';
      const newDungeon = { ...dungeon, tiles: newTiles, playerPosition: { x, y } };
      dispatch({ type: 'SET_DUNGEON', dungeon: newDungeon });
      const newHp = Math.max(0, (monster.stats.currentHp ?? monster.stats.maxHp) - pathDamage);
      dispatch({
        type: 'UPDATE_PLAYER_MONSTER',
        monster: {
          ...monster,
          stats: { ...monster.stats, currentStamina: curStam - staminaCost, currentHp: newHp },
        },
      });
      if (harvested.length > 0) {
        for (const matId of harvested) {
          dispatch({ type: 'ADD_MATERIAL', materialId: matId, quantity: 1 });
        }
        addLog(`🌿 Harvested along path: ${harvested.join(', ')}`, 'system');
      }
      addLog(`🌀 ${targetingMove.name}! Moved to (${x}, ${y}).`, 'system');
      setTargetingMove(null);
      setTargetingTiles([]);
      setAffectedTiles([]);


      // ── Combo chaining: if this movement was Phase 1 of a move_then_attack
      // combo, re-enter targeting with the attack phase from the new position.
      // Defer one frame so the dungeon dispatch above takes effect first.
      const combo = pendingComboMove;
      if (combo && (combo.comboOrder ?? 'move_then_attack') === 'move_then_attack') {
        const attackPhase = { ...stripMovement(combo), staminaCost: combo.staminaCost ?? 0 };
        setPendingComboMove(null);
        setTimeout(() => {
          if (!enterTargetingFor(attackPhase, `⚔️ ${combo.name}: aim the attack!`)) {
            addLog(`⚠️ ${combo.name}: no targets from new position.`, 'info');
          }
        }, 0);
      } else if (combo && combo.comboOrder === 'attack_then_move') {
        // Movement was Phase 2 of an attack_then_move combo — combo complete.
        setPendingComboMove(null);
        // Now hand off the turn to the enemies (deferred by the attack phase).
        const finalDungeon = { ...dungeon, tiles: newTiles, playerPosition: { x, y } };
        processEnemyTurnsRef.current?.(finalDungeon);
      }
      return;
    }


    // Mobile/touch tap-to-preview, tap-again-to-confirm for AoE moves.
    // Skip on hover-capable devices (mouse) and for single-target moves.
    const isTouchDevice = typeof window !== 'undefined'
      && window.matchMedia?.('(hover: none), (pointer: coarse)').matches;
    const isAoE = (targetingMove.targeting && targetingMove.targeting !== 'single')
      || (targetingMove.aoeRadius ?? 0) > 0;
    if (isTouchDevice && isAoE) {
      const pending = aoePendingConfirmRef.current;
      const now = Date.now();
      const sameTile = pending && pending.x === x && pending.y === y && now - pending.time < 4000;
      if (!sameTile) {
        // First tap: preview only.
        const previewTiles = getAffectedTiles(dungeon.playerPosition, { x, y }, config, dungeon.width, dungeon.height, dungeon.tiles);
        setHoveredTile({ x, y });
        setAffectedTiles(previewTiles);
        aoePendingConfirmRef.current = { x, y, time: now };
        addLog(`🎯 Tap again to fire ${targetingMove.name}`, 'system');
        return;
      }
      // Second tap on same tile → commit.
      aoePendingConfirmRef.current = null;
    }

    const affected = getAffectedTiles(dungeon.playerPosition, { x, y }, config, dungeon.width, dungeon.height);

    // Fire visual particle effect for this move (caster → target/affected).
    try {
      playParticleEffectForMove({
        surface: 'dungeon',
        monster: state.run.currentMonster,
        move: targetingMove,
        from: dungeon.playerPosition,
        to: { x, y },
        affected,
      });
    } catch (e) { /* particle FX should never block combat */ }
    
    // Consume stamina
    const monster = state.run.currentMonster;
    const staminaCost = targetingMove.staminaCost || 0;
    let newStamina = (monster.stats.currentStamina ?? monster.stats.stamina ?? 50) - staminaCost;
    
    // Calculate damage and apply to enemies in affected tiles
    let totalDamage = 0;
    let enemiesHit: Monster[] = [];
    // Collect recruitment entries for every enemy this AoE defeats so we can
    // queue them up after the loop (multi-kill recruitment flow).
    const recruitEntries: RecruitQueueEntry[] = [];
    let newDungeon = { ...dungeon };
    
    // Wall mining via attacks: melee/ranged moves with power > 0 chip mineable
    // walls in their AoE, gated by pickaxe tier. Stronger moves chip more.
    const pickaxeTier = effectiveTools(state.saveData.tools).pickaxe;
    const wallHitsPerAttack = targetingMove.power > 0
      ? Math.max(1, Math.floor(targetingMove.power / 20))
      : 0;
    let wallsMined = 0;
    let wallsChipped = 0;
    
    for (const tile of affected) {
      const dungeonTile = newDungeon.tiles[tile.y]?.[tile.x];

      // AoE trap / rune triggering (admin toggle on the move).
      if (targetingMove.triggersTrapsOnAoe && dungeonTile) {
        // Detonate untriggered traps the AoE overlaps.
        if (dungeonTile.type === 'trap' && !dungeonTile.triggered) {
          newDungeon.tiles[tile.y][tile.x] = { ...dungeonTile, triggered: true };
          addLog(`💥 ${targetingMove.name} sprung a trap at (${tile.x}, ${tile.y})!`, 'damage');
          // Damage enemies standing on the trap (player can't stand on AoE tiles).
          const enemyOnTrap = newDungeon.enemies.find(e => {
            const p = getEnemyPosition(newDungeon, e.id);
            return p && p.x === tile.x && p.y === tile.y;
          });
          if (enemyOnTrap) {
            const trapDmg = Math.max(5, Math.floor((enemyOnTrap.stats.maxHp ?? 30) * 0.15));
            newDungeon = {
              ...newDungeon,
              enemies: newDungeon.enemies.map(e => e.id === enemyOnTrap.id
                ? { ...e, stats: { ...e.stats, currentHp: Math.max(0, e.stats.currentHp - trapDmg) } }
                : e),
            };
            addLog(`🪤 ${enemyOnTrap.name} takes ${trapDmg} trap damage!`, 'damage');
          }
        }
        // Apply rune (terrain) backlash to non-favored creatures standing on it.
        if (dungeonTile.terrainType) {
          const enemyOnTerrain = newDungeon.enemies.find(e => {
            const p = getEnemyPosition(newDungeon, e.id);
            return p && p.x === tile.x && p.y === tile.y;
          });
          if (enemyOnTerrain) {
            const backlash = calculateTerrainDamage(enemyOnTerrain, dungeonTile.terrainType);
            if (backlash > 0) {
              newDungeon = {
                ...newDungeon,
                enemies: newDungeon.enemies.map(e => e.id === enemyOnTerrain.id
                  ? { ...e, stats: { ...e.stats, currentHp: Math.max(0, e.stats.currentHp - backlash) } }
                  : e),
              };
              addLog(`✨ Rune lashes ${enemyOnTerrain.name} for ${backlash}!`, 'damage');
            }
          }
        }
      }


      
      // Mineable wall: chip with attack if pickaxe is strong enough
      if (dungeonTile?.type === 'mineable_wall' && dungeonTile.wallTier && wallHitsPerAttack > 0) {
        if (!pickaxeTier) continue;
        const mineResult = mineWall(newDungeon, tile.x, tile.y, pickaxeTier, wallHitsPerAttack);
        if (!mineResult) continue;
        newDungeon = mineResult.dungeon;
        if (mineResult.broken && mineResult.drop) {
          dispatch({
            type: 'ADD_MATERIAL',
            materialId: mineResult.drop.materialId,
            quantity: mineResult.drop.quantity,
          });
          addLog(`⛏️ ${targetingMove.name} broke ${mineableWallName(mineResult.tier)}! +${mineResult.drop.quantity}`, 'loot');
          wallsMined++;
        } else {
          wallsChipped++;
        }
        continue;
      }
      
      if (dungeonTile?.type === 'enemy' && dungeonTile.enemyId) {
        const enemy = dungeon.enemies.find(e => e.id === dungeonTile.enemyId);
        if (enemy) {
          // Calculate damage (simplified version)
          const attackStat = targetingMove.type === 'melee' ? monster.stats.attack : monster.stats.special;
          const baseDamage = targetingMove.power + attackStat;
          const damage = Math.max(1, Math.floor(baseDamage - enemy.stats.defense * 0.3));
          
          totalDamage += damage;
          enemiesHit.push(enemy);
          
          // Apply damage
          const newEnemyHp = enemy.stats.currentHp - damage;
          
          if (newEnemyHp <= 0) {
            // Enemy defeated - remove from dungeon and award XP
            newDungeon = removeEnemy(newDungeon, enemy.id);
            
            // Track overkill for recruitment
            const overkill = Math.abs(newEnemyHp);
            
            // Calculate and award XP
            const xpGained = calculateXpReward(enemy.level, monster.level);
            const currentXp = state.run.experience || 0;
            const newTotalXp = currentXp + xpGained;
            const xpNeeded = xpToNextLevel(monster.level);
            
            // Check for level up
            if (newTotalXp >= xpNeeded) {
              const previousStats = { ...monster.stats };
              const previousLevel = monster.level;
              const newMoves = getNewMovesAtLevel(monster.species, monster.element, monster.class, monster.level + 1);
              
              setLevelUpQueue(prev => [...prev, {
                previousStats,
                previousLevel,
                newMoves,
                monster: { ...monster, level: monster.level + 1 },
                isPassive: false,
              }]);
            }
            
            // Award XP to active monster
            dispatch({ type: 'ADD_XP', amount: xpGained });
            
            // Award 50% XP to conscious inactive party members and check their level-ups
            state.run.party.forEach((member, index) => {
              if (index === state.run!.activePartyIndex) return;
              if (member.stats.currentHp <= 0) return;
              
              const passiveXp = Math.floor(xpGained * 0.5);
              const memberCurrentXp = member.experience || 0;
              const memberNewXp = memberCurrentXp + passiveXp;
              const memberXpNeeded = xpToNextLevel(member.level);
              
              // Check for passive level up
              if (memberNewXp >= memberXpNeeded) {
                const previousStats = { ...member.stats };
                const previousLevel = member.level;
                const newMoves = getNewMovesAtLevel(member.species, member.element, member.class, member.level + 1);
                
                setLevelUpQueue(prev => [...prev, {
                  previousStats,
                  previousLevel,
                  newMoves,
                  monster: { ...member, level: member.level + 1 },
                  isPassive: true,
                }]);
              }
              
              dispatch({
                type: 'UPDATE_PARTY_MONSTER',
                index,
                monster: { ...member, experience: memberNewXp }
              });
            });
            
            addLog(`💥 ${targetingMove.name} defeated ${enemy.name}! (+${damage} dmg, +${xpGained} XP)`, 'damage');
            
            // Set up recruitment for this kill — collect now, dispatch once
            // after the loop so multi-kills queue up cleanly.
            const playerHpPercent = Math.floor((monster.stats.currentHp / monster.stats.maxHp) * 100);
            const chance = calculateRecruitChance({
              turnsUsed: 1,
              overkillDamage: overkill,
              statusEffectsApplied: 0,
              criticalHits: 0,
              playerHpPercent,
              enemyLevel: enemy.level,
              playerLevel: monster.level,
            });
            recruitEntries.push({
              enemy,
              chance,
              stats: { turnsUsed: 1, overkillDamage: overkill, statusEffectsApplied: 0, criticalHits: 0 },
            });
          } else {
            // Update enemy HP, and apply drain_stamina effect if move has it
            const updatedEnemies = newDungeon.enemies.map(e => {
              if (e.id !== enemy.id) return e;
              const nextStats = { ...e.stats, currentHp: newEnemyHp };
              if (targetingMove.effect === 'drain_stamina') {
                const staMax = nextStats.stamina ?? 50;
                const staCur = nextStats.currentStamina ?? staMax;
                const drained = Math.min(staCur, 15);
                nextStats.currentStamina = Math.max(0, staCur - drained);
                if (drained > 0) addLog(`🌀 ${e.name} loses ${drained} stamina!`, 'status');
              }
              return { ...e, stats: nextStats };
            });
            newDungeon = { ...newDungeon, enemies: updatedEnemies };
            addLog(`⚔️ ${targetingMove.name} hit ${enemy.name} for ${damage} damage!`, 'damage');
          }
        }
      }
    }
    
    if (enemiesHit.length === 0 && wallsMined === 0 && wallsChipped === 0) {
      addLog(`⚔️ ${targetingMove.name} missed! No enemies in range.`, 'info');
    } else if (enemiesHit.length === 0 && wallsChipped > 0 && wallsMined === 0) {
      addLog(`⛏️ ${targetingMove.name} chipped ${wallsChipped} wall${wallsChipped > 1 ? 's' : ''}.`, 'system');
    }
    
    // If any enemies were defeated, surface the recruitment modals — first
    // entry shown immediately, the rest queued for sequential display.
    if (recruitEntries.length > 0) {
      const [first, ...rest] = recruitEntries;
      setDefeatedEnemy(first.enemy);
      setRecruitChance(first.chance);
      setBattleStats(first.stats);
      if (rest.length > 0) {
        setRecruitQueue(q => [...q, ...rest]);
      }
      setShowRecruitment(true);
    }
    
    // Update dungeon state
    dispatch({ type: 'SET_DUNGEON', dungeon: newDungeon });
    
    // Update player stamina and move mastery
    const baseMoveId = (targetingMove as any).baseMoveId || targetingMove.id;
    const currentMastery = monster.moveMastery || {};
    const moveMasteryEntry = currentMastery[baseMoveId] || { uses: 0, currentTier: 'lesser' as const, hasAoE: false };
    const newUses = moveMasteryEntry.uses + 1;
    
    const THRESHOLDS = { lesser: 0, minor: 10, base: 25, greater: 50, omega: 100 };
    let newTier: 'lesser' | 'minor' | 'base' | 'greater' | 'omega' = 'lesser';
    for (const tier of ['lesser', 'minor', 'base', 'greater', 'omega'] as const) {
      if (newUses >= THRESHOLDS[tier]) newTier = tier;
    }
    const hasAoE = newUses >= 30;
    
    dispatch({
      type: 'UPDATE_PLAYER_MONSTER',
      monster: {
        ...monster,
        stats: { ...monster.stats, currentStamina: newStamina },
        moveMastery: {
          ...currentMastery,
          [baseMoveId]: { uses: newUses, currentTier: newTier, hasAoE },
        },
      }
    });
    
    // ── Combo chaining: if this attack was Phase 1 of an attack_then_move
    // combo, re-enter targeting with the movement phase from the current spot
    // (a retreat-strike) and skip the enemy turn until movement resolves.
    const combo = pendingComboMove;
    const isAttackThenMove = combo && combo.comboOrder === 'attack_then_move';

    // Exit targeting mode
    cancelTargeting();

    if (isAttackThenMove && combo) {
      const movePhase = { ...stripAttack(combo), staminaCost: 0 };
      setPendingComboMove(combo); // keep so movement branch can detect & clear
      setTimeout(() => {
        if (!enterTargetingFor(movePhase, `🌀 ${combo.name}: choose a retreat tile (Esc to skip).`)) {
          addLog(`⚠️ ${combo.name}: no retreat tiles available.`, 'info');
          setPendingComboMove(null);
          processEnemyTurnsRef.current?.(newDungeon);
        }
      }, 0);
      return;
    }

    // Process enemy turns after player attacks
    processEnemyTurnsRef.current?.(newDungeon);
  }, [targetingMove, targetingTiles, state.run, dungeon, dispatch, cancelTargeting, pendingComboMove, enterTargetingFor]);
  
  // Process all visible enemy turns
  const processEnemyTurns = useCallback((currentDungeon: typeof dungeon) => {
    if (!currentDungeon || !state.run) return;
    
    let updatedDungeon = currentDungeon;
    let playerDamage = 0;

    // Track stamina deltas per enemy applied this turn (consumed by attack or
    // regenerated while resting / moving). Applied once at the end so the
    // dungeon's enemies array reflects the new values for the UI.
    const staminaChanges = new Map<string, number>(); // enemyId -> delta (negative for consumption)

    for (const enemy of currentDungeon.enemies) {
      const enemyPos = getEnemyPosition(updatedDungeon, enemy.id);
      if (!enemyPos) continue;
      
      // Only process visible enemies
      if (!updatedDungeon.tiles[enemyPos.y]?.[enemyPos.x]?.visible) continue;
      
      // Can enemy see player?
      if (!canSeePlayer(enemyPos, updatedDungeon.playerPosition, updatedDungeon.tiles)) continue;
      
      // Calculate action (archetype + IQ aware via enemyAI.ts)
      const action = calculateEnemyAction(
        enemy,
        enemyPos,
        updatedDungeon.playerPosition,
        updatedDungeon.tiles,
        updatedDungeon.width,
        updatedDungeon.height,
        { playerMonster: state.run.currentMonster },
      );

      if (action.type === 'attack') {
        // Enemy must pay a stamina cost to attack. If exhausted, it rests instead.
        const move = action.move;
        const staminaCost = move?.staminaCost ?? ENEMY_ATTACK_STAMINA_COST;
        const curSta = enemy.stats.currentStamina ?? enemy.stats.stamina ?? 0;
        if (curSta < staminaCost) {
          staminaChanges.set(enemy.id, (staminaChanges.get(enemy.id) || 0) + ENEMY_REST_STAMINA_REGEN);
          addLog(`💤 ${enemy.name} is exhausted and catches its breath.`, 'system');
          continue;
        }
        staminaChanges.set(enemy.id, (staminaChanges.get(enemy.id) || 0) - staminaCost);

        const playerMon = state.run.currentMonster;
        const playerDef = playerMon.stats.defense;

        if (move) {
          const roll = rollEnemyMoveDamage(enemy, move, playerDef, playerMon.element);
          // Visual FX from enemy → player.
          try {
            playParticleEffectForMove({
              surface: 'dungeon',
              monster: enemy,
              move,
              from: enemyPos,
              to: updatedDungeon.playerPosition,
              affected: [updatedDungeon.playerPosition],
            });
          } catch (e) { /* never block combat */ }
          if (!roll.hit) {
            addLog(`👹 ${enemy.name} uses ${move.name} — but misses!`, 'system');
          } else {
            playerDamage += roll.damage;
            const tag = roll.superEffective ? ' 💥 Super effective!' : '';
            addLog(`👹 ${enemy.name} uses ${move.name} for ${roll.damage} damage!${tag}`, 'damage');
          }
        } else {
          // Fallback to basic attack
          const damage = Math.max(1, Math.floor(enemy.stats.attack - playerDef * 0.3));
          playerDamage += damage;
          addLog(`👹 ${enemy.name} attacks for ${damage} damage!`, 'damage');
        }
      } else if (action.type === 'move' && action.direction) {
        // Enemy moves — small stamina regen while not attacking
        staminaChanges.set(enemy.id, (staminaChanges.get(enemy.id) || 0) + Math.floor(ENEMY_REST_STAMINA_REGEN / 2));
        const result = moveEnemy(updatedDungeon, enemy.id, action.direction);
        if (result.newPos) {
          updatedDungeon = result.dungeon;
        }
      } else {
        // Idle — regen
        staminaChanges.set(enemy.id, (staminaChanges.get(enemy.id) || 0) + ENEMY_REST_STAMINA_REGEN);
      }
    }
    
    // Apply damage to player
    if (playerDamage > 0) {
      const monster = state.run.currentMonster;
      const newHp = Math.max(0, monster.stats.currentHp - playerDamage);
      dispatch({
        type: 'UPDATE_PLAYER_MONSTER',
        monster: {
          ...monster,
          stats: { ...monster.stats, currentHp: newHp }
        }
      });
      
      if (newHp <= 0) {
        handleActiveMonsterDownOnMap('an enemy attack');
        return;
      }
    }

    // Apply stamina deltas to the enemies array (clamped to [0, max]).
    if (staminaChanges.size > 0) {
      const newEnemies = updatedDungeon.enemies.map(e => {
        const delta = staminaChanges.get(e.id);
        if (!delta) return e;
        const max = e.stats.stamina ?? 50;
        const cur = e.stats.currentStamina ?? max;
        const next = Math.max(0, Math.min(max, cur + delta));
        if (next === cur) return e;
        return { ...e, stats: { ...e.stats, currentStamina: next } };
      });
      updatedDungeon = { ...updatedDungeon, enemies: newEnemies };
    }
    
    // Update dungeon with enemy movements
    dispatch({ type: 'SET_DUNGEON', dungeon: updatedDungeon });
  }, [state.run, dispatch, addLog, handleActiveMonsterDownOnMap]);
  
  // Keep the ref updated
  useEffect(() => {
    processEnemyTurnsRef.current = processEnemyTurns;
  }, [processEnemyTurns]);

  // ─── Dungeon building assign / context handlers ───
  // Mirrors OverworldView's flow but routes mutations through UPDATE_DUNGEON
  // so the building lives on the dungeon floor (and snapshots correctly).
  const handleDungeonAssignMonster = useCallback((monsterId: string) => {
    if (!dungeonAssignBuilding || !dungeon) return;
    const buildings = (dungeon.playerBuildings || []).map(b => {
      if (b.id !== dungeonAssignBuilding.id) return b;
      const updated: PlayerBuilding = { ...b, assignedMonsterId: monsterId };
      if (b.type === 'farm') {
        const m = state.run?.party.find(p => p.id === monsterId);
        updated.farmElement = (m?.element as any) || updated.farmElement;
        updated.growthProgress = 0;
        updated.harvestReady = false;
      }
      return updated;
    });
    dispatch({ type: 'UPDATE_DUNGEON', dungeon: { playerBuildings: buildings } as any });
    addLog(`👤 Assigned monster to ${BUILDING_DEFINITIONS[dungeonAssignBuilding.type].name}.`, 'system');
    setDungeonAssignBuilding(null);
  }, [dungeonAssignBuilding, dungeon, state.run, dispatch, addLog]);

  const handleDungeonUnassignMonster = useCallback(() => {
    if (!dungeonAssignBuilding || !dungeon) return;
    const buildings = (dungeon.playerBuildings || []).map(b => {
      if (b.id !== dungeonAssignBuilding.id) return b;
      return {
        ...b,
        assignedMonsterId: undefined,
        farmElement: undefined,
        growthProgress: undefined,
        harvestReady: false,
        harvestOutput: undefined,
      };
    });
    dispatch({ type: 'UPDATE_DUNGEON', dungeon: { playerBuildings: buildings } as any });
    addLog(`🐾 Removed monster from ${BUILDING_DEFINITIONS[dungeonAssignBuilding.type].name}.`, 'system');
    setDungeonAssignBuilding(null);
  }, [dungeonAssignBuilding, dungeon, dispatch, addLog]);

  const handleDungeonRepairBuilding = useCallback(() => {
    if (!dungeonContextBuilding || !dungeon) return;
    const cost = getRepairCost(dungeonContextBuilding);
    const ow = state.saveData.overworldState;
    const creative = isCreativeMode();
    if (!creative && (!ow || ow.woodCollected < cost.wood || ow.stoneCollected < cost.stone)) {
      toast.error('Not enough resources!');
      return;
    }
    const buildings = (dungeon.playerBuildings || []).map(b =>
      b.id === dungeonContextBuilding.id ? { ...b, hp: b.maxHp } : b,
    );
    dispatch({ type: 'UPDATE_DUNGEON', dungeon: { playerBuildings: buildings } as any });
    if (!creative && ow) {
      dispatch({
        type: 'UPDATE_OVERWORLD',
        overworld: {
          ...ow,
          woodCollected: ow.woodCollected - cost.wood,
          stoneCollected: ow.stoneCollected - cost.stone,
        },
      });
    }
    addLog(`🔧 Repaired ${BUILDING_DEFINITIONS[dungeonContextBuilding.type].name} to full HP.`, 'system');
    toast.success(`Repaired! (-🪵${cost.wood} -🪨${cost.stone})`);
    setDungeonContextBuilding(null);
  }, [dungeonContextBuilding, dungeon, state.saveData.overworldState, dispatch, addLog]);

  const handleDungeonDisassembleBuilding = useCallback(() => {
    if (!dungeonContextBuilding || !dungeon) return;
    const refund = getDisassembleRefund(dungeonContextBuilding);
    const buildings = (dungeon.playerBuildings || []).filter(b => b.id !== dungeonContextBuilding.id);
    dispatch({ type: 'UPDATE_DUNGEON', dungeon: { playerBuildings: buildings } as any });
    const ow = state.saveData.overworldState;
    if (ow) {
      dispatch({
        type: 'UPDATE_OVERWORLD',
        overworld: {
          ...ow,
          woodCollected: ow.woodCollected + refund.wood,
          stoneCollected: ow.stoneCollected + refund.stone,
        },
      });
    }
    addLog(`♻️ Disassembled ${BUILDING_DEFINITIONS[dungeonContextBuilding.type].name}. Recovered 🪵${refund.wood} 🪨${refund.stone}.`, 'loot');
    toast.success(`Disassembled! +🪵${refund.wood} +🪨${refund.stone}`);
    setDungeonContextBuilding(null);
  }, [dungeonContextBuilding, dungeon, state.saveData.overworldState, dispatch, addLog]);

  const handleDungeonContextAssign = useCallback(() => {
    if (!dungeonContextBuilding) return;
    setDungeonAssignBuilding(dungeonContextBuilding);
    setDungeonContextBuilding(null);
  }, [dungeonContextBuilding]);

  
  // Modified tile click handler for targeting mode
  const handleDungeonTileClick = useCallback((x: number, y: number) => {
    if (targetingMove) {
      handleTargetingClick(x, y);
      return;
    }

    // Build mode: place building on open floor tile in dungeon
    if (dungeonBuildMode && selectedDungeonBuildType && dungeon) {
      const tile = dungeon.tiles[y]?.[x];
      if (!tile || tile.type !== 'floor') {
        toast.error('Can only build on open floor tiles!');
        return;
      }
      // Reject if already occupied by a player building on this floor
      const existing = (dungeon.playerBuildings || []) as any[];
      if (existing.some(b => b.worldX === x && b.worldY === y)) {
        toast.error('A building already stands here.');
        return;
      }
      // Import lazily through static refs at top of file
      const def = BUILDING_DEFINITIONS[selectedDungeonBuildType];
      const ow = state.saveData.overworldState;
      const creative = isCreativeMode();
      if (!creative && (!ow || ow.woodCollected < def.cost.wood || ow.stoneCollected < def.cost.stone)) {
        toast.error(`Need 🪵 ${def.cost.wood} 🪨 ${def.cost.stone}`);
        return;
      }
      const newBuilding = createBuilding(selectedDungeonBuildType, x, y);
      dispatch({
        type: 'UPDATE_DUNGEON',
        dungeon: { playerBuildings: [...existing, newBuilding] } as any,
      });
      if (!creative && ow) {
        dispatch({
          type: 'UPDATE_OVERWORLD',
          overworld: {
            ...ow,
            woodCollected: ow.woodCollected - def.cost.wood,
            stoneCollected: ow.stoneCollected - def.cost.stone,
          },
        });
      }
      toast.success(`🏗️ Built ${def.name}!`);
      addLog(`🏗️ Built ${def.name} on floor ${dungeon.floor}.`, 'system');
      setDungeonBuildMode(false);
      setSelectedDungeonBuildType(null);
      return;
    }

    // Check if clicking on an enemy - auto-enter targeting mode with first attack move
    const tile = dungeon?.tiles[y]?.[x];
    if (tile?.type === 'enemy' && tile.enemyId && state.run) {
      const monster = state.run.currentMonster;
      const moves = getMonsterMoves(monster.species, monster.element, monster.class, monster.level);
      const attackMove = moves.find(m => m.type === 'melee' || m.type === 'ranged');

      if (attackMove) {
        const config = getAttackConfig(attackMove);
        const playerPos = dungeon!.playerPosition;
        const distance = Math.abs(x - playerPos.x) + Math.abs(y - playerPos.y);

        if (distance <= config.range) {
          const validTargets = getValidTargets(
            playerPos,
            config,
            dungeon!.tiles,
            dungeon!.width,
            dungeon!.height,
            true
          );

          if (validTargets.some(t => t.x === x && t.y === y)) {
            setTargetingMove(attackMove);
            setTargetingTiles(validTargets);
            setTimeout(() => handleTargetingClick(x, y), 0);
            return;
          }
        } else {
          addLog(`❌ Enemy out of range! Get closer.`, 'info');
          return;
        }
      }
    }
    handleTileClick(x, y);
  }, [targetingMove, handleTargetingClick, handleTileClick, dungeon, state.run, state.saveData.overworldState, dungeonBuildMode, selectedDungeonBuildType, dispatch, addLog]);
  
  // ESC to cancel targeting or build mode
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (targetingMove) {
        cancelTargeting();
        addLog('❌ Attack cancelled.', 'info');
      } else if (dungeonBuildMode) {
        setDungeonBuildMode(false);
        setSelectedDungeonBuildType(null);
        addLog('🏗️ Build cancelled.', 'info');
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [targetingMove, cancelTargeting, dungeonBuildMode, addLog]);

  // Keybind shortcuts for moves (dungeon exploration)
  const keybindDataRef = useRef(loadKeybinds());
  useEffect(() => {
    keybindDataRef.current = loadKeybinds();
  });
  
  useEffect(() => {
    const monster = state.run?.currentMonster;
    if (!monster) return;
    
    const handleKeybindPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.shiftKey) return;
      if (targetingMove) return;
      
      const key = e.key.toLowerCase();
      const binds = getMonsterKeybindsImport(keybindDataRef.current, `${monster.species}_${monster.element}_${(monster as any).class}`);
      
      for (const [moveId, boundKey] of Object.entries(binds)) {
        if (boundKey === key) {
          const moves = getMonsterMoves(monster.species, monster.element, (monster as any).class, monster.level);
          const move = moves.find(m => m.id === moveId);
          if (move) {
            e.preventDefault();
            handleUseMoveOutOfCombat(move);
          }
          return;
        }
      }
    };
    
    window.addEventListener('keydown', handleKeybindPress);
    return () => window.removeEventListener('keydown', handleKeybindPress);
  }, [state.run?.currentMonster, targetingMove, handleUseMoveOutOfCombat]);

  // Shift+1-9 for inventory items (dungeon exploration)
  useEffect(() => {
    const handleInventoryShortcut = (e: KeyboardEvent) => {
      if (!e.shiftKey) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      const num = parseInt(e.key);
      if (isNaN(num) || num < 1 || num > 9) return;
      
      const inventory = state.run?.inventory || [];
      const consumables = inventory.filter(item => item.type === 'potion' || item.effect);
      const targetItem = consumables[num - 1];
      if (targetItem) {
        e.preventDefault();
        handleUseItemOutOfCombat(targetItem);
      }
    };
    
    window.addEventListener('keydown', handleInventoryShortcut);
    return () => window.removeEventListener('keydown', handleInventoryShortcut);
  }, [state.run?.inventory, handleUseItemOutOfCombat]);

  // Early return for loading state - MUST be after all hooks
  if (!dungeon) return <div className="game-container">Loading...</div>;

  // Resolve current dungeon name for the HUD (falls back gracefully).
  const activeDungeonId = typeof window !== 'undefined'
    ? localStorage.getItem('menagerie_active_dungeon_id')
    : null;
  const activeDungeonEntrance = activeDungeonId
    ? state.saveData?.dungeonEntrances?.[activeDungeonId]
    : undefined;
  // Fallback: derive a name from the dungeon's theme (in case the entrance lookup misses).
  const themeForName = activeDungeonEntrance?.theme ?? dungeon.theme;
  const themeDerivedName = themeForName
    ? (themeForName.kind === 'all'
        ? 'Tower of the Infinite'
        : themeForName.value
          ? `${String(themeForName.value)[0].toUpperCase()}${String(themeForName.value).slice(1)} Tower`
          : null)
    : null;
  const dungeonLocationName = activeDungeonEntrance?.name
    || themeDerivedName
    || (activeDungeonEntrance?.element
        ? `${activeDungeonEntrance.element[0].toUpperCase()}${activeDungeonEntrance.element.slice(1)} Wilderness Dungeon`
        : 'Tower of the Infinite');

  return <>
      <GameSidebar 
        monster={state.run?.currentMonster || null} 
        gold={state.run?.gold || 0} 
        floor={dungeon.floor} 
        locationName={dungeonLocationName}
        inventory={state.run?.inventory || []} 
        equipmentInventory={state.run?.equipmentInventory || []}
        equipment={state.run?.partyEquipment?.[state.run?.activePartyIndex || 0]}
        runMaterials={state.run?.runMaterials || {}}
        moveOrder={state.run?.moveOrder || []} 
        hiddenMoves={state.run?.hiddenMoves || []} 
        experience={state.run?.experience || 0} 
        experienceToNext={xpToNextLevel(state.run?.currentMonster?.level || 1)} 
        onFlee={handleFlee}
        onMainMenu={handleMainMenu}
        mainMenuTitle="Save and return to main menu (resume later)"
        onOpenWorkshop={effectiveTools(state.saveData.tools).workstation ? () => setShowWorkshop(true) : undefined}
        onDropItem={handleDropItem} 
        onUseItem={handleUseItemOutOfCombat}
        onUseMove={handleUseMoveOutOfCombat}
        onReorderMoves={order => dispatch({ type: 'SET_MOVE_ORDER', order })} 
        onToggleHideMove={moveId => dispatch({ type: 'TOGGLE_HIDE_MOVE', moveId })}
        onOpenEquipment={() => setShowEquipment(true)}
        onPanelChange={setMenuOpen}
        panelHostId="dungeon-bottom-panel-host"
        party={state.run?.party || []}
        activePartyIndex={state.run?.activePartyIndex || 0}
        onPartySwitch={handlePartySwitch}
        partyEffects={(state.run?.partyEffects || []) as CombatEffects[]}
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

      {stairExitDialogOpen && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setStairExitDialogOpen(false)}
        >
          <Card
            className="w-full max-w-md p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="space-y-1">
              <h2 className="text-xl font-bold">Leave the Dungeon?</h2>
              <p className="text-sm text-muted-foreground">
                You're on the entrance staircase. Choose where to go — your gold, materials,
                items, and equipment come with you, but floor progress in this run is lost.
              </p>
            </div>
            <div className="grid gap-2">
              <Button
                onClick={() => { setStairExitDialogOpen(false); handleFlee('entrance', true); }}
              >
                🚪 Overworld — tower entrance
              </Button>
              <Button
                variant="secondary"
                onClick={() => { setStairExitDialogOpen(false); handleFlee('town', true); }}
              >
                🏘️ Starting town (home base)
              </Button>
              <Button
                variant="secondary"
                onClick={() => { setStairExitDialogOpen(false); handleFlee('menu', true); }}
              >
                📜 Main menu
              </Button>
              <Button variant="ghost" onClick={() => setStairExitDialogOpen(false)}>
                Stay in dungeon
              </Button>
            </div>
          </Card>
        </div>
      )}


      
      {showShop && <ShopView 
        gold={isCreativeMode() ? Number.MAX_SAFE_INTEGER : (state.run?.gold || 0)} 
        floor={dungeon.floor}
        onBuy={handleBuyItem} 
        onBuyEquipment={handleBuyEquipment}
        onClose={() => setShowShop(false)} 
      />}
      
      {showElevator && state.run && (
        <ElevatorModal
          party={state.run.party}
          partyEquipment={state.run.partyEquipment}
          activeIndex={state.run.activePartyIndex}
          unlockedMonsters={state.saveData.unlockedMonsters}
          onSend={(partyIndex) => {
            const monster = state.run!.party[partyIndex];
            const comboId = `${monster.species}_${monster.element}_${monster.class}`;
            const existing = state.saveData.unlockedMonsters.find(m => m.comboId === comboId);
            
            dispatch({ type: 'SEND_PARTY_MEMBER_TO_TOWN', partyIndex });
            setShowElevator(false);
            
            if (!existing) {
              addLog(`🛗 ${monster.name} sent to town! ✨ New monster unlocked!`, 'system');
              toast.success(`${monster.name} is now available in your roster!`);
            } else if (monster.level > existing.level) {
              addLog(`🛗 ${monster.name} sent to town! 📈 Level updated to ${monster.level}!`, 'system');
              toast.success(`${monster.name} level updated to ${monster.level}!`);
            } else {
              addLog(`🛗 ${monster.name} sent safely back to town.`, 'system');
            }
          }}
          onClose={() => setShowElevator(false)}
        />
      )}

      {/* Portable Workstation: same crafting modal as town, opened mid-dungeon */}
      {showWorkshop && (
        <CraftingWorkshop
          materials={state.saveData.materials || {}}
          playerLevel={state.run?.currentMonster?.level || 1}
          storedEquipment={state.saveData.storedEquipment || []}
          unlockedRecipes={state.saveData.unlockedRecipes || []}
          tools={effectiveTools(state.saveData.tools)}
          onCraft={(recipe, result) => {
            if (!isCreativeMode()) {
              dispatch({ type: 'USE_MATERIALS', materials: recipe.materials });
            }
            // Unified inventory: STORE_EQUIPMENT mirrors into the active run automatically.
            dispatch({ type: 'STORE_EQUIPMENT', item: result });
            toast.success(`Crafted ${result.name}!`);
          }}
          onCraftConsumable={(recipe) => {
            if (!isCreativeMode()) {
              dispatch({ type: 'USE_MATERIALS', materials: recipe.materials });
            }
            dispatch({
              type: 'ADD_ITEM',
              item: {
                id: recipe.resultId,
                name: recipe.name,
                type: 'potion',
                value: 0,
                effect: recipe.effect,
                quantity: 1,
              },
            });
            toast.success(`Crafted ${recipe.name}!`);
          }}
          onDismantle={(itemId, materialsGained) => {
            dispatch({ type: 'DISMANTLE_EQUIPMENT', itemId });
            const names = materialsGained.map(m => `${m.quantity}x ${m.materialId}`).join(', ');
            toast.success(`Dismantled — gained ${names}`);
          }}
          onUpgradePickaxe={(tier, mats) => {
            if (!isCreativeMode()) {
              dispatch({ type: 'USE_MATERIALS', materials: mats });
            }
            dispatch({ type: 'SET_PICKAXE_TIER', tier });
            toast.success(`${tier.charAt(0).toUpperCase() + tier.slice(1)} Pickaxe ready!`);
          }}
          onUpgradeShovel={(tier, mats) => {
            if (!isCreativeMode()) {
              dispatch({ type: 'USE_MATERIALS', materials: mats });
            }
            dispatch({ type: 'SET_SHOVEL_TIER', tier });
            toast.success(`${tier.charAt(0).toUpperCase() + tier.slice(1)} Shovel ready!`);
          }}
          onCraftWorkstation={(mats) => {
            if (!isCreativeMode()) {
              dispatch({ type: 'USE_MATERIALS', materials: mats });
            }
            dispatch({ type: 'SET_WORKSTATION_OWNED' });
            toast.success('🛠️ Portable Workstation ready!');
          }}
          onClose={() => setShowWorkshop(false)}
        />
      )}
      
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
      
      {/* Level Up Screen for dungeon map kills */}
      {levelUpQueue.length > 0 && levelUpQueue[0] && (
        <LevelUpScreen
          monster={levelUpQueue[0].monster}
          previousStats={levelUpQueue[0].previousStats}
          previousLevel={levelUpQueue[0].previousLevel}
          newMoves={levelUpQueue[0].newMoves}
          isPassive={levelUpQueue[0].isPassive}
          onContinue={() => {
            // Apply the level up
            const entry = levelUpQueue[0];
            const newStats = calculateStats(entry.monster.species, entry.monster.class, entry.monster.level + 1);
            const hpPercent = entry.previousStats.currentHp / entry.previousStats.maxHp;
            const staminaPercent = (entry.previousStats.currentStamina || entry.previousStats.stamina || 50) / (entry.previousStats.stamina || 50);
            
            const updatedMonster = {
              ...entry.monster,
              level: entry.previousLevel + 1,
              stats: {
                ...newStats,
                currentHp: Math.ceil(newStats.maxHp * hpPercent),
                currentStamina: Math.ceil((newStats.stamina || 50) * staminaPercent),
              },
            };
            
            if (entry.isPassive) {
              // Find the party index for this passive monster
              const partyIndex = state.run?.party.findIndex(m => 
                m.species === entry.monster.species && 
                m.element === entry.monster.element && 
                m.class === entry.monster.class
              );
              if (partyIndex !== undefined && partyIndex >= 0) {
                dispatch({ type: 'UPDATE_PARTY_MONSTER', index: partyIndex, monster: updatedMonster });
              }
            } else {
              dispatch({ type: 'UPDATE_PLAYER_MONSTER', monster: updatedMonster });
            }
            
            // Remove from queue
            setLevelUpQueue(prev => prev.slice(1));
            addLog(`🎉 ${updatedMonster.name} leveled up to ${updatedMonster.level}!`, 'system');
          }}
        />
      )}
      
      {/* Recruitment Modal for dungeon map kills.
          When multiple enemies are defeated by a single AoE, additional
          recruits are queued in `recruitQueue` and shown in sequence as
          the player resolves each modal. */}
      {showRecruitment && defeatedEnemy && (() => {
        const advanceQueue = () => {
          if (recruitQueue.length > 0) {
            const [next, ...rest] = recruitQueue;
            setRecruitQueue(rest);
            setDefeatedEnemy(next.enemy);
            setRecruitChance(next.chance);
            setBattleStats(next.stats);
            // keep showRecruitment true
          } else {
            setShowRecruitment(false);
            setDefeatedEnemy(null);
          }
        };
        const queueBadge = recruitQueue.length > 0
          ? ` (${recruitQueue.length} more recruit${recruitQueue.length === 1 ? '' : 's'} waiting)`
          : '';
        return (
        <RecruitmentModal
          enemy={defeatedEnemy}
          recruitChance={recruitChance}
          impressiveStats={battleStats}
          party={state.run?.party || []}
          partyFull={(state.run?.party.length || 0) >= 6}
          onFail={() => {
            addLog(`😔 ${defeatedEnemy.name} declined to join...${queueBadge}`, 'info');
            advanceQueue();
          }}
          onAddToParty={() => {
            dispatch({ type: 'ADD_TO_PARTY', monster: defeatedEnemy });
            addLog(`🎉 ${defeatedEnemy.name} joined your party!${queueBadge}`, 'system');
            toast.success(`${defeatedEnemy.species} joined your team!`);
            advanceQueue();
          }}
          onReplaceMember={(replaceIndex) => {
            dispatch({ type: 'SEND_PARTY_MEMBER_TO_TOWN', partyIndex: replaceIndex });
            dispatch({ type: 'ADD_TO_PARTY', monster: defeatedEnemy });
            addLog(`🔄 Sent a party member home; ${defeatedEnemy.name} took their place!${queueBadge}`, 'system');
            toast.success(`${defeatedEnemy.species} joined your team!`);
            advanceQueue();
          }}
          onSendHome={() => {
            const comboId = `${defeatedEnemy.species}_${defeatedEnemy.element}_${defeatedEnemy.class}`;
            dispatch({
              type: 'UNLOCK_MONSTER',
              monster: {
                comboId,
                species: defeatedEnemy.species,
                element: defeatedEnemy.element,
                classType: defeatedEnemy.class,
                level: defeatedEnemy.level,
                equipment: defeatedEnemy.equipment,
              },
            });
            addLog(`🏠 ${defeatedEnemy.name} was sent home to the roster.${queueBadge}`, 'system');
            toast.success(`${defeatedEnemy.species} sent home!`);
            advanceQueue();
          }}
          onDismiss={() => {
            advanceQueue();
          }}
          queuedRecruits={recruitQueue.length}
          onSkipAll={() => {
            setRecruitQueue([]);
            setShowRecruitment(false);
            setDefeatedEnemy(null);
          }}
          unlockedMonsters={state.saveData.unlockedMonsters}
        />
        );
      })()}
      
      {/* Dungeon Revive Target Modal */}
      <ReviveTargetModal
        open={showDungeonReviveModal}
        onClose={() => {
          setShowDungeonReviveModal(false);
          setPendingDungeonReviveItem(null);
        }}
        party={state.run?.party || []}
        revivePercent={pendingDungeonReviveItem?.effect === 'revive_full' ? 100 : (pendingDungeonReviveItem?.value || 25)}
        itemName={pendingDungeonReviveItem?.name || 'Revive'}
        onRevive={handleDungeonReviveTarget}
      />
      
      <div className="fixed inset-0 overflow-hidden transition-all duration-300" style={dungeonBottomStyle}>
        <div className="h-full flex flex-col">
          {/* Scrollable dungeon viewport - fills available space */}
          <div className="flex-1 overflow-hidden bg-card">
            <DungeonRenderer 
              dungeon={dungeon} 
              playerElement={state.run?.currentMonster.element || 'fire'} 
              playerPickaxeTier={effectiveTools(state.saveData.tools).pickaxe}
              playerClass={state.run?.currentMonster.class}
              playerSpecies={state.run?.currentMonster.species}
              playerDexterity={state.run?.currentMonster.stats.dodge || 10}
              zoom={settings.dungeonZoom}
              unlockedMonsters={state.saveData.unlockedMonsters}
              targetPath={targetPath}
              onTileClick={handleDungeonTileClick}
              onTileRightClick={(x, y) => {
                if (!dungeon || !state.run) return;
                const tile = dungeon.tiles[y]?.[x];
                if (!tile?.explored) return;
                // Open the unified tile menu — waypoint is now an action inside it
                // rather than firing immediately on right-click.
                setDungeonTileMenu({ x, y });
              }}
              targetingMode={!!targetingMove}
              targetingTiles={targetingTiles}
              affectedTiles={affectedTiles}
              hoveredTile={hoveredTile}
              onTileHover={handleTileHover}
              onTileHoverEnd={() => setHoveredTile(null)}
              dungeonEntrance={(() => {
                const id = typeof window !== 'undefined' ? localStorage.getItem('menagerie_active_dungeon_id') : null;
                return id ? (state.saveData.dungeonEntrances?.[id] ?? null) : null;
              })()}
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
                      handleActiveMonsterDownOnMap('a triggered spike trap');
                    }
                  } else if (tile?.trapType === 'poison') {
                    addLog('☠️ Disarm failed! You got poisoned!', 'status');
                  } else if (tile?.trapType === 'alarm') {
                    addLog('🔔 Disarm failed! Alarm triggered!', 'status');
                  }
                }
              }}
            />

            {/* Build button (top-right of dungeon viewport) */}
            <div className="absolute top-2 right-2 z-30 flex flex-col gap-1 items-end">
              <Button
                size="sm"
                variant={dungeonBuildMode ? 'destructive' : 'secondary'}
                onClick={() => {
                  if (dungeonBuildMode) {
                    setDungeonBuildMode(false);
                    setSelectedDungeonBuildType(null);
                  } else {
                    setDungeonBuildPanelOpen(true);
                  }
                }}
                title="Build structures on this floor (persists across runs)"
              >
                🏗️ {dungeonBuildMode ? 'Cancel' : 'Build'}
              </Button>
              {dungeonBuildMode && selectedDungeonBuildType && (
                <div className="bg-card/90 backdrop-blur border rounded px-2 py-1 text-xs">
                  Placing: {BUILDING_DEFINITIONS[selectedDungeonBuildType].name} — click an open floor tile.
                </div>
              )}
            </div>

            <DungeonBuildPanel
              open={dungeonBuildPanelOpen}
              wood={state.saveData.overworldState?.woodCollected ?? 0}
              stone={state.saveData.overworldState?.stoneCollected ?? 0}
              onClose={() => setDungeonBuildPanelOpen(false)}
              onSelectBuilding={(type) => {
                setSelectedDungeonBuildType(type);
                setDungeonBuildMode(true);
                setDungeonBuildPanelOpen(false);
              }}
              onSelectRoad={() => {
                toast.info('Roads in dungeons coming soon.');
              }}
            />

            {/* Dungeon building: Assign monster modal */}
            {dungeonAssignBuilding && state.run && (
              <BuildingAssignModal
                building={dungeonAssignBuilding}
                party={state.run.party}
                activePartyIndex={state.run.activePartyIndex}
                assignedMonsterIds={(dungeon?.playerBuildings || [])
                  .filter(b => b.assignedMonsterId && b.id !== dungeonAssignBuilding.id)
                  .map(b => b.assignedMonsterId!)
                }
                onAssign={handleDungeonAssignMonster}
                onUnassign={handleDungeonUnassignMonster}
                onClose={() => setDungeonAssignBuilding(null)}
              />
            )}

            {/* Dungeon building: context menu (assign / repair / disassemble) */}
            {dungeonContextBuilding && state.run && (
              <BuildingContextMenu
                building={dungeonContextBuilding}
                party={state.run.party}
                woodAvailable={state.saveData.overworldState?.woodCollected ?? 0}
                stoneAvailable={state.saveData.overworldState?.stoneCollected ?? 0}
                onAssign={handleDungeonContextAssign}
                onRepair={handleDungeonRepairBuilding}
                onDisassemble={handleDungeonDisassembleBuilding}
                onClose={() => setDungeonContextBuilding(null)}
              />
            )}

            {/* Targeting mode UI */}
            {targetingMove && (
              <MoveInfoPanel move={targetingMove} onCancel={cancelTargeting} />
            )}

            {/* Enemy right-click attack menu */}
            {attackMenuTarget && state.run && (
              <EnemyAttackMenu
                attacker={state.run.currentMonster}
                target={attackMenuTarget}
                moveOrder={state.run.moveOrder || []}
                onClose={() => setAttackMenuTarget(null)}
                onPickMove={(move) => {
                  const tgt = attackMenuTarget;
                  setAttackMenuTarget(null);
                  if (!dungeon) return;
                  const config = getAttackConfig(move);
                  const validTargets = getValidTargets(
                    dungeon.playerPosition,
                    config,
                    dungeon.tiles,
                    dungeon.width,
                    dungeon.height,
                    true,
                  );
                  setTargetingMove(move);
                  setTargetingTiles(validTargets);
                  setTimeout(() => handleTargetingClick(tgt.enemyPos.x, tgt.enemyPos.y), 0);
                }}
              />
            )}

            {/* Unified tile menu (right-click / long-press on any explored tile) */}
            {dungeonTileMenu && dungeon && state.run && (() => {
              const { x, y } = dungeonTileMenu;
              const tile = dungeon.tiles[y]?.[x];
              const close = () => setDungeonTileMenu(null);
              if (!tile) { close(); return null; }
              const structure = ((dungeon.playerBuildings || []) as any[]).find((b) => b.worldX === x && b.worldY === y);
              const structureDef = structure ? BUILDING_DEFINITIONS[structure.type as keyof typeof BUILDING_DEFINITIONS] : null;

              const monster = state.run.currentMonster;
              const dist = Math.abs(x - dungeon.playerPosition.x) + Math.abs(y - dungeon.playerPosition.y);
              const isAdjacent = dist === 1;
              const relativeX = x - (dungeon.entryPosition?.x ?? 0);
              const relativeY = y - (dungeon.entryPosition?.y ?? 0);
              const trapNames = {
                spike: { title: '🔺 Spike Trap', description: 'Deals physical damage when triggered' },
                poison: { title: '☠️ Poison Trap', description: 'Inflicts poison when triggered' },
                alarm: { title: '🔔 Alarm Trap', description: 'Alerts nearby enemies when triggered' },
              } as const;

              const info: UnifiedTileInfo[] = [
                { label: 'Distance', value: dist === 0 ? 'Standing here' : isAdjacent ? 'Adjacent' : `${dist} tiles` },
                { label: 'Relative', value: `(${relativeX}, ${relativeY})` },
              ];
              const actions: UnifiedTileAction[] = [];
              let creature: UnifiedTileCreature | undefined;
              let title = '🟫 Floor';
              let subtitle = 'Open tile';
              let footnote = 'Pinned waypoints show an edge-of-screen arrow.';

              const hasId = (id: string) => actions.some((action) => action.id === id);
              const stepToTile = () => {
                close();
                handleMove(getDirection(dungeon.playerPosition, { x, y }));
              };
              const autoPathToTile = () => {
                close();
                handleTileClick(x, y);
              };
              const directTileAttack = (() => {
                const moveOrderIndex = new Map((state.run.moveOrder || []).map((id, index) => [id, index]));
                return getMonsterMoves(monster.species, monster.element, monster.class, monster.level)
                  .filter((move) => (move.type === 'melee' || move.type === 'ranged' || move.power > 0) && (move.staminaCost || 0) <= (monster.stats.currentStamina ?? monster.stats.stamina ?? 50))
                  .sort((a, b) => (moveOrderIndex.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (moveOrderIndex.get(b.id) ?? Number.MAX_SAFE_INTEGER))
                  .map((move) => {
                    const config = getAttackConfig(move);
                    const validTargets = getValidTargets(
                      dungeon.playerPosition,
                      config,
                      dungeon.tiles,
                      dungeon.width,
                      dungeon.height,
                      true,
                    );
                    return { move, validTargets };
                  })
                  .find(({ validTargets }) => validTargets.some((target) => target.x === x && target.y === y));
              })();
              const quickAttackTile = () => {
                if (!directTileAttack) return;
                close();
                setTargetingMove(directTileAttack.move);
                setTargetingTiles(directTileAttack.validTargets);
                setAffectedTiles([]);
                setHoveredTile(null);
                setTimeout(() => handleTargetingClick(x, y), 0);
              };

              if (!tile.visible && tile.explored) {
                info.push({ label: 'Visibility', value: 'Last seen' });
              }

              if (tile.type === 'enemy' && tile.enemyId) {
                const enemy = dungeon.enemies.find(e => e.id === tile.enemyId);
                if (enemy) {
                  title = `⚔ ${enemy.name}`;
                  subtitle = `Lv ${enemy.level} · ${enemy.element} · ${enemy.class}`;
                  creature = {
                    name: enemy.name,
                    level: enemy.level,
                    element: enemy.element,
                    klass: enemy.class,
                    hp: enemy.stats.currentHp,
                    maxHp: enemy.stats.maxHp,
                  };
                  info.push({ label: 'Stamina', value: `${enemy.stats.currentStamina ?? enemy.stats.stamina ?? 0} / ${enemy.stats.stamina ?? 0}` });
                  actions.push({
                    id: 'attack',
                    label: 'Pick a move to attack',
                    icon: Swords,
                    variant: 'default',
                    onClick: () => {
                      close();
                      setAttackMenuTarget({
                        enemy,
                        enemyPos: { x, y },
                        playerPos: dungeon.playerPosition,
                      });
                    },
                  });
                }
              } else if (tile.type === 'nest' && tile.nestState) {
                title = `🪺 ${tile.nestState.element[0].toUpperCase()}${tile.nestState.element.slice(1)} Nest`;
                subtitle = `Spawner · Lv ${tile.nestState.level}`;
                creature = {
                  name: `${tile.nestState.element[0].toUpperCase()}${tile.nestState.element.slice(1)} Nest`,
                  level: tile.nestState.level,
                  element: tile.nestState.element,
                  hp: tile.nestState.hp,
                  maxHp: tile.nestState.maxHp,
                };
                info.push({ label: 'Spawned', value: String(tile.nestState.totalSpawned) });
                if (isAdjacent) {
                  actions.push({
                    id: 'bump-nest',
                    label: 'Attack nest',
                    hint: 'Use a normal turn to damage it',
                    icon: Swords,
                    variant: 'default',
                    onClick: stepToTile,
                  });
                }
              } else if (tile.type === 'treasure') {
                title = '🎁 Treasure chest';
                subtitle = 'Unopened loot cache';
                info.push({ label: 'Loot', value: 'Chest rewards on contact' });
                info.push({ label: 'Action', value: isAdjacent ? 'Collectable now' : 'Step adjacent first' });
                if (isAdjacent) {
                  actions.push({
                    id: 'collect-treasure',
                    label: 'Collect chest',
                    icon: DoorOpen,
                    variant: 'default',
                    onClick: stepToTile,
                  });
                }
              } else if (tile.type === 'stairs') {
                title = '⬇️ Descending stairs';
                subtitle = `Floor ${dungeon.floor} → ${dungeon.floor + 1}`;
                info.push({ label: 'Tile', value: 'Dungeon exit downward' });
                info.push({ label: 'Destination', value: `Floor ${dungeon.floor + 1}` });
                if (isAdjacent) {
                  actions.push({
                    id: 'use-stairs-down',
                    label: 'Descend stairs',
                    icon: ChevronDown,
                    variant: 'default',
                    onClick: stepToTile,
                  });
                }
              } else if (tile.type === 'stairs_up') {
                const isEntranceStairs = dungeon.floor <= (dungeon.startingFloor ?? 1);
                title = '⬆️ Ascending stairs';
                subtitle = isEntranceStairs ? 'Entrance staircase' : `Floor ${dungeon.floor} → ${Math.max(1, dungeon.floor - 1)}`;
                info.push({ label: 'Tile', value: isEntranceStairs ? 'Dungeon entrance / exit' : 'Staircase upward' });
                info.push({ label: 'Destination', value: isEntranceStairs ? 'Exit / entrance' : `Floor ${Math.max(1, dungeon.floor - 1)}` });
                if (isAdjacent) {
                  actions.push({
                    id: 'use-stairs-up',
                    label: isEntranceStairs ? 'Use entrance stairs' : 'Ascend stairs',
                    icon: ChevronUp,
                    variant: 'default',
                    onClick: stepToTile,
                  });
                }
              } else if (tile.type === 'shop') {
                title = '🛒 Dungeon shop';
                subtitle = 'Buy supplies and gear';
                info.push({ label: 'Tile', value: 'Merchant stall' });
                if (isAdjacent) {
                  actions.push({
                    id: 'open-shop',
                    label: 'Open shop',
                    icon: ShoppingBag,
                    variant: 'default',
                    onClick: stepToTile,
                  });
                }
              } else if (tile.type === 'elevator') {
                title = '🛗 Elevator';
                subtitle = 'Swap party members with town storage';
                info.push({ label: 'Tile', value: 'Party transfer point' });
                if (isAdjacent) {
                  actions.push({
                    id: 'use-elevator',
                    label: 'Use elevator',
                    icon: DoorOpen,
                    variant: 'default',
                    onClick: stepToTile,
                  });
                }
              } else if (tile.type === 'mineable_wall') {
                const wallName = tile.wallTier ? mineableWallName(tile.wallTier) : 'Mineable wall';
                const pickaxeTier = effectiveTools(state.saveData.tools).pickaxe;
                const hitsNeeded = tile.wallTier ? hitsToBreak(tile.wallTier, pickaxeTier) : Infinity;
                const autoHarvestOn = !!settings.autoMine;
                title = `⛏️ ${wallName}`;
                subtitle = tile.wallTier ? `Tier ${tile.wallTier} wall` : 'Breakable wall';
                info.push({ label: 'Loot', value: `Drops ${wallName}` });
                info.push({ label: 'Progress', value: isFinite(hitsNeeded) ? `${tile.wallHits || 0} / ${hitsNeeded} hits` : `${tile.wallHits || 0} hits` });
                info.push({ label: 'Tool', value: isFinite(hitsNeeded) ? 'Pickaxe can break it' : 'Pickaxe too weak or missing' });
                if (isAdjacent) {
                  actions.push({
                    id: 'mine-wall',
                    label: autoHarvestOn ? 'Auto-Harvest wall' : 'Mine wall',
                    hint: autoHarvestOn ? 'Keeps mining until broken or an enemy appears' : 'Consumes a turn',
                    icon: Pickaxe,
                    variant: 'default',
                    onClick: () => {
                      close();
                      if (autoHarvestOn) startDungeonAutoHarvest(x, y);
                      else handleMove(getDirection(dungeon.playerPosition, { x, y }));
                    },
                  });
                  actions.push({
                    id: 'toggle-auto-harvest-wall',
                    label: autoHarvestOn ? 'Disable Auto-Harvest' : 'Enable Auto-Harvest',
                    hint: 'Applies to dungeon walls and rune tiles; persisted in Settings',
                    icon: Pickaxe,
                    variant: 'outline',
                    onClick: () => {
                      updateSetting('autoMine', !autoHarvestOn);
                      toast.info(`Auto-Harvest ${!autoHarvestOn ? 'enabled' : 'disabled'}`);
                    },
                  });
                }
              } else if (tile.type === 'plant' && tile.plantType) {
                title = `🌿 ${tile.plantType.split('_').map(part => part[0].toUpperCase() + part.slice(1)).join(' ')}`;
                subtitle = tile.harvested ? 'Already harvested' : 'Harvestable plant';
                info.push({ label: 'Status', value: tile.harvested ? 'Harvested' : 'Ready' });
                if (isAdjacent && !tile.harvested) {
                  actions.push({
                    id: 'harvest-plant',
                    label: 'Harvest plant',
                    icon: Trees,
                    variant: 'default',
                    onClick: stepToTile,
                  });
                }
              } else if (tile.type === 'terrain' && tile.terrainType) {
                const terrainConfig = TERRAIN_CONFIG[tile.terrainType];
                const shovelTier = effectiveTools(state.saveData.tools).shovel;
                const hitsNeeded = shovelHitsToBreak(tile.terrainType, shovelTier);
                const autoHarvestOn = !!settings.autoMine;
                title = `${terrainConfig.icon} ${terrainConfig.name}`;
                subtitle = 'Hazardous rune tile';
                info.push({ label: 'Description', value: terrainConfig.description });
                info.push({ label: 'Favored', value: terrainConfig.favoredElement ?? terrainConfig.favoredClass ?? 'None' });
                info.push({ label: 'Backlash', value: '2 damage if mismatched' });
                info.push({ label: 'Digging', value: isFinite(hitsNeeded) ? `${hitsNeeded} dig${hitsNeeded === 1 ? '' : 's'} with current shovel` : 'Shovel too weak or missing' });
                if (isAdjacent) {
                  actions.push({
                    id: 'step-on-rune',
                    label: autoHarvestOn && isFinite(hitsNeeded)
                      ? 'Auto-Harvest rune'
                      : isAutoShovelEnabled() && isFinite(hitsNeeded)
                        ? 'Step on & auto-dig'
                        : 'Step onto rune',
                    hint: autoHarvestOn
                      ? 'Keeps digging until the rune is removed or an enemy appears'
                      : isAutoShovelEnabled()
                        ? 'Auto-Shovel is on'
                        : 'Auto-Shovel is off',
                    icon: isAutoShovelEnabled() ? Shovel : Footprints,
                    variant: 'default',
                    onClick: () => {
                      close();
                      if (autoHarvestOn && isFinite(hitsNeeded)) startDungeonAutoHarvest(x, y);
                      else handleMove(getDirection(dungeon.playerPosition, { x, y }));
                    },
                  });
                  actions.push({
                    id: 'toggle-auto-harvest-rune',
                    label: autoHarvestOn ? 'Disable Auto-Harvest' : 'Enable Auto-Harvest',
                    hint: 'Applies to dungeon walls and rune tiles; persisted in Settings',
                    icon: Pickaxe,
                    variant: 'outline',
                    onClick: () => {
                      updateSetting('autoMine', !autoHarvestOn);
                      toast.info(`Auto-Harvest ${!autoHarvestOn ? 'enabled' : 'disabled'}`);
                    },
                  });
                }
              } else if (tile.type === 'trap') {
                const trapType = tile.trapType || 'spike';
                const trapInfo = trapNames[trapType];
                const disarmChance = Math.min(95, Math.max(5, (monster.stats.dodge || 10) * 3 + 20));
                title = trapInfo.title;
                subtitle = tile.triggered ? 'Already triggered' : 'Hidden hazard';
                info.push({ label: 'Effect', value: trapInfo.description });
                info.push({ label: 'Status', value: tile.triggered ? 'Triggered' : 'Armed' });
                if (!tile.triggered) info.push({ label: 'Disarm', value: `${disarmChance}% success` });
                if (!tile.triggered) {
                  actions.push({
                    id: 'disarm-trap',
                    label: 'Disarm trap',
                    hint: `${disarmChance}% success chance`,
                    icon: Shovel,
                    variant: 'default',
                    onClick: () => {
                      close();
                      const success = Math.random() * 100 < disarmChance;
                      dispatch({ type: 'DISARM_TRAP', x, y, success });
                      if (success) {
                        addLog('🔧 Trap disarmed!', 'system');
                      } else {
                        if (trapType === 'spike') {
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
                          if (newHp <= 0) handleActiveMonsterDownOnMap('a triggered spike trap');
                        } else if (trapType === 'poison') {
                          addLog('☠️ Disarm failed! You got poisoned!', 'status');
                        } else {
                          addLog('🔔 Disarm failed! Alarm triggered!', 'status');
                        }
                      }
                    },
                  });
                }
              } else if (structure && structureDef) {
                title = `${structureDef.emoji} ${structureDef.name}`;
                subtitle = structure.built === false ? 'Construction site' : 'Player-built structure';
                info.push({ label: 'Tile', value: 'Dungeon structure' });
                if (structureDef.description) info.push({ label: 'Use', value: structureDef.description });
                info.push({ label: 'Health', value: `${structure.hp ?? '?'} / ${structure.maxHp ?? '?'}` });
                if (structureDef.requiresMonster) {
                  const assigned = structure.assignedMonsterId
                    ? state.run.party.find(m => m.id === structure.assignedMonsterId)
                    : null;
                  info.push({
                    label: 'Assigned',
                    value: assigned ? `Lv.${assigned.level} ${assigned.name}` : 'None (unstaffed)',
                  });
                }
                if (structure.type === 'farm' && structure.harvestReady) {
                  info.push({ label: 'Status', value: '🌾 Ready to harvest' });
                }
                actions.push({
                  id: 'open-building',
                  label: 'Building options…',
                  hint: 'Assign / repair / disassemble',
                  icon: Hammer,
                  onClick: () => {
                    close();
                    setDungeonContextBuilding(structure as PlayerBuilding);
                  },
                });
              } else if (tile.type === 'door') {
                title = '🚪 Door';
                subtitle = 'Passageway';
                info.push({ label: 'Action', value: 'Walk through it' });
              } else if (tile.type === 'wall') {
                title = '🪨 Bedrock';
                subtitle = 'Unbreakable structural rock';
                info.push({ label: 'Action', value: 'Cannot be mined' });
              } else if (tile.type === 'floor') {
                title = dist === 0 ? '📍 Your tile' : '🟫 Floor';
                subtitle = dist === 0 ? 'Current position' : 'Open ground';
              } else {
                title = '📍 Tile';
                subtitle = tile.type;
              }

              if (tile.explored && dist > 0 && tile.type !== 'wall' && tile.type !== 'mineable_wall' && !structure) {
                if (isAdjacent) {
                  actions.push({
                    id: 'move',
                    label: 'Move here',
                    icon: Footprints,
                    onClick: stepToTile,
                  });
                } else {
                  actions.push({
                    id: 'walk-here',
                    label: 'Walk here',
                    hint: 'Auto-path to this tile',
                    icon: Footprints,
                    onClick: autoPathToTile,
                  });
                }
              }

              if (!hasId('attack') && !hasId('bump-nest')) {
                const quickAttackLabel = tile.type === 'trap'
                  ? 'Attack trap'
                  : tile.type === 'mineable_wall'
                    ? 'Attack wall'
                    : tile.type === 'terrain'
                      ? 'Attack rune tile'
                      : 'Attack this tile';
                actions.push({
                  id: 'quick-attack-tile',
                  label: quickAttackLabel,
                  hint: directTileAttack ? `Uses ${directTileAttack.move.name}` : undefined,
                  icon: Swords,
                  disabled: !directTileAttack,
                  disabledReason: 'No attack move can currently reach this tile',
                  onClick: quickAttackTile,
                });
              }

              if (tile.type === 'floor') {
                actions.push({
                  id: 'build-here',
                  label: 'Build here',
                  hint: 'Choose a dungeon structure to place',
                  icon: Hammer,
                  onClick: () => {
                    close();
                    setDungeonBuildPanelOpen(true);
                  },
                });
              }

              actions.push({
                id: 'auto-shovel',
                label: isAutoShovelEnabled() ? 'Disable Auto-Shovel' : 'Enable Auto-Shovel',
                hint: 'Session-only; walking onto runes auto-digs them when possible',
                icon: Shovel,
                variant: 'outline',
                onClick: () => {
                  const next = !isAutoShovelEnabled();
                  setAutoShovelEnabled(next);
                  toast.info(`Auto-Shovel ${next ? 'enabled' : 'disabled'}`);
                },
              });

              const existing = dungeon.compassWaypoints || [];
              const pinnedWp = existing.find(p => p.x === x && p.y === y);
              const isPinned = !!pinnedWp;
              actions.push({
                id: 'waypoint',
                label: isPinned ? `Remove waypoint${pinnedWp?.name ? ` "${pinnedWp.name}"` : ''}` : 'Drop waypoint',
                icon: isPinned ? FlagOff : Flag,
                onClick: () => {
                  dispatch({ type: 'TOGGLE_DUNGEON_WAYPOINT', x, y });
                  if (isPinned) {
                    addLog(`📍 Waypoint removed`, 'system');
                  } else {
                    const ex = dungeon.entryPosition?.x ?? 0;
                    const ey = dungeon.entryPosition?.y ?? 0;
                    addLog(`📍 Waypoint pinned at (${x - ex}, ${y - ey})`, 'system');
                  }
                  close();
                },
              });
              if (isPinned) {
                actions.push({
                  id: 'rename-waypoint',
                  label: 'Rename waypoint…',
                  icon: Flag,
                  onClick: () => {
                    const current = pinnedWp?.name || '';
                    const next = window.prompt('Waypoint name (leave blank to clear):', current);
                    if (next !== null) {
                      dispatch({ type: 'RENAME_DUNGEON_WAYPOINT', x, y, name: next });
                      addLog(next.trim() ? `📍 Renamed to "${next.trim()}"` : `📍 Waypoint name cleared`, 'system');
                    }
                    close();
                  },
                });
              }

              return (
                <UnifiedTileMenu
                  worldX={x}
                  worldY={y}
                  title={title}
                  subtitle={subtitle}
                  info={info}
                  creature={creature}
                  actions={actions}
                  footnote={footnote}
                  onClose={close}
                />
              );
            })()}
          </div>


          {/* Bottom bar with controls and game log - resizable */}
          <div className="bg-card border-t-2 border-primary/20 z-40 flex flex-col flex-shrink-0" style={{ height: `${controlsBarHeight}px` }}>
            {/* Resize handle */}
            <div 
              className="w-full h-3 flex items-center justify-center cursor-row-resize hover:bg-primary/10 active:bg-primary/20 flex-shrink-0 touch-none"
              onMouseDown={handleBarResizeStart}
              onTouchStart={handleBarResizeStart}
            >
              <div className="w-12 h-1 rounded-full bg-border" />
            </div>
            <div className="flex-1 min-h-0 px-2 pb-2">
            {/* Log + open menu panel always sit side-by-side, including on
                mobile, so the player can see the map (above), the log, and
                the open attack/inventory panel without it falling below the
                fold. The d-pad has been removed — tap a tile to move. */}
            <div className="flex h-full gap-2">
              <div className={`${menuOpen ? 'w-1/3 sm:w-1/3' : 'flex-1'} min-w-0 p-2 bg-muted/30 rounded-lg border border-border/50 overflow-hidden flex flex-col transition-[width] duration-200`}>
                <div className="flex items-center justify-between gap-2 mb-1 flex-shrink-0">
                  <div className="flex items-center gap-1">
                    <ScrollText className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground">Log</span>
                  </div>
                  {/* Admin save button - always visible for admins during development */}
                  {isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-[10px] sm:h-6 sm:px-2 sm:text-xs flex-shrink-0"
                      onClick={handleManualSave}
                      disabled={cloudSyncing}
                      title={isAuthenticated ? 'Save progress to cloud' : 'Save progress locally'}
                    >
                      {cloudSyncing ? '⏳ Saving…' : '💾 Save'}
                    </Button>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-none space-y-0.5">
                  {[...gameLog].reverse().slice(0, 20).map((msg, i) => (
                    <p key={msg.id} className={`text-xs ${i === 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                      {msg.text}
                    </p>
                  ))}
                  {gameLog.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">No events yet...</p>
                  )}
                </div>
              </div>

              {menuOpen && (
                <div
                  id="dungeon-bottom-panel-host"
                  className="min-h-0 flex-1 sm:w-2/3 rounded-lg border border-border/50 bg-muted/30 overflow-hidden"
                />
              )}
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
  
  // Cloud save hook for admin save button
  const { saveToCloud, syncing: cloudSyncing, isAuthenticated } = useCloudSave();
  const { isAdmin } = useAdminRole();
  
  // ─── Manual save for admins: flush battle/run into saveData ───
  const handleManualSave = useCallback(async () => {
    if (!isAdmin) return;
    const snapshot = buildProgressSnapshot(state.saveData, state.run, null);
    dispatch({ type: 'SNAPSHOT_RUN_PROGRESS', overworld: null });
    if (!isAuthenticated) {
      toast.success('💾 Saved locally');
      return;
    }
    const result = await saveToCloud(snapshot);
    if (result.success) {
      toast.success('☁️ Saved to cloud');
    } else {
      toast.error(`Save failed: ${result.error || 'unknown error'}`);
    }
  }, [dispatch, state.saveData, state.run, isAdmin, isAuthenticated, saveToCloud]);

  // ─── Suspend run and return to main menu (from battle) ───
  // Snapshots run state and switches to main menu so the player can resume.
  const handleMainMenu = useCallback(async () => {
    addLog('💾 Saving and returning to main menu...', 'system');
    const snapshot = buildProgressSnapshot(state.saveData, state.run, null);
    dispatch({ type: 'SNAPSHOT_RUN_PROGRESS', overworld: null });
    if (isAuthenticated) {
      const result = await saveToCloud(snapshot);
      if (result.success) toast.success('☁️ Saved — returning to menu');
      else toast.error(`Save failed: ${result.error || 'unknown'} — returning anyway`);
    } else {
      toast.success('💾 Saved locally — returning to menu');
    }
    dispatch({ type: 'SET_PHASE', phase: 'main_menu' });
  }, [dispatch, state.saveData, state.run, isAuthenticated, saveToCloud, addLog]);
  
  // Level up screen queue state - supports multiple level-ups (active + passive party members)
  interface LevelUpEntry {
    previousStats: MonsterStats;
    previousLevel: number;
    newMoves: Move[];
    monster: Monster;
    isPassive?: boolean; // True if this is a passive party member
  }
  const [levelUpQueue, setLevelUpQueue] = useState<LevelUpEntry[]>([]);
  const levelUpData = levelUpQueue.length > 0 ? levelUpQueue[0] : null;
  
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
  
  // Move tier selector state
  const [selectedMoveForTier, setSelectedMoveForTier] = useState<Move | null>(null);

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
  
  // Combat effects tracking (local state synced with battle and partyEffects)
  // Initialize from partyEffects if available, otherwise from battle or empty
  const activeIndex = state.run?.activePartyIndex ?? 0;
  const storedEffects = state.run?.partyEffects?.[activeIndex];
  const [playerEffects, setPlayerEffects] = useState<CombatEffects>(
    storedEffects && (storedEffects.statusEffects.length > 0 || storedEffects.statModifiers.length > 0)
      ? storedEffects as CombatEffects
      : (battle?.playerEffects as CombatEffects || EMPTY_COMBAT_EFFECTS)
  );
  const [enemyEffects, setEnemyEffects] = useState<CombatEffects>(
    battle?.enemyEffects as CombatEffects || EMPTY_COMBAT_EFFECTS
  );
  
  // Sync playerEffects to partyEffects whenever they change
  useEffect(() => {
    if (state.run && playerEffects) {
      dispatch({ 
        type: 'SET_PARTY_EFFECTS', 
        partyIndex: state.run.activePartyIndex, 
        effects: playerEffects 
      });
    }
  }, [playerEffects, state.run?.activePartyIndex, dispatch]);

  // Keybind shortcuts for moves (battle)
  const battleKeybindDataRef = useRef(loadKeybinds());
  useEffect(() => {
    battleKeybindDataRef.current = loadKeybinds();
  });
  
  const executeMoveRef = useRef<((move: Move) => void) | null>(null);
  
  useEffect(() => {
    if (!battle || !state.run) return;
    const monster = battle.playerMonster;
    if (battle.turn !== 'player') return;
    
    const handleKeybindPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.shiftKey) return;
      
      const key = e.key.toLowerCase();
      const binds = getMonsterKeybindsImport(battleKeybindDataRef.current, `${monster.species}_${monster.element}_${monster.class}`);
      
      for (const [moveId, boundKey] of Object.entries(binds)) {
        if (boundKey === key) {
          const moves = getMonsterMoves(monster.species, monster.element, monster.class, monster.level);
          const move = moves.find(m => m.id === moveId);
          if (move && executeMoveRef.current) {
            e.preventDefault();
            executeMoveRef.current(move);
          }
          return;
        }
      }
    };
    
    window.addEventListener('keydown', handleKeybindPress);
    return () => window.removeEventListener('keydown', handleKeybindPress);
  }, [battle, state.run]);

  // Shift+1-9 for inventory items (battle)
  useEffect(() => {
    if (!battle || !state.run) return;
    
    const handleInventoryShortcut = (e: KeyboardEvent) => {
      if (!e.shiftKey) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (battle.turn !== 'player') return;
      
      const num = parseInt(e.key);
      if (isNaN(num) || num < 1 || num > 9) return;
      
      const inventory = state.run!.inventory || [];
      const consumables = inventory.filter(item => item.type === 'potion' || item.effect);
      const targetItem = consumables[num - 1];
      if (targetItem) {
        e.preventDefault();
        // handleUseItem will be defined after guard
      }
    };
    
    window.addEventListener('keydown', handleInventoryShortcut);
    return () => window.removeEventListener('keydown', handleInventoryShortcut);
  }, [battle, state.run]);
  
  if (!battle || !state.run) return null;
  const playerMoves = getMonsterMoves(battle.playerMonster.species, battle.playerMonster.element, battle.playerMonster.class, battle.playerMonster.level);
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
    const enemyMoves = getMonsterMoves(battle.enemyMonster.species, battle.enemyMonster.element, battle.enemyMonster.class, battle.enemyMonster.level);
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
    const enemyMoves = getMonsterMoves(battle.enemyMonster.species, battle.enemyMonster.element, battle.enemyMonster.class, battle.enemyMonster.level);
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
      const enemyMoves = getMonsterMoves(battle.enemyMonster.species, battle.enemyMonster.element, battle.enemyMonster.class, battle.enemyMonster.level);
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
    } else if (item.effect === 'dowse') {
      import('@/game/dowsingRod').then(({ activateDowsing, DOWSING_DURATION_MS }) => {
        activateDowsing(DOWSING_DURATION_MS);
      });
      message = '🔮 Dowsing Rod activated! Nearest threats will glow.';
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
    const enemyMoves = getMonsterMoves(battle.enemyMonster.species, battle.enemyMonster.element, battle.enemyMonster.class, battle.enemyMonster.level);
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
    executeMoveRef.current = executeMove; // Keep ref in sync

    // Get base move ID for mastery tracking (evolved moves have baseMoveId)
    const baseMoveId = (move as any).baseMoveId || move.id;

    // Check if player has enough stamina
    const staminaCost = move.staminaCost || 0;
    if (currentStamina < staminaCost) {
      toast.error('Not enough stamina!');
      return;
    }

    // Track move mastery usage
    const currentMastery = battle.playerMonster.moveMastery || {};
    const moveMasteryEntry = currentMastery[baseMoveId] || {
      uses: 0,
      currentTier: 'lesser' as const,
      hasAoE: false,
    };
    const newUses = moveMasteryEntry.uses + 1;
    
    // Calculate new tier
    const THRESHOLDS = { lesser: 0, minor: 10, base: 25, greater: 50, omega: 100 };
    let newTier: 'lesser' | 'minor' | 'base' | 'greater' | 'omega' = 'lesser';
    const tierOrder = ['lesser', 'minor', 'base', 'greater', 'omega'] as const;
    for (const tier of tierOrder) {
      if (newUses >= THRESHOLDS[tier]) {
        newTier = tier;
      }
    }
    const hasAoE = newUses >= 30;
    
    // Check for tier/AoE unlocks and notify
    const oldTier = moveMasteryEntry.currentTier;
    const oldAoE = moveMasteryEntry.hasAoE;
    if (newTier !== oldTier) {
      const tierNames: Record<string, string> = {
        lesser: 'Lesser', minor: 'Minor', base: 'Standard', greater: 'Greater', omega: 'Omega'
      };
      toast.success(`🎯 ${move.name} mastered to ${tierNames[newTier]} tier!`);
    }
    if (hasAoE && !oldAoE) {
      toast.success(`⚔️ ${move.name} Mass variant unlocked!`);
    }
    
    const updatedMastery = {
      ...currentMastery,
      [baseMoveId]: { uses: newUses, currentTier: newTier, hasAoE },
    };

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
      
      // Calculate passive party level-ups BEFORE dispatching (to capture state changes)
      const passiveXp = Math.floor(xpGained / 2);
      const passiveLevelUps: LevelUpEntry[] = [];
      
      if (state.run.party && passiveXp > 0) {
        state.run.party.forEach((monster, index) => {
          // Skip active monster and fainted monsters
          if (index === state.run!.activePartyIndex) return;
          if (monster.stats.currentHp <= 0) return;
          
          const currentMonsterXp = monster.experience || 0;
          let tempXp = currentMonsterXp + passiveXp;
          let tempLevel = monster.level;
          
          // Check if this monster will level up
          while (tempXp >= xpToNextLevel(tempLevel)) {
            const previousStats = tempLevel === monster.level 
              ? { ...monster.stats }
              : calculateStats(monster.species, monster.class, tempLevel);
            const previousLevel = tempLevel;
            
            tempXp -= xpToNextLevel(tempLevel);
            tempLevel += 1;
            
            const newStats = calculateStats(monster.species, monster.class, tempLevel);
            const newMoves = getNewMovesAtLevel(monster.species, monster.element, monster.class, tempLevel);
            
            passiveLevelUps.push({
              previousStats: {
                ...previousStats,
                currentHp: monster.stats.currentHp,
                currentStamina: monster.stats.currentStamina,
              },
              previousLevel,
              newMoves,
              monster: {
                ...monster,
                level: tempLevel,
                stats: {
                  ...newStats,
                  currentHp: Math.ceil(newStats.maxHp * (monster.stats.currentHp / monster.stats.maxHp)),
                  currentStamina: Math.ceil(newStats.stamina * (monster.stats.currentStamina / monster.stats.stamina)),
                },
              },
              isPassive: true,
            });
          }
        });
      }
      
      // Award half XP to passive party members (this also levels them up)
      dispatch({
        type: 'ADD_PARTY_XP',
        xpGained: xpGained,
        excludeActiveIndex: state.run.activePartyIndex,
      });

      // Check for active monster level up
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
      
      // Species-specific material drops
      const isRatScavenger = battle.playerMonster.species === 'rat';
      const materialDrops = calculateMonsterDrops(
        battle.enemyMonster.species,
        state.run?.dungeon?.floor || 1,
        isRatScavenger
      );
      
      for (const material of materialDrops) {
        dispatch({
          type: 'ADD_MATERIAL',
          materialId: material.id,
          quantity: 1,
        });
      }
      
      if (materialDrops.length > 0) {
        const dropNames = materialDrops.map(m => m.name).join(', ');
        toast.success(`💎 Dropped: ${dropNames}`);
      }
      
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
      
      // Build the level-up queue (active monster first, then passive members)
      const allLevelUps: LevelUpEntry[] = [];
      
      if (levelUpResult.leveled) {
        // Loop level-ups so a single big XP gain can grant multiple levels.
        // There is NO max level — keep leveling until remaining XP < threshold.
        let runningXp = newXp;
        let runningLevel = battle.playerMonster.level;
        let runningStats = { ...battle.playerMonster.stats };
        let runningCurrentHp = newPlayerHp;
        const accumulatedNewMoves: Move[] = [];
        const veryFirstPreviousStats = { ...battle.playerMonster.stats };
        const veryFirstPreviousLevel = battle.playerMonster.level;

        while (runningXp >= xpToNextLevel(runningLevel)) {
          runningXp -= xpToNextLevel(runningLevel);
          runningLevel += 1;
          const nextStats = calculateStats(battle.playerMonster.species, battle.playerMonster.class, runningLevel);
          runningCurrentHp = Math.min(runningCurrentHp + 10, nextStats.maxHp);
          runningStats = {
            ...nextStats,
            currentHp: runningCurrentHp,
            currentStamina: nextStats.stamina,
          };
          const movesThisLevel = getNewMovesAtLevel(
            battle.playerMonster.species,
            battle.playerMonster.element,
            battle.playerMonster.class,
            runningLevel
          );
          accumulatedNewMoves.push(...movesThisLevel);
        }

        const leveledMonster = {
          ...battle.playerMonster,
          level: runningLevel,
          stats: runningStats,
        };

        dispatch({
          type: 'UPDATE_PLAYER_MONSTER',
          monster: leveledMonster
        });
        // Replace XP delta so global XP equals the leftover after all level-ups.
        dispatch({ type: 'ADD_XP', amount: runningXp - experience });

        const levelsGained = runningLevel - battle.playerMonster.level;
        toast.success(
          levelsGained > 1
            ? `🎉 LEVEL UP x${levelsGained}! Now level ${runningLevel}!`
            : `🎉 LEVEL UP! Now level ${runningLevel}!`
        );

        allLevelUps.push({
          previousStats: veryFirstPreviousStats,
          previousLevel: veryFirstPreviousLevel,
          newMoves: accumulatedNewMoves,
          monster: leveledMonster,
          isPassive: false,
        });
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
      
      // Add passive level-ups to the queue
      allLevelUps.push(...passiveLevelUps);
      
      // If there are any level-ups, show them
      if (allLevelUps.length > 0) {
        setLevelUpQueue(allLevelUps);
        
        // Store recruitment data for after level up screens
        setDefeatedEnemy(battle.enemyMonster);
        setRecruitChance(calculatedRecruitChance);
        
        // Battle will be ended when user clicks "Continue" on the last level up screen
        return;
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
      
      // Party full - enemy drops their equipment since not recruited
      if (battle.enemyMonster.equipment) {
        const equipmentDrops = getEnemyEquipmentDrops(battle.enemyMonster.equipment);
        for (const item of equipmentDrops) {
          dispatch({ type: 'ADD_EQUIPMENT', item });
        }
        if (equipmentDrops.length > 0) {
          toast.success(`⚔️ Enemy dropped ${equipmentDrops.length} equipment piece(s)!`);
        }
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
      const enemyMoves = getMonsterMoves(updatedEnemyMonster.species, updatedEnemyMonster.element, updatedEnemyMonster.class, updatedEnemyMonster.level);
      
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
      let updatedPlayerMonster = { ...battle.playerMonster, moveMastery: updatedMastery };
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

  const inventory = state.run.inventory || [];
  
  // Bottom offset based on menu state
  const bottomOffset = menuOpen ? 'pb-[280px]' : 'pb-[180px]';

  // Handle level up screen dismissal - advances through the queue
  const handleLevelUpContinue = () => {
    // Remove the first item from the queue
    setLevelUpQueue(prev => {
      const remaining = prev.slice(1);
      
      // If no more level-ups, proceed to recruitment or end battle
      if (remaining.length === 0) {
        // Show recruitment if there's a defeated enemy. Even when the party
        // is full the modal lets the player replace a member or send the
        // recruit home to storage.
        if (defeatedEnemy && state.run) {
          setShowRecruitment(true);
        } else {
          // End the battle now that user has seen all level up screens
          dispatch({
            type: 'END_BATTLE',
            victory: true
          });
          // Reset battle stats
          setBattleStats({ turnsUsed: 0, overkillDamage: 0, statusEffectsApplied: 0, criticalHits: 0 });
        }
      }
      
      return remaining;
    });
  };
  
  // ─── Recruitment handlers (post-combat) ───
  // The roll happens inside RecruitmentModal. These callbacks just react
  // to whichever path the player took: fail, add-to-party, replace, send-home,
  // or dismiss.

  // Shared: end the recruitment flow and finalize the battle.
  const finishRecruitmentFlow = () => {
    setShowRecruitment(false);
    setDefeatedEnemy(null);
    setBattleStats({ turnsUsed: 0, overkillDamage: 0, statusEffectsApplied: 0, criticalHits: 0 });
    dispatch({ type: 'END_BATTLE', victory: true });
  };

  // Shared: drop the defeated enemy's gear into player loot.
  const dropDefeatedEquipment = () => {
    if (!defeatedEnemy?.equipment) return 0;
    const equipmentDrops = getEnemyEquipmentDrops(defeatedEnemy.equipment);
    for (const item of equipmentDrops) {
      dispatch({ type: 'ADD_EQUIPMENT', item });
    }
    return equipmentDrops.length;
  };

  // Recruit roll failed.
  const handleRecruitFail = () => {
    if (!defeatedEnemy) return finishRecruitmentFlow();
    toast.error(`${defeatedEnemy.name} wasn't impressed enough to join...`);
    const dropped = dropDefeatedEquipment();
    if (dropped > 0) {
      toast.success(`⚔️ Enemy dropped ${dropped} equipment piece(s)!`);
    }
    finishRecruitmentFlow();
  };

  // Recruit succeeded → add directly to active party.
  const handleRecruitAddToParty = () => {
    if (!defeatedEnemy || !state.run) return finishRecruitmentFlow();

    const recruitedMonster: Monster = {
      ...defeatedEnemy,
      id: `party_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      stats: {
        ...defeatedEnemy.stats,
        currentHp: Math.floor(defeatedEnemy.stats.maxHp * 0.5),
        currentStamina: Math.floor((defeatedEnemy.stats.stamina || 50) * 0.5),
      },
      equipment: undefined,
    };

    dispatch({ type: 'ADD_TO_PARTY', monster: recruitedMonster });

    if (defeatedEnemy.equipment) {
      const dropped = dropDefeatedEquipment();
      if (dropped > 0) {
        toast.success(`🎉 ${defeatedEnemy.name} joined with ${dropped} equipment piece(s)!`);
      } else {
        toast.success(`🎉 ${defeatedEnemy.name} joined your party!`);
      }
    } else {
      toast.success(`🎉 ${defeatedEnemy.name} joined your party!`);
    }
    finishRecruitmentFlow();
  };

  // Recruit succeeded → swap out a chosen party member (sent home), then add.
  const handleRecruitReplaceMember = (replaceIndex: number) => {
    if (!defeatedEnemy || !state.run) return finishRecruitmentFlow();
    dispatch({ type: 'SEND_PARTY_MEMBER_TO_TOWN', partyIndex: replaceIndex });

    const recruitedMonster: Monster = {
      ...defeatedEnemy,
      id: `party_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      stats: {
        ...defeatedEnemy.stats,
        currentHp: Math.floor(defeatedEnemy.stats.maxHp * 0.5),
        currentStamina: Math.floor((defeatedEnemy.stats.stamina || 50) * 0.5),
      },
      equipment: undefined,
    };
    dispatch({ type: 'ADD_TO_PARTY', monster: recruitedMonster });

    if (defeatedEnemy.equipment) {
      const dropped = dropDefeatedEquipment();
      if (dropped > 0) {
        toast.success(`🔄 Replaced! ${defeatedEnemy.name} joined with ${dropped} equipment piece(s)!`);
      } else {
        toast.success(`🔄 ${defeatedEnemy.name} took their place in the party!`);
      }
    } else {
      toast.success(`🔄 ${defeatedEnemy.name} took their place in the party!`);
    }
    finishRecruitmentFlow();
  };

  // Recruit succeeded → send the recruit straight to roster storage.
  const handleRecruitSendHome = () => {
    if (!defeatedEnemy) return finishRecruitmentFlow();
    const comboId = `${defeatedEnemy.species}_${defeatedEnemy.element}_${defeatedEnemy.class}`;
    dispatch({
      type: 'UNLOCK_MONSTER',
      monster: {
        comboId,
        species: defeatedEnemy.species,
        element: defeatedEnemy.element,
        classType: defeatedEnemy.class,
        level: defeatedEnemy.level,
        equipment: defeatedEnemy.equipment,
      },
    });
    // Equipment travels home with the recruit — don't also drop it as loot.
    toast.success(`🏠 ${defeatedEnemy.name} was sent home to your roster!`);
    finishRecruitmentFlow();
  };

  // Player chose to walk away before even attempting the roll.
  const handleDismissRecruitment = () => {
    const dropped = dropDefeatedEquipment();
    if (dropped > 0) {
      toast.success(`⚔️ Enemy dropped ${dropped} equipment piece(s)!`);
    }
    finishRecruitmentFlow();
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
          party={state.run?.party || []}
          partyFull={(state.run?.party.length || 0) >= 6}
          onFail={handleRecruitFail}
          onAddToParty={handleRecruitAddToParty}
          onReplaceMember={handleRecruitReplaceMember}
          onSendHome={handleRecruitSendHome}
          onDismiss={handleDismissRecruitment}
          unlockedMonsters={state.saveData.unlockedMonsters}
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
          isPassive={levelUpData.isPassive}
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
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-1">
              <ScrollText className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground">Log</span>
            </div>
            {/* Admin save button - always visible for admins during development */}
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-[10px] sm:h-6 sm:px-2 sm:text-xs flex-shrink-0"
                onClick={handleManualSave}
                disabled={cloudSyncing}
                title={isAuthenticated ? 'Save progress to cloud' : 'Save progress locally'}
              >
                {cloudSyncing ? '⏳ Saving…' : `💾 Save${isAuthenticated ? '' : ' (local)'}`}
              </Button>
            )}
          </div>
          <div className="space-y-0.5">
            {[...gameLog].reverse().slice(0, 5).map((msg, i) => (
              <p key={msg.id} className={`text-xs ${i === 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
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
            <UnifiedMovePanel
              moves={playerMoves}
              monster={battle.playerMonster}
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
              moveOrder={state.run.moveOrder}
              hiddenMoves={state.run.hiddenMoves}
              onReorder={(order) => dispatch({ type: 'SET_MOVE_ORDER', order })}
              onToggleHide={(moveId) => dispatch({ type: 'TOGGLE_HIDE_MOVE', moveId })}
              inBattle={true}
              currentStamina={currentStamina}
              enemyMonster={battle.enemyMonster}
              onUseMove={(move) => executeMove(move)}
              autoAddStruggle={true}
            />
          )}
        </div>
      </div>

      {/* Unified GameSidebar for battle */}
      {(() => {
        const battleDungeonId = typeof window !== 'undefined'
          ? localStorage.getItem('menagerie_active_dungeon_id')
          : null;
        const battleEntrance = battleDungeonId
          ? state.saveData?.dungeonEntrances?.[battleDungeonId]
          : undefined;
        const battleTheme = battleEntrance?.theme ?? state.run?.dungeon?.theme;
        const battleThemeName = battleTheme
          ? (battleTheme.kind === 'all'
              ? 'Tower of the Infinite'
              : battleTheme.value
                ? `${String(battleTheme.value)[0].toUpperCase()}${String(battleTheme.value).slice(1)} Tower`
                : null)
          : null;
        const battleLocationName = battleEntrance?.name
          || battleThemeName
          || (battleEntrance?.element
              ? `${battleEntrance.element[0].toUpperCase()}${battleEntrance.element.slice(1)} Wilderness Dungeon`
              : 'Tower of the Infinite');
        return (
      <GameSidebar 
        monster={battle.playerMonster}
        gold={state.run.gold}
        floor={state.run.dungeon?.floor || 1}
        locationName={battleLocationName}
        inventory={inventory}
        equipmentInventory={state.run.equipmentInventory}
        equipment={state.run.partyEquipment[state.run.activePartyIndex]}
        runMaterials={state.run.runMaterials}
        moveOrder={state.run.moveOrder}
        hiddenMoves={state.run.hiddenMoves}
        onFlee={handleFlee}
        onMainMenu={handleMainMenu}
        mainMenuTitle="Save and return to main menu (resume later)"
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
        party={state.run.party}
        activePartyIndex={state.run.activePartyIndex}
        partyEffects={(state.run.partyEffects || []) as CombatEffects[]}
      />
        );
      })()}
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

  // Periodic + debounced cloud autosave (silent, only when signed in).
  useCloudAutosave(buildProgressSnapshot(state.saveData, state.run, state.saveData.overworldState));

  // Unified run log (dungeon + battle + notable UI events)
  const [gameLog, setGameLog] = useState<LogMessage[]>([]);
  const addLog = useCallback((text: string, type: LogMessage['type'] = 'info') => {
    setGameLog(prev => [...prev.slice(-199), createLogMessage(text, type)]);
  }, []);

  // Route Sonner toasts: during gameplay (dungeon/battle/overworld/defeat/summary)
  // push to the in-game log ONLY (no popup). Outside gameplay (menus, auth) show normally.
  const phaseRef = useRef(state.phase);
  phaseRef.current = state.phase;
  useEffect(() => {
    const originalSuccess = toast.success;
    const originalError = toast.error;
    const originalInfo = (toast as any).info;

    const inGame = () => {
      const p = phaseRef.current;
      return p === 'dungeon' || p === 'battle' || p === 'overworld' || p === 'defeat' || p === 'run_summary';
    };

    toast.success = ((message: any, options?: any) => {
      const parsed = parseLogMessage(String(message));
      addLog(parsed.text, parsed.type);
      if (!inGame()) return originalSuccess(message, options);
      return '' as any;
    }) as any;

    toast.error = ((message: any, options?: any) => {
      const parsed = parseLogMessage(String(message));
      addLog(parsed.text, parsed.type);
      if (!inGame()) return originalError(message, options);
      return '' as any;
    }) as any;

    if (typeof originalInfo === 'function') {
      (toast as any).info = (message: any, options?: any) => {
        const parsed = parseLogMessage(String(message));
        addLog(parsed.text, parsed.type);
        if (!inGame()) return originalInfo(message, options);
        return '' as any;
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
    case 'overworld':
      return <OverworldView gameLog={gameLog} addLog={addLog} />;
    default:
      return <MainMenu />;
  }
}
export default function Index() {
  return (
    <main>
      <SettingsProvider>
        <GameProvider>
          <Game />
        </GameProvider>
      </SettingsProvider>
    </main>
  );
}