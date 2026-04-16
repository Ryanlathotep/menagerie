// Party management panel - shows party members and allows switching

import { Monster, SPECIES_DATA } from './types';
import { MonsterSprite } from './sprites';
import { ScrollArea } from '@/components/ui/scroll-area';
import { xpToNextLevel } from './combat';
import { CombatEffects, EMPTY_COMBAT_EFFECTS } from './statusEffects';
import { StatusIcons } from './StatusEffectDisplay';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface PartyPanelProps {
  party: Monster[];
  activeIndex: number;
  activeXp?: number; // Current XP of the active monster (from run.experience)
  onSwitch: (index: number) => void;
  maxPartySize?: number;
  // Combat effects for each party member (indexed by party position)
  partyEffects?: CombatEffects[];
}

export function PartyPanel({
  party,
  activeIndex,
  activeXp = 0,
  onSwitch,
  maxPartySize = 6,
  partyEffects = [],
}: PartyPanelProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase">
          Party ({party.length}/{maxPartySize})
        </h3>
      </div>
      
      <ScrollArea className="h-[180px]">
        <div className="space-y-1">
        {party.map((monster, index) => {
            const isActive = index === activeIndex;
            const isDead = monster.stats.currentHp <= 0;
            const hpPercent = (monster.stats.currentHp / monster.stats.maxHp) * 100;
            const effects = partyEffects[index] || EMPTY_COMBAT_EFFECTS;
            const hasEffects = effects.statusEffects.length > 0 || effects.statModifiers.length > 0;
            
            // XP: use activeXp for active monster, monster.experience for others
            const currentXp = isActive ? activeXp : (monster.experience || 0);
            const xpNeeded = xpToNextLevel(monster.level);
            const xpPercent = Math.min((currentXp / xpNeeded) * 100, 100);
            
            return (
              <TooltipProvider key={monster.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => !isDead && onSwitch(index)}
                      disabled={isDead}
                      className={`
                        w-full flex items-center gap-2 p-1.5 rounded-lg transition-all
                        ${isActive 
                          ? 'bg-primary/20 ring-2 ring-primary' 
                          : isDead 
                            ? 'bg-muted/30 opacity-50 cursor-not-allowed' 
                            : 'hover:bg-muted/50 cursor-pointer'
                        }
                      `}
                    >
                      {/* Monster sprite */}
                      <div className={`relative ${isDead ? 'grayscale' : ''}`}>
                        <MonsterSprite
                          species={monster.species}
                          element={monster.element}
                          classType={monster.class}
                          size={32}
                          animated={isActive}
                        />
                        {isActive && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full animate-pulse" />
                        )}
                      </div>
                      
                      {/* Info */}
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-xs font-medium truncate capitalize">
                          {monster.species}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Lv.{monster.level}
                        </p>
                      </div>
                      
                      {/* HP + XP bars */}
                      <div className="w-14 space-y-0.5">
                        {/* HP bar */}
                        <div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all ${
                                hpPercent > 50 ? 'bg-green-500' : 
                                hpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${hpPercent}%` }}
                            />
                          </div>
                        </div>
                        {/* XP bar */}
                        <div>
                          <div className="h-1 bg-muted rounded-full overflow-hidden" title={`XP: ${currentXp}/${xpNeeded}`}>
                            <div 
                              className="h-full bg-secondary transition-all"
                              style={{ width: `${xpPercent}%` }}
                            />
                          </div>
                        </div>
                        <p className="text-[8px] text-muted-foreground text-center">
                          {monster.stats.currentHp}/{monster.stats.maxHp}
                        </p>
                        {/* Status effects/buffs display */}
                        {hasEffects && (
                          <div className="mt-0.5">
                            <StatusIcons effects={effects} showTurns={true} />
                          </div>
                        )}
                      </div>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="p-2 max-w-[220px]">
                    <div className="space-y-1">
                      <p className="font-bold text-sm">{monster.name}</p>
                      <div className="flex gap-1">
                        <span className={`text-[10px] px-1 py-0.5 rounded bg-secondary capitalize`}>
                          {monster.element}
                        </span>
                        <span className="text-[10px] px-1 py-0.5 rounded bg-secondary capitalize">
                          {monster.class}
                        </span>
                      </div>
                      {/* Passive */}
                      <div className="bg-primary/10 rounded px-1.5 py-1 border border-primary/20">
                        <p className="text-[10px] font-bold text-primary">✨ {SPECIES_DATA[monster.species].passiveAbility}</p>
                        <p className="text-[9px] text-muted-foreground">{SPECIES_DATA[monster.species].passiveDescription}</p>
                      </div>
                      <div className="text-[10px] text-muted-foreground space-y-0.5">
                        <p>HP: {monster.stats.currentHp}/{monster.stats.maxHp}</p>
                        <p>ST: {monster.stats.currentStamina}/{monster.stats.stamina}</p>
                        <p>XP: {currentXp}/{xpNeeded}</p>
                        <p>ATK: {monster.stats.attack} | DEF: {monster.stats.defense}</p>
                        <p>SPD: {monster.stats.speed} | DOD: {monster.stats.dodge}</p>
                      </div>
                      {isDead && (
                        <p className="text-xs text-destructive font-medium">💀 Fainted</p>
                      )}
                      {isActive && !isDead && (
                        <p className="text-xs text-primary font-medium">⭐ Active</p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
          
          {/* Empty slots */}
          {Array.from({ length: maxPartySize - party.length }).map((_, i) => (
            <div 
              key={`empty-${i}`}
              className="w-full flex items-center gap-2 p-1.5 rounded-lg border border-dashed border-muted-foreground/30 opacity-50"
            >
              <div className="w-8 h-8 rounded-full bg-muted/30 flex items-center justify-center">
                <span className="text-muted-foreground text-xs">?</span>
              </div>
              <span className="text-xs text-muted-foreground">Empty slot</span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
