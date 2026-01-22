// Shop View Component

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LOOT_TABLE, LootItem } from './dungeon';

interface ShopViewProps {
  gold: number;
  onBuy: (item: LootItem) => void;
  onClose: () => void;
}

const SHOP_ITEMS: { item: LootItem; price: number }[] = [
  { item: { id: 'health_potion', name: 'Health Potion', type: 'potion', value: 30, effect: 'heal_hp' }, price: 25 },
  { item: { id: 'stamina_potion', name: 'Stamina Potion', type: 'potion', value: 20, effect: 'heal_stamina' }, price: 20 },
  { item: { id: 'antidote', name: 'Antidote', type: 'potion', value: 10, effect: 'cure_poison' }, price: 15 },
  { item: { id: 'power_berry', name: 'Power Berry', type: 'potion', value: 25, effect: 'boost_attack' }, price: 30 },
  { item: { id: 'full_heal', name: 'Full Heal', type: 'potion', value: 999, effect: 'heal_full' }, price: 50 },
];

export function ShopView({ gold, onBuy, onClose }: ShopViewProps) {
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <Card className="w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-green-500 to-emerald-500 bg-clip-text text-transparent">
            🏪 Shop
          </h2>
          <span className="text-lg font-bold text-primary">💰 {gold}</span>
        </div>
        
        <p className="text-sm text-muted-foreground">
          Welcome, traveler! Take a rest and stock up on supplies.
        </p>
        
        <div className="space-y-2">
          {SHOP_ITEMS.map(({ item, price }) => (
            <div key={item.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <p className="font-semibold">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.effect?.replace(/_/g, ' ')}</p>
              </div>
              <Button
                size="sm"
                disabled={gold < price}
                onClick={() => onBuy(item)}
                className="bg-gradient-to-r from-green-500 to-emerald-500"
              >
                💰 {price}
              </Button>
            </div>
          ))}
        </div>
        
        <Button variant="outline" className="w-full" onClick={onClose}>
          Leave Shop
        </Button>
      </Card>
    </div>
  );
}
