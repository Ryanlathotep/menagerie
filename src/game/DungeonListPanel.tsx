// Scrolling list of all known dungeons (replaces the single Start Run button)

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DungeonEntrance, HOME_TOWER_ID } from './types';

interface DungeonListPanelProps {
  dungeonEntrances: Record<string, DungeonEntrance>;
  onLaunch: (entrance: DungeonEntrance) => void;
}

const ELEMENT_EMOJI: Record<string, string> = {
  fire: '🔥',
  water: '💧',
  earth: '🌿',
  air: '💨',
  void: '🌑',
  normal: '⚪',
};

export function DungeonListPanel({ dungeonEntrances, onLaunch }: DungeonListPanelProps) {
  const all = Object.values(dungeonEntrances || {});
  // Discovered: home tower is always discovered, others must have been seen on the overworld
  const discovered = all.filter(d => d.isHome || d.discovered || d.deepestFloor > 0);
  const undiscoveredCount = all.length - discovered.length;

  // Sort: home first, then by difficulty asc
  discovered.sort((a, b) => {
    if (a.isHome && !b.isHome) return -1;
    if (!a.isHome && b.isHome) return 1;
    return (a.difficulty || 1) - (b.difficulty || 1);
  });

  return (
    <Card className="p-3 w-full max-w-md mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <span>🗼</span> Known Dungeons
          <Badge variant="secondary" className="ml-1">{discovered.length}</Badge>
        </h3>
      </div>

      <ScrollArea className="h-[260px] pr-2">
        <div className="space-y-2">
          {discovered.map((d) => {
            const cleared = d.deepestFloor > 0;
            const startingLevel = Math.max(1, d.difficulty || 1);
            const totalFloors = startingLevel + 50; // Per seeded-dungeon system
            const elementIcon = d.element ? ELEMENT_EMOJI[d.element] || '✨' : '';
            return (
              <button
                key={d.id}
                onClick={() => onLaunch(d)}
                className={`w-full text-left rounded-md border p-3 transition-colors hover:bg-accent/40 ${
                  d.isHome
                    ? 'border-primary/60 bg-gradient-to-r from-primary/10 to-secondary/10'
                    : 'border-border bg-card'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{d.isHome ? '🗼' : '🏰'}</span>
                      <span className="font-semibold text-sm truncate">
                        {d.name || `Dungeon at (${d.worldX}, ${d.worldY})`}
                      </span>
                      {elementIcon && <span className="text-sm">{elementIcon}</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                      <span>Start Lv. <span className="text-foreground font-medium">{startingLevel}</span></span>
                      <span>Floors <span className="text-foreground font-medium">{totalFloors}</span></span>
                      <span>
                        Best floor:{' '}
                        <span className={cleared ? 'text-foreground font-medium' : 'text-muted-foreground/60'}>
                          {cleared ? d.deepestFloor : '—'}
                        </span>
                      </span>
                      {!d.isHome && (
                        <span className="text-muted-foreground/70">({d.worldX}, {d.worldY})</span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={d.isHome ? 'default' : 'outline'}
                    className={d.isHome ? 'bg-gradient-to-r from-primary to-secondary' : ''}
                    onClick={(e) => {
                      e.stopPropagation();
                      onLaunch(d);
                    }}
                  >
                    Enter
                  </Button>
                </div>
              </button>
            );
          })}

          {undiscoveredCount > 0 && (
            <div className="rounded-md border border-dashed border-muted-foreground/30 p-3 text-center text-xs text-muted-foreground">
              <span className="font-medium">🔍 {undiscoveredCount}</span> undiscovered{' '}
              {undiscoveredCount === 1 ? 'dungeon nearby' : 'dungeons nearby'} — explore the overworld to reveal them.
            </div>
          )}
          {undiscoveredCount === 0 && discovered.length <= 1 && (
            <div className="rounded-md border border-dashed border-muted-foreground/30 p-3 text-center text-xs text-muted-foreground">
              Venture into the overworld to discover more dungeons.
            </div>
          )}
        </div>
      </ScrollArea>

      <p className="mt-2 text-[10px] text-center text-muted-foreground/70">
        You can return to this menu from any dungeon.
      </p>
    </Card>
  );
}
