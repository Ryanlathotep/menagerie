// Modal for selecting which fainted party member to revive

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
import { useSettings } from './Settings';
import { formatLevel } from './levelDisplay';

interface ReviveTargetModalProps {
  open: boolean;
  onClose: () => void;
  party: Monster[];
  revivePercent: number;  // How much HP to restore (as percentage)
  itemName: string;
  onRevive: (partyIndex: number) => void;
}

export function ReviveTargetModal({
  open,
  onClose,
  party,
  revivePercent,
  itemName,
  onRevive,
}: ReviveTargetModalProps) {
  const { settings } = useSettings();
  // Get fainted party members
  const faintedMembers = party
    .map((monster, index) => ({ monster, index }))
    .filter(({ monster }) => monster.stats.currentHp <= 0);

  const handleRevive = (index: number) => {
    onRevive(index);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            🌿 Use {itemName}
          </DialogTitle>
          <DialogDescription>
            Select a fainted party member to revive with {revivePercent}% HP.
          </DialogDescription>
        </DialogHeader>

        {faintedMembers.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-muted-foreground">No fainted party members to revive!</p>
            <Button variant="outline" className="mt-4" onClick={onClose}>
              Cancel
            </Button>
          </div>
        ) : (
          <>
            <ScrollArea className="max-h-[300px] pr-2">
              <div className="space-y-2">
                {faintedMembers.map(({ monster, index }) => {
                  const revivedHp = Math.max(1, Math.floor(monster.stats.maxHp * (revivePercent / 100)));
                  
                  return (
                    <button
                      key={monster.id}
                      onClick={() => handleRevive(index)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors border border-border"
                    >
                      {/* Monster sprite - grayscale since fainted */}
                      <div className="grayscale">
                        <MonsterSprite
                          species={monster.species}
                          element={monster.element}
                          classType={monster.class}
                          size={48}
                        />
                      </div>
                      
                      {/* Info */}
                      <div className="flex-1 text-left">
                        <p className="font-medium capitalize">{monster.species}</p>
                        <p className="text-xs text-muted-foreground">{formatLevel(monster.level, settings.levelDisplayMode)}</p>
                        <div className="flex gap-1 mt-1">
                          <span className="text-[10px] px-1 py-0.5 rounded bg-secondary capitalize">
                            {monster.element}
                          </span>
                          <span className="text-[10px] px-1 py-0.5 rounded bg-secondary capitalize">
                            {monster.class}
                          </span>
                        </div>
                      </div>
                      
                      {/* Revive preview */}
                      <div className="text-right">
                        <p className="text-xs text-destructive">💀 Fainted</p>
                        <p className="text-xs text-green-500 mt-1">
                          → Will have {revivedHp} HP
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
            
            <Button variant="outline" onClick={onClose} className="w-full">
              Cancel
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
