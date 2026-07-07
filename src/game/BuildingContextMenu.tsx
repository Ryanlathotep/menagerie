// Right-click context menu for player buildings:
// Assign/Manage monster, Repair, Disassemble, Flip Gate (gates only).

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  PlayerBuilding,
  BUILDING_DEFINITIONS,
  CRAFTING_STATION_BUILDINGS,
  getDisassembleRefund,
  getRepairCost,
} from './buildings';
import { getStationTierData } from './crafting/stationTiers';
import { Monster } from './types';
import { Hammer, Recycle, RefreshCw, Settings, Trophy, UserPlus, Wrench, X } from 'lucide-react';

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
  /** Cycle a stair/ladder's facing direction (n → e → s → w). */
  onRotateConnector?: () => void;
  /** Open the tier/modifier config modal — only for crafting station buildings. */
  onConfigureStation?: () => void;
  /** Open the crafting workshop scoped to this station's context. */
  onOpenStationWorkshop?: () => void;
  /** Open the Arena Hub — only for arena buildings. */
  onOpenArena?: () => void;
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
  onRotateConnector,
  onConfigureStation,
  onOpenStationWorkshop,
  onClose,
}: BuildingContextMenuProps) {
  const def = BUILDING_DEFINITIONS[building.type];
  const isConnector = building.type === 'stone_staircase' || building.type === 'ladder';
  const stationKind = (Object.entries(CRAFTING_STATION_BUILDINGS)
    .find(([, bt]) => bt === building.type)?.[0]) as 'forge' | 'workbench' | 'brewing' | 'enchanting' | undefined;
  const isStation = !!stationKind;
  const stationTier = (building.stationTier ?? 1) as 1|2|3|4|5;
  const stationLabel = isStation ? getStationTierData(stationKind!, stationTier).label : '';
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
              {isStation && ` • ${stationLabel}`}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} aria-label="Close menu">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          {isStation && onOpenStationWorkshop && (
            <Button
              variant="default"
              className="w-full justify-start"
              onClick={onOpenStationWorkshop}
            >
              <Wrench className="h-4 w-4 mr-2" />
              Open Crafting Workshop
            </Button>
          )}
          {isStation && onConfigureStation && (
            <Button
              variant="secondary"
              className="w-full justify-start"
              onClick={onConfigureStation}
            >
              <Settings className="h-4 w-4 mr-2" />
              Configure Station (tier / modifiers)
            </Button>
          )}
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

          {isConnector && onRotateConnector && (
            <Button
              variant="secondary"
              className="w-full justify-start"
              onClick={onRotateConnector}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              <span className="flex-1 text-left">Rotate Facing</span>
              <span className="text-[11px] text-muted-foreground">
                (now: {(building.connectorDir ?? 'auto').toUpperCase()})
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
