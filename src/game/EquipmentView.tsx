// Equipment Management UI - Paper doll style equipment view with drag-drop, sorting, auto-equip
// Supports per-party-member equipment management

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  EquipmentItem, 
  EquipmentSlot,
  MonsterEquipment, 
  SLOT_INFO, 
  calculateEquipmentBonuses,
  calculateSetBonusStats,
  createEmptyEquipment,
} from './equipment';
import { Monster } from './types';
import { MonsterSprite } from './sprites';
import { EquippedSlotDisplay, DraggableEquipmentItem, DragData } from './DraggableEquipmentItem';
import { EquipmentSortControls } from './EquipmentSortControls';
import { sortEquipment, autoEquip, SortConfig } from './equipmentUtils';
import { SetBonusDisplay, SetBonusSummary } from './SetBonusDisplay';
import { toast } from '@/hooks/use-toast';

// ============= PARTY MEMBER SELECTOR =============
interface PartyMemberSelectorProps {
  party: Monster[];
  partyEquipment: MonsterEquipment[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

function PartyMemberSelector({ party, partyEquipment, selectedIndex, onSelect }: PartyMemberSelectorProps) {
  return (
    <div className="flex gap-2 p-2 bg-muted/30 rounded-lg mb-4">
      {party.map((monster, index) => {
        const equipment = partyEquipment[index] || createEmptyEquipment();
        const equippedCount = Object.values(equipment).filter(Boolean).length;
        const isSelected = index === selectedIndex;
        const isDead = monster.stats.currentHp <= 0;
        
        return (
          <button
            key={monster.id}
            onClick={() => onSelect(index)}
            className={`
              relative flex flex-col items-center p-2 rounded-lg transition-all min-w-[60px]
              ${isSelected 
                ? 'bg-primary/20 ring-2 ring-primary' 
                : isDead 
                  ? 'bg-muted/30 opacity-50' 
                  : 'hover:bg-muted/50'
              }
            `}
          >
            <div className={`relative ${isDead ? 'grayscale' : ''}`}>
              <MonsterSprite
                species={monster.species}
                element={monster.element}
                classType={monster.class}
                size={40}
                animated={isSelected}
                equipment={equipment}
              />
              {/* Equipped count badge */}
              {equippedCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-secondary text-secondary-foreground text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {equippedCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium capitalize mt-1">{monster.species}</span>
            <span className="text-[8px] text-muted-foreground">Lv.{monster.level}</span>
          </button>
        );
      })}
    </div>
  );
}

// ============= MAIN EQUIPMENT VIEW =============
interface EquipmentViewProps {
  party: Monster[];
  activePartyIndex: number;
  partyEquipment: MonsterEquipment[];
  inventory: EquipmentItem[];
  onEquip: (item: EquipmentItem, partyIndex: number) => void;
  onUnequip: (slot: EquipmentSlot, partyIndex: number) => void;
  onDrop: (itemId: string) => void;
  onBulkEquip: (partyIndex: number, equipment: MonsterEquipment, usedIds: string[]) => void;
  onClose: () => void;
}

export function EquipmentView({
  party,
  activePartyIndex,
  partyEquipment,
  inventory,
  onEquip,
  onUnequip,
  onDrop,
  onBulkEquip,
  onClose,
}: EquipmentViewProps) {
  const [selectedPartyIndex, setSelectedPartyIndex] = useState(activePartyIndex);
  const [selectedSlot, setSelectedSlot] = useState<EquipmentSlot | null>(null);
  const [draggedItem, setDraggedItem] = useState<DragData | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<EquipmentSlot | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ 
    option: 'rarity', 
    direction: 'desc' 
  });
  
  const monster = party[selectedPartyIndex];
  const equipment = partyEquipment[selectedPartyIndex] || createEmptyEquipment();
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
      onEquip(draggedItem.item, selectedPartyIndex);
      setDraggedItem(null);
      setDragOverSlot(null);
    }
  }, [draggedItem, onEquip, selectedPartyIndex]);
  
  // Auto-equip handler
  const handleAutoEquip = useCallback(() => {
    const result = autoEquip(inventory, monster.class, monster.level);
    
    onBulkEquip(selectedPartyIndex, result.equipment, result.usedItemIds);
    toast({
      title: "Auto-Equipped!",
      description: `Equipped ${result.usedItemIds.length} items optimized for ${monster.class} class.`,
    });
  }, [inventory, monster.class, monster.level, onBulkEquip, selectedPartyIndex]);
  
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
        
        {/* Party member selector - only show if party has more than 1 member */}
        {party.length > 1 && (
          <div className="px-4 pt-4">
            <PartyMemberSelector
              party={party}
              partyEquipment={partyEquipment}
              selectedIndex={selectedPartyIndex}
              onSelect={setSelectedPartyIndex}
            />
          </div>
        )}
        
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
            <div className="mt-4 p-3 bg-muted/50 rounded-lg space-y-3">
              <div>
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
                {/* Set bonus summary */}
                <SetBonusSummary equipment={equipment} />
              </div>
              
              {/* Set Bonuses Display */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Set Bonuses</p>
                <SetBonusDisplay equipment={equipment} />
              </div>
            </div>
            
            {/* Unequip button for selected slot */}
            {selectedSlot && equipment[selectedSlot] && (
              <Button 
                variant="outline" 
                className="mt-2"
                onClick={() => {
                  onUnequip(selectedSlot, selectedPartyIndex);
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
                      onEquip={() => onEquip(item, selectedPartyIndex)}
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
