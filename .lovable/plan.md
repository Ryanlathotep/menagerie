# Tile Manager — round 2 of fixes

Addresses 9 distinct asks. Grouped by panel.

## 1. Library — mark/unmark sheets, bulk fix mistakes

- Each row gets a `kind` chip ( `tile` / `sheet` / `sliced` ) that's a clickable toggle. Clicking opens a 3-button popover: **Tile**, **Sheet** (also clears any auto-assigned `role`/`autotile` so it stops rendering as a tile), **Sliced child**.
- Add row checkboxes + sticky bulk-action bar: **Delete**, **Set kind → …**, **Set role → …**, **Add to tileset → …**, **Clear autotile**, **Clear role**. Solves "quick way to remove things improperly assigned."
- "Hide sliced children" toggle stays; add "Show only sheets" / "Show only unassigned" quick filters.

## 2. Tileset scoping (so things don't all dump into Global)

- Bulk-upload form gains a **Default Tileset** dropdown (Global, biomes from `worldGenConfig`, towers from `itemWorldTowers`, plus a free-text "+ new tileset"). Every uploaded asset (and every PSD layer) inherits it.
- Top of Library: a "Default tileset for new uploads" persists in `localStorage` so the next session keeps your dungeon-default.
- Per-row tileset chip is editable inline (multi-select); bulk-tag from the action bar.
- Coverage Dashboard already filters by scope — now its scope selector also drives Library filtering when you pick it there (single source of truth via URL `?scope=` param).

## 3. Preview — right-click menu on tiles, more roles in sample room, swappable cells

- Sample room expanded from current handful to a curated layout that exercises every role we render: floor, wall + wall_autotile (with all 8 neighbors so Blob-47 picks fire), door (open/closed), stairs up + down, chest, trap, switch, water edge, lava edge, decoration, multi_tile_prop (2×2 + 2×1), pit, bridge, rubble.
- Each cell in the sample room is right-clickable → context menu: **Change tile…** (picker filtered to that role + current tileset), **Clear**, **Pin asset to this slot**, **Copy slot config**, **Open asset in Library**.
- Left rail in Preview lists every role used by the sample room with the current asset's thumb; click to cycle, or drag-drop an asset from a side drawer onto the role.
- Animation: if an asset has `meta.frames` (list of sibling asset paths) or is a sheet with `meta.animation = { cols, fps }`, render via `<TileAnim>` that cycles frames at the configured fps. Adds a global "Animate previews" toggle (default on).

## 4. Marquee zoom

- Preview tab gets a zoom slider (25% – 400%, default 100%) and Ctrl+wheel zoom on the canvas. Marquee math switches to use the on-screen px → source px ratio so selections stay accurate at any zoom. Pan with middle-mouse / space-drag when zoomed in.

## 5. Slicer — sliders with live preview

- Replace the tileWidth / tileHeight / marginX / marginY / spacingX / spacingY number inputs with `<Slider>` components (range 4–256 for tile size, 0–64 for margin/spacing).
- The slice grid overlay updates in real time on every slider tick (already re-renders, just wire to slider state).
- Add a numeric input next to each slider for keyboard precision, plus an "Auto-detect grid" button that we already have.
- Persist the last-used slicer config per sheet in `meta.sliceConfig` so reopening it restores.

## 6. Rename to standard structure

- New "Rename to convention" action (per-row + bulk). Pattern:
  `{tileset}__{role}__{family-or-variant}__{maskLabel-or-index}.{ext}`
  e.g. `dungeon-default__wall_autotile__stone_wall__N-E-S.png`.
- Implementation: copies object to new path in Storage, updates the `game_data_overrides` row's `data_key`, deletes the old object. Shows a dry-run diff modal first so nothing renames blindly.
- Bulk version processes selection sequentially with a progress toast.

## 7. Animation viewer

- New `<TileAnim>` component used in Library thumbs, Preview sample room, and Coverage dashboard. Renders single frame if asset has none, otherwise loops `meta.frames` / sheet strip.
- Library row gets an "Animate…" popover to: pick sibling frames (multi-select from same folder), set fps, preview, save.

## 8. Misc

- Right-click on Library thumbs uses the same menu structure as the Preview cell menu, so the workflow matches.
- `kind === 'sheet'` assets are excluded from `tilesByRole` lookups everywhere (renderer, sample room, coverage) — fixes "sheets being treated as tiles."

## Files touched

- `src/admin/TileAssetManager.tsx` — bulk action bar, kind chip, tileset selectors, slider-based slicer, expanded sample room, right-click menus, zoomable marquee, rename modal.
- `src/admin/TileAnim.tsx` — **new**, shared animated thumbnail.
- `src/admin/tileRename.ts` — **new**, path-building + storage move helper.
- `src/game/blob47.ts` — no change (already exports what we need).

## Out of scope

- Hooking animated tiles into the actual dungeon renderer at runtime — this PR only previews them in the admin tool.
- A drag-to-reorder frame editor (frames are picked by checkbox for now).
