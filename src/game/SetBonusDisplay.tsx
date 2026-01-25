// Set Bonus Display Component - Shows active and potential set bonuses

import { MonsterEquipment, EquipmentStats, calculateSetBonuses, ActiveSetBonus, EQUIPMENT_SETS, SetId } from './equipment';
import { CheckCircle2, Circle } from 'lucide-react';

interface SetBonusDisplayProps {
  equipment: MonsterEquipment;
  compact?: boolean;
}

// Stat abbreviations for display
const STAT_ABBREV: Record<keyof EquipmentStats, string> = {
  maxHp: 'HP',
  attack: 'ATK',
  defense: 'DEF',
  speed: 'SPD',
  dodge: 'DDG',
  special: 'SPC',
  stamina: 'STA',
};

function formatStats(stats: EquipmentStats): string {
  return Object.entries(stats)
    .filter(([_, v]) => v && v !== 0)
    .map(([k, v]) => `+${v} ${STAT_ABBREV[k as keyof EquipmentStats]}`)
    .join(', ');
}

export function SetBonusDisplay({ equipment, compact = false }: SetBonusDisplayProps) {
  const activeSetBonuses = calculateSetBonuses(equipment);
  
  if (activeSetBonuses.length === 0) {
    if (compact) return null;
    return (
      <div className="text-xs text-muted-foreground italic p-2">
        No set bonuses active. Equip 2+ pieces from the same set.
      </div>
    );
  }
  
  return (
    <div className="space-y-2">
      {activeSetBonuses.map(({ set, equippedCount, activeBonuses }) => (
        <div 
          key={set.id}
          className="p-2 rounded-lg border"
          style={{ 
            backgroundColor: `hsl(${set.color} / 0.1)`,
            borderColor: `hsl(${set.color} / 0.4)`,
          }}
        >
          {/* Set header */}
          <div className="flex items-center gap-2 mb-1">
            <span 
              className="text-xs font-bold"
              style={{ color: `hsl(${set.color})` }}
            >
              {set.name}
            </span>
            <span className="text-[10px] text-muted-foreground">
              ({equippedCount}/8 pieces)
            </span>
          </div>
          
          {/* Bonus tiers */}
          <div className="space-y-1">
            {set.bonuses.map((bonus) => {
              const isActive = equippedCount >= bonus.pieces;
              return (
                <div 
                  key={bonus.pieces}
                  className={`flex items-start gap-1.5 text-[10px] ${
                    isActive ? 'text-foreground' : 'text-muted-foreground/50'
                  }`}
                >
                  {isActive ? (
                    <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className={`font-medium ${isActive ? '' : 'opacity-60'}`}>
                      ({bonus.pieces}):
                    </span>
                    {bonus.stats && (
                      <span className={isActive ? 'text-green-400' : ''}>
                        {' '}{formatStats(bonus.stats)}
                      </span>
                    )}
                    {bonus.special && (
                      <span className={`italic ${isActive ? 'text-amber-400' : ''}`}>
                        {bonus.stats ? ' • ' : ' '}{bonus.special}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// Compact badge showing set membership on an item
interface SetBadgeProps {
  setId: SetId;
  size?: 'sm' | 'md';
}

export function SetBadge({ setId, size = 'sm' }: SetBadgeProps) {
  const set = EQUIPMENT_SETS[setId];
  if (!set) return null;
  
  const sizeClasses = size === 'sm' 
    ? 'text-[8px] px-1 py-0' 
    : 'text-[10px] px-1.5 py-0.5';
  
  return (
    <span 
      className={`rounded font-medium ${sizeClasses}`}
      style={{ 
        backgroundColor: `hsl(${set.color} / 0.2)`,
        color: `hsl(${set.color})`,
        border: `1px solid hsl(${set.color} / 0.4)`,
      }}
    >
      {set.name.split(' ')[0]}
    </span>
  );
}

// Summary display for total set bonus stats
interface SetBonusSummaryProps {
  equipment: MonsterEquipment;
}

export function SetBonusSummary({ equipment }: SetBonusSummaryProps) {
  const activeSetBonuses = calculateSetBonuses(equipment);
  
  if (activeSetBonuses.length === 0) return null;
  
  // Calculate total stats from all active set bonuses
  const totalStats: EquipmentStats = {
    maxHp: 0, attack: 0, defense: 0, speed: 0, dodge: 0, special: 0, stamina: 0
  };
  
  for (const { totalStats: setStats } of activeSetBonuses) {
    for (const [stat, value] of Object.entries(setStats) as [keyof EquipmentStats, number][]) {
      if (value) totalStats[stat] = (totalStats[stat] || 0) + value;
    }
  }
  
  const statsString = formatStats(totalStats);
  if (!statsString) return null;
  
  return (
    <div className="text-[10px] text-amber-400 font-medium">
      Set Bonuses: {statsString}
    </div>
  );
}
