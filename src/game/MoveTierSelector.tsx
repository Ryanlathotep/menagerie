// Move Tier Selector - lets players choose which tier and variant to use

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Move } from './moves';
import { Monster } from './types';
import { 
  MoveTier, 
  MoveVariant, 
  EvolvedMove,
  getAvailableTiers,
  hasAoEUnlocked,
  createEvolvedMove,
  TIER_COLORS,
  TIER_BG_COLORS,
  getTierDisplayName,
  TIER_MULTIPLIERS,
  TIER_LEVEL_REQUIREMENTS,
  MoveMastery,
} from './moveMastery';
import { calculateExpectedDamage, calculateHitChance, getEffectiveness } from './combat';
import { ChevronLeft, Zap, Target, Users } from 'lucide-react';
import { MoveTagBadges } from './MoveTagBadges';


interface MoveTierSelectorProps {
  move: Move;
  mastery: MoveMastery | undefined;
  monster: Monster;
  enemy: Monster;
  currentStamina: number;
  onSelectMove: (evolvedMove: EvolvedMove) => void;
  onBack: () => void;
}

export function MoveTierSelector({
  move,
  mastery,
  monster,
  enemy,
  currentStamina,
  onSelectMove,
  onBack,
}: MoveTierSelectorProps) {
  const availableTiers = getAvailableTiers(mastery, monster.level);
  const canUseAoE = hasAoEUnlocked(mastery);
  
  // Generate all available versions
  const versions: EvolvedMove[] = [];
  
  // For status moves, just use the base version
  if (move.power === 0) {
    const baseVersion: EvolvedMove = {
      ...move,
      tier: 'base',
      variant: 'single',
      baseMoveId: move.id,
    };
    versions.push(baseVersion);
  } else {
    // Generate all tier/variant combinations
    for (const tier of availableTiers) {
      versions.push(createEvolvedMove(move, tier, 'single', monster.level));
      if (canUseAoE) {
        versions.push(createEvolvedMove(move, tier, 'mass', monster.level));
      }
    }
  }
  
  // Group by variant for display
  const singleVersions = versions.filter(v => v.variant === 'single');
  const massVersions = versions.filter(v => v.variant === 'mass');
  
  return (
    <Card className="p-4 space-y-3 bg-card/95 backdrop-blur border-2 border-primary/30">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-7 w-7 p-0"
          onClick={onBack}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="font-bold text-sm flex-1">{move.name}</h3>
        <Badge variant="outline" className="text-[10px]">
          {mastery?.uses || 0} uses
        </Badge>
      </div>
      
      <p className="text-xs text-muted-foreground">{move.description}</p>

      <MoveTagBadges move={move} size="sm" />

      
      {/* Single Target Versions */}
      <div className="space-y-2">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Target className="w-3 h-3" />
          <span>Single Target</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {singleVersions.map((version) => (
            <MoveVersionButton
              key={version.id}
              version={version}
              enemy={enemy}
              attacker={monster}
              currentStamina={currentStamina}
              onSelect={() => onSelectMove(version)}
            />
          ))}
        </div>
      </div>
      
      {/* Mass Versions */}
      {massVersions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="w-3 h-3" />
            <span>Mass (AoE)</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {massVersions.map((version) => (
              <MoveVersionButton
                key={version.id}
                version={version}
                enemy={enemy}
                attacker={monster}
                currentStamina={currentStamina}
                onSelect={() => onSelectMove(version)}
              />
            ))}
          </div>
        </div>
      )}
      
      {/* Locked tiers preview */}
      <LockedTiersPreview 
        mastery={mastery} 
        monsterLevel={monster.level}
        move={move}
      />
    </Card>
  );
}

// Individual move version button
function MoveVersionButton({
  version,
  enemy,
  attacker,
  currentStamina,
  onSelect,
}: {
  version: EvolvedMove;
  enemy: Monster;
  attacker: Monster;
  currentStamina: number;
  onSelect: () => void;
}) {
  const canAfford = version.staminaCost <= currentStamina;
  const damage = calculateExpectedDamage(version, attacker, enemy);
  const hitChance = calculateHitChance(version, attacker, enemy);
  const effectiveness = getEffectiveness(version, attacker, enemy);
  
  const effectivenessIndicator = 
    effectiveness.overall === 'super-effective' ? '🔥' :
    effectiveness.overall === 'effective' ? '✨' :
    effectiveness.overall === 'weak' ? '⬇️' : '';
  
  return (
    <Button
      variant={canAfford ? "outline" : "ghost"}
      className={`h-auto py-2 px-3 text-left flex-col items-start ${
        !canAfford ? 'opacity-50' : ''
      } ${TIER_BG_COLORS[version.tier]} hover:${TIER_BG_COLORS[version.tier]}`}
      onClick={onSelect}
      disabled={!canAfford}
    >
      <div className="flex items-center justify-between w-full gap-1">
        <span className={`font-semibold text-xs ${TIER_COLORS[version.tier]}`}>
          {effectivenessIndicator} {getTierDisplayName(version.tier)}
        </span>
        {version.variant === 'mass' && (
          <Badge variant="secondary" className="text-[8px] px-1 py-0">AoE</Badge>
        )}
      </div>
      <div className="flex gap-2 text-[10px] text-muted-foreground mt-1">
        <span title="Expected Damage">⚔️{damage}</span>
        <span title="Hit Chance">🎯{hitChance}%</span>
        <span title="Stamina Cost" className={!canAfford ? 'text-destructive' : ''}>
          ⚡{version.staminaCost}
        </span>
      </div>
    </Button>
  );
}

// Shows locked tiers and what's needed to unlock them
function LockedTiersPreview({
  mastery,
  monsterLevel,
  move,
}: {
  mastery: MoveMastery | undefined;
  monsterLevel: number;
  move: Move;
}) {
  const uses = mastery?.uses || 0;
  const MASTERY_THRESHOLDS: Record<MoveTier, number> = {
    lesser: 0,
    minor: 10,
    base: 25,
    greater: 50,
    omega: 100,
  };
  
  const allTiers: MoveTier[] = ['lesser', 'minor', 'base', 'greater', 'omega'];
  const lockedTiers = allTiers.filter(tier => {
    const masteryMet = uses >= MASTERY_THRESHOLDS[tier];
    const levelMet = monsterLevel >= TIER_LEVEL_REQUIREMENTS[tier];
    return !masteryMet || !levelMet;
  });
  
  const aoeUnlocked = uses >= 30;
  
  if (lockedTiers.length === 0 && aoeUnlocked) return null;
  
  return (
    <div className="border-t border-border pt-2 space-y-1">
      <p className="text-[10px] font-medium text-muted-foreground">🔒 Locked</p>
      <div className="flex flex-wrap gap-1">
        {lockedTiers.map(tier => {
          const needsUses = uses < MASTERY_THRESHOLDS[tier];
          const needsLevel = monsterLevel < TIER_LEVEL_REQUIREMENTS[tier];
          const usesNeeded = MASTERY_THRESHOLDS[tier] - uses;
          
          return (
            <Badge 
              key={tier}
              variant="outline" 
              className="text-[9px] text-muted-foreground/60 bg-muted/20"
              title={
                needsUses && needsLevel 
                  ? `Need ${usesNeeded} more uses & level ${TIER_LEVEL_REQUIREMENTS[tier]}`
                  : needsUses 
                    ? `Need ${usesNeeded} more uses`
                    : `Need level ${TIER_LEVEL_REQUIREMENTS[tier]}`
              }
            >
              {getTierDisplayName(tier)}
              {needsUses && <span className="ml-1">({usesNeeded})</span>}
              {needsLevel && !needsUses && <span className="ml-1">(Lv{TIER_LEVEL_REQUIREMENTS[tier]})</span>}
            </Badge>
          );
        })}
        {!aoeUnlocked && (
          <Badge 
            variant="outline" 
            className="text-[9px] text-muted-foreground/60 bg-muted/20"
            title={`Use this move ${30 - uses} more times to unlock Mass variant`}
          >
            Mass ({30 - uses})
          </Badge>
        )}
      </div>
    </div>
  );
}

// Compact button for the move list that shows tier upgrade availability
export function MoveWithTierIndicator({
  move,
  mastery,
  monsterLevel,
  onClick,
  children,
}: {
  move: Move;
  mastery: MoveMastery | undefined;
  monsterLevel: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const availableTiers = getAvailableTiers(mastery, monsterLevel);
  const canUseAoE = hasAoEUnlocked(mastery);
  const hasMultipleOptions = (move.power > 0 && availableTiers.length > 1) || canUseAoE;
  
  // Get highest tier for display
  const highestTier = availableTiers[availableTiers.length - 1];
  
  if (!hasMultipleOptions) {
    return <>{children}</>;
  }
  
  return (
    <div className="relative group">
      {children}
      {/* Tier upgrade indicator */}
      <div 
        className="absolute -top-1 -right-1 cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        <Badge 
          variant="outline"
          className={`text-[8px] px-1 py-0 ${TIER_COLORS[highestTier]} ${TIER_BG_COLORS[highestTier]} border-0 animate-pulse`}
        >
          {availableTiers.length > 1 && `+${availableTiers.length - 1}`}
          {canUseAoE && ' ⚔️'}
        </Badge>
      </div>
    </div>
  );
}
