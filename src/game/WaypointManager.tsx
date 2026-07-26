// Waypoint Manager
// ----------------------------------------------------------------------------
// Central modal for reviewing, naming and removing every waypoint the player
// has dropped. Covers two sources:
//   1. In-dungeon tile waypoints (state.run.dungeon.compassWaypoints) — these
//      live on the current floor and can be named per-pin.
//   2. Overworld dungeon-entrance pins (settings.dungeonWaypoints) — each is
//      tied to a discovered DungeonEntrance and can also be named.

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Flag, Trash2, Pencil, Check } from 'lucide-react';
import { useGame } from './state';
import { useSettings } from './Settings';
import { toast } from 'sonner';

interface WaypointManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WaypointManager({ isOpen, onClose }: WaypointManagerProps) {
  const { state, dispatch } = useGame();
  const { settings, updateSetting } = useSettings();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  if (!isOpen) return null;

  const dungeon = state.run?.dungeon;
  const dungeonWaypoints = dungeon?.compassWaypoints || [];
  const ex = dungeon?.entryPosition?.x ?? 0;
  const ey = dungeon?.entryPosition?.y ?? 0;

  // Overworld pins: id → { enabled, name?, entranceName? }
  const overworld = state.saveData?.overworldState;
  const entranceById = new Map<string, string>();
  if (overworld?.dungeonEntrances) {
    Object.values(overworld.dungeonEntrances).forEach(e => {
      entranceById.set(e.id, e.name || 'Unnamed Dungeon');
    });
  }

  const pinnedIds = Object.entries(settings.dungeonWaypoints || {})
    .filter(([, v]) => v)
    .map(([id]) => id);

  // Player-dropped overworld tile waypoints (live on the overworld state).
  const overworldTileWaypoints = overworld?.waypoints || [];

  const updateOverworldWaypoints = (mutator: (list: { x: number; y: number; name?: string }[]) => { x: number; y: number; name?: string }[]) => {
    if (!overworld) return;
    const next = mutator(overworld.waypoints ? [...overworld.waypoints] : []);
    dispatch({ type: 'UPDATE_OVERWORLD', overworld: { ...overworld, waypoints: next } });
  };

  const startEdit = (key: string, current?: string) => {
    setEditingKey(key);
    setDraftName(current || '');
  };

  const commitDungeonRename = (x: number, y: number) => {
    dispatch({ type: 'RENAME_DUNGEON_WAYPOINT', x, y, name: draftName });
    setEditingKey(null);
    toast.success(draftName.trim() ? `Renamed to "${draftName.trim()}"` : 'Name cleared');
  };

  const commitOverworldRename = (id: string) => {
    const next = { ...(settings.dungeonWaypointNames || {}) };
    const trimmed = draftName.trim().slice(0, 32);
    if (trimmed) next[id] = trimmed;
    else delete next[id];
    updateSetting('dungeonWaypointNames', next);
    setEditingKey(null);
    toast.success(trimmed ? `Renamed to "${trimmed}"` : 'Name cleared');
  };

  const commitOverworldTileRename = (x: number, y: number) => {
    const trimmed = draftName.trim().slice(0, 32);
    updateOverworldWaypoints(list => list.map(w =>
      w.x === x && w.y === y ? { ...w, name: trimmed || undefined } : w
    ));
    setEditingKey(null);
    toast.success(trimmed ? `Renamed to "${trimmed}"` : 'Name cleared');
  };

  const removeOverworld = (id: string) => {
    const next = { ...(settings.dungeonWaypoints || {}) };
    delete next[id];
    updateSetting('dungeonWaypoints', next);
    toast.info('Waypoint removed');
  };

  const removeOverworldTile = (x: number, y: number) => {
    updateOverworldWaypoints(list => list.filter(w => !(w.x === x && w.y === y)));
    toast.info('Waypoint removed');
  };

  const total = dungeonWaypoints.length + pinnedIds.length + overworldTileWaypoints.length;


  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[110] p-4"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-lg max-h-[calc(100dvh-1.5rem)] flex flex-col animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Flag className="w-5 h-5 text-emerald-500" />
            Waypoint Manager
            <span className="text-xs text-muted-foreground font-normal">({total})</span>
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-6">
            {/* ── Dungeon Floor Waypoints ───────────────────────────── */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">
                  🏰 Current Floor
                  {dungeon && (
                    <span className="text-xs text-muted-foreground font-normal ml-2">
                      Floor {dungeon.floor}
                    </span>
                  )}
                </h3>
                {dungeonWaypoints.length > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-destructive hover:text-destructive"
                    onClick={() => {
                      dispatch({ type: 'CLEAR_DUNGEON_WAYPOINTS' });
                      toast.info('All floor waypoints cleared');
                    }}
                  >
                    <Trash2 className="w-3 h-3 mr-1" /> Clear all
                  </Button>
                )}
              </div>

              {!dungeon && (
                <p className="text-xs text-muted-foreground">
                  No active dungeon run. Floor waypoints appear here while you're inside a dungeon.
                </p>
              )}

              {dungeon && dungeonWaypoints.length === 0 && (
                <p className="text-xs text-muted-foreground italic">
                  No waypoints dropped on this floor. Right-click any explored tile to drop one.
                </p>
              )}

              <div className="space-y-2">
                {dungeonWaypoints.map((wp) => {
                  const key = `d:${wp.x},${wp.y}`;
                  const isEditing = editingKey === key;
                  const rel = `(${wp.x - ex}, ${wp.y - ey})`;
                  return (
                    <div
                      key={key}
                      className="flex items-center gap-2 p-2 rounded-md border border-border bg-background/50"
                    >
                      <span className="text-base">📍</span>
                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <Input
                            value={draftName}
                            onChange={e => setDraftName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') commitDungeonRename(wp.x, wp.y);
                              if (e.key === 'Escape') setEditingKey(null);
                            }}
                            placeholder="Waypoint name…"
                            maxLength={32}
                            className="h-7 text-sm"
                          />
                        ) : (
                          <div className="flex flex-col">
                            <span className="text-sm font-medium truncate">
                              {wp.name || `Waypoint ${rel}`}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              relative {rel}
                            </span>
                          </div>
                        )}
                      </div>
                      {isEditing ? (
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => commitDungeonRename(wp.x, wp.y)}>
                          <Check className="w-4 h-4" />
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEdit(key, wp.name)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => {
                          dispatch({ type: 'REMOVE_DUNGEON_WAYPOINT', x: wp.x, y: wp.y });
                          toast.info('Waypoint removed');
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* ── Overworld Dungeon Pins ────────────────────────────── */}
            <section>
              <h3 className="text-sm font-semibold mb-2">🗺️ Overworld Dungeon Pins</h3>
              {pinnedIds.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  No pinned dungeons. Right-click a dungeon entrance on the overworld to pin its arrow.
                </p>
              ) : (
                <div className="space-y-2">
                  {pinnedIds.map(id => {
                    const key = `o:${id}`;
                    const isEditing = editingKey === key;
                    const defaultName = entranceById.get(id) || 'Unknown Dungeon';
                    const customName = settings.dungeonWaypointNames?.[id];
                    const display = customName || defaultName;
                    return (
                      <div key={key} className="flex items-center gap-2 p-2 rounded-md border border-border bg-background/50">
                        <span className="text-base">🏰</span>
                        <div className="flex-1 min-w-0">
                          {isEditing ? (
                            <Input
                              value={draftName}
                              onChange={e => setDraftName(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') commitOverworldRename(id);
                                if (e.key === 'Escape') setEditingKey(null);
                              }}
                              placeholder={defaultName}
                              maxLength={32}
                              className="h-7 text-sm"
                            />
                          ) : (
                            <div className="flex flex-col">
                              <span className="text-sm font-medium truncate">{display}</span>
                              {customName && (
                                <span className="text-[10px] text-muted-foreground truncate">
                                  default: {defaultName}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        {isEditing ? (
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => commitOverworldRename(id)}>
                            <Check className="w-4 h-4" />
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEdit(key, customName)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => removeOverworld(id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ── Overworld Tile Waypoints ──────────────────────────── */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">🗺️ Overworld Tile Pins</h3>
                {overworldTileWaypoints.length > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-destructive hover:text-destructive"
                    onClick={() => {
                      updateOverworldWaypoints(() => []);
                      toast.info('All overworld tile waypoints cleared');
                    }}
                  >
                    <Trash2 className="w-3 h-3 mr-1" /> Clear all
                  </Button>
                )}
              </div>
              {overworldTileWaypoints.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  No tile pins. Right-click any explored overworld tile to drop one.
                </p>
              ) : (
                <div className="space-y-2">
                  {overworldTileWaypoints.map(wp => {
                    const key = `ot:${wp.x},${wp.y}`;
                    const isEditing = editingKey === key;
                    return (
                      <div key={key} className="flex items-center gap-2 p-2 rounded-md border border-border bg-background/50">
                        <span className="text-base">📍</span>
                        <div className="flex-1 min-w-0">
                          {isEditing ? (
                            <Input
                              value={draftName}
                              onChange={e => setDraftName(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') commitOverworldTileRename(wp.x, wp.y);
                                if (e.key === 'Escape') setEditingKey(null);
                              }}
                              placeholder="Waypoint name…"
                              maxLength={32}
                              className="h-7 text-sm"
                            />
                          ) : (
                            <div className="flex flex-col">
                              <span className="text-sm font-medium truncate">
                                {wp.name || `Waypoint (${wp.x}, ${wp.y})`}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                world ({wp.x}, {wp.y})
                              </span>
                            </div>
                          )}
                        </div>
                        {isEditing ? (
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => commitOverworldTileRename(wp.x, wp.y)}>
                            <Check className="w-4 h-4" />
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEdit(key, wp.name)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => removeOverworldTile(wp.x, wp.y)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </ScrollArea>


        <div className="p-3 border-t flex justify-end">
          <Button variant="outline" onClick={onClose}>Done</Button>
        </div>
      </Card>
    </div>
  );
}
