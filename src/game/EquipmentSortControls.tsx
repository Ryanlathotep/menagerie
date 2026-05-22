// Equipment Sorting Controls Component

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ArrowDownAZ, ArrowUpAZ, Sparkles, SortAsc, Target } from 'lucide-react';
import { SortConfig, SortOption, AutoEquipFocus, AUTO_EQUIP_FOCUS_LABELS } from './equipmentUtils';
import { EquipmentStats } from './equipment';

interface EquipmentSortControlsProps {
  sortConfig: SortConfig;
  onSortChange: (config: SortConfig) => void;
  onAutoEquip: () => void;
  focus?: AutoEquipFocus;
  onFocusChange?: (focus: AutoEquipFocus) => void;
}


const SORT_OPTIONS: { value: SortOption; label: string; icon: string }[] = [
  { value: 'rarity', label: 'Rarity', icon: '💎' },
  { value: 'slot', label: 'Slot Type', icon: '🎽' },
  { value: 'level', label: 'Level', icon: '📊' },
  { value: 'stat', label: 'Stat', icon: '📈' },
  { value: 'set', label: 'Set', icon: '🔗' },
];

const STAT_OPTIONS: { value: keyof EquipmentStats; label: string }[] = [
  { value: 'attack', label: 'Attack' },
  { value: 'defense', label: 'Defense' },
  { value: 'maxHp', label: 'HP' },
  { value: 'speed', label: 'Speed' },
  { value: 'dodge', label: 'Dodge' },
  { value: 'special', label: 'Special' },
  { value: 'stamina', label: 'Stamina' },
];

const FOCUS_OPTIONS: AutoEquipFocus[] = ['class', 'tank', 'dps', 'aoe', 'speed', 'support', 'set'];

export function EquipmentSortControls({ sortConfig, onSortChange, onAutoEquip, focus, onFocusChange }: EquipmentSortControlsProps) {
  const currentOption = SORT_OPTIONS.find(o => o.value === sortConfig.option);


  
  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 text-xs">
            <SortAsc className="w-3 h-3 mr-1" />
            {currentOption?.icon} {currentOption?.label}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-40">
          <DropdownMenuLabel className="text-xs">Sort By</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {SORT_OPTIONS.map(option => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => onSortChange({ ...sortConfig, option: option.value })}
              className={sortConfig.option === option.value ? 'bg-accent' : ''}
            >
              <span className="mr-2">{option.icon}</span>
              {option.label}
            </DropdownMenuItem>
          ))}
          {sortConfig.option === 'stat' && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs">Stat Type</DropdownMenuLabel>
              {STAT_OPTIONS.map(stat => (
                <DropdownMenuItem
                  key={stat.value}
                  onClick={() => onSortChange({ ...sortConfig, statFilter: stat.value })}
                  className={sortConfig.statFilter === stat.value ? 'bg-accent' : ''}
                >
                  {stat.label}
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => onSortChange({ 
          ...sortConfig, 
          direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' 
        })}
        title={sortConfig.direction === 'asc' ? 'Ascending' : 'Descending'}
      >
        {sortConfig.direction === 'asc' ? (
          <ArrowUpAZ className="w-4 h-4" />
        ) : (
          <ArrowDownAZ className="w-4 h-4" />
        )}
      </Button>
      
      <Button
        variant="secondary"
        size="sm"
        className="h-8 text-xs ml-auto"
        onClick={onAutoEquip}
      >
        <Sparkles className="w-3 h-3 mr-1" />
        Auto-Equip
      </Button>
    </div>
  );
}
