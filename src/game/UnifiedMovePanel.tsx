// Unified Move Panel - Works in both combat and exploration
// Supports tier selection, move usage, sorting, filtering, drag-and-drop reordering,
// and effectiveness indicators when enemy is present

import { useState, useMemo, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ChevronDown, GripVertical, Eye, EyeOff, Zap, Target, Heart, Sparkles, ChevronLeft } from 'lucide-react';
import { Move, STRUGGLE_MOVE } from './moves';
import { Monster } from './types';
import { ExpandedStats } from './CharacterSheet';
import { calculateHitChance, calculateExpectedDamage, getEffectiveness } from './combat';
import { 
  getAvailableTiers, 
  hasAoEUnlocked,
  createEvolvedMove, 
  getHighestTier,
  getMasteryProgress,
  TIER_COLORS,
  TIER_BG_COLORS,
  getTierDisplayName,
  EvolvedMove,
} from './moveMastery';
import { 
  MoveSortFilter, 
  MoveSortOption, 
  MoveFilterOption, 
  sortMoves, 
  filterMoves 
} from './MoveSortFilter';
import { loadMoveFilters, saveMoveFilters } from './persistedFilters';
import { 
  loadKeybinds, saveKeybinds, getMonsterKeybinds, setMoveKeybind, 
  removeMoveKeybind, VALID_KEYBIND_KEYS 
} from './keybinds';

interface UnifiedMovePanelProps {
  moves: Move[];
  monster: Monster;
  expandedStats?: ExpandedStats;
  moveOrder: string[];
  hiddenMoves: string[];
  onReorder: (newOrder: string[]) => void;
  onToggleHide: (moveId: string) => void;
  // Combat/exploration mode
  inBattle?: boolean;
  currentStamina?: number;
  enemyMonster?: Monster | null;
  // Move execution
  onUseMove?: (move: Move | EvolvedMove) => void;
  // Add struggle automatically when out of stamina
  autoAddStruggle?: boolean;
}

export function UnifiedMovePanel({ 
  moves, 
  monster, 
  expandedStats, 
  moveOrder, 
  hiddenMoves, 
  onReorder, 
  onToggleHide,
  inBattle = false,
  currentStamina = monster.stats.currentStamina || monster.stats.stamina || 50,
  enemyMonster,
  onUseMove,
  autoAddStruggle = false,
}: UnifiedMovePanelProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragOverSection, setDragOverSection] = useState<'visible' | 'hidden' | null>(null);
  const [selectedMoveForTier, setSelectedMoveForTier] = useState<Move | null>(null);
  
  // Sorting and filtering state - persisted to localStorage
  const [sortOption, setSortOption] = useState<MoveSortOption>(() => loadMoveFilters().sortOption);
  const [filters, setFilters] = useState<MoveFilterOption[]>(() => loadMoveFilters().filters);
  
  // Keybind state
  const [keybindData, setKeybindData] = useState(() => loadKeybinds());
  const [assigningKeybind, setAssigningKeybind] = useState<string | null>(null); // moveId being assigned
  const monsterComboId = `${monster.species}_${monster.element}_${monster.class}`;
  const monsterKeybinds = getMonsterKeybinds(keybindData, monsterComboId);
  
  // Persist sort/filter changes
  const handleSortChange = (option: MoveSortOption) => {
    setSortOption(option);
    saveMoveFilters({ sortOption: option, filters });
  };
  const handleFilterChange = (newFilters: MoveFilterOption[]) => {
    setFilters(newFilters);
    saveMoveFilters({ sortOption, filters: newFilters });
  };
  
  // Keybind assignment
  useEffect(() => {
    if (!assigningKeybind) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      const key = e.key.toLowerCase();
      if (key === 'escape') {
        // Remove keybind
        const updated = removeMoveKeybind(keybindData, monsterComboId, assigningKeybind);
        setKeybindData(updated);
        saveKeybinds(updated);
      } else if (VALID_KEYBIND_KEYS.includes(key)) {
        const updated = setMoveKeybind(keybindData, monsterComboId, assigningKeybind, key);
        setKeybindData(updated);
        saveKeybinds(updated);
      }
      setAssigningKeybind(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [assigningKeybind, keybindData, monsterComboId]);
  
  // Apply sorting and filtering
  const processedMoves = useMemo(() => {
    const filtered = filterMoves(moves, filters);
    return sortMoves(filtered, sortOption, monster, moveOrder);
  }, [moves, filters, sortOption, monster, moveOrder]);
  
  const visibleMoves = processedMoves.filter(m => !hiddenMoves.includes(m.id));
  const hiddenMovesList = processedMoves.filter(m => hiddenMoves.includes(m.id));
  
  // Check if player can afford any visible move (for struggle)
  const canAffordAnyVisibleMove = visibleMoves.some(m => (m.staminaCost || 0) <= currentStamina);
  
  // Add struggle if needed
  const displayMoves = autoAddStruggle && !canAffordAnyVisibleMove 
    ? [...visibleMoves, STRUGGLE_MOVE] 
    : visibleMoves;
  
  // Drag handlers
  const handleDragStart = (e: React.DragEvent, moveId: string) => {
    setDraggedId(moveId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', moveId);
  };
  
  const handleDragOver = (e: React.DragEvent, moveId: string, section: 'visible' | 'hidden') => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverId(moveId);
    setDragOverSection(section);
  };
  
  const handleDragLeave = () => {
    setDragOverId(null);
    setDragOverSection(null);
  };
  
  const handleDrop = (e: React.DragEvent, targetId: string, targetSection: 'visible' | 'hidden') => {
    e.preventDefault();
    const sourceId = draggedId;
    if (!sourceId || sourceId === targetId) {
      resetDragState();
      return;
    }
    
    const sourceIsHidden = hiddenMoves.includes(sourceId);
    const targetIsHidden = targetSection === 'hidden';
    
    if (sourceIsHidden !== targetIsHidden) {
      onToggleHide(sourceId);
    }
    
    const currentOrder = moveOrder.length > 0 ? [...moveOrder] : moves.map(m => m.id);
    const sourceIndex = currentOrder.indexOf(sourceId);
    
    if (sourceIndex !== -1) {
      currentOrder.splice(sourceIndex, 1);
    }
    
    const newTargetIndex = currentOrder.indexOf(targetId);
    if (newTargetIndex !== -1) {
      currentOrder.splice(newTargetIndex, 0, sourceId);
    } else {
      currentOrder.push(sourceId);
    }
    
    onReorder(currentOrder);
    resetDragState();
  };
  
  const handleDropOnSection = (e: React.DragEvent, section: 'visible' | 'hidden') => {
    e.preventDefault();
    const sourceId = draggedId;
    if (!sourceId) return;
    
    const sourceIsHidden = hiddenMoves.includes(sourceId);
    const targetIsHidden = section === 'hidden';
    
    if (sourceIsHidden !== targetIsHidden) {
      onToggleHide(sourceId);
    }
    
    resetDragState();
  };
  
  const resetDragState = () => {
    setDraggedId(null);
    setDragOverId(null);
    setDragOverSection(null);
  };

  // Check if a move can be used outside combat
  const canUseOutsideCombat = (move: Move) => {
    // Heal and certain status moves can be used outside combat
    if (move.type === 'heal') return true;
    if (move.effect?.includes('restore_stamina')) return true;
    if (move.effect?.includes('raise_')) return true; // Buff moves
    // Attack moves can now be used on the map with targeting!
    if (move.type === 'melee' || move.type === 'ranged') return true;
    // Debuff status moves can target enemies
    if (move.type === 'status' && move.effect?.includes('lower_')) return true;
    return false;
  };

  // Handle move click - uses highest available tier by default (single target)
  const handleMoveClick = (move: Move) => {
    if (!onUseMove) return;
    const mastery = monster.moveMastery?.[move.id];
    const evolvedMove = move.power > 0
      ? createEvolvedMove(move, getHighestTier(mastery, monster.level), 'single', monster.level)
      : move;
    onUseMove(evolvedMove);
  };

  // Handle tier pill click - uses selected tier/variant directly
  const handleTierPillClick = (move: Move, tier: import('./moveMastery').MoveTier, variant: import('./moveMastery').MoveVariant) => {
    if (!onUseMove) return;
    const evolved = createEvolvedMove(move, tier, variant, monster.level);
    onUseMove(evolved);
  };

  // Open the full tier modal (kept for "more options" affordance)
  const handleOpenTierSelector = (move: Move) => {
    setSelectedMoveForTier(move);
  };

  // Handle tier selection
  const handleTierSelect = (evolvedMove: EvolvedMove) => {
    if (onUseMove) {
      onUseMove(evolvedMove);
    }
    setSelectedMoveForTier(null);
  };

  // Tier selector view
  if (selectedMoveForTier) {
    const move = selectedMoveForTier;
    const mastery = monster.moveMastery?.[move.id];
    const availableTiers = getAvailableTiers(mastery, monster.level);
    const canUseAoE = hasAoEUnlocked(mastery);
    
    return (
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 w-7 p-0"
            onClick={() => setSelectedMoveForTier(null)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="font-bold text-sm flex-1">{move.name}</h3>
          <Badge variant="outline" className="text-[10px]">
            {mastery?.uses || 0} uses
          </Badge>
        </div>
        
        <p className="text-xs text-muted-foreground">{move.description}</p>
        
        {/* Single Target Versions */}
        <div className="space-y-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Target className="w-3 h-3" />
            <span>Single Target</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {availableTiers.map((tier) => {
              const evolved = createEvolvedMove(move, tier, 'single', monster.level);
              const canAfford = evolved.staminaCost <= currentStamina;
              
              return (
                <Button
                  key={tier}
                  variant={canAfford ? "outline" : "ghost"}
                  className={`h-auto py-2 px-2 text-left flex-col items-start ${
                    !canAfford ? 'opacity-50' : ''
                  } ${TIER_BG_COLORS[tier]}`}
                  onClick={() => handleTierSelect(evolved)}
                  disabled={!canAfford}
                >
                  <span className={`font-semibold text-xs ${TIER_COLORS[tier]}`}>
                    {getTierDisplayName(tier)}
                  </span>
                  <div className="flex gap-1.5 text-[9px] text-muted-foreground mt-1">
                    <span>⚔️{evolved.power}</span>
                    <span>⚡{evolved.staminaCost}</span>
                  </div>
                </Button>
              );
            })}
          </div>
        </div>
        
        {/* Mass Versions */}
        {canUseAoE && move.power > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Sparkles className="w-3 h-3" />
              <span>Mass (AoE)</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {availableTiers.map((tier) => {
                const evolved = createEvolvedMove(move, tier, 'mass', monster.level);
                const canAfford = evolved.staminaCost <= currentStamina;
                
                return (
                  <Button
                    key={`${tier}-mass`}
                    variant={canAfford ? "outline" : "ghost"}
                    className={`h-auto py-2 px-2 text-left flex-col items-start ${
                      !canAfford ? 'opacity-50' : ''
                    } ${TIER_BG_COLORS[tier]}`}
                    onClick={() => handleTierSelect(evolved)}
                    disabled={!canAfford}
                  >
                    <div className="flex items-center gap-1">
                      <span className={`font-semibold text-xs ${TIER_COLORS[tier]}`}>
                        {getTierDisplayName(tier)}
                      </span>
                      <Badge variant="secondary" className="text-[7px] px-1 py-0">AoE</Badge>
                    </div>
                    <div className="flex gap-1.5 text-[9px] text-muted-foreground mt-1">
                      <span>⚔️{evolved.power}</span>
                      <span>⚡{evolved.staminaCost}</span>
                    </div>
                  </Button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Sort and Filter Controls */}
      <MoveSortFilter
        sortOption={sortOption}
        filters={filters}
        onSortChange={handleSortChange}
        onFilterChange={handleFilterChange}
      />
      
      {/* Visible Moves */}
      <div 
        className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 min-h-[60px] p-1 rounded-lg transition-colors ${
          dragOverSection === 'visible' && dragOverId === null ? 'bg-primary/10 ring-2 ring-primary/30' : ''
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOverSection('visible'); }}
        onDragLeave={() => setDragOverSection(null)}
        onDrop={(e) => handleDropOnSection(e, 'visible')}
      >
        {displayMoves.map(move => (
          <UnifiedMoveCard
            key={move.id}
            move={move}
            monster={monster}
            enemyMonster={enemyMonster}
            expandedStats={expandedStats}
            currentStamina={currentStamina}
            isDragging={draggedId === move.id}
            isDragOver={dragOverId === move.id}
            onDragStart={(e) => handleDragStart(e, move.id)}
            onDragOver={(e) => handleDragOver(e, move.id, 'visible')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, move.id, 'visible')}
            onDragEnd={resetDragState}
            onToggleHide={() => onToggleHide(move.id)}
            isHidden={false}
            inBattle={inBattle}
            canUseOutsideCombat={canUseOutsideCombat(move)}
            onUseMove={onUseMove ? () => handleMoveClick(move) : undefined}
            keybind={monsterKeybinds[move.id]}
            isAssigningKeybind={assigningKeybind === move.id}
            onAssignKeybind={() => setAssigningKeybind(assigningKeybind === move.id ? null : move.id)}
          />
        ))}
        {displayMoves.length === 0 && (
          <div className="col-span-full text-center py-4 text-muted-foreground text-xs">
            Drag moves here to show them
          </div>
        )}
      </div>
      
      {/* Hidden Moves */}
      <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
        <CollapsibleTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full justify-between text-muted-foreground hover:text-foreground"
          >
            <span className="flex items-center gap-1">
              <EyeOff className="w-3 h-3" />
              Hidden ({hiddenMovesList.length})
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div 
            className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mt-2 min-h-[40px] p-1 rounded-lg border border-dashed border-border/50 transition-colors ${
              dragOverSection === 'hidden' && dragOverId === null ? 'bg-muted/50 ring-2 ring-muted-foreground/30' : ''
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOverSection('hidden'); }}
            onDragLeave={() => setDragOverSection(null)}
            onDrop={(e) => handleDropOnSection(e, 'hidden')}
          >
            {hiddenMovesList.map(move => (
              <UnifiedMoveCard
                key={move.id}
                move={move}
                monster={monster}
                enemyMonster={enemyMonster}
                expandedStats={expandedStats}
                currentStamina={currentStamina}
                isDragging={draggedId === move.id}
                isDragOver={dragOverId === move.id}
                onDragStart={(e) => handleDragStart(e, move.id)}
                onDragOver={(e) => handleDragOver(e, move.id, 'hidden')}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, move.id, 'hidden')}
                onDragEnd={resetDragState}
                onToggleHide={() => onToggleHide(move.id)}
                isHidden={true}
                inBattle={inBattle}
                canUseOutsideCombat={canUseOutsideCombat(move)}
                onUseMove={onUseMove ? () => handleMoveClick(move) : undefined}
                keybind={monsterKeybinds[move.id]}
                isAssigningKeybind={assigningKeybind === move.id}
                onAssignKeybind={() => setAssigningKeybind(assigningKeybind === move.id ? null : move.id)}
              />
            ))}
            {hiddenMovesList.length === 0 && (
              <div className="col-span-full text-center py-2 text-muted-foreground text-[10px]">
                Drag moves here to hide them
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

interface UnifiedMoveCardProps {
  move: Move;
  monster: Monster;
  enemyMonster?: Monster | null;
  expandedStats?: ExpandedStats;
  currentStamina: number;
  isDragging: boolean;
  isDragOver: boolean;
  isHidden: boolean;
  inBattle: boolean;
  canUseOutsideCombat: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onToggleHide: () => void;
  onUseMove?: () => void;
  keybind?: string;
  isAssigningKeybind?: boolean;
  onAssignKeybind?: () => void;
}

function UnifiedMoveCard({
  move,
  monster,
  enemyMonster,
  expandedStats,
  currentStamina,
  isDragging,
  isDragOver,
  isHidden,
  inBattle,
  canUseOutsideCombat,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onToggleHide,
  onUseMove,
  keybind,
  isAssigningKeybind,
  onAssignKeybind,
}: UnifiedMoveCardProps) {
  const typeColors: Record<Move['type'], string> = {
    melee: 'bg-orange-500/20 text-orange-600',
    ranged: 'bg-blue-500/20 text-blue-600',
    status: 'bg-purple-500/20 text-purple-600',
    heal: 'bg-green-500/20 text-green-600',
  };
  
  const typeIcons: Record<Move['type'], React.ReactNode> = {
    melee: <Zap className="w-3 h-3" />,
    ranged: <Target className="w-3 h-3" />,
    status: <Sparkles className="w-3 h-3" />,
    heal: <Heart className="w-3 h-3" />,
  };
  
  const mastery = monster.moveMastery?.[move.id];
  const masteryProgress = getMasteryProgress(mastery);
  const availableTiers = getAvailableTiers(mastery, monster.level);
  const hasTierOptions = move.power > 0 && (
    availableTiers.length > 1 ||
    hasAoEUnlocked(mastery)
  );
  
  // Always create evolved move for attack moves (power > 0) to show tier prefix
  // Status/heal moves (power = 0) use base move without tier
  const displayMove = move.power > 0
    ? createEvolvedMove(move, getHighestTier(mastery, monster.level), 'single', monster.level)
    : move;
  
  const canAfford = displayMove.staminaCost <= currentStamina;
  const canUse = inBattle || canUseOutsideCombat;
  const isUsable = canUse && canAfford && onUseMove;
  
  const attackStat = move.type === 'melee' 
    ? (expandedStats?.melee ?? monster.stats.attack) 
    : move.type === 'ranged' 
      ? (expandedStats?.ranged ?? monster.stats.special) 
      : 0;
  
  // Calculate effectiveness when enemy is present
  const effectiveness = enemyMonster 
    ? getEffectiveness(displayMove, monster, enemyMonster)
    : null;
  
  const hitChance = enemyMonster 
    ? calculateHitChance(displayMove, monster, enemyMonster)
    : null;
  
  const expectedDamage = enemyMonster && displayMove.power > 0
    ? calculateExpectedDamage(displayMove, monster, enemyMonster)
    : null;
  
  // Get effectiveness aura class
  const getEffectivenessAura = () => {
    if (!effectiveness || !canAfford) return '';
    switch (effectiveness.overall) {
      case 'super-effective':
        return 'ring-2 ring-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.6)] animate-pulse';
      case 'effective':
        return 'ring-2 ring-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.5)]';
      case 'weak':
        return 'opacity-60 border-muted';
      default:
        return '';
    }
  };
  
  const effectivenessIndicator = effectiveness 
    ? effectiveness.overall === 'super-effective' ? '🔥' 
    : effectiveness.overall === 'effective' ? '✨' 
    : effectiveness.overall === 'weak' ? '⬇️' 
    : ''
    : '';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Card 
          draggable
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onDragEnd={onDragEnd}
          onClick={isUsable ? onUseMove : undefined}
          className={`p-2 transition-all ${
            isDragging ? 'opacity-50 scale-95' : ''
          } ${
            isDragOver ? 'ring-2 ring-primary bg-primary/10' : ''
          } ${
            isHidden ? 'opacity-70' : ''
          } ${
            isUsable ? 'cursor-pointer hover:bg-primary/10 hover:border-primary' : 'cursor-grab active:cursor-grabbing'
          } ${
            !canAfford && canUse ? 'opacity-50' : ''
          } ${
            getEffectivenessAura()
          } ${
            move.id === 'struggle' ? 'border-destructive text-destructive' : ''
          }`}
        >
          <div className="flex items-start gap-1">
            {/* Keybind badge */}
            {move.id !== 'struggle' && (
              <button
                className={`w-5 h-5 flex-shrink-0 mt-0.5 rounded text-[9px] font-bold flex items-center justify-center border transition-all ${
                  isAssigningKeybind
                    ? 'bg-primary text-primary-foreground border-primary animate-pulse'
                    : keybind
                    ? 'bg-muted border-border text-foreground hover:bg-primary/20'
                    : 'bg-muted/50 border-border/50 text-muted-foreground hover:bg-muted'
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  onAssignKeybind?.();
                }}
                title={isAssigningKeybind ? 'Press a key to bind (Esc to clear)' : keybind ? `Keybind: ${keybind.toUpperCase()} (click to change)` : 'Click to assign keybind'}
              >
                {isAssigningKeybind ? '...' : keybind ? keybind.toUpperCase() : '⌨'}
              </button>
            )}
            {move.id === 'struggle' && <GripVertical className="w-3 h-3 text-muted-foreground/50 mt-0.5 flex-shrink-0" />}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1 gap-1">
                <h4 className="font-semibold text-[11px] truncate flex items-center gap-1">
                  {effectivenessIndicator && <span>{effectivenessIndicator}</span>}
                  {displayMove.name}
                  {hasTierOptions && <span className="text-primary text-[9px]">▼</span>}
                </h4>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <span className={`text-[8px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${typeColors[move.type]}`}>
                    {typeIcons[move.type]}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-4 h-4 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleHide();
                    }}
                    title={isHidden ? "Show move" : "Hide move"}
                  >
                    {isHidden ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5" />}
                  </Button>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-1.5 text-[9px]">
                {displayMove.power > 0 && (
                  <span>
                    ⚔️{displayMove.power}
                    {attackStat > 0 && <span className="text-muted-foreground">+{Math.floor(attackStat / 2)}</span>}
                  </span>
                )}
                <span>🎯{displayMove.accuracy}%</span>
                <span className={!canAfford ? 'text-destructive' : ''}>⚡{displayMove.staminaCost}</span>
              </div>
              
              {/* Mastery indicator */}
              {mastery && mastery.uses > 0 && (
                <div className="mt-1 flex items-center gap-1">
                  <Badge 
                    variant="outline" 
                    className={`text-[7px] px-1 py-0 ${TIER_COLORS[masteryProgress.tier]} ${TIER_BG_COLORS[masteryProgress.tier]} border-0`}
                  >
                    {getTierDisplayName(masteryProgress.tier)}
                  </Badge>
                  {masteryProgress.hasAoE && (
                    <span className="text-[8px] text-amber-500" title="Mass variant unlocked">⚔️</span>
                  )}
                </div>
              )}
              
              {/* Use indicator for exploration */}
              {!inBattle && canUseOutsideCombat && onUseMove && (
                <p className="text-[8px] text-primary mt-0.5">Click to use</p>
              )}
            </div>
          </div>
        </Card>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px] z-[100] bg-popover p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="font-bold text-sm">{move.name}</p>
          {mastery && (
            <Badge 
              variant="outline" 
              className={`text-[8px] px-1.5 py-0 ${TIER_COLORS[masteryProgress.tier]} ${TIER_BG_COLORS[masteryProgress.tier]} border-0`}
            >
              {getTierDisplayName(masteryProgress.tier)}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{move.description}</p>
        
        {/* Combat Stats - shown when enemy is present */}
        {enemyMonster && (
          <div className="border-t border-border pt-2 space-y-1 text-xs">
            {expectedDamage !== null && (
              <div className="flex justify-between">
                <span>Expected Damage:</span>
                <span className="font-mono font-bold">{expectedDamage}</span>
              </div>
            )}
            {hitChance !== null && (
              <div className="flex justify-between">
                <span>Hit Chance:</span>
                <span className="font-mono font-bold">{hitChance}%</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Stamina Cost:</span>
              <span className="font-mono">⚡{displayMove.staminaCost}</span>
            </div>
            {displayMove.speedMod !== 0 && (
              <div className="flex justify-between">
                <span>Priority:</span>
                <span className="font-mono">{displayMove.speedMod > 0 ? '+' : ''}{displayMove.speedMod}</span>
              </div>
            )}
          </div>
        )}
        
        {/* Effectiveness indicators */}
        {effectiveness && (effectiveness.element !== 'normal' || effectiveness.class !== 'normal') && (
          <div className="border-t border-border pt-2 space-y-1 text-xs">
            {move.element && effectiveness.element !== 'normal' && (
              <div className={`flex items-center gap-1 ${effectiveness.element === 'super' ? 'text-green-500' : 'text-red-500'}`}>
                <span>{effectiveness.element === 'super' ? '🔥' : '🛡️'}</span>
                <span>Element: {effectiveness.element === 'super' ? 'Super Effective!' : 'Not Very Effective'}</span>
              </div>
            )}
            {move.classBonus && effectiveness.class !== 'normal' && (
              <div className={`flex items-center gap-1 ${effectiveness.class === 'super' ? 'text-green-500' : 'text-red-500'}`}>
                <span>{effectiveness.class === 'super' ? '⚔️' : '🛡️'}</span>
                <span>Class: {effectiveness.class === 'super' ? 'Super Effective!' : 'Not Very Effective'}</span>
              </div>
            )}
          </div>
        )}
        
        {/* Overall effectiveness */}
        {effectiveness && (
          <div className={`text-center font-bold ${
            effectiveness.overall === 'super-effective' ? 'text-green-400' :
            effectiveness.overall === 'effective' ? 'text-green-500' :
            effectiveness.overall === 'weak' ? 'text-red-500' :
            'text-muted-foreground'
          }`}>
            {effectiveness.overall === 'super-effective' && '✨ SUPER EFFECTIVE! ✨'}
            {effectiveness.overall === 'effective' && '🔥 Effective!'}
            {effectiveness.overall === 'weak' && '⚠️ Not Very Effective...'}
          </div>
        )}
        
        {move.effect && (
          <p className="text-xs text-accent">✨ {move.effect.replace(/_/g, ' ')}</p>
        )}
        
        {/* Mastery Progress */}
        {mastery && (
          <div className="border-t border-border pt-2 text-xs">
            <div className="flex justify-between">
              <span>Uses:</span>
              <span className="font-mono">{mastery.uses}</span>
            </div>
            {masteryProgress.nextTier && (
              <div className="flex justify-between text-muted-foreground">
                <span>Next:</span>
                <span>{masteryProgress.usesToNextTier} uses to {getTierDisplayName(masteryProgress.nextTier)}</span>
              </div>
            )}
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
