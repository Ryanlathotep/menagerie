// Build & Roads panel for dungeons. Mirrors the overworld build panel UI
// but operates against the active dungeon state. Shares the same building
// definitions, road definitions, and resource pool (wood/stone) as overworld.

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { BUILDING_DEFINITIONS, PlayerBuildingType } from './buildings';
import { ROAD_DEFINITIONS, RoadType } from './overworld';

interface DungeonBuildPanelProps {
  open: boolean;
  wood: number;
  stone: number;
  onClose: () => void;
  onSelectBuilding: (type: PlayerBuildingType) => void;
  onSelectRoad: (type: RoadType) => void;
}

export function DungeonBuildPanel({
  open, wood, stone, onClose, onSelectBuilding, onSelectRoad,
}: DungeonBuildPanelProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <Card
        className="p-6 max-w-lg w-full space-y-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center gap-2">
          <h2 className="text-lg font-bold">🏗️ Build & Roads (Dungeon)</h2>
          <div className="flex items-center gap-2">
            <div className="text-sm text-muted-foreground">🪵 {wood} • 🪨 {stone}</div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} aria-label="Close build menu">✕</Button>
          </div>
        </div>

        {/* Roads */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">🛤️ Roads</h3>
          <p className="text-xs text-muted-foreground">Place roads on open floor tiles. Stone roads grant a speed boost.</p>
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(ROAD_DEFINITIONS) as [RoadType, typeof ROAD_DEFINITIONS[RoadType]][]).map(([type, def]) => {
              const canAfford = wood >= def.cost.wood && stone >= def.cost.stone;
              return (
                <button
                  key={type}
                  className={`p-3 rounded-lg border text-left transition-colors ${canAfford ? 'border-border hover:border-primary/50' : 'border-border opacity-50'}`}
                  onClick={() => {
                    if (!canAfford) { toast.error('Not enough resources!'); return; }
                    onSelectRoad(type);
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{def.emoji}</span>
                    <span className="text-sm font-medium">{def.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">{def.description}</p>
                  <p className="text-xs">
                    {def.cost.wood > 0 && `🪵 ${def.cost.wood} `}{def.cost.stone > 0 && `🪨 ${def.cost.stone}`}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Structures */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">🏗️ Structures</h3>
          <p className="text-xs text-muted-foreground">Select a structure, then click an open floor tile to place it.</p>
          <div className="grid grid-cols-2 gap-2">
            {(Object.values(BUILDING_DEFINITIONS) as typeof BUILDING_DEFINITIONS[PlayerBuildingType][]).map(def => {
              const canAfford = wood >= def.cost.wood && stone >= def.cost.stone;
              return (
                <button
                  key={def.type}
                  className={`p-3 rounded-lg border text-left transition-colors ${canAfford ? 'border-border hover:border-primary/50' : 'border-border opacity-50'}`}
                  onClick={() => {
                    if (!canAfford) { toast.error('Not enough resources!'); return; }
                    onSelectBuilding(def.type);
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{def.emoji}</span>
                    <span className="text-sm font-medium">{def.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">{def.description}</p>
                  <p className="text-xs">
                    🪵 {def.cost.wood} 🪨 {def.cost.stone}
                    {def.requiresMonster && ' • 🐾 Assign monster'}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <Button variant="ghost" className="w-full" onClick={onClose}>Close</Button>
      </Card>
    </div>
  );
}
