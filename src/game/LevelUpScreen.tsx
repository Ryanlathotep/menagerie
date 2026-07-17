// Level Up Celebration Screen

import { Monster, MonsterStats, SPECIES_DATA } from './types';
import { MonsterSprite } from './sprites';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { X } from 'lucide-react';
import { getMonsterMoves, Move } from './moves';
import { useEffect, useState } from 'react';
import { useSettings } from './Settings';
import { formatLevel, formatLevelValue } from './levelDisplay';

interface StatChange {
  stat: string;
  label: string;
  before: number;
  after: number;
  color: string;
}

interface LevelUpScreenProps {
  monster: Monster;
  previousStats: MonsterStats;
  previousLevel: number;
  newMoves: Move[];
  onContinue: () => void;
  isPassive?: boolean; // True if this is a passive party member (not the active fighter)
}

export function LevelUpScreen({
  monster,
  previousStats,
  previousLevel,
  newMoves,
  onContinue,
  isPassive = false,
}: LevelUpScreenProps) {
  const [showStats, setShowStats] = useState(false);
  const [showMoves, setShowMoves] = useState(false);
  const speciesData = SPECIES_DATA[monster.species];
  const { settings } = useSettings();

  // Animate in the stats
  useEffect(() => {
    const statsTimer = setTimeout(() => setShowStats(true), 500);
    const movesTimer = setTimeout(() => setShowMoves(true), 1200);
    return () => {
      clearTimeout(statsTimer);
      clearTimeout(movesTimer);
    };
  }, []);

  const statChanges: StatChange[] = [
    { stat: 'maxHp', label: 'HP', before: previousStats.maxHp, after: monster.stats.maxHp, color: 'text-red-400' },
    { stat: 'attack', label: 'Attack', before: previousStats.attack, after: monster.stats.attack, color: 'text-orange-400' },
    { stat: 'defense', label: 'Defense', before: previousStats.defense, after: monster.stats.defense, color: 'text-blue-400' },
    { stat: 'speed', label: 'Speed', before: previousStats.speed, after: monster.stats.speed, color: 'text-yellow-400' },
    { stat: 'dodge', label: 'Dodge', before: previousStats.dodge ?? 0, after: monster.stats.dodge ?? 0, color: 'text-emerald-400' },
    { stat: 'special', label: 'Special', before: previousStats.special, after: monster.stats.special, color: 'text-purple-400' },
    { stat: 'stamina', label: 'Stamina', before: previousStats.stamina ?? 50, after: monster.stats.stamina ?? 50, color: 'text-cyan-400' },
  ];

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-start sm:items-center justify-center overflow-y-auto p-4">
      <Card className="max-w-md w-full my-4 p-6 space-y-6 animate-scale-in relative max-h-[calc(100vh-2rem)] overflow-y-auto">
        <button
          onClick={onContinue}
          aria-label="Close"
          className="absolute top-2 right-2 z-10 rounded-full p-1.5 bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
        {/* Header with monster sprite */}
        <div className="text-center space-y-4">
        <div className="text-center space-y-4">
          <div className="relative inline-block">
            <MonsterSprite
              species={monster.species}
              element={monster.element}
              classType={monster.class}
              size={120}
              animated={true}
            />
            <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full w-10 h-10 flex items-center justify-center font-bold text-lg animate-bounce">
              {formatLevelValue(monster.level, settings.levelDisplayMode)}
            </div>
          </div>
          
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 bg-clip-text text-transparent">
              LEVEL UP!
            </h1>
            <p className="text-lg text-muted-foreground">
              {speciesData.name} reached {formatLevel(monster.level, settings.levelDisplayMode)}!
            </p>
            {isPassive && (
              <p className="text-xs text-secondary mt-1">
                ✨ Gained experience from battle support
              </p>
            )}
          </div>
        </div>

        {/* Stat changes */}
        <div className={`space-y-2 transition-all duration-500 ${showStats ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase">Stat Increases</h3>
          <div className="grid grid-cols-2 gap-2">
            {statChanges.map((change, index) => {
              const diff = change.after - change.before;
              if (diff === 0) return null;
              return (
                <div
                  key={change.stat}
                  className="flex items-center justify-between p-2 bg-muted/50 rounded"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <span className={`text-sm ${change.color}`}>{change.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{change.before}</span>
                    <span className="text-xs text-muted-foreground">→</span>
                    <span className="text-sm font-bold">{change.after}</span>
                    <span className="text-xs text-green-400">+{diff}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* New moves */}
        {newMoves.length > 0 && (
          <div className={`space-y-2 transition-all duration-500 ${showMoves ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase">New Moves Learned!</h3>
            <div className="space-y-2">
              {newMoves.map((move) => (
                <div
                  key={move.id}
                  className="p-3 bg-primary/10 border border-primary/30 rounded-lg"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-primary">{move.name}</span>
                    <span className="text-xs text-muted-foreground capitalize">{move.type}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{move.description}</p>
                  <div className="flex gap-4 mt-2 text-xs">
                    {move.power > 0 && <span>Power: {move.power}</span>}
                    <span>Accuracy: {move.accuracy}%</span>
                    <span>Cost: {move.staminaCost}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Passive reminder */}
        <div className="p-3 bg-muted/30 rounded-lg">
          <p className="text-xs font-semibold text-primary">{speciesData.passiveAbility}</p>
          <p className="text-xs text-muted-foreground">{speciesData.passiveDescription}</p>
        </div>

        {/* Continue button */}
        <Button
          className="w-full bg-gradient-to-r from-primary to-secondary"
          onClick={onContinue}
        >
          Continue Adventure! ✨
        </Button>
      </Card>
    </div>
  );
}
