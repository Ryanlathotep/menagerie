// Status Effect and Buff/Debuff Display Component

import { 
  STATUS_EFFECT_CONFIG, 
  BUFF_CONFIG, 
  CombatEffects,
  StatusEffectType,
  BuffType,
} from './statusEffects';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface StatusEffectDisplayProps {
  effects: CombatEffects;
  compact?: boolean;
}

export function StatusEffectDisplay({ effects, compact = false }: StatusEffectDisplayProps) {
  const { statusEffects, statModifiers } = effects;
  
  if (statusEffects.length === 0 && statModifiers.length === 0) {
    return null;
  }
  
  return (
    <TooltipProvider>
      <div className={`flex flex-wrap gap-1 ${compact ? 'text-xs' : 'text-sm'}`}>
        {/* Status Effects */}
        {statusEffects.map((effect, i) => {
          const config = STATUS_EFFECT_CONFIG[effect.type as StatusEffectType];
          return (
            <Tooltip key={`status-${i}`}>
              <TooltipTrigger asChild>
                <span 
                  className={`px-1.5 py-0.5 rounded bg-muted/50 border border-border animate-pulse cursor-help`}
                >
                  {config.icon} {effect.turnsRemaining}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-semibold capitalize">{effect.type}</p>
                <p className="text-xs text-muted-foreground">{config.description}</p>
                <p className="text-xs mt-1">{effect.turnsRemaining} turn{effect.turnsRemaining !== 1 ? 's' : ''} remaining</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
        
        {/* Stat Modifiers */}
        {statModifiers.map((mod, i) => {
          const config = BUFF_CONFIG[mod.stat as BuffType];
          const colorClass = mod.direction === 'buff' ? config.buffColor : config.debuffColor;
          const arrow = mod.direction === 'buff' ? '↑' : '↓';
          return (
            <Tooltip key={`mod-${i}`}>
              <TooltipTrigger asChild>
                <span 
                  className={`px-1.5 py-0.5 rounded bg-muted/50 border border-border cursor-help ${colorClass}`}
                >
                  {config.icon}{arrow} {mod.turnsRemaining}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-semibold capitalize">
                  {mod.stat} {mod.direction === 'buff' ? 'Boost' : 'Penalty'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {mod.direction === 'buff' ? '+' : '-'}{mod.percentage}% {mod.stat}
                  {mod.stacks && mod.stacks > 1 ? ` (${mod.stacks} stacks)` : ''}
                </p>
                <p className="text-xs mt-1">{mod.turnsRemaining} turn{mod.turnsRemaining !== 1 ? 's' : ''} remaining</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

// Simple inline display for battle cards
export function StatusIcons({ effects }: { effects: CombatEffects }) {
  const { statusEffects, statModifiers } = effects;
  
  if (statusEffects.length === 0 && statModifiers.length === 0) {
    return null;
  }
  
  return (
    <div className="flex gap-0.5 flex-wrap">
      {statusEffects.map((effect, i) => {
        const config = STATUS_EFFECT_CONFIG[effect.type as StatusEffectType];
        return (
          <span key={`s-${i}`} className="text-sm" title={`${effect.type} (${effect.turnsRemaining} turns)`}>
            {config.icon}
          </span>
        );
      })}
      {statModifiers.map((mod, i) => {
        const config = BUFF_CONFIG[mod.stat as BuffType];
        const arrow = mod.direction === 'buff' ? '↑' : '↓';
        return (
          <span 
            key={`m-${i}`} 
            className={`text-sm ${mod.direction === 'buff' ? config.buffColor : config.debuffColor}`}
            title={`${mod.stat} ${mod.direction} ${mod.percentage}% (${mod.turnsRemaining} turns)`}
          >
            {config.icon}{arrow}
          </span>
        );
      })}
    </div>
  );
}
