// Battle Tooltip component for showing move details

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Move } from './moves';
import { Monster } from './types';
import { calculateHitChance, calculateExpectedDamage, getEffectiveness } from './combat';
import { getMasteryProgress, getHighestTier, TIER_COLORS, getTierDisplayName, MoveMastery } from './moveMastery';
import { MasteryDisplay, TierBadge } from './MasteryDisplay';
import { MoveShapeThumbnail } from './MoveShapeThumbnail';

interface MoveTooltipProps {
  move: Move;
  attacker: Monster;
  defender: Monster;
  children: React.ReactNode;
  mastery?: MoveMastery;
}

export function MoveTooltip({ move, attacker, defender, children, mastery }: MoveTooltipProps) {
  const hitChance = calculateHitChance(move, attacker, defender);
  const expectedDamage = calculateExpectedDamage(move, attacker, defender);
  const effectiveness = getEffectiveness(move, attacker, defender);
  const masteryProgress = getMasteryProgress(mastery);
  
  const effectivenessColors = {
    super: 'text-green-500',
    normal: 'text-muted-foreground',
    weak: 'text-red-500',
  };
  
  const overallEffectivenessColors = {
    'super-effective': 'text-green-400',
    'effective': 'text-green-500',
    'normal': 'text-muted-foreground',
    'weak': 'text-red-500',
  };
  
  const effectivenessLabels = {
    super: 'Super Effective!',
    normal: 'Normal',
    weak: 'Not Very Effective',
  };
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {children}
      </TooltipTrigger>
      <TooltipContent className="max-w-xs p-3 space-y-2" side="top">
        <div className="flex items-center justify-between gap-2">
          <div className="font-bold text-sm">{move.name}</div>
          <TierBadge tier={masteryProgress.tier} />
        </div>
        <div className="flex items-start gap-2">
          <p className="text-xs text-muted-foreground flex-1">{move.description}</p>
          <MoveShapeThumbnail move={move} />
        </div>
        
        <div className="border-t border-border pt-2 space-y-1 text-xs">
          {/* Damage after defense */}
          {move.power > 0 && (
            <div className="flex justify-between">
              <span>Expected Damage:</span>
              <span className="font-mono font-bold">{expectedDamage}</span>
            </div>
          )}
          
          {/* Hit chance after dodge */}
          <div className="flex justify-between">
            <span>Hit Chance:</span>
            <span className="font-mono font-bold">{hitChance}%</span>
          </div>
          
          {/* Stamina cost */}
          <div className="flex justify-between">
            <span>Stamina Cost:</span>
            <span className="font-mono">⚡{move.staminaCost}</span>
          </div>
          
          {/* Speed modifier */}
          {move.speedMod !== 0 && (
            <div className="flex justify-between">
              <span>Priority:</span>
              <span className="font-mono">{move.speedMod > 0 ? '+' : ''}{move.speedMod}</span>
            </div>
          )}
        </div>
        
        {/* Effectiveness indicators */}
        {(effectiveness.element !== 'normal' || effectiveness.class !== 'normal') && (
          <div className="border-t border-border pt-2 space-y-1 text-xs">
            {move.element && effectiveness.element !== 'normal' && (
              <div className={`flex items-center gap-1 ${effectivenessColors[effectiveness.element]}`}>
                <span>{effectiveness.element === 'super' ? '🔥' : '🛡️'}</span>
                <span>Element: {effectivenessLabels[effectiveness.element]}</span>
              </div>
            )}
            {move.classBonus && effectiveness.class !== 'normal' && (
              <div className={`flex items-center gap-1 ${effectivenessColors[effectiveness.class]}`}>
                <span>{effectiveness.class === 'super' ? '⚔️' : '🛡️'}</span>
                <span>Class: {effectivenessLabels[effectiveness.class]}</span>
              </div>
            )}
          </div>
        )}
        
        {/* Overall effectiveness */}
        <div className={`text-center font-bold ${overallEffectivenessColors[effectiveness.overall]}`}>
          {effectiveness.overall === 'super-effective' && '✨ SUPER EFFECTIVE! ✨'}
          {effectiveness.overall === 'effective' && '🔥 Effective!'}
          {effectiveness.overall === 'weak' && '⚠️ Not Very Effective...'}
        </div>
        
        {/* Special effect */}
        {move.effect && (
          <div className="text-xs text-accent">
            ✨ Effect: {move.effect.replace(/_/g, ' ')}
          </div>
        )}
        
        {/* Mastery Progress */}
        {mastery && (
          <div className="border-t border-border pt-2">
            <MasteryDisplay mastery={mastery} compact={false} />
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
