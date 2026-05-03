// Unified right-click action menu for any dungeon tile. Lists every valid
// interaction (attack, disarm, harvest, dig rune, pin waypoint, walk here)
// in one place so players never have to guess which gesture maps to which
// action — and so right-clicking a trap (or anything special) doesn't
// quietly toggle a waypoint underneath it.

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  X, Swords, Footprints, MapPin, MapPinOff,
  Wrench, Sprout, Shovel, Pickaxe, Skull, DoorOpen,
} from 'lucide-react';

export interface TileAction {
  id: string;
  label: string;
  hint?: string;
  icon: 'attack' | 'disarm' | 'harvest' | 'dig' | 'mine'
      | 'pin' | 'unpin' | 'walk' | 'enemy' | 'enter';
  disabled?: boolean;
  primary?: boolean;
  onSelect: () => void;
}

interface Props {
  worldX: number;
  worldY: number;
  tileLabel: string;
  actions: TileAction[];
  onClose: () => void;
}

const ICONS = {
  attack: Swords,
  disarm: Wrench,
  harvest: Sprout,
  dig: Shovel,
  mine: Pickaxe,
  pin: MapPin,
  unpin: MapPinOff,
  walk: Footprints,
  enemy: Skull,
  enter: DoorOpen,
};

export function DungeonTileActionMenu({ worldX, worldY, tileLabel, actions, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 bg-background/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
      onContextMenu={(e) => { e.preventDefault(); onClose(); }}
    >
      <Card
        className="p-4 max-w-sm w-full space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-bold">Tile actions</h2>
            <p className="text-[11px] text-muted-foreground">
              ({worldX}, {worldY}) • {tileLabel}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2">
          {actions.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">
              Nothing to do on this tile.
            </p>
          )}
          {actions.map((a) => {
            const Icon = ICONS[a.icon];
            return (
              <Button
                key={a.id}
                variant={a.primary ? 'default' : 'secondary'}
                className="w-full justify-start"
                disabled={a.disabled}
                onClick={() => { a.onSelect(); onClose(); }}
              >
                <Icon className="h-4 w-4 mr-2" />
                <span className="flex-1 text-left">
                  {a.label}
                  {a.hint && (
                    <span className="block text-[10px] opacity-70">{a.hint}</span>
                  )}
                </span>
              </Button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
