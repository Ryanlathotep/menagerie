# Unified Tile Menu — Coverage Audit & Fixes

## What I verified

Trigger paths are correct on both surfaces:
- `DungeonRenderer.onTileRightClick` (right-click + 300ms long-press) → `setDungeonTileMenu({x,y})` → `<UnifiedTileMenu>` in `src/pages/Index.tsx`.
- `OverworldRenderer.onTileRightClick` (right-click + long-press) → `handleTileRightClick` → `setUnifiedMenu({x,y})` → `<UnifiedTileMenu>` in `src/game/OverworldView.tsx`.

Both surfaces use the same `UnifiedTileMenu` shell, so desktop / tablet / mobile parity is already met (per the Core memory rule).

### Tile-type coverage I confirmed

| Surface | Type | Handled |
|---|---|---|
| Dungeon | floor, wall, mineable_wall, door, stairs, stairs_up, trap, treasure, enemy, shop, terrain, plant, elevator, nest, player-built structure | yes |
| Overworld | grass, tree, rock, water, dirt_road, stone_road, cliff, waterfall, dungeon_entrance, player_building, enemy, nest | yes |

Universal actions appended for any explored tile: walk-here (A*), attack-from-here (if a visible target is in range), build-here (on buildable ground), drop/rename/remove waypoint. Self tile is recognized ("📍 Your tile") on dungeon side.

## Gaps to fix

1. **Overworld `building` tile (campfire / log cabin / town hall hub) is missing.**
   `OverworldTileType` includes `'building'` and `overworld.ts` seeds the hub as one. The unified switch has no case for it, so right-click on the hub shows only the generic `Tile (building)` title + the universal block. The expected actions ("Use buildings… assign / upgrade / disassemble", "Enter shop") are not surfaced.
   - Add a `tile.type === 'building'` branch in `OverworldView.tsx` unified menu.
   - Action `Open hub` → `setShowBuildingMenu(true)` (same modal that walking onto it opens).
   - Show name/tier in title via the existing hub metadata.

2. **No "Self" actions on the player tile (both surfaces).**
   Project knowledge: *"On Self choose actions that buff self or movement actions."*
   - When `dist === 0`, append:
     - "Use consumable…" → opens existing inventory consumable picker (already wired via Inventory panel; expose a callback).
     - For every non-damaging move with `target === 'self'` the active monster knows, add a one-tap "Cast {move}" action.

3. **No "Use consumable on this tile" on enemy / empty tile.**
   Same project rule: *"use consumables that can target it"*. Add a single `Use item here…` action that opens the inventory filtered to items whose target zone includes this tile (potions on self tile, throwables on enemy tile). Low risk: gate behind `state.run` having any usable consumables.

4. **Dungeon `door` tile lacks an explicit "Open door / step through" action when adjacent.**
   Currently it only displays "Walk through it" info and relies on the universal `move` row. Add a default-variant action for clarity.

5. **Minor polish.** Inline the two most common sub-flows (`BuildingContextMenu` assign-or-disassemble; `EnemyAttackMenu` move picker) remain as secondary modals — that is intentional and acceptable because they are themselves identical across platforms, so the Core "menus identical desktop/tablet/mobile" rule is upheld. No change.

## Files to edit

- `src/game/OverworldView.tsx` — add `building` case; add self / consumable actions in the universal block.
- `src/pages/Index.tsx` — add explicit door action; add self / consumable actions in the universal block.

## Out of scope

- Visual refactor of `UnifiedTileMenu.tsx` shell.
- Removing `BuildingContextMenu` / `EnemyAttackMenu` (they remain as sub-pickers).
- Particle / asset-library work from prior turns.

## Manual QA after build

1. Right-click the campfire/hub in the overworld → "Open hub" appears and works.
2. Right-click your own tile in a dungeon → self-target moves appear if known; consumable picker opens.
3. Long-press the same tiles on mobile viewport (440 wide) → identical menu content.
4. Right-click a dungeon door while adjacent → explicit "Open door" action steps through.
