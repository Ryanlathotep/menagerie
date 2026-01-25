// Modal that appears when active monster is defeated - allows switching to another party member

import { Monster } from './types';
import { MonsterSprite } from './sprites';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PartySwitchModalProps {
  open: boolean;
  party: Monster[];
  defeatedIndex: number;
  onSwitch: (index: number) => void;
  onSurrender: () => void;
}

export function PartySwitchModal({
  open,
  party,
  defeatedIndex,
  onSwitch,
  onSurrender,
}: PartySwitchModalProps) {
  // Get alive party members (excluding the defeated one)
  const aliveMembers = party
    .map((monster, index) => ({ monster, index }))
    .filter(({ monster, index }) => index !== defeatedIndex && monster.stats.currentHp > 0);

  const defeatedMonster = party[defeatedIndex];

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-destructive flex items-center gap-2">
            💀 {defeatedMonster?.name || 'Monster'} was defeated!
          </DialogTitle>
          <DialogDescription>
            Choose another party member to continue the battle.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[300px] pr-2">
          <div className="space-y-2">
            {aliveMembers.map(({ monster, index }) => {
              const hpPercent = (monster.stats.currentHp / monster.stats.maxHp) * 100;
              
              return (
                <button
                  key={monster.id}
                  onClick={() => onSwitch(index)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors border border-border"
                >
                  {/* Monster sprite */}
                  <MonsterSprite
                    species={monster.species}
                    element={monster.element}
                    classType={monster.class}
                    size={48}
                    animated
                  />
                  
                  {/* Info */}
                  <div className="flex-1 text-left">
                    <p className="font-medium capitalize">{monster.species}</p>
                    <p className="text-xs text-muted-foreground">Lv.{monster.level}</p>
                    <div className="flex gap-1 mt-1">
                      <span className="text-[10px] px-1 py-0.5 rounded bg-secondary capitalize">
                        {monster.element}
                      </span>
                      <span className="text-[10px] px-1 py-0.5 rounded bg-secondary capitalize">
                        {monster.class}
                      </span>
                    </div>
                  </div>
                  
                  {/* Stats */}
                  <div className="text-right">
                    {/* HP bar */}
                    <div className="w-20">
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all ${
                            hpPercent > 50 ? 'bg-green-500' : 
                            hpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${hpPercent}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {monster.stats.currentHp}/{monster.stats.maxHp} HP
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {monster.stats.currentStamina ?? monster.stats.stamina}/{monster.stats.stamina} ST
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>

        {aliveMembers.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-destructive font-medium mb-4">
              No party members remaining!
            </p>
            <Button variant="destructive" onClick={onSurrender}>
              End Run
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center">
            Select a party member to send into battle
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
