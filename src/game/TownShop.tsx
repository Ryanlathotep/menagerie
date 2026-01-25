// Town Shop Component - Accessible from main menu

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { InventoryItem } from './types';
import { generateEquipment, EquipmentItem, RARITY_COLORS, SLOT_INFO } from './equipment';
import { Coins } from 'lucide-react';

interface TownShopProps {
  gold: number;
  onBuyItem: (item: InventoryItem, price: number) => void;
  onBuyEquipment: (item: EquipmentItem, price: number) => void;
  onSellEquipment: (itemId: string, price: number) => void;
  storedEquipment: EquipmentItem[];
  onClose: () => void;
}

// Shop item with display info
interface ShopItem {
  item: Omit<InventoryItem, 'type'> & { type: InventoryItem['type'] };
  price: number;
  icon: string;
  description: string;
}

// Shop consumables with prices
const SHOP_ITEMS: ShopItem[] = [
  { 
    item: { id: 'health_potion', name: 'Health Potion', quantity: 1, type: 'potion', effect: 'heal_hp', value: 30 }, 
    price: 25, icon: '🧪', description: 'Restores 30 HP'
  },
  { 
    item: { id: 'greater_health_potion', name: 'Greater Health Potion', quantity: 1, type: 'potion', effect: 'heal_hp', value: 75 }, 
    price: 60, icon: '🧪', description: 'Restores 75 HP'
  },
  { 
    item: { id: 'stamina_potion', name: 'Stamina Potion', quantity: 1, type: 'potion', effect: 'heal_stamina', value: 20 }, 
    price: 20, icon: '⚗️', description: 'Restores 20 Stamina'
  },
  { 
    item: { id: 'antidote', name: 'Antidote', quantity: 1, type: 'potion', effect: 'cure_poison', value: 10 }, 
    price: 15, icon: '💊', description: 'Cures poison'
  },
  { 
    item: { id: 'burn_salve', name: 'Burn Salve', quantity: 1, type: 'potion', effect: 'cure_burn', value: 10 }, 
    price: 15, icon: '🩹', description: 'Cures burn'
  },
  { 
    item: { id: 'thaw_crystal', name: 'Thaw Crystal', quantity: 1, type: 'potion', effect: 'cure_freeze', value: 10 }, 
    price: 15, icon: '💎', description: 'Cures freeze'
  },
  { 
    item: { id: 'panacea', name: 'Panacea', quantity: 1, type: 'potion', effect: 'cure_all', value: 30 }, 
    price: 75, icon: '✨', description: 'Cures all status effects'
  },
  { 
    item: { id: 'revive_herb', name: 'Revive Herb', quantity: 1, type: 'potion', effect: 'revive', value: 25 }, 
    price: 100, icon: '🌿', description: 'Revives with 25% HP'
  },
  { 
    item: { id: 'phoenix_feather', name: 'Phoenix Feather', quantity: 1, type: 'potion', effect: 'revive', value: 50 }, 
    price: 200, icon: '🔥', description: 'Revives with 50% HP'
  },
];

// Generate town shop equipment (refreshes on visit, higher average quality)
function generateTownEquipment(): { item: EquipmentItem; price: number }[] {
  const items: { item: EquipmentItem; price: number }[] = [];
  
  // Generate 6-8 random equipment pieces at various levels
  const numItems = 6 + Math.floor(Math.random() * 3);
  
  for (let i = 0; i < numItems; i++) {
    // Town shop has variety from level 1-10
    const level = 1 + Math.floor(Math.random() * 10);
    const item = generateEquipment(undefined, level);
    const basePrice = item.level * 20;
    const rarityMult = item.rarity === 'common' ? 1 : item.rarity === 'uncommon' ? 2.5 : item.rarity === 'rare' ? 5 : item.rarity === 'epic' ? 10 : 20;
    const price = Math.floor(basePrice * rarityMult);
    items.push({ item, price });
  }
  
  return items.sort((a, b) => a.price - b.price);
}

// Calculate sell price for equipment (50% of estimated value)
function getEquipmentSellPrice(item: EquipmentItem): number {
  const basePrice = item.level * 20;
  const rarityMult = item.rarity === 'common' ? 1 : item.rarity === 'uncommon' ? 2.5 : item.rarity === 'rare' ? 5 : item.rarity === 'epic' ? 10 : 20;
  return Math.floor((basePrice * rarityMult) * 0.5);
}

export function TownShop({ 
  gold,
  onBuyItem, 
  onBuyEquipment, 
  onSellEquipment,
  storedEquipment,
  onClose 
}: TownShopProps) {
  const [shopEquipment] = useState(() => generateTownEquipment());
  const [boughtEquipment, setBoughtEquipment] = useState<string[]>([]);
  const [soldEquipment, setSoldEquipment] = useState<string[]>([]);
  
  const handleBuyEquipment = (item: EquipmentItem, price: number) => {
    if (gold >= price && !boughtEquipment.includes(item.id)) {
      onBuyEquipment(item, price);
      setBoughtEquipment(prev => [...prev, item.id]);
    }
  };
  
  const handleSellEquipment = (item: EquipmentItem) => {
    const price = getEquipmentSellPrice(item);
    onSellEquipment(item.id, price);
    setSoldEquipment(prev => [...prev, item.id]);
  };
  
  // Filter out sold items from display
  const displayedStoredEquipment = storedEquipment.filter(item => !soldEquipment.includes(item.id));
  
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl p-6 space-y-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-yellow-500 bg-clip-text text-transparent">
            🏪 Town Shop
          </h2>
          <div className="flex items-center gap-2 text-lg font-bold text-primary">
            <Coins className="w-5 h-5 text-amber-400" />
            <span>{gold}</span>
          </div>
        </div>
        
        <p className="text-sm text-muted-foreground">
          Stock up before your next adventure, or sell equipment you don't need.
        </p>
        
        <Tabs defaultValue="buy" className="flex-1 flex flex-col min-h-0">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="buy">🧪 Buy Items</TabsTrigger>
            <TabsTrigger value="equipment">⚔️ Buy Gear</TabsTrigger>
            <TabsTrigger value="sell">💰 Sell</TabsTrigger>
          </TabsList>
          
          <TabsContent value="buy" className="flex-1 min-h-0">
            <ScrollArea className="h-[350px]">
              <div className="space-y-2 pr-4">
                {SHOP_ITEMS.map(({ item, price, icon, description }) => (
                  <div 
                    key={item.id} 
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{icon}</span>
                      <div>
                        <p className="font-semibold">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{description}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      disabled={gold < price}
                      onClick={() => onBuyItem(item, price)}
                      className="bg-gradient-to-r from-amber-500 to-yellow-500 text-black"
                    >
                      💰 {price}
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="equipment" className="flex-1 min-h-0">
            <ScrollArea className="h-[350px]">
              <div className="space-y-2 pr-4">
                {shopEquipment.map(({ item, price }) => {
                  const bought = boughtEquipment.includes(item.id);
                  const rarityStyle = RARITY_COLORS[item.rarity];
                  
                  return (
                    <div 
                      key={item.id} 
                      className={`
                        p-3 rounded-lg border transition-all
                        ${bought ? 'opacity-50' : 'hover:scale-[1.01]'}
                        ${rarityStyle.bg} ${rarityStyle.border}
                      `}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{item.icon}</span>
                          <div>
                            <p className={`font-semibold text-sm ${rarityStyle.text}`}>{item.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {SLOT_INFO[item.slot].label} • Lv.{item.level}
                            </p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {Object.entries(item.stats).map(([stat, value]) => (
                                value !== 0 && (
                                  <span 
                                    key={stat} 
                                    className={`text-[10px] px-1 rounded ${Number(value) > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}
                                  >
                                    {Number(value) > 0 ? '+' : ''}{value} {stat.replace('max', '').slice(0, 3).toUpperCase()}
                                  </span>
                                )
                              ))}
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          disabled={gold < price || bought}
                          onClick={() => handleBuyEquipment(item, price)}
                          className="bg-gradient-to-r from-amber-500 to-yellow-500 text-black shrink-0"
                        >
                          {bought ? '✓ Sold' : `💰 ${price}`}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="sell" className="flex-1 min-h-0">
            <ScrollArea className="h-[350px]">
              <div className="space-y-2 pr-4">
                {displayedStoredEquipment.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No equipment to sell. Find gear in the dungeon!
                  </p>
                ) : (
                  displayedStoredEquipment.map((item) => {
                    const sellPrice = getEquipmentSellPrice(item);
                    const rarityStyle = RARITY_COLORS[item.rarity];
                    
                    return (
                      <div 
                        key={item.id} 
                        className={`
                          p-3 rounded-lg border transition-all hover:scale-[1.01]
                          ${rarityStyle.bg} ${rarityStyle.border}
                        `}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{item.icon}</span>
                            <div>
                              <p className={`font-semibold text-sm ${rarityStyle.text}`}>{item.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {SLOT_INFO[item.slot].label} • Lv.{item.level}
                              </p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {Object.entries(item.stats).map(([stat, value]) => (
                                  value !== 0 && (
                                    <span 
                                      key={stat} 
                                      className={`text-[10px] px-1 rounded ${Number(value) > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}
                                    >
                                      {Number(value) > 0 ? '+' : ''}{value} {stat.replace('max', '').slice(0, 3).toUpperCase()}
                                    </span>
                                  )
                                ))}
                              </div>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSellEquipment(item)}
                            className="border-amber-500/50 text-amber-400 hover:bg-amber-500/20 shrink-0"
                          >
                            Sell 💰 {sellPrice}
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
        
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Leave Shop
          </Button>
        </div>
      </Card>
    </div>
  );
}