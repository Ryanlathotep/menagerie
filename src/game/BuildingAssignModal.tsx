// Modal to assign a monster from your party to a Scout Tower or Farm

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PlayerBuilding, BUILDING_DEFINITIONS } from './buildings';
import { Monster, SPECIES_DATA, ELEMENT_COLORS } from './types';

interface BuildingAssignModalProps {
  building: PlayerBuilding;
  party: Monster[];
  activePartyIndex: number;
  assignedMonsterIds: string[]; // IDs already assigned to other buildings
  onAssign: (monsterId: string) => void;
  onUnassign: () => void;
  onClose: () => void;
}

export function BuildingAssignModal({
  building,
  party,
  activePartyIndex,
  assignedMonsterIds,
  onAssign,
  onUnassign,
  onClose,
}: BuildingAssignModalProps) {
  const def = BUILDING_DEFINITIONS[building.type];
  const assignedMonster = building.assignedMonsterId
    ? party.find(m => m.id === building.assignedMonsterId)
    : null;

  // Available party members (not active, not dead, not already assigned elsewhere)
  const available = party.filter((m, idx) => {
    if (idx === activePartyIndex) return false; // Can't assign the active monster
    if (m.stats.currentHp <= 0) return false;   // Can't assign fainted
    if (m.id === building.assignedMonsterId) return false; // Already here
    if (assignedMonsterIds.includes(m.id)) return false;  // Assigned elsewhere
    return true;
  });

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="p-6 max-w-md w-full space-y-4">
        <div className="text-center">
          <h2 className="text-lg font-bold">{def.emoji} {def.name}</h2>
          <p className="text-xs text-muted-foreground mt-1">
            ({building.worldX}, {building.worldY}) • HP: {building.hp}/{building.maxHp}
          </p>
        </div>

        <p className="text-sm text-muted-foreground">{def.description}</p>

        {/* Farm growth status */}
        {building.type === 'farm' && building.assignedMonsterId && (
          <div className="p-3 bg-muted/50 rounded-lg space-y-1">
            <p className="text-sm font-medium">
              {building.harvestReady ? '🌾 Ready to harvest!' : `🌱 Growing... (${30 - (building.growthProgress ?? 30)} / 30 steps)`}
            </p>
            {building.farmElement && (
              <p className="text-xs text-muted-foreground capitalize">
                Element: {building.farmElement} → produces {building.farmElement}-themed materials
              </p>
            )}
          </div>
        )}

        {/* Currently assigned */}
        {assignedMonster ? (
          <div className="p-3 bg-primary/10 border border-primary/30 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Assigned: {assignedMonster.name}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  Lv.{assignedMonster.level} {assignedMonster.element} {SPECIES_DATA[assignedMonster.species].name}
                </p>
              </div>
              <Button variant="destructive" size="sm" onClick={onUnassign}>
                Remove
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-muted/30 border border-dashed border-border rounded-lg text-center">
            <p className="text-sm text-muted-foreground">No monster assigned</p>
            <p className="text-xs text-muted-foreground mt-1">
              {building.type === 'farm'
                ? 'Assign a monster to grow materials based on its element.'
                : 'Assign a monster to auto-attack nearby enemies.'}
            </p>
          </div>
        )}

        {/* Available monsters to assign */}
        {available.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Available party members:</p>
            <div className="grid gap-2 max-h-48 overflow-y-auto">
              {available.map(m => {
                const colors = ELEMENT_COLORS[m.element];
                return (
                  <button
                    key={m.id}
                    className="flex items-center justify-between p-2 rounded-lg border border-border hover:border-primary/50 transition-colors text-left"
                    onClick={() => onAssign(m.id)}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-full border"
                        style={{
                          backgroundColor: `hsl(${colors.primary})`,
                          borderColor: `hsl(${colors.secondary})`,
                        }}
                      />
                      <div>
                        <p className="text-sm font-medium">{m.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          Lv.{m.level} {m.element} {SPECIES_DATA[m.species].name}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-primary">Assign →</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {available.length === 0 && !assignedMonster && (
          <p className="text-xs text-muted-foreground text-center">
            No available party members. Your active monster and fainted members cannot be assigned.
          </p>
        )}

        <Button variant="ghost" className="w-full" onClick={onClose}>
          Close
        </Button>
      </Card>
    </div>
  );
}
