// Overworld View - Main overworld exploration component with tactical combat
// Uses the same GameSidebar and bottom bar layout as DungeonView

import { useState, useEffect, useCallback, useRef } from 'react';
import { useGame } from './state';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Position, Monster, MonsterStats, InventoryItem, DungeonEntrance } from './types';
import { 
  createOverworldState, 
  movePlayer, 
  updateVisibility,
  ensureChunksLoaded,
  OverworldState, 
  BUILDING_UPGRADES,
  canUpgradeBase,
  upgradeBase,
  getOverworldEnemy,
  getOverworldTile,
} from './overworld';
import { OverworldRenderer, OverworldRendererHandle } from './OverworldRenderer';
import { GameSidebar } from './GameSidebar';
import { getMonsterMoves, Move, getNewMovesAtLevel } from './moves';
import { getAttackConfig } from './dungeonCombat';
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
import { loadKeybinds, getMonsterKeybinds as getMonsterKeybindsImport } from './keybinds';
import { LogMessage } from './GameLog';
import { ScrollText } from 'lucide-react';
import { toast } from 'sonner';
import { EvolvedMove } from './moveMastery';
import { CombatEffects } from './statusEffects';

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
  const rendererRef = useRef<OverworldRendererHandle>(null);
  
  // Initialize or load overworld state
  const [overworld, setOverworld] = useState<OverworldState>(() => {
    let ow: OverworldState;
    if (state.saveData.overworldState) {
      ow = JSON.parse(JSON.stringify(state.saveData.overworldState));
    } else {
      ow = createOverworldState();
    }
    // Restore saved dungeon entrances
    if (state.saveData.dungeonEntrances) {
      ow.dungeonEntrances = { ...(ow.dungeonEntrances || {}), ...state.saveData.dungeonEntrances };
    }
    if (!ow.dungeonEntrances) ow.dungeonEntrances = {};
    ensureChunksLoaded(ow, ow.playerPosition.x, ow.playerPosition.y);
    updateVisibility(ow);
    return ow;
  });
  
  const [showBuildingMenu, setShowBuildingMenu] = useState(false);
  const [showDungeonPrompt, setShowDungeonPrompt] = useState(false);
  const [selectedDungeon, setSelectedDungeon] = useState<DungeonEntrance | null>(null);
  const [showEquipment, setShowEquipment] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  
  // Targeting state
  const [targetingMove, setTargetingMove] = useState<Move | null>(null);
  const [targetingTiles, setTargetingTiles] = useState<Position[]>([]);
  const [affectedTiles, setAffectedTiles] = useState<Position[]>([]);
  const [hoveredTile, setHoveredTile] = useState<Position | null>(null);
  
  // Level up queue
  const [levelUpQueue, setLevelUpQueue] = useState<LevelUpEntry[]>([]);
  
  // Recruitment
  const [showRecruitment, setShowRecruitment] = useState(false);
  const [defeatedEnemy, setDefeatedEnemy] = useState<Monster | null>(null);
  const [recruitChance, setRecruitChance] = useState(0);
  const [battleStats, setBattleStats] = useState({ turnsUsed: 1, overkillDamage: 0, statusEffectsApplied: 0, criticalHits: 0 });
  
  // Revive modal
  const [showReviveModal, setShowReviveModal] = useState(false);
  const [pendingReviveItem, setPendingReviveItem] = useState<InventoryItem | null>(null);
  
  const monster = state.run?.currentMonster;
  
  // Save overworld state on changes
  const saveOverworld = useCallback((ow: OverworldState) => {
    dispatch({ type: 'UPDATE_OVERWORLD', overworld: { ...ow } });
  }, [dispatch]);

  // ─── Enemy AI processing ───
  const processEnemyTurns = useCallback((ow: OverworldState) => {
    if (!state.run) return;
    
    const enemies = getVisibleOverworldEnemies(ow);
    let playerDamage = 0;
    
    for (const { enemy, pos } of enemies) {
      const action = calculateOverworldEnemyAction(enemy, pos, ow.playerPosition, ow);
      
      if (action.type === 'attack') {
        const attackPower = enemy.stats.attack;
        const playerDef = state.run.currentMonster.stats.defense;
        const damage = Math.max(1, Math.floor(attackPower - playerDef * 0.3));
        playerDamage += damage;
        addLog(`👹 ${enemy.name} attacks for ${damage} damage!`, 'damage');
      } else if (action.type === 'move') {
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
        dispatch({ type: 'END_RUN', victory: false });
        dispatch({ type: 'SET_PHASE', phase: 'run_summary' });
      }
    }
  }, [state.run, dispatch, addLog]);
  
  // ─── Movement ───
  const handleMove = useCallback((dx: number, dy: number) => {
    if (targetingMove) return;
    
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
          break;
        case 'blocked':
          toast.info(result.reason);
          return prev;
        case 'resource':
          addLog(`🪓 Gathered ${result.amount} ${result.resourceType}!`, 'loot');
          toast.success(`+${result.amount} ${result.resourceType === 'wood' ? '🪵' : '🪨'} ${result.resourceType}`);
          break;
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
      }
      
      if (result.type === 'moved' || result.type === 'resource') {
        setTimeout(() => processEnemyTurns(newState), 100);
      }
      
      saveOverworld(newState);
      return newState;
    });
  }, [addLog, saveOverworld, state.run, dispatch, targetingMove, processEnemyTurns]);
  
  // ─── Directional movement wrapper for keyboard ───
  const handleDirectionMove = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    const dx = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
    const dy = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;
    handleMove(dx, dy);
  }, [handleMove]);
  
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
  }, []);
  
  const handleTileHover = useCallback((worldX: number, worldY: number) => {
    if (!targetingMove) return;
    const config = getAttackConfig(targetingMove);
    const tiles = getOverworldAffectedTiles(overworld.playerPosition, { x: worldX, y: worldY }, config);
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
    const affected = getOverworldAffectedTiles(overworld.playerPosition, { x: worldX, y: worldY }, config);
    
    const staminaCost = targetingMove.staminaCost || 0;
    const maxSta = monster.stats.stamina ?? 50;
    const curSta = monster.stats.currentStamina ?? maxSta;
    let newStamina = curSta - staminaCost;
    
    let enemiesHit: { enemy: Monster; pos: Position }[] = [];
    
    setOverworld(prev => {
      const newOw = JSON.parse(JSON.stringify(prev)) as OverworldState;
      
      for (const tile of affected) {
        const owTile = getOverworldTile(newOw, tile.x, tile.y);
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
              setDefeatedEnemy(enemy);
              setRecruitChance(chance);
              setBattleStats({ turnsUsed: 1, overkillDamage: overkill, statusEffectsApplied: 0, criticalHits: 0 });
              setShowRecruitment(true);
              
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
      }
      
      if (enemiesHit.length === 0) {
        addLog(`⚔️ ${targetingMove.name} missed! No enemies in range.`, 'info');
      }
      
      setTimeout(() => processEnemyTurns(newOw), 100);
      
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
    if (targetingMove) {
      handleTargetingClick(worldX, worldY);
      return;
    }
    
    // Click on enemy → auto-select first attack move
    const tile = getOverworldTile(overworld, worldX, worldY);
    if (tile?.type === 'enemy' && tile.enemyId && monster) {
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
          addLog('❌ Enemy out of range! Get closer.', 'info');
          return;
        }
      }
    }
    
    // Normal movement to adjacent tile
    const dx = worldX - overworld.playerPosition.x;
    const dy = worldY - overworld.playerPosition.y;
    if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && (dx !== 0 || dy !== 0)) {
      handleMove(dx, dy);
    }
  }, [overworld, monster, targetingMove, handleTargetingClick, handleMove, addLog]);
  
  // Right-click → auto-attack with first melee/ranged
  const handleTileRightClick = useCallback((worldX: number, worldY: number) => {
    const tile = getOverworldTile(overworld, worldX, worldY);
    if (tile?.type === 'enemy' && tile.enemyId && monster) {
      const moves = getMonsterMoves(monster.species, monster.element, monster.class, monster.level);
      const attackMove = moves.find(m => m.type === 'melee' || m.type === 'ranged');
      if (attackMove) {
        const config = getAttackConfig(attackMove);
        const dist = Math.abs(worldX - overworld.playerPosition.x) + Math.abs(worldY - overworld.playerPosition.y);
        if (dist <= config.range) {
          setTargetingMove(attackMove);
          setTargetingTiles(getOverworldValidTargets(overworld.playerPosition, config, overworld));
          setTimeout(() => handleTargetingClick(worldX, worldY), 0);
        } else {
          toast.info('Enemy out of range!');
        }
      }
    }
  }, [overworld, monster, handleTargetingClick]);
  
  // ─── Keyboard ───
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showBuildingMenu || showDungeonPrompt || showRecruitment || levelUpQueue.length > 0) return;
      
      if (e.key === 'Escape' && targetingMove) {
        cancelTargeting();
        addLog('❌ Attack cancelled.', 'info');
        return;
      }
      
      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W':
          e.preventDefault(); handleMove(0, -1); break;
        case 'ArrowDown': case 's': case 'S':
          e.preventDefault(); handleMove(0, 1); break;
        case 'ArrowLeft': case 'a': case 'A':
          e.preventDefault(); handleMove(-1, 0); break;
        case 'ArrowRight': case 'd': case 'D':
          e.preventDefault(); handleMove(1, 0); break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleMove, showBuildingMenu, showDungeonPrompt, showRecruitment, targetingMove, cancelTargeting, levelUpQueue.length]);
  
  // Keybind shortcuts for moves
  const keybindDataRef = useRef(loadKeybinds());
  useEffect(() => { keybindDataRef.current = loadKeybinds(); });
  
  useEffect(() => {
    if (!monster) return;
    const handleKeybindPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.shiftKey || targetingMove) return;
      
      const key = e.key.toLowerCase();
      const binds = getMonsterKeybindsImport(keybindDataRef.current, monster.id);
      
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
  const handleRecruit = useCallback(() => {
    if (defeatedEnemy) {
      const roll = Math.random() * 100;
      if (roll < recruitChance) {
        dispatch({ type: 'ADD_TO_PARTY', monster: defeatedEnemy });
        addLog(`🎉 ${defeatedEnemy.name} joined your party!`, 'system');
        toast.success(`${defeatedEnemy.species} joined your team!`);
      } else {
        addLog(`😔 ${defeatedEnemy.name} declined to join...`, 'info');
      }
    }
    setShowRecruitment(false);
    setDefeatedEnemy(null);
  }, [defeatedEnemy, recruitChance, dispatch, addLog]);
  
  const handleSkipRecruit = useCallback(() => {
    setShowRecruitment(false);
    setDefeatedEnemy(null);
  }, []);
  
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
    // Store which dungeon we're entering for tracking
    if (selectedDungeon) {
      localStorage.setItem('menagerie_active_dungeon_id', selectedDungeon.id);
    }
    dispatch({ type: 'SET_PHASE', phase: 'dungeon' });
  };
  
  const handleFlee = () => {
    saveOverworld(overworld);
    dispatch({ type: 'FLEE_DUNGEON' });
    dispatch({ type: 'SET_PHASE', phase: 'main_menu' });
  };
  
  const handleDropItem = (itemId: string) => {
    dispatch({ type: 'DROP_ITEM', itemId });
    addLog('🗑️ Item dropped', 'info');
  };
  
  const baseInfo = BUILDING_UPGRADES[overworld.homeBase.buildingType];
  const canUpgrade = canUpgradeBase(overworld);
  const upgradeInfo = baseInfo.next ? BUILDING_UPGRADES[baseInfo.next] : null;
  
  // Dynamic bottom positioning matching DungeonView
  const dungeonBottomStyle = menuOpen 
    ? { bottom: '520px' }
    : { bottom: '280px' };
  const controlsOffset = menuOpen ? 'bottom-16' : 'bottom-0';
  
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
      onFlee={handleFlee} 
      onDropItem={handleDropItem} 
      onUseItem={handleUseItemOutOfCombat}
      onUseMove={handleUseMoveOnMap}
      onReorderMoves={order => dispatch({ type: 'SET_MOVE_ORDER', order })} 
      onToggleHideMove={moveId => dispatch({ type: 'TOGGLE_HIDE_MOVE', moveId })}
      onOpenEquipment={() => setShowEquipment(true)}
      onPanelChange={setMenuOpen}
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
    
    {/* Revive Target Modal */}
    <ReviveTargetModal
      open={showReviveModal}
      onClose={() => { setShowReviveModal(false); setPendingReviveItem(null); }}
      party={state.run?.party || []}
      revivePercent={pendingReviveItem?.effect === 'revive_full' ? 100 : (pendingReviveItem?.value || 25)}
      itemName={pendingReviveItem?.name || 'Revive'}
      onRevive={handleReviveTarget}
    />
    
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
        enemy={defeatedEnemy}
        recruitChance={recruitChance}
        impressiveStats={battleStats}
        partyFull={(state.run?.party?.length || 0) >= 6}
        onRecruit={handleRecruit}
        onDismiss={handleSkipRecruit}
      />
    )}
    
    {/* Main map viewport - matches DungeonView layout */}
    <div className="fixed inset-0 overflow-hidden transition-all duration-300" style={dungeonBottomStyle}>
      <div className="h-full flex flex-col">
        <div className="flex-1 overflow-hidden bg-card border-b-2 border-primary/20">
          <OverworldRenderer
            ref={rendererRef}
            overworld={overworld}
            playerElement={monster?.element || 'normal'}
            playerClass={monster?.class}
            playerSpecies={monster?.species}
            unlockedMonsters={state.saveData.unlockedMonsters}
            onTileClick={handleTileClick}
            onTileRightClick={handleTileRightClick}
            targetingMode={!!targetingMove}
            targetingTiles={targetingTiles}
            affectedTiles={affectedTiles}
            hoveredTile={hoveredTile}
            onTileHover={handleTileHover}
            onTileHoverEnd={() => { setHoveredTile(null); setAffectedTiles([]); }}
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

        {/* Bottom bar with controls, legend, and game log - matches DungeonView */}
        <div className={`fixed ${controlsOffset} left-0 right-0 h-[260px] bg-card border-t-2 border-primary/20 p-3 z-40 transition-all duration-300`}>
          <div className="flex flex-col h-full gap-2">
            {/* Top row: Controls and info */}
            <div className="flex justify-center items-center flex-shrink-0">
              {/* Mobile controls */}
              <div className="grid grid-cols-3 gap-2 w-32 sm:hidden">
                <div />
                <Button size="sm" onClick={() => handleDirectionMove('up')}>↑</Button>
                <div />
                <Button size="sm" onClick={() => handleDirectionMove('left')}>←</Button>
                <div />
                <Button size="sm" onClick={() => handleDirectionMove('right')}>→</Button>
                <div />
                <Button size="sm" onClick={() => handleDirectionMove('down')}>↓</Button>
                <div />
              </div>
              <div className="hidden sm:flex flex-col items-center">
                <p className="text-muted-foreground text-sm text-center mb-1">
                  🗺️ Overworld ({overworld.playerPosition.x}, {overworld.playerPosition.y}) • {baseInfo.emoji} {baseInfo.label} • 🪵 {overworld.woodCollected} • 🪨 {overworld.stoneCollected}
                </p>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground justify-center">
                  <span>🌲 Wood</span>
                  <span>🪨 Stone</span>
                  <span>🏠 Building</span>
                  <span>🗼 Dungeon</span>
                  <span>Right-click enemy to attack</span>
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
              <Button variant="outline" size="sm" className="flex-1" onClick={() => { setShowBuildingMenu(false); dispatch({ type: 'SET_PHASE', phase: 'main_menu' }); }}>
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
          {selectedDungeon && (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                Difficulty: <span className="font-semibold text-foreground">Lv.{selectedDungeon.difficulty}</span>
              </p>
              {selectedDungeon.deepestFloor > 0 && (
                <p className="text-sm text-muted-foreground">
                  Deepest explored: <span className="font-semibold text-foreground">Floor {selectedDungeon.deepestFloor}</span>
                </p>
              )}
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
  </>;
}
