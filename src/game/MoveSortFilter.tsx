// Move Sorting and Filtering Controls

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  ArrowUpDown, 
  Filter,
  Zap,
  Target,
  Heart,
  Sparkles,
  Flame,
  Shield,
  TrendingUp,
  TrendingDown,
  X,
  Check
} from 'lucide-react';
import { Move } from './moves';
import { Monster } from './types';

export type MoveSortOption = 
  | 'custom'      // Default user order
  | 'usage-desc'  // Most used
  | 'usage-asc'   // Least used
  | 'damage-desc' // Highest damage
  | 'damage-asc'  // Lowest damage
  | 'cost-desc'   // Most expensive
  | 'cost-asc'    // Cheapest
  | 'accuracy-desc' // Most accurate
  | 'accuracy-asc'; // Least accurate

export type MoveFilterOption = 
  | 'all'
  | 'melee'
  | 'ranged'
  | 'status'
  | 'heal'
  | 'damage'      // Any move with power > 0
  | 'buff'        // raise_ effects
  | 'debuff'      // lower_ effects
  | 'status-effect' // poison, burn, freeze, paralyze, confuse
  | 'aoe'         // customShape, aoeRadius>0, or non-single targeting
  | 'dot'         // damage-over-time: poison, burn, bleed
  | 'movement';   // type==='movement' or has movement pattern

interface MoveSortFilterProps {
  sortOption: MoveSortOption;
  filters: MoveFilterOption[];
  searchQuery?: string;
  onSortChange: (option: MoveSortOption) => void;
  onFilterChange: (filters: MoveFilterOption[]) => void;
  onSearchChange?: (q: string) => void;
}

export function MoveSortFilter({ 
  sortOption, 
  filters, 
  onSortChange, 
  onFilterChange 
}: MoveSortFilterProps) {
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const sortOptions: { value: MoveSortOption; label: string; icon: React.ReactNode }[] = [
    { value: 'custom', label: 'Custom Order', icon: null },
    { value: 'usage-desc', label: 'Most Used', icon: <TrendingUp className="w-3 h-3" /> },
    { value: 'usage-asc', label: 'Least Used', icon: <TrendingDown className="w-3 h-3" /> },
    { value: 'damage-desc', label: 'Highest Damage', icon: <Zap className="w-3 h-3" /> },
    { value: 'damage-asc', label: 'Lowest Damage', icon: <Zap className="w-3 h-3 opacity-50" /> },
    { value: 'cost-desc', label: 'Most Expensive', icon: <Flame className="w-3 h-3" /> },
    { value: 'cost-asc', label: 'Cheapest', icon: <Flame className="w-3 h-3 opacity-50" /> },
    { value: 'accuracy-desc', label: 'Most Accurate', icon: <Target className="w-3 h-3" /> },
    { value: 'accuracy-asc', label: 'Least Accurate', icon: <Target className="w-3 h-3 opacity-50" /> },
  ];

  const filterOptions: { value: MoveFilterOption; label: string; icon: React.ReactNode; color: string }[] = [
    { value: 'all', label: 'All', icon: null, color: '' },
    { value: 'melee', label: 'Melee', icon: <Zap className="w-3 h-3" />, color: 'text-orange-500' },
    { value: 'ranged', label: 'Ranged', icon: <Target className="w-3 h-3" />, color: 'text-blue-500' },
    { value: 'status', label: 'Status', icon: <Sparkles className="w-3 h-3" />, color: 'text-purple-500' },
    { value: 'heal', label: 'Heal', icon: <Heart className="w-3 h-3" />, color: 'text-green-500' },
    { value: 'damage', label: 'Damage', icon: <Zap className="w-3 h-3" />, color: 'text-red-500' },
    { value: 'buff', label: 'Buff', icon: <Shield className="w-3 h-3" />, color: 'text-emerald-500' },
    { value: 'debuff', label: 'Debuff', icon: <TrendingDown className="w-3 h-3" />, color: 'text-amber-500' },
    { value: 'status-effect', label: 'Status Effect', icon: <Flame className="w-3 h-3" />, color: 'text-pink-500' },
  ];

  const toggleFilter = (filter: MoveFilterOption) => {
    if (filter === 'all') {
      onFilterChange(['all']);
      return;
    }
    
    // Remove 'all' if selecting specific filter
    let newFilters = filters.filter((f): f is Exclude<MoveFilterOption, 'all'> => f !== 'all');
    
    if (newFilters.includes(filter as Exclude<MoveFilterOption, 'all'>)) {
      newFilters = newFilters.filter(f => f !== filter);
    } else {
      newFilters.push(filter as Exclude<MoveFilterOption, 'all'>);
    }
    
    // If no filters selected, default to 'all'
    if (newFilters.length === 0) {
      onFilterChange(['all']);
    } else {
      onFilterChange(newFilters);
    }
  };

  const currentSort = sortOptions.find(o => o.value === sortOption);
  const activeFilterCount = filters.includes('all') ? 0 : filters.length;

  return (
    <div className="flex items-center gap-1.5 flex-wrap justify-end">
      {/* Sort Dropdown */}
      <Popover open={sortOpen} onOpenChange={setSortOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-7 px-2 text-xs gap-1"
          >
            <ArrowUpDown className="w-3 h-3" />
            <span className="hidden sm:inline">
              {currentSort?.label || 'Sort'}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-44 p-1" align="start">
          {sortOptions.map(option => (
            <Button
              key={option.value}
              variant={sortOption === option.value ? "secondary" : "ghost"}
              size="sm"
              className="w-full justify-start h-8 text-xs gap-2"
              onClick={() => {
                onSortChange(option.value);
                setSortOpen(false);
              }}
            >
              {option.icon}
              {option.label}
              {sortOption === option.value && (
                <Check className="w-3 h-3 ml-auto" />
              )}
            </Button>
          ))}
        </PopoverContent>
      </Popover>

      {/* Filter Dropdown */}
      <Popover open={filterOpen} onOpenChange={setFilterOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className={`h-7 px-2 text-xs gap-1 ${activeFilterCount > 0 ? 'border-primary text-primary' : ''}`}
          >
            <Filter className="w-3 h-3" />
            <span className="hidden sm:inline">Filter</span>
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-1" align="start">
          {filterOptions.map(option => {
            const isActive = option.value === 'all' 
              ? filters.includes('all') 
              : filters.includes(option.value);
            
            return (
              <Button
                key={option.value}
                variant={isActive ? "secondary" : "ghost"}
                size="sm"
                className={`w-full justify-start h-8 text-xs gap-2 ${option.color}`}
                onClick={() => toggleFilter(option.value)}
              >
                {option.icon}
                {option.label}
                {isActive && (
                  <Check className="w-3 h-3 ml-auto" />
                )}
              </Button>
            );
          })}
        </PopoverContent>
      </Popover>

      {/* Active filter badges */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {filters.filter(f => f !== 'all').map(filter => {
            const opt = filterOptions.find(o => o.value === filter);
            return (
              <Badge 
                key={filter}
                variant="outline"
                className={`text-[10px] px-1.5 py-0 h-5 gap-1 cursor-pointer hover:bg-destructive/20 ${opt?.color || ''}`}
                onClick={() => toggleFilter(filter)}
              >
                {opt?.icon}
                {opt?.label}
                <X className="w-2.5 h-2.5" />
              </Badge>
            );
          })}
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-1 text-[10px] text-muted-foreground"
            onClick={() => onFilterChange(['all'])}
          >
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}

// Sort moves based on sort option
export function sortMoves(
  moves: Move[],
  sortOption: MoveSortOption,
  monster: Monster,
  customOrder: string[]
): Move[] {
  const sorted = [...moves];

  switch (sortOption) {
    case 'custom':
      return sorted.sort((a, b) => {
        const aIndex = customOrder.indexOf(a.id);
        const bIndex = customOrder.indexOf(b.id);
        if (aIndex === -1 && bIndex === -1) return 0;
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });

    case 'usage-desc':
      return sorted.sort((a, b) => {
        const aUses = monster.moveMastery?.[a.id]?.uses || 0;
        const bUses = monster.moveMastery?.[b.id]?.uses || 0;
        return bUses - aUses;
      });

    case 'usage-asc':
      return sorted.sort((a, b) => {
        const aUses = monster.moveMastery?.[a.id]?.uses || 0;
        const bUses = monster.moveMastery?.[b.id]?.uses || 0;
        return aUses - bUses;
      });

    case 'damage-desc':
      return sorted.sort((a, b) => b.power - a.power);

    case 'damage-asc':
      return sorted.sort((a, b) => a.power - b.power);

    case 'cost-desc':
      return sorted.sort((a, b) => b.staminaCost - a.staminaCost);

    case 'cost-asc':
      return sorted.sort((a, b) => a.staminaCost - b.staminaCost);

    case 'accuracy-desc':
      return sorted.sort((a, b) => b.accuracy - a.accuracy);

    case 'accuracy-asc':
      return sorted.sort((a, b) => a.accuracy - b.accuracy);

    default:
      return sorted;
  }
}

// Filter moves based on filter options
export function filterMoves(moves: Move[], filters: MoveFilterOption[]): Move[] {
  if (filters.includes('all') || filters.length === 0) {
    return moves;
  }

  return moves.filter(move => {
    for (const filter of filters) {
      switch (filter) {
        case 'melee':
          if (move.type === 'melee') return true;
          break;
        case 'ranged':
          if (move.type === 'ranged') return true;
          break;
        case 'status':
          if (move.type === 'status') return true;
          break;
        case 'heal':
          if (move.type === 'heal') return true;
          break;
        case 'damage':
          if (move.power > 0) return true;
          break;
        case 'buff':
          if (move.effect?.includes('raise_')) return true;
          break;
        case 'debuff':
          if (move.effect?.includes('lower_')) return true;
          break;
        case 'status-effect':
          if (move.effect && ['poison', 'burn', 'freeze', 'paralyze', 'confuse'].some(s => move.effect?.includes(s))) {
            return true;
          }
          break;
      }
    }
    return false;
  });
}
