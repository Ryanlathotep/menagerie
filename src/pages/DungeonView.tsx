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
import { ScrollText, Flag, FlagOff, Swords, Footprints, Pickaxe, Hammer, DoorOpen, ChevronDown, ChevronUp, ShoppingBag, Trees, Shovel, FlaskConical, Wand2, Repeat, Crosshair, Search } from 'lucide-react';
import { findBestMatchupSwap } from '@/game/MatchupIndicator';
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

export function DungeonView({
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
  // Scroll use dialog (Skill Forge scrolls — Teach / Cast Once)
  const [pendingScrollItem, setPendingScrollItem] = useState<InventoryItem | null>(null);
  const [stairExitDialogOpen, setStairExitDialogOpen] = useState(false);
  // Auto-Search picker (dungeon-scoped analogue of the overworld picker).
  const [dungeonAutoSearchOpen, setDungeonAutoSearchOpen] = useState(false);

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
      // Bug fix: the snapshot tiles may overwrite fresh.playerPosition with a
      // wall (different layout from a prior run). If we plant the entry
      // staircase there, prepareDungeonForEntry silently relocates the player
      // to a nearby walkable tile that has no `stairsBeneath: 'up'`, leaving
      // the player stuck on a "completed" floor with no exit portal.
      // Resolve the final walkable spawn FIRST, then mark the entry tile.
      let spawn = hydrated.playerPosition;
      const spawnTile = hydrated.tiles[spawn.y]?.[spawn.x];
      const blocked = !spawnTile
        || spawnTile.type === 'wall'
        || spawnTile.type === 'mineable_wall'
        || spawnTile.type === 'nest';
      if (blocked) {
        const safe = findNearestWalkableTile(hydrated.tiles, spawn.x, spawn.y);
        if (safe) spawn = safe;
      }
      // Mark the entry tile so an "up" staircase appears beneath the player —
      // stepping back onto it exits the dungeon to the overworld / summary.
      const entryTiles = hydrated.tiles.map((row, y) =>
        row.map((t, x) => (x === spawn.x && y === spawn.y ? { ...t, stairsBeneath: 'up' as const } : t))
      );
      dispatch({
        type: 'SET_DUNGEON',
        dungeon: prepareDungeonForEntry({
          ...hydrated,
          tiles: entryTiles,
          playerPosition: spawn,
          entryPosition: { ...spawn },
        }),
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
      return;
    }

    // Last man down — before ending the run, check inventory for a Revive item.
    // Bug fix: players carrying Revive Herbs / Phoenix Flowers used to be
    // game-overed without ever being offered the chance to use them.
    const reviveItem = (state.run.inventory ?? []).find(
      (it) => it.effect === 'revive' || it.effect === 'revive_full'
    );
    if (reviveItem) {
      addLog(`💀 ${state.run.currentMonster.name} fell to ${cause}! Use a ${reviveItem.name} to keep going.`, 'damage');
      toast.warning(`${state.run.currentMonster.name} fainted — pick a member to revive.`);
      setPendingDungeonReviveItem(reviveItem);
      setShowDungeonReviveModal(true);
      return;
    }

    addLog(`☠️ Your entire party has fallen! Returning to town...`, 'damage');
    dispatch({ type: 'END_RUN', victory: false });
    dispatch({ type: 'SET_PHASE', phase: 'run_summary' });
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
    // CRITICAL: rebase result.dungeon onto the expanded grid so every
    // downstream step (runeBump, tickDungeonNests, processEnemyTurns) operates
    // on — and dispatches — the same expanded dungeon. Otherwise the enemy
    // turn that fires when an enemy enters proximity overwrites the expansion
    // with stale coords and softlocks the player at the edge.
    const expandedDungeon = expandDungeonIfNeeded(result.dungeon);
    result.dungeon = expandedDungeon;
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
        // Same fix as initial entry: if the snapshot replaced fresh.playerPosition
        // with a wall, relocate to a walkable neighbour BEFORE planting the
        // ascent staircase so the player always has a way back up.
        let spawn = fresh.playerPosition;
        const sTile = tiles[spawn.y]?.[spawn.x];
        if (!sTile || sTile.type === 'wall' || sTile.type === 'mineable_wall' || sTile.type === 'nest') {
          const safe = findNearestWalkableTile(tiles, spawn.x, spawn.y);
          if (safe) spawn = safe;
        }
        tiles[spawn.y][spawn.x].stairsBeneath = 'up';
        newDungeon = { ...fresh, tiles, playerPosition: spawn, entryPosition: { ...spawn }, visitedFloors: visited };
      }
      dispatch({ type: 'SET_DUNGEON', dungeon: prepareDungeonForEntry(newDungeon) });
      addLog(`⬇️ Descended to Floor ${nextFloorNum}!`, 'system');
      const towerId = typeof window !== 'undefined' ? localStorage.getItem('menagerie_active_dungeon_id') : null;
      if (towerId) {
        const partySnapshot = state.run?.party?.map(m => ({
          species: m.species, class: m.class, element: m.element, level: m.level,
        })) ?? null;
        void submitTowerFloor(towerId, nextFloorNum, partySnapshot);
      }
      // Item World tower reward check.
      if (towerId) {
        const iwType = getItemWorldTowerType(towerId);
        const iwState = iwType ? state.saveData.itemWorldTowerState?.[iwType] : null;
        if (iwType && iwState && !iwState.hasExtractedReward) {
          const threshold = (iwState.baseAssetLevel ?? 1) + ITEM_WORLD_REWARD_FLOOR_DELTA;
          if (nextFloorNum >= threshold) {
            dispatch({ type: 'CLAIM_ITEM_WORLD_REWARD', towerType: iwType, floorReached: nextFloorNum });
            const rewardMsg =
              iwType === 'prototyping' ? `🔨 Recipe unlocked: ${iwState.baseAssetName}!` :
              iwType === 'training'    ? `⚔️ ${iwState.baseAssetName} gained a permanent +1 base level!` :
                                         `✨ Scroll of ${iwState.baseAssetName} added to town storage!`;
            addLog(rewardMsg, 'system');
            toast.success(rewardMsg);
          }
        }
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
      dispatch({ type: 'SET_DUNGEON', dungeon: prepareDungeonForEntry(newDungeon) });
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
    // The player must never be locked out of moving entirely: a visible enemy
    // only stops *continued* auto-running. The first step of a deliberate
    // auto-run command always executes.
    let stepsTaken = 0;
    
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
          if (shouldStopAutoRun(currentDungeon.tiles, nextX, nextY, currentDungeon.width, currentDungeon.height, { allowMineable: !!settings.autoMine })) {
            setIsAutoRunning(false);
            autoRunDirection.current = null;
            return;
          }
          
          // Stop CONTINUED running when any enemy is visible (spotted!) — but
          // always allow the first step so the player is never frozen in place.
          if (stepsTaken > 0 && hasVisibleEnemy(currentDungeon.tiles)) {
            setIsAutoRunning(false);
            autoRunDirection.current = null;
            return;
          }
        
        isMovingRef.current = true;
        handleMoveRef.current(direction);
        stepsTaken++;
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
      if (isTypingTarget(e.target)) return;
      if (showShop) return;

      // Space halts every automatic action without moving. Explicitly handle
      // it up front so it also cancels auto-harvest (which the "any key stops
      // auto-run/path-walk" branches below don't cover) and so the browser
      // doesn't scroll the page on space.
      if (e.key === ' ' || e.key === 'Spacebar') {
        const halted = isAutoRunning || isPathWalking || !!autoHarvestTargetRef.current;
        if (halted) {
          e.preventDefault();
          if (isAutoRunning) {
            stopAutoRun.current = true;
            setIsAutoRunning(false);
            autoRunDirection.current = null;
          }
          if (isPathWalking) {
            setIsPathWalking(false);
            setTargetPath([]);
            pathWalkRef.current = [];
            pathGoalRef.current = null;
          }
          if (autoHarvestTargetRef.current) {
            cancelAutoHarvest('⏸ Auto-Harvest halted.');
          }
          return;
        }
        // Nothing automatic running — swallow space so the page doesn't
        // scroll, but don't treat it as a movement key.
        e.preventDefault();
        return;
      }

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
    
    const path = findPath(dungeon, dungeon.playerPosition, { x, y }, { allowMineable: !!settings.autoMine });
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
          let repath = findPath(currentDungeon, currentDungeon.playerPosition, goal, { allowMineable: !!settings.autoMine });
          if (!repath || repath.length === 0) {
            const shifted = { x: goal.x + dx, y: goal.y + dy };
            repath = findPath(currentDungeon, currentDungeon.playerPosition, shifted, { allowMineable: !!settings.autoMine });
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
        const shouldStop = shouldStopAutoRun(currentDungeon.tiles, nextPos.x, nextPos.y, currentDungeon.width, currentDungeon.height, { allowMineable: !!settings.autoMine });

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

    // Skill Forge scroll — open the Teach / Cast dialog instead of consuming.
    if (item.effect?.startsWith('teach_move:')) {
      setPendingScrollItem(item);
      return;
    }

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

    // If the current active monster is fainted (rescue path from
    // handleActiveMonsterDownOnMap), swap to the freshly revived one so the
    // run can continue instead of resuming with a 0-HP active.
    if (state.run.currentMonster.stats.currentHp <= 0 && partyIndex !== state.run.activePartyIndex) {
      dispatch({ type: 'SWITCH_ACTIVE_MONSTER', index: partyIndex });
    }

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

    // For attack moves (melee/ranged) AND movement skills (dash/blink/etc.),
    // enter targeting mode instead of executing immediately.
    const isMovementSkill =
      move.type === 'movement' ||
      !!(move.movement && move.movement.offsets && move.movement.offsets.length > 0);
    if (
      move.type === 'melee' ||
      move.type === 'ranged' ||
      (move.type === 'status' && move.effect?.includes('lower_')) ||
      isMovementSkill
    ) {
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
        toast.error(isMovementSkill ? 'No valid destinations in range!' : 'No valid targets in range!');
        return;
      }
      
      setTargetingMove(move);
      setTargetingTiles(validTargets);
      setAffectedTiles([]);
      setHoveredTile(null);
      addLog(
        isMovementSkill
          ? `🌀 ${move.name}: pick a destination tile…`
          : `🎯 Targeting ${move.name}... Click a tile to attack!`,
        'system',
      );
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
      dungeon.height,
      dungeon.tiles, // ← pass tiles so wall-blocking branches actually fire
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

    // CRITICAL: pass dungeon.tiles so getAffectedTiles can apply LOS/wall
    // checks. Without it every pattern fires as if wallPenetrate=true and
    // attacks shoot straight through dungeon walls.
    const affected = getAffectedTiles(dungeon.playerPosition, { x, y }, config, dungeon.width, dungeon.height, dungeon.tiles);


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

  // Apply a buildings change AND recompute fog-of-war in one dispatch so that
  // scout towers reveal/hide tiles immediately on build / assign / disassemble.
  const applyDungeonBuildings = useCallback((buildings: PlayerBuilding[]) => {
    if (!dungeon) return;
    const tiles = dungeon.tiles.map(row => row.map(t => ({ ...t })));
    updateVisibility(
      tiles,
      dungeon.playerPosition,
      3,
      getDungeonTowerVisionSources({ playerBuildings: buildings }),
    );
    dispatch({
      type: 'UPDATE_DUNGEON',
      dungeon: { playerBuildings: buildings, tiles } as any,
    });
  }, [dungeon, dispatch]);

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
    applyDungeonBuildings(buildings);
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
    applyDungeonBuildings(buildings);
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
    applyDungeonBuildings(buildings);
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
    applyDungeonBuildings(buildings);
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
      // Allow placement on floor or terrain (decorative ground) tiles only.
      if (!tile || (tile.type !== 'floor' && tile.type !== 'terrain')) {
        toast.error('Can only build on open floor tiles!');
        return;
      }
      // Reject if already occupied by a player building on this floor
      const existing = (dungeon.playerBuildings || []) as PlayerBuilding[];
      if (existing.some(b => b.worldX === x && b.worldY === y)) {
        toast.error('A building already stands here.');
        return;
      }
      // Stairs/ladders must attach to a wall (dungeon wall OR a player wall).
      if (selectedDungeonBuildType === 'stone_staircase' || selectedDungeonBuildType === 'ladder') {
        const dirs: Array<[number, number]> = [[0, -1], [0, 1], [-1, 0], [1, 0]];
        const adjacent = dirs.some(([dx, dy]) => {
          const nt = dungeon.tiles[y + dy]?.[x + dx];
          if (nt && (nt.type === 'wall' || nt.type === 'mineable_wall')) return true;
          return existing.some(b => b.type === 'wall' && b.worldX === x + dx && b.worldY === y + dy);
        });
        if (!adjacent) {
          toast.error('Stairs must be placed next to a wall.');
          return;
        }
      }
      const def = BUILDING_DEFINITIONS[selectedDungeonBuildType];
      const ow = state.saveData.overworldState;
      const creative = isCreativeMode();
      if (!creative && (!ow || ow.woodCollected < def.cost.wood || ow.stoneCollected < def.cost.stone)) {
        toast.error(`Need 🪵 ${def.cost.wood} 🪨 ${def.cost.stone}`);
        return;
      }
      const newBuilding = createBuilding(selectedDungeonBuildType, x, y);
      applyDungeonBuildings([...existing, newBuilding]);
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
      const moves = getMonsterMoves(monster.species, monster.element, monster.class, monster.level, `${monster.species}_${monster.element}_${monster.class}`);
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
      if (isTypingTarget(e.target)) return;
      if (e.shiftKey) return;
      if (targetingMove) return;
      
      const key = e.key.toLowerCase();
      const binds = getMonsterKeybindsImport(keybindDataRef.current, `${monster.species}_${monster.element}_${(monster as any).class}`);
      
      for (const [moveId, boundKey] of Object.entries(binds)) {
        if (boundKey === key) {
          const moves = getMonsterMoves(monster.species, monster.element, (monster as any).class, monster.level, `${monster.species}_${monster.element}_${(monster as any).class}`);
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
      if (isTypingTarget(e.target)) return;
      
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

      {dungeonAutoSearchOpen && dungeon && (() => {
        // Dungeon-scoped Auto-Search: scan explored tiles for the picked
        // target, then hand off to the path-walker.
        type Kind = 'stairs' | 'stairs_up' | 'treasure' | 'shop' | 'elevator' | 'plant' | 'mineable_wall' | 'nest';
        const kinds: Array<{ id: Kind; label: string; icon: string }> = [
          { id: 'stairs',        label: 'Stairs down', icon: '⬇️' },
          { id: 'stairs_up',     label: 'Stairs up / exit', icon: '⬆️' },
          { id: 'treasure',      label: 'Treasure chest', icon: '🎁' },
          { id: 'plant',         label: 'Plant (harvestable)', icon: '🌿' },
          { id: 'mineable_wall', label: 'Mineable wall', icon: '⛏️' },
          { id: 'shop',          label: 'Dungeon shop', icon: '🛒' },
          { id: 'elevator',      label: 'Elevator', icon: '🛗' },
          { id: 'nest',          label: 'Monster nest', icon: '🪺' },
        ];
        const findNearest = (kind: Kind): Position | null => {
          const px = dungeon.playerPosition.x, py = dungeon.playerPosition.y;
          let best: { x: number; y: number; d: number } | null = null;
          for (let yy = 0; yy < dungeon.tiles.length; yy++) {
            for (let xx = 0; xx < dungeon.tiles[yy].length; xx++) {
              const t = dungeon.tiles[yy][xx];
              if (!t || !t.explored) continue;
              if (t.type !== kind && !(kind === 'stairs_up' && t.stairsBeneath === 'up')) continue;
              const d = Math.abs(xx - px) + Math.abs(yy - py);
              if (!best || d < best.d) best = { x: xx, y: yy, d };
            }
          }
          return best ? { x: best.x, y: best.y } : null;
        };
        const go = (k: Kind, label: string) => {
          setDungeonAutoSearchOpen(false);
          const pos = findNearest(k);
          if (!pos) {
            addLog(`🔎 Auto-Search: no explored ${label.toLowerCase()} found.`, 'info');
            toast.info(`No known ${label.toLowerCase()}`);
            return;
          }
          addLog(`🧭 Auto-Search: pathing to ${label.toLowerCase()} at (${pos.x}, ${pos.y}).`, 'info');
          handleTileClick(pos.x, pos.y);
        };
        return (
          <div
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4"
            onClick={() => setDungeonAutoSearchOpen(false)}
          >
            <Card className="w-full max-w-sm p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
              <div className="space-y-1">
                <h2 className="text-lg font-bold">Auto-Search</h2>
                <p className="text-xs text-muted-foreground">Pick a target to auto-path to.</p>
              </div>
              <div className="grid gap-1.5">
                {kinds.map((k) => (
                  <Button
                    key={k.id}
                    variant="secondary"
                    className="justify-start"
                    onClick={() => go(k.id, k.label)}
                  >
                    <span className="mr-2">{k.icon}</span>{k.label}
                  </Button>
                ))}
                <Button variant="ghost" onClick={() => setDungeonAutoSearchOpen(false)}>Cancel</Button>
              </div>
            </Card>
          </div>
        );
      })()}



      
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
          onGridCraft={(item, used, consumable) => {
            if (!isCreativeMode()) dispatch({ type: 'USE_MATERIALS', materials: used });
            if (item) dispatch({ type: 'STORE_EQUIPMENT', item });
            else if (consumable) dispatch({ type: 'ADD_ITEM', item: {
              id: `craft_${Date.now()}`, name: consumable.name, type: 'potion', value: 0,
              effect: consumable.effectId, quantity: 1,
            }});
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
          key={defeatedEnemy.id}
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

      {/* Scroll use dialog (Skill Forge scrolls) */}
      <ScrollUseDialog
        open={!!pendingScrollItem}
        scroll={pendingScrollItem}
        party={state.run?.party || []}
        canCast={false}
        onTeach={(comboId, moveId, itemId) => {
          dispatch({ type: 'TEACH_MOVE_FROM_SCROLL', comboId, moveId, itemId });
          addLog(`📜 The scroll's knowledge fuses into your monster!`, 'system');
          toast.success('Move learned!');
        }}
        onCast={() => { /* Cast Only available in battle */ }}
        onClose={() => setPendingScrollItem(null)}
      />
      
      
      <div className="fixed inset-0 overflow-hidden transition-all duration-300" style={dungeonBottomStyle}>
        <div className="h-full flex flex-col">
          {/* Get Unstuck button — teleports player to nearest walkable tile.
              Persists in dungeon view so a stuck player can always recover.
              Draggable + position persists across sessions. */}
          <FloatingActionButton
            storageKey="unstuck-button-position-v1"
            defaultPosition={{ x: 8, y: 8 }}
            onTap={() => {
              if (!dungeon) return;
              const safe = findNearestWalkableTile(
                dungeon.tiles,
                dungeon.playerPosition.x,
                dungeon.playerPosition.y,
                120,
              ) ?? dungeon.entryPosition ?? dungeon.playerPosition;
              const fixed = prepareDungeonForEntry({ ...dungeon, playerPosition: safe });
              dispatch({ type: 'SET_DUNGEON', dungeon: fixed });
              addLog('🆘 Teleported to nearest safe tile.', 'system');
              toast.success('Unstuck!');
            }}
            size={44}
            title="Teleport to nearest walkable tile (drag to reposition)"
            ariaLabel="Get unstuck — teleport to nearest walkable tile"
            zIndex={50}
            className="bg-card/90 text-foreground hover:bg-accent hover:text-accent-foreground text-base"
          >
            🆘
          </FloatingActionButton>
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
                return getMonsterMoves(monster.species, monster.element, monster.class, monster.level, `${monster.species}_${monster.element}_${monster.class}`)
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
                  // Only offer the attack action when at least one move on
                  // the active monster can actually reach this enemy from
                  // the player's current position. Otherwise the option is
                  // misleading — there's nothing it can do.
                  if (directTileAttack) {
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
                  } else {
                    actions.push({
                      id: 'attack',
                      label: 'Attack',
                      hint: 'No usable move reaches this tile from where you stand',
                      icon: Swords,
                      variant: 'secondary',
                      disabled: true,
                      disabledReason: 'Out of range — move closer or pick a move with longer reach',
                      onClick: () => { /* noop */ },
                    });
                  }

                  // Suggest switching to a party member with a strictly better
                  // elemental+class matchup. Skips the active monster and any
                  // fainted party members; only shown when a better option
                  // exists. Note: SWITCH_ACTIVE_MONSTER consumes a turn and
                  // grants the enemy a free attack (see switching mechanics).
                  const swap = findBestMatchupSwap(
                    state.run.party,
                    state.run.activePartyIndex ?? 0,
                    enemy.element,
                    enemy.class,
                  );
                  if (swap) {
                    actions.push({
                      id: 'switch-best-matchup',
                      label: `Switch to ${swap.member.species} (best matchup)`,
                      hint: `Lv ${swap.member.level} ${swap.member.element}/${swap.member.class} · score ${swap.currentScore > 0 ? '+' : ''}${swap.currentScore} → ${swap.score > 0 ? '+' : ''}${swap.score}`,
                      icon: Repeat,
                      variant: 'outline',
                      onClick: () => {
                        close();
                        handlePartySwitch(swap.index);
                      },
                    });
                  }

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
                info.push({ label: 'Action', value: isAdjacent ? 'Collectable now' : 'Walk to it to collect' });
                actions.push({
                  id: 'collect-treasure',
                  label: isAdjacent ? 'Collect chest' : 'Walk to chest & collect',
                  hint: isAdjacent ? undefined : 'Auto-paths and opens on arrival',
                  icon: DoorOpen,
                  variant: 'default',
                  onClick: isAdjacent ? stepToTile : autoPathToTile,
                });
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
                const isPortal = !!tile.portal;
                if (isPortal) {
                  const p = tile.portal!;
                  title = '🌀 Portal staircase';
                  subtitle = p.destKind === 'overworld' ? 'Player-crafted exit' : 'Cross-tower link';
                  info.push({ label: 'Tile', value: 'Craftable portal (odd/even coord rule)' });
                  if (p.destKind === 'overworld' && p.destOverworld) {
                    info.push({ label: 'Destination', value: `Overworld (${p.destOverworld.x}, ${p.destOverworld.y})` });
                  } else if (p.destKind === 'tower' && p.destTowerId) {
                    info.push({ label: 'Destination', value: `Tower · ${p.destTowerId}` });
                  } else {
                    info.push({ label: 'Destination', value: 'Not yet resolved' });
                  }
                  info.push({ label: 'Status', value: p.validated === false ? `Blocked — ${p.invalidReason || 'target unavailable'}` : 'Ready' });
                } else {
                  title = '⬆️ Ascending stairs';
                  subtitle = isEntranceStairs ? 'Entrance staircase' : `Floor ${dungeon.floor} → ${Math.max(1, dungeon.floor - 1)}`;
                  info.push({ label: 'Tile', value: isEntranceStairs ? 'Dungeon entrance / exit' : 'Staircase upward' });
                  info.push({ label: 'Destination', value: isEntranceStairs ? 'Exit / entrance' : `Floor ${Math.max(1, dungeon.floor - 1)}` });
                }
                if (isAdjacent) {
                  actions.push({
                    id: 'use-stairs-up',
                    label: isPortal ? 'Use portal staircase' : (isEntranceStairs ? 'Use entrance stairs' : 'Ascend stairs'),
                    icon: ChevronUp,
                    variant: 'default',
                    disabled: isPortal && tile.portal?.validated === false,
                    disabledReason: 'Portal destination is currently blocked',
                    onClick: stepToTile,
                  });
                }
                if (isPortal) {
                  // "Always one entrance" guard: count remaining stair-out tiles
                  // (any non-portal stairs_up + any portal with overworld dest).
                  let entrances = 0;
                  for (let yy = 0; yy < dungeon.tiles.length; yy++) {
                    for (let xx = 0; xx < dungeon.tiles[yy].length; xx++) {
                      const tt = dungeon.tiles[yy][xx];
                      if (!tt) continue;
                      const isThisTile = xx === x && yy === y;
                      const isStairOut =
                        tt.type === 'stairs_up' ||
                        tt.stairsBeneath === 'up' ||
                        (tt.portal && tt.portal.destKind === 'overworld');
                      if (isStairOut && !isThisTile) entrances++;
                    }
                  }
                  const canRemove = entrances >= 1;
                  actions.push({
                    id: 'remove-portal-stairs',
                    label: 'Remove portal staircase',
                    hint: canRemove ? 'Refunds the Portal Stairs Kit' : 'Blocked — this floor must keep at least one entrance',
                    icon: FlagOff,
                    variant: 'destructive',
                    disabled: !canRemove,
                    disabledReason: 'Removing this would leave the floor with no way out',
                    onClick: () => {
                      close();
                      const nextTiles = dungeon.tiles.map(row => row.map(t => ({ ...t })));
                      nextTiles[y][x] = { ...nextTiles[y][x], type: 'floor', portal: undefined, stairsBeneath: undefined };
                      dispatch({ type: 'UPDATE_DUNGEON', dungeon: { tiles: nextTiles } });
                      dispatch({
                        type: 'ADD_ITEM',
                        item: {
                          id: `portal_stairs_kit_${Date.now()}`,
                          name: 'Portal Stairs Kit',
                          type: 'utility',
                          quantity: 1,
                          value: 0,
                          effect: 'place_portal_stairs',
                          description: 'Places a coordinate-linked portal staircase on your current tile.',
                        } as InventoryItem,
                      });
                      addLog('🌀 Portal staircase dismantled — kit returned to inventory.', 'system');
                    },
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
                actions.push({
                  id: 'mine-wall',
                  label: isAdjacent
                    ? (autoHarvestOn ? 'Auto-Harvest wall' : 'Mine wall')
                    : (autoHarvestOn ? 'Walk & Auto-Harvest wall' : 'Walk to wall & mine'),
                  hint: isAdjacent
                    ? (autoHarvestOn ? 'Keeps mining until broken or an enemy appears' : 'Consumes a turn')
                    : 'Auto-paths, then acts on arrival',
                  icon: Pickaxe,
                  variant: 'default',
                  onClick: () => {
                    close();
                    if (isAdjacent) {
                      if (autoHarvestOn) startDungeonAutoHarvest(x, y);
                      else handleMove(getDirection(dungeon.playerPosition, { x, y }));
                    } else {
                      // The pathwalker honours settings.autoMine, so it will
                      // chip mineable walls it encounters and finish on the
                      // target tile.
                      autoPathToTile();
                    }
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
              } else if (tile.type === 'plant' && tile.plantType) {
                title = `🌿 ${tile.plantType.split('_').map(part => part[0].toUpperCase() + part.slice(1)).join(' ')}`;
                subtitle = tile.harvested ? 'Already harvested' : 'Harvestable plant';
                info.push({ label: 'Status', value: tile.harvested ? 'Harvested' : 'Ready' });
                if (!tile.harvested) {
                  actions.push({
                    id: 'harvest-plant',
                    label: isAdjacent ? 'Harvest plant' : 'Walk to plant & harvest',
                    hint: isAdjacent ? undefined : 'Auto-paths, then steps on to harvest',
                    icon: Trees,
                    variant: 'default',
                    onClick: isAdjacent ? stepToTile : autoPathToTile,
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
                actions.push({
                  id: 'step-on-rune',
                  label: isAdjacent
                    ? (autoHarvestOn && isFinite(hitsNeeded)
                        ? 'Auto-Harvest rune'
                        : isAutoShovelEnabled() && isFinite(hitsNeeded)
                          ? 'Step on & auto-dig'
                          : 'Step onto rune')
                    : (autoHarvestOn && isFinite(hitsNeeded)
                        ? 'Walk & Auto-Harvest rune'
                        : 'Walk to rune'),
                  hint: isAdjacent
                    ? (autoHarvestOn
                        ? 'Keeps digging until the rune is removed or an enemy appears'
                        : isAutoShovelEnabled()
                          ? 'Auto-Shovel is on'
                          : 'Auto-Shovel is off')
                    : 'Auto-paths, then acts on arrival',
                  icon: isAutoShovelEnabled() ? Shovel : Footprints,
                  variant: 'default',
                  onClick: () => {
                    close();
                    if (isAdjacent) {
                      if (autoHarvestOn && isFinite(hitsNeeded)) startDungeonAutoHarvest(x, y);
                      else handleMove(getDirection(dungeon.playerPosition, { x, y }));
                    } else {
                      autoPathToTile();
                    }
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
                    label: isAdjacent ? 'Disarm trap' : 'Walk to trap',
                    hint: isAdjacent ? `${disarmChance}% success chance` : 'Auto-paths next to it so you can disarm',
                    icon: Shovel,
                    variant: 'default',
                    onClick: () => {
                      if (!isAdjacent) {
                        autoPathToTile();
                        return;
                      }
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
                if (isAdjacent) {
                  actions.push({
                    id: 'open-door',
                    label: 'Open door',
                    icon: DoorOpen,
                    variant: 'default',
                    onClick: stepToTile,
                  });
                }
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

              // ── Global auto-action shortcuts (available from every tile menu) ──
              // Mirror the overworld menu so Auto-Hunt / Auto-Search are always
              // one right-click away, even inside dungeons.
              actions.push({
                id: 'auto-hunt',
                label: 'Auto-Hunt nearest enemy',
                icon: Crosshair,
                hint: 'Auto-paths toward the nearest visible enemy on this floor',
                onClick: () => {
                  close();
                  let best: { x: number; y: number; d: number } | null = null;
                  const px = dungeon.playerPosition.x, py = dungeon.playerPosition.y;
                  for (let yy = 0; yy < dungeon.tiles.length; yy++) {
                    for (let xx = 0; xx < dungeon.tiles[yy].length; xx++) {
                      const t = dungeon.tiles[yy][xx];
                      if (!t || t.type !== 'enemy' || !t.visible) continue;
                      const d = Math.abs(xx - px) + Math.abs(yy - py);
                      if (!best || d < best.d) best = { x: xx, y: yy, d };
                    }
                  }
                  if (!best) {
                    addLog('🔎 Auto-Hunt: no visible enemies on this floor.', 'info');
                    toast.info('No visible enemies');
                    return;
                  }
                  addLog(`🏹 Auto-Hunt: pathing to enemy at (${best.x}, ${best.y}).`, 'info');
                  handleTileClick(best.x, best.y);
                },
              });
              actions.push({
                id: 'auto-search',
                label: 'Auto-Search…',
                icon: Search,
                hint: 'Pick a target type (stairs, treasure, plant, shop, wall, nest)',
                onClick: () => { close(); setDungeonAutoSearchOpen(true); },
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

              // ── Self-tile actions (caster buffs + consumables) ──────────
              if (dist === 0 && monster) {
                const consumables = (state.run.inventory || []).filter(
                  (it) => it.type === 'potion' || !!it.effect,
                );
                for (const item of consumables.slice(0, 6)) {
                  actions.push({
                    id: `use-item-${item.id}`,
                    label: `Use ${item.name}`,
                    hint: item.effect ? item.effect.replace(/_/g, ' ') : undefined,
                    icon: FlaskConical,
                    onClick: () => { close(); handleUseItemOutOfCombat(item); },
                  });
                }
                const selfMoves = getMonsterMoves(monster.species, monster.element, monster.class, monster.level, `${monster.species}_${monster.element}_${monster.class}`).filter(
                  (mv) => (mv.targeting === 'self' || (mv.type === 'heal' && mv.power === 0))
                    && (mv.staminaCost || 0) <= (monster.stats.currentStamina ?? monster.stats.stamina ?? 50),
                );
                for (const mv of selfMoves.slice(0, 4)) {
                  actions.push({
                    id: `self-cast-${mv.id}`,
                    label: `Cast ${mv.name}`,
                    hint: mv.description,
                    icon: Wand2,
                    onClick: () => {
                      close();
                      const config = getAttackConfig(mv);
                      const validTargets = getValidTargets(
                        dungeon.playerPosition, config,
                        dungeon.tiles, dungeon.width, dungeon.height, true,
                      );
                      setTargetingMove(mv);
                      setTargetingTiles(validTargets);
                      setAffectedTiles([]);
                      setHoveredTile(null);
                      setTimeout(() => handleTargetingClick(dungeon.playerPosition.x, dungeon.playerPosition.y), 0);
                    },
                  });
                }
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
