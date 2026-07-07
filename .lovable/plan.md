# Universal Auto Actions + Craftable Portal Stairs

Three linked changes: (1) surface Auto-Hunt/Auto-Search everywhere, (2) delete orphan up-stairs on floor load, (3) introduce craftable stairs whose destination is derived from tile coordinates, with tooltip previews, free-space validation, and an "always one entrance" guard.

## 1 · Auto-Hunt & Auto-Search in the dungeon menu

The overworld tile menu already surfaces both (`OverworldView.tsx` ~L3401). The dungeon tile menu (`DungeonView.tsx` ~L3830) does not. Add them at the bottom of the dungeon action list so they show on every tile, matching overworld parity:

- **Auto-Hunt** — walks toward the nearest visible enemy in the current floor and opens the attack picker on arrival (dungeon equivalent of the overworld routine).
- **Auto-Search** — opens a picker (stairs down, stairs up, treasure, shop, elevator, plant, mineable wall, nest) and auto-paths to the nearest explored match.

New helper `src/game/dungeon/autoActions.ts` holds the shared "nearest tile matching predicate + A* to adjacent" logic used by both. `DungeonView` wires them into `handleTileClick`/`handleMove` the same way overworld does.

## 2 · Orphan up-stairs cleanup on load

Symptom: multiple `stairs_up` tiles exist on a floor with no matching overworld exit. Root cause is snapshot rehydration + the "plant stairs beneath spawn" step on floors > startingFloor.

Fix in `hydrateDungeonFromSnapshot` (in `src/game/dungeon.ts`) and in the DungeonView bootstrap path:

- On load, scan the tile grid; if the floor is > `startingFloor`, keep only the up-stair closest to `entryPosition`. Convert extras to `floor`.
- If the floor is `startingFloor` (entrance floor), keep exactly the `entryPosition` up-stair. Convert extras.
- Never delete a stair that is currently under the player (defer until they step off; simplest: relocate the "kept" stair to the player tile in that edge case).

## 3 · Craftable Portal Stairs (coord-mapped)

### Concept

A new placeable item `portal_stairs_kit` (crafted at any station with the new blueprint) can be placed on any floor tile. Once placed, it becomes a `stairs_portal` tile whose destination is computed from its relative dungeon coord to `entryPosition`:

```text
relX, relY = (x - entryX, y - entryY)

if (relX % 2 === 0 && relY % 2 === 0):
    destination = OVERWORLD, at entry.overworldPos + (relX/2, relY/2)
else:
    destination = nearest known tower entrance within
                  Chebyshev radius R of that same mapped coord
```

Even/even tiles map deterministically to overworld coords. Odd tiles route to the nearest tower (uses `overworld.discoveredDungeons` / tower registry).

### Data model

Extend `DungeonTile`:
```ts
type: 'stairs_portal';
portal?: {
  destKind: 'overworld' | 'tower';
  destOverworld?: { x: number; y: number };
  destTowerId?: string;
  destFloor?: number;         // for tower dest, resolved on use
  validated: boolean;         // last free-space check result
};
```

New reducer actions:
- `PLACE_PORTAL_STAIRS { x, y }` — consumes 1 kit, validates dest, sets tile.
- `REMOVE_PORTAL_STAIRS { x, y }` — refunds kit, blocked if it would leave floor with zero entrances.
- `USE_PORTAL_STAIRS { x, y }` — transitions player.

### Free-space guarantee

Before placement, `computePortalDestination(dungeon, x, y, overworld)` returns:
- `{ ok: true, dest }` when the mapped tile is walkable (overworld: grass/road; tower: entrance tile exists).
- `{ ok: false, reason }` when blocked (water, cliff, building, tower undiscovered, out-of-bounds).

Placement UI shows the reason and refuses. `validated` is re-checked on floor load so if the overworld changes underneath, the portal shows a broken state (still removable, not usable).

### Tooltip preview

`UnifiedTileMenu` already renders `info` rows. `stairs_portal` tiles add:
- `Destination`: `Overworld (12, -4)` or `Fire Tower · Floor 3`.
- `Status`: `Ready` / `Blocked — target is water` / `Tower not yet discovered`.
- `Type`: `Even-coord (overworld)` or `Odd-coord (tower)`.

Hovering the tile in `DungeonRenderer` shows the same in the existing hover tooltip.

### "Always one entrance" guard

`canRemoveStair(dungeon, x, y)` counts tiles where `type ∈ { 'stairs_up', 'stairs_portal' with overworld dest }`. Removal is refused when the count would drop to zero and the current floor is `startingFloor`. Menu action is disabled with a `disabledReason`.

### Crafting

- New blueprint `portal_stairs_kit` in `recipeBook.ts` (grid pattern: 2 stone + 1 wood in staircase shape). Discoverable at any tier-2+ workbench.
- Placement flow: item → Use → enters targeting → pick a floor tile within 3 steps → `PLACE_PORTAL_STAIRS`.

## Technical notes

- **Nearest-tower lookup** reuses `overworld.discoveredDungeons` (already scans in `MainMenu`). Chebyshev radius default `R = 16` (tunable).
- **Cross-dungeon travel** for odd tiles: on `USE_PORTAL_STAIRS` with `destKind: 'tower'`, dispatch `ENTER_DUNGEON` for the target tower at floor 1 (or player's highest cleared floor for that tower, capped by the existing pre-run slider rule).
- **Persistence**: portal tiles live on the persisted dungeon-floor snapshot (already saved per `entryPosition`), so they survive re-entry. Overworld exit coord is also snapshotted so re-hydration matches.
- **Migration**: no DB migration needed — everything is in the client save blob.
- **Files touched (est.)**: `dungeon.ts`, `DungeonView.tsx`, `OverworldView.tsx` (for auto-mining any orphan cross-refs), `UnifiedTileMenu.tsx` (no shape change, just usage), `recipeBook.ts`, `types.ts`, `reducers/*`, new `dungeon/autoActions.ts`, new `dungeon/portalStairs.ts`.

## Out of scope

- Placing portals on the overworld side (this pass is dungeon-only outbound). Return travel uses existing entrances.
- Rebalancing crafting costs beyond a sensible default.
- New art — portal stairs reuse the existing stairs sprite tinted for now.
