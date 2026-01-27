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

// Inline display with turn counts for battle cards
export function StatusIcons({ effects, showTurns = true }: { effects: CombatEffects; showTurns?: boolean }) {
  const { statusEffects, statModifiers } = effects;
  
  if (statusEffects.length === 0 && statModifiers.length === 0) {
    return null;
  }
  
  return (
    <TooltipProvider>
      <div className="flex gap-1 flex-wrap">
        {statusEffects.map((effect, i) => {
          const config = STATUS_EFFECT_CONFIG[effect.type as StatusEffectType];
          return (
            <Tooltip key={`s-${i}`}>
              <TooltipTrigger asChild>
                <span 
                  className="inline-flex items-center gap-0.5 text-sm px-1 py-0.5 rounded bg-muted/60 border border-border cursor-help"
                >
                  {config.icon}
                  {showTurns && <span className="text-[10px] font-mono text-muted-foreground">{effect.turnsRemaining}</span>}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <p className="font-semibold capitalize">{effect.type}</p>
                <p className="text-muted-foreground">{config.description}</p>
                <p className="mt-1">{effect.turnsRemaining} turn{effect.turnsRemaining !== 1 ? 's' : ''} remaining</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
        {statModifiers.map((mod, i) => {
          const config = BUFF_CONFIG[mod.stat as BuffType];
          const arrow = mod.direction === 'buff' ? '↑' : '↓';
          const colorClass = mod.direction === 'buff' ? config.buffColor : config.debuffColor;
          return (
            <Tooltip key={`m-${i}`}>
              <TooltipTrigger asChild>
                <span 
                  className={`inline-flex items-center gap-0.5 text-sm px-1 py-0.5 rounded bg-muted/60 border border-border cursor-help ${colorClass}`}
                >
                  {config.icon}{arrow}
                  {showTurns && <span className="text-[10px] font-mono opacity-80">{mod.turnsRemaining}</span>}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <p className="font-semibold capitalize">{mod.stat} {mod.direction === 'buff' ? 'Boost' : 'Penalty'}</p>
                <p className="text-muted-foreground">
                  {mod.direction === 'buff' ? '+' : '-'}{mod.percentage}% {mod.stat}
                  {mod.stacks && mod.stacks > 1 ? ` (${mod.stacks} stacks)` : ''}
                </p>
                <p className="mt-1">{mod.turnsRemaining} turn{mod.turnsRemaining !== 1 ? 's' : ''} remaining</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
