// Pre-Run Equipment Selection - Equip gear and select consumables from town storage before starting a run

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
import { Monster, InventoryItem } from './types';
import { MonsterSprite } from './sprites';
import { ArrowLeft, Play, Shirt } from 'lucide-react';
import { EquippedSlotDisplay, DraggableEquipmentItem, DragData } from './DraggableEquipmentItem';
import { EquipmentSortControls } from './EquipmentSortControls';
import { sortEquipment, autoEquip, SortConfig } from './equipmentUtils';
import { toast } from '@/hooks/use-toast';

interface PreRunEquipmentProps {
  party: Monster[];
  /** @deprecated use party instead */
  monster?: Monster;
  storedEquipment: EquipmentItem[];
  storedItems: InventoryItem[];
  /** Dungeon's base starting floor (from the entrance). When provided, a floor selector appears. */
  entranceFloor?: number;
  /** Maximum floor the player may skip to (e.g. entranceFloor + floor(highestLevel/2)). */
  maxStartFloor?: number;
  onStart: (
    partyEquipment: MonsterEquipment[],
    withdrawnIds: string[],
    selectedItems: InventoryItem[],
    selectedStartFloor?: number,
  ) => void;
  onBack: () => void;
}

export function PreRunEquipment({
  party,
  monster: legacyMonster,
  storedEquipment,
  storedItems,
  entranceFloor,
  maxStartFloor,
  onStart,
  onBack,
}: PreRunEquipmentProps) {
  const monsters = party.length > 0 ? party : legacyMonster ? [legacyMonster] : [];
  const [activeIndex, setActiveIndex] = useState(0);
  const monster = monsters[activeIndex] || monsters[0];
  
  // One equipment set per party member. Hydrate from each monster's persisted
  // `equipment` so previously equipped gear stays equipped between runs — players
  // can edit it here, but they don't have to re-equip from scratch every run.
  const [partyEquipment, setPartyEquipment] = useState<MonsterEquipment[]>(
    monsters.map(m => {
      if (!m.equipment) return createEmptyEquipment();
      // Merge with empty template so all slot keys exist
      return { ...createEmptyEquipment(), ...m.equipment };
    })
  );
  const equipment = partyEquipment[activeIndex] || createEmptyEquipment();
  const [selectedSlot, setSelectedSlot] = useState<EquipmentSlot | null>(null);
  const [draggedItem, setDraggedItem] = useState<DragData | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<EquipmentSlot | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ 
    option: 'rarity', 
    direction: 'desc' 
  });
  
  // Selected consumables to bring into the run
  const [selectedItems, setSelectedItems] = useState<InventoryItem[]>([]);

  // Floor-skip selector. Defaults to the entrance's base floor (no skip).
  const minFloor = Math.max(1, entranceFloor ?? 1);
  const maxFloor = Math.max(minFloor, maxStartFloor ?? minFloor);
  const [selectedStartFloor, setSelectedStartFloor] = useState<number>(minFloor);
  const showFloorSelector = entranceFloor !== undefined && maxFloor > minFloor;
  
  // Track which items have been withdrawn from storage (across ALL party members)
  const allEquippedIds = partyEquipment.flatMap(eq => Object.values(eq).filter(Boolean).map(item => item!.id));
  const equippedIds = allEquippedIds;
  
  // Items that started already equipped on incoming monsters (persisted across runs).
  // We expose them as available so unequipping returns them to the pool, even though
  // they aren't physically in town storage.
  const initiallyEquippedItems = useState<EquipmentItem[]>(() => {
    const items: EquipmentItem[] = [];
    for (const m of monsters) {
      if (!m.equipment) continue;
      for (const item of Object.values(m.equipment)) {
        if (item) items.push(item);
      }
    }
    return items;
  })[0];
  
  // Available items = stored loose loot + previously-equipped items, minus
  // anything currently equipped this session.
  const availableItems = [
    ...storedEquipment,
    ...initiallyEquippedItems.filter(it => !storedEquipment.some(s => s.id === it.id)),
  ].filter(item => !allEquippedIds.includes(item.id));
  
  // Filter and sort by selected slot
  const filteredItems = selectedSlot 
    ? availableItems.filter(item => item.slot === selectedSlot)
    : availableItems;
  
  const sortedItems = sortEquipment(filteredItems, sortConfig);
  
  // Group stored consumables by id for display
  const groupedConsumables = storedItems.reduce((acc, item) => {
    const existing = acc.find(i => i.id === item.id);
    if (existing) {
      existing.quantity = (existing.quantity || 1) + (item.quantity || 1);
    } else {
      acc.push({ ...item, quantity: item.quantity || 1 });
    }
    return acc;
  }, [] as InventoryItem[]);
  
  // Calculate remaining quantities after selection
  const getRemainingQty = (itemId: string) => {
    const stored = groupedConsumables.find(i => i.id === itemId);
    const selected = selectedItems.find(i => i.id === itemId);
    return (stored?.quantity || 0) - (selected?.quantity || 0);
  };
  
  const handleAddItem = (item: InventoryItem) => {
    const remaining = getRemainingQty(item.id);
    if (remaining <= 0) return;
    
    setSelectedItems(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: (i.quantity || 1) + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };
  
  const handleRemoveItem = (itemId: string) => {
    setSelectedItems(prev => {
      const existing = prev.find(i => i.id === itemId);
      if (!existing) return prev;
      if ((existing.quantity || 1) <= 1) {
        return prev.filter(i => i.id !== itemId);
      }
      return prev.map(i => i.id === itemId ? { ...i, quantity: (i.quantity || 1) - 1 } : i);
    });
  };

  const handleEquip = useCallback((item: EquipmentItem) => {
    if (monster.level < item.level) return;
    
    setPartyEquipment(prev => prev.map((eq, i) => 
      i === activeIndex ? { ...eq, [item.slot]: item } : eq
    ));
    setSelectedSlot(null);
  }, [monster.level, activeIndex]);
  
  const handleUnequip = useCallback((slot: EquipmentSlot) => {
    setPartyEquipment(prev => prev.map((eq, i) =>
      i === activeIndex ? { ...eq, [slot]: null } : eq
    ));
  }, [activeIndex]);
  
  const handleStart = () => {
    onStart(partyEquipment, equippedIds, selectedItems, showFloorSelector ? selectedStartFloor : undefined);
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
    setPartyEquipment(prev => prev.map((eq, i) => i === activeIndex ? result.equipment : eq));
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
  
  const totalSelectedItems = selectedItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
  
  return (
    <div className="game-container">
      <div className="space-y-4 max-w-5xl">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h2 className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent flex items-center gap-2">
            <Shirt className="w-5 h-5 text-primary" />
            Prepare for Adventure
          </h2>
        </div>
        
        <p className="text-center text-muted-foreground text-xs">
          Equip gear and select consumables from your storage before starting the run.
        </p>
        
        {/* Party member tabs */}
        {monsters.length > 1 && (
          <div className="flex gap-1 justify-center flex-wrap">
            {monsters.map((m, i) => {
              const memberEquipCount = Object.values(partyEquipment[i] || {}).filter(Boolean).length;
              return (
                <button
                  key={m.id}
                  onClick={() => setActiveIndex(i)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs transition-all ${
                    i === activeIndex 
                      ? 'border-primary bg-primary/10 font-semibold' 
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <MonsterSprite species={m.species} element={m.element} classType={m.class} size={24} animated={false} />
                  <span className="capitalize">{m.name}</span>
                  {memberEquipCount > 0 && (
                    <span className="text-[10px] text-muted-foreground">({memberEquipCount})</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
        
        <div className="grid md:grid-cols-3 gap-3">
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
          
          {/* Third column: Consumables */}
          <Card className="p-3 flex flex-col">
            <h3 className="font-semibold text-sm mb-2">🧪 Consumables</h3>
            
            {/* Selected items */}
            {selectedItems.length > 0 && (
              <div className="mb-2 p-2 bg-primary/10 rounded border border-primary/20">
                <p className="text-[10px] font-medium text-muted-foreground mb-1">Selected ({totalSelectedItems})</p>
                <div className="flex flex-wrap gap-1">
                  {selectedItems.map(item => (
                    <button
                      key={item.id}
                      onClick={() => handleRemoveItem(item.id)}
                      className="text-xs px-1.5 py-0.5 bg-background rounded border hover:bg-destructive/20 transition-colors"
                    >
                      {item.name} ×{item.quantity}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            <ScrollArea className="flex-1 max-h-[280px]">
              <div className="space-y-1 pr-2">
                {groupedConsumables.length > 0 ? (
                  groupedConsumables.map(item => {
                    const remaining = getRemainingQty(item.id);
                    const selected = selectedItems.find(i => i.id === item.id);
                    
                    return (
                      <div
                        key={item.id}
                        className={`p-2 rounded border text-left transition-all ${remaining > 0 ? 'hover:bg-muted/50 cursor-pointer' : 'opacity-50'}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">
                            {item.effect === 'heal_hp' ? '❤️' : 
                             item.effect === 'heal_stamina' ? '⚡' :
                             item.effect?.startsWith('cure_') ? '💊' :
                             item.effect?.startsWith('boost_') ? '✨' :
                             item.effect?.startsWith('revive') ? '🌟' : '🧪'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{item.name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              In storage: {remaining}{selected ? ` (${selected.quantity} selected)` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              disabled={remaining <= 0}
                              onClick={() => handleAddItem(item)}
                            >
                              +
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              disabled={!selected || (selected.quantity || 0) <= 0}
                              onClick={() => handleRemoveItem(item.id)}
                            >
                              -
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center text-muted-foreground py-6">
                    <p className="text-2xl mb-1">🧪</p>
                    <p className="text-xs">No consumables in storage</p>
                    <p className="text-[10px] mt-1">Craft potions or buy from the shop!</p>
                  </div>
                )}
              </div>
            </ScrollArea>
            
            <p className="text-[10px] text-muted-foreground text-center mt-2">
              {groupedConsumables.reduce((sum, i) => sum + (i.quantity || 1), 0)} in storage • {totalSelectedItems} selected
            </p>
          </Card>
        </div>
        
        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack}>
            Back
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
