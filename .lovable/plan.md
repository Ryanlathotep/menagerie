
## Goal

Make the crafting system feel like one thing. Legacy fixed recipes become grid blueprints, players can invent variants at their station, dismantling teaches a recipe, and finished recipes are tradeable Recipe Scroll items.

## 1. Convert legacy `CRAFTING_RECIPES` into grid blueprints

- Add a one-time converter in `src/game/crafting/patterns.ts` that walks the existing `CRAFTING_RECIPES` list and, for each entry:
  - Picks a grid size from the material count (≤9 cells → 3×3, ≤16 → 4×4, else 5×5).
  - Assigns each required material to a `PatternSlot` with a `role` inferred from its `MaterialType` (metal → `blade`/`guard`, wood → `handle`, cloth/leather → `binder`, essence/gem → `catalyst`, herb → `base`, paper/wax → `seal`).
  - Uses the recipe's `resultSlot` + `resultRarity` to synthesize `baseStats` (reuse the existing equipment stat tables).
- Register the converted blueprints in the `ITEM_BLUEPRINTS` registry so the grid resolver can produce them.
- Keep `CRAFTING_RECIPES` around as a data source for the converter and for the admin editor, but route all actual crafting through the grid system.

## 2. Fictitious inventors for legacy recipes

- Add `src/game/crafting/legacyInventors.ts` — a short list of flavor names ("Old Gwen the Smith", "Brother Ilias", "Meadowfoot the Herbalist", …), one per material category.
- When the converter emits a blueprint, seed a corresponding row in `crafting_recipes_discovered` (via a migration/insert) with `discovered_by_username` set to the flavor name and a stable synthetic hash — so their station snapshot (empty) exists and the "Invented by" line on tooltips is populated for these baseline items too.

## 3. Player-owned recipe book & Recipe Scroll item

- Extend the local recipe book (`recipeBook.ts`) with an `owned: boolean` flag. Discovering a recipe = owned. Buying/using a Recipe Scroll = owned. Others still show in the cloud list but are locked.
- Add a new equipment/consumable type `recipe_scroll` in `equipment.ts`:
  - Carries the recipe `hash` it teaches.
  - "Use" action: marks that recipe `owned` in the local book, consumes the scroll.
- Add a "Sell as Recipe Scroll" button in the recipe-book UI (Crafting Workshop, next to each owned recipe). Cost = fixed gold + one blank scroll material; produces a `recipe_scroll` item in inventory that can be sold in the shop or dropped.
- Shop stock rotation: occasionally offer Recipe Scrolls the player doesn't own (uses existing `crafting_recipes_discovered` pool).

## 4. In-game Recipe Designer (light)

No new UI screen — reuse `CraftingGrid.tsx`. When the player crafts at a station and the resulting grid is *not* a match for any existing blueprint but *is* a superset of one (extra fillers on top of a known pattern), the resolver already produces a distinct hash. That new hash gets auto-saved to their local book as a personal variant, credited to the player. This is effectively "designing a recipe" and matches the user's spec ("add materials to the grid and craft the item → adds it to their recipes").

Admin-only base-recipe creation stays in `RecipesEditor` (as today).

## 5. Live stat propagation from admin material-effect edits

Already true structurally: crafted items store `usedMaterials` and re-resolve stats via `getEffectiveMaterialEffect` on read. Confirm by:
- Making `EquipmentIcon` tooltip call `resolveGrid` (or a cached equivalent) instead of the frozen stat snapshot when the item has a `hash` + `grid` in metadata.
- Adding the missing `grid` payload on new crafts so re-resolution is possible (a couple of fields on the equipment record).

Result: when an admin bumps "Iron Ingot: +2 damage → +3 damage" in `material_effects` overrides, every player's iron sword recalculates on next tooltip open.

## 6. Fix dismantle → recipe

In `CraftingWorkshop.tsx` dismantle path, if the item carries a `hash` + `grid` (grid-crafted or legacy-converted), call `recordDiscovery(...)` for that hash before returning materials. If the item is pre-conversion legacy with no grid, look up its blueprint id, resolve a canonical grid from the pattern, and record that.

## 7. Icon glyph picker

- New tiny component `src/game/crafting/GlyphPicker.tsx` — grid of emoji/glyphs grouped by category (weapon, armor, potion, scroll, ring, tool). Filterable.
- Shown once when a player first crafts a new hash. Selected glyph stored on the local book entry and displayed everywhere the item icon renders.
- No AI image gen — cheaper, matches parchment aesthetic, per your pick.

## Technical notes

- **DB migration**: add `owned_by_seller boolean` and `taught_recipe_hash text` columns to `crafting_recipes_discovered`? No — cleaner to put the "scroll teaches hash X" data on the equipment item itself. Only migration needed is seeding fictitious-inventor rows (optional; can also live entirely client-side).
- **Types**: extend `DiscoveredRecipe` with `owned?: boolean` and `iconGlyph?: string`. Extend `EquipmentItem` union with `kind: 'recipe_scroll'`.
- **Files touched**:
  - `src/game/crafting/patterns.ts` (converter + registration)
  - `src/game/crafting/legacyInventors.ts` (new)
  - `src/game/crafting/recipeBook.ts` (owned flag, glyph)
  - `src/game/crafting/types.ts` (2 field additions)
  - `src/game/equipment.ts` (recipe_scroll item kind)
  - `src/game/CraftingWorkshop.tsx` (dismantle → recordDiscovery, sell-as-scroll button, glyph picker hook-in)
  - `src/game/CraftingGrid.tsx` (surface "new personal variant saved" toast)
  - `src/game/EquipmentIcon.tsx` (live stat re-resolve when grid present)
  - `src/game/ShopView.tsx` (rotate in Recipe Scroll stock)
  - New: `src/game/crafting/GlyphPicker.tsx`

## Out of scope (explicit)

- Removing `CRAFTING_RECIPES` entirely — it stays as the seed data source and admin editing surface.
- AI-generated icons — deferred; glyph picker is the shipped path.
- Cross-player recipe trading over the network — Recipe Scrolls travel through the existing shop, not player-to-player.

## Rollout order

1. Types + converter + registration (nothing user-visible yet).
2. Dismantle → recordDiscovery + fictitious inventors seeded client-side.
3. Live stat re-resolution in tooltips.
4. Glyph picker.
5. Recipe Scroll item + shop rotation + sell-as-scroll UI.

Each step is independently shippable so we can stop early if you don't like where it's going.
