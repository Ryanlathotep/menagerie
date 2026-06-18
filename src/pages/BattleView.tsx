import { GameProvider, useGame, buildProgressSnapshot } from '@/game/state';
import { DebugBridgeMount } from '@/dev/DebugBridgeMount';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getComboId, UnlockedMonster, InventoryItem, MonsterStats, Monster, Position, DungeonState, hydrateDungeonFromSnapshot } from '@/game/types';
import { createMonster, calculateStats } from '@/game/utils';
import { generateDungeon, movePlayer, removeEnemy, LootItem, shouldStopAutoRun, hasVisibleEnemy, LOOT_TABLE, mineWall, mineableWallName, digRune, damageDungeonNest, tickDungeonNests, prepareDungeonForEntry, findNearestWalkableTile, updateVisibility, getDungeonTowerVisionSources } from '@/game/dungeon';
import { getItemWorldTowerType, ITEM_WORLD_REWARD_FLOOR_DELTA } from '@/game/itemWorldTowers';
import { spawnNestMonster, getNestDestroyRewards } from '@/game/nests';
import { expandDungeonIfNeeded, findStairsPosition } from '@/game/dungeonExpansion';
import { PICKAXE_TIERS, hitsToBreak } from '@/game/tools';
import { useEffect, useCallback, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScrollText, Flag, FlagOff, Swords, Footprints, Pickaxe, Hammer, DoorOpen, ChevronDown, ChevronUp, ShoppingBag, Trees, Shovel, FlaskConical, Wand2 } from 'lucide-react';
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
  getGrappleModifiers,
} from '@/game/statusEffects';
import { StatusIcons } from '@/game/StatusEffectDisplay';
import { CraftingWorkshop } from '@/game/CraftingWorkshop';
import { CraftingRecipe, ConsumableRecipe } from '@/game/equipment';
import { isCreativeMode, effectiveTools } from '@/game/creativeMode';
import { findPath, getDirection } from '@/game/pathfinding';
import { RecruitmentModal, calculateRecruitChance } from '@/game/RecruitmentModal';
import { PartySwitchModal } from '@/game/PartySwitchModal';
import { ReviveTargetModal } from '@/game/ReviveTargetModal';
import { ScrollUseDialog } from '@/game/ScrollUseDialog';
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
import { loadKeybinds, getMonsterKeybinds as getMonsterKeybindsImport, isTypingTarget } from '@/game/keybinds';
import { useAuth } from '@/hooks/useAuth';
import { useCloudSave } from '@/hooks/useCloudSave';
import { useCloudAutosave } from '@/hooks/useCloudAutosave';
import { useAdminRole } from '@/hooks/useAdminRole';

import { MainMenu } from './MainMenu';
import { FloatingActionButton } from '@/game/FloatingActionButton';
import { CharacterSelect } from './CharacterSelect';
import { RunSummary } from './RunSummary';

// Battle View Component with proper combat calculations
export function BattleView({
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
  // Scroll use dialog (Skill Forge scrolls — Teach / Cast Once)
  const [pendingScrollItem, setPendingScrollItem] = useState<InventoryItem | null>(null);
  
  
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
      if (isTypingTarget(e.target)) return;
      if (e.shiftKey) return;
      
      const key = e.key.toLowerCase();
      const binds = getMonsterKeybindsImport(battleKeybindDataRef.current, `${monster.species}_${monster.element}_${monster.class}`);
      
      for (const [moveId, boundKey] of Object.entries(binds)) {
        if (boundKey === key) {
          const moves = getMonsterMoves(monster.species, monster.element, monster.class, monster.level, `${monster.species}_${monster.element}_${monster.class}`);
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
      if (isTypingTarget(e.target)) return;
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
  const playerMoves = getMonsterMoves(battle.playerMonster.species, battle.playerMonster.element, battle.playerMonster.class, battle.playerMonster.level, `${battle.playerMonster.species}_${battle.playerMonster.element}_${battle.playerMonster.class}`);
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
      // All party members defeated. Before END_RUN, offer a revive prompt if
      // the player is carrying a Revive Herb / Phoenix Flower (bug a712c559).
      const reviveItem = (state.run?.inventory ?? []).find(
        (it) => it.effect === 'revive' || it.effect === 'revive_full'
      );
      if (reviveItem) {
        toast.warning(`Last monster fell — use a ${reviveItem.name} to keep going!`);
        setPendingReviveItem(reviveItem);
        setShowReviveModal(true);
        return;
      }
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
    const enemyResult = executeCombat(enemyMove, battle.enemyMonster, newMonster, true, undefined, undefined, enemyEffects);
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
    const enemyResult = executeCombat(enemyMove, battle.enemyMonster, battle.playerMonster, true, undefined, undefined, enemyEffects);
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
    let fleeChance = 50 + (playerSpeed - enemySpeed) * 2;
    // Grapple penalty: escape is harder while locked in a grapple.
    const grapple = getGrappleModifiers(playerEffects);
    if (grapple) fleeChance = Math.max(5, fleeChance - grapple.escapeMod);
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
      const enemyResult = executeCombat(enemyMove, battle.enemyMonster, battle.playerMonster, true, undefined, undefined, enemyEffects);
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
    // Skill Forge scroll — open the Teach / Cast dialog instead of consuming.
    if (item.effect?.startsWith('teach_move:')) {
      setPendingScrollItem(item);
      return;
    }
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
    }, true, undefined, undefined, enemyEffects);
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

    // Execute combat with proper calculations (pass player's combat effects so
    // the ranged-accuracy penalty from being grappled is applied automatically).
    const result = executeCombat(move, battle.playerMonster, battle.enemyMonster, true, undefined, undefined, playerEffects);
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

    // === Forced Grapple from move flag (refreshes/extends grapple on both fighters) ===
    if (result.hit && move.grapple?.forces) {
      const g = move.grapple;
      const grappleStatus = {
        type: 'grappled' as const,
        turnsRemaining: g.duration ?? 3,
        source: move.name,
        grappleEscapeMod: g.escapeMod ?? 25,
        grappleRangedAccMod: g.rangedAccMod ?? 25,
        grappleMovementMod: g.movementMod ?? 25,
      };
      updatedPlayerEffects = {
        ...updatedPlayerEffects,
        statusEffects: [...updatedPlayerEffects.statusEffects.filter(e => e.type !== 'grappled'), grappleStatus],
      };
      updatedEnemyEffects = {
        ...updatedEnemyEffects,
        statusEffects: [...updatedEnemyEffects.statusEffects.filter(e => e.type !== 'grappled'), grappleStatus],
      };
      newLog.push(`🤼 ${move.name} locks both fighters into a grapple!`);
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
      
      const enemyResult = executeCombat(enemyMove, attackingEnemy, battle.playerMonster, true, undefined, undefined, enemyEffects);
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

      {/* Scroll use dialog (Skill Forge scrolls — Teach / Cast Once) */}
      <ScrollUseDialog
        open={!!pendingScrollItem}
        scroll={pendingScrollItem}
        party={state.run?.party || []}
        canCast={true}
        onTeach={(comboId, moveId, itemId) => {
          dispatch({ type: 'TEACH_MOVE_FROM_SCROLL', comboId, moveId, itemId });
          toast.success('Move learned!');
        }}
        onCast={(move, itemId) => {
          // Consume the scroll, then fire the move once for free.
          dispatch({ type: 'USE_ITEM', itemId });
          executeMove({ ...move, staminaCost: 0 });
        }}
        onClose={() => setPendingScrollItem(null)}
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
          <h2 className="text-2xl font-bold text-center bg-gradient-to-r from-primary to-destructive bg-clip-text text-transparent mb-2">
            🤼 Grapple
          </h2>
          {(() => {
            const g = getGrappleModifiers(playerEffects);
            if (!g) return null;
            return (
              <div className="mx-auto mb-3 max-w-2xl text-center text-xs px-3 py-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                🤼 <strong>Grappled</strong> — Ranged accuracy −{g.rangedAccMod}% · Movement −{g.movementMod}% · Escape −{g.escapeMod}% · {g.turnsRemaining} turn{g.turnsRemaining === 1 ? '' : 's'} left
              </div>
            );
          })()}
        
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

