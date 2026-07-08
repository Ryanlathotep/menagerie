# Dockable Menus & Room Editor Overhaul

Big request — grouping into 3 shippable phases so we can land it incrementally without one broken half-feature blocking the rest. Confirm phases (or reorder) before I start.

## Phase 1 — Floating Dock & Auto-Hunt polish

**Dockable menu buttons**
- Extend the existing `src/game/floating/FloatingDock.tsx` so *every* floating button (Bug, Feature, Settings, Menu, Dock trigger, etc.) registers with the dock.
- Make the dock itself draggable: grab handle on the strip, position saved to `localStorage` (`ui.dock.pos`), snap to nearest screen edge, clamp inside viewport.
- Default position moved off the bottom-right corner so it stops covering the Exit / Flee buttons. Include a "Reset dock position" entry in Settings.

**Auto-harvest "all" button**
- Add a top-level action in `UnifiedTileMenu` (dungeon + overworld) that queues auto-harvest for every reachable resource (herbs, ore, chests, runes, trees, rocks) using the same spiral scan Auto-Hunt already uses.
- Reuses the existing threat-check halt from the last change.

**Auto-Hunt → Attack menu handoff**
- When Auto-Hunt reaches a tile where any party monster is in attack range of the target enemy, stop movement and open the existing `EnemyAttackMenu` / `AttackTargeting` UI with that enemy pre-selected instead of just halting silently.

## Phase 2 — Room Editor: full tile palette

Extend `src/game/rooms/types.ts` `RoomCellKind` and the painter in `src/admin/RoomEditor.tsx`:

- **Empty / passthrough** cell — marks a hole so world/dungeon gen fills it with its own rules instead of stamping floor.
- **Wall variants**: `wall_bedrock` (unbreakable), `wall_mineable` (existing dungeon wall), `wall_secret` (renders as bedrock until a linked switch fires).
- **Overworld tiles**: `water`, `cliff`, `ramp`, plus the existing biome/terrain kinds — exposed in a new "Overworld" palette tab.
- **Interactables**: `lever`, `pressure_plate`, `switch_hidden`, `torch`, `rune`, `spike_trap`, `dart_trap`, `box` (pushable), `secret_door`.
- **Spawn markers**:
  - `spawn_random` — spawns a creature per that map's spawn rules.
  - Level offset field (`levelDelta`, clamped -5..+5).
- **Player-structure stamp**: pick any building from `src/game/buildings.ts` and optionally attach an "assigned enemy" (species/element/class picker) that hydrates on stamp.

**Trigger wiring**
- New `RoomCell.triggerId` (string) and `RoomCell.triggersTargets` (string[]) fields.
- Levers, pressure plates, hidden switches emit their `triggerId`; traps, runes, spikes, secret doors, boxes listen via `triggersTargets`.
- Runtime handler added to `src/game/reducers/dungeonReducer.ts` and `overworld.ts`:
  - Step-on for plates.
  - Push-box-onto-plate holds the plate.
  - Toggling a lever fires all targets (open door / arm-disarm trap / reveal secret wall / light rune).
- Torches: on stamp, add a fog-of-war reveal source (radius 4) to the tile.

**"Add room to generation" toggle**
- Per-room checkboxes: `spawnInOverworld`, `spawnInDungeons`, `spawnInArena` (existing arena tag stays).
- Overworld gen (`src/game/overworld.ts`) and dungeon streamer (`src/game/dungeonExpansion.ts`) roll against the enabled room pool with a low weight, respecting biome tags.

## Phase 3 — New items + wiring

New in-game items/entities so the editor pieces have a home:
- `torch` (placeable item, fog-clear radius).
- `pressure_plate`, `lever`, `hidden_switch`, `secret_door`, `bedrock_wall`, `pushable_box` — all as tile entities in `src/game/dungeon.ts` types.
- Recipes/drops: torches craftable from wood + fire essence; other pieces are editor-only (not craftable) unless you say otherwise.

## Technical notes

- Room schema version bump; migration reads old cells unchanged.
- All new cell kinds render via `TileGraphics` — one new sprite per kind, kept minimal (SVG) so no asset bottleneck.
- Trigger graph stored on the stamped room instance so multiple copies of the same prefab don't cross-fire.

## Open questions before I start

1. Which phase order do you want — 1→2→3, or Room Editor (2) first?
2. For "assign an enemy to a player structure" — do you want a single specific monster (species+class+element+level) or a spawn rule (e.g. "any Fire tank ±5 of floor")?
3. Secret doors — should they also break under mining like normal walls, or *only* open via the linked switch?

I'll wait for your answers, then ship phase by phase.
