// Elevator Modal - Select a party member to send back to town

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Monster } from './types';
import { MonsterSprite } from './sprites';
import { MonsterEquipment, SLOT_INFO, EquipmentSlot } from './equipment';

interface ElevatorModalProps {
  party: Monster[];
  partyEquipment: MonsterEquipment[];
  activeIndex: number;
  unlockedMonsters: { comboId: string; level: number }[];
  onSend: (partyIndex: number) => void;
  onClose: () => void;
}

export function ElevatorModal({
  party,
  partyEquipment,
  activeIndex,
  unlockedMonsters,
  onSend,
  onClose,
}: ElevatorModalProps) {
  // Can't use elevator with only 1 party member
  if (party.length <= 1) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <Card className="p-4 max-w-md text-center space-y-4 max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain">
          <h2 className="text-lg font-bold text-violet-500">🛗 Elevator</h2>
          <p className="text-sm text-muted-foreground">
            You need at least 2 party members to use the elevator. 
            You can't send your last monster back to town!
          </p>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </Card>
      </div>
    );
  }
  
  const getUnlockStatus = (monster: Monster) => {
    const comboId = `${monster.species}_${monster.element}_${monster.class}`;
    const existing = unlockedMonsters.find(m => m.comboId === comboId);
    
    if (!existing) {
      return { isNew: true, levelUp: false, message: '✨ New Unlock!' };
    } else if (monster.level > existing.level) {
      return { isNew: false, levelUp: true, message: `📈 Level ${existing.level} → ${monster.level}` };
    }
    return { isNew: false, levelUp: false, message: `Already Lv.${existing.level}` };
  };
  
  const getEquippedCount = (index: number) => {
    const equipment = partyEquipment[index];
    if (!equipment) return 0;
    const slots: EquipmentSlot[] = ['helmet', 'armor', 'mainHand', 'offHand', 'gloves', 'boots', 'accessory', 'back'];
    return slots.filter(s => equipment[s] !== null).length;
  };
  
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="p-4 max-w-lg w-full space-y-4 max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain">
        <div className="text-center">
          <h2 className="text-lg font-bold bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text text-transparent">
            🛗 Town Elevator
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Send a party member back to town. They'll unlock in your roster and their equipment will be stored.
          </p>
        </div>
        
        <ScrollArea className="max-h-[50vh]">
          <div className="space-y-2 pr-2">
            {party.map((monster, index) => {
              const isActive = index === activeIndex;
              const status = getUnlockStatus(monster);
              const equippedCount = getEquippedCount(index);
              const isFainted = monster.stats.currentHp <= 0;
              
              return (
                <div
                  key={monster.id}
                  className={`p-3 rounded-lg border transition-all ${
                    isActive 
                      ? 'border-primary/50 bg-primary/5' 
                      : isFainted
                        ? 'border-muted bg-muted/30 opacity-60'
                        : 'border-border hover:border-violet-400 hover:bg-violet-50/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <MonsterSprite
                      species={monster.species}
                      element={monster.element}
                      classType={monster.class}
                      size={48}
                    />
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm truncate">{monster.name}</h3>
                        {isActive && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-primary/20 text-primary rounded">Active</span>
                        )}
                        {isFainted && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-destructive/20 text-destructive rounded">Fainted</span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                        <span className={`element-badge element-${monster.element} px-1 py-0`}>
                          {monster.element}
                        </span>
                        <span>{monster.class}</span>
                        <span>Lv.{monster.level}</span>
                        {equippedCount > 0 && (
                          <span className="text-amber-600">⚔️ {equippedCount} gear</span>
                        )}
                      </div>
                      
                      <p className={`text-[10px] mt-1 ${status.isNew ? 'text-green-500 font-medium' : status.levelUp ? 'text-blue-500 font-medium' : 'text-muted-foreground'}`}>
                        {status.message}
                      </p>
                    </div>
                    
                    <Button
                      size="sm"
                      variant={status.isNew || status.levelUp ? 'default' : 'outline'}
                      className={`h-8 text-xs ${status.isNew ? 'bg-green-500 hover:bg-green-600' : status.levelUp ? 'bg-blue-500 hover:bg-blue-600' : ''}`}
                      onClick={() => onSend(index)}
                    >
                      Send Home
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
        
        <div className="flex justify-center">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </Card>
    </div>
  );
}
