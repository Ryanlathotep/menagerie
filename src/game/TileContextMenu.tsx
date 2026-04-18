// Lightweight right-click context menu for plain world tiles (grass, harvested grass).
// Currently exposes a "Build here" shortcut, but is structured so more actions
// (place item, place road) can be added later.

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Hammer, X } from 'lucide-react';

interface TileContextMenuProps {
  worldX: number;
  worldY: number;
  onBuild: () => void;
  onClose: () => void;
}

export function TileContextMenu({ worldX, worldY, onBuild, onClose }: TileContextMenuProps) {
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
            <h2 className="text-base font-bold">🍃 Tile</h2>
            <p className="text-[11px] text-muted-foreground">
              ({worldX}, {worldY}) • Open ground
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
            onClick={onBuild}
          >
            <Hammer className="h-4 w-4 mr-2" />
            <span className="flex-1 text-left">Build here</span>
          </Button>
        </div>

        <p className="text-[10px] text-muted-foreground text-center italic">
          Buildings can be placed within 10 steps of your home or any existing structure.
        </p>
      </Card>
    </div>
  );
}
