// Hover tooltip content for player buildings on the overworld

import { PlayerBuilding, BUILDING_DEFINITIONS, FARM_GROWTH_STEPS, getDisassembleRefund, getRepairCost, SCOUT_TOWER_ATTACK_RADIUS, SCOUT_TOWER_VISION_RADIUS, SCOUT_TOWER_DAMAGE } from './buildings';
import { Monster, SPECIES_DATA } from './types';

interface BuildingTooltipProps {
  building: PlayerBuilding;
  party: Monster[];
}

export function BuildingTooltipContent({ building, party }: BuildingTooltipProps) {
  const def = BUILDING_DEFINITIONS[building.type];
  const assigned = building.assignedMonsterId
    ? party.find(m => m.id === building.assignedMonsterId)
    : null;
  const hpPct = Math.max(0, Math.min(100, Math.floor((building.hp / building.maxHp) * 100)));
  const refund = getDisassembleRefund(building);
  const repair = getRepairCost(building);
  const damaged = building.hp < building.maxHp;

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-1">
        <span className="font-bold text-sm">
          {def.emoji} {def.name}
        </span>
        <span className="text-[10px] text-muted-foreground">
          ({building.worldX}, {building.worldY})
        </span>
      </div>

      <p className="text-muted-foreground italic">{def.description}</p>

      {/* HP bar */}
      <div>
        <div className="flex items-center justify-between text-[10px] mb-0.5">
          <span className="text-muted-foreground">Durability</span>
          <span className={hpPct < 50 ? 'text-destructive font-semibold' : ''}>
            {building.hp}/{building.maxHp}
          </span>
        </div>
        <div className="w-full h-1.5 bg-muted rounded overflow-hidden">
          <div
            className={`h-full transition-all ${
              hpPct > 60 ? 'bg-green-500' : hpPct > 30 ? 'bg-yellow-500' : 'bg-destructive'
            }`}
            style={{ width: `${hpPct}%` }}
          />
        </div>
      </div>

      {/* Assigned monster */}
      {def.requiresMonster && (
        <div className="bg-muted/40 px-2 py-1 rounded space-y-0.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Assigned:</span>
            {assigned ? (
              <span className="capitalize font-medium">
                Lv.{assigned.level} {assigned.name}
              </span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400">⚠ None</span>
            )}
          </div>
          {assigned && (
            <p className="text-[10px] text-muted-foreground capitalize">
              {assigned.element} {SPECIES_DATA[assigned.species]?.name ?? assigned.species}
              {' • '}
              ❤ {assigned.stats.currentHp}/{assigned.stats.maxHp}
            </p>
          )}
          {building.type === 'scout_tower' && assigned && (
            <p className="text-[10px] text-muted-foreground">
              👁 Vision r{SCOUT_TOWER_VISION_RADIUS} • ⚔ Attack r{SCOUT_TOWER_ATTACK_RADIUS} ({SCOUT_TOWER_DAMAGE} dmg)
            </p>
          )}
        </div>
      )}

      {/* Farm growth */}
      {building.type === 'farm' && building.assignedMonsterId && (
        <div className="bg-muted/40 px-2 py-1 rounded">
          {building.harvestReady ? (
            <span className="text-green-600 dark:text-green-400 font-semibold">
              🌾 Ready to harvest! (walk over to collect)
            </span>
          ) : (
            <span>
              🌱 Growing: {FARM_GROWTH_STEPS - (building.growthProgress ?? FARM_GROWTH_STEPS)} / {FARM_GROWTH_STEPS} steps
            </span>
          )}
          {building.farmElement && (
            <p className="text-[10px] text-muted-foreground capitalize mt-0.5">
              Element: {building.farmElement}
            </p>
          )}
        </div>
      )}

      {/* Cost summary / refund */}
      <div className="grid grid-cols-2 gap-1 text-[10px] pt-1 border-t border-border/50">
        <div>
          <p className="text-muted-foreground">Build cost:</p>
          <p>🪵 {def.cost.wood} • 🪨 {def.cost.stone}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Disassemble refund:</p>
          <p>🪵 {refund.wood} • 🪨 {refund.stone}</p>
        </div>
      </div>

      {damaged && (
        <div className="text-[10px] text-amber-600 dark:text-amber-400">
          🔧 Repair cost: 🪵 {repair.wood} • 🪨 {repair.stone}
        </div>
      )}

      <div className="text-[10px] text-muted-foreground italic pt-1 border-t border-border/50">
        Right-click for actions
      </div>
    </div>
  );
}
