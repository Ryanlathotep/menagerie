// Equipment Management UI - Paper doll style equipment view

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
  EquipmentStats,
  calculateEquipmentBonuses,
} from './equipment';
import { Monster } from './types';
import { MonsterSprite } from './sprites';

// ============= SLOT COMPONENT =============
interface EquipmentSlotProps {
  slot: EquipmentSlot;
  item: EquipmentItem | null;
  onSelect: () => void;
  isSelected: boolean;
}

function EquipmentSlotDisplay({ slot, item, onSelect, isSelected }: EquipmentSlotProps) {
  const info = SLOT_INFO[slot];
  const rarityStyle = item ? RARITY_COLORS[item.rarity] : null;
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onSelect}
            className={`
              w-14 h-14 rounded-lg border-2 flex items-center justify-center
              transition-all hover:scale-105 active:scale-95
              ${isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}
              ${item 
                ? `${rarityStyle?.bg} ${rarityStyle?.border} ${rarityStyle?.glow ? `shadow-lg ${rarityStyle.glow}` : ''}` 
                : 'bg-muted/50 border-dashed border-muted-foreground/30'
              }
            `}
          >
            <span className="text-2xl">{item?.icon || info.icon}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-[200px]">
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
              {item.element && (
                <p className="text-xs text-primary">⚡ {item.element} element</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Empty {info.label} slot</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============= INVENTORY ITEM =============
interface InventoryItemProps {
  item: EquipmentItem;
  onEquip: () => void;
  onDrop: () => void;
  currentLevel: number;
}

function InventoryItemCard({ item, onEquip, onDrop, currentLevel }: InventoryItemProps) {
  const rarityStyle = RARITY_COLORS[item.rarity];
  const canEquip = currentLevel >= item.level;
  
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
      </div>
      <div className="flex gap-2 mt-2">
        <Button 
          size="sm" 
          className="flex-1 h-7 text-xs"
          disabled={!canEquip}
          onClick={onEquip}
        >
          {canEquip ? 'Equip' : `Req. Lv.${item.level}`}
        </Button>
        <Button 
          size="sm" 
          variant="destructive" 
          className="h-7 text-xs px-2"
          onClick={onDrop}
        >
          Drop
        </Button>
      </div>
    </div>
  );
}

// ============= STAT COMPARISON =============
interface StatComparisonProps {
  currentStats: EquipmentStats;
  newItem: EquipmentItem | null;
  currentEquipped: EquipmentItem | null;
}

function StatComparison({ currentStats, newItem, currentEquipped }: StatComparisonProps) {
  if (!newItem) return null;
  
  const statOrder: (keyof EquipmentStats)[] = ['maxHp', 'attack', 'defense', 'speed', 'dodge', 'special', 'stamina'];
  
  return (
    <div className="p-2 bg-muted/50 rounded-lg space-y-1">
      <p className="text-xs font-semibold text-muted-foreground mb-2">Stat Changes</p>
      {statOrder.map(stat => {
        const current = currentEquipped?.stats[stat] || 0;
        const newVal = newItem.stats[stat] || 0;
        const diff = newVal - current;
        
        if (diff === 0) return null;
        
        return (
          <div key={stat} className="flex justify-between text-xs">
            <span className="text-muted-foreground">{stat.replace('max', '').toUpperCase()}</span>
            <span className={diff > 0 ? 'text-green-400' : 'text-red-400'}>
              {diff > 0 ? '▲' : '▼'} {Math.abs(diff)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ============= MAIN EQUIPMENT VIEW =============
interface EquipmentViewProps {
  monster: Monster;
  equipment: MonsterEquipment;
  inventory: EquipmentItem[];
  onEquip: (item: EquipmentItem) => void;
  onUnequip: (slot: EquipmentSlot) => void;
  onDrop: (itemId: string) => void;
  onClose: () => void;
}

export function EquipmentView({
  monster,
  equipment,
  inventory,
  onEquip,
  onUnequip,
  onDrop,
  onClose,
}: EquipmentViewProps) {
  const [selectedSlot, setSelectedSlot] = useState<EquipmentSlot | null>(null);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<EquipmentItem | null>(null);
  
  const totalBonuses = calculateEquipmentBonuses(equipment);
  
  // Filter inventory to show items for selected slot
  const filteredInventory = selectedSlot 
    ? inventory.filter(i => i.slot === selectedSlot)
    : inventory;
  
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
                <EquipmentSlotDisplay 
                  slot="helmet" 
                  item={equipment.helmet}
                  onSelect={() => setSelectedSlot('helmet')}
                  isSelected={selectedSlot === 'helmet'}
                />
              </div>
              
              {/* Middle row: Weapon, Monster, Off-hand */}
              <div className="flex items-center gap-4">
                <EquipmentSlotDisplay 
                  slot="mainHand" 
                  item={equipment.mainHand}
                  onSelect={() => setSelectedSlot('mainHand')}
                  isSelected={selectedSlot === 'mainHand'}
                />
                
                {/* Monster sprite in center */}
                <div className="w-24 h-24 rounded-xl bg-muted/30 border border-border flex items-center justify-center">
                  <MonsterSprite 
                    species={monster.species}
                    element={monster.element}
                    classType={monster.class}
                    size={80}
                    animated
                  />
                </div>
                
                <EquipmentSlotDisplay 
                  slot="offHand" 
                  item={equipment.offHand}
                  onSelect={() => setSelectedSlot('offHand')}
                  isSelected={selectedSlot === 'offHand'}
                />
              </div>
              
              {/* Armor row with back slot */}
              <div className="flex gap-4">
                <EquipmentSlotDisplay 
                  slot="gloves" 
                  item={equipment.gloves}
                  onSelect={() => setSelectedSlot('gloves')}
                  isSelected={selectedSlot === 'gloves'}
                />
                <EquipmentSlotDisplay 
                  slot="armor" 
                  item={equipment.armor}
                  onSelect={() => setSelectedSlot('armor')}
                  isSelected={selectedSlot === 'armor'}
                />
                <EquipmentSlotDisplay 
                  slot="back" 
                  item={equipment.back}
                  onSelect={() => setSelectedSlot('back')}
                  isSelected={selectedSlot === 'back'}
                />
              </div>
              
              {/* Bottom row: accessory and boots */}
              <div className="flex gap-4">
                <EquipmentSlotDisplay 
                  slot="accessory" 
                  item={equipment.accessory}
                  onSelect={() => setSelectedSlot('accessory')}
                  isSelected={selectedSlot === 'accessory'}
                />
                <EquipmentSlotDisplay 
                  slot="boots" 
                  item={equipment.boots}
                  onSelect={() => setSelectedSlot('boots')}
                  isSelected={selectedSlot === 'boots'}
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
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">
                {selectedSlot ? `${SLOT_INFO[selectedSlot].label}s in Inventory` : 'Inventory'}
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
            
            <ScrollArea className="flex-1">
              <div className="space-y-2 pr-4">
                {filteredInventory.length > 0 ? (
                  filteredInventory.map(item => (
                    <InventoryItemCard
                      key={item.id}
                      item={item}
                      currentLevel={monster.level}
                      onEquip={() => onEquip(item)}
                      onDrop={() => onDrop(item.id)}
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
