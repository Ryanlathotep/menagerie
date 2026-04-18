// Right-click context menu for water tiles. Lets the player spend resources
// to fill a water tile with grass (a soft "terraforming" feature).

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Shovel, X } from 'lucide-react';

interface Props {
  worldX: number;
  worldY: number;
  costWood: number;
  costStone: number;
  haveWood: number;
  haveStone: number;
  onFill: () => void;
  onClose: () => void;
}

export function WaterTileContextMenu({
  worldX, worldY, costWood, costStone, haveWood, haveStone, onFill, onClose,
}: Props) {
  const canAfford = haveWood >= costWood && haveStone >= costStone;
  const missing: string[] = [];
  if (haveWood < costWood) missing.push(`${costWood - haveWood} wood`);
  if (haveStone < costStone) missing.push(`${costStone - haveStone} stone`);

  return (
    <div
      className="fixed inset-0 bg-background/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <Card
        className="p-4 max-w-sm w-full space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-bold">💧 Water</h2>
            <p className="text-[11px] text-muted-foreground">
              ({worldX}, {worldY}) · Impassable
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2">
          <Button
            variant="secondary"
            className="w-full justify-start"
            onClick={onFill}
            disabled={!canAfford}
            title={canAfford ? undefined : `Need ${missing.join(' and ')}`}
          >
            <Shovel className="h-4 w-4 mr-2" />
            <div className="flex-1 text-left">
              <div>Fill with grass</div>
              <div className="text-[10px] opacity-80">
                Cost: 🪵 {costWood} · 🪨 {costStone}
              </div>
            </div>
          </Button>
        </div>

        <p className="text-[10px] text-muted-foreground text-center italic">
          {canAfford
            ? 'Reclaims the tile so you can walk on it and build.'
            : `Not enough resources — need ${missing.join(' and ')}.`}
        </p>
      </Card>
    </div>
  );
}
