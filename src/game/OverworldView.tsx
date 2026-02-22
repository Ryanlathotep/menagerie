// Overworld View - Main overworld exploration component with tactical combat

import { useState, useEffect, useCallback, useRef } from 'react';
import { useGame } from './state';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Position, Monster, MonsterStats } from './types';
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
import { UnifiedMovePanel } from './UnifiedMovePanel';
import { getMonsterMoves, Move, getNewMovesAtLevel } from './moves';
import { getAttackConfig } from './dungeonCombat';
import {
  getOverworldValidTargets,
  getOverworldAffectedTiles,
  getVisibleOverworldEnemies,
  calculateOverworldEnemyAction,
  moveOverworldEnemy,
  removeOverworldEnemyFromMap,
} from './overworldCombat';
import { calculateXpReward, xpToNextLevel } from './combat';
import { RecruitmentModal, calculateRecruitChance } from './RecruitmentModal';
import { LevelUpScreen } from './LevelUpScreen';
import { loadKeybinds, getMonsterKeybinds as getMonsterKeybindsImport } from './keybinds';
import { toast } from 'sonner';

interface OverworldViewProps {
  addLog: (text: string, type?: string) => void;
}

interface LevelUpEntry {
  previousStats: MonsterStats;
  previousLevel: number;
  newMoves: Move[];
  monster: Monster;
  isPassive?: boolean;
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
    ensureChunksLoaded(ow, ow.playerPosition.x, ow.playerPosition.y);
    updateVisibility(ow);
    return ow;
  });
  
  const [showBuildingMenu, setShowBuildingMenu] = useState(false);
  const [showDungeonPrompt, setShowDungeonPrompt] = useState(false);
  
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
        addLog(`👹 ${enemy.name} attacks for ${damage} damage!`);
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
    if (targetingMove) return; // Block movement during targeting
    
    setOverworld(prev => {
      const newState = JSON.parse(JSON.stringify(prev)) as OverworldState;
      ensureChunksLoaded(newState, newState.playerPosition.x + dx, newState.playerPosition.y + dy);
      const result = movePlayer(newState, dx, dy);
      
      switch (result.type) {
        case 'moved':
          // HP/Stamina regen on step
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
          }
          break;
        case 'blocked':
          toast.info(result.reason);
          return prev;
        case 'resource':
          addLog(`🪓 Gathered ${result.amount} ${result.resourceType}!`);
          toast.success(`+${result.amount} ${result.resourceType === 'wood' ? '🪵' : '🪨'} ${result.resourceType}`);
          break;
        case 'enemy':
          toast.warning(`An enemy ${result.enemy.name} blocks the way! Select a move to attack.`);
          return prev;
        case 'building':
          setShowBuildingMenu(true);
          break;
        case 'dungeon_entrance':
          setShowDungeonPrompt(true);
          break;
      }
      
      // Process enemy turns after player moves
      if (result.type === 'moved' || result.type === 'resource') {
        setTimeout(() => processEnemyTurns(newState), 100);
      }
      
      saveOverworld(newState);
      return newState;
    });
  }, [addLog, saveOverworld, state.run, dispatch, targetingMove, processEnemyTurns]);
  
  // ─── Attack targeting ───
  const handleUseMoveOnMap = useCallback((move: Move) => {
    if (!state.run || !monster) return;
    
    const maxSta = monster.stats.stamina ?? 50;
    const curSta = monster.stats.currentStamina ?? maxSta;
    if (curSta < (move.staminaCost || 0)) {
      toast.error('Not enough stamina!');
      return;
    }
    
    // Self-targeting moves (heals, buffs)
    if (move.type === 'heal' || (move.type === 'status' && !move.effect?.includes('lower_'))) {
      // Execute immediately
      if (move.type === 'heal' && move.power > 0) {
        const hpBefore = monster.stats.currentHp;
        if (hpBefore >= monster.stats.maxHp) {
          addLog('❤️ Already at full HP!');
          return;
        }
        const newHp = Math.min(monster.stats.maxHp, hpBefore + move.power);
        dispatch({
          type: 'UPDATE_PLAYER_MONSTER',
          monster: { ...monster, stats: { ...monster.stats, currentHp: newHp, currentStamina: curSta - (move.staminaCost || 0) } },
        });
        addLog(`✨ ${move.name} restored ${newHp - hpBefore} HP!`);
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
        addLog(`⚡ ${move.name} recovered ${recovery} stamina!`);
      } else {
        dispatch({
          type: 'UPDATE_PLAYER_MONSTER',
          monster: { ...monster, stats: { ...monster.stats, currentStamina: curSta - (move.staminaCost || 0) } },
        });
        addLog(`✨ Used ${move.name}!`);
      }
      return;
    }
    
    // Attack moves → enter targeting mode
    const config = getAttackConfig(move);
    const validTargets = getOverworldValidTargets(overworld.playerPosition, config, overworld);
    
    if (validTargets.length === 0) {
      toast.error('No valid targets in range!');
      return;
    }
    
    setTargetingMove(move);
    setTargetingTiles(validTargets);
    setAffectedTiles([]);
    setHoveredTile(null);
    addLog(`🎯 Targeting ${move.name}... Click a tile to attack!`);
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
      addLog('❌ Invalid target!');
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
              
              // XP
              const xpGained = calculateXpReward(enemy.level, monster.level);
              dispatch({ type: 'ADD_XP', amount: xpGained });
              
              // Check level up
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
              
              addLog(`💥 ${targetingMove.name} defeated ${enemy.name}! (+${damage} dmg, +${xpGained} XP)`);
              
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
              // Update enemy HP
              for (const chunk of Object.values(newOw.chunks)) {
                const e = chunk.enemies.find(e => e.id === enemy.id);
                if (e) { e.stats.currentHp = newEnemyHp; break; }
              }
              addLog(`⚔️ ${targetingMove.name} hit ${enemy.name} for ${damage} damage!`);
              enemiesHit.push({ enemy, pos: tile });
            }
          }
        }
      }
      
      if (enemiesHit.length === 0) {
        addLog(`⚔️ ${targetingMove.name} missed! No enemies in range.`);
      }
      
      // Process enemy turns after attack
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
          addLog('❌ Enemy out of range! Get closer.');
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
        addLog('❌ Attack cancelled.');
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
  
  // ─── Recruitment handlers ───
  const handleRecruit = useCallback(() => {
    if (defeatedEnemy) {
      const unlockedMonster = {
        species: defeatedEnemy.species,
        element: defeatedEnemy.element,
        classType: defeatedEnemy.class,
        level: defeatedEnemy.level,
        comboId: `${defeatedEnemy.species}_${defeatedEnemy.class}_${defeatedEnemy.element}`,
      };
      dispatch({ type: 'UNLOCK_MONSTER', monster: unlockedMonster as any });
      toast.success(`${defeatedEnemy.name} joined your team!`);
    }
    setShowRecruitment(false);
    setDefeatedEnemy(null);
  }, [defeatedEnemy, dispatch]);
  
  const handleSkipRecruit = useCallback(() => {
    setShowRecruitment(false);
    setDefeatedEnemy(null);
  }, []);
  
  // ─── Building & dungeon ───
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
  
  // Get current monster's moves for the panel
  const currentMoves = monster 
    ? getMonsterMoves(monster.species, monster.element, monster.class, monster.level)
    : [];
  
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
          <span className="text-blue-400">⚡ {monster.stats.currentStamina ?? monster.stats.stamina}/{monster.stats.stamina}</span>
          {targetingMove && (
            <span className="text-yellow-400 animate-pulse">🎯 Targeting: {targetingMove.name}</span>
          )}
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
          onTileRightClick={handleTileRightClick}
          targetingMode={!!targetingMove}
          targetingTiles={targetingTiles}
          affectedTiles={affectedTiles}
          hoveredTile={hoveredTile}
          onTileHover={handleTileHover}
          onTileHoverEnd={() => { setHoveredTile(null); setAffectedTiles([]); }}
        />
      </div>
      
      {/* Move Panel */}
      {monster && (
        <div className="px-2">
          <UnifiedMovePanel
            monster={monster}
            moves={currentMoves}
            moveOrder={state.run?.moveOrder || []}
            hiddenMoves={state.run?.hiddenMoves || []}
            onUseMove={handleUseMoveOnMap}
            onReorder={(order) => dispatch({ type: 'SET_MOVE_ORDER', order })}
            onToggleHide={(moveId) => dispatch({ type: 'TOGGLE_HIDE_MOVE', moveId })}
          />
        </div>
      )}
      
      {/* Targeting hint */}
      {targetingMove && (
        <div className="text-center text-xs text-yellow-400 pb-1">
          Click a highlighted tile to attack with {targetingMove.name} • ESC to cancel
        </div>
      )}
      
      {/* Controls hint */}
      {!targetingMove && (
        <p className="text-center text-[10px] text-muted-foreground">
          WASD / Arrow keys to move • Click adjacent tiles • Right-click enemy to attack • 🌲 = wood • 🪨 = stone
        </p>
      )}
      
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
      
      {/* Level Up Screen */}
      {levelUpQueue.length > 0 && (
        <LevelUpScreen
          monster={levelUpQueue[0].monster}
          previousStats={levelUpQueue[0].previousStats}
          previousLevel={levelUpQueue[0].previousLevel}
          newMoves={levelUpQueue[0].newMoves}
          isPassive={levelUpQueue[0].isPassive}
          onContinue={() => setLevelUpQueue(q => q.slice(1))}
        />
      )}
    </div>
  );
}
