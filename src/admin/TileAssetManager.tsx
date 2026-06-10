// Tile Asset Manager
// -------------------
// Lets admins bulk-upload premade tile/sprite art and slice tilesheets into
// individual tile assets. All files land in the public `game-assets` bucket
// under `tiles/raw/...` or `tiles/sliced/<sheet>/...`. Metadata (role, tags,
// source sheet, grid position) is stored in `game_data_overrides` with
// data_type='tile_asset' and data_key=<storage path>. Later passes will wire
// these assets to dungeon tile rendering and interactive behaviors.

import { useMemo, useRef, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Upload, Trash2, Search, Image as ImageIcon, Scissors, FolderUp, Loader2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useGameDataOverrides } from '@/hooks/useGameDataOverrides';

const BUCKET = 'game-assets';

const TILE_ROLES = [
  'unassigned',
  'floor',
  'wall',
  'wall_autotile',
  'door',
  'trap',
  'switch',
  'stairs_up',
  'stairs_down',
  'chest',
  'water',
  'lava',
  'decoration',
  'decal',
  'multi_tile_prop',
  'animation_frame',
  'creature',
  'equipment',
  'spell_fx',
  'ui',
] as const;
type TileRole = (typeof TILE_ROLES)[number];

interface TileAssetMeta {
  url: string;
  path: string;
  role: TileRole;
  tags?: string[];
  sheet?: string;
  row?: number;
  col?: number;
  width?: number;
  height?: number;
  // For multi-cell regions: how many base cells this sprite occupies.
  spanCols?: number;
  spanRows?: number;
  contentType?: string;
}

function safeName(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

function publicUrl(path: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// ---------- Bulk uploader ----------

function BulkUploader({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [defaultRole, setDefaultRole] = useState<TileRole>('unassigned');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (list.length === 0) {
      toast.error('No image files selected');
      return;
    }
    setBusy(true);
    setProgress({ done: 0, total: list.length });
    let okCount = 0;
    for (const file of list) {
      try {
        const path = `tiles/raw/${Date.now()}_${safeName(file.name)}`;
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { upsert: false, contentType: file.type || undefined });
        if (error) throw error;
        const url = publicUrl(path);
        // Load to read dimensions
        const dims = await readImageSize(file);
        const meta: TileAssetMeta = {
          url, path,
          role: defaultRole,
          width: dims.w,
          height: dims.h,
          contentType: file.type,
        };
        const { error: dbErr } = await supabase
          .from('game_data_overrides')
          .insert({ data_type: 'tile_asset', data_key: path, data_value: meta });
        if (dbErr) throw dbErr;
        okCount++;
      } catch (err) {
        console.error('Upload failed for', file.name, err);
        toast.error(`Failed: ${file.name} — ${(err as Error).message}`);
      }
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }
    setBusy(false);
    toast.success(`Uploaded ${okCount}/${list.length} tile assets`);
    onDone();
  }, [defaultRole, onDone]);

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <FolderUp className="w-4 h-4" />
        <h4 className="font-semibold">Bulk Upload</h4>
      </div>
      <p className="text-xs text-muted-foreground">
        Drop or pick multiple PNG/JPG/WebP/SVG files. They'll be uploaded as
        individual tile assets you can tag and assign later. Use the Slicer tab
        below for a single tilesheet that needs to be split into a grid.
      </p>
      <div className="flex items-end gap-2 flex-wrap">
        <div className="space-y-1">
          <Label className="text-xs">Default role</Label>
          <Select value={defaultRole} onValueChange={(v) => setDefaultRole(v as TileRole)}>
            <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TILE_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="gap-2"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {busy ? `Uploading ${progress.done}/${progress.total}…` : 'Select images…'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => { handleFiles(e.target.files); if (e.target) e.target.value = ''; }}
        />
      </div>
      <div
        className="border-2 border-dashed rounded p-6 text-center text-sm text-muted-foreground"
        onDragOver={(e) => { e.preventDefault(); }}
        onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
      >
        …or drag &amp; drop files here.
      </div>
    </Card>
  );
}

function readImageSize(file: File): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { resolve({ w: 0, h: 0 }); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

// ---------- Sheet slicer ----------

interface SliceRegion {
  id: string;
  r0: number; c0: number; r1: number; c1: number; // inclusive cell coords
  role: TileRole;
  name?: string;
}

function SheetSlicer({ onDone }: { onDone: () => void }) {
  const { overrides: uploaded } = useGameDataOverrides('tile_asset');
  const [file, setFile] = useState<File | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [tileW, setTileW] = useState(32);
  const [tileH, setTileH] = useState(32);
  const [marginX, setMarginX] = useState(0);
  const [marginY, setMarginY] = useState(0);
  const [spacingX, setSpacingX] = useState(0);
  const [spacingY, setSpacingY] = useState(0);
  const [sheetName, setSheetName] = useState('');
  const [defaultRole, setDefaultRole] = useState<TileRole>('multi_tile_prop');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [regions, setRegions] = useState<SliceRegion[]>([]);
  const [drag, setDrag] = useState<{ r0: number; c0: number; r1: number; c1: number } | null>(null);
  const [displayW, setDisplayW] = useState(0);
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [selectedRemote, setSelectedRemote] = useState<string>('');
  const [zoom, setZoom] = useState(3);
  const imgRef = useRef<HTMLImageElement>(null);

  // Already-uploaded raw sheets the admin can re-open in the slicer.
  const rawSheets = useMemo(() => {
    return uploaded
      .map((o) => ({ key: o.data_key, meta: o.data_value as unknown as TileAssetMeta }))
      .filter((r) => r.key.startsWith('tiles/raw/') && !r.meta.sheet);
  }, [uploaded]);

  const onPick = async (f: File) => {
    setFile(f);
    if (imgUrl && imgUrl.startsWith('blob:')) URL.revokeObjectURL(imgUrl);
    const url = URL.createObjectURL(f);
    setImgUrl(url);
    const d = await readImageSize(f);
    setDims(d);
    setSheetName((prev) => prev || safeName(f.name.replace(/\.[^.]+$/, '')));
    setRegions([]);
  };

  const loadFromLibrary = async (path: string) => {
    setSelectedRemote(path);
    if (!path) return;
    setLoadingRemote(true);
    try {
      const meta = rawSheets.find((r) => r.key === path)?.meta;
      const url = meta?.url || publicUrl(path);
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`Fetch failed (${resp.status})`);
      const blob = await resp.blob();
      const filename = path.split('/').pop() || 'sheet.png';
      const f = new File([blob], filename, { type: blob.type || 'image/png' });
      await onPick(f);
      toast.success(`Loaded ${filename}`);
    } catch (err) {
      console.error(err);
      toast.error(`Could not load sheet: ${(err as Error).message}`);
    } finally {
      setLoadingRemote(false);
    }
  };

  const grid = useMemo(() => {
    if (!dims.w || !dims.h || tileW <= 0 || tileH <= 0) return { cols: 0, rows: 0 };
    const cols = Math.max(0, Math.floor((dims.w - marginX + spacingX) / (tileW + spacingX)));
    const rows = Math.max(0, Math.floor((dims.h - marginY + spacingY) / (tileH + spacingY)));
    return { cols, rows };
  }, [dims, tileW, tileH, marginX, marginY, spacingX, spacingY]);

  // Auto-detect base cell size. Tries common power-of-2 sizes and small
  // margins; picks the largest size that divides the sheet evenly on both
  // axes. Spacing is assumed 0 here (most packed sheets), user can tweak.
  const autoDetect = () => {
    if (!dims.w || !dims.h) { toast.error('Pick a sheet first'); return; }
    const candidates = [64, 48, 32, 24, 16, 8];
    const margins = [0, 1, 2, 4, 8];
    let best: { size: number; margin: number } | null = null;
    for (const size of candidates) {
      for (const m of margins) {
        if ((dims.w - 2 * m) % size === 0 && (dims.h - 2 * m) % size === 0) {
          best = { size, margin: m };
          break;
        }
      }
      if (best) break;
    }
    if (!best) { toast.warning('No clean grid found — adjust manually'); return; }
    setTileW(best.size); setTileH(best.size);
    setMarginX(best.margin); setMarginY(best.margin);
    setSpacingX(0); setSpacingY(0);
    toast.success(`Detected ${best.size}×${best.size} cells, margin ${best.margin}`);
  };

  // ---- Drag-to-select cell regions on the preview ----
  const cellFromEvent = useCallback((e: React.MouseEvent): { r: number; c: number } | null => {
    if (!imgRef.current || !dims.w || displayW === 0) return null;
    const rect = imgRef.current.getBoundingClientRect();
    const scale = rect.width / dims.w;
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    const c = Math.floor((x - marginX) / (tileW + spacingX));
    const r = Math.floor((y - marginY) / (tileH + spacingY));
    if (r < 0 || c < 0 || r >= grid.rows || c >= grid.cols) return null;
    return { r, c };
  }, [dims.w, displayW, marginX, marginY, tileW, tileH, spacingX, spacingY, grid.rows, grid.cols]);

  const onOverlayMouseDown = (e: React.MouseEvent) => {
    const cell = cellFromEvent(e);
    if (!cell) return;
    setDrag({ r0: cell.r, c0: cell.c, r1: cell.r, c1: cell.c });
  };
  const onOverlayMouseMove = (e: React.MouseEvent) => {
    if (!drag) return;
    const cell = cellFromEvent(e);
    if (!cell) return;
    setDrag({ ...drag, r1: cell.r, c1: cell.c });
  };
  const onOverlayMouseUp = () => {
    if (!drag) return;
    const r0 = Math.min(drag.r0, drag.r1);
    const r1 = Math.max(drag.r0, drag.r1);
    const c0 = Math.min(drag.c0, drag.c1);
    const c1 = Math.max(drag.c0, drag.c1);
    setRegions((prev) => [
      ...prev,
      { id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, r0, c0, r1, c1, role: defaultRole },
    ]);
    setDrag(null);
  };

  const removeRegion = (id: string) => setRegions((p) => p.filter((r) => r.id !== id));
  const setRegionRole = (id: string, role: TileRole) =>
    setRegions((p) => p.map((r) => (r.id === id ? { ...r, role } : r)));
  const setRegionName = (id: string, name: string) =>
    setRegions((p) => p.map((r) => (r.id === id ? { ...r, name } : r)));
  const clearRegions = () => setRegions([]);

  // Render the slice plan: regions if any, otherwise the full uniform grid.
  const sliceJobs = useMemo(() => {
    if (regions.length > 0) {
      return regions.map((reg) => ({
        sx: marginX + reg.c0 * (tileW + spacingX),
        sy: marginY + reg.r0 * (tileH + spacingY),
        sw: (reg.c1 - reg.c0 + 1) * tileW + (reg.c1 - reg.c0) * spacingX,
        sh: (reg.r1 - reg.r0 + 1) * tileH + (reg.r1 - reg.r0) * spacingY,
        name: reg.name || `${reg.r0}_${reg.c0}_${reg.r1 - reg.r0 + 1}x${reg.c1 - reg.c0 + 1}`,
        role: reg.role,
        row: reg.r0, col: reg.c0,
        spanRows: reg.r1 - reg.r0 + 1, spanCols: reg.c1 - reg.c0 + 1,
      }));
    }
    const jobs: Array<{
      sx: number; sy: number; sw: number; sh: number; name: string;
      role: TileRole; row: number; col: number; spanRows: number; spanCols: number;
    }> = [];
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        jobs.push({
          sx: marginX + c * (tileW + spacingX),
          sy: marginY + r * (tileH + spacingY),
          sw: tileW, sh: tileH,
          name: `${r}_${c}`, role: defaultRole,
          row: r, col: c, spanRows: 1, spanCols: 1,
        });
      }
    }
    return jobs;
  }, [regions, grid, marginX, marginY, tileW, tileH, spacingX, spacingY, defaultRole]);

  const doSlice = async () => {
    if (!file || !imgUrl) return;
    if (!sheetName) { toast.error('Sheet name required'); return; }
    if (sliceJobs.length === 0) { toast.error('Nothing to slice'); return; }
    if (sliceJobs.length > 4096) {
      toast.error(`Too many tiles (${sliceJobs.length}). Limit is 4096.`);
      return;
    }
    const img = new Image();
    img.src = imgUrl;
    await new Promise((res) => { img.onload = () => res(null); });
    setBusy(true);
    setProgress({ done: 0, total: sliceJobs.length });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    let ok = 0;
    for (const job of sliceJobs) {
      try {
        canvas.width = job.sw;
        canvas.height = job.sh;
        ctx.clearRect(0, 0, job.sw, job.sh);
        ctx.drawImage(img, job.sx, job.sy, job.sw, job.sh, 0, 0, job.sw, job.sh);
        const blob: Blob = await new Promise((res, rej) =>
          canvas.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png')
        );
        const path = `tiles/sliced/${safeName(sheetName)}/${safeName(job.name)}.png`;
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(path, blob, { upsert: true, contentType: 'image/png' });
        if (error) throw error;
        const url = publicUrl(path);
        const meta: TileAssetMeta = {
          url, path,
          role: job.role,
          sheet: sheetName, row: job.row, col: job.col,
          width: job.sw, height: job.sh,
          spanCols: job.spanCols, spanRows: job.spanRows,
          contentType: 'image/png',
        };
        await supabase.from('game_data_overrides').upsert(
          { data_type: 'tile_asset', data_key: path, data_value: meta },
          { onConflict: 'data_type,data_key' }
        );
        ok++;
      } catch (err) {
        console.error('Slice failed', job, err);
      }
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }
    setBusy(false);
    toast.success(`Sliced ${ok}/${sliceJobs.length} sprites from ${sheetName}`);
    onDone();
  };

  // Drag-rect highlight (during drag) in cell coords
  const dragRect = drag && {
    r0: Math.min(drag.r0, drag.r1),
    r1: Math.max(drag.r0, drag.r1),
    c0: Math.min(drag.c0, drag.c1),
    c1: Math.max(drag.c0, drag.c1),
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Scissors className="w-4 h-4" />
        <h4 className="font-semibold">Tilesheet Slicer</h4>
      </div>
      <p className="text-xs text-muted-foreground">
        Upload a sheet, set the base cell size (or hit <b>Auto-detect</b>), then
        either slice every cell uniformly <i>or</i> drag rectangles on the
        preview to lasso multi-cell sprites (doorways, stairs, props). Each
        region uploads as one image with role + span metadata.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Sheet name</Label>
          <Input value={sheetName} onChange={(e) => setSheetName(e.target.value)} placeholder="dungeon_walls" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Tile W</Label>
          <Input type="number" value={tileW} onChange={(e) => setTileW(parseInt(e.target.value) || 0)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Tile H</Label>
          <Input type="number" value={tileH} onChange={(e) => setTileH(parseInt(e.target.value) || 0)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Default role</Label>
          <Select value={defaultRole} onValueChange={(v) => setDefaultRole(v as TileRole)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TILE_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Margin X</Label>
          <Input type="number" value={marginX} onChange={(e) => setMarginX(parseInt(e.target.value) || 0)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Margin Y</Label>
          <Input type="number" value={marginY} onChange={(e) => setMarginY(parseInt(e.target.value) || 0)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Spacing X</Label>
          <Input type="number" value={spacingX} onChange={(e) => setSpacingX(parseInt(e.target.value) || 0)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Spacing Y</Label>
          <Input type="number" value={spacingY} onChange={(e) => setSpacingY(parseInt(e.target.value) || 0)} />
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="file"
          accept="image/*"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); }}
          className="text-sm"
        />
        <span className="text-xs text-muted-foreground">or</span>
        <Select value={selectedRemote} onValueChange={loadFromLibrary}>
          <SelectTrigger className="h-9 w-64">
            <SelectValue placeholder={loadingRemote ? 'Loading…' : `Pick uploaded sheet (${rawSheets.length})`} />
          </SelectTrigger>
          <SelectContent>
            {rawSheets.length === 0 && (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                No uploaded sheets — use Bulk Upload first.
              </div>
            )}
            {rawSheets.map((r) => (
              <SelectItem key={r.key} value={r.key}>
                {r.key.replace(/^tiles\/raw\/\d+_/, '')}
                {r.meta.width ? ` (${r.meta.width}×${r.meta.height})` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={autoDetect} disabled={!dims.w}>
          Auto-detect grid
        </Button>
        {dims.w > 0 && (
          <span className="text-xs text-muted-foreground">
            {dims.w}×{dims.h}px → {grid.cols}×{grid.rows} cells
            {regions.length > 0 && ` • ${regions.length} region${regions.length === 1 ? '' : 's'} selected`}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Label className="text-xs whitespace-nowrap">Zoom {zoom}x</Label>
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={zoom}
          onChange={(e) => setZoom(parseInt(e.target.value))}
          className="w-48"
        />
      </div>


      {imgUrl && (
        <div className="border rounded p-2 bg-muted/20 overflow-auto max-h-[60vh]">
          <div
            className="relative inline-block select-none"
            onMouseDown={onOverlayMouseDown}
            onMouseMove={onOverlayMouseMove}
            onMouseUp={onOverlayMouseUp}
            onMouseLeave={() => setDrag(null)}
          >
            <img
              ref={imgRef}
              src={imgUrl}
              alt="preview"
              draggable={false}
              className="block max-w-none"
              style={{ imageRendering: 'pixelated', width: dims.w * zoom }}
              onLoad={(e) => setDisplayW((e.target as HTMLImageElement).clientWidth)}
            />
            {/* Grid + region overlay, scaled with the rendered image */}
            {displayW > 0 && grid.cols > 0 && (() => {
              const scale = displayW / dims.w;
              const px = (n: number) => `${n * scale}px`;
              return (
                <div className="absolute inset-0 pointer-events-none">
                  {/* Vertical grid lines */}
                  {Array.from({ length: grid.cols + 1 }).map((_, c) => (
                    <div key={`v${c}`} className="absolute top-0 bottom-0 border-l border-primary/30"
                      style={{ left: px(marginX + c * (tileW + spacingX)) }} />
                  ))}
                  {/* Horizontal grid lines */}
                  {Array.from({ length: grid.rows + 1 }).map((_, r) => (
                    <div key={`h${r}`} className="absolute left-0 right-0 border-t border-primary/30"
                      style={{ top: px(marginY + r * (tileH + spacingY)) }} />
                  ))}
                  {/* Saved regions */}
                  {regions.map((reg) => (
                    <div key={reg.id}
                      className="absolute bg-emerald-400/25 border-2 border-emerald-400"
                      style={{
                        left: px(marginX + reg.c0 * (tileW + spacingX)),
                        top: px(marginY + reg.r0 * (tileH + spacingY)),
                        width: px((reg.c1 - reg.c0 + 1) * tileW + (reg.c1 - reg.c0) * spacingX),
                        height: px((reg.r1 - reg.r0 + 1) * tileH + (reg.r1 - reg.r0) * spacingY),
                      }}
                    />
                  ))}
                  {/* Active drag */}
                  {dragRect && (
                    <div className="absolute bg-amber-400/30 border-2 border-amber-400"
                      style={{
                        left: px(marginX + dragRect.c0 * (tileW + spacingX)),
                        top: px(marginY + dragRect.r0 * (tileH + spacingY)),
                        width: px((dragRect.c1 - dragRect.c0 + 1) * tileW + (dragRect.c1 - dragRect.c0) * spacingX),
                        height: px((dragRect.r1 - dragRect.r0 + 1) * tileH + (dragRect.r1 - dragRect.r0) * spacingY),
                      }}
                    />
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {regions.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Selected regions ({regions.length})</Label>
            <Button size="sm" variant="ghost" onClick={clearRegions}>Clear all</Button>
          </div>
          <div className="border rounded divide-y max-h-40 overflow-y-auto">
            {regions.map((reg) => (
              <div key={reg.id} className="flex items-center gap-2 p-2 text-xs">
                <span className="font-mono w-28 shrink-0">
                  r{reg.r0}-{reg.r1} c{reg.c0}-{reg.c1}
                </span>
                <span className="text-muted-foreground w-16 shrink-0">
                  {reg.c1 - reg.c0 + 1}×{reg.r1 - reg.r0 + 1}
                </span>
                <Input
                  className="h-7 text-xs"
                  placeholder="name (optional)"
                  value={reg.name || ''}
                  onChange={(e) => setRegionName(reg.id, e.target.value)}
                />
                <Select value={reg.role} onValueChange={(v) => setRegionRole(reg.id, v as TileRole)}>
                  <SelectTrigger className="h-7 w-40 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TILE_ROLES.map((r) => <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => removeRegion(reg.id)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button onClick={doSlice} disabled={busy || !file} className="gap-2">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scissors className="w-4 h-4" />}
          {busy
            ? `Slicing ${progress.done}/${progress.total}…`
            : regions.length > 0
              ? `Upload ${regions.length} region${regions.length === 1 ? '' : 's'}`
              : `Slice all ${grid.cols * grid.rows} cells`}
        </Button>
        <span className="text-xs text-muted-foreground">
          {regions.length > 0
            ? 'Region mode — only the lassoed sprites will be uploaded.'
            : 'Uniform mode — every cell becomes one tile.'}
        </span>
      </div>
    </Card>
  );
}

// ---------- Library grid ----------

interface TileRow {
  id: string;
  key: string;
  meta: TileAssetMeta;
}

function TileLibrary() {
  const { overrides, loading, refetch } = useGameDataOverrides('tile_asset');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<TileRole | 'all'>('all');
  const [sheetFilter, setSheetFilter] = useState<string>('all');

  const rows: TileRow[] = useMemo(
    () => overrides.map((o) => ({
      id: o.id,
      key: o.data_key,
      meta: o.data_value as unknown as TileAssetMeta,
    })),
    [overrides]
  );

  const sheets = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => { if (r.meta.sheet) set.add(r.meta.sheet); });
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (roleFilter !== 'all' && r.meta.role !== roleFilter) return false;
      if (sheetFilter !== 'all' && r.meta.sheet !== sheetFilter) return false;
      if (!q) return true;
      return r.key.toLowerCase().includes(q)
        || (r.meta.sheet || '').toLowerCase().includes(q)
        || (r.meta.tags || []).join(' ').toLowerCase().includes(q);
    });
  }, [rows, search, roleFilter, sheetFilter]);

  const setRole = async (row: TileRow, role: TileRole) => {
    const next = { ...row.meta, role };
    const { error } = await supabase
      .from('game_data_overrides')
      .update({ data_value: next as unknown as Record<string, unknown> })
      .eq('id', row.id);
    if (error) { toast.error(error.message); return; }
    refetch();
  };

  const removeOne = async (row: TileRow) => {
    if (!confirm(`Delete ${row.key}?`)) return;
    await supabase.storage.from(BUCKET).remove([row.meta.path]).catch(() => undefined);
    const { error } = await supabase.from('game_data_overrides').delete().eq('id', row.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Deleted');
    refetch();
  };

  const removeSheet = async (sheet: string) => {
    const targets = rows.filter((r) => r.meta.sheet === sheet);
    if (targets.length === 0) return;
    if (!confirm(`Delete entire sheet "${sheet}" (${targets.length} tiles)?`)) return;
    await supabase.storage.from(BUCKET).remove(targets.map((t) => t.meta.path)).catch(() => undefined);
    const ids = targets.map((t) => t.id);
    await supabase.from('game_data_overrides').delete().in('id', ids);
    toast.success(`Removed sheet ${sheet}`);
    refetch();
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <ImageIcon className="w-4 h-4" />
        <h4 className="font-semibold mr-auto">Library ({rows.length})</h4>
        <div className="flex items-center gap-1">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search name / tag / sheet…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-56"
          />
        </div>
        <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as TileRole | 'all')}>
          <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {TILE_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sheetFilter} onValueChange={setSheetFilter}>
          <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sheets</SelectItem>
            {sheets.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        {sheetFilter !== 'all' && (
          <Button size="sm" variant="destructive" onClick={() => removeSheet(sheetFilter)}>
            <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete sheet
          </Button>
        )}
      </div>

      {loading && <div className="text-xs text-muted-foreground">Loading…</div>}

      <ScrollArea className="h-[55vh]">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2 p-1">
          {filtered.map((row) => (
            <Card key={row.id} className="p-2 flex flex-col gap-1">
              <div
                className="w-full aspect-square rounded border bg-muted/30 flex items-center justify-center overflow-hidden"
                style={{ imageRendering: 'pixelated' }}
              >
                <img src={row.meta.url} alt={row.key} className="max-w-full max-h-full" style={{ imageRendering: 'pixelated' }} />
              </div>
              <div className="text-[10px] truncate" title={row.key}>
                {row.meta.sheet ? `${row.meta.sheet} ${row.meta.row},${row.meta.col}` : row.key.split('/').pop()}
              </div>
              <Select value={row.meta.role} onValueChange={(v) => setRole(row, v as TileRole)}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TILE_ROLES.map((r) => <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" variant="ghost" className="h-7" onClick={() => removeOne(row)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </Card>
          ))}
          {filtered.length === 0 && !loading && (
            <div className="col-span-full text-center text-sm text-muted-foreground py-8">
              No tiles match. Upload some above.
            </div>
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}

// ---------- Main panel ----------

export function TileAssetManager() {
  const { refetch } = useGameDataOverrides('tile_asset');
  const [tab, setTab] = useState('upload');

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <ImageIcon className="w-4 h-4" /> Tiles &amp; Premade Assets
        </h3>
        <p className="text-xs text-muted-foreground">
          Upload premade tilesets, sprites, or interactive-object art. Tag each
          asset with a role (floor, wall, door, trap, switch, creature, etc.)
          so it can be wired into dungeons, equipment, creatures, or spells
          later. Files are stored in the public <code>game-assets</code>
          bucket; metadata lives in <code>game_data_overrides</code>.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="upload">Bulk Upload</TabsTrigger>
          <TabsTrigger value="slice">Slice Sheet</TabsTrigger>
          <TabsTrigger value="library">Library</TabsTrigger>
        </TabsList>
        <TabsContent value="upload" className="mt-3">
          <BulkUploader onDone={refetch} />
        </TabsContent>
        <TabsContent value="slice" className="mt-3">
          <SheetSlicer onDone={refetch} />
        </TabsContent>
        <TabsContent value="library" className="mt-3">
          <TileLibrary />
        </TabsContent>
      </Tabs>
    </div>
  );
}
