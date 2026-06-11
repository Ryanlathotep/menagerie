
## Goals

1. Accept `.psd` files and split each visible layer into its own tile asset.
2. Make sheets first-class: mark/re-slice from Library, and marquee-grab multi-tile props in Preview.
3. Add Blob-47 (Wang 2-edge) sub-roles so autotile variants are taggable.
4. Replace the Roles Guide tab with a **Coverage Dashboard** + tileset (biome/tower) scoping.

## What changes

### 1. PSD support (`ag-psd`)

- Add `ag-psd` dep (~80KB, no native deps).
- In `BulkUploader.handleFiles`, branch on `.psd` extension:
  - Read as ArrayBuffer → `readPsd(buffer, { skipCompositeImageData: true })`.
  - Walk leaf layers; for each visible non-empty layer, render its canvas to PNG blob.
  - Upload as `tiles/raw/<psdName>/<layerPath>.png`; tag `meta.sourcePsd = psdName`, role inferred from layer name via existing `roleFromName`.
- Drop zone hint updated: "PNG / JPG / WebP / SVG / PSD".

### 2. Sheets as first-class

Schema bump: `TileAssetMeta.kind: 'tile' | 'sheet' | 'sliced'` (default `'tile'`; sliced children get `parentSheet` path).

- **Library**: every asset gains a `Scissors` button → "Open in Slicer". It sets `kind='sheet'`, switches to Slicer tab pre-loaded with that asset's image (fetched as blob).
- **Slicer**: when saving regions, mark parent as `kind='sheet'` and children with `parentSheet`. Library hides `sliced` children by default behind a "Show children of N sheets" toggle.
- **Preview tab** gets a **Marquee mode**: pick any `sheet` asset, click+drag across cells in the rendered grid → "Save selection as multi-tile prop". Saves a region crop (canvas → blob) as a new `multi_tile_prop` asset with `spanCols/spanRows`.

### 3. Blob-47 autotile roles

New constant `BLOB47_MASKS` (the 47 valid 8-neighbor reduced masks). Add to schema:

```ts
meta.autotile?: {
  family: string;       // e.g. "stone_wall", "grass_floor" — groups the 47 slots
  mask: number;         // 0..255, must be one of the 47 valid masks
  fallbackOf?: number;  // optional: mask this should stand in for
}
```

- Library row gets an "Autotile…" popover: pick family + click a 3×3 mini-grid to set the mask.
- New helper `src/game/blob47.ts`: exports `BLOB47_MASKS`, `reduceMask(n)`, `maskToCornersLabel(n)`, and `pickBlob47(family, neighborMask)` for the renderer to consume later.

### 4. Coverage Dashboard (replaces Roles Guide)

Replaces the current cheat-sheet tab. Two-level grid:

- Top selector: **Tileset scope** = `Global` | biome (`forest`, `desert`, …) | tower (`Tower of the Infinite`, themed towers from existing registry).
- For each role: count of assets in scope, sample thumbnails (all of them, not just one), and for `wall_autotile` / `floor` the 47-slot Blob coverage grid with red cells where no asset is mapped.
- Click any red cell → opens an inline picker of unassigned tiles to drop into that slot.

Adds `meta.tilesets?: string[]` (assets can belong to multiple). Library gets a "Tilesets" multi-select tag editor; bulk-tag selected rows.

### 5. Misc fixes from feedback

- "Some images aren't loading" — add `onError` fallback that re-signs the public URL and a console warning; show a broken-image badge in the Library cell. (Most likely cause: stale path after manual storage deletes — surface, don't hide.)
- Bulk uploader: also accept files with no `image/*` MIME (PSDs report `image/vnd.adobe.photoshop` only sometimes; accept by extension too).

## Files touched

- `src/admin/TileAssetManager.tsx` — bulk PSD branch, schema, sheet toggle, Library autotile editor + tileset tagger, Preview marquee, Coverage tab replaces RolesGuide.
- `src/game/blob47.ts` — **new**: mask table + helpers.
- `src/game/autoTiling.ts` — re-export Blob-47 helpers; no behavior change yet (renderer wiring is a follow-up).
- `package.json` — add `ag-psd`.

## Out of scope (call out)

- Wiring Blob-47 into actual dungeon rendering — this PR only lets you tag the art. A follow-up will swap `OverworldTileGraphics` / `DungeonRenderer` over.
- Per-biome rendering selection at runtime — schema lands now; renderer pickup later.
