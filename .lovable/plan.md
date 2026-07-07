# Grid-Based Crafting Overhaul

Transform crafting from fixed recipes into a Minecraft-style grid where a small **required pattern** determines the item type, and **filler materials** in remaining slots grant additional stats. The same grid always yields the same item; first-time crafting or dismantling adds the recipe to your book and credits the discoverer server-wide.

## Player-Facing Behavior

- **Grid crafting UI** at each station. Grid size scales with station tier:
  - Portable / T1 station: 3x3
  - T2 (Workbench, Forge, etc.): 4x4
  - T3 (upgraded stations, future): 5x5
- **Required pattern**: each item type (dagger, sword, potion, scroll, armor piece…) defines a minimum shape of specific materials (e.g. Dagger = 1 blade material stacked on 1 handle material). Placing this pattern anywhere valid in the grid produces the base item.
- **Fillers**: every extra material in unfilled slots applies its per-slot-category effect (e.g. extra Iron on a bladed weapon → +min damage, Gold Ore → +starting level, Ember Herb on a potion → +fire duration). Effects stack.
- **Deterministic naming**: item name is generated from the dominant blade + handle + top filler (e.g. "Iron Dagger of Gilded Embers"). Same grid = same name + stats every time (hash-keyed).
- **Recipe book**: first successful craft OR dismantle records the grid layout under the resulting item; later you can one-click re-craft or convert to a **Recipe Scroll** item to trade/gift.
- **Discovery credit**: the first player on the server to produce a given recipe hash is stored as its `discovered_by` (username). Displayed on the recipe card and scrolls: *"Invented by <username>"*.
- **Pixel preview**: the grid renders a small pixel-art silhouette of the resulting item, assembled from per-material sprites layered by slot role (blade, handle, guard, gem, etc.), similar to Minecraft's crafting preview.

## Data Model

### New: `src/game/crafting/`
- `types.ts` — `CraftGrid`, `RecipePattern`, `MaterialEffect`, `ItemBlueprint`, `DiscoveredRecipe`.
- `patterns.ts` — required patterns per item blueprint (dagger, sword, axe, bow, staff, helm, chest, potion, scroll, ring, …). Each pattern: `{ slots: Array<{ dx, dy, role: 'blade'|'handle'|'guard'|'base'|'catalyst'|'binder', tag: MaterialTag }> }`.
- `materialEffects.ts` — per-material, per-item-category effect map:
  `{ materialId, appliesTo: ItemCategory[], perUnit: StatDelta }`. Editable via admin.
- `grid.ts` — pure functions: `hashGrid(grid)`, `matchPattern(grid)`, `resolveItem(grid) -> { blueprintId, stats, name, previewLayers }`.
- `recipeBook.ts` — local + cloud persistence of discovered recipes (keyed by hash).

### DB migrations (Lovable Cloud)
- `crafting_recipes_discovered` — `hash text PK, blueprint_id text, grid_json jsonb, item_name text, discovered_by uuid references profiles, discovered_at timestamptz, world_seed text`.
  - RLS: anyone authenticated can SELECT; INSERT only if hash not present (unique constraint handles race).
  - GRANTs: `SELECT, INSERT` to `authenticated`; `SELECT` to `anon` (leaderboard-style read); `ALL` to `service_role`.
- Extend `game_data_overrides` `data_type` union with `'craft_pattern'` and `'material_effect'`.

## Admin Editors

Two new tabs in `AdminPanel.tsx`:
1. **Craft Patterns** — pick an item blueprint, edit its required-slot grid (drag material tags onto cells, mark role). Persists as `craft_pattern` override.
2. **Material Effects** — matrix editor: rows = materials, columns = item categories, cell = stat delta per extra unit (min damage, max damage, starting level, durability, elemental damage, cast speed, potion duration, etc.). Persists as `material_effect` override.

Both reuse `useGameDataOverrides` + `CopyFromPicker` patterns already in `src/admin/`.

## UI

- Replace `CraftingWorkshop.tsx` main flow with `<CraftingGrid>` (drag-materials-from-inventory-onto-cells) + live-updating right panel showing:
  - Resolved item name, stats, pixel preview.
  - "Discovered by" line if hash already known.
  - Craft button (disabled until required pattern satisfied).
- `RecipeBookPanel` — searchable list of discovered recipes, click to auto-fill grid; button to burn materials into a `Recipe Scroll`.

## Migration & Compatibility

- Legacy `CRAFTING_RECIPES` in `equipment.ts` become **seed patterns** for the new system (auto-generated blueprints so nothing breaks); existing `RecipesEditor` remains for old-style recipes but a banner points to the new Patterns editor.
- Existing blueprints in save data untouched.

## Rollout (implementation order)

1. Types, pattern/grid pure logic + unit tests.
2. Material effects registry with sensible defaults for current materials.
3. `CraftingGrid` UI + pixel preview renderer.
4. Recipe book (local first, then cloud sync + discoverer credit table).
5. Admin editors (Patterns, Material Effects).
6. Station-tier grid sizing + wire into portable/station gating.
7. Smoke test invariants + typecheck.

## Open Questions

1. Should Recipe Scrolls be single-use teach-a-recipe items, or infinite-use one-click crafters?
2. For pixel previews, do you want me to author placeholder sprite layers per material role now, or ship with emoji stand-ins and let you upload real sprites via the Admin Asset Library later (mirroring the building placeholder flow)?
3. Discovery credit: server-wide (all players share one leaderboard) or per-world-seed (each seed has its own inventors)?
