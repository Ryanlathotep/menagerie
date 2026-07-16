// Close Combat Switch Panel - Quick party switching during turn-based battles

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Monster } from './types';
import { MonsterSprite } from './sprites';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useSettings } from './Settings';
import { formatLevel } from './levelDisplay';

interface CombatSwitchPanelProps {
  party: Monster[];
  activeIndex: number;
  onSwitch: (index: number) => void;
  onCancel: () => void;
  disabled?: boolean;
}

export function CombatSwitchPanel({ 
  party, 
  activeIndex, 
  onSwitch, 
  onCancel,
  disabled = false 
}: CombatSwitchPanelProps) {
  const { settings } = useSettings();
  return (
    <Card className="p-3 bg-card/95 backdrop-blur-sm border-2 border-primary/30">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-primary">Switch Monster</h3>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      
      <p className="text-xs text-muted-foreground mb-3">
        Switching uses your turn. Choose wisely!
      </p>
      
      <div className="grid grid-cols-3 gap-2">
        {party.map((monster, index) => {
          const isActive = index === activeIndex;
          const isFainted = monster.stats.currentHp <= 0;
          const hpPercent = (monster.stats.currentHp / monster.stats.maxHp) * 100;
          
          return (
            <TooltipProvider key={index}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => !isActive && !isFainted && !disabled && onSwitch(index)}
                    disabled={isActive || isFainted || disabled}
                    className={`
                      p-2 rounded-lg border transition-all text-center
                      ${isActive 
                        ? 'bg-primary/20 border-primary ring-2 ring-primary/50' 
                        : isFainted 
                          ? 'bg-destructive/10 border-destructive/30 opacity-50 cursor-not-allowed' 
                          : 'bg-muted/50 border-border hover:bg-muted hover:border-primary/50 cursor-pointer'
                      }
                    `}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <MonsterSprite 
                        species={monster.species} 
                        element={monster.element} 
                        classType={monster.class} 
                        size={32}
                        animated={false}
                      />
                      <p className="text-[10px] font-medium truncate w-full capitalize">
                        {monster.species}
                      </p>
                      <div className="w-full">
                        <Progress 
                          value={hpPercent} 
                          className="h-1.5"
                        />
                        <p className="text-[8px] text-muted-foreground mt-0.5">
                          {monster.stats.currentHp}/{monster.stats.maxHp}
                        </p>
                      </div>
                    </div>
                    
                    {isActive && (
                      <span className="text-[8px] text-primary font-bold">ACTIVE</span>
                    )}
                    {isFainted && (
                      <span className="text-[8px] text-destructive font-bold">💀</span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="z-[100]">
                  <p className="font-semibold capitalize">{monster.species}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatLevel(monster.level, settings.levelDisplayMode)} • {monster.element} • {monster.class}
                  </p>
                  <div className="text-xs mt-1">
                    <span className="text-stat-hp">HP: {monster.stats.currentHp}/{monster.stats.maxHp}</span>
                    <span className="ml-2 text-stat-special">ST: {monster.stats.currentStamina}/{monster.stats.stamina}</span>
                  </div>
                  {isActive && <p className="text-xs text-primary mt-1">Currently active</p>}
                  {isFainted && <p className="text-xs text-destructive mt-1">Fainted - use revive item</p>}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
    </Card>
  );
}
