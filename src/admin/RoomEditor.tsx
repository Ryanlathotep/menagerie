/**
 * Room Editor — general-purpose prefab painter for arena floors AND
 * future dungeon stamping. Supports variable size (4..48), tile painting,
 * enemy/trap placement, tags, tower assignment, save/duplicate/rename/delete.
 */
import { useEffect, useMemo, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Save, Copy, Trash2, Plus, Eraser, RefreshCw } from 'lucide-react';
import { fetchRooms, saveRoom, deleteRoom, newBlankRoom, duplicateRoom } from '@/game/rooms/store';
import type { Room, RoomCell, RoomCellKind } from '@/game/rooms/types';
import { ROOM_TAGS, KNOWN_TOWER_IDS } from '@/game/rooms/types';

const PALETTE: Array<{ kind: RoomCellKind | 'erase'; label: string; color: string; glyph: string }> = [
  { kind: 'erase',       label: 'Erase',       color: 'transparent',        glyph: '⌫' },
  { kind: 'floor',       label: 'Floor',       color: 'hsl(38 40% 78%)',    glyph: '·' },
  { kind: 'wall',        label: 'Wall',        color: 'hsl(30 25% 40%)',    glyph: '▓' },
  { kind: 'door',        label: 'Door',        color: 'hsl(28 60% 45%)',    glyph: '🚪' },
  { kind: 'stairs_up',   label: 'Stairs ↑',    color: 'hsl(200 30% 55%)',   glyph: '↑' },
  { kind: 'stairs_down', label: 'Stairs ↓',    color: 'hsl(200 30% 40%)',   glyph: '↓' },
  { kind: 'lever',       label: 'Lever',       color: 'hsl(50 70% 55%)',    glyph: '🎚️' },
  { kind: 'box',         label: 'Box',         color: 'hsl(30 45% 55%)',    glyph: '📦' },
  { kind: 'chest',       label: 'Chest',       color: 'hsl(45 80% 50%)',    glyph: '🧰' },
  { kind: 'trap_spike',  label: 'Spike Trap',  color: 'hsl(0 60% 45%)',     glyph: '⚠️' },
  { kind: 'trap_dart',   label: 'Dart Trap',   color: 'hsl(15 55% 50%)',    glyph: '🎯' },
  { kind: 'entry',       label: 'Entry',       color: 'hsl(120 45% 50%)',   glyph: 'A' },
  { kind: 'exit',        label: 'Exit',        color: 'hsl(280 45% 55%)',   glyph: 'B' },
];

function cellAt(room: Room, x: number, y: number): RoomCell | undefined {
  return room.cells.find(c => c.x === x && c.y === y);
}

function paintCell(room: Room, x: number, y: number, kind: RoomCellKind | 'erase'): Room {
  const cells = room.cells.filter(c => !(c.x === x && c.y === y));
  if (kind !== 'erase') cells.push({ x, y, kind });
  return { ...room, cells };
}

export function RoomEditor() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState<Room | null>(null);
  const [selectedKind, setSelectedKind] = useState<RoomCellKind | 'erase'>('wall');
  const [cellPx, setCellPx] = useState(28);
  const [filter, setFilter] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    const r = await fetchRooms();
    setRooms(r);
    setLoading(false);
    return r;
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const startNew = () => {
    const r = newBlankRoom();
    setCurrent(r);
  };

  const load = (id: string) => {
    const r = rooms.find(x => x.id === id);
    if (r) setCurrent({ ...r });
  };

  const commit = async () => {
    if (!current) return;
    if (!current.name.trim()) { toast.error('Name required'); return; }
    const ok = await saveRoom(current);
    if (ok) {
      toast.success(`Saved "${current.name}"`);
      await refresh();
    } else {
      toast.error('Save failed');
    }
  };

  const dup = async () => {
    if (!current) return;
    const copy = duplicateRoom(current);
    setCurrent(copy);
    await saveRoom(copy);
    await refresh();
    toast.success(`Duplicated as "${copy.name}"`);
  };

  const del = async (id: string) => {
    if (!confirm('Delete this room?')) return;
    await deleteRoom(id);
    if (current?.id === id) setCurrent(null);
    await refresh();
  };

  const toggleTag = (tag: string) => {
    if (!current) return;
    const has = current.tags.includes(tag);
    setCurrent({ ...current, tags: has ? current.tags.filter(t => t !== tag) : [...current.tags, tag] });
  };

  const toggleTower = (id: string) => {
    if (!current) return;
    const has = current.towerIds.includes(id);
    setCurrent({ ...current, towerIds: has ? current.towerIds.filter(t => t !== id) : [...current.towerIds, id] });
  };

  const resize = (w: number, h: number) => {
    if (!current) return;
    const cells = current.cells.filter(c => c.x < w && c.y < h);
    setCurrent({ ...current, width: w, height: h, cells });
  };

  const filteredRooms = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return rooms.filter(r => !q || r.name.toLowerCase().includes(q) || r.tags.some(t => t.toLowerCase().includes(q)));
  }, [rooms, filter]);

  const towerGroups = useMemo(() => {
    const g: Record<string, typeof KNOWN_TOWER_IDS> = {};
    for (const t of KNOWN_TOWER_IDS) { (g[t.category] ??= []).push(t); }
    return g;
  }, []);

  // Custom tower id input
  const [customTowerId, setCustomTowerId] = useState('');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_320px] gap-4">
      {/* LEFT — palette + saved rooms */}
      <div className="space-y-3">
        <Card className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs uppercase text-muted-foreground">Palette</Label>
          </div>
          <div className="grid grid-cols-2 gap-1">
            {PALETTE.map(p => (
              <button key={p.kind}
                onClick={() => setSelectedKind(p.kind as any)}
                className={`text-xs border rounded px-2 py-1.5 flex items-center gap-1 ${selectedKind === p.kind ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'}`}
                title={p.label}>
                <span className="w-3 h-3 rounded" style={{ background: p.color === 'transparent' ? 'repeating-linear-gradient(45deg,#ccc 0 3px,#eee 3px 6px)' : p.color }}/>
                <span className="truncate">{p.glyph} {p.label}</span>
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs uppercase text-muted-foreground">Saved rooms ({rooms.length})</Label>
            <Button size="icon" variant="ghost" onClick={refresh} title="Reload"><RefreshCw className="w-3 h-3"/></Button>
          </div>
          <Input placeholder="Search…" value={filter} onChange={e => setFilter(e.target.value)} className="h-7 text-xs"/>
          <Button size="sm" className="w-full" onClick={startNew}><Plus className="w-3 h-3 mr-1"/>New room</Button>
          <ScrollArea className="h-[380px]">
            <div className="space-y-1 pr-1">
              {loading && <div className="text-xs text-muted-foreground">Loading…</div>}
              {filteredRooms.map(r => (
                <div key={r.id} className={`p-1.5 rounded border text-xs ${current?.id === r.id ? 'border-primary bg-primary/5' : 'border-border'}`}>
                  <button className="text-left w-full" onClick={() => load(r.id)}>
                    <div className="font-medium truncate">{r.name}</div>
                    <div className="text-muted-foreground text-[10px]">{r.width}×{r.height} · {r.tags.join(',') || 'untagged'} · {r.towerIds.length || 'any'} towers</div>
                  </button>
                  <div className="flex gap-1 mt-1">
                    <Button size="icon" variant="ghost" onClick={() => del(r.id)}><Trash2 className="w-3 h-3"/></Button>
                  </div>
                </div>
              ))}
              {filteredRooms.length === 0 && !loading && (
                <div className="text-xs text-muted-foreground p-2">No rooms yet. Click <b>New room</b>.</div>
              )}
            </div>
          </ScrollArea>
        </Card>
      </div>

      {/* CENTER — grid */}
      <Card className="p-3 space-y-3">
        {!current ? (
          <div className="text-sm text-muted-foreground p-8 text-center">
            Pick a saved room on the left, or click <b>New room</b> to start painting.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[160px]">
                <Label className="text-xs">Name</Label>
                <Input value={current.name} onChange={e => setCurrent({ ...current, name: e.target.value })}/>
              </div>
              <div>
                <Label className="text-xs">Width ({current.width})</Label>
                <input type="range" min={4} max={48} value={current.width} onChange={e => resize(Number(e.target.value), current.height)} className="w-32"/>
              </div>
              <div>
                <Label className="text-xs">Height ({current.height})</Label>
                <input type="range" min={4} max={48} value={current.height} onChange={e => resize(current.width, Number(e.target.value))} className="w-32"/>
              </div>
              <div>
                <Label className="text-xs">Zoom ({cellPx}px)</Label>
                <input type="range" min={12} max={40} value={cellPx} onChange={e => setCellPx(Number(e.target.value))} className="w-24"/>
              </div>
              <Button size="sm" onClick={commit}><Save className="w-3 h-3 mr-1"/>Save</Button>
              <Button size="sm" variant="outline" onClick={dup}><Copy className="w-3 h-3 mr-1"/>Duplicate</Button>
              <Button size="sm" variant="destructive" onClick={() => del(current.id)}><Trash2 className="w-3 h-3 mr-1"/>Delete</Button>
            </div>

            <div className="text-xs text-muted-foreground">
              Click / drag to paint with <b>{PALETTE.find(p => p.kind === selectedKind)?.label}</b>. Selecting <b>Erase</b> clears cells (they become plain floor).
            </div>

            <div className="overflow-auto max-h-[62vh] border rounded bg-muted/30 p-2">
              <div className="inline-grid" style={{ gridTemplateColumns: `repeat(${current.width}, ${cellPx}px)` }}>
                {Array.from({ length: current.height }).map((_, y) =>
                  Array.from({ length: current.width }).map((__, x) => {
                    const cell = cellAt(current, x, y);
                    return (
                      <button
                        key={`${x},${y}`}
                        onClick={() => setCurrent(paintCell(current, x, y, selectedKind))}
                        onMouseEnter={e => { if (e.buttons === 1) setCurrent(paintCell(current, x, y, selectedKind)); }}
                        className="relative border border-black/5"
                        style={{ width: cellPx, height: cellPx }}
                        title={cell ? cell.kind : 'floor'}
                      >
                        <CellTile kind={cell?.kind} size={cellPx} seed={x * 31 + y * 17} />
                      </button>
                    );
                  })
                )}
              </div>
            </div>

          </>
        )}
      </Card>

      {/* RIGHT — tags + tower assignments */}
      <Card className="p-3 space-y-3">
        {!current ? (
          <div className="text-xs text-muted-foreground">Load or create a room to configure it.</div>
        ) : (
          <>
            <div>
              <Label className="text-xs uppercase text-muted-foreground">Tags</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {ROOM_TAGS.map(tag => {
                  const on = current.tags.includes(tag);
                  return (
                    <button key={tag} onClick={() => toggleTag(tag)}
                      className={`text-xs px-2 py-0.5 rounded border ${on ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
                      {tag}
                    </button>
                  );
                })}
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">
                <b>arena</b> = usable as arena floor · <b>dungeon</b> = eligible for tower stamping · <b>boss</b> = boss-floor only
              </div>
            </div>

            <div>
              <Label className="text-xs uppercase text-muted-foreground">Tower assignments</Label>
              <div className="text-[10px] text-muted-foreground mb-1">Leave everything unchecked = spawn in <b>all</b> towers whose tag matches.</div>
              <ScrollArea className="h-[280px] pr-2">
                <div className="space-y-2">
                  {Object.entries(towerGroups).map(([cat, list]) => (
                    <div key={cat}>
                      <div className="text-[11px] font-semibold text-muted-foreground">{cat}</div>
                      <div className="space-y-0.5">
                        {list.map(t => (
                          <label key={t.id} className="flex items-center gap-2 text-xs cursor-pointer">
                            <Checkbox
                              checked={current.towerIds.includes(t.id)}
                              onCheckedChange={() => toggleTower(t.id)}
                            />
                            <span>{t.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <div className="flex gap-1 mt-2">
                <Input placeholder="Custom tower id" value={customTowerId} onChange={e => setCustomTowerId(e.target.value)} className="h-7 text-xs"/>
                <Button size="sm" variant="outline" onClick={() => {
                  const id = customTowerId.trim();
                  if (!id) return;
                  if (!current.towerIds.includes(id)) setCurrent({ ...current, towerIds: [...current.towerIds, id] });
                  setCustomTowerId('');
                }}>Add</Button>
              </div>
              {current.towerIds.filter(id => !KNOWN_TOWER_IDS.some(t => t.id === id)).length > 0 && (
                <div className="mt-1 text-[10px]">
                  Custom: {current.towerIds.filter(id => !KNOWN_TOWER_IDS.some(t => t.id === id)).map(id => (
                    <button key={id} onClick={() => toggleTower(id)} className="mr-1 underline">✕ {id}</button>
                  ))}
                </div>
              )}
            </div>

            {current.tags.includes('arena') && (
              <div className="space-y-2 border-t pt-2">
                <Label className="text-xs uppercase text-muted-foreground">Arena visuals</Label>
                <div>
                  <Label className="text-[10px]">Floor color</Label>
                  <Input value={current.arena?.floorColor ?? 'hsl(38 55% 72%)'}
                    onChange={e => setCurrent({ ...current, arena: { ...(current.arena ?? { floorColor: '', rimColor: 'hsl(30 25% 40%)', crowdDensity: 32 }), floorColor: e.target.value } })}/>
                </div>
                <div>
                  <Label className="text-[10px]">Rim color</Label>
                  <Input value={current.arena?.rimColor ?? 'hsl(30 25% 40%)'}
                    onChange={e => setCurrent({ ...current, arena: { ...(current.arena ?? { floorColor: 'hsl(38 55% 72%)', rimColor: '', crowdDensity: 32 }), rimColor: e.target.value } })}/>
                </div>
                <div>
                  <Label className="text-[10px]">Crowd ({current.arena?.crowdDensity ?? 32})</Label>
                  <input type="range" min={8} max={80} value={current.arena?.crowdDensity ?? 32}
                    onChange={e => setCurrent({ ...current, arena: { ...(current.arena ?? { floorColor: 'hsl(38 55% 72%)', rimColor: 'hsl(30 25% 40%)', crowdDensity: 32 }), crowdDensity: Number(e.target.value) } })}
                    className="w-full"/>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
