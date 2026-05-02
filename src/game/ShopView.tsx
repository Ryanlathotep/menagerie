// Shop View Component with Equipment

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LootItem } from './dungeon';
import { generateEquipment, EquipmentItem, RARITY_COLORS, SLOT_INFO } from './equipment';

interface ShopViewProps {
  gold: number;
  floor: number;
  onBuy: (item: LootItem, price: number) => void;
  onBuyEquipment: (item: EquipmentItem, price: number) => void;
  onClose: () => void;
}

const SHOP_ITEMS: { item: LootItem; price: number }[] = [
  { item: { id: 'health_potion', name: 'Health Potion', type: 'potion', value: 30, effect: 'heal_hp' }, price: 25 },
  { item: { id: 'stamina_potion', name: 'Stamina Potion', type: 'potion', value: 20, effect: 'heal_stamina' }, price: 20 },
  { item: { id: 'antidote', name: 'Antidote', type: 'potion', value: 10, effect: 'cure_poison' }, price: 15 },
  { item: { id: 'power_berry', name: 'Power Berry', type: 'potion', value: 25, effect: 'boost_attack' }, price: 30 },
  { item: { id: 'full_heal', name: 'Full Heal', type: 'potion', value: 999, effect: 'heal_full' }, price: 50 },
  { item: { id: 'revive_herb', name: 'Revive Herb', type: 'potion', value: 25, effect: 'revive' }, price: 75 },
  { item: { id: 'phoenix_feather', name: 'Phoenix Feather', type: 'potion', value: 50, effect: 'revive' }, price: 150 },
];

// Generate shop equipment based on floor
function generateShopEquipment(floor: number): { item: EquipmentItem; price: number }[] {
  const items: { item: EquipmentItem; price: number }[] = [];
  
  // Generate 4-6 random equipment pieces
  const numItems = 4 + Math.floor(Math.random() * 3);
  
  for (let i = 0; i < numItems; i++) {
    const item = generateEquipment(undefined, floor);
    const basePrice = item.level * 15;
    const rarityMult = item.rarity === 'common' ? 1 : item.rarity === 'uncommon' ? 2 : item.rarity === 'rare' ? 4 : item.rarity === 'epic' ? 8 : 15;
    const price = Math.floor(basePrice * rarityMult);
    items.push({ item, price });
  }
  
  return items.sort((a, b) => a.price - b.price);
}

export function ShopView({ gold, floor, onBuy, onBuyEquipment, onClose }: ShopViewProps) {
  // Generate equipment once when shop opens
  const [shopEquipment] = useState(() => generateShopEquipment(floor));
  const [boughtEquipment, setBoughtEquipment] = useState<string[]>([]);
  
  const handleBuyEquipment = (item: EquipmentItem, price: number) => {
    if (gold >= price && !boughtEquipment.includes(item.id)) {
      onBuyEquipment(item, price);
      setBoughtEquipment(prev => [...prev, item.id]);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <Card className="w-full max-w-lg p-3 sm:p-6 space-y-2 sm:space-y-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-2xl font-bold bg-gradient-to-r from-green-500 to-emerald-500 bg-clip-text text-transparent">
            🏪 Shop
          </h2>
          <span className="text-sm sm:text-lg font-bold text-primary">💰 {gold}</span>
        </div>
        
        <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
          Welcome, traveler! Take a rest and stock up on supplies.
        </p>
        
        <Tabs defaultValue="potions" className="flex-1 flex flex-col min-h-0">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="potions">🧪 Potions</TabsTrigger>
            <TabsTrigger value="equipment">⚔️ Equipment</TabsTrigger>
          </TabsList>
          
          <TabsContent value="potions" className="flex-1 min-h-0">
            <ScrollArea className="h-[40vh] sm:h-[300px]">
              <div className="space-y-2 pr-4">
                {SHOP_ITEMS.map(({ item, price }) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.effect?.replace(/_/g, ' ')}</p>
                    </div>
                    <Button
                      size="sm"
                      disabled={gold < price}
                      onClick={() => onBuy(item, price)}
                      className="bg-gradient-to-r from-green-500 to-emerald-500"
                    >
                      💰 {price}
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="equipment" className="flex-1 min-h-0">
            <ScrollArea className="h-[40vh] sm:h-[300px]">
              <div className="space-y-2 pr-4">
                {shopEquipment.map(({ item, price }) => {
                  const bought = boughtEquipment.includes(item.id);
                  const rarityStyle = RARITY_COLORS[item.rarity];
                  
                  return (
                    <div 
                      key={item.id} 
                      className={`
                        p-3 rounded-lg border transition-all
                        ${bought ? 'opacity-50' : ''}
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
                          className="bg-gradient-to-r from-green-500 to-emerald-500 shrink-0"
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
        </Tabs>
        
        <Button variant="outline" className="w-full" onClick={onClose}>
          Leave Shop
        </Button>
      </Card>
    </div>
  );
}
