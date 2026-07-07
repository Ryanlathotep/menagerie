# Herbs + Crafting Overhaul

Two features shipped in one pass, in the order they unblock each other.

---

## Phase 1 — Wild & Farmed Herbs

### 1a. New tile type `plant`
- Add `'plant'` to `OverworldTile.type` union with fields `plantVariant: 'herb'|'flower'|'mushroom'|'root'`, `regrowSteps`, `harvested: boolean`.
- Reuse the exact `rock`/`tree` plumbing:
  - Chunk generation (`overworld.ts`): scatter plants in grass/forest biomes via noise, denser near water and forest clusters.
  - `movePlayer` → `case 'resource'`: on step, drop 1-3 herb materials + rare seeds; toggle `harvested=true`; regrow after N steps like current resource regen.
  - Auto-Harvest: `findClusterTargets` already keys on `tileType`, so `plant` clusters harvest via the same job — no new loop needed.
  - Unified menu: add plant branch (Harvest / Walk & Harvest / Auto-Harvest / Disable Auto).
  - Tile graphics: new `OverworldTileGraphics` case with 4 hand-drawn SVG variants.
  - Tooltip: plant name, variant, drop preview.

### 1b. Herb materials + seeds
- Extend `materials.ts` with herb category: `mint_leaf`, `moon_flower`, `red_cap_mushroom`, `bitterroot`, `starweed`, `emberpetal`, `frost_lily`, plus their `_seed` counterparts.
- Seeds have `plantable: true` metadata for Phase 1c.

### 1c. Farm plot integration
- Existing farm building already accepts `assignedMonsterId` and outputs materials — extend it:
  - Add "Plant seed" dialog when interacting with a farm: pick any seed from inventory.
  - `harvestOutput` picks recipe based on planted seed (higher yield + tier bonus vs wild).
  - Growth speed scales with assigned monster's Earth/Bio affinity.

---

## Phase 2 — Crafting Overhaul (Stations / Recipes / Tiers)

### 2a. Station buildings
Add four new `player_building` sub-types:
| Station | Recipes | Requires |
|--------|---------|----------|
| **Forge** | Metal gear, weapons, ore refinement | 20 stone, 10 wood |
| **Workbench** | Wood/leather gear, traps, utility items | 10 wood |
| **Brewing Stand** | Potions, elixirs, infusions | 5 stone, 5 wood, 3 herb |
| **Enchanting Altar** | Rune scrolls, monster-catch enhancers | 15 stone, 3 mithril, 5 essence |

Existing `CraftingWorkshop` becomes a **portable "any-station"** granted by the Portable Workstation item (unchanged), so single-player crafting still works anywhere.

### 2b. Recipe & tier restructure
- New `recipes.ts` module. Each recipe carries: `station`, `tier` (Common/Uncommon/Rare/Epic/Legendary), `inputs`, `output`, `unlockCondition`.
- Tier gating: T3+ recipes require the station to be **upgraded** (spend materials to upgrade Forge Mk1 → Mk2 → Mk3, etc.). Upgrade unlocks that station's higher-tier recipes.
- Discovery still uses existing "escape dungeon to unlock blueprints" flow (already memory-locked).

### 2c. Potions & Infusions
- Potions are Brewing Stand outputs: heal, cure status, buff stats, elemental resist, XP boost.
- **Infusion**: at any station, you can consume a potion during crafting to add its effect as a passive to the item (e.g. brew Fire Resist → infuse into armor → armor grants +10% fire resist). Infusions consume the potion and cost 1 essence.

### 2d. UI
- Rework `CraftingWorkshop.tsx` into tabbed view: **Forge | Workbench | Brewing | Enchanting**, plus **Dismantle** (kept) and **Infuse** (new).
- Non-portable use: each tab is grayed out unless the player stands adjacent to the matching station OR holds the Portable Workstation.
- Recipe list per tab with tier badges, station-Mk requirement chip, material-cost preview.

---

## Technical notes

- No database schema changes needed. Herbs, seeds, potions, and stations all live in existing `saveData.storedItems`, `run.inventory`, `overworld.playerBuildings`.
- Existing constraints respected: recipes still unlock via dungeon escape, materials remain global, station buildings follow the 10-tile Manhattan build-radius rule.
- `Full overhaul` scope is ~7 file additions and ~5 substantial edits. Estimate: several turns; will land it in this order:
  1. `plant` tile + chunk gen + graphics + auto-harvest (playable herbs).
  2. Herb/seed materials + drop table.
  3. Farm seed-planting dialog.
  4. Station buildings + upgrade tiers.
  5. Recipes module + tier gating.
  6. Brewing + Infusion.
  7. Workshop UI rebuild with tabs and station gating.

---

## What stays the same

- Every existing recipe keeps its inputs — only its **station assignment** and **tier** are added.
- Dismantling, blueprint discovery, materials list, and Portable Workstation flow are untouched.
- Sprite Editor stays forbidden (memory rule).
