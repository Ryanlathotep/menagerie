// Right-click context menu for any walkable ground tile (grass, harvested
// grass, roads, water-filled patches). Offers four core actions:
//   1. Attack — opens the attack picker (only when an enemy/nest is in range)
//   2. Build — switches to the build panel
//   3. Move here — single-step toward this tile if it's adjacent
//   4. Toggle Auto-Shovel — session-only on/off for auto-digging runes
//
// All callbacks are optional; the parent decides which actions are valid
// for the clicked tile by leaving handlers undefined to disable the row.

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Hammer, X, Swords, Footprints, Shovel } from 'lucide-react';

interface TileContextMenuProps {
  worldX: number;
  worldY: number;
  /** Optional friendly tile label (e.g. "Open ground", "Dirt road"). */
  tileLabel?: string;
  /** Auto-Shovel session flag (controls toggle row state). */
  autoShovelEnabled: boolean;
  /** True when the active monster could open an attack picker for this tile. */
  attackAvailable?: boolean;
  /** Disable the move row when the tile isn't reachable in one step. */
  moveAvailable?: boolean;
  onAttack?: () => void;
  onBuild: () => void;
  onMoveHere?: () => void;
  onToggleAutoShovel: () => void;
  onClose: () => void;
}

export function TileContextMenu({
  worldX,
  worldY,
  tileLabel = 'Open ground',
  autoShovelEnabled,
  attackAvailable = false,
  moveAvailable = false,
  onAttack,
  onBuild,
  onMoveHere,
  onToggleAutoShovel,
  onClose,
}: TileContextMenuProps) {
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
              ({worldX}, {worldY}) • {tileLabel}
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
            onClick={onAttack}
            disabled={!attackAvailable || !onAttack}
            title={attackAvailable ? 'Pick a move that can reach a target near this tile' : 'No enemy or nest in range of this tile'}
          >
            <Swords className="h-4 w-4 mr-2" />
            <span className="flex-1 text-left">
              Attack from here
              {!attackAvailable && (
                <span className="block text-[10px] opacity-70">No target in range</span>
              )}
            </span>
          </Button>

          <Button
            variant="secondary"
            className="w-full justify-start"
            onClick={onBuild}
          >
            <Hammer className="h-4 w-4 mr-2" />
            <span className="flex-1 text-left">Build here</span>
          </Button>

          <Button
            variant="secondary"
            className="w-full justify-start"
            onClick={onMoveHere}
            disabled={!moveAvailable || !onMoveHere}
            title={moveAvailable ? 'Step onto this tile' : 'Tile is not adjacent — walk closer first'}
          >
            <Footprints className="h-4 w-4 mr-2" />
            <span className="flex-1 text-left">
              Move here
              {!moveAvailable && (
                <span className="block text-[10px] opacity-70">Not adjacent</span>
              )}
            </span>
          </Button>

          <Button
            variant={autoShovelEnabled ? 'default' : 'outline'}
            className="w-full justify-start"
            onClick={onToggleAutoShovel}
          >
            <Shovel className="h-4 w-4 mr-2" />
            <span className="flex-1 text-left">
              Auto-Shovel: {autoShovelEnabled ? 'On' : 'Off'}
              <span className="block text-[10px] opacity-70">
                {autoShovelEnabled
                  ? 'Walking onto a rune auto-digs it (with a sufficient shovel).'
                  : 'Walking onto runes leaves them intact.'}
              </span>
            </span>
          </Button>
        </div>

        <p className="text-[10px] text-muted-foreground text-center italic">
          Build within 10 steps of home or any existing structure.
        </p>
      </Card>
    </div>
  );
}
