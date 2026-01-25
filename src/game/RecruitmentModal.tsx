// Recruitment modal - shown after impressive defeats

import { Monster, SPECIES_DATA } from './types';
import { MonsterSprite } from './sprites';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface RecruitmentModalProps {
  enemy: Monster;
  recruitChance: number;
  impressiveStats: {
    turnsUsed: number;
    overkillDamage: number;
    statusEffectsApplied: number;
    criticalHits: number;
  };
  partyFull: boolean;
  onRecruit: () => void;
  onDismiss: () => void;
}

export function RecruitmentModal({
  enemy,
  recruitChance,
  impressiveStats,
  partyFull,
  onRecruit,
  onDismiss,
}: RecruitmentModalProps) {
  const speciesData = SPECIES_DATA[enemy.species];
  const willJoin = Math.random() * 100 < recruitChance;
  
  // Visual breakdown of what made it impressive
  const impressiveFactors = [];
  if (impressiveStats.turnsUsed <= 2) {
    impressiveFactors.push({ icon: '⚡', label: 'Quick Victory', detail: `${impressiveStats.turnsUsed} turns` });
  }
  if (impressiveStats.overkillDamage >= 20) {
    impressiveFactors.push({ icon: '💥', label: 'Overwhelming Power', detail: `+${impressiveStats.overkillDamage} overkill` });
  }
  if (impressiveStats.statusEffectsApplied >= 2) {
    impressiveFactors.push({ icon: '🌀', label: 'Status Master', detail: `${impressiveStats.statusEffectsApplied} effects` });
  }
  if (impressiveStats.criticalHits >= 2) {
    impressiveFactors.push({ icon: '✨', label: 'Critical Strikes', detail: `${impressiveStats.criticalHits} crits` });
  }
  
  return (
    <div className="fixed inset-0 bg-background/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 space-y-4">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-xl font-bold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
            Impressive Victory!
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            The defeated monster is considering joining you!
          </p>
        </div>
        
        {/* Monster preview */}
        <div className="flex items-center justify-center gap-4 py-4">
          <div className="text-center">
            <MonsterSprite
              species={enemy.species}
              element={enemy.element}
              classType={enemy.class}
              size={80}
              animated
            />
            <p className="font-bold mt-2 capitalize">{enemy.name}</p>
            <p className="text-xs text-muted-foreground">Lv.{enemy.level}</p>
            <div className="flex gap-1 justify-center mt-1">
              <span className={`text-[10px] px-1.5 py-0.5 rounded bg-secondary capitalize`}>
                {enemy.element}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary capitalize">
                {enemy.class}
              </span>
            </div>
          </div>
        </div>
        
        {/* Passive ability */}
        <div className="p-2 bg-muted/50 rounded-lg text-center">
          <p className="text-xs font-semibold text-primary">{speciesData.passiveAbility}</p>
          <p className="text-[10px] text-muted-foreground">{speciesData.passiveDescription}</p>
        </div>
        
        {/* Impressive factors */}
        {impressiveFactors.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase">What impressed them:</p>
            <div className="flex flex-wrap gap-2">
              {impressiveFactors.map((factor, i) => (
                <div 
                  key={i}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-primary/10 text-xs"
                >
                  <span>{factor.icon}</span>
                  <span className="font-medium">{factor.label}</span>
                  <span className="text-muted-foreground">({factor.detail})</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Recruitment chance */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Recruitment Chance</span>
            <span className={`font-bold ${
              recruitChance >= 70 ? 'text-green-500' : 
              recruitChance >= 40 ? 'text-yellow-500' : 'text-red-500'
            }`}>
              {Math.round(recruitChance)}%
            </span>
          </div>
          <Progress value={recruitChance} className="h-2" />
        </div>
        
        {/* Actions */}
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={onDismiss}
          >
            Leave
          </Button>
          <Button 
            className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500"
            onClick={onRecruit}
            disabled={partyFull}
          >
            {partyFull ? 'Party Full!' : '🤝 Recruit!'}
          </Button>
        </div>
        
        {partyFull && (
          <p className="text-xs text-center text-destructive">
            Your party is full (6/6). You cannot recruit more monsters.
          </p>
        )}
      </Card>
    </div>
  );
}

// Calculate recruitment chance based on battle performance
export function calculateRecruitChance(stats: {
  turnsUsed: number;
  overkillDamage: number;
  statusEffectsApplied: number;
  criticalHits: number;
  playerHpPercent: number;
  enemyLevel: number;
  playerLevel: number;
}): number {
  let chance = 20; // Base 20% chance
  
  // Quick victory bonus (fewer turns = better)
  if (stats.turnsUsed <= 1) chance += 30;
  else if (stats.turnsUsed <= 2) chance += 20;
  else if (stats.turnsUsed <= 3) chance += 10;
  else if (stats.turnsUsed >= 8) chance -= 10;
  
  // Overkill bonus (decisive victory)
  if (stats.overkillDamage >= 50) chance += 15;
  else if (stats.overkillDamage >= 30) chance += 10;
  else if (stats.overkillDamage >= 15) chance += 5;
  
  // Status effect mastery
  chance += Math.min(15, stats.statusEffectsApplied * 5);
  
  // Critical hit bonus
  chance += Math.min(10, stats.criticalHits * 3);
  
  // Staying healthy bonus
  if (stats.playerHpPercent >= 90) chance += 10;
  else if (stats.playerHpPercent >= 70) chance += 5;
  else if (stats.playerHpPercent < 30) chance -= 10;
  
  // Level difference penalty/bonus
  const levelDiff = stats.playerLevel - stats.enemyLevel;
  if (levelDiff < 0) {
    // Fighting higher level = more impressive
    chance += Math.min(15, Math.abs(levelDiff) * 5);
  } else if (levelDiff > 2) {
    // Bullying much weaker = less impressive
    chance -= Math.min(20, levelDiff * 3);
  }
  
  // Clamp to reasonable range
  return Math.max(5, Math.min(95, chance));
}
