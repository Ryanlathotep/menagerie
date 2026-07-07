# Tiered Crafting Stations & Layered Item Stats

Big-scope change; putting the moving pieces in one place before touching code so we don't wire it half-way and regress persistence again.

## 1. Station tiers (per crafting discipline)

Each discipline (Forge / Workbench / Brewing / Enchanting) gets 5 tiers matching rarity colors. Higher tiers = larger grid + more modifier slots.

| Tier | Rarity | Grid | Modifier slots | Cost scaling |
|------|--------|------|----------------|--------------|
| I    | common     | 3×3 | 0 | base |
| II   | uncommon   | 3×3 | 1 | 2× |
| III  | rare       | 4×4 | 2 | 4× |
| IV   | epic       | 4×4 | 3 | 8× |
| V    | legendary  | 5×5 | 4 | 16× |

Stored on the building itself:
```ts
// in PlayerBuilding
stationTier?: 1|2|3|4|5;
stationModifiers?: { materialId: string; quantity: number }[];
```

## 2. Portable stations

Each station has a portable tool version (already exist as `PORTABLE_STATIONS`) that is now craftable **inside** its parent building's grid, using a new blueprint per station kind (`portable_forge`, `portable_workbench`, etc.). Portable stations carry their own frozen tier + modifiers snapshot from the workshop that crafted them — cannot be re-modified without recrafting.

## 3. Grid scaling

`CraftingGridPanel` accepts `gridSize` already. Callers now pass the station's grid size:
- Building context: from `building.stationTier` → tier→grid map.
- Portable context: from the portable item's `stationTier`.
- Menu (no station): 3×3, tier 1.

Blueprint `minGrid` is already respected — if a recipe requires 4×4 and the station is 3×3, we now surface that as "Needs Tier III+ station."

## 4. Station modifier slots (separate stat lane)

Above the crafting grid we show N modifier chips (N = tier's modifier slots). Player drops any crafting material in; each contributes stats via `getEffectiveMaterialEffect` but tagged as `stationStats`, kept **separate** from the item's material stats.

Result on any crafted item:

```ts
interface EquipmentItem {
  // existing:
  stats: EquipmentStats;         // baseStats + material fillers
  // new:
  stationStats?: EquipmentStats; // from crafter's station modifiers
  runStats?: EquipmentStats;     // stats added later by dungeon events (empty for now, wired for future)
  provenance?: {
    stationKind: CraftingStationKind | null;
    stationTier: 1|2|3|4|5;
    stationModifiers: { materialId: string; quantity: number }[];
    inventor?: { username: string; stationStats: EquipmentStats; stationTier: number };
    craftedBy?: string;          // username
    worldSeed?: string | null;
  };
}
```

The tooltip/preview shows three separate sections: **Base Stats**, **Station Bonus**, **Dungeon Bonus**.

## 5. Recipe inventor persistence

`crafting_recipes_discovered` gets three new columns:
- `inventor_station_kind text`
- `inventor_station_tier int`
- `inventor_station_stats jsonb`

When any player later crafts the same recipe hash, `recordDiscovery`/`resolveGrid` looks up the recipe's inventor row and adds the inventor's frozen `stationStats` into `provenance.inventor.stationStats`. The current crafter's own station also adds its `stationStats`. Both stack, both shown separately.

Migration also adds a helper RPC `get_recipe_inventor(_hash)` returning the frozen stats.

## 6. Seed info hook (dungeon effects later)

`provenance` is included in the deterministic hash used by Item World / dungeon-seed features so a "Forge of Volcanic Ash"-crafted sword generates a different themed dungeon than a plain one. We expose:

```ts
// src/game/crafting/seed.ts
export function craftSeedHash(item: EquipmentItem): number;
```

This is called by `itemWorldTowers.ts` next time we touch dungeon gen — the field is wired in now so the future work is drop-in.

## 7. Name reflects materials

`buildCraftName` already uses primary+filler materials but drops rarity prefixes early. Reworking to always include the primary material word first and append the filler even if same-type, e.g. *"Iron Sword of Oak"*. Also adds station-tier prefix for T3+ (*"Masterwork Iron Sword of Oak"*).

## 8. Where players configure it

- Player building tooltip / right-click menu → new **"Configure Station"** action. Opens a small modal showing tier (upgradeable with materials) + modifier slot grid. Can be changed anytime.
- Portable station tool → shows tier + baked-in modifiers, read-only. To change, dismantle and craft new.

## 9. Data / files touched

**New files**
- `src/game/crafting/stationTiers.ts` — tier table, upgrade costs, tier→grid map, tier→slotCount map.
- `src/game/crafting/stationEffects.ts` — resolve modifier stats + inventor stats.
- `src/game/crafting/seed.ts` — craftSeedHash helper.
- `src/game/StationConfigModal.tsx` — tier + modifier UI.
- `supabase/migrations/<ts>_recipe_inventor_stats.sql` — new columns + RPC + GRANTs.

**Edited**
- `src/game/crafting/types.ts` — `stationStats`, `runStats`, `provenance`.
- `src/game/crafting/grid.ts` — `resolveGrid` returns `stationStats` when passed a station context; enforces `minGrid` against station grid.
- `src/game/crafting/naming.ts` — name always includes primary material + filler + tier prefix.
- `src/game/crafting/patterns.ts` — new portable-station blueprints (one per kind).
- `src/game/crafting/recipeBook.ts` — read/write inventor station snapshot; `recordDiscovery` accepts stationKind/tier/stats.
- `src/game/buildings.ts` — `stationTier`, `stationModifiers` fields.
- `src/game/CraftingGrid.tsx` — modifier chip row, station tier/kind props, three-section preview, minGrid enforcement.
- `src/game/CraftingWorkshop.tsx` — thread station props through when opened from building vs menu vs portable.
- `src/game/BuildingContextMenu.tsx` — add "Configure Station" option.
- `src/game/OverworldView.tsx` — open StationConfigModal; pass station tier when opening workshop from a building.
- `src/admin/CraftGridEditor.tsx` — expose tier requirements per blueprint.

## 10. Rollout order

1. Types + tier tables + naming update.
2. `resolveGrid` station-context extension + provenance.
3. DB migration for inventor stats.
4. `recordDiscovery` + `lookupDiscovery` write/read inventor snapshot.
5. UI: modifier chips + 3-section preview.
6. Station config modal + building menu wiring.
7. Portable-station blueprints + freeze snapshot on craft.
8. Admin editor tier badge.
9. `craftSeedHash` helper (unused until dungeon side wired).

No changes to existing persistence — all new fields are optional, so existing saves and recipes keep working.

## Open call I'm making (say the word if wrong)

- Upgrade **cost per tier**: I'll use `10 × tier²` of a themed material (e.g. Forge = Iron→Steel→Mythril→Adamant→Draconic ingots) plus stone/wood scaling. Reasonable but arbitrary — tell me if you want it cheaper/steeper.
- Modifier chip stat weight: `getEffectiveMaterialEffect` × 2 so a station modifier "feels" bigger than a single grid filler cell. Adjustable.
- Portable-station blueprints all sit at `minGrid: 3` so any tier can craft them — the tier of the *result* mirrors the tier of the station that crafted them.
