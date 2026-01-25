// Pre-Run Equipment Selection - Equip gear from town storage before starting a run

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  EquipmentItem, 
  EquipmentSlot,
  MonsterEquipment, 
  SLOT_INFO, 
  createEmptyEquipment,
  calculateEquipmentBonuses,
} from './equipment';
import { Monster } from './types';
import { MonsterSprite } from './sprites';
import { ArrowLeft, Play, Shirt } from 'lucide-react';
import { EquippedSlotDisplay, DraggableEquipmentItem, DragData } from './DraggableEquipmentItem';
import { EquipmentSortControls } from './EquipmentSortControls';
import { sortEquipment, autoEquip, SortConfig } from './equipmentUtils';
import { toast } from '@/hooks/use-toast';

interface PreRunEquipmentProps {
  monster: Monster;
  storedEquipment: EquipmentItem[];
  onStart: (equipment: MonsterEquipment, withdrawnIds: string[]) => void;
  onBack: () => void;
}

export function PreRunEquipment({
  monster,
  storedEquipment,
  onStart,
  onBack,
}: PreRunEquipmentProps) {
  const [equipment, setEquipment] = useState<MonsterEquipment>(createEmptyEquipment());
  const [selectedSlot, setSelectedSlot] = useState<EquipmentSlot | null>(null);
  const [draggedItem, setDraggedItem] = useState<DragData | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<EquipmentSlot | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ 
    option: 'rarity', 
    direction: 'desc' 
  });
  
  // Track which items have been withdrawn from storage
  const equippedIds = Object.values(equipment).filter(Boolean).map(item => item!.id);
  
  // Available items = stored items not yet equipped
  const availableItems = storedEquipment.filter(item => !equippedIds.includes(item.id));
  
  // Filter and sort by selected slot
  const filteredItems = selectedSlot 
    ? availableItems.filter(item => item.slot === selectedSlot)
    : availableItems;
  
  const sortedItems = sortEquipment(filteredItems, sortConfig);

  const handleEquip = useCallback((item: EquipmentItem) => {
    if (monster.level < item.level) return;
    
    setEquipment(prev => ({
      ...prev,
      [item.slot]: item,
    }));
    setSelectedSlot(null);
  }, [monster.level]);
  
  const handleUnequip = useCallback((slot: EquipmentSlot) => {
    setEquipment(prev => ({
      ...prev,
      [slot]: null,
    }));
  }, []);
  
  const handleStart = () => {
    onStart(equipment, equippedIds);
  };
  
  // Drag handlers
  const handleDragStart = useCallback((data: DragData) => {
    setDraggedItem(data);
  }, []);
  
  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
    setDragOverSlot(null);
  }, []);
  
  const handleSlotDragOver = useCallback((slot: EquipmentSlot) => {
    if (draggedItem && draggedItem.item.slot === slot) {
      setDragOverSlot(slot);
    }
  }, [draggedItem]);
  
  const handleSlotDrop = useCallback((slot: EquipmentSlot) => {
    if (draggedItem && draggedItem.item.slot === slot) {
      handleEquip(draggedItem.item);
      setDraggedItem(null);
      setDragOverSlot(null);
    }
  }, [draggedItem, handleEquip]);
  
  // Auto-equip handler
  const handleAutoEquip = useCallback(() => {
    const result = autoEquip(availableItems, monster.class, monster.level);
    setEquipment(result.equipment);
    toast({
      title: "Auto-Equipped!",
      description: `Equipped ${result.usedItemIds.length} items optimized for ${monster.class} class.`,
    });
  }, [availableItems, monster.class, monster.level]);
  
  const totalBonuses = calculateEquipmentBonuses(equipment);
  const equippedCount = Object.values(equipment).filter(Boolean).length;
  
  // Helper to create slot props
  const slotProps = (slot: EquipmentSlot) => ({
    slot,
    item: equipment[slot],
    isSelected: selectedSlot === slot,
    onSelect: () => setSelectedSlot(selectedSlot === slot ? null : slot),
    isDragOver: dragOverSlot === slot,
    onDragOver: () => handleSlotDragOver(slot),
    onDrop: () => handleSlotDrop(slot),
  });
  
  return (
    <div className="game-container">
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent flex items-center gap-2">
            <Shirt className="w-6 h-6 text-primary" />
            Prepare Equipment
          </h2>
        </div>
        
        <p className="text-center text-muted-foreground text-sm">
          Equip gear from your storage before starting the run. Drag items to slots or click to equip.
        </p>
        
        <div className="grid md:grid-cols-2 gap-4">
          {/* Left: Paper doll with monster */}
          <Card className="p-4">
            <div className="flex flex-col items-center gap-4">
              {/* Monster info */}
              <div className="text-center">
                <MonsterSprite 
                  species={monster.species} 
                  element={monster.element} 
                  classType={monster.class} 
                  size={80}
                  equipment={equipment}
                />
                <h3 className="font-bold text-lg mt-2">{monster.name}</h3>
                <p className="text-sm text-muted-foreground">Level {monster.level}</p>
              </div>
              
              {/* Equipment slots - updated layout with back slot */}
              <div className="w-full space-y-2">
                {/* Top row: Helmet */}
                <div className="flex justify-center">
                  <EquippedSlotDisplay {...slotProps('helmet')} />
                </div>
                
                {/* Middle row: Weapon, Armor, Off-hand */}
                <div className="flex justify-center gap-2">
                  <EquippedSlotDisplay {...slotProps('mainHand')} />
                  <EquippedSlotDisplay {...slotProps('armor')} />
                  <EquippedSlotDisplay {...slotProps('offHand')} />
                </div>
                
                {/* Third row: Gloves, Back, Boots */}
                <div className="flex justify-center gap-2">
                  <EquippedSlotDisplay {...slotProps('gloves')} />
                  <EquippedSlotDisplay {...slotProps('back')} />
                  <EquippedSlotDisplay {...slotProps('boots')} />
                </div>
                
                {/* Bottom row: Accessory */}
                <div className="flex justify-center">
                  <EquippedSlotDisplay {...slotProps('accessory')} />
                </div>
              </div>
              
              {/* Unequip selected */}
              {selectedSlot && equipment[selectedSlot] && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleUnequip(selectedSlot)}
                >
                  Unequip {SLOT_INFO[selectedSlot].label}
                </Button>
              )}
              
              {/* Total bonuses */}
              {equippedCount > 0 && (
                <div className="w-full p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Equipment Bonuses</p>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    {Object.entries(totalBonuses).map(([stat, value]) => (
                      value !== 0 && (
                        <div key={stat} className="flex items-center gap-1">
                          <span className="text-muted-foreground">{stat.replace('max', '').slice(0, 3).toUpperCase()}:</span>
                          <span className={value > 0 ? 'text-green-400' : 'text-red-400'}>
                            {value > 0 ? '+' : ''}{value}
                          </span>
                        </div>
                      )
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
          
          {/* Right: Available equipment */}
          <Card className="p-4 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">
                {selectedSlot ? `${SLOT_INFO[selectedSlot].label}s in Storage` : 'Town Storage'}
              </h3>
              {selectedSlot && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setSelectedSlot(null)}
                >
                  Show All
                </Button>
              )}
            </div>
            
            {/* Sort controls */}
            <div className="mb-3">
              <EquipmentSortControls
                sortConfig={sortConfig}
                onSortChange={setSortConfig}
                onAutoEquip={handleAutoEquip}
              />
            </div>
            
            <ScrollArea className="flex-1 max-h-[280px]">
              <div className="space-y-2 pr-2">
                {sortedItems.length > 0 ? (
                  sortedItems.map(item => (
                    <DraggableEquipmentItem
                      key={item.id}
                      item={item}
                      currentLevel={monster.level}
                      onEquip={() => handleEquip(item)}
                      onDrop={() => {}} // No drop in pre-run (items return to storage)
                      isDragging={draggedItem?.item.id === item.id}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                    />
                  ))
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    <p className="text-4xl mb-2">📦</p>
                    <p className="text-sm">
                      {selectedSlot 
                        ? `No ${SLOT_INFO[selectedSlot].label.toLowerCase()}s in storage`
                        : storedEquipment.length === 0 
                          ? 'No equipment in storage'
                          : 'All items equipped'
                      }
                    </p>
                    {storedEquipment.length === 0 && (
                      <p className="text-xs mt-2">
                        Find equipment in dungeons or craft it!
                      </p>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>
            
            <p className="text-xs text-muted-foreground text-center mt-3">
              {storedEquipment.length} items in storage • {equippedCount} equipped
            </p>
          </Card>
        </div>
        
        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack}>
            Back to Selection
          </Button>
          <Button 
            className="flex-1 bg-gradient-to-r from-primary to-secondary" 
            onClick={handleStart}
          >
            <Play className="w-4 h-4 mr-2" />
            Start Adventure! ✨
          </Button>
        </div>
      </div>
    </div>
  );
}
