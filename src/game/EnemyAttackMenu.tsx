// Right-click an enemy → opens this menu showing all attack moves the active
// monster can use against that enemy, sorted/filtered with the same persisted
// preferences as the main move panel. Out-of-range and unaffordable moves are
// shown but disabled, so the player can see the full picture at a glance.

import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Zap, Target, Shield, Coins } from 'lucide-react';
import { Monster } from './types';
import { Move, getMonsterMoves } from './moves';
import { getAttackConfig } from './dungeonCombat';
import { MoveSortFilter, MoveSortOption, MoveFilterOption, sortMoves, filterMoves } from './MoveSortFilter';
import { loadMoveFilters, saveMoveFilters } from './persistedFilters';
import { getEffectiveness } from './combat';
import { useSettings } from './Settings';
import { formatLevel } from './levelDisplay';

export interface EnemyAttackTarget {
  enemy: Monster;
  enemyPos: { x: number; y: number };
  playerPos: { x: number; y: number };
}

interface EnemyAttackMenuProps {
  attacker: Monster;
  target: EnemyAttackTarget;
  moveOrder?: string[];
  onPickMove: (move: Move) => void;
  onClose: () => void;
}

export function EnemyAttackMenu({
  attacker,
  target,
  moveOrder = [],
  onPickMove,
  onClose,
}: EnemyAttackMenuProps) {
  const { enemy, enemyPos, playerPos } = target;
  const { settings } = useSettings();
  const distance =
    Math.abs(enemyPos.x - playerPos.x) + Math.abs(enemyPos.y - playerPos.y);

  // Persisted sort/filter, editable inline; changes mirror to the move panel.
  const initial = useMemo(() => loadMoveFilters(), []);
  const [sortOption, setSortOption] = useState<MoveSortOption>(initial.sortOption);
  const [filters, setFilters] = useState<MoveFilterOption[]>(initial.filters);
  const [searchQuery, setSearchQuery] = useState<string>(initial.searchQuery ?? '');
  const updateSort = (s: MoveSortOption) => { setSortOption(s); saveMoveFilters({ sortOption: s, filters, searchQuery }); };
  const updateFilters = (f: MoveFilterOption[]) => { setFilters(f); saveMoveFilters({ sortOption, filters: f, searchQuery }); };
  const updateSearch = (q: string) => { setSearchQuery(q); saveMoveFilters({ sortOption, filters, searchQuery: q }); };

  // Only attack-capable moves: melee, ranged, and any status move that targets
  // (i.e. carries a debuff) plus any move with power > 0.
  const attackMoves = useMemo(() => {
    const all = getMonsterMoves(
      attacker.species,
      attacker.element,
      attacker.class,
      attacker.level,
    );
    return all.filter(
      (m) =>
        m.type === 'melee' ||
        m.type === 'ranged' ||
        m.power > 0 ||
        (m.type === 'status' && m.effect && m.effect.includes('lower_')),
    );
  }, [attacker]);

  // Apply user filter + sort, then enrich with range / cost info.
  const ordered = useMemo(() => {
    const filtered = filterMoves(attackMoves, filters, searchQuery);
    const sorted = sortMoves(filtered, sortOption, attacker, moveOrder);
    return sorted.map((move) => {
      const cfg = getAttackConfig(move);
      const inRange = distance <= cfg.range;
      const canAfford = attacker.stats.currentStamina >= move.staminaCost;
      const eff = move.power > 0 ? getEffectiveness(move, attacker, enemy) : null;
      return { move, cfg, inRange, canAfford, eff };
    });
  }, [attackMoves, filters, searchQuery, sortOption, attacker, moveOrder, distance, enemy]);

  const usableCount = ordered.filter((m) => m.inRange && m.canAfford).length;

  return (
    <div
      className="fixed inset-0 bg-background/60 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center p-2 sm:p-4 overscroll-contain"
      style={{
        paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
      }}
      onClick={onClose}
    >
      <Card
        className="p-3 sm:p-4 w-full max-w-md space-y-3 flex flex-col max-h-full sm:max-h-[80vh] min-h-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2 flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-bold truncate">
              ⚔️ Attack {enemy.name}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {formatLevel(enemy.level, settings.levelDisplayMode)} {enemy.element}/{enemy.class} • HP{' '}
              {enemy.stats.currentHp}/{enemy.stats.maxHp} •{' '}
              <span className={distance > 1 ? 'text-amber-600 dark:text-amber-400' : ''}>
                {distance} tile{distance === 1 ? '' : 's'} away
              </span>
            </p>
            <p className="text-[10px] text-muted-foreground">
              {usableCount} of {ordered.length} moves usable
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} aria-label="Close attack menu">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Sort + filter controls (persist with main move panel) */}
        <div className="flex-shrink-0">
          <MoveSortFilter
            sortOption={sortOption}
            filters={filters}
            searchQuery={searchQuery}
            onSortChange={updateSort}
            onFilterChange={updateFilters}
            onSearchChange={updateSearch}
          />
        </div>

        {/* Move list */}
        <ScrollArea className="flex-1 -mx-1 pr-1">
          <div className="space-y-1.5 px-1">
            {ordered.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4 italic">
                No attack moves match your current filters.
              </p>
            )}
            {ordered.map(({ move, cfg, inRange, canAfford, eff }) => {
              const disabled = !inRange || !canAfford;
              const auraClass =
                eff?.overall === 'super-effective'
                  ? 'ring-1 ring-orange-500/70'
                  : eff?.overall === 'effective'
                    ? 'ring-1 ring-green-500/60'
                    : eff?.overall === 'weak'
                      ? 'ring-1 ring-red-500/40'
                      : '';
              const effIcon =
                eff?.overall === 'super-effective'
                  ? '🔥'
                  : eff?.overall === 'effective'
                    ? '✨'
                    : eff?.overall === 'weak'
                      ? '⬇️'
                      : '';
              return (
                <button
                  key={move.id}
                  disabled={disabled}
                  onClick={() => {
                    if (disabled) return;
                    onPickMove(move);
                  }}
                  className={`w-full text-left p-2 rounded-md border bg-card transition-colors ${
                    disabled
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:bg-accent hover:border-primary/50'
                  } ${auraClass}`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-semibold truncate flex items-center gap-1">
                      {effIcon && <span>{effIcon}</span>}
                      {move.name}
                    </span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {move.type === 'melee' && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                          melee
                        </Badge>
                      )}
                      {move.type === 'ranged' && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                          ranged
                        </Badge>
                      )}
                      {move.type === 'status' && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                          status
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-1 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-0.5">
                      <Zap className="w-3 h-3" />
                      {move.power || '—'}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Target className="w-3 h-3" />
                      {move.accuracy}%
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Coins className="w-3 h-3" />
                      {move.staminaCost}
                    </span>
                    <span
                      className={`flex items-center gap-0.5 ${
                        inRange ? '' : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      <Shield className="w-3 h-3" />
                      r{cfg.range}
                    </span>
                  </div>
                  {disabled && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                      {!inRange ? 'Out of range — move closer.' : 'Not enough stamina.'}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </ScrollArea>

        <p className="text-[10px] text-muted-foreground text-center italic flex-shrink-0">
          Sorted by your move-panel preferences. Right-click again or press Esc to close.
        </p>
      </Card>
    </div>
  );
}
