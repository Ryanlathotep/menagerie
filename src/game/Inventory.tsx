// Inventory System - Items, potions, and consumables

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FullMonster, ExpandedStats } from './CharacterSheet';

// Item types
export type ItemType = 'consumable' | 'key' | 'material';
export type ConsumableEffect = 'heal_hp' | 'heal_stamina' | 'cure_poison' | 'cure_burn' | 'cure_freeze' | 'cure_all' | 'boost_attack' | 'boost_defense' | 'boost_speed' | 'revive' | 'revive_full';

export interface Item {
  id: string;
  name: string;
  description: string;
  type: ItemType;
  stackable: boolean;
  maxStack: number;
  icon: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic';
  effect?: ConsumableEffect;
  effectValue?: number;
  duration?: number; // For buffs, in turns
}

export interface InventorySlot {
  item: Item;
  quantity: number;
}

export interface Inventory {
  slots: InventorySlot[];
  maxSlots: number;
  gold: number;
}

// Item database
export const ITEMS: Record<string, Item> = {
  // Healing items
  small_potion: {
    id: 'small_potion',
    name: 'Small Potion',
    description: 'Restores 30 HP',
    type: 'consumable',
    stackable: true,
    maxStack: 20,
    icon: '🧪',
    rarity: 'common',
    effect: 'heal_hp',
    effectValue: 30,
  },
  medium_potion: {
    id: 'medium_potion',
    name: 'Medium Potion',
    description: 'Restores 75 HP',
    type: 'consumable',
    stackable: true,
    maxStack: 15,
    icon: '🧪',
    rarity: 'uncommon',
    effect: 'heal_hp',
    effectValue: 75,
  },
  large_potion: {
    id: 'large_potion',
    name: 'Large Potion',
    description: 'Restores 150 HP',
    type: 'consumable',
    stackable: true,
    maxStack: 10,
    icon: '🧪',
    rarity: 'rare',
    effect: 'heal_hp',
    effectValue: 150,
  },
  
  // Stamina items
  stamina_tonic: {
    id: 'stamina_tonic',
    name: 'Stamina Tonic',
    description: 'Restores 20 Stamina',
    type: 'consumable',
    stackable: true,
    maxStack: 15,
    icon: '⚗️',
    rarity: 'common',
    effect: 'heal_stamina',
    effectValue: 20,
  },
  energy_elixir: {
    id: 'energy_elixir',
    name: 'Energy Elixir',
    description: 'Restores 50 Stamina',
    type: 'consumable',
    stackable: true,
    maxStack: 10,
    icon: '⚗️',
    rarity: 'uncommon',
    effect: 'heal_stamina',
    effectValue: 50,
  },
  
  // Status cures
  antidote: {
    id: 'antidote',
    name: 'Antidote',
    description: 'Cures poison',
    type: 'consumable',
    stackable: true,
    maxStack: 10,
    icon: '💊',
    rarity: 'common',
    effect: 'cure_poison',
  },
  burn_salve: {
    id: 'burn_salve',
    name: 'Burn Salve',
    description: 'Cures burn',
    type: 'consumable',
    stackable: true,
    maxStack: 10,
    icon: '🩹',
    rarity: 'common',
    effect: 'cure_burn',
  },
  thaw_crystal: {
    id: 'thaw_crystal',
    name: 'Thaw Crystal',
    description: 'Cures freeze',
    type: 'consumable',
    stackable: true,
    maxStack: 10,
    icon: '💎',
    rarity: 'common',
    effect: 'cure_freeze',
  },
  panacea: {
    id: 'panacea',
    name: 'Panacea',
    description: 'Cures all status effects',
    type: 'consumable',
    stackable: true,
    maxStack: 5,
    icon: '✨',
    rarity: 'rare',
    effect: 'cure_all',
  },
  
  // Buff items
  attack_boost: {
    id: 'attack_boost',
    name: 'Battle Powder',
    description: '+25% Attack for 5 turns',
    type: 'consumable',
    stackable: true,
    maxStack: 5,
    icon: '🔥',
    rarity: 'uncommon',
    effect: 'boost_attack',
    effectValue: 25,
    duration: 5,
  },
  defense_boost: {
    id: 'defense_boost',
    name: 'Iron Shell',
    description: '+25% Defense for 5 turns',
    type: 'consumable',
    stackable: true,
    maxStack: 5,
    icon: '🛡️',
    rarity: 'uncommon',
    effect: 'boost_defense',
    effectValue: 25,
    duration: 5,
  },
  speed_boost: {
    id: 'speed_boost',
    name: 'Swift Feather',
    description: '+25% Speed for 5 turns',
    type: 'consumable',
    stackable: true,
    maxStack: 5,
    icon: '🪶',
    rarity: 'uncommon',
    effect: 'boost_speed',
    effectValue: 25,
    duration: 5,
  },
  
  // Revive items
  revive_herb: {
    id: 'revive_herb',
    name: 'Revive Herb',
    description: 'Revives a fainted party member with 25% HP',
    type: 'consumable',
    stackable: true,
    maxStack: 5,
    icon: '🌿',
    rarity: 'uncommon',
    effect: 'revive',
    effectValue: 25,
  },
  phoenix_feather: {
    id: 'phoenix_feather',
    name: 'Phoenix Feather',
    description: 'Revives a fainted party member with 50% HP',
    type: 'consumable',
    stackable: true,
    maxStack: 3,
    icon: '🔥',
    rarity: 'rare',
    effect: 'revive',
    effectValue: 50,
  },
  miracle_elixir: {
    id: 'miracle_elixir',
    name: 'Miracle Elixir',
    description: 'Revives a fainted party member with full HP',
    type: 'consumable',
    stackable: true,
    maxStack: 2,
    icon: '⭐',
    rarity: 'epic',
    effect: 'revive_full',
  },
  // Town Portal Scroll - escape any non-home dungeon back to town
  town_portal_scroll: {
    id: 'town_portal_scroll',
    name: 'Town Portal Scroll',
    description: 'Tears open a portal back to town. Required to exit any tower other than the Tower of the Infinite.',
    type: 'consumable',
    stackable: true,
    maxStack: 10,
    icon: '📜',
    rarity: 'uncommon',
    effect: 'town_portal',
  },
};

// Rarity colors
const RARITY_COLORS: Record<Item['rarity'], string> = {
  common: 'border-muted-foreground/30',
  uncommon: 'border-green-500/50',
  rare: 'border-blue-500/50',
  epic: 'border-purple-500/50',
};

const RARITY_TEXT: Record<Item['rarity'], string> = {
  common: 'text-muted-foreground',
  uncommon: 'text-green-400',
  rare: 'text-blue-400',
  epic: 'text-purple-400',
};

// Create default inventory with starter items
export function createStarterInventory(): Inventory {
  return {
    slots: [
      { item: ITEMS.small_potion, quantity: 3 },
      { item: ITEMS.antidote, quantity: 1 },
      { item: ITEMS.town_portal_scroll, quantity: 1 },
    ],
    maxSlots: 20,
    gold: 0,
  };
}

// Add item to inventory
export function addItemToInventory(inventory: Inventory, item: Item, quantity: number = 1): Inventory {
  const newSlots = [...inventory.slots];
  
  // Check if item already exists and is stackable
  if (item.stackable) {
    const existingSlot = newSlots.find(slot => slot.item.id === item.id);
    if (existingSlot) {
      existingSlot.quantity = Math.min(existingSlot.quantity + quantity, item.maxStack);
      return { ...inventory, slots: newSlots };
    }
  }
  
  // Add new slot if space available
  if (newSlots.length < inventory.maxSlots) {
    newSlots.push({ item, quantity: Math.min(quantity, item.maxStack) });
  }
  
  return { ...inventory, slots: newSlots };
}

// Remove item from inventory
export function removeItemFromInventory(inventory: Inventory, itemId: string, quantity: number = 1): Inventory {
  const newSlots = inventory.slots
    .map(slot => {
      if (slot.item.id === itemId) {
        return { ...slot, quantity: slot.quantity - quantity };
      }
      return slot;
    })
    .filter(slot => slot.quantity > 0);
  
  return { ...inventory, slots: newSlots };
}

// Apply item effect to monster
export function applyItemEffect(
  item: Item, 
  target: FullMonster
): { monster: FullMonster; message: string } {
  const newStats = { ...target.stats };
  let message = '';
  
  switch (item.effect) {
    case 'heal_hp':
      const hpHealed = Math.min(item.effectValue || 0, newStats.maxHp - newStats.currentHp);
      newStats.currentHp = Math.min(newStats.maxHp, newStats.currentHp + (item.effectValue || 0));
      message = `Restored ${hpHealed} HP!`;
      break;
      
    case 'heal_stamina':
      const staHealed = Math.min(item.effectValue || 0, newStats.stamina - newStats.currentStamina);
      newStats.currentStamina = Math.min(newStats.stamina, newStats.currentStamina + (item.effectValue || 0));
      message = `Restored ${staHealed} Stamina!`;
      break;
      
    case 'cure_poison':
      message = 'Cured poison!';
      break;
      
    case 'cure_burn':
      message = 'Cured burn!';
      break;
      
    case 'cure_freeze':
      message = 'Cured freeze!';
      break;
      
    case 'cure_all':
      message = 'Cured all status effects!';
      break;
      
    case 'boost_attack':
      message = `Attack boosted by ${item.effectValue}% for ${item.duration} turns!`;
      break;
      
    case 'boost_defense':
      message = `Defense boosted by ${item.effectValue}% for ${item.duration} turns!`;
      break;
      
    case 'boost_speed':
      message = `Speed boosted by ${item.effectValue}% for ${item.duration} turns!`;
      break;
      
    default:
      message = `Used ${item.name}`;
  }
  
  return {
    monster: { ...target, stats: newStats },
    message,
  };
}

// Inventory UI Components
interface InventorySlotProps {
  slot: InventorySlot | null;
  index: number;
  selected: boolean;
  onSelect: (index: number) => void;
}

function InventorySlotUI({ slot, index, selected, onSelect }: InventorySlotProps) {
  if (!slot) {
    return (
      <div 
        className="w-12 h-12 border border-border/50 bg-muted/20 rounded flex items-center justify-center"
        onClick={() => onSelect(index)}
      >
        <span className="text-muted-foreground/30 text-xs">—</span>
      </div>
    );
  }
  
  return (
    <div 
      className={`w-12 h-12 border-2 ${RARITY_COLORS[slot.item.rarity]} bg-card rounded flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors ${selected ? 'ring-2 ring-primary' : ''}`}
      onClick={() => onSelect(index)}
    >
      <span className="text-lg">{slot.item.icon}</span>
      {slot.quantity > 1 && (
        <span className="text-[10px] font-bold text-foreground">{slot.quantity}</span>
      )}
    </div>
  );
}

interface InventoryUIProps {
  inventory: Inventory;
  onUseItem: (itemId: string) => void;
  targetMonster?: FullMonster;
}

export function InventoryUI({ inventory, onUseItem, targetMonster }: InventoryUIProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selectedSlot = selectedIndex !== null ? inventory.slots[selectedIndex] : null;
  
  // Create array with empty slots
  const displaySlots: (InventorySlot | null)[] = [
    ...inventory.slots,
    ...Array(Math.max(0, inventory.maxSlots - inventory.slots.length)).fill(null),
  ];
  
  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Inventory</h3>
        <span className="text-sm text-primary font-mono">💰 {inventory.gold}</span>
      </div>
      
      {/* Item grid */}
      <div className="grid grid-cols-5 gap-2">
        {displaySlots.slice(0, 20).map((slot, i) => (
          <InventorySlotUI
            key={i}
            slot={slot}
            index={i}
            selected={selectedIndex === i}
            onSelect={setSelectedIndex}
          />
        ))}
      </div>
      
      {/* Selected item details */}
      {selectedSlot && (
        <div className="bg-muted/50 rounded p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{selectedSlot.item.icon}</span>
            <div>
              <h4 className={`font-semibold ${RARITY_TEXT[selectedSlot.item.rarity]}`}>
                {selectedSlot.item.name}
              </h4>
              <p className="text-xs text-muted-foreground">{selectedSlot.item.description}</p>
            </div>
          </div>
          
          {selectedSlot.item.type === 'consumable' && (
            <Button 
              size="sm" 
              className="w-full"
              onClick={() => {
                onUseItem(selectedSlot.item.id);
                setSelectedIndex(null);
              }}
            >
              Use
            </Button>
          )}
        </div>
      )}
      
      <p className="text-xs text-muted-foreground text-center">
        {inventory.slots.length} / {inventory.maxSlots} slots
      </p>
    </Card>
  );
}

// Quick item bar for dungeon/battle
interface QuickItemBarProps {
  inventory: Inventory;
  onUseItem: (itemId: string) => void;
}

export function QuickItemBar({ inventory, onUseItem }: QuickItemBarProps) {
  // Show first 4 consumables
  const quickItems = inventory.slots
    .filter(slot => slot.item.type === 'consumable')
    .slice(0, 4);
  
  if (quickItems.length === 0) return null;
  
  return (
    <div className="flex gap-2">
      {quickItems.map((slot, i) => (
        <button
          key={i}
          className={`w-10 h-10 border ${RARITY_COLORS[slot.item.rarity]} bg-card rounded flex flex-col items-center justify-center hover:bg-muted/50 transition-colors`}
          onClick={() => onUseItem(slot.item.id)}
          title={`${slot.item.name} (${slot.quantity})`}
        >
          <span className="text-sm">{slot.item.icon}</span>
          <span className="text-[8px] font-bold">{slot.quantity}</span>
        </button>
      ))}
    </div>
  );
}