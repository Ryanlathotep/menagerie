// Pre-Run Equipment Selection - Equip gear from town storage before starting a run

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  EquipmentItem, 
  EquipmentSlot,
  MonsterEquipment, 
  SLOT_INFO, 
  RARITY_COLORS,
  createEmptyEquipment,
  calculateEquipmentBonuses,
} from './equipment';
import { Monster } from './types';
import { MonsterSprite } from './sprites';
import { ArrowLeft, Play, Shirt } from 'lucide-react';

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
  
  // Track which items have been withdrawn from storage
  const equippedIds = Object.values(equipment).filter(Boolean).map(item => item!.id);
  
  // Available items = stored items not yet equipped
  const availableItems = storedEquipment.filter(item => !equippedIds.includes(item.id));
  
  // Filter by selected slot
  const filteredItems = selectedSlot 
    ? availableItems.filter(item => item.slot === selectedSlot)
    : availableItems;
  
  const handleEquip = (item: EquipmentItem) => {
    // Check level requirement
    if (monster.level < item.level) return;
    
    setEquipment(prev => ({
      ...prev,
      [item.slot]: item,
    }));
    setSelectedSlot(null);
  };
  
  const handleUnequip = (slot: EquipmentSlot) => {
    setEquipment(prev => ({
      ...prev,
      [slot]: null,
    }));
  };
  
  const handleStart = () => {
    onStart(equipment, equippedIds);
  };
  
  const totalBonuses = calculateEquipmentBonuses(equipment);
  const equippedCount = Object.values(equipment).filter(Boolean).length;
  
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
          Equip gear from your storage before starting the run. Equipped items will be taken into the dungeon.
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
              
              {/* Equipment slots */}
              <div className="w-full space-y-2">
                {/* Top row: Helmet */}
                <div className="flex justify-center">
                  <EquipmentSlotButton 
                    slot="helmet" 
                    item={equipment.helmet}
                    isSelected={selectedSlot === 'helmet'}
                    onSelect={() => setSelectedSlot(selectedSlot === 'helmet' ? null : 'helmet')}
                    onUnequip={() => handleUnequip('helmet')}
                  />
                </div>
                
                {/* Middle row: Weapon, Armor, Off-hand */}
                <div className="flex justify-center gap-2">
                  <EquipmentSlotButton 
                    slot="mainHand" 
                    item={equipment.mainHand}
                    isSelected={selectedSlot === 'mainHand'}
                    onSelect={() => setSelectedSlot(selectedSlot === 'mainHand' ? null : 'mainHand')}
                    onUnequip={() => handleUnequip('mainHand')}
                  />
                  <EquipmentSlotButton 
                    slot="armor" 
                    item={equipment.armor}
                    isSelected={selectedSlot === 'armor'}
                    onSelect={() => setSelectedSlot(selectedSlot === 'armor' ? null : 'armor')}
                    onUnequip={() => handleUnequip('armor')}
                  />
                  <EquipmentSlotButton 
                    slot="offHand" 
                    item={equipment.offHand}
                    isSelected={selectedSlot === 'offHand'}
                    onSelect={() => setSelectedSlot(selectedSlot === 'offHand' ? null : 'offHand')}
                    onUnequip={() => handleUnequip('offHand')}
                  />
                </div>
                
                {/* Bottom row: Gloves, Boots, Accessory */}
                <div className="flex justify-center gap-2">
                  <EquipmentSlotButton 
                    slot="gloves" 
                    item={equipment.gloves}
                    isSelected={selectedSlot === 'gloves'}
                    onSelect={() => setSelectedSlot(selectedSlot === 'gloves' ? null : 'gloves')}
                    onUnequip={() => handleUnequip('gloves')}
                  />
                  <EquipmentSlotButton 
                    slot="boots" 
                    item={equipment.boots}
                    isSelected={selectedSlot === 'boots'}
                    onSelect={() => setSelectedSlot(selectedSlot === 'boots' ? null : 'boots')}
                    onUnequip={() => handleUnequip('boots')}
                  />
                  <EquipmentSlotButton 
                    slot="accessory" 
                    item={equipment.accessory}
                    isSelected={selectedSlot === 'accessory'}
                    onSelect={() => setSelectedSlot(selectedSlot === 'accessory' ? null : 'accessory')}
                    onUnequip={() => handleUnequip('accessory')}
                  />
                </div>
              </div>
              
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
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
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
            
            <ScrollArea className="h-[300px]">
              <div className="space-y-2 pr-2">
                {filteredItems.length > 0 ? (
                  filteredItems.map(item => (
                    <EquipmentItemCard
                      key={item.id}
                      item={item}
                      monsterLevel={monster.level}
                      onEquip={() => handleEquip(item)}
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

// Slot button component
interface EquipmentSlotButtonProps {
  slot: EquipmentSlot;
  item: EquipmentItem | null;
  isSelected: boolean;
  onSelect: () => void;
  onUnequip: () => void;
}

function EquipmentSlotButton({ slot, item, isSelected, onSelect, onUnequip }: EquipmentSlotButtonProps) {
  const info = SLOT_INFO[slot];
  const rarityStyle = item ? RARITY_COLORS[item.rarity] : null;
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={item ? onUnequip : onSelect}
            className={`
              w-14 h-14 rounded-lg border-2 flex items-center justify-center
              transition-all hover:scale-105 active:scale-95
              ${isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}
              ${item 
                ? `${rarityStyle?.bg} ${rarityStyle?.border} ${rarityStyle?.glow ? `shadow-lg ${rarityStyle.glow}` : ''}` 
                : 'bg-muted/50 border-dashed border-muted-foreground/30 hover:border-primary/50'
              }
            `}
          >
            <span className="text-2xl">{item?.icon || info.icon}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[200px]">
          {item ? (
            <div className="space-y-1">
              <p className={`font-semibold ${rarityStyle?.text}`}>{item.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{item.rarity} {info.label}</p>
              <div className="text-xs space-y-0.5">
                {Object.entries(item.stats).map(([stat, value]) => (
                  value !== 0 && (
                    <p key={stat} className={value > 0 ? 'text-green-400' : 'text-red-400'}>
                      {value > 0 ? '+' : ''}{value} {stat.replace('max', '').toUpperCase()}
                    </p>
                  )
                ))}
              </div>
              <p className="text-xs text-primary mt-1">Click to unequip</p>
            </div>
          ) : (
            <div>
              <p className="text-sm text-muted-foreground">Empty {info.label} slot</p>
              <p className="text-xs text-primary">Click to select</p>
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Item card component
interface EquipmentItemCardProps {
  item: EquipmentItem;
  monsterLevel: number;
  onEquip: () => void;
}

function EquipmentItemCard({ item, monsterLevel, onEquip }: EquipmentItemCardProps) {
  const rarityStyle = RARITY_COLORS[item.rarity];
  const canEquip = monsterLevel >= item.level;
  
  return (
    <div className={`
      p-3 rounded-lg border transition-all hover:scale-[1.02]
      ${rarityStyle.bg} ${rarityStyle.border}
    `}>
      <div className="flex items-start gap-2">
        <span className="text-2xl">{item.icon}</span>
        <div className="flex-1 min-w-0">
          <p className={`font-semibold text-sm truncate ${rarityStyle.text}`}>
            {item.name}
          </p>
          <p className="text-xs text-muted-foreground capitalize">
            {SLOT_INFO[item.slot].label} • Lv.{item.level}
          </p>
          <div className="flex flex-wrap gap-1 mt-1">
            {Object.entries(item.stats).map(([stat, value]) => (
              value !== 0 && (
                <span 
                  key={stat} 
                  className={`text-[10px] px-1 rounded ${value > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}
                >
                  {value > 0 ? '+' : ''}{value} {stat.replace('max', '').slice(0, 3).toUpperCase()}
                </span>
              )
            ))}
          </div>
        </div>
        <Button 
          size="sm" 
          className="h-8 text-xs"
          disabled={!canEquip}
          onClick={onEquip}
        >
          {canEquip ? 'Equip' : `Lv.${item.level}`}
        </Button>
      </div>
    </div>
  );
}
