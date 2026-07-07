// Central admin Asset Library.
//
// Lets admins upload hand-drawn replacement images for any layered game
// asset (monster species shape, element fill, class pattern, equipment
// icon / on-monster overlay). Files live in the public `game-assets`
// Storage bucket. The URL is mirrored into `game_data_overrides` rows of
// data_type='asset_image' so the runtime registry (assetOverrides.ts)
// can hydrate it on boot without re-listing the bucket.

import { useMemo, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Upload, Trash2, Search, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useGameDataOverrides } from '@/hooks/useGameDataOverrides';
import {
  setSingleAssetOverride,
  type AssetCategory,
} from '@/game/assetOverrides';
import { SPECIES_DATA, ELEMENT_COLORS, CLASS_STATS } from '@/game/types';
import { listEquipmentIconKeys, getEquipmentIcon } from '@/game/equipmentUtils';
import { MonsterSprite } from '@/game/sprites';
import { BUILDING_DEFINITIONS, type PlayerBuildingType } from '@/game/buildings';
import { OverworldBuildingTileGraphic } from '@/game/OverworldBuildingTileGraphics';


interface AssetSlot {
  category: AssetCategory;
  key: string;
  label: string;
}

const BUCKET = 'game-assets';

function buildSlots(): Record<string, AssetSlot[]> {
  const species: AssetSlot[] = Object.entries(SPECIES_DATA).map(([k, v]) => ({
    category: 'species',
    key: k,
    label: v.name,
  }));
  const elements: AssetSlot[] = Object.keys(ELEMENT_COLORS).map((k) => ({
    category: 'element',
    key: k,
    label: k.charAt(0).toUpperCase() + k.slice(1),
  }));
  const classes: AssetSlot[] = Object.keys(CLASS_STATS).map((k) => ({
    category: 'class',
    key: k,
    label: k.charAt(0).toUpperCase() + k.slice(1),
  }));
  const equipment: AssetSlot[] = listEquipmentIconKeys().map((k) => ({
    category: 'equipment',
    key: k,
    label: k,
  }));
  const buildings: AssetSlot[] = (Object.keys(BUILDING_DEFINITIONS) as PlayerBuildingType[])
    // Walls use auto-tiling; a single static image would break the seams.
    .filter((k) => k !== 'wall')
    .map((k) => ({
      category: 'building',
      key: k,
      label: `${BUILDING_DEFINITIONS[k].emoji} ${BUILDING_DEFINITIONS[k].name}`,
    }));
  return { species, elements, classes, equipment, buildings };
}


function safePath(category: AssetCategory, key: string, ext: string): string {
  const safeKey = key.replace(/[^a-zA-Z0-9._-]+/g, '_');
  return `${category}/${safeKey}.${ext}`;
}

function fileExt(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName && /^(png|jpg|jpeg|webp|gif|svg)$/.test(fromName)) return fromName;
  if (file.type === 'image/svg+xml') return 'svg';
  if (file.type === 'image/webp') return 'webp';
  if (file.type === 'image/jpeg') return 'jpg';
  return 'png';
}

interface SlotRowProps {
  slot: AssetSlot;
  currentUrl: string | undefined;
  onUploaded: (url: string, path: string) => void;
  onRemoved: () => void;
}

function SlotRow({ slot, currentUrl, onUploaded, onRemoved }: SlotRowProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File) => {
    setBusy(true);
    try {
      const path = safePath(slot.category, slot.key, fileExt(file));
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type || undefined });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      // Cache-bust so admins see the new image immediately.
      const url = `${data.publicUrl}?v=${Date.now()}`;
      onUploaded(url, path);
      toast.success(`Uploaded ${slot.label}`);
    } catch (err) {
      console.error(err);
      toast.error(`Upload failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-3 flex items-center gap-3">
      <div className="w-16 h-16 shrink-0 rounded border bg-muted/30 flex items-center justify-center overflow-hidden">
        {slot.category === 'species' || slot.category === 'element' || slot.category === 'class' ? (
          <MonsterSprite
            species={slot.category === 'species' ? (slot.key as never) : 'slime'}
            element={slot.category === 'element' ? (slot.key as never) : 'normal'}
            classType={slot.category === 'class' ? (slot.key as never) : 'normal'}
            size={56}
            animated={false}
          />
        ) : currentUrl ? (
          <img src={currentUrl} alt={slot.label} className="w-full h-full object-contain" />
        ) : slot.category === 'building' ? (
          <OverworldBuildingTileGraphic type={slot.key as PlayerBuildingType} size={56} seed={1} />
        ) : slot.category === 'equipment' ? (
          (() => {
            const def = getEquipmentIcon(slot.key);
            return (
              <svg width={56} height={56} viewBox={def.viewBox}>
                <circle cx="50" cy="50" r="48" fill="hsl(var(--muted) / 0.3)" stroke="hsl(var(--border))" strokeWidth="1" />
                <path
                  d={def.path}
                  fill="hsl(var(--foreground) / 0.7)"
                  stroke="hsl(var(--foreground) / 0.9)"
                  strokeWidth={def.strokeWidth || 1.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </svg>
            );
          })()
        ) : (
          <ImageIcon className="w-6 h-6 text-muted-foreground" />
        )}

      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{slot.label}</div>
        <div className="text-xs text-muted-foreground truncate">
          {currentUrl ? 'Image uploaded' : 'No image (using default art)'}
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = '';
        }}
      />
      <Button size="sm" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
        <Upload className="w-3.5 h-3.5 mr-1" />
        {currentUrl ? 'Replace' : 'Upload'}
      </Button>
      {currentUrl && (
        <Button size="sm" variant="ghost" disabled={busy} onClick={onRemoved}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      )}
    </Card>
  );
}

interface AssetLibraryProps {
  initialTab?: 'species' | 'elements' | 'classes' | 'equipment' | 'buildings';
}


export function AssetLibrary({ initialTab = 'species' }: AssetLibraryProps) {
  const { overrides, saveOverride, deleteOverride, loading, refetch } =
    useGameDataOverrides('asset_image');
  const [tab, setTab] = useState<string>(initialTab);
  const [search, setSearch] = useState('');

  const slots = useMemo(() => buildSlots(), []);

  const urlFor = (cat: AssetCategory, key: string): string | undefined => {
    const row = overrides.find((o) => o.data_key === `${cat}:${key}`);
    const url = (row?.data_value as { url?: unknown } | undefined)?.url;
    return typeof url === 'string' ? url : undefined;
  };

  const handleUpload = async (slot: AssetSlot, url: string, path: string) => {
    const key = `${slot.category}:${slot.key}`;
    const ok = await saveOverride('asset_image', key, { url, path });
    if (ok) {
      setSingleAssetOverride(slot.category, slot.key, url);
      refetch();
    }
  };

  const handleRemove = async (slot: AssetSlot) => {
    const key = `${slot.category}:${slot.key}`;
    const existingRow = overrides.find((o) => o.data_key === key);
    const existingPath = (existingRow?.data_value as { path?: unknown } | undefined)?.path;
    if (typeof existingPath === 'string' && existingPath.length > 0) {
      await supabase.storage.from(BUCKET).remove([existingPath]).catch(() => undefined);
    }
    const ok = await deleteOverride('asset_image', key);
    if (ok) {
      setSingleAssetOverride(slot.category, slot.key, null);
      refetch();
    }
  };

  const renderList = (list: AssetSlot[]) => {
    const filtered = search
      ? list.filter((s) => s.label.toLowerCase().includes(search.toLowerCase()))
      : list;
    return (
      <ScrollArea className="h-[60vh]">
        <div className="space-y-2 p-1">
          {filtered.map((slot) => (
            <SlotRow
              key={`${slot.category}:${slot.key}`}
              slot={slot}
              currentUrl={urlFor(slot.category, slot.key)}
              onUploaded={(url, path) => handleUpload(slot, url, path)}
              onRemoved={() => handleRemove(slot)}
            />
          ))}
          {filtered.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">
              No matches.
            </div>
          )}
        </div>
      </ScrollArea>
    );
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <ImageIcon className="w-4 h-4" /> Asset Library
        </h3>
        <p className="text-xs text-muted-foreground">
          Upload hand-drawn replacement images. Each layer composes independently:
          <strong> Species</strong> (shape) · <strong>Element</strong> (fill) ·{' '}
          <strong>Class</strong> (pattern) · <strong>Equipment</strong> (icons + worn overlays).
          PNG, JPG, WebP, or SVG. Square images (e.g. 512×512) work best.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Search className="w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search this category…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        {loading && <span className="text-xs text-muted-foreground">Loading…</span>}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="species">Species ({slots.species.length})</TabsTrigger>
          <TabsTrigger value="elements">Elements ({slots.elements.length})</TabsTrigger>
          <TabsTrigger value="classes">Classes ({slots.classes.length})</TabsTrigger>
          <TabsTrigger value="equipment">Equipment ({slots.equipment.length})</TabsTrigger>
          <TabsTrigger value="buildings">Buildings ({slots.buildings.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="species">{renderList(slots.species)}</TabsContent>
        <TabsContent value="elements">{renderList(slots.elements)}</TabsContent>
        <TabsContent value="classes">{renderList(slots.classes)}</TabsContent>
        <TabsContent value="equipment">{renderList(slots.equipment)}</TabsContent>
        <TabsContent value="buildings">{renderList(slots.buildings)}</TabsContent>
      </Tabs>

    </div>
  );
}
