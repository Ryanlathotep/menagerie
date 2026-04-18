// Right-click context menu for dungeon entrance tiles.
// Lets the player pin / unpin a waypoint arrow for that specific dungeon.

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Flag, FlagOff, X, DoorOpen } from 'lucide-react';
import { DungeonEntrance } from './types';

interface Props {
  worldX: number;
  worldY: number;
  dungeon: DungeonEntrance;
  isWaypointed: boolean;
  onToggleWaypoint: () => void;
  onEnter?: () => void;
  onClose: () => void;
}

export function DungeonWaypointMenu({
  worldX, worldY, dungeon, isWaypointed, onToggleWaypoint, onEnter, onClose,
}: Props) {
  const name = dungeon.name || `Dungeon at (${worldX}, ${worldY})`;
  const isMajor = dungeon.category && dungeon.category !== 'procedural';

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
          <div className="min-w-0">
            <h2 className="text-base font-bold truncate">🏰 {name}</h2>
            <p className="text-[11px] text-muted-foreground">
              ({worldX}, {worldY}) · Start F{dungeon.difficulty || 1}
              {dungeon.deepestFloor > 0 && ` · Best F${dungeon.deepestFloor}`}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2">
          <Button
            variant={isWaypointed ? 'default' : 'secondary'}
            className="w-full justify-start"
            onClick={onToggleWaypoint}
          >
            {isWaypointed ? (
              <>
                <FlagOff className="h-4 w-4 mr-2" />
                <span className="flex-1 text-left">Hide waypoint arrow</span>
              </>
            ) : (
              <>
                <Flag className="h-4 w-4 mr-2" />
                <span className="flex-1 text-left">Show waypoint arrow</span>
              </>
            )}
          </Button>

          {onEnter && (
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={onEnter}
            >
              <DoorOpen className="h-4 w-4 mr-2" />
              <span className="flex-1 text-left">Enter dungeon</span>
            </Button>
          )}
        </div>

        <p className="text-[10px] text-muted-foreground text-center italic">
          {isMajor
            ? 'Tip: major towers also have a global toggle in Settings → Overworld Arrows.'
            : 'Pinned waypoints show an edge-of-screen arrow even when the dungeon is off-screen.'}
        </p>
      </Card>
    </div>
  );
}
