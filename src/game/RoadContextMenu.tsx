// Right-click context menu for road tiles (dirt_road / stone_road).
// Currently exposes a "Disassemble road" action that refunds partial materials.

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Recycle, X } from 'lucide-react';
import { ROAD_DEFINITIONS, RoadType, getRoadRefund } from './overworld';

interface RoadContextMenuProps {
  worldX: number;
  worldY: number;
  roadType: RoadType;
  onDisassemble: () => void;
  onClose: () => void;
}

export function RoadContextMenu({
  worldX,
  worldY,
  roadType,
  onDisassemble,
  onClose,
}: RoadContextMenuProps) {
  const def = ROAD_DEFINITIONS[roadType];
  const refund = getRoadRefund(roadType);

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
            <h2 className="text-base font-bold">
              {def.emoji} {def.name}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              ({worldX}, {worldY}) • Player-built road
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2">
          <Button
            variant="destructive"
            className="w-full justify-start"
            onClick={onDisassemble}
          >
            <Recycle className="h-4 w-4 mr-2" />
            <span className="flex-1 text-left">Disassemble road</span>
            <span className="text-[11px] opacity-90">
              +🪵{refund.wood} +🪨{refund.stone}
            </span>
          </Button>
        </div>

        <p className="text-[10px] text-muted-foreground text-center italic">
          Disassembling refunds 50% of the original materials and restores grass.
        </p>
      </Card>
    </div>
  );
}
