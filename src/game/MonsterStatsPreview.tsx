// Monster Stats Preview for Character Selection

import { SpeciesType, ClassType, ElementType, SPECIES_DATA } from './types';
import { calculateStats } from './utils';
import { getMonsterMoves, Move } from './moves';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface StatDisplay {
  key: string;
  label: string;
  abbr: string;
  value: number;
  maxValue: number;
  color: string;
}

interface MonsterStatsPreviewProps {
  species: SpeciesType;
  classType: ClassType;
  element: ElementType;
  level: number;
}

export function MonsterStatsPreview({
  species,
  classType,
  element,
  level,
}: MonsterStatsPreviewProps) {
  const stats = calculateStats(species, classType, level);
  const speciesData = SPECIES_DATA[species];
  const moves = getMonsterMoves(species, element, classType);

  // Calculate max values for bars (rough scaling)
  const maxStat = 80; // Reasonable max for level 1-10

  const statDisplays: StatDisplay[] = [
    { key: 'hp', label: 'Health', abbr: 'HP', value: stats.maxHp, maxValue: 100, color: 'bg-red-500' },
    { key: 'attack', label: 'Attack', abbr: 'ATK', value: stats.attack, maxValue: maxStat, color: 'bg-orange-500' },
    { key: 'defense', label: 'Defense', abbr: 'DEF', value: stats.defense, maxValue: maxStat, color: 'bg-blue-500' },
    { key: 'speed', label: 'Speed', abbr: 'SPD', value: stats.speed, maxValue: maxStat, color: 'bg-yellow-500' },
    { key: 'dodge', label: 'Dodge', abbr: 'DDG', value: stats.dodge, maxValue: maxStat, color: 'bg-emerald-500' },
    { key: 'special', label: 'Special', abbr: 'SPC', value: stats.special, maxValue: maxStat, color: 'bg-purple-500' },
    { key: 'stamina', label: 'Stamina', abbr: 'STA', value: stats.stamina, maxValue: 60, color: 'bg-cyan-500' },
  ];

  return (
    <div className="space-y-4">
      {/* Stats Grid */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Base Stats</h4>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {statDisplays.map((stat) => (
            <div key={stat.key} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-7">{stat.abbr}</span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full ${stat.color} transition-all`}
                  style={{ width: `${Math.min((stat.value / stat.maxValue) * 100, 100)}%` }}
                />
              </div>
              <span className="text-xs font-mono w-6 text-right">{stat.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Passive Ability */}
      <div className="p-2 bg-primary/10 rounded border border-primary/20">
        <p className="text-xs font-semibold text-primary">{speciesData.passiveAbility}</p>
        <p className="text-[10px] text-muted-foreground">{speciesData.passiveDescription}</p>
      </div>

      {/* Starting Moves */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
          Starting Moves ({moves.length})
        </h4>
        <div className="grid grid-cols-2 gap-1.5">
          {moves.slice(0, 4).map((move) => (
            <div
              key={move.id}
              className="p-1.5 bg-muted/50 rounded text-xs"
              title={move.description}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium truncate">{move.name}</span>
              </div>
              <div className="flex gap-2 text-[10px] text-muted-foreground mt-0.5">
                {move.power > 0 && <span>⚔️{move.power}</span>}
                <span>🎯{move.accuracy}%</span>
                <span>⚡{move.staminaCost}</span>
              </div>
            </div>
          ))}
        </div>
        {moves.length > 4 && (
          <p className="text-[10px] text-muted-foreground mt-1 text-center">
            +{moves.length - 4} more moves
          </p>
        )}
      </div>
    </div>
  );
}
