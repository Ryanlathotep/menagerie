// Overworld View - Main overworld exploration component with tactical combat
// Uses the same GameSidebar and bottom bar layout as DungeonView

import { useState, useEffect, useCallback, useRef } from 'react';
import { buildProgressSnapshot, useGame } from './state';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Position, Monster, MonsterStats, InventoryItem, DungeonEntrance } from './types';
import { 
  createOverworldState,
  regenerateOverworld,
  movePlayer, 
  updateVisibility,
  ensureChunksLoaded,
  OverworldState, 
  BUILDING_UPGRADES,
  canUpgradeBase,
  upgradeBase,
  getOverworldEnemy,
  getOverworldTile,
  setOverworldTile,
  RoadType,
  ROAD_DEFINITIONS,
  canPlaceRoad,
  placeRoad,
  applyRoadsToChunks,
  removeRoad,
  getRoadRefund,
  findNearestEmptyOverworldTile,
  expandOverworldFromSave,
} from './overworld';
import { TREE_TIER_DATA, STONE_TIER_DATA, TreeTier, StoneTier } from './resourceHierarchy';
import { 
  PlayerBuildingType, BUILDING_DEFINITIONS, canPlaceBuilding, createBuilding, tickFarm,
  processScoutTowerAttacks, PlayerBuilding, getDisassembleRefund, getRepairCost, isWallActingAsGate,
} from './buildings';
import { isCreativeMode, effectiveTools } from './creativeMode';
import { ItemWorldTowerPicker } from './ItemWorldTowerPicker';
import { getItemWorldTowerType } from './itemWorldTowers';
import { detectConnectorDir, nextConnectorDir } from './wallTop';
import { OverworldRenderer, OverworldRendererHandle } from './OverworldRenderer';
import { findOverworldPath } from './overworldPathfinding';
import { playParticleEffectForMove } from './particles/api';
import { OverworldDirectionArrows } from './OverworldDirectionArrows';
import { UnifiedTileMenu, UnifiedTileAction, UnifiedTileInfo, UnifiedTileCreature } from './UnifiedTileMenu';
import { Flag, FlagOff, DoorOpen, Hammer, Footprints, Swords, Shovel, Droplet, Trash2, Settings as SettingsIcon, Pickaxe, TreePine, Wheat, Wrench, Users, Sparkles, Home, FlaskConical, Wand2, Repeat, Search, Crosshair } from 'lucide-react';
import { findBestMatchupSwap } from './MatchupIndicator';
import { useSettings } from './Settings';
import { GameSidebar } from './GameSidebar';
import { CraftingWorkshop } from './CraftingWorkshop';
import { getMonsterMoves, Move, getNewMovesAtLevel } from './moves';
import { getAttackConfig } from './dungeonCombat';
import { rollEnemyMoveDamage } from './enemyAI';
import { xpToNextLevel, calculateXpReward } from './combat';
import {
  getOverworldValidTargets,
  getOverworldAffectedTiles,
  getVisibleOverworldEnemies,
  calculateOverworldEnemyAction,
  moveOverworldEnemy,
  removeOverworldEnemyFromMap,
} from './overworldCombat';
import { RecruitmentModal, calculateRecruitChance } from './RecruitmentModal';
import { LevelUpScreen } from './LevelUpScreen';
import { EquipmentView } from './EquipmentView';
import { ReviveTargetModal } from './ReviveTargetModal';
import { loadKeybinds, getMonsterKeybinds as getMonsterKeybindsImport, isTypingTarget } from './keybinds';
import { LogMessage } from './GameLog';
import { ScrollText } from 'lucide-react';
import { toast } from 'sonner';
import { EvolvedMove } from './moveMastery';
import { CombatEffects } from './statusEffects';
import { BuildingAssignModal } from './BuildingAssignModal';
import { BuildingContextMenu } from './BuildingContextMenu';
import { ArenaHub } from './arena/ArenaHub';
import { StationConfigModal } from './StationConfigModal';
import { CRAFTING_STATION_BUILDINGS } from './buildings';
import { useMyUsername } from '@/hooks/useUsername';

import { EnemyAttackMenu, EnemyAttackTarget } from './EnemyAttackMenu';
import { isAutoShovelEnabled, toggleAutoShovel, onAutoShovelChange } from './autoShovel';
import { FARM_OUTPUTS, FARM_GROWTH_STEPS } from './buildings';
import { 
  NestState, tickNest, spawnNestMonster, findNestSpawnPosition, 
  damageNest, getNestDestroyRewards, countNearbyNestEnemies,
} from './nests';

import { useCloudSave } from '@/hooks/useCloudSave';

interface OverworldViewProps {
  gameLog: LogMessage[];
  addLog: (text: string, type?: LogMessage['type']) => void;
}

interface LevelUpEntry {
  previousStats: MonsterStats;
  previousLevel: number;
  newMoves: Move[];
  monster: Monster;
  isPassive?: boolean;
}

export function OverworldView({ gameLog, addLog }: OverworldViewProps) {
  const { state, dispatch } = useGame();
  const { settings, updateSetting } = useSettings();
  const rendererRef = useRef<OverworldRendererHandle>(null);
  const { saveToCloud, syncing, isAuthenticated } = useCloudSave();
  const { username: myUsername } = useMyUsername();
  
  // Initialize or load overworld state
  const [overworld, setOverworld] = useState<OverworldState>(() => {
    let ow: OverworldState;
    if (state.saveData.overworldState) {
      ow = JSON.parse(JSON.stringify(state.saveData.overworldState));
      // Slimmed saves come back without chunks. Re-hydrate them now so the
      // rest of the file (which always assumes a populated `chunks` map) works.
      ow = expandOverworldFromSave(ow);
    } else {
      ow = createOverworldState();
    }
    // Restore saved dungeon entrances
    if (state.saveData.dungeonEntrances) {
      ow.dungeonEntrances = { ...(ow.dungeonEntrances || {}), ...state.saveData.dungeonEntrances };
    }
    if (!ow.dungeonEntrances) ow.dungeonEntrances = {};
    if (!ow.playerBuildings) ow.playerBuildings = [];
    if (!ow.nests) ow.nests = {};
    if (!ow.roads) ow.roads = {};
    ensureChunksLoaded(ow, ow.playerPosition.x, ow.playerPosition.y);
    // Stamp themed tower tiles onto any already-loaded chunks. Needed for
    // legacy saves whose chunks were generated before towers were placed.
    for (const id in ow.dungeonEntrances) {
      const d = ow.dungeonEntrances[id];
      if (!d || !d.category || d.category === 'procedural') continue;
      const existing = getOverworldTile(ow, d.worldX, d.worldY);
      if (existing && existing.type !== 'dungeon_entrance') {
        setOverworldTile(ow, d.worldX, d.worldY, {
          type: 'dungeon_entrance',
          explored: existing.explored,
          visible: existing.visible,
          dungeonId: id,
        });
      }
    }
    // Re-stamp player buildings onto chunks (in case overrides missed them).
    const validBuildingIds = new Set((ow.playerBuildings || []).map(b => b.id));
    for (const b of ow.playerBuildings || []) {
      const existing = getOverworldTile(ow, b.worldX, b.worldY);
      if (existing && (existing.type !== 'player_building' || existing.playerBuildingId !== b.id)) {
        setOverworldTile(ow, b.worldX, b.worldY, {
          type: 'player_building',
          explored: true,
          visible: existing.visible,
          playerBuildingId: b.id,
        });
      }
    }
    // Sweep loaded chunks for STALE player_building tiles whose ID no longer
    // exists in the playerBuildings list (e.g. building was disassembled but
    // the chunk tile was persisted before the reset, or saves got out of sync).
    // Without this, those tiles would block new placement and show phantom buildings.
    for (const chunkKey in ow.chunks) {
      const chunk = ow.chunks[chunkKey];
      if (!chunk) continue;
      for (let ly = 0; ly < chunk.tiles.length; ly++) {
        const row = chunk.tiles[ly];
        if (!row) continue;
        for (let lx = 0; lx < row.length; lx++) {
          const t = row[lx];
          if (t?.type === 'player_building' && (!t.playerBuildingId || !validBuildingIds.has(t.playerBuildingId))) {
            row[lx] = {
              type: 'grass',
              explored: t.explored,
              visible: t.visible,
              harvested: false,
            };
          }
        }
      }
    }
    applyRoadsToChunks(ow);
    updateVisibility(ow);
    return ow;
  });
  
  const [showBuildingMenu, setShowBuildingMenu] = useState(false);
  const [showDungeonPrompt, setShowDungeonPrompt] = useState(false);
  const [selectedDungeon, setSelectedDungeon] = useState<DungeonEntrance | null>(null);
  const [pendingItemWorldEntrance, setPendingItemWorldEntrance] = useState<DungeonEntrance | null>(null);
  const [showEquipment, setShowEquipment] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  
  // Build mode state
  const [buildMode, setBuildMode] = useState(false);
  const [selectedBuildType, setSelectedBuildType] = useState<PlayerBuildingType | null>(null);
  const [roadBuildMode, setRoadBuildMode] = useState(false);
  const [selectedRoadType, setSelectedRoadType] = useState<RoadType | null>(null);
  const [showBuildPanel, setShowBuildPanel] = useState(false);
  
  // Monster assignment modal state
  const [assignBuilding, setAssignBuilding] = useState<PlayerBuilding | null>(null);
  // Right-click context menu state for player buildings
  const [contextMenuBuilding, setContextMenuBuilding] = useState<PlayerBuilding | null>(null);
  // Station config modal (tier upgrade + modifier slots)
  const [stationConfigBuilding, setStationConfigBuilding] = useState<PlayerBuilding | null>(null);
  // When set, the workshop is opened with this building's station context.
  const [workshopStationBuilding, setWorkshopStationBuilding] = useState<PlayerBuilding | null>(null);
  const [arenaHubOpen, setArenaHubOpen] = useState(false);
  // Unified right-click / long-press menu (one menu for every tile type).
  const [unifiedMenu, setUnifiedMenu] = useState<{ x: number; y: number } | null>(null);
  // Attack picker is opened FROM the unified menu when the tile has an enemy/nest
  // or when "Attack from here" is chosen on a plain tile.
  const [attackMenuTarget, setAttackMenuTarget] = useState<EnemyAttackTarget | null>(null);
  // Session-only Auto-Shovel toggle (mirrored into local state for re-render).
  const [autoShovelOn, setAutoShovelOn] = useState<boolean>(isAutoShovelEnabled());
  useEffect(() => onAutoShovelChange(setAutoShovelOn), []);
  
  // Targeting state
  const [targetingMove, setTargetingMove] = useState<Move | null>(null);
  const [targetingTiles, setTargetingTiles] = useState<Position[]>([]);
  const [affectedTiles, setAffectedTiles] = useState<Position[]>([]);
  const [hoveredTile, setHoveredTile] = useState<Position | null>(null);
  const [autoSearchPickerOpen, setAutoSearchPickerOpen] = useState(false);
  // Set true while any automatic job (walk/mine/hunt/search) is running so
  // movePlayer's "wall blocks your path" style toasts stay quiet — the auto
  // loop will replan or halt itself.
  const automationRunningRef = useRef(false);
  // Mobile AoE: tap to preview, tap again on same tile to fire.
  const aoePendingConfirmRef = useRef<{ x: number; y: number; time: number } | null>(null);
  
  // Level up queue
  const [levelUpQueue, setLevelUpQueue] = useState<LevelUpEntry[]>([]);
  
  // Recruitment
  const [showRecruitment, setShowRecruitment] = useState(false);
  const [defeatedEnemy, setDefeatedEnemy] = useState<Monster | null>(null);
  const [recruitChance, setRecruitChance] = useState(0);
  const [battleStats, setBattleStats] = useState({ turnsUsed: 1, overkillDamage: 0, statusEffectsApplied: 0, criticalHits: 0 });
  // Queue of additional defeated enemies awaiting recruitment (multi-kill AoE)
  type RecruitQueueEntry = {
    enemy: Monster;
    chance: number;
    stats: { turnsUsed: number; overkillDamage: number; statusEffectsApplied: number; criticalHits: number };
  };
  const [recruitQueue, setRecruitQueue] = useState<RecruitQueueEntry[]>([]);
  
  // Revive modal
  const [showReviveModal, setShowReviveModal] = useState(false);
  const [pendingReviveItem, setPendingReviveItem] = useState<InventoryItem | null>(null);

  // Portable Workstation modal — opens crafting workshop on overworld when owned
  const [showWorkshop, setShowWorkshop] = useState(false);
  const [townHallCraftBuildings, setTownHallCraftBuildings] = useState(false);
  
  const monster = state.run?.currentMonster;
  
  // Save overworld state on changes
  const saveOverworld = useCallback((ow: OverworldState) => {
    dispatch({ type: 'UPDATE_OVERWORLD', overworld: { ...ow } });
  }, [dispatch]);

  // ─── Portal-stairs exit override ────────────────────────────────────────
  // DungeonView writes `menagerie_portal_exit_coord` right before it flees
  // via a craftable portal staircase. Consume it on mount to teleport the
  // player to the mapped overworld destination (instead of the default
  // "next to the tower entrance" spawn).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem('menagerie_portal_exit_coord');
    if (!raw) return;
    localStorage.removeItem('menagerie_portal_exit_coord');
    try {
      const dest = JSON.parse(raw) as { x: number; y: number };
      if (typeof dest?.x !== 'number' || typeof dest?.y !== 'number') return;
      setOverworld(prev => {
        ensureChunksLoaded(prev, dest.x, dest.y);
        const next = { ...prev, playerPosition: { x: dest.x, y: dest.y } };
        updateVisibility(next);
        saveOverworld(next);
        return next;
      });
    } catch { /* ignore malformed */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // ─── Settings → Rebuild Overworld ───
  // Listens for the global "rebuild" event fired from the Settings panel.
  // Wipes the current map and regenerates it under the chosen seed, while
  // keeping the player's monsters/items/gold (those live in saveData, not here).
  useEffect(() => {
    const onRebuild = (e: Event) => {
      const detail = (e as CustomEvent<{ seed: number; label?: string; overworld?: OverworldState }>).detail;
      const seed = detail?.seed ?? 0;
      const label = detail?.label ?? String(seed);
      // Prefer the freshly-built overworld passed from Settings to avoid
      // regenerating twice; fall back to building one here.
      const fresh = detail?.overworld ?? regenerateOverworld(seed);

      // ─── Preserve player-placed structures across the rebuild ───
      // Player buildings, roads, and assigned monsters live in the overworld
      // state. We carry them over and re-stamp them onto the freshly generated
      // chunks so terrain regenerates *around* the player's town instead of
      // wiping it out.
      const preservedBuildings = (overworld.playerBuildings || []).map(b => ({ ...b }));
      const preservedRoads = { ...(overworld.roads || {}) };
      fresh.playerBuildings = preservedBuildings;
      fresh.roads = preservedRoads;

      // Make sure every chunk containing a preserved building/road is loaded
      // before we try to stamp tiles into it.
      for (const b of preservedBuildings) {
        ensureChunksLoaded(fresh, b.worldX, b.worldY);
      }
      for (const key of Object.keys(preservedRoads)) {
        const [rx, ry] = key.split(',').map(Number);
        if (Number.isFinite(rx) && Number.isFinite(ry)) {
          ensureChunksLoaded(fresh, rx, ry);
        }
      }

      // Re-stamp each building onto its tile, replacing whatever terrain rolled there.
      for (const b of preservedBuildings) {
        const existing = getOverworldTile(fresh, b.worldX, b.worldY);
        setOverworldTile(fresh, b.worldX, b.worldY, {
          type: 'player_building',
          explored: true,
          visible: existing?.visible ?? false,
          playerBuildingId: b.id,
        });
      }
      // Re-apply roads onto the new chunks.
      applyRoadsToChunks(fresh);
      updateVisibility(fresh);

      setOverworld(fresh);
      saveOverworld(fresh);
      addLog(`🌍 Overworld rebuilt with seed ${label} — kept ${preservedBuildings.length} structure(s) and ${Object.keys(preservedRoads).length} road tile(s).`, 'system');
      toast.success(`World rebuilt — seed ${label}`);
    };
    window.addEventListener('menagerie-rebuild-overworld', onRebuild);
    return () => window.removeEventListener('menagerie-rebuild-overworld', onRebuild);
  }, [saveOverworld, addLog, overworld]);

  // ─── Manual save: flush in-memory overworld into saveData, then push to cloud
  // (or just confirm the local snapshot if not signed in). Useful for the player
  // to lock in built structures, harvested tiles, monster assignments, etc. on
  // demand instead of waiting for the 5s/30s autosave.
  const handleManualSave = useCallback(async () => {
    const snapshot = buildProgressSnapshot(state.saveData, state.run, overworld);
    dispatch({ type: 'SNAPSHOT_RUN_PROGRESS', overworld });

    if (!isAuthenticated) {
      // Local-only save still happens via the saveData→localStorage effect.
      toast.success('💾 Saved locally (sign in to back up to the cloud)');
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
  }, [dispatch, overworld, state.saveData, isAuthenticated, saveToCloud, addLog]);

  // ─── Enemy AI processing ───
  const processEnemyTurns = useCallback((ow: OverworldState) => {
    if (!state.run) return;
    
    const enemies = getVisibleOverworldEnemies(ow);
    let playerDamage = 0;

    for (const { enemy, pos } of enemies) {
      const action = calculateOverworldEnemyAction(
        enemy, pos, ow.playerPosition, ow, state.run.currentMonster,
      );
      const REGEN = 5;
      const FALLBACK_COST = 8;

      if (action.type === 'attack') {
        const move = action.move;
        const sMax = enemy.stats.stamina ?? 50;
        const sCur = enemy.stats.currentStamina ?? sMax;
        const cost = move?.staminaCost ?? FALLBACK_COST;
        if (sCur < cost) {
          for (const chunk of Object.values(ow.chunks)) {
            const e = chunk.enemies.find(e => e.id === enemy.id);
            if (e) { e.stats.currentStamina = Math.min(sMax, sCur + REGEN); break; }
          }
          addLog(`💤 ${enemy.name} is exhausted and catches its breath.`, 'system');
          continue;
        }
        for (const chunk of Object.values(ow.chunks)) {
          const e = chunk.enemies.find(e => e.id === enemy.id);
          if (e) { e.stats.currentStamina = Math.max(0, sCur - cost); break; }
        }

        const playerMon = state.run.currentMonster;
        const playerDef = playerMon.stats.defense;
        if (move) {
          const roll = rollEnemyMoveDamage(enemy, move, playerDef, playerMon.element);
          // Visual FX from enemy → player.
          try {
            playParticleEffectForMove({
              surface: 'overworld',
              monster: enemy,
              move,
              from: pos,
              to: ow.playerPosition,
              affected: [ow.playerPosition],
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
          const damage = Math.max(1, Math.floor(enemy.stats.attack - playerDef * 0.3));
          playerDamage += damage;
          addLog(`👹 ${enemy.name} attacks for ${damage} damage!`, 'damage');
        }
      } else if (action.type === 'move') {
        // Small regen on move
        const sMax = enemy.stats.stamina ?? 50;
        const sCur = enemy.stats.currentStamina ?? sMax;
        for (const chunk of Object.values(ow.chunks)) {
          const e = chunk.enemies.find(e => e.id === enemy.id);
          if (e) { e.stats.currentStamina = Math.min(sMax, sCur + Math.floor(REGEN / 2)); break; }
        }
        moveOverworldEnemy(ow, enemy.id, pos, action.dx, action.dy);
      }
    }
    
    if (playerDamage > 0 && state.run) {
      const m = state.run.currentMonster;
      const newHp = Math.max(0, m.stats.currentHp - playerDamage);
      dispatch({
        type: 'UPDATE_PLAYER_MONSTER',
        monster: { ...m, stats: { ...m.stats, currentHp: newHp } },
      });
      
      if (newHp <= 0) {
        // Active monster fell on the overworld. Try to switch to the next
        // conscious party member before ending the run. If none alive,
        // offer a revive prompt when the player is carrying one (bug a712c559).
        const party = state.run.party;
        const activeIndex = state.run.activePartyIndex;
        const nextAliveIndex = party.findIndex((mem, i) => i !== activeIndex && mem.stats.currentHp > 0);
        if (nextAliveIndex >= 0) {
          dispatch({ type: 'SWITCH_ACTIVE_MONSTER', index: nextAliveIndex });
          const next = party[nextAliveIndex];
          addLog(`💀 ${m.name} fell! ${next.name} steps up!`, 'damage');
          toast.success(`Go, ${next.species}!`);
          return;
        }
        const reviveItem = (state.run.inventory ?? []).find(
          (it) => it.effect === 'revive' || it.effect === 'revive_full'
        );
        if (reviveItem) {
          addLog(`💀 ${m.name} fell! Use a ${reviveItem.name} to keep going.`, 'damage');
          toast.warning(`${m.name} fainted — pick a member to revive.`);
          setPendingReviveItem(reviveItem);
          setShowReviveModal(true);
          return;
        }
        dispatch({ type: 'END_RUN', victory: false });
        dispatch({ type: 'SET_PHASE', phase: 'run_summary' });
      }
    }
  }, [state.run, dispatch, addLog]);
  
  // ─── Movement ───
  // NOTE: Movement is allowed while targeting a skill — valid target / AoE
  // tiles are recomputed from the new player position by the effect below.
  const handleMove = useCallback((dx: number, dy: number) => {
    setOverworld(prev => {
      const newState = JSON.parse(JSON.stringify(prev)) as OverworldState;
      ensureChunksLoaded(newState, newState.playerPosition.x + dx, newState.playerPosition.y + dy);
      const result = movePlayer(newState, dx, dy);
      
      switch (result.type) {
        case 'moved':
          // HP/Stamina regen on step for active + party
          if (state.run) {
            const m = state.run.currentMonster;
            const regenHp = Math.min(1, m.stats.maxHp - m.stats.currentHp);
            const maxSta = m.stats.stamina ?? 50;
            const curSta = m.stats.currentStamina ?? maxSta;
            const regenSta = Math.min(1, maxSta - curSta);
            if (regenHp > 0 || regenSta > 0) {
              dispatch({
                type: 'UPDATE_PLAYER_MONSTER',
                monster: { ...m, stats: { ...m.stats, currentHp: m.stats.currentHp + regenHp, currentStamina: curSta + regenSta } },
              });
            }
            // Regen inactive party members
            if (state.run.party && state.run.party.length > 0) {
              state.run.party.forEach((member, index) => {
                if (index === state.run!.activePartyIndex) return;
                if (member.stats.currentHp <= 0) return;
                const memberMaxSta = member.stats.stamina ?? 50;
                const memberCurSta = member.stats.currentStamina ?? memberMaxSta;
                const memberRegenHp = Math.min(1, member.stats.maxHp - member.stats.currentHp);
                const memberRegenSta = Math.min(1, memberMaxSta - memberCurSta);
                if (memberRegenHp > 0 || memberRegenSta > 0) {
                  dispatch({
                    type: 'UPDATE_PARTY_MONSTER',
                    index,
                    monster: { ...member, stats: { ...member.stats, currentHp: member.stats.currentHp + memberRegenHp, currentStamina: memberCurSta + memberRegenSta } },
                  });
                }
              });
            }
          }
          // Bonus move from stone roads: automatically take another step in the same direction
          if (result.bonusMove) {
            addLog('🏃 Stone road speed boost!', 'info');
            const bonusResult = movePlayer(newState, dx, dy);
            if (bonusResult.type === 'moved') {
              // Extra regen from bonus step
            }
          }
          // Apply roads overlay after chunk loads
          applyRoadsToChunks(newState);
          break;
        case 'blocked':
          if (!automationRunningRef.current) toast.info(result.reason);
          return prev;
        case 'resource': {
          const tierLabel = result.tierName ? ` (${result.tierName})` : '';
          if (result.amount > 0) {
            addLog(`🪓 Gathered ${result.amount} ${result.resourceType}${tierLabel}!`, 'loot');
            toast.success(`+${result.amount} ${result.resourceType === 'wood' ? '🪵' : '🪨'} ${result.resourceType}${tierLabel}`);
          }
          if (result.materialDrop) {
            const { materialId, name, quantity } = result.materialDrop;
            queueMicrotask(() => dispatch({ type: 'ADD_MATERIAL', materialId, quantity }));
            addLog(`💎 Extracted ${quantity}× ${name}!`, 'loot');
            toast.success(`+${quantity}× 💎 ${name}`);
          }
          if (result.seedDrop) {
            const { materialId, name, quantity } = result.seedDrop;
            queueMicrotask(() => dispatch({ type: 'ADD_MATERIAL', materialId, quantity }));
            addLog(`🌱 Picked up ${quantity}× ${name}!`, 'loot');
            toast.success(`+${quantity}× 🌱 ${name}`);
          }
          if (result.leftTilled) {
            addLog(`🟫 The felled tree left plantable soil behind.`, 'system');
          }
          break;
        }
        case 'plant_harvest': {
          const variantIcon = result.variant === 'mushroom' ? '🍄' : result.variant === 'flower' ? '🌸' : result.variant === 'root' ? '🥕' : '🌿';
          const tierLabel = result.tier === 3 ? 'Rare' : result.tier === 2 ? 'Uncommon' : 'Common';
          for (const drop of result.drops) {
            queueMicrotask(() => dispatch({ type: 'ADD_MATERIAL', materialId: drop.materialId, quantity: drop.quantity }));
            addLog(`${variantIcon} Gathered ${drop.quantity}× ${drop.name}!`, 'loot');
          }
          toast.success(`${variantIcon} ${tierLabel} ${result.variant} harvested`);
          break;
        }
        case 'enemy':
          toast.warning(`An enemy ${result.enemy.name} blocks the way! Select a move to attack.`);
          return prev;
        case 'building':
          setShowBuildingMenu(true);
          break;
        case 'dungeon_entrance':
          if (result.dungeonId) {
            const entrance = newState.dungeonEntrances[result.dungeonId];
            setSelectedDungeon(entrance || null);
          }
          setShowDungeonPrompt(true);
          break;
        case 'player_building':
          if (result.building.type === 'farm' && result.building.harvestReady) {
            // Harvest the farm
            const output = result.building.harvestOutput || [];
            for (const item of output) {
              dispatch({ type: 'ADD_MATERIAL', materialId: item.materialId, quantity: item.quantity });
              addLog(`🌾 Harvested ${item.quantity}x ${item.materialId}!`, 'loot');
            }
            result.building.harvestReady = false;
            result.building.harvestOutput = [];
            result.building.growthProgress = FARM_GROWTH_STEPS;
            toast.success('Farm harvested!');
          }
          // Show assign modal for towers and farms
          if (result.building.type === 'scout_tower' || result.building.type === 'farm') {
            setAssignBuilding(result.building);
          }
          break;
        case 'nest':
          toast.warning(`A monster nest blocks the way! Attack it to destroy it.`);
          addLog(`🪺 Monster nest (${result.nest.element}) - HP: ${result.nest.hp}/${result.nest.maxHp}`, 'system');
          return prev;
      }
      
      if (result.type === 'moved' || result.type === 'resource' || result.type === 'player_building') {
        // Tick farms on each step
        for (const building of (newState.playerBuildings || [])) {
          if (building.type === 'farm' && building.assignedMonsterId) {
            const harvest = tickFarm(building);
            if (harvest) {
              addLog(`🌾 Farm at (${building.worldX},${building.worldY}) is ready to harvest!`, 'loot');
            }
          }
        }
        // Tick nests - spawn enemies
        for (const nest of Object.values(newState.nests || {})) {
          if (nest.destroyed) continue;
          const nearby = countNearbyNestEnemies(nest.worldX, nest.worldY, nest.id, (x, y) => getOverworldTile(newState, x, y));
          if (nearby >= 4) continue; // Cap nearby enemies
          const { shouldSpawn } = tickNest(nest);
          if (shouldSpawn) {
            const spawnPos = findNestSpawnPosition(nest.worldX, nest.worldY, (x, y) => getOverworldTile(newState, x, y));
            if (spawnPos) {
              const spawned = spawnNestMonster(nest);
              // Add to chunk
              const cx = Math.floor(spawnPos.x / 16);
              const cy = Math.floor(spawnPos.y / 16);
              const chunkKey = `${cx},${cy}`;
              // CRITICAL: only place the enemy tile if its parent chunk exists
              // and the enemy actually got pushed. Otherwise we orphan the tile
              // — the renderer sees an `enemy` tile whose enemyId resolves to
              // null and draws a blank sprite, and any tap on it is consumed
              // by the attack handler instead of falling through to movement,
              // which is exactly the "invisible enemy + movement locked" bug.
              if (newState.chunks[chunkKey]) {
                newState.chunks[chunkKey].enemies.push(spawned);
                setOverworldTile(newState, spawnPos.x, spawnPos.y, {
                  type: 'enemy', explored: true, visible: false, enemyId: spawned.id,
                });
                if (getOverworldTile(newState, spawnPos.x, spawnPos.y)?.visible) {
                  addLog(`🪺 A ${spawned.name} emerges from a nearby nest!`, 'damage');
                }
              }
            }
          }

        }
        setTimeout(() => processEnemyTurns(newState), 100);
      }
      
      saveOverworld(newState);
      return newState;
    });
  }, [addLog, saveOverworld, state.run, dispatch, processEnemyTurns]);

  // ─── Auto-walk along a tap-to-move path ───
  // Stores the remaining path as a ref so the interval ticker always sees the
  // latest queue without re-creating the timer. We also stash handleMove +
  // overworld in refs to dodge stale closures.
  const autoWalkPathRef = useRef<Position[] | null>(null);
  const autoWalkTimerRef = useRef<number | null>(null);
  const handleMoveRef = useRef(handleMove);
  const overworldRef = useRef(overworld);
  useEffect(() => { handleMoveRef.current = handleMove; }, [handleMove]);
  useEffect(() => { overworldRef.current = overworld; }, [overworld]);

  const cancelAutoWalk = useCallback(() => {
    if (autoWalkTimerRef.current !== null) {
      window.clearInterval(autoWalkTimerRef.current);
      autoWalkTimerRef.current = null;
    }
    autoWalkPathRef.current = null;
    automationRunningRef.current = false;
  }, []);

  const startAutoWalk = useCallback((path: Position[], onArrive?: () => void) => {
    cancelAutoWalk();
    autoWalkPathRef.current = [...path];
    automationRunningRef.current = true;
    const stepDelay = Math.max(80, settings.autoRunSpeed || 100);
    // The player must NEVER be fully locked out of moving: nearby enemies only
    // cancel *multi-step* auto-walking. The first step of any deliberate move
    // command always executes, then we halt the rest of the queue with a
    // warning if danger is close.
    let tookFirstStep = false;
    autoWalkTimerRef.current = window.setInterval(() => {
      const queue = autoWalkPathRef.current;
      const ow = overworldRef.current;
      if (!queue || queue.length === 0 || !ow) {
        cancelAutoWalk();
        return;
      }
      // Only treat enemies as danger when a visible enemy is within 2 tiles of
      // the player OR sits next to the queued step. Previously we halted
      // whenever ANY enemy was visible on screen, which locked the player out
      // of moving away from distant enemies on mobile.
      const next = queue[0];
      const enemies = getVisibleOverworldEnemies(ow, 8);
      const dangerNearby = enemies.some(({ pos }) => {
        const dPlayer = Math.abs(pos.x - ow.playerPosition.x) + Math.abs(pos.y - ow.playerPosition.y);
        const dNext = Math.abs(pos.x - next.x) + Math.abs(pos.y - next.y);
        return dPlayer <= 2 || dNext <= 1;
      });
      if (dangerNearby && tookFirstStep) {
        // Already moved at least once this command — stop further auto-steps.
        cancelAutoWalk();
        addLog('⚠️ Auto-walk stopped — enemy too close! Tap again to keep moving.', 'info');
        return;
      }
      queue.shift();
      const dx = next.x - ow.playerPosition.x;
      const dy = next.y - ow.playerPosition.y;
      // If pathfinder result is no longer a single step from us, abort.
      if (Math.abs(dx) + Math.abs(dy) !== 1) {
        cancelAutoWalk();
        return;
      }
      handleMoveRef.current(dx, dy);
      tookFirstStep = true;
      if (dangerNearby) {
        // Took the guaranteed single step into danger range — warn and stop
        // the remaining queued steps so the player isn't auto-walked into a fight.
        cancelAutoWalk();
        if (queue.length > 0) addLog('⚠️ Auto-walk stopped — enemy too close! Tap again to keep moving.', 'info');
        return;
      }
      if (queue.length === 0) {
        cancelAutoWalk();
        // Fire the arrival hook AFTER the state has settled — auto-harvest
        // reads player position from the ref and needs the last move committed.
        if (onArrive) window.setTimeout(onArrive, stepDelay);
      }
    }, stepDelay);
  }, [cancelAutoWalk, settings.autoRunSpeed, addLog]);

  // Cancel auto-walk on unmount.
  useEffect(() => () => cancelAutoWalk(), [cancelAutoWalk]);

  // ─── Auto-Harvest loop ──────────────────────────────────────────────────
  // Full cluster-harvest job: given a seed tile, keep chopping every same-type
  // tile within a search radius. Each tick either steps into an adjacent
  // target (harvesting) or takes one A* step toward the nearest remaining
  // target. Halts on enemy sighting or when the cluster is exhausted.
  //
  // "Adjacent" is Manhattan distance 1. The seed lets us bound the cluster so
  // an auto-harvest job doesn't crawl across the entire loaded overworld —
  // 12-tile radius covers big forests / quarries without runaway walking.
  const HARVEST_SEARCH_RADIUS = 12;
  type AutoMineJob = {
    seed: Position;
    tileType: string;
    // Cache the last target we picked so we don't thrash between two
    // equidistant tiles on every tick.
    lastTarget?: Position;
  };
  const autoMineTargetRef = useRef<AutoMineJob | null>(null);
  const autoMineTimerRef = useRef<number | null>(null);
  const cancelAutoMine = useCallback((reason?: string) => {
    if (autoMineTimerRef.current !== null) {
      window.clearInterval(autoMineTimerRef.current);
      autoMineTimerRef.current = null;
    }
    if (autoMineTargetRef.current && reason) addLog(reason, 'info');
    autoMineTargetRef.current = null;
    automationRunningRef.current = false;
  }, [addLog]);

  // Scan a diamond of radius R around `origin` for tiles matching tileType.
  // Returns them sorted by Manhattan distance from `from` (nearest first).
  const findClusterTargets = useCallback((
    ow: OverworldState,
    origin: Position,
    from: Position,
    tileType: string,
    radius: number,
  ): Position[] => {
    const hits: Array<Position & { d: number }> = [];
    for (let dy = -radius; dy <= radius; dy++) {
      const rem = radius - Math.abs(dy);
      for (let dx = -rem; dx <= rem; dx++) {
        const x = origin.x + dx, y = origin.y + dy;
        const t = getOverworldTile(ow, x, y);
        if (!t || t.type !== tileType) continue;
        hits.push({ x, y, d: Math.abs(x - from.x) + Math.abs(y - from.y) });
      }
    }
    hits.sort((a, b) => a.d - b.d);
    return hits.map(({ x, y }) => ({ x, y }));
  }, []);

  const startAutoMine = useCallback((targetX: number, targetY: number) => {
    cancelAutoWalk();
    cancelAutoMine();
    const ow0 = overworldRef.current;
    const startTile = ow0 ? getOverworldTile(ow0, targetX, targetY) : null;
    if (!startTile) return;
    if (startTile.type !== 'rock' && startTile.type !== 'tree' && startTile.type !== 'plant') return;
    autoMineTargetRef.current = {
      seed: { x: targetX, y: targetY },
      tileType: startTile.type,
    };
    automationRunningRef.current = true;
    const stepDelay = Math.max(120, settings.autoRunSpeed || 100);
    addLog(`⛏️ Auto-Harvest started — clearing nearby ${startTile.type}s.`, 'info');
    autoMineTimerRef.current = window.setInterval(() => {
      const job = autoMineTargetRef.current;
      const ow = overworldRef.current;
      if (!job || !ow) { cancelAutoMine(); return; }
      // Halt on any visible enemy within 6 tiles — same rule as auto-walk.
      const enemiesNearby = getVisibleOverworldEnemies(ow, 6);
      if (enemiesNearby.length > 0) {
        cancelAutoMine('⚠️ Auto-Harvest stopped — enemy spotted!');
        return;
      }
      // Find the nearest remaining same-type tile in the cluster.
      const targets = findClusterTargets(
        ow, job.seed, ow.playerPosition, job.tileType, HARVEST_SEARCH_RADIUS,
      );
      if (targets.length === 0) {
        cancelAutoMine('✅ Auto-Harvest finished — cluster exhausted.');
        return;
      }
      // Try targets in nearest-first order. If the nearest is unreachable
      // (walled off), fall through to the next one instead of giving up —
      // this is why so many "wall blocks your path" pop-ups appeared when
      // resources sat behind player-built walls.
      const offsets: Array<[number, number]> = [[0, -1], [0, 1], [-1, 0], [1, 0]];
      let chosenTarget: Position | null = null;
      let bestPath: Position[] | null = null;
      let adjacentStep: { dx: number; dy: number } | null = null;
      for (const candidate of targets) {
        const d = Math.abs(candidate.x - ow.playerPosition.x) + Math.abs(candidate.y - ow.playerPosition.y);
        if (d === 1) {
          chosenTarget = candidate;
          adjacentStep = {
            dx: candidate.x - ow.playerPosition.x,
            dy: candidate.y - ow.playerPosition.y,
          };
          break;
        }
        // Not adjacent — find a walkable neighbor reachable via A*.
        // `avoidStructures` blocks walls / npc buildings / dungeon entrances,
        // and we also skip neighbor offsets that ARE such tiles so we never
        // aim for them.
        let pathToNeighbor: Position[] | null = null;
        for (const [ox, oy] of offsets) {
          const ax = candidate.x + ox, ay = candidate.y + oy;
          const at = getOverworldTile(ow, ax, ay);
          if (at && (at.type === 'dungeon_entrance' || at.type === 'building')) continue;
          if (at && at.type === 'player_building') {
            const b = ow.playerBuildings?.find(pb => pb.id === at.playerBuildingId);
            const isWallSlot = b?.type === 'wall'; // gate/wall-top handled inside path
            if (!isWallSlot) continue;
          }
          if (ax === ow.playerPosition.x && ay === ow.playerPosition.y) {
            pathToNeighbor = []; break;
          }
          const p = findOverworldPath(ow, ow.playerPosition, { x: ax, y: ay }, 8000, { avoidStructures: true });
          if (p && p.length > 0 && (!pathToNeighbor || p.length < pathToNeighbor.length)) {
            pathToNeighbor = p;
          }
        }
        if (pathToNeighbor && pathToNeighbor.length > 0) {
          chosenTarget = candidate;
          bestPath = pathToNeighbor;
          break;
        }
      }
      if (!chosenTarget) {
        cancelAutoMine(`⚠️ Auto-Harvest stopped — no reachable ${job.tileType} nearby.`);
        return;
      }
      job.lastTarget = chosenTarget;
      if (adjacentStep) {
        handleMoveRef.current(adjacentStep.dx, adjacentStep.dy);
        return;
      }
      if (!bestPath || bestPath.length === 0) {
        cancelAutoMine(`⚠️ Auto-Harvest stopped — no path to ${job.tileType}.`);
        return;
      }
      const nextStep = bestPath[0];
      const dx = nextStep.x - ow.playerPosition.x;
      const dy = nextStep.y - ow.playerPosition.y;
      if (Math.abs(dx) + Math.abs(dy) !== 1) {
        cancelAutoMine('⚠️ Auto-Harvest stopped — pathing desynced.');
        return;
      }
      handleMoveRef.current(dx, dy);
    }, stepDelay);
  }, [cancelAutoMine, cancelAutoWalk, settings.autoRunSpeed, addLog, findClusterTargets]);


  useEffect(() => () => cancelAutoMine(), [cancelAutoMine]);

  // ─── Auto-Hunt & Auto-Search ────────────────────────────────────────────
  // Auto-Hunt: seeks the nearest visible enemy and walks adjacent, then opens
  // attack targeting with the monster's first melee/ranged move so the player
  // just confirms the strike. Halts if no enemy is visible or space is pressed.
  //
  // Auto-Search: scans explored tiles for a target type (dungeon entrance,
  // enemy, nest, tree/rock cluster) and walks to the nearest one, avoiding
  // structures mid-path. Halts on enemy sighting (unless enemies are the target).
  const autoHuntTimerRef = useRef<number | null>(null);
  const autoSearchTimerRef = useRef<number | null>(null);
  const autoSearchKindRef = useRef<string | null>(null);

  const cancelAutoHunt = useCallback((reason?: string) => {
    if (autoHuntTimerRef.current !== null) {
      window.clearInterval(autoHuntTimerRef.current);
      autoHuntTimerRef.current = null;
      if (reason) addLog(reason, 'info');
    }
    automationRunningRef.current = false;
  }, [addLog]);

  const cancelAutoSearch = useCallback((reason?: string) => {
    if (autoSearchTimerRef.current !== null) {
      window.clearInterval(autoSearchTimerRef.current);
      autoSearchTimerRef.current = null;
      autoSearchKindRef.current = null;
      if (reason) addLog(reason, 'info');
    }
    automationRunningRef.current = false;
  }, [addLog]);

  // Pick the "attack" move to auto-fire on hunt arrival: first melee, else
  // first ranged. Falls back to null (player picks manually).
  const pickHuntAttackMove = useCallback((): Move | null => {
    if (!monster) return null;
    const moves = getMonsterMoves(monster.species, monster.element, monster.class, monster.level);
    return (moves.find(m => m.type === 'melee') || moves.find(m => m.type === 'ranged') || null) as Move | null;
  }, [monster]);

  const startAutoHunt = useCallback(() => {
    cancelAutoWalk();
    cancelAutoMine();
    cancelAutoSearch();
    cancelAutoHunt();
    const stepDelay = Math.max(120, settings.autoRunSpeed || 100);
    addLog('🏹 Auto-Hunt started — seeking nearest enemy.', 'info');
    automationRunningRef.current = true;
    autoHuntTimerRef.current = window.setInterval(() => {
      const ow = overworldRef.current;
      if (!ow) { cancelAutoHunt(); return; }
      const enemies = getVisibleOverworldEnemies(ow, 30);
      if (enemies.length === 0) {
        cancelAutoHunt('🔎 Auto-Hunt stopped — no visible enemies.');
        return;
      }
      // Nearest enemy by Manhattan distance.
      const px = ow.playerPosition.x, py = ow.playerPosition.y;
      enemies.sort((a, b) =>
        (Math.abs(a.pos.x - px) + Math.abs(a.pos.y - py)) -
        (Math.abs(b.pos.x - px) + Math.abs(b.pos.y - py)),
      );
      const target = enemies[0].pos;
      const dist = Math.abs(target.x - px) + Math.abs(target.y - py);
      // Adjacent — stop and open targeting for the best attack move.
      if (dist <= 1) {
        cancelAutoHunt();
        const move = pickHuntAttackMove();
        if (!move) {
          addLog('🏹 In range! Pick a move to attack.', 'info');
          return;
        }
        const config = getAttackConfig(move);
        const validTargets = getOverworldValidTargets(ow.playerPosition, config, ow);
        if (validTargets.some(t => t.x === target.x && t.y === target.y)) {
          setTargetingMove(move);
          setTargetingTiles(validTargets);
          setTimeout(() => handleTargetingClick(target.x, target.y), 0);
        } else {
          addLog(`🏹 In range! Pick a move to attack.`, 'info');
        }
        return;
      }
      // Walk toward an adjacent tile of the enemy (avoid structures).
      const offsets: Array<[number, number]> = [[0, -1], [0, 1], [-1, 0], [1, 0]];
      let bestPath: Position[] | null = null;
      for (const [ox, oy] of offsets) {
        const ax = target.x + ox, ay = target.y + oy;
        if (ax === px && ay === py) { bestPath = []; break; }
        const p = findOverworldPath(ow, ow.playerPosition, { x: ax, y: ay }, 8000, { avoidStructures: true });
        if (p && p.length > 0 && (!bestPath || p.length < bestPath.length)) bestPath = p;
      }
      if (!bestPath || bestPath.length === 0) {
        cancelAutoHunt('⚠️ Auto-Hunt stopped — no path to enemy.');
        return;
      }
      const step = bestPath[0];
      const dx = step.x - px, dy = step.y - py;
      if (Math.abs(dx) + Math.abs(dy) !== 1) { cancelAutoHunt(); return; }
      handleMoveRef.current(dx, dy);
    }, stepDelay);
  }, [addLog, cancelAutoHunt, cancelAutoMine, cancelAutoSearch, cancelAutoWalk, pickHuntAttackMove, settings.autoRunSpeed]);

  type SearchKind = 'dungeon_entrance' | 'enemy' | 'nest' | 'tree' | 'rock' | 'plant' | 'building';
  const SEARCH_RADIUS = 40;

  const findNearestExplored = useCallback((ow: OverworldState, kind: SearchKind): Position | null => {
    const px = ow.playerPosition.x, py = ow.playerPosition.y;
    let best: (Position & { d: number }) | null = null;
    for (let dy = -SEARCH_RADIUS; dy <= SEARCH_RADIUS; dy++) {
      const rem = SEARCH_RADIUS - Math.abs(dy);
      for (let dx = -rem; dx <= rem; dx++) {
        const x = px + dx, y = py + dy;
        const t = getOverworldTile(ow, x, y);
        if (!t || !t.explored) continue;
        if (t.type !== kind) continue;
        const d = Math.abs(dx) + Math.abs(dy);
        if (!best || d < best.d) best = { x, y, d };
      }
    }
    return best ? { x: best.x, y: best.y } : null;
  }, []);

  const startAutoSearch = useCallback((kind: SearchKind) => {
    cancelAutoWalk();
    cancelAutoMine();
    cancelAutoHunt();
    cancelAutoSearch();
    autoSearchKindRef.current = kind;
    const stepDelay = Math.max(120, settings.autoRunSpeed || 100);
    addLog(`🧭 Auto-Search started — looking for nearest ${kind.replace('_', ' ')}.`, 'info');
    automationRunningRef.current = true;
    autoSearchTimerRef.current = window.setInterval(() => {
      const ow = overworldRef.current;
      if (!ow) { cancelAutoSearch(); return; }
      // Halt on visible enemy unless enemies are the target.
      if (kind !== 'enemy') {
        const enemies = getVisibleOverworldEnemies(ow, 6);
        if (enemies.length > 0) {
          cancelAutoSearch('⚠️ Auto-Search stopped — enemy spotted!');
          return;
        }
      }
      const target = findNearestExplored(ow, kind);
      if (!target) {
        cancelAutoSearch(`🔎 Auto-Search stopped — no known ${kind.replace('_', ' ')} within ${SEARCH_RADIUS} tiles.`);
        return;
      }
      const px = ow.playerPosition.x, py = ow.playerPosition.y;
      const dist = Math.abs(target.x - px) + Math.abs(target.y - py);
      if (dist <= 1) {
        cancelAutoSearch(`✅ Auto-Search arrived at ${kind.replace('_', ' ')}.`);
        return;
      }
      // Path to adjacent tile of target (goal itself may be a structure).
      const offsets: Array<[number, number]> = [[0, -1], [0, 1], [-1, 0], [1, 0]];
      let bestPath: Position[] | null = null;
      for (const [ox, oy] of offsets) {
        const ax = target.x + ox, ay = target.y + oy;
        if (ax === px && ay === py) { bestPath = []; break; }
        const p = findOverworldPath(ow, ow.playerPosition, { x: ax, y: ay }, 8000, { avoidStructures: true });
        if (p && p.length > 0 && (!bestPath || p.length < bestPath.length)) bestPath = p;
      }
      if (!bestPath || bestPath.length === 0) {
        cancelAutoSearch(`⚠️ Auto-Search stopped — no path to ${kind.replace('_', ' ')}.`);
        return;
      }
      const step = bestPath[0];
      const dx = step.x - px, dy = step.y - py;
      if (Math.abs(dx) + Math.abs(dy) !== 1) { cancelAutoSearch(); return; }
      handleMoveRef.current(dx, dy);
    }, stepDelay);
  }, [addLog, cancelAutoHunt, cancelAutoMine, cancelAutoSearch, cancelAutoWalk, findNearestExplored, settings.autoRunSpeed]);

  useEffect(() => () => { cancelAutoHunt(); cancelAutoSearch(); }, [cancelAutoHunt, cancelAutoSearch]);





  // ─── Attack targeting ───
  const handleUseMoveOnMap = useCallback((move: Move | EvolvedMove) => {
    if (!state.run || !monster) return;
    
    const maxSta = monster.stats.stamina ?? 50;
    const curSta = monster.stats.currentStamina ?? maxSta;
    if (curSta < (move.staminaCost || 0)) {
      toast.error('Not enough stamina!');
      return;
    }
    
    // Self-targeting moves (heals, buffs)
    if (move.type === 'heal' || (move.type === 'status' && !move.effect?.includes('lower_'))) {
      if (move.type === 'heal' && move.power > 0) {
        const hpBefore = monster.stats.currentHp;
        if (hpBefore >= monster.stats.maxHp) {
          addLog('❤️ Already at full HP!', 'info');
          return;
        }
        const newHp = Math.min(monster.stats.maxHp, hpBefore + move.power);
        dispatch({
          type: 'UPDATE_PLAYER_MONSTER',
          monster: { ...monster, stats: { ...monster.stats, currentHp: newHp, currentStamina: curSta - (move.staminaCost || 0) } },
        });
        addLog(`✨ ${move.name} restored ${newHp - hpBefore} HP!`, 'heal');
      } else if (move.effect?.includes('restore_stamina')) {
        let recovery = 15;
        if (move.effect === 'restore_stamina_20') recovery = 20;
        if (move.effect === 'restore_stamina_25') recovery = 25;
        if (move.effect === 'restore_stamina_30') recovery = 30;
        const newSta = Math.min(maxSta, curSta - (move.staminaCost || 0) + recovery);
        dispatch({
          type: 'UPDATE_PLAYER_MONSTER',
          monster: { ...monster, stats: { ...monster.stats, currentStamina: newSta } },
        });
        addLog(`⚡ ${move.name} recovered ${recovery} stamina!`, 'heal');
      } else {
        dispatch({
          type: 'UPDATE_PLAYER_MONSTER',
          monster: { ...monster, stats: { ...monster.stats, currentStamina: curSta - (move.staminaCost || 0) } },
        });
        addLog(`✨ Used ${move.name}!`, 'system');
      }
      return;
    }
    
    // Attack moves → enter targeting mode
    const config = getAttackConfig(move as Move);
    const validTargets = getOverworldValidTargets(overworld.playerPosition, config, overworld);
    
    if (validTargets.length === 0) {
      toast.error('No valid targets in range!');
      return;
    }
    
    setTargetingMove(move as Move);
    setTargetingTiles(validTargets);
    setAffectedTiles([]);
    setHoveredTile(null);
    addLog(`🎯 Targeting ${move.name}... Click a tile to attack!`, 'system');
  }, [state.run, monster, overworld, dispatch, addLog]);
  
  const cancelTargeting = useCallback(() => {
    setTargetingMove(null);
    setTargetingTiles([]);
    setAffectedTiles([]);
    setHoveredTile(null);
    aoePendingConfirmRef.current = null;
  }, []);

  // While aiming a skill, recompute valid targets (and the AoE preview under
  // the cursor) whenever the player moves. This lets the player walk and aim
  // simultaneously without having to re-open the move.
  useEffect(() => {
    if (!targetingMove) return;
    const config = getAttackConfig(targetingMove);
    const newValid = getOverworldValidTargets(overworld.playerPosition, config, overworld);
    setTargetingTiles(newValid);
    if (hoveredTile) {
      const tiles = getOverworldAffectedTiles(overworld.playerPosition, hoveredTile, config, overworld);
      setAffectedTiles(tiles);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overworld.playerPosition.x, overworld.playerPosition.y, targetingMove]);
  
  const handleTileHover = useCallback((worldX: number, worldY: number) => {
    if (!targetingMove) return;
    const config = getAttackConfig(targetingMove);
    const tiles = getOverworldAffectedTiles(overworld.playerPosition, { x: worldX, y: worldY }, config, overworld);
    setHoveredTile({ x: worldX, y: worldY });
    setAffectedTiles(tiles);
  }, [targetingMove, overworld.playerPosition]);
  
  // Execute attack on tile click during targeting
  const handleTargetingClick = useCallback((worldX: number, worldY: number) => {
    if (!targetingMove || !state.run || !monster) return;
    
    const isValid = targetingTiles.some(t => t.x === worldX && t.y === worldY);
    if (!isValid) {
      addLog('❌ Invalid target!', 'info');
      return;
    }
    
    const config = getAttackConfig(targetingMove);

    // ── Movement skill (dash / blink / admin-designed Move-pattern) ──
    // The chosen tile IS the destination — relocate the player, consume
    // stamina, then exit targeting. No damage / FX besides the warp particle.
    if (config.pattern === 'movement') {
      const staminaCost = targetingMove.staminaCost || 0;
      const maxSta = monster.stats.stamina ?? 50;
      const curSta = monster.stats.currentStamina ?? maxSta;
      if (curSta < staminaCost) {
        toast.error('Not enough stamina!');
        return;
      }
      try {
        playParticleEffectForMove({
          surface: 'overworld', monster, move: targetingMove,
          from: overworld.playerPosition, to: { x: worldX, y: worldY },
          affected: [{ x: worldX, y: worldY }],
        });
      } catch { /* FX never blocks combat */ }
      setOverworld(prev => {
        const newOw = JSON.parse(JSON.stringify(prev)) as OverworldState;
        ensureChunksLoaded(newOw, worldX, worldY);
        newOw.playerPosition = { x: worldX, y: worldY };
        updateVisibility(newOw);
        applyRoadsToChunks(newOw);
        saveOverworld(newOw);
        // Defer the player-stat dispatch out of the updater to dodge the
        // "setState during render of another component" warning.
        queueMicrotask(() => {
          dispatch({
            type: 'UPDATE_PLAYER_MONSTER',
            monster: { ...monster, stats: { ...monster.stats, currentStamina: curSta - staminaCost } },
          });
        });
        return newOw;
      });
      addLog(`🌀 ${monster.name} used ${targetingMove.name} to reposition!`, 'system');
      setTargetingMove(null);
      setTargetingTiles([]);
      setAffectedTiles([]);
      setHoveredTile(null);
      // Process enemy turns after the relocation settles.
      setTimeout(() => {
        const ow = overworldRef.current;
        if (ow) processEnemyTurns(ow);
      }, 120);
      return;
    }


    // Mobile/touch tap-to-preview, tap-again-to-confirm for AoE moves.
    const isTouchDevice = typeof window !== 'undefined'
      && window.matchMedia?.('(hover: none), (pointer: coarse)').matches;
    const isAoE = (targetingMove.targeting && targetingMove.targeting !== 'single')
      || (targetingMove.aoeRadius ?? 0) > 0;
    if (isTouchDevice && isAoE) {
      const pending = aoePendingConfirmRef.current;
      const now = Date.now();
      const sameTile = pending && pending.x === worldX && pending.y === worldY && now - pending.time < 4000;
      if (!sameTile) {
        const previewTiles = getOverworldAffectedTiles(overworld.playerPosition, { x: worldX, y: worldY }, config, overworld);
        setHoveredTile({ x: worldX, y: worldY });
        setAffectedTiles(previewTiles);
        aoePendingConfirmRef.current = { x: worldX, y: worldY, time: now };
        addLog(`🎯 Tap again to fire ${targetingMove.name}`, 'system');
        return;
      }
      aoePendingConfirmRef.current = null;
    }

    const affected = getOverworldAffectedTiles(overworld.playerPosition, { x: worldX, y: worldY }, config, overworld);

    // Visual particle FX (caster → target / AoE tiles).
    try {
      playParticleEffectForMove({
        surface: 'overworld',
        monster,
        move: targetingMove,
        from: overworld.playerPosition,
        to: { x: worldX, y: worldY },
        affected,
      });
    } catch (e) { /* never block combat on FX */ }

    const staminaCost = targetingMove.staminaCost || 0;
    const maxSta = monster.stats.stamina ?? 50;
    const curSta = monster.stats.currentStamina ?? maxSta;
    let newStamina = curSta - staminaCost;
    
    let enemiesHit: { enemy: Monster; pos: Position }[] = [];
    const recruitEntries: RecruitQueueEntry[] = [];
    
    setOverworld(prev => {
      const newOw = JSON.parse(JSON.stringify(prev)) as OverworldState;
      
      for (const tile of affected) {
        const owTile = getOverworldTile(newOw, tile.x, tile.y);
        
        // Attack nests
        if (owTile?.type === 'nest' && owTile.nestId) {
          const nest = newOw.nests?.[owTile.nestId];
          if (nest && !nest.destroyed) {
            const attackStat = targetingMove.type === 'melee' ? monster.stats.attack : monster.stats.special;
            const baseDamage = targetingMove.power + attackStat;
            const damage = Math.max(1, Math.floor(baseDamage * 0.8)); // Nests have flat damage reduction
            
            const destroyed = damageNest(nest, damage);
            if (destroyed) {
              // Remove nest tile, replace with grass
              setOverworldTile(newOw, tile.x, tile.y, {
                type: 'grass', explored: true, visible: true, harvested: true,
              });
              // Grant rewards
              const rewards = getNestDestroyRewards(nest);
              dispatch({ type: 'ADD_XP', amount: rewards.xp });
              dispatch({ type: 'ADD_GOLD', amount: rewards.gold });
              for (const mat of rewards.materials) {
                dispatch({ type: 'ADD_MATERIAL', materialId: mat.id, quantity: 1 });
              }
              addLog(`💥 ${targetingMove.name} destroyed the ${nest.element} nest! +${rewards.xp} XP, +${rewards.gold} gold, +${rewards.materials.length} materials!`, 'loot');
              toast.success(`🪺 Nest destroyed! +${rewards.xp} XP`);
              enemiesHit.push({ enemy: { id: nest.id, name: `${nest.element} nest` } as any, pos: tile });
            } else {
              addLog(`⚔️ ${targetingMove.name} hit the nest for ${damage} damage! (${nest.hp}/${nest.maxHp} HP)`, 'damage');
              enemiesHit.push({ enemy: { id: nest.id, name: `${nest.element} nest` } as any, pos: tile });
            }
          }
        }
        
        // Attack enemies
        if (owTile?.type === 'enemy' && owTile.enemyId) {
          const enemy = getOverworldEnemy(newOw, owTile.enemyId);
          if (enemy) {
            const attackStat = targetingMove.type === 'melee' ? monster.stats.attack : monster.stats.special;
            const baseDamage = targetingMove.power + attackStat;
            const damage = Math.max(1, Math.floor(baseDamage - enemy.stats.defense * 0.3));
            
            const newEnemyHp = enemy.stats.currentHp - damage;
            
            if (newEnemyHp <= 0) {
              const overkill = Math.abs(newEnemyHp);
              removeOverworldEnemyFromMap(newOw, enemy.id, tile);
              
              const xpGained = calculateXpReward(enemy.level, monster.level);
              dispatch({ type: 'ADD_XP', amount: xpGained });
              
              const currentXp = state.run!.experience || 0;
              const newTotalXp = currentXp + xpGained;
              const xpNeeded = xpToNextLevel(monster.level);
              if (newTotalXp >= xpNeeded) {
                const newMoves = getNewMovesAtLevel(monster.species, monster.element, monster.class, monster.level + 1);
                setLevelUpQueue(q => [...q, {
                  previousStats: { ...monster.stats },
                  previousLevel: monster.level,
                  newMoves,
                  monster: { ...monster, level: monster.level + 1 },
                  isPassive: false,
                }]);
              }
              
              // Passive XP for party
              state.run!.party?.forEach((member, index) => {
                if (index === state.run!.activePartyIndex) return;
                if (member.stats.currentHp <= 0) return;
                const passiveXp = Math.floor(xpGained * 0.5);
                dispatch({ type: 'UPDATE_PARTY_MONSTER', index, monster: { ...member, experience: (member.experience || 0) + passiveXp } });
              });
              
              addLog(`💥 ${targetingMove.name} defeated ${enemy.name}! (+${damage} dmg, +${xpGained} XP)`, 'damage');
              
              // Recruitment
              const playerHpPercent = Math.floor((monster.stats.currentHp / monster.stats.maxHp) * 100);
              const chance = calculateRecruitChance({
                turnsUsed: 1, overkillDamage: overkill, statusEffectsApplied: 0, criticalHits: 0,
                playerHpPercent, enemyLevel: enemy.level, playerLevel: monster.level,
              });
              recruitEntries.push({
                enemy,
                chance,
                stats: { turnsUsed: 1, overkillDamage: overkill, statusEffectsApplied: 0, criticalHits: 0 },
              });
              
              enemiesHit.push({ enemy, pos: tile });
            } else {
              for (const chunk of Object.values(newOw.chunks)) {
                const e = chunk.enemies.find(e => e.id === enemy.id);
                if (e) { e.stats.currentHp = newEnemyHp; break; }
              }
              addLog(`⚔️ ${targetingMove.name} hit ${enemy.name} for ${damage} damage!`, 'damage');
              enemiesHit.push({ enemy, pos: tile });
            }
          }
        }
        
        // Harvest trees and rocks via attack
        if (owTile?.type === 'tree' || owTile?.type === 'rock') {
          const isTree = owTile.type === 'tree';
          const tierData = isTree
            ? TREE_TIER_DATA[(owTile.treeTier || 'oak') as TreeTier]
            : STONE_TIER_DATA[(owTile.stoneTier || 'stone') as StoneTier];
          // Attack power determines hits dealt (min 1)
          const attackStat = targetingMove.type === 'melee' ? monster.stats.attack : monster.stats.special;
          const hitsDealt = Math.max(1, Math.floor((targetingMove.power + attackStat) / 15));
          const actualHits = Math.min(hitsDealt, owTile.resourceAmount || 1);
          const isSpecial = !!tierData.materialId;
          // Specialty tiers (ores, maple, elder oak) drop mostly the specialty
          // material with a small wood/stone byproduct.
          const bulkAmount = (isSpecial ? 1 : tierData.harvestYield) * actualHits;
          const specialAmount = isSpecial ? tierData.harvestYield * actualHits : 0;
          
          owTile.resourceAmount = (owTile.resourceAmount || 1) - actualHits;
          if (isTree) newOw.woodCollected += bulkAmount;
          else newOw.stoneCollected += bulkAmount;
          
          if (tierData.materialId && specialAmount > 0) {
            dispatch({ type: 'ADD_MATERIAL', materialId: tierData.materialId, quantity: specialAmount });
            addLog(`✨ Extracted ${specialAmount}× ${tierData.materialId.replace(/_/g, ' ')}!`, 'loot');
          }
          
          const bulkLabel = `+${bulkAmount} ${isTree ? 'wood' : 'stone'}${specialAmount ? ` +${specialAmount} ${tierData.materialId!.replace(/_/g, ' ')}` : ''}`;
          if (owTile.resourceAmount <= 0) {
            const resKey = `${tile.x},${tile.y}`;
            delete newOw.resourceUpgrades[resKey];
            // Trees leave plantable soil + guaranteed seed on the fell swing.
            const felledTree = isTree;
            setOverworldTile(newOw, tile.x, tile.y, {
              ...owTile, type: 'grass', harvested: true,
              treeTier: undefined, stoneTier: undefined, resourceAmount: undefined,
              tilled: felledTree ? true : owTile.tilled,
            });
            if (isTree && tierData.seedMaterialId) {
              dispatch({ type: 'ADD_MATERIAL', materialId: tierData.seedMaterialId, quantity: 1 });
              addLog(`🌱 Picked up a ${tierData.seedName || 'seed'}!`, 'loot');
            }
            addLog(`🪓 ${targetingMove.name} felled the ${tierData.name}! ${bulkLabel}`, 'loot');
            if (isTree) addLog(`🟫 Plantable soil remains where the tree stood.`, 'system');
          } else {
            addLog(`🪓 ${targetingMove.name} chipped the ${tierData.name}! ${bulkLabel} (${owTile.resourceAmount} left)`, 'loot');
          }
          enemiesHit.push({ enemy: { id: `res-${tile.x},${tile.y}`, name: tierData.name } as any, pos: tile });
        }
      }
      
      if (enemiesHit.length === 0) {
        addLog(`⚔️ ${targetingMove.name} hit nothing of value.`, 'info');
      }
      
      setTimeout(() => processEnemyTurns(newOw), 100);
      
      // Surface multi-kill recruitment: first entry shown immediately, rest queued.
      if (recruitEntries.length > 0) {
        const [first, ...rest] = recruitEntries;
        setDefeatedEnemy(first.enemy);
        setRecruitChance(first.chance);
        setBattleStats(first.stats);
        if (rest.length > 0) setRecruitQueue(q => [...q, ...rest]);
        setShowRecruitment(true);
      }
      
      saveOverworld(newOw);
      return newOw;
    });
    
    // Update player stamina + mastery
    const baseMoveId = (targetingMove as any).baseMoveId || targetingMove.id;
    const currentMastery = monster.moveMastery || {};
    const masteryEntry = currentMastery[baseMoveId] || { uses: 0, currentTier: 'lesser' as const, hasAoE: false };
    const newUses = masteryEntry.uses + 1;
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
        moveMastery: { ...currentMastery, [baseMoveId]: { uses: newUses, currentTier: newTier, hasAoE } },
      },
    });
    
    cancelTargeting();
  }, [targetingMove, targetingTiles, state.run, monster, overworld, dispatch, cancelTargeting, addLog, saveOverworld, processEnemyTurns]);
  
  // ─── Tile click handler ───
  const handleTileClick = useCallback((worldX: number, worldY: number) => {
    // Defensive: make sure chunks around both the player and the tap target are
    // generated before any logic reads them. On mobile, taps can race ahead of
    // the post-move chunk streamer and target ungenerated tiles, causing
    // pathfinding/click handlers to silently no-op.
    ensureChunksLoaded(overworld, overworld.playerPosition.x, overworld.playerPosition.y);
    ensureChunksLoaded(overworld, worldX, worldY);
    // Road build mode: place road
    if (roadBuildMode && selectedRoadType) {
      setOverworld(prev => {
        const newOw = JSON.parse(JSON.stringify(prev)) as OverworldState;
        if (!newOw.roads) newOw.roads = {};
        const check = canPlaceRoad(newOw, worldX, worldY, selectedRoadType);
        if (!check.canPlace) {
          toast.error(check.reason || 'Cannot place road here');
          return prev;
        }
        placeRoad(newOw, worldX, worldY, selectedRoadType);
        const def = ROAD_DEFINITIONS[selectedRoadType];
        addLog(`🛤️ Placed ${def.name} at (${worldX},${worldY})`, 'system');
        saveOverworld(newOw);
        return newOw;
      });
      return;
    }

    // Build mode: place building
    if (buildMode && selectedBuildType) {
      setOverworld(prev => {
        const newOw = JSON.parse(JSON.stringify(prev)) as OverworldState;
        const tile = getOverworldTile(newOw, worldX, worldY);
        if (!tile) {
          toast.error('Can only build on open ground!');
          return prev;
        }
        // Reject elevation features up front with helpful messages.
        if (tile.type === 'cliff') {
          toast.error('Cannot build on a cliff face');
          return prev;
        }
        if (tile.type === 'waterfall') {
          toast.error('Cannot build on a waterfall');
          return prev;
        }
        if (tile.isRamp) {
          toast.error('Ramps only accept stair-style stone roads — use the road tool');
          return prev;
        }
        if (tile.type !== 'grass' && tile.type !== 'dirt_road' && tile.type !== 'stone_road') {
          toast.error('Can only build on open ground!');
          return prev;
        }
        // Compute "adjacent cliff" so stair/ladder placement can attach to natural cliff faces.
        const adjacentCliff = [[0,-1],[0,1],[-1,0],[1,0]].some(([dx,dy]) => {
          const nb = getOverworldTile(newOw, worldX + dx, worldY + dy);
          return nb?.type === 'cliff';
        });
        const check = canPlaceBuilding(
          worldX, worldY,
          newOw.playerBuildings || [],
          newOw.homeBase.position,
          newOw.woodCollected, newOw.stoneCollected,
          selectedBuildType,
          { isCliff: false, isWaterfall: false, isRamp: false, adjacentCliff } as any,
        );
        if (!check.canPlace) {
          toast.error(check.reason || 'Cannot build here');
          return prev;
        }
        const def = BUILDING_DEFINITIONS[selectedBuildType];
        // Creative mode: skip the resource deduction (canPlaceBuilding already
        // accepted the placement without a resource check).
        if (!isCreativeMode()) {
          newOw.woodCollected -= def.cost.wood;
          newOw.stoneCollected -= def.cost.stone;
        }
        const building = createBuilding(selectedBuildType, worldX, worldY);
        // For elevation connectors, lock orientation onto the adjacent
        // wall/cliff at placement time so it visually "snaps" to its anchor.
        if (selectedBuildType === 'stone_staircase' || selectedBuildType === 'ladder') {
          building.connectorDir = detectConnectorDir(newOw, worldX, worldY);
        }
        if (!newOw.playerBuildings) newOw.playerBuildings = [];
        newOw.playerBuildings.push(building);
        setOverworldTile(newOw, worldX, worldY, {
          type: 'player_building',
          explored: true,
          visible: true,
          playerBuildingId: building.id,
        });
        addLog(`🏗️ Built ${def.name} at (${worldX},${worldY})!`, 'system');
        toast.success(`${def.emoji} ${def.name} built!`);
        saveOverworld(newOw);
        return newOw;
      });
      return;
    }
    
    if (targetingMove) {
      handleTargetingClick(worldX, worldY);
      return;
    }
    
    // Click on enemy or nest → auto-select first attack move.
    // IMPORTANT: only intercept the click as an attack when the enemy actually
    // resolves to a live Monster. Orphan enemy tiles (enemyId pointing at an
    // enemy that no longer exists in any chunk) used to swallow the tap and
    // leave the player feeling "movement locked" near an invisible enemy.
    const tile = getOverworldTile(overworld, worldX, worldY);
    const resolvedEnemy = tile?.type === 'enemy' && tile.enemyId
      ? getOverworldEnemy(overworld, tile.enemyId)
      : null;
    if (((tile?.type === 'enemy' && resolvedEnemy) || (tile?.type === 'nest' && tile.nestId)) && monster) {
      const moves = getMonsterMoves(monster.species, monster.element, monster.class, monster.level);
      const attackMove = moves.find(m => m.type === 'melee' || m.type === 'ranged');
      if (attackMove) {
        const config = getAttackConfig(attackMove);
        const dist = Math.abs(worldX - overworld.playerPosition.x) + Math.abs(worldY - overworld.playerPosition.y);
        if (dist <= config.range) {
          const validTargets = getOverworldValidTargets(overworld.playerPosition, config, overworld);
          if (validTargets.some(t => t.x === worldX && t.y === worldY)) {
            setTargetingMove(attackMove);
            setTargetingTiles(validTargets);
            setTimeout(() => handleTargetingClick(worldX, worldY), 0);
            return;
          }
        } else {
          addLog(`❌ ${tile.type === 'nest' ? 'Nest' : 'Enemy'} out of range! Get closer.`, 'info');
          return;
        }
      }
    }

    
    // Click on player building (scout tower / farm) to open assign modal
    if (tile?.type === 'player_building' && tile.playerBuildingId) {
      const building = overworld.playerBuildings?.find(b => b.id === tile.playerBuildingId);
      if (building && (building.type === 'scout_tower' || building.type === 'farm')) {
        setAssignBuilding(building);
        return;
      }
    }
    
    // Normal movement.
    const dx = worldX - overworld.playerPosition.x;
    const dy = worldY - overworld.playerPosition.y;
    if (dx === 0 && dy === 0) return;
    // Adjacent tap → step directly, OR auto-harvest if toggle is on and the
    // target tile is a harvestable resource.
    if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
      cancelAutoWalk();
      if (settings.autoMine && (tile?.type === 'rock' || tile?.type === 'tree' || tile?.type === 'plant')) {
        startAutoMine(worldX, worldY);
        return;
      }
      handleMove(dx, dy);
      return;
    }
    // Far-tap on a harvestable while auto-mine is on → hand it straight to
    // the cluster-harvest job. It walks the player over AND chops everything
    // in the cluster, no separate arrival hook needed.
    if (settings.autoMine && (tile?.type === 'rock' || tile?.type === 'tree' || tile?.type === 'plant')) {
      startAutoMine(worldX, worldY);
      return;
    }
    // Far tap → A* path to destination and walk it step-by-step. This is what
    // makes mobile tap-to-move actually usable when the target isn't right
    // next to you.
    let path = findOverworldPath(overworld, overworld.playerPosition, { x: worldX, y: worldY });
    if (!path || path.length === 0) {
      // Fallback: if the target is a harvestable / enemy / building / nest /
      // dungeon (non-walkable goal types), try pathing to its closest adjacent
      // walkable tile so the player can step up and interact.
      const interactable = tile && (
        tile.type === 'tree' || tile.type === 'rock' || tile.type === 'plant' || tile.type === 'enemy' ||
        tile.type === 'nest' || tile.type === 'building' || tile.type === 'dungeon_entrance' ||
        tile.type === 'water'
      );
      if (interactable) {
        const offsets = [ [0, -1], [0, 1], [-1, 0], [1, 0] ];
        let best: Position[] | null = null;
        for (const [ox, oy] of offsets) {
          const ax = worldX + ox, ay = worldY + oy;
          if (ax === overworld.playerPosition.x && ay === overworld.playerPosition.y) {
            best = []; break;
          }
          const p = findOverworldPath(overworld, overworld.playerPosition, { x: ax, y: ay });
          if (p && p.length > 0 && (!best || p.length < best.length)) best = p;
        }
        path = best;
      }
      if (!path || path.length === 0) {
        toast.info('No path to that tile.');
        return;
      }
    }
    startAutoWalk(path);
  }, [overworld, monster, targetingMove, handleTargetingClick, handleMove, addLog, buildMode, selectedBuildType, roadBuildMode, selectedRoadType, saveOverworld, settings.autoMine, startAutoMine]);
  
  // Right-click → context menu for player buildings, or auto-attack for enemies/nests
  const handleTileRightClick = useCallback((worldX: number, worldY: number) => {
    // Ensure the tapped tile is generated before the unified menu reads it.
    ensureChunksLoaded(overworld, worldX, worldY);
    // One menu for every tile — the unified menu reads the tile itself and
    // builds the action list at render time. Long-press on touch and
    // right-click on desktop both land here.
    setUnifiedMenu({ x: worldX, y: worldY });
  }, [overworld]);
  
  // ─── Keyboard ───
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (showBuildingMenu || showDungeonPrompt || showRecruitment || levelUpQueue.length > 0) return;
      
      if (e.key === 'Escape') {
        if (showBuildPanel) {
          setShowBuildPanel(false);
          setBuildMode(false);
          setSelectedBuildType(null);
          setRoadBuildMode(false);
          setSelectedRoadType(null);
          return;
        }
        if (roadBuildMode) {
          setRoadBuildMode(false);
          setSelectedRoadType(null);
          addLog('❌ Road build mode cancelled.', 'info');
          return;
        }
        if (buildMode) {
          setBuildMode(false);
          setSelectedBuildType(null);
          addLog('❌ Build mode cancelled.', 'info');
          return;
        }
        if (targetingMove) {
          cancelTargeting();
          addLog('❌ Attack cancelled.', 'info');
          return;
        }
      }
      
      switch (e.key) {
        case ' ': case 'Spacebar': {
          // Space halts every automatic action (auto-walk, auto-mine,
          // auto-hunt, auto-search, targeting) — as long as the player isn't
          // typing, which isTypingTarget above already filtered.
          const walking = !!autoWalkPathRef.current;
          const mining = !!autoMineTargetRef.current;
          const hunting = autoHuntTimerRef.current !== null;
          const searching = autoSearchTimerRef.current !== null;
          if (walking || mining || hunting || searching || targetingMove) {
            e.preventDefault();
            if (walking) cancelAutoWalk();
            if (mining) cancelAutoMine('⏸ Auto-Harvest halted.');
            if (hunting) cancelAutoHunt('⏸ Auto-Hunt halted.');
            if (searching) cancelAutoSearch('⏸ Auto-Search halted.');
            if (targetingMove) cancelTargeting();
            if (walking && !mining && !hunting && !searching) addLog('⏸ Auto-walk halted.', 'info');
          }
          break;
        }
        case 'ArrowUp': case 'w': case 'W':
          e.preventDefault(); cancelAutoWalk(); handleMove(0, -1); break;
        case 'ArrowDown': case 's': case 'S':
          e.preventDefault(); cancelAutoWalk(); handleMove(0, 1); break;
        case 'ArrowLeft': case 'a': case 'A':
          e.preventDefault(); cancelAutoWalk(); handleMove(-1, 0); break;
        case 'ArrowRight': case 'd': case 'D':
          e.preventDefault(); cancelAutoWalk(); handleMove(1, 0); break;
        case 'h': case 'H':
          if (!targetingMove && !buildMode) {
            e.preventDefault();
            startAutoHunt();
          }
          break;
        case 'f': case 'F':
          if (!targetingMove && !buildMode) {
            e.preventDefault();
            setAutoSearchPickerOpen(true);
          }
          break;
        case 'b': case 'B':
          if (!targetingMove && !buildMode) {
            e.preventDefault();
            setShowBuildPanel(p => !p);
          }
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleMove, cancelAutoWalk, cancelAutoMine, cancelAutoHunt, cancelAutoSearch, startAutoHunt, showBuildingMenu, showDungeonPrompt, showRecruitment, targetingMove, cancelTargeting, levelUpQueue.length, buildMode, roadBuildMode, showBuildPanel, addLog]);
  
  // Keybind shortcuts for moves
  const keybindDataRef = useRef(loadKeybinds());
  useEffect(() => { keybindDataRef.current = loadKeybinds(); });
  
  useEffect(() => {
    if (!monster) return;
    const handleKeybindPress = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (e.shiftKey || targetingMove) return;
      
      const key = e.key.toLowerCase();
      const binds = getMonsterKeybindsImport(keybindDataRef.current, `${monster.species}_${monster.element}_${(monster as any).class}`);
      
      for (const [moveId, boundKey] of Object.entries(binds)) {
        if (boundKey === key) {
          const moves = getMonsterMoves(monster.species, monster.element, (monster as any).class, monster.level);
          const move = moves.find(m => m.id === moveId);
          if (move) {
            e.preventDefault();
            handleUseMoveOnMap(move);
          }
          return;
        }
      }
    };
    
    window.addEventListener('keydown', handleKeybindPress);
    return () => window.removeEventListener('keydown', handleKeybindPress);
  }, [monster, targetingMove, handleUseMoveOnMap]);
  
  // Shift+1-9 for inventory items
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
  }, [state.run?.inventory]);
  
  // ─── Item usage ───
  const handleUseItemOutOfCombat = useCallback((item: InventoryItem) => {
    if (!state.run) return;
    const m = state.run.currentMonster;
    let message = '';
    let updatedMonster = { ...m };
    
    if (item.effect === 'heal_hp') {
      const hpBefore = m.stats.currentHp;
      const newHp = Math.min(m.stats.maxHp, m.stats.currentHp + (item.value || 0));
      const healed = newHp - hpBefore;
      if (healed <= 0) { addLog('❤️ Already at full HP!', 'info'); return; }
      updatedMonster = { ...m, stats: { ...m.stats, currentHp: newHp } };
      message = `Restored ${healed} HP!`;
    } else if (item.effect === 'heal_full') {
      if (m.stats.currentHp >= m.stats.maxHp) { addLog('❤️ Already at full HP!', 'info'); return; }
      updatedMonster = { ...m, stats: { ...m.stats, currentHp: m.stats.maxHp } };
      message = `Fully restored HP!`;
    } else if (item.effect === 'heal_stamina') {
      const maxSta = m.stats.stamina ?? 50;
      const curSta = m.stats.currentStamina ?? maxSta;
      const newSta = Math.min(maxSta, curSta + (item.value || 0));
      if (newSta - curSta <= 0) { addLog('⚡ Already at full stamina!', 'info'); return; }
      updatedMonster = { ...m, stats: { ...m.stats, currentStamina: newSta } };
      message = `Restored ${newSta - curSta} Stamina!`;
    } else if (item.effect === 'revive' || item.effect === 'revive_full') {
      const hasFainted = state.run!.party.some(p => p.stats.currentHp <= 0);
      if (!hasFainted) { addLog('🌿 No fainted party members to revive!', 'info'); return; }
      setPendingReviveItem(item);
      setShowReviveModal(true);
      return;
    } else {
      message = `Used ${item.name}!`;
    }
    
    dispatch({ type: 'UPDATE_PLAYER_MONSTER', monster: updatedMonster });
    dispatch({ type: 'USE_ITEM', itemId: item.id });
    addLog(`✨ ${message}`, 'heal');
  }, [state.run, dispatch, addLog]);
  
  const handleReviveTarget = useCallback((partyIndex: number) => {
    if (!pendingReviveItem || !state.run) return;
    const revivePercent = pendingReviveItem.effect === 'revive_full' ? 100 : (pendingReviveItem.value || 25);
    dispatch({ type: 'REVIVE_PARTY_MEMBER', index: partyIndex, hpPercent: revivePercent });
    dispatch({ type: 'USE_ITEM', itemId: pendingReviveItem.id });
    const revivedMonster = state.run.party[partyIndex];
    addLog(`🌿 ${revivedMonster.species} was revived!`, 'heal');
    toast.success(`${revivedMonster.species} revived!`);
    setShowReviveModal(false);
    setPendingReviveItem(null);
  }, [pendingReviveItem, state.run, dispatch, addLog]);
  
  // ─── Recruitment handlers ───
  // Roll happens inside the modal. These react to the outcome and advance the
  // recruit queue (used when one AoE attack defeated multiple enemies).
  const advanceRecruitQueue = useCallback(() => {
    setRecruitQueue(q => {
      if (q.length > 0) {
        const [next, ...rest] = q;
        setDefeatedEnemy(next.enemy);
        setRecruitChance(next.chance);
        setBattleStats(next.stats);
        return rest;
      }
      setShowRecruitment(false);
      setDefeatedEnemy(null);
      return q;
    });
  }, []);

  const handleRecruitFail = useCallback(() => {
    if (defeatedEnemy) {
      addLog(`😔 ${defeatedEnemy.name} declined to join...`, 'info');
    }
    advanceRecruitQueue();
  }, [defeatedEnemy, addLog, advanceRecruitQueue]);

  const handleRecruitAddToParty = useCallback(() => {
    if (defeatedEnemy) {
      dispatch({ type: 'ADD_TO_PARTY', monster: defeatedEnemy });
      addLog(`🎉 ${defeatedEnemy.name} joined your party!`, 'system');
      toast.success(`${defeatedEnemy.species} joined your team!`);
    }
    advanceRecruitQueue();
  }, [defeatedEnemy, dispatch, addLog, advanceRecruitQueue]);

  const handleRecruitReplace = useCallback((replaceIndex: number) => {
    if (defeatedEnemy) {
      dispatch({ type: 'SEND_PARTY_MEMBER_TO_TOWN', partyIndex: replaceIndex });
      dispatch({ type: 'ADD_TO_PARTY', monster: defeatedEnemy });
      addLog(`🔄 Sent a party member home; ${defeatedEnemy.name} took their place!`, 'system');
      toast.success(`${defeatedEnemy.species} joined your team!`);
    }
    advanceRecruitQueue();
  }, [defeatedEnemy, dispatch, addLog, advanceRecruitQueue]);

  const handleRecruitSendHome = useCallback(() => {
    if (defeatedEnemy) {
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
      addLog(`🏠 ${defeatedEnemy.name} was sent home to the roster.`, 'system');
      toast.success(`${defeatedEnemy.species} sent home!`);
    }
    advanceRecruitQueue();
  }, [defeatedEnemy, dispatch, addLog, advanceRecruitQueue]);

  const handleSkipRecruit = useCallback(() => {
    advanceRecruitQueue();
  }, [advanceRecruitQueue]);
  
  // Party switch handler
  const handlePartySwitch = useCallback((index: number) => {
    dispatch({ type: 'SWITCH_ACTIVE_MONSTER', index });
    addLog(`🔄 Switched to ${state.run?.party[index]?.species}!`, 'system');
  }, [dispatch, state.run?.party]);
  
  // ─── Building & dungeon ───
  const handleUpgrade = () => {
    setOverworld(prev => {
      const newState = JSON.parse(JSON.stringify(prev)) as OverworldState;
      const result = upgradeBase(newState);
      if (result) {
        const info = BUILDING_UPGRADES[result];
        toast.success(`Upgraded to ${info.label}! ${info.emoji}`);
        addLog(`🏗️ Upgraded base to ${info.label}!`, 'system');
        saveOverworld(newState);
        return newState;
      }
      return prev;
    });
  };
  
  const handleEnterDungeon = () => {
    setShowDungeonPrompt(false);
    // Item World towers must pick a base asset before generating the dungeon.
    if (selectedDungeon?.category === 'item_world') {
      setPendingItemWorldEntrance(selectedDungeon);
      return;
    }
    // Store which dungeon we're entering for tracking
    if (selectedDungeon) {
      localStorage.setItem('menagerie_active_dungeon_id', selectedDungeon.id);
    }
    dispatch({ type: 'SNAPSHOT_RUN_PROGRESS', overworld });
    // Route through party select + equipment flow, same as main menu
    localStorage.setItem('menagerie_run_destination', 'dungeon');
    localStorage.setItem('menagerie_run_origin', 'overworld');
    dispatch({ type: 'SET_PHASE', phase: 'character_select' });
  };
  
  // Return to Town: snap the overworld player to the nearest empty tile around (0,0)
  // and persist it. Stays in the overworld phase — does NOT end the run.
  const handleReturnToTown = () => {
    setOverworld(prev => {
      const next = JSON.parse(JSON.stringify(prev)) as OverworldState;
      const home = findNearestEmptyOverworldTile(next, 0, 0);
      next.playerPosition = home;
      updateVisibility(next);
      saveOverworld(next);
      return next;
    });
    addLog('🏠 Returned to town.', 'system');
    toast.success('Returned to town');
  };

  // Return to Main Menu: SUSPEND the current run (no END_RUN). Snapshots
  // current run + overworld state into saveData so a "Resume" from the main
  // menu drops the player back exactly where they were. Pushes to cloud when
  // signed in for cross-device safety.
  const handleReturnToMainMenu = async () => {
    addLog('💾 Saving and returning to main menu...', 'system');
    // Build a fresh snapshot that includes the live overworld (positions,
    // fog, buildings, etc.) so resume works without losing progress.
    const snapshot = buildProgressSnapshot(state.saveData, state.run, overworld);
    dispatch({ type: 'SNAPSHOT_RUN_PROGRESS', overworld });
    if (isAuthenticated) {
      const result = await saveToCloud(snapshot);
      if (result.success) toast.success('☁️ Saved — returning to menu');
      else toast.error(`Save failed: ${result.error || 'unknown'} — returning anyway`);
    } else {
      toast.success('💾 Saved locally — returning to menu');
    }
    dispatch({ type: 'SET_PHASE', phase: 'main_menu' });
  };

  const handleDropItem = (itemId: string) => {
    dispatch({ type: 'DROP_ITEM', itemId });
    addLog('🗑️ Item dropped', 'info');
  };
  
  const baseInfo = BUILDING_UPGRADES[overworld.homeBase.buildingType];
  const canUpgrade = canUpgradeBase(overworld);
  const upgradeInfo = baseInfo.next ? BUILDING_UPGRADES[baseInfo.next] : null;
  
  // Get IDs of monsters already assigned to buildings
  const assignedMonsterIds = (overworld.playerBuildings || [])
    .filter(b => b.assignedMonsterId && (!assignBuilding || b.id !== assignBuilding.id))
    .map(b => b.assignedMonsterId!);
  
  const handleAssignMonster = useCallback((monsterId: string) => {
    if (!assignBuilding || !state.run) return;
    setOverworld(prev => {
      const newOw = JSON.parse(JSON.stringify(prev)) as OverworldState;
      const b = newOw.playerBuildings?.find(pb => pb.id === assignBuilding.id);
      if (!b) return prev;
      b.assignedMonsterId = monsterId;
      // For farms, set element based on the monster
      if (b.type === 'farm') {
        const m = state.run!.party.find(p => p.id === monsterId);
        if (m) {
          b.farmElement = m.element;
          b.growthProgress = FARM_GROWTH_STEPS;
          b.harvestReady = false;
        }
      }
      addLog(`🐾 Assigned monster to ${BUILDING_DEFINITIONS[b.type].name}!`, 'system');
      toast.success('Monster assigned!');
      saveOverworld(newOw);
      return newOw;
    });
    setAssignBuilding(null);
  }, [assignBuilding, state.run, addLog, saveOverworld]);
  
  const handleUnassignMonster = useCallback(() => {
    if (!assignBuilding) return;
    setOverworld(prev => {
      const newOw = JSON.parse(JSON.stringify(prev)) as OverworldState;
      const b = newOw.playerBuildings?.find(pb => pb.id === assignBuilding.id);
      if (!b) return prev;
      b.assignedMonsterId = undefined;
      b.farmElement = undefined;
      b.growthProgress = undefined;
      b.harvestReady = false;
      b.harvestOutput = undefined;
      addLog(`🐾 Removed monster from ${BUILDING_DEFINITIONS[b.type].name}.`, 'system');
      saveOverworld(newOw);
      return newOw;
    });
    setAssignBuilding(null);
  }, [assignBuilding, addLog, saveOverworld]);
  
  // ─── Building context menu actions: repair & disassemble ───
  const handleRepairBuilding = useCallback(() => {
    if (!contextMenuBuilding) return;
    const cost = getRepairCost(contextMenuBuilding);
    setOverworld(prev => {
      const newOw = JSON.parse(JSON.stringify(prev)) as OverworldState;
      const b = newOw.playerBuildings?.find(pb => pb.id === contextMenuBuilding.id);
      if (!b) return prev;
      if (newOw.woodCollected < cost.wood || newOw.stoneCollected < cost.stone) {
        toast.error('Not enough resources!');
        return prev;
      }
      newOw.woodCollected -= cost.wood;
      newOw.stoneCollected -= cost.stone;
      b.hp = b.maxHp;
      addLog(`🔧 Repaired ${BUILDING_DEFINITIONS[b.type].name} to full HP.`, 'system');
      toast.success(`Repaired! (-🪵${cost.wood} -🪨${cost.stone})`);
      saveOverworld(newOw);
      return newOw;
    });
    setContextMenuBuilding(null);
  }, [contextMenuBuilding, addLog, saveOverworld]);
  
  const handleDisassembleBuilding = useCallback(() => {
    if (!contextMenuBuilding) return;
    const refund = getDisassembleRefund(contextMenuBuilding);
    setOverworld(prev => {
      const newOw = JSON.parse(JSON.stringify(prev)) as OverworldState;
      const b = newOw.playerBuildings?.find(pb => pb.id === contextMenuBuilding.id);
      if (!b) return prev;
      newOw.woodCollected += refund.wood;
      newOw.stoneCollected += refund.stone;
      // Remove from list
      newOw.playerBuildings = (newOw.playerBuildings || []).filter(pb => pb.id !== b.id);
      // Reset tile to grass
      setOverworldTile(newOw, b.worldX, b.worldY, {
        type: 'grass',
        explored: true,
        visible: true,
        harvested: false,
      });
      addLog(`♻️ Disassembled ${BUILDING_DEFINITIONS[b.type].name}. Recovered 🪵${refund.wood} 🪨${refund.stone}.`, 'loot');
      toast.success(`Disassembled! +🪵${refund.wood} +🪨${refund.stone}`);
      saveOverworld(newOw);
      return newOw;
    });
    setContextMenuBuilding(null);
  }, [contextMenuBuilding, addLog, saveOverworld]);
  
  const handleContextMenuAssign = useCallback(() => {
    if (!contextMenuBuilding) return;
    setAssignBuilding(contextMenuBuilding);
    setContextMenuBuilding(null);
  }, [contextMenuBuilding]);

  // Flip a gate's banner-side / outward-side. Only meaningful for walls
  // currently acting as gates; the renderer auto-orients toward home base
  // by default and `gateFlipped` inverts that choice.
  const handleFlipGate = useCallback(() => {
    if (!contextMenuBuilding) return;
    setOverworld(prev => {
      const newOw = JSON.parse(JSON.stringify(prev)) as OverworldState;
      const b = newOw.playerBuildings?.find(pb => pb.id === contextMenuBuilding.id);
      if (!b) return prev;
      b.gateFlipped = !b.gateFlipped;
      addLog(`🔄 Flipped gate facing at (${b.worldX},${b.worldY}).`, 'system');
      saveOverworld(newOw);
      setContextMenuBuilding({ ...b });
      return newOw;
    });
  }, [contextMenuBuilding, addLog, saveOverworld]);

  // Rotate a stair/ladder: cycles n → e → s → w. Useful when auto-detect
  // picks the "wrong" cliff side (e.g., placed at an inside corner).
  const handleRotateConnector = useCallback(() => {
    if (!contextMenuBuilding) return;
    setOverworld(prev => {
      const newOw = JSON.parse(JSON.stringify(prev)) as OverworldState;
      const b = newOw.playerBuildings?.find(pb => pb.id === contextMenuBuilding.id);
      if (!b) return prev;
      const current = b.connectorDir ?? detectConnectorDir(newOw, b.worldX, b.worldY);
      b.connectorDir = nextConnectorDir(current);
      addLog(`🔄 Rotated ${b.type === 'ladder' ? 'ladder' : 'staircase'} to face ${b.connectorDir.toUpperCase()}.`, 'system');
      saveOverworld(newOw);
      setContextMenuBuilding({ ...b });
      return newOw;
    });
  }, [contextMenuBuilding, addLog, saveOverworld]);
  const isMobileLayout = typeof window !== 'undefined' && window.innerWidth < 640;
  const sidebarHeight = isMobileLayout ? 108 : 96;
  const defaultBarHeight = isMobileLayout ? 280 : 260;
  const [controlsBarHeight, setControlsBarHeight] = useState(() => {
    const saved = localStorage.getItem('menagerie-overworld-bar-height');
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
      setControlsBarHeight(h => { localStorage.setItem('menagerie-overworld-bar-height', String(h)); return h; });
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
    ['--menagerie-bar-h' as string]: `${controlsBarHeight}px`,
    ['--menagerie-sidebar-h' as string]: `${sidebarHeight}px`,
  } as React.CSSProperties;
  
  return <>
    <GameSidebar 
      monster={state.run?.currentMonster || null} 
      gold={state.saveData.gold || 0} 
      floor={0}
      inventory={state.run?.inventory || []} 
      equipmentInventory={state.run?.equipmentInventory || []}
      equipment={state.run?.partyEquipment?.[state.run?.activePartyIndex || 0]}
      runMaterials={state.run?.runMaterials || {}}
      moveOrder={state.run?.moveOrder || []} 
      hiddenMoves={state.run?.hiddenMoves || []} 
      experience={state.run?.experience || 0} 
      experienceToNext={xpToNextLevel(state.run?.currentMonster?.level || 1)} 
      onFlee={handleReturnToTown}
      onOpenWorkshop={effectiveTools(state.saveData.tools).workstation ? () => setShowWorkshop(true) : undefined}
      fleeTitle="Return to town"
      fleeVariant="home"
      onMainMenu={handleReturnToMainMenu}
      mainMenuTitle="Save and return to main menu (resume later)"
      onDropItem={handleDropItem} 
      onUseItem={handleUseItemOutOfCombat}
      onUseMove={handleUseMoveOnMap}
      onReorderMoves={order => dispatch({ type: 'SET_MOVE_ORDER', order })} 
      onToggleHideMove={moveId => dispatch({ type: 'TOGGLE_HIDE_MOVE', moveId })}
      onOpenEquipment={() => setShowEquipment(true)}
      onPanelChange={setMenuOpen}
      panelHostId="overworld-bottom-panel-host"
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

    {/* Portable Workstation or station-building: opens the crafting workshop */}
    {(showWorkshop || workshopStationBuilding || townHallCraftBuildings) && (
      <CraftingWorkshop
        materials={state.saveData.materials || {}}
        playerLevel={state.run?.currentMonster?.level || 1}
        storedEquipment={state.saveData.storedEquipment || []}
        unlockedRecipes={state.saveData.unlockedRecipes || []}
        tools={effectiveTools(state.saveData.tools)}
        username={myUsername}
        gridFilterCategory={townHallCraftBuildings ? 'building' : undefined}
        gridHeading={townHallCraftBuildings ? '🏛️ Town Hall — Craft Building Kits' : undefined}
        station={workshopStationBuilding ? {
          kind: (Object.entries(CRAFTING_STATION_BUILDINGS).find(([, bt]) => bt === workshopStationBuilding.type)?.[0]) as any ?? null,
          tier: (workshopStationBuilding.stationTier ?? 1) as 1|2|3|4|5,
          modifiers: workshopStationBuilding.stationModifiers ?? [],
          portable: false,
        } : townHallCraftBuildings ? {
          // Town Hall = a mega-workbench at tier 3 (4x4 grid) with 2 modifier slots.
          kind: 'workbench',
          tier: 3,
          modifiers: [],
          portable: false,
        } : undefined}
        onCraft={(recipe, result) => {
          if (!isCreativeMode()) dispatch({ type: 'USE_MATERIALS', materials: recipe.materials });
          // Unified inventory: STORE_EQUIPMENT mirrors into the active run automatically.
          dispatch({ type: 'STORE_EQUIPMENT', item: result });
        }}
        onCraftConsumable={(recipe) => {
          if (!isCreativeMode()) dispatch({ type: 'USE_MATERIALS', materials: recipe.materials });
          dispatch({
            type: 'ADD_ITEM',
            item: { id: recipe.resultId, name: recipe.name, type: 'potion', value: 0, effect: recipe.effect, quantity: 1 },
          });
        }}
        onDismantle={(itemId) => dispatch({ type: 'DISMANTLE_EQUIPMENT', itemId })}
        onUpgradePickaxe={(tier, mats) => {
          if (!isCreativeMode()) dispatch({ type: 'USE_MATERIALS', materials: mats });
          dispatch({ type: 'SET_PICKAXE_TIER', tier });
        }}
        onUpgradeShovel={(tier, mats) => {
          if (!isCreativeMode()) dispatch({ type: 'USE_MATERIALS', materials: mats });
          dispatch({ type: 'SET_SHOVEL_TIER', tier });
        }}
        onCraftWorkstation={(mats) => {
          if (!isCreativeMode()) dispatch({ type: 'USE_MATERIALS', materials: mats });
          dispatch({ type: 'SET_WORKSTATION_OWNED' });
        }}
        onGridCraft={(item, used, consumable) => {
          if (!isCreativeMode()) dispatch({ type: 'USE_MATERIALS', materials: used });
          if (item) dispatch({ type: 'STORE_EQUIPMENT', item });
          else if (consumable) dispatch({ type: 'ADD_ITEM', item: {
            id: `craft_${Date.now()}`, name: consumable.name, type: 'potion', value: 0,
            effect: consumable.effectId, quantity: 1,
          }});
        }}
        onClose={() => { setShowWorkshop(false); setWorkshopStationBuilding(null); setTownHallCraftBuildings(false); }}
      />
    )}

    {/* Station Config Modal */}
    {stationConfigBuilding && (() => {
      const kind = (Object.entries(CRAFTING_STATION_BUILDINGS).find(([, bt]) => bt === stationConfigBuilding.type)?.[0]) as any;
      if (!kind) return null;
      return (
        <StationConfigModal
          building={stationConfigBuilding}
          stationKind={kind}
          materials={state.saveData.materials || {}}
          onSpendMaterials={(spent) => dispatch({ type: 'USE_MATERIALS', materials: spent })}
          onUpdate={(nextTier, nextMods) => {
            setOverworld(prev => {
              const newOw = JSON.parse(JSON.stringify(prev)) as OverworldState;
              const b = newOw.playerBuildings?.find(pb => pb.id === stationConfigBuilding.id);
              if (b) {
                b.stationTier = nextTier;
                b.stationModifiers = nextMods;
              }
              saveOverworld(newOw);
              return newOw;
            });
            // Keep modal open with updated data
            setStationConfigBuilding(prev => prev ? { ...prev, stationTier: nextTier, stationModifiers: nextMods } : prev);
          }}
          onClose={() => setStationConfigBuilding(null)}
        />
      );
    })()}

    
    {/* Revive Target Modal */}
    <ReviveTargetModal
      open={showReviveModal}
      onClose={() => { setShowReviveModal(false); setPendingReviveItem(null); }}
      party={state.run?.party || []}
      revivePercent={pendingReviveItem?.effect === 'revive_full' ? 100 : (pendingReviveItem?.value || 25)}
      itemName={pendingReviveItem?.name || 'Revive'}
      onRevive={handleReviveTarget}
    />

    {/* Auto-Search target picker */}
    {autoSearchPickerOpen && (
      <div
        className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4"
        onClick={() => setAutoSearchPickerOpen(false)}
      >
        <div
          className="bg-[hsl(40,30%,92%)] border-2 border-[hsl(30,40%,30%)] rounded-lg p-4 max-w-xs w-full shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="font-bold text-[hsl(30,40%,20%)] mb-2">🧭 Auto-Search Target</div>
          <div className="text-xs text-[hsl(30,30%,30%)] mb-3">Walks to the nearest known one. Halts on enemy (unless enemies are the target). Space to cancel.</div>
          <div className="grid grid-cols-2 gap-2">
            {([
              { k: 'dungeon_entrance', label: '🗝 Dungeon' },
              { k: 'enemy',            label: '👹 Enemy' },
              { k: 'nest',             label: '🥚 Nest' },
              { k: 'tree',             label: '🌳 Tree' },
              { k: 'rock',             label: '⛰ Rock' },
              { k: 'plant',            label: '🌿 Herb' },
              { k: 'building',         label: '🏠 Building' },
            ] as Array<{ k: SearchKind; label: string }>).map(({ k, label }) => (
              <button
                key={k}
                className="px-2 py-1.5 rounded border border-[hsl(30,40%,40%)] bg-[hsl(40,30%,85%)] hover:bg-[hsl(40,40%,80%)] text-sm text-[hsl(30,40%,20%)]"
                onClick={() => { setAutoSearchPickerOpen(false); startAutoSearch(k); }}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            className="mt-3 w-full px-2 py-1 text-xs rounded bg-[hsl(30,30%,80%)] hover:bg-[hsl(30,30%,75%)] text-[hsl(30,40%,20%)]"
            onClick={() => setAutoSearchPickerOpen(false)}
          >
            Cancel
          </button>
        </div>
      </div>
    )}

    
    {/* Level Up Screen */}
    {levelUpQueue.length > 0 && levelUpQueue[0] && (
      <LevelUpScreen
        monster={levelUpQueue[0].monster}
        previousStats={levelUpQueue[0].previousStats}
        previousLevel={levelUpQueue[0].previousLevel}
        newMoves={levelUpQueue[0].newMoves}
        isPassive={levelUpQueue[0].isPassive}
        onContinue={() => setLevelUpQueue(q => q.slice(1))}
      />
    )}
    
    {/* Recruitment Modal */}
    {showRecruitment && defeatedEnemy && (
      <RecruitmentModal
        key={defeatedEnemy.id}
        enemy={defeatedEnemy}
        recruitChance={recruitChance}
        impressiveStats={battleStats}
        party={state.run?.party || []}
        partyFull={(state.run?.party?.length || 0) >= 6}
        onDismiss={handleSkipRecruit}
        onFail={handleRecruitFail}
        onAddToParty={handleRecruitAddToParty}
        onReplaceMember={handleRecruitReplace}
        onSendHome={handleRecruitSendHome}
        queuedRecruits={recruitQueue.length}
        onSkipAll={() => {
          setRecruitQueue([]);
          setShowRecruitment(false);
          setDefeatedEnemy(null);
        }}
        unlockedMonsters={state.saveData.unlockedMonsters}
      />
    )}
    
    {/* Main map viewport - matches DungeonView layout */}
    <div className="fixed inset-0 overflow-hidden transition-all duration-300" style={dungeonBottomStyle}>
      <div className="h-full flex flex-col">
        <div className="flex-1 overflow-hidden bg-[hsl(40,20%,40%)] relative">
          <OverworldRenderer
            ref={rendererRef}
            overworld={overworld}
            playerElement={monster?.element || 'normal'}
            playerClass={monster?.class}
            playerSpecies={monster?.species}
            unlockedMonsters={state.saveData.unlockedMonsters}
            party={state.run?.party}
            onTileClick={handleTileClick}
            onTileRightClick={handleTileRightClick}
            targetingMode={!!targetingMove}
            targetingTiles={targetingTiles}
            affectedTiles={affectedTiles}
            hoveredTile={hoveredTile}
            onTileHover={handleTileHover}
            onTileHoverEnd={() => { setHoveredTile(null); setAffectedTiles([]); }}
          />

          {/* Edge-of-viewport direction arrows for off-screen landmarks */}
          <OverworldDirectionArrows
            overworld={overworld}
            toggles={{
              home: settings.showHomeArrow,
              homeTower: settings.showHomeTowerArrow,
              majorDungeons: settings.showMajorDungeonArrows,
              dungeonWaypoints: settings.dungeonWaypoints,
            }}
          />

          {/* Targeting mode indicator */}
          {targetingMove && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-card/95 backdrop-blur-sm border border-accent/50 rounded-lg px-4 py-2 flex items-center gap-3 z-20">
              <span className="text-accent animate-pulse">🎯</span>
              <span className="text-sm font-medium">Targeting: {targetingMove.name}</span>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={cancelTargeting}>
                Cancel (ESC)
              </Button>
            </div>
          )}
        </div>

        {/* Bottom bar with controls, legend, and game log - resizable */}
        <div className="bg-card border-t-2 border-primary/20 z-40 flex flex-col flex-shrink-0" style={{ height: `${controlsBarHeight}px` }}>
          {/* Resize handle */}
          <div 
            className="w-full h-3 flex items-center justify-center cursor-row-resize hover:bg-primary/10 active:bg-primary/20 flex-shrink-0 touch-none"
            onMouseDown={handleBarResizeStart}
            onTouchStart={handleBarResizeStart}
          >
            <div className="w-12 h-1 rounded-full bg-border" />
          </div>
          <div className="flex-1 min-h-0 px-3 pb-3">
          <div className="flex flex-col h-full gap-2">
            {/* Top row: Controls and info */}
            <div className="flex justify-center items-center flex-shrink-0">
              {/* Mobile info strip — d-pad removed; tap a tile to move */}
              <div className="flex sm:hidden items-center justify-between gap-2 w-full text-[10px] text-muted-foreground">
                <span className="truncate">🗺️ ({overworld.playerPosition.x}, {overworld.playerPosition.y}, z{overworld.playerPosition.z ?? 0}) • 🪵 {overworld.woodCollected} • 🪨 {overworld.stoneCollected}</span>
                <div className="flex gap-2 flex-shrink-0">
                  <button className="text-primary hover:underline" onClick={() => setShowBuildPanel(true)}>🏗️ Build</button>
                  <button
                    className="text-primary hover:underline disabled:opacity-50"
                    onClick={handleManualSave}
                    disabled={syncing}
                  >
                    {syncing ? '⏳' : '💾'}
                  </button>
                </div>
              </div>
              <div className="hidden sm:flex flex-col items-center">
                <p className="text-muted-foreground text-sm text-center mb-1">
                  🗺️ Overworld ({overworld.playerPosition.x} / {overworld.playerPosition.y} / z{overworld.playerPosition.z ?? 0}) • {baseInfo.emoji} {baseInfo.label} • 🪵 {overworld.woodCollected} • 🪨 {overworld.stoneCollected}
                  {isCreativeMode() && <span className="ml-2 px-1.5 py-0.5 rounded bg-primary/20 text-primary text-[10px] font-bold uppercase tracking-wider">🛠️ Creative</span>}
                </p>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground justify-center">
                  <span>🌲 Wood</span>
                  <span>🪨 Stone</span>
                  <span>🏠 Building</span>
                  <span>🗼 Dungeon</span>
                  <span>Right-click enemy to attack</span>
                  <button className="text-primary hover:underline" onClick={() => setShowBuildPanel(true)}>[B] Build</button>
                  <button
                    className="text-primary hover:underline disabled:opacity-50"
                    onClick={handleManualSave}
                    disabled={syncing}
                    title={isAuthenticated ? 'Save progress to cloud' : 'Save progress locally'}
                  >
                    {syncing ? '⏳ Saving…' : `💾 Save${isAuthenticated ? '' : ' (local)'}`}
                  </button>
                </div>
              </div>
            </div>

            {/* Log + open menu panel sit side-by-side at every breakpoint so
                mobile players can see the map (above), log, and the open
                attack/inventory panel without scrolling between them. */}
            <div className="flex-1 min-h-0 flex flex-row gap-2">
              <div className={`${menuOpen ? 'w-1/3 sm:w-1/3' : 'w-full'} min-h-0 min-w-0 p-2 sm:p-3 bg-muted/30 rounded-lg border border-border/50 overflow-hidden flex flex-col transition-[width] duration-200`}>
                <div className="flex items-center gap-1 mb-1 sm:mb-2">
                  <ScrollText className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground" />
                  <span className="text-xs sm:text-sm font-semibold text-muted-foreground">Log</span>
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-none space-y-0.5">
                  {[...gameLog].reverse().slice(0, 20).map((msg, i) => (
                    <p key={msg.id} className={`text-xs sm:text-sm ${i === 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                      {msg.text}
                    </p>
                  ))}
                  {gameLog.length === 0 && (
                    <p className="text-xs sm:text-sm text-muted-foreground italic">No events yet...</p>
                  )}
                </div>
              </div>

              {menuOpen && (
                <div
                  id="overworld-bottom-panel-host"
                  className="min-h-0 flex-1 sm:w-2/3 rounded-lg border border-border/50 bg-muted/30 overflow-hidden"
                />
              )}
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
    
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
              <Button size="sm" disabled={!canUpgrade} onClick={handleUpgrade} className="w-full">
                {canUpgrade ? `Upgrade to ${upgradeInfo?.label}` : 'Not enough resources'}
              </Button>
            </div>
          )}
          {(overworld.homeBase.buildingType === 'log_cabin' || overworld.homeBase.buildingType === 'town_hall') && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => { setShowBuildingMenu(false); handleReturnToMainMenu(); }}>
                🏪 Town Hub
              </Button>
              <Button variant="outline" size="sm" className="flex-1" onClick={() => { setShowBuildingMenu(false); setShowBuildPanel(true); }}>
                🏗️ Build
              </Button>
            </div>
          )}
          {overworld.homeBase.buildingType === 'town_hall' && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => { setShowBuildingMenu(false); setTownHallCraftBuildings(true); }}
            >
              🏛️ Craft Building Kits (with bonus stats)
            </Button>
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
          <h2 className="text-lg font-bold">
            🗼 {selectedDungeon?.name || 'Dungeon Entrance'}
          </h2>
          {selectedDungeon && (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                Starting Lv. <span className="font-semibold text-foreground">{selectedDungeon.difficulty}</span>
                {' · '}Floors <span className="font-semibold text-foreground">∞</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Best floor:{' '}
                <span className="font-semibold text-foreground">
                  {selectedDungeon.deepestFloor > 0 ? selectedDungeon.deepestFloor : '—'}
                </span>
              </p>
              {selectedDungeon.element && (
                <p className="text-sm text-muted-foreground">
                  Attuned: <span className="font-semibold text-foreground capitalize">{selectedDungeon.element}</span>
                </p>
              )}
            </div>
          )}
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

    <ItemWorldTowerPicker
      open={pendingItemWorldEntrance !== null}
      towerType={pendingItemWorldEntrance ? getItemWorldTowerType(pendingItemWorldEntrance.id) : null}
      onCancel={() => setPendingItemWorldEntrance(null)}
      onConfirmed={() => {
        const entrance = pendingItemWorldEntrance;
        setPendingItemWorldEntrance(null);
        if (!entrance) return;
        localStorage.setItem('menagerie_active_dungeon_id', entrance.id);
        dispatch({ type: 'SNAPSHOT_RUN_PROGRESS', overworld });
        localStorage.setItem('menagerie_run_destination', 'dungeon');
        localStorage.setItem('menagerie_run_origin', 'overworld');
        dispatch({ type: 'SET_PHASE', phase: 'character_select' });
      }}
    />

    
    {/* Build Panel */}
    {showBuildPanel && (
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={() => { setShowBuildPanel(false); setBuildMode(false); setSelectedBuildType(null); setRoadBuildMode(false); setSelectedRoadType(null); }}
      >
        <Card
          className="p-6 max-w-lg w-full space-y-4 max-h-[80vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center gap-2">
            <h2 className="text-lg font-bold">🏗️ Build & Roads</h2>
            <div className="flex items-center gap-2">
              <div className="text-sm text-muted-foreground">
                🪵 {overworld.woodCollected} • 🪨 {overworld.stoneCollected}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => { setShowBuildPanel(false); setBuildMode(false); setSelectedBuildType(null); setRoadBuildMode(false); setSelectedRoadType(null); }}
                aria-label="Close build menu"
              >
                ✕
              </Button>
            </div>
          </div>

          {/* Roads Section */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">🛤️ Roads</h3>
            <p className="text-xs text-muted-foreground">Roads reduce enemy spawns and stone roads grant bonus movement speed.</p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(ROAD_DEFINITIONS) as [RoadType, typeof ROAD_DEFINITIONS[RoadType]][]).map(([type, def]) => {
                const canAfford = overworld.woodCollected >= def.cost.wood && overworld.stoneCollected >= def.cost.stone;
                return (
                  <button
                    key={type}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      canAfford ? 'border-border hover:border-primary/50' : 'border-border opacity-50'
                    }`}
                    onClick={() => {
                      if (!canAfford) { toast.error('Not enough resources!'); return; }
                      setSelectedRoadType(type);
                      setRoadBuildMode(true);
                      setBuildMode(false);
                      setSelectedBuildType(null);
                      setShowBuildPanel(false);
                      addLog(`🛤️ Road mode: ${def.name}. Click grass tiles to place. Press ESC to cancel.`, 'system');
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{def.emoji}</span>
                      <span className="text-sm font-medium">{def.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">{def.description}</p>
                    <p className="text-xs">
                      {def.cost.wood > 0 && `🪵 ${def.cost.wood} `}{def.cost.stone > 0 && `🪨 ${def.cost.stone}`}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Structures Section */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">🏗️ Structures</h3>
            <p className="text-xs text-muted-foreground">
              {buildMode ? `Click a tile to place ${BUILDING_DEFINITIONS[selectedBuildType!]?.name}. Press ESC to cancel.` : 'Select a structure to place.'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.values(BUILDING_DEFINITIONS) as typeof BUILDING_DEFINITIONS[PlayerBuildingType][]).map(def => {
                const canAfford = overworld.woodCollected >= def.cost.wood && overworld.stoneCollected >= def.cost.stone;
                const isSelected = buildMode && selectedBuildType === def.type;
                return (
                  <button
                    key={def.type}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      isSelected ? 'border-primary bg-primary/10' : canAfford ? 'border-border hover:border-primary/50' : 'border-border opacity-50'
                    }`}
                    onClick={() => {
                      if (!canAfford) { toast.error('Not enough resources!'); return; }
                      setSelectedBuildType(def.type);
                      setBuildMode(true);
                      setRoadBuildMode(false);
                      setSelectedRoadType(null);
                      setShowBuildPanel(false);
                      addLog(`🏗️ Build mode: ${def.name}. Click a grass tile to place.`, 'system');
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{def.emoji}</span>
                      <span className="text-sm font-medium">{def.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">{def.description}</p>
                    <p className="text-xs">
                      🪵 {def.cost.wood} 🪨 {def.cost.stone}
                      {def.requiresMonster && ' • 🐾 Assign monster'}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
          <Button variant="ghost" className="w-full" onClick={() => { setShowBuildPanel(false); setBuildMode(false); setSelectedBuildType(null); setRoadBuildMode(false); setSelectedRoadType(null); }}>
            Close
          </Button>
        </Card>
      </div>
    )}
    
    {/* Build mode indicator */}
    {buildMode && !showBuildPanel && (
      <div className="fixed top-2 left-1/2 -translate-x-1/2 bg-card/95 backdrop-blur-sm border border-primary/50 rounded-lg px-4 py-2 flex items-center gap-3 z-20">
        <span className="text-primary animate-pulse">🏗️</span>
        <span className="text-sm font-medium">Building: {BUILDING_DEFINITIONS[selectedBuildType!]?.name}</span>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => { setBuildMode(false); setSelectedBuildType(null); }}>
          Cancel (ESC)
        </Button>
      </div>
    )}

    {/* Road build mode indicator */}
    {roadBuildMode && !showBuildPanel && (
      <div className="fixed top-2 left-1/2 -translate-x-1/2 bg-card/95 backdrop-blur-sm border border-primary/50 rounded-lg px-4 py-2 flex items-center gap-3 z-20">
        <span className="text-primary animate-pulse">🛤️</span>
        <span className="text-sm font-medium">Placing: {selectedRoadType ? ROAD_DEFINITIONS[selectedRoadType].name : 'Road'}</span>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => { setRoadBuildMode(false); setSelectedRoadType(null); }}>
          Cancel (ESC)
        </Button>
      </div>
    )}
    
    {/* Monster Assignment Modal */}
    {assignBuilding && state.run && (
      <BuildingAssignModal
        building={assignBuilding}
        party={state.run.party}
        activePartyIndex={state.run.activePartyIndex}
        assignedMonsterIds={assignedMonsterIds}
        onAssign={handleAssignMonster}
        onUnassign={handleUnassignMonster}
        onClose={() => setAssignBuilding(null)}
      />
    )}
    
    {/* Building Right-Click Context Menu */}
    {contextMenuBuilding && state.run && (
      <BuildingContextMenu
        building={contextMenuBuilding}
        party={state.run.party}
        woodAvailable={overworld.woodCollected}
        stoneAvailable={overworld.stoneCollected}
        isGate={contextMenuBuilding.type === 'wall' && isWallActingAsGate(contextMenuBuilding, overworld)}
        onAssign={handleContextMenuAssign}
        onRepair={handleRepairBuilding}
        onDisassemble={handleDisassembleBuilding}
        onFlipGate={handleFlipGate}
        onRotateConnector={handleRotateConnector}
        onConfigureStation={() => {
          setStationConfigBuilding(contextMenuBuilding);
          setContextMenuBuilding(null);
        }}
        onOpenStationWorkshop={() => {
          setWorkshopStationBuilding(contextMenuBuilding);
          setContextMenuBuilding(null);
        }}
        onOpenArena={() => { setArenaHubOpen(true); setContextMenuBuilding(null); }}
        onClose={() => setContextMenuBuilding(null)}
      />
    )}

    {arenaHubOpen && <ArenaHub onClose={() => setArenaHubOpen(false)} />}


    {/* ─── Unified Tile Menu (right-click on PC, long-press on touch) ───
        One menu, every tile. Reads the tile and builds an action list
        on the fly so the same shell works for grass, water, road,
        dungeons, enemies, buildings, nests, trees, rocks, etc. */}
    {unifiedMenu && (() => {
      const tile = getOverworldTile(overworld, unifiedMenu.x, unifiedMenu.y);
      const close = () => setUnifiedMenu(null);
      const px = overworld.playerPosition.x;
      const py = overworld.playerPosition.y;
      const dist = Math.abs(unifiedMenu.x - px) + Math.abs(unifiedMenu.y - py);
      const isAdjacent = dist === 1;

      // Build everything for the menu
      let title = '🍃 Unknown tile';
      let subtitle: string | undefined;
      const info: UnifiedTileInfo[] = [];
      let creature: UnifiedTileCreature | undefined;
      const actions: UnifiedTileAction[] = [];
      let footnote: string | undefined;

      // Helper: nearest visible enemy/nest within range 6 of this tile,
      // shared by the "Attack from here" affordance on plain tiles.
      const findNearestAttackTarget = (): EnemyAttackTarget | null => {
        if (!monster) return null;
        let best: EnemyAttackTarget | null = null;
        let bestD = Infinity;
        const R = 6;
        for (let dy = -R; dy <= R; dy++) {
          for (let dx = -R; dx <= R; dx++) {
            const tx = unifiedMenu.x + dx;
            const ty = unifiedMenu.y + dy;
            const t = getOverworldTile(overworld, tx, ty);
            if (!t || !t.visible) continue;
            const d = Math.abs(dx) + Math.abs(dy);
            if (d > R || d >= bestD) continue;
            if (t.type === 'enemy' && t.enemyId) {
              const e = getOverworldEnemy(overworld, t.enemyId);
              if (e) { best = { enemy: e, enemyPos: { x: tx, y: ty }, playerPos: overworld.playerPosition }; bestD = d; }
            } else if (t.type === 'nest' && t.nestId && monster) {
              const nest = overworld.nests?.[t.nestId];
              if (nest) {
                const nestAsMonster: Monster = {
                  ...monster, id: nest.id,
                  name: `${nest.element[0].toUpperCase()}${nest.element.slice(1)} Nest`,
                  element: nest.element, level: nest.level,
                  stats: { ...monster.stats, currentHp: nest.hp, maxHp: nest.maxHp },
                };
                best = { enemy: nestAsMonster, enemyPos: { x: tx, y: ty }, playerPos: overworld.playerPosition };
                bestD = d;
              }
            }
          }
        }
        return best;
      };

      // ── Per-tile-type setup ──
      if (!tile) {
        title = '🌫 Unexplored';
        info.push({ label: 'Status', value: 'Not yet seen' });
      } else if (tile.type === 'dungeon_entrance' && tile.dungeonId) {
        const entrance = overworld.dungeonEntrances?.[tile.dungeonId];
        const name = entrance?.name || `Dungeon (${unifiedMenu.x},${unifiedMenu.y})`;
        title = `🏰 ${name}`;
        subtitle = `Start F${entrance?.difficulty || 1}${entrance && entrance.deepestFloor > 0 ? ` · Best F${entrance.deepestFloor}` : ''}`;
        if (entrance?.category && entrance.category !== 'procedural') {
          info.push({ label: 'Tower', value: entrance.category });
        }
        const pinned = !!(entrance && settings.dungeonWaypoints?.[entrance.id]);
        if (entrance) {
          actions.push({
            id: 'enter', label: 'Enter dungeon', icon: DoorOpen, variant: 'default',
            onClick: () => { close(); setSelectedDungeon(entrance); setShowDungeonPrompt(true); },
          });
          actions.push({
            id: 'waypoint', label: pinned ? 'Hide waypoint arrow' : 'Show waypoint arrow',
            icon: pinned ? FlagOff : Flag,
            onClick: () => {
              const id = entrance.id;
              const cur = { ...(settings.dungeonWaypoints || {}) };
              if (cur[id]) { delete cur[id]; toast.info(`Waypoint hidden: ${entrance.name || 'dungeon'}`); }
              else { cur[id] = true; toast.success(`Waypoint pinned: ${entrance.name || 'dungeon'}`); }
              updateSetting('dungeonWaypoints', cur);
              close();
            },
          });
          footnote = entrance.category && entrance.category !== 'procedural'
            ? 'Major towers also have a global toggle in Settings → Overworld Arrows.'
            : 'Pinned waypoints show an edge-of-screen arrow.';
        }
      } else if (tile.type === 'player_building' && tile.playerBuildingId) {
        const b = overworld.playerBuildings?.find(pb => pb.id === tile.playerBuildingId);
        if (b) {
          const def = BUILDING_DEFINITIONS[b.type];
          title = `🏚 ${def?.name || b.type}`;
          subtitle = b.assignedMonsterId ? 'Staffed' : 'Unstaffed';
          info.push({ label: 'Health', value: `${b.hp ?? '?'} / ${b.maxHp ?? '?'}` });
          if (b.type === 'farm' && b.harvestReady) info.push({ label: 'Status', value: 'Ready to harvest' });
          actions.push({
            id: 'open-building', label: 'Building options…',
            hint: 'Assign / repair / disassemble',
            icon: Wrench, variant: 'default',
            onClick: () => { close(); setContextMenuBuilding(b); },
          });
        }
      } else if (tile.type === 'enemy' && tile.enemyId) {
        const enemy = getOverworldEnemy(overworld, tile.enemyId);
        if (enemy) {
          title = `⚔ ${enemy.name}`;
          subtitle = `Hostile creature`;
          creature = {
            name: enemy.name, level: enemy.level, element: enemy.element,
            klass: (enemy as any).class,
            hp: enemy.stats.currentHp, maxHp: enemy.stats.maxHp,
          };
          if (monster) {
            actions.push({
              id: 'attack', label: 'Pick a move to attack', icon: Swords, variant: 'default',
              onClick: () => {
                close();
                setAttackMenuTarget({ enemy, enemyPos: { x: unifiedMenu.x, y: unifiedMenu.y }, playerPos: overworld.playerPosition });
              },
            });
            const enemyClass = (enemy as any).class;
            if (enemyClass && state.run?.party) {
              const swap = findBestMatchupSwap(
                state.run.party,
                state.run.activePartyIndex ?? 0,
                enemy.element,
                enemyClass,
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
          }
        }
      } else if (tile.type === 'nest' && tile.nestId) {
        const nest = overworld.nests?.[tile.nestId];
        if (nest) {
          title = `🪺 ${nest.element[0].toUpperCase()}${nest.element.slice(1)} Nest`;
          subtitle = `Spawner — Lv ${nest.level}`;
          creature = {
            name: `${nest.element[0].toUpperCase()}${nest.element.slice(1)} Nest`,
            level: nest.level, element: nest.element,
            hp: nest.hp, maxHp: nest.maxHp,
          };
          if (monster) {
            const nestAsMonster: Monster = {
              ...monster, id: nest.id,
              name: `${nest.element[0].toUpperCase()}${nest.element.slice(1)} Nest`,
              element: nest.element, level: nest.level,
              stats: { ...monster.stats, currentHp: nest.hp, maxHp: nest.maxHp },
            };
            actions.push({
              id: 'attack-nest', label: 'Pick a move to attack', icon: Swords, variant: 'default',
              onClick: () => {
                close();
                setAttackMenuTarget({ enemy: nestAsMonster, enemyPos: { x: unifiedMenu.x, y: unifiedMenu.y }, playerPos: overworld.playerPosition });
              },
            });
          }
        }
      } else if (tile.type === 'building') {
        // Home base / town hub (campfire → log cabin → town hall).
        const hub = BUILDING_UPGRADES[(tile.buildingType as keyof typeof BUILDING_UPGRADES) || overworld.homeBase.buildingType];
        title = `${hub.emoji} ${hub.label}`;
        subtitle = 'Home base hub';
        if (hub.features?.length) {
          info.push({ label: 'Features', value: hub.features.join(' · ') });
        }
        if (hub.next && hub.upgradeCost) {
          info.push({ label: 'Upgrade', value: `→ ${BUILDING_UPGRADES[hub.next].label} (🪵${hub.upgradeCost.wood} 🪨${hub.upgradeCost.stone})` });
        }
        actions.push({
          id: 'open-hub',
          label: 'Use building',
          hint: 'Open hub menu (upgrade, shop, build)',
          icon: Home, variant: 'default',
          onClick: () => { close(); setShowBuildingMenu(true); },
        });
      } else if (tile.type === 'water') {
        const COST_WOOD = 2, COST_STONE = 5;
        title = '💧 Water';
        subtitle = 'Impassable';
        info.push({ label: 'Wood', value: `${overworld.woodCollected} / ${COST_WOOD}` });
        info.push({ label: 'Stone', value: `${overworld.stoneCollected} / ${COST_STONE}` });
        const canFill = overworld.woodCollected >= COST_WOOD && overworld.stoneCollected >= COST_STONE;
        actions.push({
          id: 'fill-water', label: `Fill with grass (🪵${COST_WOOD} 🪨${COST_STONE})`,
          icon: Droplet, variant: 'default',
          disabled: !canFill,
          disabledReason: 'Not enough resources',
          onClick: () => {
            const { x, y } = unifiedMenu;
            setOverworld(prev => {
              const newOw = JSON.parse(JSON.stringify(prev)) as OverworldState;
              const t = getOverworldTile(newOw, x, y);
              if (!t || t.type !== 'water') { toast.error('Tile is no longer water.'); return prev; }
              if (newOw.woodCollected < COST_WOOD || newOw.stoneCollected < COST_STONE) { toast.error('Not enough resources!'); return prev; }
              newOw.woodCollected -= COST_WOOD;
              newOw.stoneCollected -= COST_STONE;
              setOverworldTile(newOw, x, y, { type: 'grass', explored: true, visible: true, harvested: true });
              addLog(`🌱 Filled water at (${x},${y}) with grass. (-${COST_WOOD}🪵 -${COST_STONE}🪨)`, 'system');
              toast.success('Water filled in!');
              saveOverworld(newOw);
              return newOw;
            });
            close();
          },
        });
      } else if (tile.type === 'dirt_road' || tile.type === 'stone_road') {
        const roadType = tile.type;
        const def = ROAD_DEFINITIONS[roadType];
        const refund = getRoadRefund(roadType);
        title = `🛤 ${def?.name || 'Road'}`;
        subtitle = roadType === 'stone_road' ? 'Stone — bonus step every other tile' : 'Dirt — slight speed bonus';
        info.push({ label: 'Refund on remove', value: `🪵${refund.wood} 🪨${refund.stone}` });
        // Roads are walkable, so include the standard move/attack rows.
        const nt = findNearestAttackTarget();
        if (isAdjacent) actions.push({
          id: 'move', label: 'Move here', icon: Footprints,
          onClick: () => { const dx = unifiedMenu.x - px, dy = unifiedMenu.y - py; close(); handleMove(dx, dy); },
        });
        if (nt) actions.push({
          id: 'attack-from', label: 'Attack from here', icon: Swords,
          hint: `${nt.enemy.name} in range`,
          onClick: () => { close(); setAttackMenuTarget(nt); },
        });
        actions.push({
          id: 'remove-road', label: 'Disassemble road', icon: Trash2, variant: 'destructive',
          hint: `Recovers 🪵${refund.wood} 🪨${refund.stone}`,
          onClick: () => {
            const { x, y } = unifiedMenu;
            setOverworld(prev => {
              const newOw = JSON.parse(JSON.stringify(prev)) as OverworldState;
              if (!removeRoad(newOw, x, y)) { toast.error('No road to disassemble here.'); return prev; }
              addLog(`♻️ Disassembled ${def.name} at (${x},${y}). Recovered 🪵${refund.wood} 🪨${refund.stone}.`, 'loot');
              toast.success(`Road removed! +🪵${refund.wood} +🪨${refund.stone}`);
              saveOverworld(newOw);
              return newOw;
            });
            close();
          },
        });
      } else if (tile.type === 'tree' || tile.type === 'rock' || tile.type === 'plant') {
        const isTree = tile.type === 'tree';
        const isRock = tile.type === 'rock';
        const isPlant = tile.type === 'plant';
        const variantLabel = isPlant
          ? (tile.plantVariant === 'mushroom' ? 'Mushroom' : tile.plantVariant === 'flower' ? 'Flower' : tile.plantVariant === 'root' ? 'Root' : 'Herb')
          : '';
        title = isTree ? '🌳 Tree' : isRock ? '🪨 Rock' : `🌿 ${variantLabel}`;
        subtitle = isTree ? 'Step onto it to chop for wood'
          : isRock ? 'Step onto it to mine for stone'
          : 'Step onto it to gather herbs';
        if (isTree) {
          const tier = (tile as any).treeTier as TreeTier | undefined;
          if (tier && TREE_TIER_DATA[tier]) info.push({ label: 'Tier', value: TREE_TIER_DATA[tier].name });
        } else if (isRock) {
          const tier = (tile as any).stoneTier as StoneTier | undefined;
          if (tier && STONE_TIER_DATA[tier]) info.push({ label: 'Tier', value: STONE_TIER_DATA[tier].name });
        } else if (isPlant) {
          const t = tile.plantTier || 1;
          info.push({ label: 'Rarity', value: t === 3 ? 'Rare' : t === 2 ? 'Uncommon' : 'Common' });
        }

        const autoOn = !!settings.autoMine;
        const tx = unifiedMenu.x, ty = unifiedMenu.y;
        const verbLabel = isTree ? 'Chop' : isRock ? 'Mine' : 'Gather';
        const label = autoOn
          ? `Auto-${verbLabel} until done/attacked`
          : (isAdjacent
              ? `${verbLabel} (one action)`
              : `Walk here & ${verbLabel.toLowerCase()}`);

        // Walk-then-swing helper: finds the nearest walkable neighbour of the
        // target tile, auto-walks there, then either kicks off Auto-Mine (when
        // enabled) or takes the one-step swing.
        const walkThenAct = () => {
          const ow = overworldRef.current;
          if (!ow) return;
          const offsets: Array<[number, number]> = [[0, -1], [0, 1], [-1, 0], [1, 0]];
          let best: Position[] | null = null;
          for (const [ox, oy] of offsets) {
            const ax = tx + ox, ay = ty + oy;
            if (ax === ow.playerPosition.x && ay === ow.playerPosition.y) {
              if (autoOn) startAutoMine(tx, ty);
              else handleMove(tx - ow.playerPosition.x, ty - ow.playerPosition.y);
              return;
            }
            const p = findOverworldPath(ow, ow.playerPosition, { x: ax, y: ay }, 8000, { avoidStructures: true });
            if (p && p.length > 0 && (!best || p.length < best.length)) best = p;
          }
          if (!best) {
            toast.error("Can't reach that tile.");
            return;
          }
          startAutoWalk(best, () => {
            const now = overworldRef.current;
            if (!now) return;
            if (autoOn) startAutoMine(tx, ty);
            else handleMove(tx - now.playerPosition.x, ty - now.playerPosition.y);
          });
        };

        actions.push({
          id: isTree ? 'chop' : isRock ? 'mine' : 'gather',
          label,
          icon: isTree ? TreePine : isRock ? Pickaxe : Sparkles,
          variant: 'default',
          hint: autoOn
            ? 'Halts on enemy spotted, exhaustion, or Space'
            : (!isAdjacent ? 'Auto-paths adjacent, then acts' : undefined),
          onClick: () => {
            close();
            if (isAdjacent) {
              if (autoOn) startAutoMine(tx, ty);
              else handleMove(tx - px, ty - py);
            } else {
              walkThenAct();
            }
          },
        });
        actions.push({
          id: 'toggle-auto-harvest',
          label: autoOn ? 'Disable Auto-Harvest' : 'Enable Auto-Harvest',
          icon: isTree ? TreePine : isRock ? Pickaxe : Sparkles,
          variant: 'outline',
          hint: 'Applies to all harvestables; persisted in Settings',
          onClick: () => {
            updateSetting('autoMine', !autoOn);
            toast.info(`Auto-Harvest ${!autoOn ? 'enabled' : 'disabled'}`);
          },
        });




      } else if (tile.type === 'cliff' || tile.type === 'waterfall') {
        title = tile.type === 'cliff' ? '⛰ Cliff' : '🌊 Waterfall';
        subtitle = 'Impassable terrain';
      } else if (tile.type === 'grass') {
        const harvested = !!tile.harvested;
        title = harvested ? '🟫 Bare ground' : '🍃 Open ground';
        subtitle = harvested ? 'Dirt — can be built on' : 'Grass — can be built on';
        const nt = findNearestAttackTarget();
        if (isAdjacent) actions.push({
          id: 'move', label: 'Move here', icon: Footprints,
          onClick: () => { const dx = unifiedMenu.x - px, dy = unifiedMenu.y - py; close(); handleMove(dx, dy); },
        });
        actions.push({
          id: 'attack-from', label: 'Attack from here', icon: Swords,
          hint: nt ? `${nt.enemy.name} in range` : undefined,
          disabled: !nt || !monster,
          disabledReason: 'No target in range of this tile',
          onClick: () => { if (nt) { close(); setAttackMenuTarget(nt); } },
        });
        actions.push({
          id: 'build', label: 'Build here', icon: Hammer,
          onClick: () => { close(); setShowBuildPanel(true); },
        });
        actions.push({
          id: 'auto-shovel', label: autoShovelOn ? 'Disable Auto-Shovel' : 'Enable Auto-Shovel',
          icon: Shovel, variant: 'outline',
          hint: 'Session-only; auto-digs runes as you walk',
          onClick: () => {
            const next = toggleAutoShovel();
            toast.info(`Auto-Shovel ${next ? 'enabled' : 'disabled'}`);
          },
        });
      } else {
        title = `Tile (${tile.type})`;
      }

      // ── Universal movement / attack / build affordances ───────────────
      // Long-press / right-click should always surface every reasonable
      // action for a tile, not just "Drop waypoint". For any explored
      // tile we add: pathfind "Walk here", "Attack from here" if a
      // target is in range, and "Build here" on buildable ground.
      if (tile && tile.explored) {
        const hasId = (id: string) => actions.some(a => a.id === id);

        // Adjacent universal "Move here" — every tile type should offer a
        // direct step affordance, not just grass/roads. Bumping into a tree
        // / rock / enemy / building lets movePlayer handle the interaction.
        if (!hasId('move') && isAdjacent) {
          actions.push({
            id: 'move',
            label: 'Move here',
            icon: Footprints,
            onClick: () => { const dx = unifiedMenu.x - px, dy = unifiedMenu.y - py; close(); handleMove(dx, dy); },
          });
        }

        // Walk here via A* (skip if already adjacent — that branch gets
        // its own "Move here" step action above). Falls back to pathing to
        // an adjacent walkable tile when the goal itself is non-walkable.
        if (!hasId('path-here') && !isAdjacent && dist > 0) {
          let path = findOverworldPath(overworld, overworld.playerPosition, { x: unifiedMenu.x, y: unifiedMenu.y });
          if (!path || path.length === 0) {
            // Try adjacent tiles for non-walkable interactables.
            const offsets = [ [0, -1], [0, 1], [-1, 0], [1, 0] ];
            for (const [ox, oy] of offsets) {
              const p = findOverworldPath(overworld, overworld.playerPosition, { x: unifiedMenu.x + ox, y: unifiedMenu.y + oy });
              if (p && p.length > 0 && (!path || p.length < path.length)) path = p;
            }
          }
          if (path && path.length > 0) {
            const finalPath = path;
            actions.push({
              id: 'path-here',
              label: `Walk here (${finalPath.length} step${finalPath.length === 1 ? '' : 's'})`,
              icon: Footprints,
              hint: 'Auto-walks along the shortest path',
              onClick: () => {
                close();
                startAutoWalk(finalPath);
              },
            });
          }
        }

        // Attack from here — only if nothing already attached an attack action.
        if (!hasId('attack') && !hasId('attack-nest') && !hasId('attack-from') && monster) {
          const nt = findNearestAttackTarget();
          if (nt) {
            actions.push({
              id: 'attack-from',
              label: 'Attack from here',
              icon: Swords,
              hint: `${nt.enemy.name} in range`,
              onClick: () => { close(); setAttackMenuTarget(nt); },
            });
          }
        }

        // Build here — only on buildable ground types.
        if (!hasId('build') && (tile.type === 'grass' || tile.type === 'dirt_road' || tile.type === 'stone_road')) {
          actions.push({
            id: 'build',
            label: 'Build here',
            icon: Hammer,
            onClick: () => { close(); setShowBuildPanel(true); },
          });
        }
      }

      // ── Self-tile actions (caster buffs + consumables) ─────────────────
      // Project knowledge: "On Self choose actions that buff self or
      // movement actions." Surface self-targeting moves and any usable
      // consumables when right-clicking your own tile.
      if (dist === 0 && monster) {
        const consumables = (state.run?.inventory || []).filter(
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
        const selfMoves = getMonsterMoves(monster.species, monster.element, monster.class, monster.level).filter(
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
              const validTargets = getOverworldValidTargets(overworld.playerPosition, config, overworld);
              setTargetingMove(mv);
              setTargetingTiles(validTargets);
              setAffectedTiles([]);
              setHoveredTile(null);
              setTimeout(() => handleTargetingClick(overworld.playerPosition.x, overworld.playerPosition.y), 0);
            },
          });
        }
      }



      // ── Universal: Drop / Remove / Rename waypoint ─────────────────────
      // Dungeon-entrance tiles already have their own pin toggle above; skip
      // those to avoid duplicating the action. Allow on every other explored
      // tile (including water/cliff/etc) — players use these to mark places
      // they want to find again.
      if (tile && tile.explored && tile.type !== 'dungeon_entrance') {
        const wps = overworld.waypoints || [];
        const existingIdx = wps.findIndex(w => w.x === unifiedMenu.x && w.y === unifiedMenu.y);
        const existing = existingIdx >= 0 ? wps[existingIdx] : null;
        const isPinned = !!existing;
        actions.push({
          id: 'tile-waypoint',
          label: isPinned
            ? `Remove waypoint${existing?.name ? ` "${existing.name}"` : ''}`
            : 'Drop waypoint',
          icon: isPinned ? FlagOff : Flag,
          onClick: () => {
            const { x, y } = unifiedMenu;
            setOverworld(prev => {
              const list = prev.waypoints ? [...prev.waypoints] : [];
              const i = list.findIndex(w => w.x === x && w.y === y);
              if (i >= 0) list.splice(i, 1);
              else list.push({ x, y });
              const next = { ...prev, waypoints: list };
              saveOverworld(next);
              return next;
            });
            addLog(
              isPinned
                ? `📍 Waypoint removed at (${unifiedMenu.x}, ${unifiedMenu.y})`
                : `📍 Waypoint dropped at (${unifiedMenu.x}, ${unifiedMenu.y})`,
              'system',
            );
            close();
          },
        });
        if (isPinned) {
          actions.push({
            id: 'rename-tile-waypoint',
            label: 'Rename waypoint…',
            icon: Flag,
            onClick: () => {
              const { x, y } = unifiedMenu;
              const current = existing?.name || '';
              const next = window.prompt('Waypoint name (leave blank to clear):', current);
              if (next === null) return;
              const trimmed = next.trim().slice(0, 32);
              setOverworld(prev => {
                const list = (prev.waypoints || []).map(w =>
                  w.x === x && w.y === y ? { ...w, name: trimmed || undefined } : w,
                );
                const updated = { ...prev, waypoints: list };
                saveOverworld(updated);
                return updated;
              });
              addLog(
                trimmed
                  ? `📍 Waypoint renamed to "${trimmed}"`
                  : `📍 Waypoint name cleared`,
                'system',
              );
              close();
            },
          });
        }
        if (!footnote) footnote = 'Pinned waypoints show an edge-of-screen arrow.';
      }


      // ── Global auto-action shortcuts (available from every tile menu) ──
      // These don't act on the tapped tile — they start map-wide auto jobs.
      // Kept at the bottom so per-tile actions stay on top.
      actions.push({
        id: 'auto-hunt',
        label: 'Auto-Hunt nearest enemy',
        icon: Crosshair,
        hint: 'Walks to the nearest visible enemy and opens attack (H)',
        onClick: () => { close(); startAutoHunt(); },
      });
      actions.push({
        id: 'auto-search',
        label: 'Auto-Search…',
        icon: Search,
        hint: 'Pick a target type (dungeon, enemy, nest, tree, rock, building) (F)',
        onClick: () => { close(); setAutoSearchPickerOpen(true); },
      });


      return (
        <UnifiedTileMenu
          worldX={unifiedMenu.x}
          worldY={unifiedMenu.y}
          title={title}
          subtitle={subtitle}
          info={info.length > 0 ? info : undefined}
          creature={creature}
          actions={actions}
          footnote={footnote}
          onClose={close}
        />
      );
    })()}

    {attackMenuTarget && monster && (
      <EnemyAttackMenu
        attacker={monster}
        target={attackMenuTarget}
        moveOrder={state.run?.moveOrder || []}
        onClose={() => setAttackMenuTarget(null)}
        onPickMove={(move) => {
          const target = attackMenuTarget;
          setAttackMenuTarget(null);
          // Enter targeting mode with this move, then immediately fire on the
          // saved enemy tile so the right-click feels like a one-step action.
          const config = getAttackConfig(move);
          const validTargets = getOverworldValidTargets(
            overworld.playerPosition,
            config,
            overworld,
          );
          setTargetingMove(move);
          setTargetingTiles(validTargets);
          setAffectedTiles([]);
          setHoveredTile(null);
          setTimeout(() => handleTargetingClick(target.enemyPos.x, target.enemyPos.y), 0);
        }}
      />
    )}
  </>;
}
