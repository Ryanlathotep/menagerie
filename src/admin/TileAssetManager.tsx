// Tile Asset Manager
// -------------------
// Lets admins bulk-upload premade tile/sprite art (including .psd files),
// slice tilesheets, mark sheets as re-sliceable, lasso multi-tile props from
// sheets in Preview, tag Blob-47 autotile variants, and scope assets to
// per-biome / per-tower tilesets.
//
// Storage: public `game-assets` bucket under `tiles/raw/...` or
// `tiles/sliced/<sheet>/...`. Metadata in `game_data_overrides`
// (data_type='tile_asset', data_key=<storage path>).

import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  Upload, Trash2, Search, Image as ImageIcon, Scissors, FolderUp, Loader2,
  LayoutGrid, Layers, MousePointerSquareDashed, FileImage, Pencil, X,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useGameDataOverrides } from '@/hooks/useGameDataOverrides';
import { readPsd } from 'ag-psd';
import {
  BLOB47_MASKS, reduceMask, isValidBlob47, maskLabel, NEIGHBOR_BITS,
} from '@/game/blob47';

const BUCKET = 'game-assets';
const DEFAULT_TILESET_KEY = 'tileAssetMgr.defaultTileset';
const ANIMATE_PREVIEWS_KEY = 'tileAssetMgr.animatePreviews';

function loadDefaultTileset(): string {
  try { return localStorage.getItem(DEFAULT_TILESET_KEY) || 'Global'; } catch { return 'Global'; }
}
function saveDefaultTileset(v: string): void {
  try { localStorage.setItem(DEFAULT_TILESET_KEY, v); } catch { /* ignore */ }
}



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

// Suggested tileset scopes. Free-form additions are allowed via the tag editor.
const SUGGESTED_TILESETS = [
  'Global',
  // Biomes
  'forest', 'desert', 'tundra', 'swamp', 'volcanic', 'ocean', 'plains',
  // Towers
  'Tower of the Infinite',
  'Fire Tower', 'Water Tower', 'Earth Tower', 'Air Tower', 'Void Tower', 'Normal Tower',
  'Tank Tower', 'Bruiser Tower', 'Assassin Tower', 'Mage Tower', 'Ranger Tower', 'Support Tower',
] as const;

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
  spanCols?: number;
  spanRows?: number;
  contentType?: string;
  // New:
  kind?: 'tile' | 'sheet' | 'sliced'; // default 'tile'
  parentSheet?: string;               // storage path of the sheet a sliced child came from
  sourcePsd?: string;                 // filename of the .psd this layer came from
  autotile?: {
    family: string;                   // e.g. "stone_wall"
    mask: number;                     // 0..255, must be valid blob-47
  };
  tilesets?: string[];                // which biomes/towers this asset belongs to
  frames?: string[];                  // additional asset paths (siblings) cycled for animation
  fps?: number;                       // frames per second for animation; default 6
}


function safeName(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

function publicUrl(path: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// Keyword → role inference. First match wins.
const ROLE_KEYWORDS: Array<[RegExp, TileRole]> = [
  [/\b(wall[-_ ]?auto|autotile|auto[-_ ]?wall)\b/i, 'wall_autotile'],
  [/\b(wall|brick|stone[-_ ]?wall|fence|border)\b/i, 'wall'],
  [/\b(floor|ground|grass|dirt|sand|carpet|path)\b/i, 'floor'],
  [/\b(door|gate|portal|entrance|exit)\b/i, 'door'],
  [/\b(stair|step).*\b(up|asc)\b|\bup[-_ ]?stair/i, 'stairs_up'],
  [/\b(stair|step).*\b(down|desc)\b|\bdown[-_ ]?stair|\bhole\b/i, 'stairs_down'],
  [/\b(stair|step|ladder)\b/i, 'stairs_up'],
  [/\b(chest|loot|treasure|crate)\b/i, 'chest'],
  [/\b(trap|spike|snare|mine)\b/i, 'trap'],
  [/\b(switch|lever|button|pressure|plate|rune)\b/i, 'switch'],
  [/\b(water|river|lake|pond|wave)\b/i, 'water'],
  [/\b(lava|magma|fire[-_ ]?pit)\b/i, 'lava'],
  [/\b(decal|crack|blood|stain|footprint|scorch)\b/i, 'decal'],
  [/\b(prop|statue|altar|pillar|fountain|tree|rock|bush|barrel|pot)\b/i, 'multi_tile_prop'],
  [/\b(anim|frame|fx[-_ ]?\d|sprite[-_ ]?\d)\b/i, 'animation_frame'],
  [/\b(creature|monster|enemy|npc|mob)\b/i, 'creature'],
  [/\b(equip|sword|axe|bow|shield|helm|armor|amulet|potion)\b/i, 'equipment'],
  [/\b(spell|fx|effect|magic|cast|aura|bolt|blast)\b/i, 'spell_fx'],
  [/\b(ui|hud|icon|cursor)\b/i, 'ui'],
  [/\b(decor|deco|ornament|flower|leaf)\b/i, 'decoration'],
];
function roleFromName(name: string): TileRole {
  const base = name.toLowerCase().replace(/\.[^.]+$/, '');
  for (const [re, role] of ROLE_KEYWORDS) {
    if (re.test(base)) return role;
  }
  return 'unassigned';
}

// Pixel-scan auto-detect: load image to canvas, find runs of transparent rows/cols.
async function detectGridFromImage(file: File): Promise<{
  tileW: number; tileH: number; marginX: number; marginY: number;
  spacingX: number; spacingY: number;
} | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, c.width, c.height).data;
        const rowEmpty = (y: number): boolean => {
          const off = y * c.width * 4;
          for (let x = 0; x < c.width; x++) if (data[off + x * 4 + 3] > 8) return false;
          return true;
        };
        const colEmpty = (x: number): boolean => {
          for (let y = 0; y < c.height; y++) if (data[(y * c.width + x) * 4 + 3] > 8) return false;
          return true;
        };
        const measureAxis = (
          empty: (i: number) => boolean,
          size: number,
        ): { margin: number; tile: number; spacing: number } | null => {
          let i = 0;
          while (i < size && empty(i)) i++;
          const margin = i;
          if (i >= size) return null;
          const tileStart = i;
          while (i < size && !empty(i)) i++;
          const tile = i - tileStart;
          if (tile === 0) return null;
          const gapStart = i;
          while (i < size && empty(i)) i++;
          const spacing = i - gapStart;
          return { margin, tile, spacing };
        };
        const xAxis = measureAxis(colEmpty, c.width);
        const yAxis = measureAxis(rowEmpty, c.height);
        URL.revokeObjectURL(url);
        if (!xAxis || !yAxis) { resolve(null); return; }
        resolve({
          tileW: xAxis.tile, tileH: yAxis.tile,
          marginX: xAxis.margin, marginY: yAxis.margin,
          spacingX: xAxis.spacing, spacingY: yAxis.spacing,
        });
      } catch {
        URL.revokeObjectURL(url);
        resolve(null);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
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

// ---------- PSD handling ----------

// Walk every leaf layer with a rendered canvas. Returns one File per visible
// non-empty layer with the layer name path as filename.
async function psdToLayerFiles(file: File): Promise<File[]> {
  const buf = await file.arrayBuffer();
  const psd = readPsd(buf, { skipCompositeImageData: true, useImageData: false });
  const out: File[] = [];
  const baseName = file.name.replace(/\.psd$/i, '');

  type Layer = {
    name?: string;
    hidden?: boolean;
    canvas?: HTMLCanvasElement;
    children?: Layer[];
  };

  const walk = (layers: Layer[] | undefined, pathParts: string[]) => {
    if (!layers) return;
    for (const layer of layers) {
      const safe = safeName(layer.name || 'layer');
      const nextPath = [...pathParts, safe];
      if (layer.children && layer.children.length > 0) {
        // Group: skip hidden groups entirely so we don't export their children.
        if (layer.hidden) continue;
        walk(layer.children, nextPath);
        continue;
      }
      if (layer.hidden) continue;
      if (!layer.canvas) continue;
      if (layer.canvas.width === 0 || layer.canvas.height === 0) continue;
      out.push(canvasToFile(layer.canvas, `${nextPath.join('__')}.png`));
    }
  };

  walk((psd as { children?: Layer[] }).children, [baseName]);
  return out;
}

function canvasToFile(canvas: HTMLCanvasElement, name: string): File {
  // Use a sync-ish blob conversion via dataURL → blob fallback.
  // Most browsers support canvas.toBlob synchronously enough via a promise.
  const dataUrl = canvas.toDataURL('image/png');
  const b64 = dataUrl.split(',')[1];
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new File([arr], name, { type: 'image/png' });
}

function isImageFile(f: File): boolean {
  if (f.type.startsWith('image/')) return true;
  if (/\.(png|jpe?g|webp|gif|svg|bmp|psd)$/i.test(f.name)) return true;
  return false;
}

function isPsd(f: File): boolean {
  return /\.psd$/i.test(f.name) || f.type === 'image/vnd.adobe.photoshop';
}

// ---------- Bulk uploader ----------

function BulkUploader({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; label: string }>(
    { done: 0, total: 0, label: '' },
  );
  const [defaultRole, setDefaultRole] = useState<TileRole>('unassigned');
  const [defaultTileset, setDefaultTileset] = useState<string>(loadDefaultTileset());
  const [defaultKind, setDefaultKind] = useState<'tile' | 'sheet'>('tile');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { saveDefaultTileset(defaultTileset); }, [defaultTileset]);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files).filter(isImageFile);
    if (list.length === 0) {
      toast.error('No image/PSD files selected');
      return;
    }
    setBusy(true);

    type Job = { file: File; sourcePsd?: string };
    const jobs: Job[] = [];
    for (const f of list) {
      if (isPsd(f)) {
        try {
          setProgress({ done: 0, total: list.length, label: `Parsing PSD ${f.name}…` });
          const layers = await psdToLayerFiles(f);
          if (layers.length === 0) toast.warning(`${f.name}: no visible layers`);
          for (const lf of layers) jobs.push({ file: lf, sourcePsd: f.name });
        } catch (err) {
          console.error('PSD parse failed', f.name, err);
          toast.error(`PSD failed: ${f.name} — ${(err as Error).message}`);
        }
      } else {
        jobs.push({ file: f });
      }
    }

    setProgress({ done: 0, total: jobs.length, label: '' });
    let okCount = 0;
    for (const job of jobs) {
      try {
        const file = job.file;
        const prefix = job.sourcePsd
          ? `tiles/raw/${safeName(job.sourcePsd.replace(/\.psd$/i, ''))}`
          : `tiles/raw`;
        const path = `${prefix}/${Date.now()}_${safeName(file.name)}`;
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { upsert: false, contentType: file.type || 'image/png' });
        if (error) throw error;
        const url = publicUrl(path);
        const dims = await readImageSize(file);
        // Sheets: don't try to guess a tile role.
        const inferred = defaultKind === 'sheet'
          ? 'unassigned'
          : (defaultRole === 'unassigned' ? roleFromName(file.name) : defaultRole);
        const meta: TileAssetMeta = {
          url, path,
          role: inferred,
          width: dims.w,
          height: dims.h,
          contentType: file.type || 'image/png',
          kind: defaultKind,
          ...(job.sourcePsd ? { sourcePsd: job.sourcePsd } : {}),
          ...(defaultTileset && defaultTileset !== 'Global' ? { tilesets: [defaultTileset] } : {}),
        };
        const { error: dbErr } = await supabase
          .from('game_data_overrides')
          .insert({ data_type: 'tile_asset', data_key: path, data_value: meta });
        if (dbErr) throw dbErr;
        okCount++;
      } catch (err) {
        console.error('Upload failed for', job.file.name, err);
        toast.error(`Failed: ${job.file.name} — ${(err as Error).message}`);
      }
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }
    setBusy(false);
    toast.success(`Uploaded ${okCount}/${jobs.length} tile assets`);
    onDone();
  }, [defaultRole, defaultKind, defaultTileset, onDone]);

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <FolderUp className="w-4 h-4" />
        <h4 className="font-semibold">Bulk Upload</h4>
      </div>
      <p className="text-xs text-muted-foreground">
        PNG / JPG / WebP / SVG / <b>PSD</b>. PSDs are expanded so each visible
        layer becomes its own asset. Everything uploaded here inherits the
        tileset, kind, and role below — switch <b>Kind</b> to <i>Sheet</i> if
        you're dropping in tilesheets to slice later.
      </p>
      <div className="flex items-end gap-2 flex-wrap">
        <div className="space-y-1">
          <Label className="text-xs">Default tileset</Label>
          <Select value={defaultTileset} onValueChange={setDefaultTileset}>
            <SelectTrigger className="w-48 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SUGGESTED_TILESETS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Kind</Label>
          <Select value={defaultKind} onValueChange={(v) => setDefaultKind(v as 'tile' | 'sheet')}>
            <SelectTrigger className="w-28 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tile">Tile</SelectItem>
              <SelectItem value="sheet">Sheet</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Default role</Label>
          <Select value={defaultRole} onValueChange={(v) => setDefaultRole(v as TileRole)} disabled={defaultKind === 'sheet'}>
            <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TILE_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => inputRef.current?.click()} disabled={busy} className="gap-2">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {busy
            ? (progress.label || `Uploading ${progress.done}/${progress.total}…`)
            : 'Select images / PSDs…'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.psd"
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


// ---------- Sheet slicer ----------

interface SliceRegion {
  id: string;
  r0: number; c0: number; r1: number; c1: number;
  role: TileRole;
  name?: string;
  tags?: string[];
}

// Common connectivity hints — let the autotiler infer how tiles meet later.
const QUICK_TAGS = [
  'floor', 'wall', 'water', 'lava', 'pit', 'door',
  'edge_n', 'edge_e', 'edge_s', 'edge_w',
  'corner_nw', 'corner_ne', 'corner_sw', 'corner_se',
  'connects_floor', 'connects_wall', 'connects_water',
];

// Multi-candidate grid detection. Returns several plausible (tileW,tileH)
// pairings ranked by how evenly they tile the sheet. Far more useful than the
// single-result pixel scan when sheets have no transparent gutters.
function detectGridCandidates(w: number, h: number): Array<{
  tileW: number; tileH: number; marginX: number; marginY: number;
  spacingX: number; spacingY: number; score: number; label: string;
}> {
  if (!w || !h) return [];
  const sizes = [8, 12, 16, 20, 24, 28, 32, 40, 48, 56, 64, 72, 80, 96, 128];
  const margins = [0, 1, 2, 4, 8];
  const out: Array<{
    tileW: number; tileH: number; marginX: number; marginY: number;
    spacingX: number; spacingY: number; score: number; label: string;
  }> = [];
  for (const sx of sizes) {
    for (const sy of sizes) {
      for (const m of margins) {
        const cw = (w - 2 * m) % sx;
        const ch = (h - 2 * m) % sy;
        if (cw !== 0 || ch !== 0) continue;
        const cols = (w - 2 * m) / sx;
        const rows = (h - 2 * m) / sy;
        if (cols < 2 && rows < 2) continue; // skip degenerate "one big tile"
        if (cols > 64 || rows > 64) continue;
        // Prefer square tiles, more cells, smaller margin.
        const square = sx === sy ? 0 : 4;
        const score = -(cols * rows) + square + m * 0.5;
        out.push({
          tileW: sx, tileH: sy, marginX: m, marginY: m,
          spacingX: 0, spacingY: 0, score,
          label: `${sx}×${sy} · ${cols}×${rows} cells${m ? ` · margin ${m}` : ''}`,
        });
      }
    }
  }
  out.sort((a, b) => a.score - b.score);
  // De-duplicate by tile dims.
  const seen = new Set<string>();
  return out.filter((c) => {
    const k = `${c.tileW}x${c.tileH}x${c.marginX}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 8);
}

interface SheetSlicerProps {
  onDone: () => void;
  pendingSheet: { key: string; url: string } | null;
  clearPendingSheet: () => void;
}

interface SliceJobPreview {
  sx: number; sy: number; sw: number; sh: number;
  name: string; role: TileRole; tags?: string[];
  spanRows: number; spanCols: number;
}

// Renders each upcoming slice as its own clipped thumbnail. Lets the admin
// confirm the grid (or region selection) before kicking off the upload.
function SlicedPreviewPanel({
  imgUrl, jobs, totalJobs,
}: { imgUrl: string; jobs: SliceJobPreview[]; totalJobs: number }) {
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    const im = new Image();
    im.onload = () => setImgEl(im);
    im.src = imgUrl;
  }, [imgUrl]);
  const [thumbSize, setThumbSize] = useState(48);
  const refs = useRef<Array<HTMLCanvasElement | null>>([]);

  useEffect(() => {
    if (!imgEl) return;
    jobs.forEach((job, i) => {
      const c = refs.current[i];
      if (!c) return;
      const aspect = job.sw / Math.max(1, job.sh);
      const w = aspect >= 1 ? thumbSize : Math.round(thumbSize * aspect);
      const h = aspect >= 1 ? Math.round(thumbSize / aspect) : thumbSize;
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, w, h);
      try {
        ctx.drawImage(imgEl, job.sx, job.sy, job.sw, job.sh, 0, 0, w, h);
      } catch { /* out of bounds — leave blank */ }
    });
  }, [imgEl, jobs, thumbSize]);

  return (
    <div className="border rounded p-2 bg-muted/10 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Label className="text-xs">
          Sliced preview — {jobs.length}{totalJobs > jobs.length ? ` of ${totalJobs}` : ''} piece{jobs.length === 1 ? '' : 's'}
          {totalJobs > jobs.length && <span className="text-[10px] text-muted-foreground"> (showing first {jobs.length})</span>}
        </Label>
        <div className="flex items-center gap-2">
          <Label className="text-[10px] text-muted-foreground">Thumb</Label>
          <input type="range" min={24} max={128} step={8}
            value={thumbSize} onChange={(e) => setThumbSize(parseInt(e.target.value))}
            className="w-32" />
          <span className="text-[10px] text-muted-foreground w-10 text-right">{thumbSize}px</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 max-h-72 overflow-y-auto">
        {jobs.map((job, i) => (
          <div key={i} className="flex flex-col items-center gap-0.5 p-1 border rounded bg-background/40"
            style={{ width: thumbSize + 12 }}
            title={`${job.name} · ${job.sw}×${job.sh}px · ${job.role}${job.tags?.length ? ` · ${job.tags.join(',')}` : ''}`}>
            <canvas
              ref={(el) => { refs.current[i] = el; }}
              style={{ imageRendering: 'pixelated', maxWidth: thumbSize, maxHeight: thumbSize }}
            />
            <span className="text-[9px] truncate w-full text-center text-muted-foreground">
              {job.spanCols > 1 || job.spanRows > 1 ? `${job.spanCols}×${job.spanRows}` : job.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}



function SheetSlicer({ onDone, pendingSheet, clearPendingSheet }: SheetSlicerProps) {
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
  const [defaultTileset, setDefaultTileset] = useState<string>(loadDefaultTileset());

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [regions, setRegions] = useState<SliceRegion[]>([]);
  const [drag, setDrag] = useState<{ r0: number; c0: number; r1: number; c1: number } | null>(null);
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [selectedRemote, setSelectedRemote] = useState<string>('');
  const [zoom, setZoom] = useState(3);
  // Track the storage key of the loaded sheet so we can flag it as kind:'sheet'.
  const [loadedSheetKey, setLoadedSheetKey] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  // Auto-detect candidate list (multiple options for non-gutter sheets).
  const [candidates, setCandidates] = useState<ReturnType<typeof detectGridCandidates>>([]);
  // Pointer-drag state for the corner handles on the grid overlay.
  const [handleDrag, setHandleDrag] = useState<
    null | { kind: 'origin' | 'size' | 'extent'; startX: number; startY: number; baseMX: number; baseMY: number; baseTW: number; baseTH: number; baseCols: number; baseRows: number; lockAspect: boolean }
  >(null);
  // Cell toggle mode: click individual grid cells to include/exclude them from slicing.
  const [selectCells, setSelectCells] = useState(false);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());


  const rawSheets = useMemo(() => {
    return uploaded
      .map((o) => ({ key: o.data_key, meta: o.data_value as unknown as TileAssetMeta }))
      .filter((r) =>
        r.key.startsWith('tiles/raw/') &&
        r.meta.kind !== 'sliced' &&
        !r.meta.parentSheet,
      );
  }, [uploaded]);

  const onPick = useCallback(async (f: File, knownKey?: string) => {
    setFile(f);
    setImgUrl((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
    const d = await readImageSize(f);
    setDims(d);
    setSheetName((prev) => prev || safeName(f.name.replace(/\.[^.]+$/, '')));
    setRegions([]);
    setSelectedCells(new Set());
    setLoadedSheetKey(knownKey ?? null);
  }, []);

  const loadFromLibrary = useCallback(async (path: string) => {
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
      await onPick(f, path);
      toast.success(`Loaded ${filename}`);
    } catch (err) {
      console.error(err);
      toast.error(`Could not load sheet: ${(err as Error).message}`);
    } finally {
      setLoadingRemote(false);
    }
  }, [rawSheets, onPick]);

  // When the Library asks us to open a specific sheet, load it once.
  useEffect(() => {
    if (!pendingSheet) return;
    loadFromLibrary(pendingSheet.key);
    clearPendingSheet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSheet]);

  const grid = useMemo(() => {
    if (!dims.w || !dims.h || tileW <= 0 || tileH <= 0) return { cols: 0, rows: 0 };
    const cols = Math.max(0, Math.floor((dims.w - marginX + spacingX) / (tileW + spacingX)));
    const rows = Math.max(0, Math.floor((dims.h - marginY + spacingY) / (tileH + spacingY)));
    return { cols, rows };
  }, [dims, tileW, tileH, marginX, marginY, spacingX, spacingY]);

  const applyCandidate = (c: { tileW: number; tileH: number; marginX: number; marginY: number; spacingX: number; spacingY: number }) => {
    setTileW(c.tileW); setTileH(c.tileH);
    setMarginX(c.marginX); setMarginY(c.marginY);
    setSpacingX(c.spacingX); setSpacingY(c.spacingY);
  };

  const autoDetect = async () => {
    if (!dims.w || !dims.h) { toast.error('Pick a sheet first'); return; }
    // Always compute the candidate list from raw dimensions so the user can
    // pick a different grid if the first guess is wrong (e.g. "one big tile").
    const cands = detectGridCandidates(dims.w, dims.h);
    setCandidates(cands);
    // Try pixel-scan first for sheets that DO have gutters.
    if (file) {
      const pix = await detectGridFromImage(file);
      // Require ≥2 cells in BOTH dimensions — pixel-scan often returns "one big tile"
      // for sheets with no transparent gutters, which is never what we want.
      const cols = pix ? Math.floor((dims.w - 2 * pix.marginX) / (pix.tileW + pix.spacingX)) : 0;
      const rows = pix ? Math.floor((dims.h - 2 * pix.marginY) / (pix.tileH + pix.spacingY)) : 0;
      if (pix && pix.tileW >= 4 && pix.tileH >= 4 && cols >= 2 && rows >= 2) {
        applyCandidate(pix);
        toast.success(
          `Pixel-scan: ${pix.tileW}×${pix.tileH} · ${cols}×${rows} cells`,
        );
        return;
      }
    }
    if (cands.length === 0) {
      toast.warning('No clean grid found — try a Source preset or adjust sliders');
      return;
    }
    applyCandidate(cands[0]);
    toast.success(`Best guess: ${cands[0].label}. ${cands.length - 1} alternates listed below.`);
  };

  // One-click presets for popular asset publishers. Saves tons of slider-fiddling.
  const SOURCE_PRESETS: Array<{ label: string; tileW: number; tileH: number; margin: number; spacing: number; hint: string }> = [
    { label: 'Craft Pix 32px', tileW: 32, tileH: 32, margin: 0, spacing: 0, hint: 'Most Craft Pix RPG/top-down packs' },
    { label: 'Craft Pix 16px', tileW: 16, tileH: 16, margin: 0, spacing: 0, hint: 'Craft Pix pixel-art packs' },
    { label: 'Craft Pix 64px', tileW: 64, tileH: 64, margin: 0, spacing: 0, hint: 'Craft Pix props/characters' },
    { label: 'Kenney 16px', tileW: 16, tileH: 16, margin: 0, spacing: 0, hint: 'Kenney 1-bit / micro packs' },
    { label: 'Kenney 64px (1px gap)', tileW: 64, tileH: 64, margin: 0, spacing: 1, hint: 'Kenney roguelike/RPG' },
    { label: 'Oryx 24px', tileW: 24, tileH: 24, margin: 0, spacing: 0, hint: 'Oryx Design Lab' },
    { label: 'RPG Maker 48px', tileW: 48, tileH: 48, margin: 0, spacing: 0, hint: 'RPG Maker MV/MZ A-tile' },
  ];
  const applyPreset = (p: typeof SOURCE_PRESETS[number]) => {
    setTileW(p.tileW); setTileH(p.tileH);
    setMarginX(p.margin); setMarginY(p.margin);
    setSpacingX(p.spacing); setSpacingY(p.spacing);
    toast.success(`${p.label} applied`);
  };

  const cellFromEvent = useCallback((e: React.MouseEvent): { r: number; c: number } | null => {
    if (!imgRef.current || !dims.w) return null;
    const rect = imgRef.current.getBoundingClientRect();
    const scale = rect.width / dims.w;
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    const c = Math.floor((x - marginX) / (tileW + spacingX));
    const r = Math.floor((y - marginY) / (tileH + spacingY));
    if (r < 0 || c < 0 || r >= grid.rows || c >= grid.cols) return null;
    return { r, c };
  }, [dims.w, marginX, marginY, tileW, tileH, spacingX, spacingY, grid.rows, grid.cols]);

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
    const isClick = r0 === r1 && c0 === c1;
    if (selectCells) {
      setSelectedCells((prev) => {
        const next = new Set(prev);
        if (isClick) {
          const key = `${r0},${c0}`;
          if (next.has(key)) next.delete(key);
          else next.add(key);
        } else {
          for (let r = r0; r <= r1; r++) {
            for (let c = c0; c <= c1; c++) next.add(`${r},${c}`);
          }
        }
        return next;
      });
      setDrag(null);
      return;
    }
    // Non-select mode: ignore stray clicks. Only create a region if the
    // user actually dragged across more than one cell — accidental single
    // clicks used to leave a stuck green square with no obvious removal.
    if (isClick) { setDrag(null); return; }
    setRegions((prev) => [
      ...prev,
      { id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, r0, c0, r1, c1, role: defaultRole },
    ]);
    setDrag(null);
  };

  // Right-click removes any green overlay under the cursor (region OR
  // selected cell). Avoids hunting through the regions list to delete things
  // you painted by accident.
  const onOverlayContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const cell = cellFromEvent(e);
    if (!cell) return;
    const hit = regions.find((reg) =>
      cell.r >= Math.min(reg.r0, reg.r1) && cell.r <= Math.max(reg.r0, reg.r1) &&
      cell.c >= Math.min(reg.c0, reg.c1) && cell.c <= Math.max(reg.c0, reg.c1),
    );
    if (hit) { setRegions((p) => p.filter((r) => r.id !== hit.id)); return; }
    const key = `${cell.r},${cell.c}`;
    if (selectedCells.has(key)) {
      setSelectedCells((prev) => { const n = new Set(prev); n.delete(key); return n; });
    }
  };


  // Window-level pointer drag for the corner handles on the grid overlay.
  // 'origin' shifts marginX/marginY together; 'size' resizes tileW/tileH.
  useEffect(() => {
    if (!handleDrag) return;
    const onMove = (e: PointerEvent) => {
      const dx = Math.round((e.clientX - handleDrag.startX) / zoom);
      const dy = Math.round((e.clientY - handleDrag.startY) / zoom);
      const maxX = Math.max(64, dims.w || 4096);
      const maxY = Math.max(64, dims.h || 4096);
      const maxTile = Math.max(256, dims.w || 4096, dims.h || 4096);
      if (handleDrag.kind === 'origin') {
        setMarginX(Math.max(0, Math.min(maxX, handleDrag.baseMX + dx)));
        setMarginY(Math.max(0, Math.min(maxY, handleDrag.baseMY + dy)));
      } else if (handleDrag.kind === 'size') {
        let nw = Math.max(1, Math.min(maxTile, handleDrag.baseTW + dx));
        let nh = Math.max(1, Math.min(maxTile, handleDrag.baseTH + dy));
        if (handleDrag.lockAspect || e.shiftKey) {
          const v = Math.abs(dx) > Math.abs(dy) ? nw : nh;
          nw = v; nh = v;
        }
        setTileW(nw); setTileH(nh);
      } else {
        // 'extent': stretch the bottom-right of the LAST cell. Resizes
        // tileW/tileH so the grid spans corner-to-corner across the sheet.
        const cols = Math.max(1, handleDrag.baseCols);
        const rows = Math.max(1, handleDrag.baseRows);
        const baseExtX = handleDrag.baseMX + cols * (handleDrag.baseTW + spacingX) - spacingX;
        const baseExtY = handleDrag.baseMY + rows * (handleDrag.baseTH + spacingY) - spacingY;
        const newExtX = Math.max(handleDrag.baseMX + cols, Math.min(maxX, baseExtX + dx));
        const newExtY = Math.max(handleDrag.baseMY + rows, Math.min(maxY, baseExtY + dy));
        let nw = Math.max(1, Math.round((newExtX - handleDrag.baseMX + spacingX) / cols - spacingX));
        let nh = Math.max(1, Math.round((newExtY - handleDrag.baseMY + spacingY) / rows - spacingY));
        if (handleDrag.lockAspect || e.shiftKey) {
          const v = Math.abs(dx) > Math.abs(dy) ? nw : nh;
          nw = v; nh = v;
        }
        setTileW(nw); setTileH(nh);
      }
    };
    const onUp = () => setHandleDrag(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [handleDrag, zoom]);



  const removeRegion = (id: string) => setRegions((p) => p.filter((r) => r.id !== id));
  const setRegionRole = (id: string, role: TileRole) =>
    setRegions((p) => p.map((r) => (r.id === id ? { ...r, role } : r)));
  const setRegionName = (id: string, name: string) =>
    setRegions((p) => p.map((r) => (r.id === id ? { ...r, name } : r)));
  const toggleRegionTag = (id: string, tag: string) =>
    setRegions((p) => p.map((r) => {
      if (r.id !== id) return r;
      const cur = new Set(r.tags || []);
      if (cur.has(tag)) cur.delete(tag); else cur.add(tag);
      return { ...r, tags: Array.from(cur) };
    }));
  const clearRegions = () => setRegions([]);

  const sliceJobs = useMemo(() => {
    if (regions.length > 0) {
      return regions.map((reg) => ({
        sx: marginX + reg.c0 * (tileW + spacingX),
        sy: marginY + reg.r0 * (tileH + spacingY),
        sw: (reg.c1 - reg.c0 + 1) * tileW + (reg.c1 - reg.c0) * spacingX,
        sh: (reg.r1 - reg.r0 + 1) * tileH + (reg.r1 - reg.r0) * spacingY,
        name: reg.name || `${reg.r0}_${reg.c0}_${reg.r1 - reg.r0 + 1}x${reg.c1 - reg.c0 + 1}`,
        role: reg.role,
        tags: reg.tags,
        row: reg.r0, col: reg.c0,
        spanRows: reg.r1 - reg.r0 + 1, spanCols: reg.c1 - reg.c0 + 1,
      }));
    }
    const jobs: Array<{
      sx: number; sy: number; sw: number; sh: number; name: string;
      role: TileRole; tags?: string[]; row: number; col: number; spanRows: number; spanCols: number;
    }> = [];
    const activeCells = selectedCells.size > 0 ? selectedCells : null;
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        if (activeCells && !activeCells.has(`${r},${c}`)) continue;
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
  }, [regions, grid, marginX, marginY, tileW, tileH, spacingX, spacingY, defaultRole, selectedCells]);


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
          kind: 'sliced',
          ...(loadedSheetKey ? { parentSheet: loadedSheetKey } : {}),
          ...(defaultTileset && defaultTileset !== 'Global' ? { tilesets: [defaultTileset] } : {}),
          ...(job.tags && job.tags.length ? { tags: job.tags } : {}),
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

    // Mark the parent as a sheet so it can be hidden from "real" tile lists.
    if (loadedSheetKey) {
      const parent = rawSheets.find((r) => r.key === loadedSheetKey);
      if (parent) {
        const nextMeta: TileAssetMeta = { ...parent.meta, kind: 'sheet' };
        await supabase.from('game_data_overrides').update({
          data_value: nextMeta as unknown as Record<string, unknown>,
        }).eq('data_type', 'tile_asset').eq('data_key', loadedSheetKey);
      }
    }

    setBusy(false);
    toast.success(`Sliced ${ok}/${sliceJobs.length} sprites from ${sheetName}`);
    onDone();
  };

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
        {loadedSheetKey && (
          <span className="text-[10px] text-muted-foreground ml-2">
            (editing sheet from library)
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Upload a sheet (or pick one from the Library), set the base cell size
        (or hit <b>Auto-detect</b>), then either slice every cell uniformly
        <i> or </i> drag rectangles on the preview to lasso multi-cell sprites.
        Slicing marks the source image as a "sheet" and links every child back
        to it.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Sheet name</Label>
          <Input value={sheetName} onChange={(e) => setSheetName(e.target.value)} placeholder="dungeon_walls" />
        </div>
        <div className="grid grid-cols-2 gap-2">
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
            <Label className="text-xs">Tileset</Label>
            <Select value={defaultTileset} onValueChange={setDefaultTileset}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SUGGESTED_TILESETS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Slider controls — live preview updates as you drag. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 border-t pt-3">
        {([
          ['Tile W',    tileW,    setTileW,    4, 256],
          ['Tile H',    tileH,    setTileH,    4, 256],
          ['Margin X',  marginX,  setMarginX,  0, 64],
          ['Margin Y',  marginY,  setMarginY,  0, 64],
          ['Spacing X', spacingX, setSpacingX, 0, 64],
          ['Spacing Y', spacingY, setSpacingY, 0, 64],
        ] as Array<[string, number, (n: number) => void, number, number]>).map(([label, val, set, min, max]) => (
          <div key={label} className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs">{label}</Label>
              <Input
                type="number"
                value={val}
                min={min}
                max={max}
                onChange={(e) => set(Math.max(min, Math.min(max, parseInt(e.target.value) || 0)))}
                className="h-7 w-20 text-xs"
              />
            </div>
            <Slider
              min={min}
              max={max}
              step={1}
              value={[val]}
              onValueChange={([n]) => set(n)}
            />
          </div>
        ))}
      </div>


      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="file"
          accept="image/*,.psd"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            // PSDs in slicer: flatten first visible composite layer.
            if (isPsd(f)) {
              try {
                const layers = await psdToLayerFiles(f);
                if (layers.length === 0) { toast.error('No visible layers in PSD'); return; }
                // Use the first layer's bounds as the sheet — admin can re-export flattened if needed.
                toast.info(`PSD has ${layers.length} layers; loading the first. To slice a flat sheet, export to PNG first.`);
                await onPick(layers[0]);
              } catch (err) {
                toast.error(`PSD failed: ${(err as Error).message}`);
              }
            } else {
              onPick(f);
            }
          }}
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

      <div className="border rounded p-2 bg-muted/10 space-y-1">
        <Label className="text-xs">Source preset (one-click setup)</Label>
        <div className="flex flex-wrap gap-1">
          {SOURCE_PRESETS.map((p) => {
            const active = p.tileW === tileW && p.tileH === tileH
              && p.margin === marginX && p.spacing === spacingX;
            return (
              <Button key={p.label} size="sm" variant={active ? 'default' : 'outline'}
                className="h-7 text-[11px]" onClick={() => applyPreset(p)} title={p.hint}>
                {p.label}
              </Button>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground">
          Know your asset source? Pick its preset — it sets tile size, margin and spacing in one shot.
        </p>
      </div>


      {candidates.length > 1 && (
        <div className="border rounded p-2 space-y-1 bg-muted/20">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Grid candidates ({candidates.length})</Label>
            <Button size="sm" variant="ghost" className="h-6 text-[10px]"
              onClick={() => setCandidates([])}>Hide</Button>
          </div>
          <div className="flex flex-wrap gap-1">
            {candidates.map((c, i) => {
              const active = c.tileW === tileW && c.tileH === tileH
                && c.marginX === marginX && c.marginY === marginY;
              return (
                <Button key={i} size="sm" variant={active ? 'default' : 'outline'}
                  className="h-7 text-[11px]"
                  onClick={() => applyCandidate(c)}
                  title="Apply this grid">
                  {c.label}
                </Button>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Sheets without transparent gutters can fit many grids. Pick the one whose lines land on every tile edge in the preview.
          </p>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={selectCells ? 'default' : 'outline'}
            className="h-7 text-[11px]"
            onClick={() => setSelectCells((v) => !v)}
            title={selectCells ? 'Click cells to toggle selection. Drag to add a range.' : 'Toggle cell-select mode'}
          >
            {selectCells ? 'Cell Select: ON' : 'Cell Select: OFF'}
          </Button>
          {selectCells && (
            <Button size="sm" variant="ghost" className="h-7 text-[11px]"
              onClick={() => setSelectedCells(new Set())}>
              Clear {selectedCells.size} cells
            </Button>
          )}
        </div>
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
            className={`relative inline-block select-none ${selectCells ? 'cursor-pointer' : 'cursor-crosshair'}`}
            onMouseLeave={() => setDrag(null)}
          >
            <img
              ref={imgRef}
              src={imgUrl}
              alt="preview"
              draggable={false}
              className="block max-w-none"
              style={{ imageRendering: 'pixelated', width: dims.w * zoom }}
            />
            {dims.w > 0 && grid.cols > 0 && (() => {
              const scale = zoom;
              const px = (n: number) => `${n * scale}px`;
              return (
                <div className="absolute inset-0 pointer-events-none">
                  {Array.from({ length: grid.cols + 1 }).map((_, c) => (
                    <div key={`v${c}`} className="absolute top-0 bottom-0 border-l border-primary/30"
                      style={{ left: px(marginX + c * (tileW + spacingX)) }} />
                  ))}
                  {Array.from({ length: grid.rows + 1 }).map((_, r) => (
                    <div key={`h${r}`} className="absolute left-0 right-0 border-t border-primary/30"
                      style={{ top: px(marginY + r * (tileH + spacingY)) }} />
                  ))}
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
                  {selectCells && Array.from(selectedCells).map((key) => {
                    const [r, c] = key.split(',').map(Number);
                    return (
                      <div key={`sel-${r}-${c}`}
                        className="absolute bg-emerald-400/35 border-2 border-emerald-400"
                        style={{
                          left: px(marginX + c * (tileW + spacingX)),
                          top: px(marginY + r * (tileH + spacingY)),
                          width: px(tileW),
                          height: px(tileH),
                        }}
                      />
                    );
                  })}
                  {/* Transparent hit layer guarantees every click/drag is captured
                      even when grid lines or selected-cell overlays are rendered. */}
                  <div
                    className="absolute inset-0 pointer-events-auto"
                    onMouseDown={onOverlayMouseDown}
                    onMouseMove={onOverlayMouseMove}
                    onMouseUp={onOverlayMouseUp}
                  />



                </div>
              );
            })()}
            {/* Draggable corner vertices on top of the overlay. */}
            {dims.w > 0 && (() => {
              const scale = zoom;
              const ox = marginX * scale;
              const oy = marginY * scale;
              const sx = (marginX + tileW) * scale;
              const sy = (marginY + tileH) * scale;
              const handleStyle = (left: number, top: number): React.CSSProperties => ({
                left: left - 8, top: top - 8, width: 16, height: 16,
              });
              return (
                <>
                  <div
                    title="Drag to move the whole grid (margin X/Y). Hold Shift to step."
                    className="absolute rounded-full bg-primary border-2 border-background shadow cursor-grab active:cursor-grabbing"
                    style={handleStyle(ox, oy)}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setHandleDrag({
                        kind: 'origin', startX: e.clientX, startY: e.clientY,
                        baseMX: marginX, baseMY: marginY, baseTW: tileW, baseTH: tileH,
                        lockAspect: false,
                      });
                    }}
                  />
                  <div
                    title="Drag to resize the tile cell (Shift = square)."
                    className="absolute rounded-sm bg-amber-400 border-2 border-background shadow cursor-nwse-resize"
                    style={handleStyle(sx, sy)}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setHandleDrag({
                        kind: 'size', startX: e.clientX, startY: e.clientY,
                        baseMX: marginX, baseMY: marginY, baseTW: tileW, baseTH: tileH,
                        lockAspect: e.shiftKey,
                      });
                    }}
                  />
                </>
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
              <div key={reg.id} className="p-2 text-xs space-y-1">
                <div className="flex items-center gap-2">
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
                <div className="flex flex-wrap gap-1 pl-28">
                  {QUICK_TAGS.map((t) => {
                    const on = reg.tags?.includes(t);
                    return (
                      <button
                        key={t} type="button"
                        onClick={() => toggleRegionTag(reg.id, t)}
                        className={`px-1.5 py-0.5 rounded text-[10px] border ${
                          on
                            ? 'bg-emerald-500/30 border-emerald-500 text-emerald-200'
                            : 'border-border text-muted-foreground hover:bg-muted'
                        }`}
                        title="Mark how this tile connects to neighbours"
                      >{t}</button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sliced preview — clip each upcoming job from the source so the admin
          can verify the grid before uploading. */}
      {imgUrl && dims.w > 0 && sliceJobs.length > 0 && (
        <SlicedPreviewPanel
          imgUrl={imgUrl}
          jobs={sliceJobs.slice(0, 96)}
          totalJobs={sliceJobs.length}
        />
      )}

      <div className="flex items-center gap-2">
        <Button onClick={doSlice} disabled={busy || !file} className="gap-2">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scissors className="w-4 h-4" />}
          {busy
            ? `Slicing ${progress.done}/${progress.total}…`
            : regions.length > 0
              ? `Upload ${regions.length} region${regions.length === 1 ? '' : 's'}`
              : selectedCells.size > 0
                ? `Slice ${selectedCells.size} selected cell${selectedCells.size === 1 ? '' : 's'}`
                : `Slice all ${grid.cols * grid.rows} cells`}
        </Button>
        <span className="text-xs text-muted-foreground">
          {regions.length > 0
            ? 'Region mode — only the lassoed sprites will be uploaded.'
            : selectedCells.size > 0
              ? 'Cell mode — only the highlighted cells will be uploaded.'
              : 'Uniform mode — every cell becomes one tile.'}
        </span>

      </div>
    </Card>
  );
}

// ---------- Library ----------

interface TileRow {
  id: string;
  key: string;
  meta: TileAssetMeta;
}

// Small image that flips to a broken-badge if loading fails.
function TileThumb({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className={`${className || ''} flex items-center justify-center text-[10px] text-destructive bg-destructive/10`}
        title={`Failed to load: ${src}`}>
        ⚠ broken
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={{ imageRendering: 'pixelated' }}
      onError={() => { console.warn('[TileAssetManager] image load failed', src); setFailed(true); }}
    />
  );
}

// Animated thumbnail that cycles meta.frames at meta.fps when animation is enabled.
// Falls back to a single frame (the primary url) otherwise.
function TileAnim({ meta, className, animate = true }: {
  meta: Pick<TileAssetMeta, 'url' | 'frames' | 'fps'>;
  className?: string;
  animate?: boolean;
}) {
  const frames = useMemo(() => {
    const list = [meta.url, ...((meta.frames || []).map((p) => p.startsWith('http') ? p : publicUrl(p)))];
    return list.filter(Boolean);
  }, [meta.url, meta.frames]);
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!animate || frames.length < 2) return;
    const fps = Math.max(1, Math.min(30, meta.fps ?? 6));
    const t = window.setInterval(() => setI((v) => (v + 1) % frames.length), Math.round(1000 / fps));
    return () => window.clearInterval(t);
  }, [animate, frames, meta.fps]);
  return <TileThumb src={frames[i] ?? meta.url} alt="" className={className} />;
}



// Inline editor for Blob-47 autotile masks. 3x3 grid; center = self.
function AutotileEditor({ row, onChange }: { row: TileRow; onChange: (next: TileAssetMeta) => void }) {
  const current = row.meta.autotile;
  const [family, setFamily] = useState(current?.family || '');
  const [mask, setMask] = useState(current?.mask ?? 0);

  const toggleBit = (bit: number) => setMask((m) => reduceMask(m ^ bit));

  const cells: Array<{ bit: number | null; label: string }> = [
    { bit: NEIGHBOR_BITS.NW, label: 'NW' },
    { bit: NEIGHBOR_BITS.N,  label: 'N' },
    { bit: NEIGHBOR_BITS.NE, label: 'NE' },
    { bit: NEIGHBOR_BITS.W,  label: 'W' },
    { bit: null,             label: 'THIS' },
    { bit: NEIGHBOR_BITS.E,  label: 'E' },
    { bit: NEIGHBOR_BITS.SW, label: 'SW' },
    { bit: NEIGHBOR_BITS.S,  label: 'S' },
    { bit: NEIGHBOR_BITS.SE, label: 'SE' },
  ];

  const valid = isValidBlob47(mask);

  return (
    <div className="space-y-2 w-72">
      <div className="text-[10px] text-muted-foreground leading-snug bg-muted/30 rounded p-2">
        <b>Only fill this in for autotiled families</b> (e.g. walls that
        seamlessly connect). For a standalone tile, skip this — just set a
        role. The center cell <b>is this tile</b>. Toggle the 8 sides to mark
        which neighbors of the <i>same family</i> this artwork is drawn for.
        Each family needs up to 47 variants (one per neighbor combo).
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Family (what counts as a neighbor)</Label>
        <Input
          className="h-7 text-xs"
          placeholder="stone_wall"
          value={family}
          onChange={(e) => setFamily(e.target.value)}
        />
        <div className="text-[10px] text-muted-foreground">
          Any tile sharing this family name will connect to this one.
        </div>
      </div>
      <div>
        <Label className="text-xs">Same-family neighbors for THIS variant</Label>
        <div className="grid grid-cols-3 gap-0.5 mt-1">
          {cells.map((c, i) => {
            const active = c.bit !== null && (mask & c.bit) !== 0;
            const isCenter = c.bit === null;
            return (
              <button
                key={i}
                type="button"
                onClick={() => c.bit !== null && toggleBit(c.bit)}
                title={isCenter ? 'This tile (locked)' : `Toggle ${c.label} neighbor`}
                className={`h-9 text-[10px] rounded border ${
                  isCenter
                    ? 'bg-primary/30 border-primary cursor-default font-bold'
                    : active
                      ? 'bg-emerald-500/40 border-emerald-500'
                      : 'bg-muted/30 hover:bg-muted'
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="text-[10px] text-muted-foreground">
        mask {mask} ({maskLabel(mask) || 'isolated'}) {valid ? '' : '· auto-reduced'}
      </div>

      <div className="flex gap-2">
        <Button size="sm" className="h-7 text-xs" onClick={() => {
          if (!family.trim()) { toast.error('Family required'); return; }
          onChange({ ...row.meta, autotile: { family: family.trim(), mask: reduceMask(mask) } });
        }}>Save</Button>
        {current && (
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => {
            const next = { ...row.meta };
            delete next.autotile;
            onChange(next);
          }}>Clear</Button>
        )}
      </div>
    </div>
  );
}

// Tileset multi-select tag chooser.
function TilesetEditor({ row, onChange }: { row: TileRow; onChange: (next: TileAssetMeta) => void }) {
  const current = row.meta.tilesets || [];
  const [draft, setDraft] = useState('');
  const all = useMemo(() => {
    const set = new Set<string>([...SUGGESTED_TILESETS, ...current]);
    return Array.from(set).sort();
  }, [current]);
  const toggle = (name: string) => {
    const next = current.includes(name)
      ? current.filter((x) => x !== name)
      : [...current, name];
    onChange({ ...row.meta, tilesets: next.length ? next : undefined });
  };
  return (
    <div className="space-y-2 w-56">
      <Label className="text-xs">Tilesets</Label>
      <div className="flex flex-wrap gap-1 max-h-44 overflow-y-auto">
        {all.map((name) => {
          const on = current.includes(name);
          return (
            <button
              key={name}
              type="button"
              onClick={() => toggle(name)}
              className={`text-[10px] px-1.5 py-0.5 rounded border ${
                on ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/30'
              }`}
            >
              {name}
            </button>
          );
        })}
      </div>
      <div className="flex gap-1">
        <Input className="h-7 text-xs" placeholder="add custom…" value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && draft.trim()) {
              toggle(draft.trim());
              setDraft('');
            }
          }}
        />
      </div>
    </div>
  );
}

interface TileLibraryProps {
  onOpenSheet: (row: TileRow) => void;
}

function TileLibrary({ onOpenSheet }: TileLibraryProps) {
  const { overrides, loading, refetch } = useGameDataOverrides('tile_asset');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<TileRole | 'all'>('all');
  const [sheetFilter, setSheetFilter] = useState<string>('all');
  const [tilesetFilter, setTilesetFilter] = useState<string>('all');
  const [kindFilter, setKindFilter] = useState<'all' | 'tile' | 'sheet' | 'sliced' | 'unassigned'>('all');
  const [showSliced, setShowSliced] = useState(true);
  const [paintRole, setPaintRole] = useState<TileRole>('floor');
  const [paintMode, setPaintMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkRole, setBulkRole] = useState<TileRole>('floor');
  const [bulkTileset, setBulkTileset] = useState<string>('Global');


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

  const knownTilesets = useMemo(() => {
    const set = new Set<string>(SUGGESTED_TILESETS);
    rows.forEach((r) => (r.meta.tilesets || []).forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (!showSliced && r.meta.kind === 'sliced') return false;
      if (kindFilter === 'tile' && (r.meta.kind ?? 'tile') !== 'tile') return false;
      if (kindFilter === 'sheet' && r.meta.kind !== 'sheet') return false;
      if (kindFilter === 'sliced' && r.meta.kind !== 'sliced') return false;
      if (kindFilter === 'unassigned' && r.meta.role !== 'unassigned') return false;
      if (roleFilter !== 'all' && r.meta.role !== roleFilter) return false;
      if (sheetFilter !== 'all' && r.meta.sheet !== sheetFilter) return false;
      if (tilesetFilter !== 'all') {
        const ts = r.meta.tilesets || [];
        if (tilesetFilter === 'Global') { if (ts.length > 0) return false; }
        else if (!ts.includes(tilesetFilter)) return false;
      }
      if (!q) return true;
      return r.key.toLowerCase().includes(q)
        || (r.meta.sheet || '').toLowerCase().includes(q)
        || (r.meta.sourcePsd || '').toLowerCase().includes(q)
        || (r.meta.tags || []).join(' ').toLowerCase().includes(q)
        || (r.meta.tilesets || []).join(' ').toLowerCase().includes(q);
    });
  }, [rows, search, roleFilter, sheetFilter, showSliced, kindFilter, tilesetFilter]);

  const slicedCount = useMemo(
    () => rows.filter((r) => r.meta.kind === 'sliced').length,
    [rows],
  );

  const toggleSelect = (key: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const selectAllFiltered = () => setSelected(new Set(filtered.map((r) => r.key)));
  const clearSelection = () => setSelected(new Set());
  const selectedRows = useMemo(() => filtered.filter((r) => selected.has(r.key)), [filtered, selected]);



  const updateMeta = async (row: TileRow, next: TileAssetMeta) => {
    const { error } = await supabase
      .from('game_data_overrides')
      .update({ data_value: next as unknown as Record<string, unknown> })
      .eq('id', row.id);
    if (error) { toast.error(error.message); return; }
    refetch();
  };

  const setRole = (row: TileRow, role: TileRole) => updateMeta(row, { ...row.meta, role });

  const autoTagByName = async () => {
    const targets = rows.filter((r) => r.meta.role === 'unassigned');
    if (targets.length === 0) { toast.info('Nothing to tag — no unassigned tiles.'); return; }
    let n = 0;
    for (const row of targets) {
      const hint = row.meta.sheet
        ? `${row.meta.sheet} ${row.key.split('/').pop() || ''}`
        : row.key;
      const r = roleFromName(hint);
      if (r === 'unassigned') continue;
      const next = { ...row.meta, role: r };
      const { error } = await supabase
        .from('game_data_overrides')
        .update({ data_value: next as unknown as Record<string, unknown> })
        .eq('id', row.id);
      if (!error) n++;
    }
    toast.success(`Auto-tagged ${n}/${targets.length} tiles from filenames`);
    refetch();
  };

  const markAsSheet = async (row: TileRow) => {
    const becomingSheet = row.meta.kind !== 'sheet';
    const next: TileAssetMeta = becomingSheet
      ? { ...row.meta, kind: 'sheet', role: 'unassigned', autotile: undefined }
      : { ...row.meta, kind: 'tile' };
    if (next.autotile === undefined) delete next.autotile;
    await updateMeta(row, next);
    toast.success(becomingSheet ? 'Marked as sheet (role cleared)' : 'Marked as tile');
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

  // ---- Bulk actions over `selectedRows` ----
  const bulkDelete = async () => {
    if (selectedRows.length === 0) return;
    if (!confirm(`Delete ${selectedRows.length} selected asset(s)?`)) return;
    const paths = selectedRows.map((r) => r.meta.path);
    const ids = selectedRows.map((r) => r.id);
    await supabase.storage.from(BUCKET).remove(paths).catch(() => undefined);
    await supabase.from('game_data_overrides').delete().in('id', ids);
    toast.success(`Deleted ${selectedRows.length}`);
    clearSelection();
    refetch();
  };
  const bulkSetKind = async (kind: 'tile' | 'sheet' | 'sliced') => {
    for (const row of selectedRows) {
      const next: TileAssetMeta = kind === 'sheet'
        ? { ...row.meta, kind, role: 'unassigned', autotile: undefined }
        : { ...row.meta, kind };
      if (next.autotile === undefined) delete next.autotile;
      await supabase.from('game_data_overrides')
        .update({ data_value: next as unknown as Record<string, unknown> })
        .eq('id', row.id);
    }
    toast.success(`Set kind=${kind} on ${selectedRows.length}`);
    clearSelection();
    refetch();
  };
  const bulkSetRole = async (role: TileRole) => {
    for (const row of selectedRows) {
      await supabase.from('game_data_overrides')
        .update({ data_value: { ...row.meta, role } as unknown as Record<string, unknown> })
        .eq('id', row.id);
    }
    toast.success(`Set role=${role} on ${selectedRows.length}`);
    clearSelection();
    refetch();
  };
  const bulkAddTileset = async (tileset: string) => {
    for (const row of selectedRows) {
      const cur = row.meta.tilesets || [];
      const ts = cur.includes(tileset) ? cur : [...cur, tileset];
      await supabase.from('game_data_overrides')
        .update({ data_value: { ...row.meta, tilesets: ts } as unknown as Record<string, unknown> })
        .eq('id', row.id);
    }
    toast.success(`Tagged ${selectedRows.length} with "${tileset}"`);
    clearSelection();
    refetch();
  };
  const bulkClearAutotile = async () => {
    for (const row of selectedRows) {
      const next = { ...row.meta };
      delete next.autotile;
      await supabase.from('game_data_overrides')
        .update({ data_value: next as unknown as Record<string, unknown> })
        .eq('id', row.id);
    }
    toast.success(`Cleared autotile on ${selectedRows.length}`);
    clearSelection();
    refetch();
  };

  // Rename a single asset to the standardized convention:
  //   {tileset}__{role}__{family-or-sheet}__{maskLabel-or-rowCol}.{ext}
  const renameOne = async (row: TileRow) => {
    const ts = (row.meta.tilesets && row.meta.tilesets[0]) || 'global';
    const role = row.meta.role || 'unassigned';
    const family = row.meta.autotile?.family || row.meta.sheet || (row.meta.sourcePsd?.replace(/\.psd$/i, '') ?? 'misc');
    const variant = row.meta.autotile
      ? maskLabel(row.meta.autotile.mask).replace(/\s+/g, '-') || `mask${row.meta.autotile.mask}`
      : (typeof row.meta.row === 'number' && typeof row.meta.col === 'number'
          ? `${row.meta.row}_${row.meta.col}${row.meta.spanCols && row.meta.spanCols > 1 ? `_${row.meta.spanCols}x${row.meta.spanRows}` : ''}`
          : (row.key.split('/').pop()?.replace(/\.[^.]+$/, '') || 'tile'));
    const ext = (row.key.match(/\.[a-z0-9]+$/i)?.[0] || '.png');
    const dir = row.key.includes('/') ? row.key.slice(0, row.key.lastIndexOf('/')) : 'tiles/raw';
    const fname = safeName(`${ts}__${role}__${family}__${variant}`).slice(0, 120) + ext;
    const newPath = `${dir}/${fname}`;
    if (newPath === row.key) { toast.info('Already at convention.'); return; }
    // Copy in storage (download + re-upload) then delete old.
    try {
      const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(row.meta.path);
      if (dlErr) throw dlErr;
      const { error: upErr } = await supabase.storage.from(BUCKET)
        .upload(newPath, blob, { upsert: true, contentType: row.meta.contentType || 'image/png' });
      if (upErr) throw upErr;
      const newUrl = publicUrl(newPath);
      // Insert new override row, delete old.
      const nextMeta: TileAssetMeta = { ...row.meta, url: newUrl, path: newPath };
      await supabase.from('game_data_overrides').insert({
        data_type: 'tile_asset', data_key: newPath, data_value: nextMeta as unknown as Record<string, unknown>,
      });
      await supabase.from('game_data_overrides').delete().eq('id', row.id);
      await supabase.storage.from(BUCKET).remove([row.meta.path]).catch(() => undefined);
      toast.success(`Renamed → ${fname}`);
    } catch (err) {
      toast.error(`Rename failed: ${(err as Error).message}`);
    }
  };
  const bulkRename = async () => {
    if (selectedRows.length === 0) return;
    if (!confirm(`Rename ${selectedRows.length} asset(s) to the standard convention?`)) return;
    for (const row of selectedRows) await renameOne(row);
    clearSelection();
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
            placeholder="Search name / tag / sheet / tileset…"
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
        <Select value={kindFilter} onValueChange={(v) => setKindFilter(v as typeof kindFilter)}>
          <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All kinds</SelectItem>
            <SelectItem value="tile">Tiles only</SelectItem>
            <SelectItem value="sheet">Sheets only</SelectItem>
            <SelectItem value="sliced">Sliced only</SelectItem>
            <SelectItem value="unassigned">Unassigned role</SelectItem>
          </SelectContent>
        </Select>
        <Select value={tilesetFilter} onValueChange={setTilesetFilter}>
          <SelectTrigger className="h-8 w-40"><SelectValue placeholder="Tileset…" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tilesets</SelectItem>
            <SelectItem value="Global">(untagged / Global)</SelectItem>
            {knownTilesets.filter((t) => t !== 'Global').map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2 flex-wrap border-t pt-2">
        <Button size="sm" variant="outline" onClick={autoTagByName}>
          Auto-tag from filename
        </Button>
        <div className="h-5 w-px bg-border mx-1" />
        <Label className="text-xs">Paint role:</Label>
        <Select value={paintRole} onValueChange={(v) => setPaintRole(v as TileRole)}>
          <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TILE_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant={paintMode ? 'default' : 'outline'}
          onClick={() => setPaintMode((m) => !m)}
        >
          {paintMode ? `Painting "${paintRole}" — click tiles` : 'Enable paint mode'}
        </Button>
        <div className="h-5 w-px bg-border mx-1" />
        <Label className="text-xs flex items-center gap-1">
          <input type="checkbox" checked={showSliced} onChange={(e) => setShowSliced(e.target.checked)} />
          Show sliced children ({slicedCount})
        </Label>
      </div>

      {/* Bulk-action sticky bar (only when there's a selection). */}
      {selected.size > 0 && (
        <div className="sticky top-0 z-10 flex items-center gap-2 flex-wrap border rounded p-2 bg-amber-100/40 dark:bg-amber-900/30">
          <span className="text-xs font-semibold">{selected.size} selected</span>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={selectAllFiltered}>
            Select all ({filtered.length})
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={clearSelection}>
            <X className="w-3 h-3" /> Clear
          </Button>
          <div className="h-5 w-px bg-border" />
          <Button size="sm" variant="destructive" className="h-7 text-xs gap-1" onClick={bulkDelete}>
            <Trash2 className="w-3 h-3" /> Delete
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => bulkSetKind('sheet')}>
            → Sheet
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => bulkSetKind('tile')}>
            → Tile
          </Button>
          <Select value={bulkRole} onValueChange={(v) => setBulkRole(v as TileRole)}>
            <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TILE_ROLES.map((r) => <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => bulkSetRole(bulkRole)}>
            Set role
          </Button>
          <Select value={bulkTileset} onValueChange={setBulkTileset}>
            <SelectTrigger className="h-7 w-36 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {knownTilesets.map((t) => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => bulkAddTileset(bulkTileset)}>
            + Tileset
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={bulkClearAutotile}>
            Clear autotile
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={bulkRename}>
            <Pencil className="w-3 h-3" /> Rename
          </Button>
        </div>
      )}


      {loading && <div className="text-xs text-muted-foreground">Loading…</div>}

      <ScrollArea className="h-[55vh]">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2 p-1">
          {filtered.map((row) => {
            const isSheet = row.meta.kind === 'sheet';
            const isSliced = row.meta.kind === 'sliced';
            const isPaintTarget = paintMode && row.meta.role !== paintRole;
            return (
              <Card
                key={row.id}
                className={`p-2 flex flex-col gap-1 transition-colors ${
                  paintMode ? 'cursor-crosshair hover:border-amber-400 hover:bg-amber-400/10' : ''
                } ${row.meta.role === paintRole && paintMode ? 'border-emerald-500/60' : ''} ${
                  isSheet ? 'border-blue-500/50' : ''
                }`}
                onClick={() => { if (isPaintTarget) setRole(row, paintRole); }}
              >
                <div className="w-full aspect-square rounded border bg-muted/30 flex items-center justify-center overflow-hidden relative">
                  <TileAnim meta={row.meta} className="max-w-full max-h-full" />
                  <div className="absolute top-1 right-1" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selected.has(row.key)}
                      onCheckedChange={() => toggleSelect(row.key)}
                      className="bg-background/80 border-foreground/40"
                    />
                  </div>
                  {isSheet && (
                    <span className="absolute top-0 left-0 text-[9px] bg-blue-600 text-white px-1 rounded-br">SHEET</span>
                  )}
                  {isSliced && (
                    <span className="absolute top-0 left-0 text-[9px] bg-muted-foreground/70 text-white px-1 rounded-br">child</span>
                  )}
                  {row.meta.frames && row.meta.frames.length > 0 && (
                    <span className="absolute bottom-0 left-0 text-[9px] bg-purple-600 text-white px-1 rounded-tr">
                      🎞 {row.meta.frames.length + 1}f
                    </span>
                  )}
                  {row.meta.autotile && (
                    <span className="absolute bottom-0 right-0 text-[9px] bg-emerald-600 text-white px-1 rounded-tl">
                      {row.meta.autotile.family}/{row.meta.autotile.mask}
                    </span>
                  )}
                </div>

                <div className="text-[10px] truncate" title={row.key}>
                  {row.meta.sheet ? `${row.meta.sheet} ${row.meta.row},${row.meta.col}` : row.key.split('/').pop()}
                </div>
                <Select
                  value={row.meta.role}
                  onValueChange={(v) => setRole(row, v as TileRole)}
                >
                  <SelectTrigger className="h-7 text-xs" onClick={(e) => e.stopPropagation()}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TILE_ROLES.map((r) => <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="flex gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm" variant="outline" className="h-6 px-1.5 text-[10px] gap-1"
                    title="Open in slicer / mark as sheet"
                    onClick={() => onOpenSheet(row)}
                  >
                    <Scissors className="w-3 h-3" /> Slice
                  </Button>
                  <Button
                    size="sm" variant="outline" className="h-6 px-1.5 text-[10px]"
                    title="Toggle sheet/tile classification"
                    onClick={() => markAsSheet(row)}
                  >
                    {isSheet ? 'Untag sheet' : 'Tag sheet'}
                  </Button>
                  {(row.meta.role === 'wall_autotile' || row.meta.role === 'floor' || row.meta.role === 'wall') && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button size="sm" variant="outline" className="h-6 px-1.5 text-[10px] gap-1">
                          <LayoutGrid className="w-3 h-3" /> Auto
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="p-3" side="right">
                        <AutotileEditor row={row} onChange={(next) => updateMeta(row, next)} />
                      </PopoverContent>
                    </Popover>
                  )}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button size="sm" variant="outline" className="h-6 px-1.5 text-[10px] gap-1">
                        <Layers className="w-3 h-3" /> Set
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-3" side="right">
                      <TilesetEditor row={row} onChange={(next) => updateMeta(row, next)} />
                    </PopoverContent>
                  </Popover>
                  <Button
                    size="sm" variant="outline" className="h-6 px-1.5 text-[10px] gap-1"
                    title="Rename to convention"
                    onClick={() => renameOne(row).then(() => refetch())}
                  >
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm" variant="ghost" className="h-6 px-1.5 ml-auto"
                    onClick={() => removeOne(row)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>

                </div>
                {row.meta.tilesets && row.meta.tilesets.length > 0 && (
                  <div className="flex flex-wrap gap-0.5">
                    {row.meta.tilesets.slice(0, 4).map((t) => (
                      <span key={t} className="text-[9px] bg-muted px-1 rounded">{t}</span>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
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

// ---------- Coverage Dashboard (replaces Roles Guide) ----------

const ROLE_HINTS: Partial<Record<TileRole, string>> = {
  floor: 'Walkable ground. Tiled across every open cell.',
  wall: 'Solid, blocks movement and vision.',
  wall_autotile: 'Wall that auto-connects to neighbors. Tag each variant with a Blob-47 mask.',
  door: 'Walkable when open; visually breaks a wall.',
  stairs_up: 'Goes to the previous floor.',
  stairs_down: 'Goes deeper into the dungeon.',
  chest: 'Holds loot. Sits on a floor tile.',
  trap: 'Hidden hazard, drawn on a floor tile.',
  switch: 'Interactive prop. Pressing toggles things.',
  water: 'Slows movement. Element-tagged.',
  lava: 'Damaging terrain. Element-tagged.',
  decoration: 'Non-blocking prop drawn over a floor.',
  decal: 'Floor overlay (cracks, blood, footprints).',
  multi_tile_prop: 'Multi-cell scenery. Carries spanCols/spanRows.',
  animation_frame: 'A single frame of a sprite animation.',
  creature: 'Spawned enemies / NPCs.',
  equipment: 'Inventory / paper-doll art.',
  spell_fx: 'Visual for attacks/abilities.',
  ui: 'HUD or menu chrome.',
};

function CoverageDashboard() {
  const { overrides } = useGameDataOverrides('tile_asset');
  const [scope, setScope] = useState<string>('Global');
  const [expandedRole, setExpandedRole] = useState<TileRole | null>(null);

  const rows: TileRow[] = useMemo(
    () => overrides.map((o) => ({
      id: o.id, key: o.data_key, meta: o.data_value as unknown as TileAssetMeta,
    })),
    [overrides],
  );

  const knownTilesets = useMemo(() => {
    const set = new Set<string>(SUGGESTED_TILESETS);
    rows.forEach((r) => (r.meta.tilesets || []).forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [rows]);

  const inScope = useMemo(() => rows.filter((r) => {
    if (scope === 'Global') return true;
    return (r.meta.tilesets || []).includes(scope);
  }), [rows, scope]);

  const byRole = useMemo(() => {
    const m = new Map<TileRole, TileRow[]>();
    for (const r of inScope) {
      const arr = m.get(r.meta.role) || [];
      arr.push(r);
      m.set(r.meta.role, arr);
    }
    return m;
  }, [inScope]);

  // For each autotile family, build mask -> row map (within scope).
  const autotileFamilies = useMemo(() => {
    const fam = new Map<string, Map<number, TileRow>>();
    for (const r of inScope) {
      const a = r.meta.autotile;
      if (!a) continue;
      let m = fam.get(a.family);
      if (!m) { m = new Map(); fam.set(a.family, m); }
      m.set(reduceMask(a.mask), r);
    }
    return fam;
  }, [inScope]);

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <LayoutGrid className="w-4 h-4" />
        <h4 className="font-semibold mr-auto">Coverage Dashboard</h4>
        <Label className="text-xs">Tileset scope:</Label>
        <Select value={scope} onValueChange={setScope}>
          <SelectTrigger className="h-8 w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            {knownTilesets.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          {inScope.length}/{rows.length} assets in scope
        </span>
      </div>

      <p className="text-xs text-muted-foreground">
        Each role shows every asset tagged in this scope. Click a role to expand.
        Wall/floor families with Blob-47 tags get a 47-slot coverage grid —
        red slots are missing variants.
      </p>

      <div className="space-y-2">
        {TILE_ROLES.map((role) => {
          const assets = byRole.get(role) || [];
          const open = expandedRole === role;
          return (
            <div key={role} className="border rounded">
              <button
                type="button"
                onClick={() => setExpandedRole(open ? null : role)}
                className="w-full flex items-center gap-2 p-2 text-left hover:bg-muted/30"
              >
                <span className="text-sm font-semibold w-40">{role}</span>
                <span className={`text-xs ${assets.length === 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {assets.length} asset{assets.length === 1 ? '' : 's'}
                </span>
                <span className="text-[10px] text-muted-foreground ml-auto truncate">
                  {ROLE_HINTS[role]}
                </span>
              </button>
              {open && (
                <div className="border-t p-2 space-y-2">
                  {assets.length === 0 ? (
                    <div className="text-xs text-destructive">
                      No assets tagged "{role}" in scope <b>{scope}</b>.
                    </div>
                  ) : (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(60px,1fr))] gap-1">
                      {assets.map((a) => (
                        <div key={a.id} className="aspect-square border rounded bg-muted/20 overflow-hidden"
                          title={`${a.key}${a.meta.autotile ? ` · ${a.meta.autotile.family}/${a.meta.autotile.mask}` : ''}`}>
                          <TileThumb src={a.meta.url} alt={a.key} className="w-full h-full object-contain" />
                        </div>
                      ))}
                    </div>
                  )}

                  {(role === 'wall_autotile' || role === 'floor' || role === 'wall') && (
                    <Blob47Coverage families={autotileFamilies} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function Blob47Coverage({ families }: { families: Map<string, Map<number, TileRow>> }) {
  if (families.size === 0) {
    return (
      <div className="text-[11px] text-muted-foreground border-t pt-2">
        No Blob-47 families tagged yet. In the Library, give wall/floor assets
        a family name and a neighbor mask via the "Auto" button.
      </div>
    );
  }
  return (
    <div className="space-y-2 border-t pt-2">
      {Array.from(families.entries()).map(([family, m]) => {
        const filled = m.size;
        const total = BLOB47_MASKS.length;
        return (
          <div key={family}>
            <div className="text-xs font-semibold mb-1">
              {family} — {filled}/{total} variants
            </div>
            <div className="grid grid-cols-12 gap-0.5">
              {BLOB47_MASKS.map((mask) => {
                const row = m.get(mask);
                return (
                  <div
                    key={mask}
                    className={`aspect-square border rounded ${
                      row ? 'bg-muted/20' : 'bg-destructive/20 border-destructive/50'
                    } overflow-hidden`}
                    title={`mask ${mask} (${maskLabel(mask)})${row ? '' : ' — missing'}`}
                  >
                    {row ? (
                      <TileThumb src={row.meta.url} alt="" className="w-full h-full object-contain" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[8px] text-destructive">
                        {mask}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Dungeon preview ----------

const PREVIEW_ROOMS: Record<string, string[]> = {
  'Full sampler': [
    'WWWWWWWWWWWWWWWW',
    'W..*.....C....UW',
    'W..............W',
    'W..T.....~~....W',
    'W........~~....W',
    'W..S.....LL..d.W',
    'W........LL....W',
    'W..p..........XW',
    'WWWWWDWWWWWWWWWW',
  ],
  'Small room': [
    'WWWWWWWWWW',
    'W........W',
    'W..*..C..W',
    'W........W',
    'W...T....W',
    'W........W',
    'W..S..*..W',
    'W........W',
    'WWWWDWWWWW',
  ],

  'Corridor + stairs': [
    'WWWWWWWWWWWW',
    'W..........W',
    'W.U......X.W',
    'W..........W',
    'WWWWWWDWWWWW',
    '......W.....',
    '......W.....',
    'WWWWWWWWWWWW',
  ],
  'Hazard chamber': [
    'WWWWWWWWWW',
    'W~~....LLW',
    'W~~.TT.LLW',
    'W...TT...W',
    'W..*..C..W',
    'W........W',
    'WWWWDWWWWW',
  ],
};

const CHAR_TO_ROLE: Record<string, TileRole> = {
  W: 'wall', '.': 'floor', D: 'door', U: 'stairs_up', X: 'stairs_down',
  C: 'chest', T: 'trap', S: 'switch', '~': 'water', L: 'lava', '*': 'decoration',
  d: 'decal', p: 'multi_tile_prop',
};


function DungeonPreview({ onDone }: { onDone: () => void }) {
  const { overrides, loading } = useGameDataOverrides('tile_asset');
  const [roomName, setRoomName] = useState<string>('Small room');
  const [tileSize, setTileSize] = useState(48);
  const [picks, setPicks] = useState<Partial<Record<TileRole, string>>>({});
  const [highlightRole, setHighlightRole] = useState<TileRole | null>(null);

  // Marquee mode: pick a sheet, click-drag a rectangle to crop as multi-tile prop.
  const [marqueeMode, setMarqueeMode] = useState(false);
  const [marqueeSheet, setMarqueeSheet] = useState<string>('');
  const [marqueeTileSize, setMarqueeTileSize] = useState(32);
  const [marqueeDrag, setMarqueeDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [marqueeBusy, setMarqueeBusy] = useState(false);
  const marqueeImgRef = useRef<HTMLImageElement>(null);

  const rows = useMemo(
    () => overrides.map((o) => ({
      id: o.id, key: o.data_key, meta: o.data_value as unknown as TileAssetMeta,
    })),
    [overrides],
  );
  const sheets = useMemo(
    () => rows.filter((r) => r.meta.kind === 'sheet' || r.key.startsWith('tiles/raw/')),
    [rows],
  );
  const sheetRow = useMemo(() => sheets.find((s) => s.key === marqueeSheet), [sheets, marqueeSheet]);

  const byRole = useMemo(() => {
    const map = new Map<TileRole, TileRow[]>();
    overrides.forEach((o) => {
      const meta = o.data_value as unknown as TileAssetMeta;
      if (meta.kind === 'sheet') return; // sheets are not tiles
      const role = meta.role || 'unassigned';
      const arr = map.get(role) || [];

      arr.push({ id: o.id, key: o.data_key, meta });
      map.set(role, arr);
    });
    return map;
  }, [overrides]);

  const room = PREVIEW_ROOMS[roomName];
  const rolesUsed = useMemo(() => {
    const set = new Set<TileRole>();
    room.forEach((line) => {
      for (const ch of line) {
        const r = CHAR_TO_ROLE[ch];
        if (r) set.add(r);
      }
    });
    return Array.from(set);
  }, [room]);

  const effectivePicks = useMemo(() => {
    const out: Partial<Record<TileRole, string>> = { ...picks };
    rolesUsed.forEach((r) => {
      if (!out[r]) {
        const first = byRole.get(r)?.[0];
        if (first) out[r] = first.key;
      }
    });
    return out;
  }, [picks, rolesUsed, byRole]);

  const urlForRole = useCallback((role: TileRole): string | null => {
    const key = effectivePicks[role];
    if (!key) return null;
    const found = byRole.get(role)?.find((r) => r.key === key);
    return found?.meta.url || null;
  }, [effectivePicks, byRole]);

  const rowsCount = room.length;
  const colsCount = Math.max(...room.map((r) => r.length));

  // ---- Marquee handlers ----
  const cellFromMarquee = (e: React.MouseEvent): { x: number; y: number } | null => {
    if (!marqueeImgRef.current || !sheetRow?.meta.width) return null;
    const rect = marqueeImgRef.current.getBoundingClientRect();
    const scale = rect.width / sheetRow.meta.width;
    const x = Math.floor((e.clientX - rect.left) / scale / marqueeTileSize);
    const y = Math.floor((e.clientY - rect.top) / scale / marqueeTileSize);
    return { x, y };
  };

  const onMarqueeDown = (e: React.MouseEvent) => {
    const c = cellFromMarquee(e); if (!c) return;
    setMarqueeDrag({ x0: c.x, y0: c.y, x1: c.x, y1: c.y });
  };
  const onMarqueeMove = (e: React.MouseEvent) => {
    if (!marqueeDrag) return;
    const c = cellFromMarquee(e); if (!c) return;
    setMarqueeDrag({ ...marqueeDrag, x1: c.x, y1: c.y });
  };

  const saveMarqueeAsProp = async () => {
    if (!marqueeDrag || !sheetRow) return;
    const x0 = Math.min(marqueeDrag.x0, marqueeDrag.x1);
    const y0 = Math.min(marqueeDrag.y0, marqueeDrag.y1);
    const x1 = Math.max(marqueeDrag.x0, marqueeDrag.x1);
    const y1 = Math.max(marqueeDrag.y0, marqueeDrag.y1);
    const spanCols = x1 - x0 + 1;
    const spanRows = y1 - y0 + 1;
    setMarqueeBusy(true);
    try {
      const resp = await fetch(sheetRow.meta.url);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const img = new Image();
      await new Promise((res, rej) => { img.onload = () => res(null); img.onerror = rej; img.src = url; });
      const sw = spanCols * marqueeTileSize;
      const sh = spanRows * marqueeTileSize;
      const canvas = document.createElement('canvas');
      canvas.width = sw; canvas.height = sh;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, x0 * marqueeTileSize, y0 * marqueeTileSize, sw, sh, 0, 0, sw, sh);
      URL.revokeObjectURL(url);
      const outBlob: Blob = await new Promise((res, rej) =>
        canvas.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png'),
      );
      const sheetBase = sheetRow.key.split('/').pop()?.replace(/\.[^.]+$/, '') || 'sheet';
      const propName = `${safeName(sheetBase)}_prop_${y0}_${x0}_${spanCols}x${spanRows}`;
      const path = `tiles/sliced/${safeName(sheetBase)}/${propName}.png`;
      const { error } = await supabase.storage.from(BUCKET)
        .upload(path, outBlob, { upsert: true, contentType: 'image/png' });
      if (error) throw error;
      const publicURL = publicUrl(path);
      const meta: TileAssetMeta = {
        url: publicURL, path,
        role: 'multi_tile_prop',
        sheet: sheetBase, row: y0, col: x0,
        width: sw, height: sh,
        spanCols, spanRows,
        contentType: 'image/png',
        kind: 'sliced',
        parentSheet: sheetRow.key,
      };
      await supabase.from('game_data_overrides').upsert(
        { data_type: 'tile_asset', data_key: path, data_value: meta },
        { onConflict: 'data_type,data_key' },
      );
      // Mark parent as sheet if not already.
      if (sheetRow.meta.kind !== 'sheet') {
        await supabase.from('game_data_overrides').update({
          data_value: { ...sheetRow.meta, kind: 'sheet' } as unknown as Record<string, unknown>,
        }).eq('data_type', 'tile_asset').eq('data_key', sheetRow.key);
      }
      toast.success(`Saved ${spanCols}×${spanRows} prop from ${sheetBase}`);
      setMarqueeDrag(null);
      onDone();
    } catch (err) {
      toast.error(`Failed: ${(err as Error).message}`);
    } finally {
      setMarqueeBusy(false);
    }
  };

  return (
    <Card className="p-4 space-y-3">
      <Tabs defaultValue="room">
        <TabsList>
          <TabsTrigger value="room">Sample room</TabsTrigger>
          <TabsTrigger value="marquee">Marquee a sheet</TabsTrigger>
        </TabsList>

        <TabsContent value="room" className="mt-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            Pick a sample room, then choose which asset to use for each role.
            Click a role chip to highlight every cell using it.
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="space-y-1">
              <Label className="text-xs">Sample room</Label>
              <Select value={roomName} onValueChange={setRoomName}>
                <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(PREVIEW_ROOMS).map((k) => (
                    <SelectItem key={k} value={k}>{k}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tile size {tileSize}px</Label>
              <input
                type="range" min={16} max={96} step={4}
                value={tileSize}
                onChange={(e) => setTileSize(parseInt(e.target.value))}
                className="w-40 block"
              />
            </div>
            {loading && <span className="text-xs text-muted-foreground">Loading library…</span>}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3">
            <div className="border rounded p-3 bg-muted/20 overflow-auto">
              <div className="relative mx-auto"
                style={{ width: colsCount * tileSize, height: rowsCount * tileSize, imageRendering: 'pixelated' }}>
                {room.map((line, r) => (
                  line.split('').map((ch, c) => {
                    const role = CHAR_TO_ROLE[ch];
                    const floorUrl = urlForRole('floor');
                    const url = role ? urlForRole(role) : null;
                    const isHighlighted = highlightRole && role === highlightRole;
                    const missing = role && !url;
                    const showFloorBase = role && role !== 'wall' && role !== 'wall_autotile' && floorUrl;
                    return (
                      <div key={`${r}-${c}`} className="absolute"
                        style={{ left: c * tileSize, top: r * tileSize, width: tileSize, height: tileSize }}
                        title={role || ch}>
                        {showFloorBase && (
                          <img src={floorUrl} alt="" draggable={false}
                            className="absolute inset-0 w-full h-full"
                            style={{ imageRendering: 'pixelated' }} />
                        )}
                        {url ? (
                          <img src={url} alt={role || ''} draggable={false}
                            className="absolute inset-0 w-full h-full"
                            style={{ imageRendering: 'pixelated' }} />
                        ) : missing ? (
                          <div className="absolute inset-0 flex items-center justify-center text-[10px] text-destructive font-mono"
                            style={{
                              backgroundImage: 'repeating-linear-gradient(45deg, hsl(var(--destructive) / 0.15) 0 4px, transparent 4px 8px)',
                              border: '1px dashed hsl(var(--destructive) / 0.5)',
                            }}>
                            {ch}
                          </div>
                        ) : null}
                        {isHighlighted && (
                          <div className="absolute inset-0 ring-2 ring-amber-400 ring-inset bg-amber-300/20 pointer-events-none" />
                        )}
                      </div>
                    );
                  })
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Roles in this room</Label>
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {rolesUsed.map((role) => {
                  const options = byRole.get(role) || [];
                  const sel = effectivePicks[role] || '';
                  const isHl = highlightRole === role;
                  return (
                    <div key={role}
                      className={`border rounded p-2 space-y-1 transition-colors ${isHl ? 'border-amber-400 bg-amber-400/10' : ''}`}>
                      <div className="flex items-center justify-between gap-2">
                        <button type="button"
                          onClick={() => setHighlightRole(isHl ? null : role)}
                          className="text-xs font-semibold underline-offset-2 hover:underline text-left">
                          {role} {isHl ? '(highlighted)' : ''}
                        </button>
                        <span className="text-[10px] text-muted-foreground">{options.length} asset{options.length === 1 ? '' : 's'}</span>
                      </div>
                      {ROLE_HINTS[role] && (
                        <p className="text-[10px] text-muted-foreground leading-snug">{ROLE_HINTS[role]}</p>
                      )}
                      {options.length === 0 ? (
                        <div className="text-[10px] text-destructive">No assets tagged "{role}".</div>
                      ) : (
                        <Select value={sel} onValueChange={(v) => setPicks((p) => ({ ...p, [role]: v }))}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {options.map((o) => (
                              <SelectItem key={o.id} value={o.key} className="text-xs">
                                {o.meta.sheet ? `${o.meta.sheet} ${o.meta.row},${o.meta.col}` : o.key.split('/').pop()}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  );
                })}
              </div>
              {highlightRole && (
                <Button size="sm" variant="ghost" onClick={() => setHighlightRole(null)}>Clear highlight</Button>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="marquee" className="mt-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            Pick an uploaded sheet, set its cell size, then click-and-drag over
            cells to grab a multi-tile chunk (a torch sconce, a statue, a doorframe…).
            Saved chunks become <code>multi_tile_prop</code> assets in the library.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={marqueeSheet} onValueChange={(v) => { setMarqueeSheet(v); setMarqueeMode(true); setMarqueeDrag(null); }}>
              <SelectTrigger className="h-9 w-72">
                <SelectValue placeholder={`Pick a sheet (${sheets.length} available)`} />
              </SelectTrigger>
              <SelectContent>
                {sheets.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.meta.sourcePsd ? `${s.meta.sourcePsd} · ` : ''}
                    {s.key.split('/').pop()}
                    {s.meta.width ? ` (${s.meta.width}×${s.meta.height})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <Label className="text-xs">Cell px</Label>
              <Input type="number" className="h-8 w-20" value={marqueeTileSize}
                onChange={(e) => setMarqueeTileSize(parseInt(e.target.value) || 32)} />
            </div>
            {marqueeDrag && sheetRow && (
              <Button size="sm" onClick={saveMarqueeAsProp} disabled={marqueeBusy}>
                {marqueeBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <MousePointerSquareDashed className="w-3 h-3" />}
                {' '}Save selection as prop
              </Button>
            )}
            {marqueeDrag && (
              <Button size="sm" variant="ghost" onClick={() => setMarqueeDrag(null)}>Clear</Button>
            )}
          </div>

          {sheetRow ? (
            <div className="border rounded p-2 bg-muted/20 overflow-auto max-h-[60vh]">
              <div
                className="relative inline-block select-none"
                onMouseDown={onMarqueeDown}
                onMouseMove={onMarqueeMove}
                onMouseLeave={() => { /* keep current marquee */ }}
              >
                <TileThumb
                  src={sheetRow.meta.url}
                  alt="sheet"
                  className="block max-w-none"
                />
                <img
                  ref={marqueeImgRef}
                  src={sheetRow.meta.url}
                  alt=""
                  draggable={false}
                  className="block max-w-none absolute inset-0 opacity-0"
                  style={{ imageRendering: 'pixelated' }}
                />
                {/* Grid overlay */}
                {sheetRow.meta.width && sheetRow.meta.height && (() => {
                  const cols = Math.floor(sheetRow.meta.width / marqueeTileSize);
                  const rows2 = Math.floor(sheetRow.meta.height / marqueeTileSize);
                  return (
                    <div className="absolute inset-0 pointer-events-none">
                      {Array.from({ length: cols + 1 }).map((_, c) => (
                        <div key={`mv${c}`} className="absolute top-0 bottom-0 border-l border-primary/20"
                          style={{ left: c * marqueeTileSize }} />
                      ))}
                      {Array.from({ length: rows2 + 1 }).map((_, r) => (
                        <div key={`mh${r}`} className="absolute left-0 right-0 border-t border-primary/20"
                          style={{ top: r * marqueeTileSize }} />
                      ))}
                      {marqueeDrag && (() => {
                        const x0 = Math.min(marqueeDrag.x0, marqueeDrag.x1);
                        const y0 = Math.min(marqueeDrag.y0, marqueeDrag.y1);
                        const x1 = Math.max(marqueeDrag.x0, marqueeDrag.x1);
                        const y1 = Math.max(marqueeDrag.y0, marqueeDrag.y1);
                        return (
                          <div className="absolute bg-amber-400/30 border-2 border-amber-400"
                            style={{
                              left: x0 * marqueeTileSize,
                              top: y0 * marqueeTileSize,
                              width: (x1 - x0 + 1) * marqueeTileSize,
                              height: (y1 - y0 + 1) * marqueeTileSize,
                            }} />
                        );
                      })()}
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground p-4 border rounded">
              No sheet selected. Mark an upload as a sheet in the Library (Slice button) first.
            </div>
          )}
        </TabsContent>
      </Tabs>
    </Card>
  );
}

// ---------- Main panel ----------

export function TileAssetManager() {
  const { refetch } = useGameDataOverrides('tile_asset');
  const [tab, setTab] = useState('upload');
  const [pendingSheet, setPendingSheet] = useState<{ key: string; url: string } | null>(null);

  const openSheetInSlicer = useCallback((row: TileRow) => {
    setPendingSheet({ key: row.key, url: row.meta.url });
    setTab('slice');
  }, []);

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <ImageIcon className="w-4 h-4" /> Tiles &amp; Premade Assets
        </h3>
        <p className="text-xs text-muted-foreground">
          Upload (incl. PSDs), slice tilesheets, tag autotile variants, scope
          assets to biomes / towers. Files are stored in the public
          <code> game-assets </code> bucket; metadata lives in
          <code> game_data_overrides</code>.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="upload" className="gap-1">
            <FileImage className="w-3 h-3" />Bulk Upload
          </TabsTrigger>
          <TabsTrigger value="slice" className="gap-1">
            <Scissors className="w-3 h-3" />Slice Sheet
          </TabsTrigger>
          <TabsTrigger value="library" className="gap-1">
            <ImageIcon className="w-3 h-3" />Library
          </TabsTrigger>
          <TabsTrigger value="preview" className="gap-1">
            <MousePointerSquareDashed className="w-3 h-3" />Preview
          </TabsTrigger>
          <TabsTrigger value="coverage" className="gap-1">
            <LayoutGrid className="w-3 h-3" />Coverage
          </TabsTrigger>
        </TabsList>
        <TabsContent value="upload" className="mt-3">
          <BulkUploader onDone={refetch} />
        </TabsContent>
        <TabsContent value="slice" className="mt-3">
          <SheetSlicer
            onDone={refetch}
            pendingSheet={pendingSheet}
            clearPendingSheet={() => setPendingSheet(null)}
          />
        </TabsContent>
        <TabsContent value="library" className="mt-3">
          <TileLibrary onOpenSheet={openSheetInSlicer} />
        </TabsContent>
        <TabsContent value="preview" className="mt-3">
          <DungeonPreview onDone={refetch} />
        </TabsContent>
        <TabsContent value="coverage" className="mt-3">
          <CoverageDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
