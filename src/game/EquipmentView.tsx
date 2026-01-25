// Equipment Management UI - Paper doll style equipment view with drag-drop, sorting, auto-equip

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  EquipmentItem, 
  EquipmentSlot,
  MonsterEquipment, 
  SLOT_INFO, 
  EquipmentStats,
  calculateEquipmentBonuses,
  createEmptyEquipment,
} from './equipment';
import { Monster } from './types';
import { MonsterSprite } from './sprites';
import { EquippedSlotDisplay, DraggableEquipmentItem, DragData } from './DraggableEquipmentItem';
import { EquipmentSortControls } from './EquipmentSortControls';
import { sortEquipment, autoEquip, SortConfig } from './equipmentUtils';
import { toast } from '@/hooks/use-toast';

// ============= MAIN EQUIPMENT VIEW =============
interface EquipmentViewProps {
  monster: Monster;
  equipment: MonsterEquipment;
  inventory: EquipmentItem[];
  onEquip: (item: EquipmentItem) => void;
  onUnequip: (slot: EquipmentSlot) => void;
  onDrop: (itemId: string) => void;
  onClose: () => void;
  onBulkEquip?: (equipment: MonsterEquipment, usedIds: string[]) => void;
}

export function EquipmentView({
  monster,
  equipment,
  inventory,
  onEquip,
  onUnequip,
  onDrop,
  onClose,
  onBulkEquip,
}: EquipmentViewProps) {
  const [selectedSlot, setSelectedSlot] = useState<EquipmentSlot | null>(null);
  const [draggedItem, setDraggedItem] = useState<DragData | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<EquipmentSlot | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ 
    option: 'rarity', 
    direction: 'desc' 
  });
  
  const totalBonuses = calculateEquipmentBonuses(equipment);
  
  // Filter and sort inventory
  const filteredInventory = selectedSlot 
    ? inventory.filter(i => i.slot === selectedSlot)
    : inventory;
  
  const sortedInventory = sortEquipment(filteredInventory, sortConfig);
  
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
      onEquip(draggedItem.item);
      setDraggedItem(null);
      setDragOverSlot(null);
    }
  }, [draggedItem, onEquip]);
  
  // Auto-equip handler
  const handleAutoEquip = useCallback(() => {
    const result = autoEquip(inventory, monster.class, monster.level);
    
    if (onBulkEquip) {
      onBulkEquip(result.equipment, result.usedItemIds);
      toast({
        title: "Auto-Equipped!",
        description: `Equipped ${result.usedItemIds.length} items optimized for ${monster.class} class.`,
      });
    } else {
      // Fallback: equip items one by one
      const equippedCount = result.usedItemIds.length;
      result.usedItemIds.forEach(id => {
        const item = inventory.find(i => i.id === id);
        if (item) onEquip(item);
      });
      toast({
        title: "Auto-Equipped!",
        description: `Equipped ${equippedCount} items.`,
      });
    }
  }, [inventory, monster.class, monster.level, onEquip, onBulkEquip]);
  
  return (
    <div className="fixed inset-0 bg-background/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-xl font-bold bg-gradient-to-r from-primary to-amber-500 bg-clip-text text-transparent">
            ⚔️ Equipment
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
        </div>
        
        <div className="flex-1 overflow-hidden flex">
          {/* Paper Doll Section */}
          <div className="w-1/2 p-4 border-r flex flex-col">
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              {/* Top row: Helmet */}
              <div className="flex justify-center">
                <EquippedSlotDisplay 
                  slot="helmet" 
                  item={equipment.helmet}
                  onSelect={() => setSelectedSlot(selectedSlot === 'helmet' ? null : 'helmet')}
                  isSelected={selectedSlot === 'helmet'}
                  isDragOver={dragOverSlot === 'helmet'}
                  onDragOver={() => handleSlotDragOver('helmet')}
                  onDrop={() => handleSlotDrop('helmet')}
                />
              </div>
              
              {/* Middle row: Weapon, Monster, Off-hand */}
              <div className="flex items-center gap-4">
                <EquippedSlotDisplay 
                  slot="mainHand" 
                  item={equipment.mainHand}
                  onSelect={() => setSelectedSlot(selectedSlot === 'mainHand' ? null : 'mainHand')}
                  isSelected={selectedSlot === 'mainHand'}
                  isDragOver={dragOverSlot === 'mainHand'}
                  onDragOver={() => handleSlotDragOver('mainHand')}
                  onDrop={() => handleSlotDrop('mainHand')}
                />
                
                {/* Monster sprite in center */}
                <div className="w-24 h-24 rounded-xl bg-muted/30 border border-border flex items-center justify-center">
                  <MonsterSprite 
                    species={monster.species}
                    element={monster.element}
                    classType={monster.class}
                    size={80}
                    animated
                    equipment={equipment}
                  />
                </div>
                
                <EquippedSlotDisplay 
                  slot="offHand" 
                  item={equipment.offHand}
                  onSelect={() => setSelectedSlot(selectedSlot === 'offHand' ? null : 'offHand')}
                  isSelected={selectedSlot === 'offHand'}
                  isDragOver={dragOverSlot === 'offHand'}
                  onDragOver={() => handleSlotDragOver('offHand')}
                  onDrop={() => handleSlotDrop('offHand')}
                />
              </div>
              
              {/* Armor row with back slot */}
              <div className="flex gap-4">
                <EquippedSlotDisplay 
                  slot="gloves" 
                  item={equipment.gloves}
                  onSelect={() => setSelectedSlot(selectedSlot === 'gloves' ? null : 'gloves')}
                  isSelected={selectedSlot === 'gloves'}
                  isDragOver={dragOverSlot === 'gloves'}
                  onDragOver={() => handleSlotDragOver('gloves')}
                  onDrop={() => handleSlotDrop('gloves')}
                />
                <EquippedSlotDisplay 
                  slot="armor" 
                  item={equipment.armor}
                  onSelect={() => setSelectedSlot(selectedSlot === 'armor' ? null : 'armor')}
                  isSelected={selectedSlot === 'armor'}
                  isDragOver={dragOverSlot === 'armor'}
                  onDragOver={() => handleSlotDragOver('armor')}
                  onDrop={() => handleSlotDrop('armor')}
                />
                <EquippedSlotDisplay 
                  slot="back" 
                  item={equipment.back}
                  onSelect={() => setSelectedSlot(selectedSlot === 'back' ? null : 'back')}
                  isSelected={selectedSlot === 'back'}
                  isDragOver={dragOverSlot === 'back'}
                  onDragOver={() => handleSlotDragOver('back')}
                  onDrop={() => handleSlotDrop('back')}
                />
              </div>
              
              {/* Bottom row: accessory and boots */}
              <div className="flex gap-4">
                <EquippedSlotDisplay 
                  slot="accessory" 
                  item={equipment.accessory}
                  onSelect={() => setSelectedSlot(selectedSlot === 'accessory' ? null : 'accessory')}
                  isSelected={selectedSlot === 'accessory'}
                  isDragOver={dragOverSlot === 'accessory'}
                  onDragOver={() => handleSlotDragOver('accessory')}
                  onDrop={() => handleSlotDrop('accessory')}
                />
                <EquippedSlotDisplay 
                  slot="boots" 
                  item={equipment.boots}
                  onSelect={() => setSelectedSlot(selectedSlot === 'boots' ? null : 'boots')}
                  isSelected={selectedSlot === 'boots'}
                  isDragOver={dragOverSlot === 'boots'}
                  onDragOver={() => handleSlotDragOver('boots')}
                  onDrop={() => handleSlotDrop('boots')}
                />
              </div>
            </div>
            
            {/* Total bonuses */}
            <div className="mt-4 p-3 bg-muted/50 rounded-lg">
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
            
            {/* Unequip button for selected slot */}
            {selectedSlot && equipment[selectedSlot] && (
              <Button 
                variant="outline" 
                className="mt-2"
                onClick={() => {
                  onUnequip(selectedSlot);
                  setSelectedSlot(null);
                }}
              >
                Unequip {SLOT_INFO[selectedSlot].label}
              </Button>
            )}
          </div>
          
          {/* Inventory Section */}
          <div className="w-1/2 p-4 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">
                {selectedSlot ? `${SLOT_INFO[selectedSlot].label}s` : 'Inventory'}
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
            
            <ScrollArea className="flex-1">
              <div className="space-y-2 pr-4">
                {sortedInventory.length > 0 ? (
                  sortedInventory.map(item => (
                    <DraggableEquipmentItem
                      key={item.id}
                      item={item}
                      currentLevel={monster.level}
                      onEquip={() => onEquip(item)}
                      onDrop={() => onDrop(item.id)}
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
                        ? `No ${SLOT_INFO[selectedSlot].label.toLowerCase()}s in inventory`
                        : 'No equipment in inventory'
                      }
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </Card>
    </div>
  );
}
