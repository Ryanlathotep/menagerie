// Right-click context menu for player buildings:
// Assign/Manage monster, Repair, Disassemble, Flip Gate (gates only).

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  PlayerBuilding,
  BUILDING_DEFINITIONS,
  getDisassembleRefund,
  getRepairCost,
} from './buildings';
import { Monster } from './types';
import { Hammer, Recycle, RefreshCw, UserPlus, X } from 'lucide-react';

interface BuildingContextMenuProps {
  building: PlayerBuilding;
  party: Monster[];
  woodAvailable: number;
  stoneAvailable: number;
  /** True iff this wall is currently acting as a gate (between two roads). */
  isGate?: boolean;
  onAssign: () => void;
  onRepair: () => void;
  onDisassemble: () => void;
  /** Toggle the gate's banner-side / outward-side. Only used when isGate is true. */
  onFlipGate?: () => void;
  onClose: () => void;
}

export function BuildingContextMenu({
  building,
  party,
  woodAvailable,
  stoneAvailable,
  isGate,
  onAssign,
  onRepair,
  onDisassemble,
  onFlipGate,
  onClose,
}: BuildingContextMenuProps) {
  const def = BUILDING_DEFINITIONS[building.type];
  const assigned = building.assignedMonsterId
    ? party.find(m => m.id === building.assignedMonsterId)
    : null;

  const damaged = building.hp < building.maxHp;
  const repairCost = getRepairCost(building);
  const refund = getDisassembleRefund(building);
  const canRepair =
    damaged && woodAvailable >= repairCost.wood && stoneAvailable >= repairCost.stone;

  return (
    <div
      className="fixed inset-0 bg-background/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <Card
        className="p-4 max-w-sm w-full space-y-3"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-bold">
              {def.emoji} {def.name}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              ({building.worldX}, {building.worldY}) • HP {building.hp}/{building.maxHp}
              {assigned && ` • 👤 ${assigned.name}`}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          {def.requiresMonster && (
            <Button
              variant="secondary"
              className="w-full justify-start"
              onClick={onAssign}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              {assigned ? 'Manage Assigned Monster' : 'Assign Monster'}
            </Button>
          )}

          {isGate && onFlipGate && (
            <Button
              variant="secondary"
              className="w-full justify-start"
              onClick={onFlipGate}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              <span className="flex-1 text-left">Flip Gate Facing</span>
              <span className="text-[11px] text-muted-foreground">
                (banner side)
              </span>
            </Button>
          )}

          <Button
            variant="secondary"
            className="w-full justify-start"
            disabled={!canRepair}
            onClick={onRepair}
          >
            <Hammer className="h-4 w-4 mr-2" />
            <span className="flex-1 text-left">
              {damaged ? 'Repair to Full HP' : 'Fully Repaired'}
            </span>
            {damaged && (
              <span className="text-[11px] text-muted-foreground">
                🪵{repairCost.wood} 🪨{repairCost.stone}
              </span>
            )}
          </Button>

          <Button
            variant="destructive"
            className="w-full justify-start"
            onClick={onDisassemble}
          >
            <Recycle className="h-4 w-4 mr-2" />
            <span className="flex-1 text-left">Disassemble</span>
            <span className="text-[11px] opacity-90">
              +🪵{refund.wood} +🪨{refund.stone}
            </span>
          </Button>
        </div>

        {!canRepair && damaged && (
          <p className="text-[10px] text-amber-600 dark:text-amber-400 text-center">
            Not enough resources to repair (have 🪵{woodAvailable} 🪨{stoneAvailable})
          </p>
        )}

        <p className="text-[10px] text-muted-foreground text-center italic">
          Disassembling refunds part of the original materials based on remaining durability.
        </p>
      </Card>
    </div>
  );
}
