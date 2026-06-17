// Tile Pattern Painter
// --------------------
// You paint small example grids with your already-sliced tiles.
// The dungeon renderer learns from your examples — no rules to author.
//
// Storage: game_data_overrides, data_type='tile_pattern',
//          data_key=<pattern id>, data_value=TilePattern JSON.
// Reads sliced tiles from existing data_type='tile_asset' rows (kind='sliced'|'tile').
//
// Existing TileAssetManager and Blob-47 data are not touched.

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Trash2, Eraser, Save, Sparkles, Plus, RefreshCw } from 'lucide-react';
import { useGameDataOverrides } from '@/hooks/useGameDataOverrides';
import {
  EMPTY, type TilePattern, learnFamily, pickTile,
} from '@/game/tilePatternLearner';

const GRID_W = 8;
const GRID_H = 8;
const CELL_PX = 40;

interface SlicedTileRow {
  key: string;          // storage path == data_key
  url: string;
  family?: string;      // tags[0] or 'unassigned'
  name: string;
}

function emptyGrid(): string[][] {
  return Array.from({ length: GRID_H }, () => Array.from({ length: GRID_W }, () => EMPTY));
}

function gridToCells(grid: string[][]): TilePattern['cells'] {
  const cells: TilePattern['cells'] = [];
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) cells.push({ x, y, tileKey: grid[y][x] });
  }
  return cells;
}

function cellsToGrid(cells: TilePattern['cells'], w: number, h: number): string[][] {
  const g = emptyGrid();
  for (const c of cells) if (c.y < h && c.x < w) g[c.y][c.x] = c.tileKey;
  return g;
}

export function TilePatternPainter() {
  const tileOv = useGameDataOverrides('tile_asset');
  const patternOv = useGameDataOverrides('tile_pattern');

  // Re-pull tiles/patterns whenever the painter regains focus, so newly
  // assigned tiles from the Asset Manager tab show up without a page reload.
  useEffect(() => {
    const refresh = () => { tileOv.refetch(); patternOv.refetch(); };
    const onVis = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [tileOv.refetch, patternOv.refetch]);

  const slicedTiles = useMemo<SlicedTileRow[]>(() => {
    return tileOv.overrides
      .map((o) => {
        const meta = o.data_value as Record<string, unknown>;
        const url = String(meta.url ?? '');
        if (!url) return null;
        const tags = Array.isArray(meta.tags) ? (meta.tags as string[]) : [];
        const kind = meta.kind as string | undefined;
        // Only tiles/sliced — skip raw sheets
        if (kind === 'sheet') return null;
        const name = String(meta.path ?? o.data_key).split('/').pop() ?? o.data_key;
        return {
          key: o.data_key,
          url,
          family: tags[0],
          name,
        } as SlicedTileRow;
      })
      .filter((x): x is SlicedTileRow => x !== null);
  }, [tileOv.overrides]);

  const patterns = useMemo<TilePattern[]>(() => {
    return patternOv.overrides.map((o) => o.data_value as unknown as TilePattern);
  }, [patternOv.overrides]);

  // Editor state
  const [family, setFamily] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [grid, setGrid] = useState<string[][]>(emptyGrid);
  const [selectedTile, setSelectedTile] = useState<string>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tileSearch, setTileSearch] = useState('');

  const families = useMemo(() => {
    const s = new Set<string>();
    for (const p of patterns) s.add(p.family);
    for (const t of slicedTiles) if (t.family) s.add(t.family);
    return Array.from(s).sort();
  }, [patterns, slicedTiles]);

  const filteredTiles = useMemo(() => {
    const q = tileSearch.trim().toLowerCase();
    return slicedTiles.filter((t) => {
      if (q && !t.name.toLowerCase().includes(q) && !(t.family || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [slicedTiles, tileSearch]);

  const tileUrl = (key: string): string | null => {
    if (key === EMPTY) return null;
    return slicedTiles.find((t) => t.key === key)?.url ?? null;
  };

  const paintCell = (x: number, y: number) => {
    setGrid((g) => {
      const next = g.map((row) => row.slice());
      next[y][x] = selectedTile;
      return next;
    });
  };

  const newPattern = () => {
    setEditingId(null);
    setName('');
    setGrid(emptyGrid());
  };

  const loadPattern = (p: TilePattern) => {
    setEditingId(p.id);
    setName(p.name);
    setFamily(p.family);
    setGrid(cellsToGrid(p.cells, GRID_W, GRID_H));
  };

  const savePattern = async () => {
    if (!family.trim()) { toast.error('Pick a family tag first.'); return; }
    if (!name.trim()) { toast.error('Give the pattern a name.'); return; }
    const id = editingId ?? `pat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const value: TilePattern = {
      id,
      name: name.trim(),
      family: family.trim(),
      width: GRID_W,
      height: GRID_H,
      cells: gridToCells(grid).filter((c) => c.tileKey !== EMPTY),
    };
    const ok = await patternOv.saveOverride('tile_pattern', id, value as unknown as Record<string, unknown>);
    if (ok) {
      setEditingId(id);
      toast.success(`Saved "${value.name}" to family "${value.family}"`);
    }
  };

  const deletePattern = async (p: TilePattern) => {
    if (!confirm(`Delete pattern "${p.name}"?`)) return;
    await patternOv.deleteOverride('tile_pattern', p.id);
    if (editingId === p.id) newPattern();
  };

  // Generated preview using learner (proves the rules work end-to-end)
  const learned = useMemo(() => family ? learnFamily(family, patterns) : null, [family, patterns]);
  const preview = useMemo(() => {
    if (!learned || learned.ruleCount === 0) return null;
    const PW = 16, PH = 10;
    // Sample a maze-like wall layout: borders + a few interior walls.
    const wall: boolean[][] = Array.from({ length: PH }, () => Array(PW).fill(false));
    for (let x = 0; x < PW; x++) { wall[0][x] = true; wall[PH-1][x] = true; }
    for (let y = 0; y < PH; y++) { wall[y][0] = true; wall[y][PW-1] = true; }
    for (let x = 3; x < 10; x++) wall[4][x] = true;
    for (let y = 4; y < 8; y++) wall[y][12] = true;
    wall[6][6] = true; wall[6][7] = true;
    const DX = [0, 1, 1, 1, 0, -1, -1, -1];
    const DY = [-1, -1, 0, 1, 1, 1, 0, -1];
    const out: (string | null)[][] = Array.from({ length: PH }, () => Array(PW).fill(null));
    const quality: string[][] = Array.from({ length: PH }, () => Array(PW).fill(''));
    for (let y = 0; y < PH; y++) {
      for (let x = 0; x < PW; x++) {
        if (!wall[y][x]) continue;
        const neighbors: boolean[] = [];
        for (let i = 0; i < 8; i++) {
          const nx = x + DX[i], ny = y + DY[i];
          neighbors.push(nx >= 0 && nx < PW && ny >= 0 && ny < PH && wall[ny][nx]);
        }
        const r = pickTile(learned, { neighbors, seed: `${x},${y}` });
        out[y][x] = r.tileKey;
        quality[y][x] = r.matchQuality;
      }
    }
    return { out, quality, PW, PH };
  }, [learned]);

  const familyPatterns = useMemo(() => patterns.filter((p) => p.family === family), [patterns, family]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] gap-4">
      {/* LEFT: tile palette */}
      <Card className="p-3 space-y-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Tiles</Label>
        <Input placeholder="Search tiles…" value={tileSearch} onChange={(e) => setTileSearch(e.target.value)} />
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={selectedTile === EMPTY ? 'default' : 'outline'}
            onClick={() => setSelectedTile(EMPTY)}
            className="flex-1"
          >
            <Eraser className="w-3 h-3 mr-1" /> Empty
          </Button>
        </div>
        <ScrollArea className="h-[520px]">
          <div className="grid grid-cols-3 gap-1 pr-2">
            {filteredTiles.map((t) => (
              <button
                key={t.key}
                onClick={() => setSelectedTile(t.key)}
                className={`relative aspect-square rounded border-2 overflow-hidden bg-muted ${
                  selectedTile === t.key ? 'border-primary' : 'border-transparent'
                }`}
                title={`${t.name}${t.family ? ` · ${t.family}` : ''}`}
              >
                <img src={t.url} alt={t.name} className="w-full h-full object-contain" style={{ imageRendering: 'pixelated' }} />
              </button>
            ))}
            {filteredTiles.length === 0 && (
              <div className="col-span-3 text-xs text-muted-foreground p-3">
                No sliced tiles found. Slice a sheet in the Asset Manager tab first.
              </div>
            )}
          </div>
        </ScrollArea>
      </Card>

      {/* CENTER: grid + meta */}
      <Card className="p-3 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px]">
            <Label className="text-xs">Family tag</Label>
            <div className="flex gap-2">
              <Input
                list="family-list"
                value={family}
                onChange={(e) => setFamily(e.target.value)}
                placeholder="e.g. stone_wall"
              />
              <datalist id="family-list">
                {families.map((f) => <option key={f} value={f} />)}
              </datalist>
            </div>
          </div>
          <div className="flex-1 min-w-[180px]">
            <Label className="text-xs">Pattern name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. corner room" />
          </div>
          <Button onClick={newPattern} variant="outline" size="sm"><Plus className="w-3 h-3 mr-1" />New</Button>
          <Button onClick={savePattern} size="sm"><Save className="w-3 h-3 mr-1" />Save</Button>
        </div>

        <div className="text-xs text-muted-foreground">
          Click a tile in the left panel, then click cells to paint. Use <strong>Empty</strong> to erase or to
          mark a gap (gaps teach the engine where walls end).
        </div>

        <div
          className="inline-grid bg-muted/40 p-1 rounded mx-auto"
          style={{ gridTemplateColumns: `repeat(${GRID_W}, ${CELL_PX}px)` }}
        >
          {grid.map((row, y) => row.map((key, x) => {
            const url = tileUrl(key);
            return (
              <button
                key={`${x},${y}`}
                onClick={() => paintCell(x, y)}
                onMouseEnter={(e) => { if (e.buttons === 1) paintCell(x, y); }}
                className="border border-border bg-background hover:bg-accent/40 relative"
                style={{ width: CELL_PX, height: CELL_PX }}
              >
                {url && <img src={url} className="absolute inset-0 w-full h-full object-contain" style={{ imageRendering: 'pixelated' }} alt="" />}
              </button>
            );
          }))}
        </div>

        {/* Live preview */}
        <div className="space-y-1 pt-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3 h-3 text-primary" />
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Auto-generated preview {learned && `(${learned.ruleCount} rules learned from ${familyPatterns.length} pattern${familyPatterns.length === 1 ? '' : 's'})`}
            </Label>
          </div>
          {preview ? (
            <div
              className="inline-grid bg-background border border-border p-1 rounded"
              style={{ gridTemplateColumns: `repeat(${preview.PW}, 24px)` }}
            >
              {preview.out.flatMap((row, y) => row.map((key, x) => {
                const url = key ? tileUrl(key) : null;
                return (
                  <div
                    key={`p${x},${y}`}
                    className="relative"
                    style={{ width: 24, height: 24, background: key ? undefined : 'transparent' }}
                    title={key ? `${preview.quality[y][x]} match` : 'floor'}
                  >
                    {url && <img src={url} className="absolute inset-0 w-full h-full object-contain" style={{ imageRendering: 'pixelated' }} alt="" />}
                  </div>
                );
              }))}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">
              Pick a family and save at least one pattern to see a generated wall layout here.
            </div>
          )}
        </div>
      </Card>

      {/* RIGHT: saved patterns */}
      <Card className="p-3 space-y-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Saved patterns</Label>
        <Select value={family || '__all'} onValueChange={(v) => setFamily(v === '__all' ? '' : v)}>
          <SelectTrigger><SelectValue placeholder="Filter family" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All families</SelectItem>
            {families.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
          </SelectContent>
        </Select>
        <ScrollArea className="h-[560px]">
          <div className="space-y-2 pr-2">
            {patterns
              .filter((p) => !family || p.family === family)
              .map((p) => (
                <div key={p.id} className={`p-2 rounded border ${editingId === p.id ? 'border-primary' : 'border-border'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <button onClick={() => loadPattern(p)} className="text-left flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{p.family} · {p.cells.length} cells</div>
                    </button>
                    <Button size="icon" variant="ghost" onClick={() => deletePattern(p)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            {patterns.length === 0 && (
              <div className="text-xs text-muted-foreground p-3">
                No patterns saved yet.
              </div>
            )}
          </div>
        </ScrollArea>
      </Card>
    </div>
  );
}
