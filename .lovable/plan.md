## Goal
Make dungeons feel like a place you can settle. All overworld buildings + roads become placeable on dungeon floors, and every floor you've shaped (mined walls, placed buildings, roads, defeated nests, picked-up items) persists across runs — re-entering a dungeon resumes the world you left, not a fresh seed.

## Current state
- **Per-run only:** `DungeonState.visitedFloors` snapshots each floor (tiles/enemies/position) but lives on the active `RunState`. Flee/wipe discards it.
- **Buildings & roads:** Only exist on `OverworldState` (`playerBuildings`, `roads`, `tileOverrides`). Dungeon floors have no such fields, no build UI, no renderer pass.
- **Dungeon entrances:** `DungeonEntrance` on `OverworldState.dungeonEntrances` already persists across runs (seed, deepestFloor, discovered). Perfect anchor for cross-run floor snapshots.

## Plan

### 1. Data model (`src/game/types.ts`)
Extend `DungeonEntrance` with persistent floor data:
```ts
floorSnapshots?: Record<number, {
  tiles: DungeonTile[][];
  width: number;
  height: number;
  playerBuildings: PlayerBuilding[];
  roads: Record<string, 'dirt_road' | 'stone_road'>;
  // enemies/position intentionally NOT stored cross-run — enemies respawn,
  // player re-enters at the staircase they used.
}>;
```
Per-run `DungeonState.visitedFloors` keeps its existing shape (adds `playerBuildings` + `roads` so they render mid-run too).

### 2. Hydration on dungeon entry (`src/pages/Index.tsx` START_RUN / dungeon-enter)
When entering a dungeon entrance:
- For each generated floor, if `entrance.floorSnapshots[floor]` exists, overlay its tiles/buildings/roads onto the freshly seeded floor (preserves any new infinite-streaming strips beyond the saved width).
- Enemies & items regenerate normally; mined walls and player constructions persist.

### 3. Snapshot writes
Three write points must mirror floor state back into `entrance.floorSnapshots`:
- **Floor change** (stairs up/down): snapshot the floor being left.
- **FLEE_DUNGEON / END_RUN / TOWN_PORTAL_SCROLL:** snapshot the current floor before tearing down `RunState`.
- **Mid-run build/mine/road:** already updates `dungeon.tiles` + `visitedFloors` — no extra write needed; the flee/stairs hooks above flush it.

### 4. Building & road UI in dungeons
- Reuse existing Build/Road panels. Detect `mode === 'dungeon'` and:
  - Route `placeBuilding` / `placeRoad` / `mineWall` actions into `dungeon` state instead of `overworld`.
  - **Skip the "within 10 tiles of home or another building" check** (per user choice — no anchor needed in dungeons).
  - Keep cost checks (materials/gold) and creative-mode bypass.
- Dungeon tiles already have walkability; treat dungeon floor tiles as buildable when not wall/staircase/water.

### 5. Rendering (`src/game/DungeonRenderer.tsx`)
Add a buildings + roads render pass mirroring `OverworldRenderer`:
- Import the same `BuildingSprite` / road tile components used in overworld.
- Z-order: floor → roads → tiles (chests/herbs) → buildings → enemies → player → overlays (dowsing, fog).
- Right-click tooltip/context menu (assign/repair/disassemble) reused from overworld.

### 6. Hub integration
Staffed buildings (farms producing materials, towers attacking enemies, workstation opening crafting) work identically inside dungeons. Town Hall / shop interactions are restricted to the overworld home base (no second town in a dungeon).

### 7. Persistence
Snapshots ride along on `OverworldState.dungeonEntrances`, which is already serialized into `saveData` and synced to Lovable Cloud `game_saves`. No new tables.

## Technical notes
- `DungeonTile` already supports the fields buildings need (walkable, items, terrain). No schema changes there.
- Memory cost: a 80×80 floor with ~50 buildings ≈ 30 KB JSON. Cap snapshots at last 50 visited floors per dungeon to bound save size; deeper untouched floors regenerate on visit.
- `Tower of the Infinite` and themed towers all use the same persistence path — no special casing.
- Update memory file `mem://gameplay/exploration/persistent-staircases` and add a new `mem://gameplay/exploration/dungeon-building-and-persistence` entry.

## Files touched
- `src/game/types.ts` — extend `DungeonEntrance`, `DungeonState.visitedFloors`.
- `src/game/buildings.ts` — branch placement validator on context (overworld vs dungeon).
- `src/game/DungeonRenderer.tsx` — add buildings/roads render pass + right-click menu.
- `src/game/OverworldRenderer.tsx` — extract shared building sprite helpers if needed.
- `src/pages/Index.tsx` — hydration on enter, snapshot on stairs/flee/end, route build/road/mine actions to dungeon state when in dungeon mode.
- `src/game/dungeon.ts` (or wherever floor generation lives) — accept snapshot overlay arg.

## Out of scope
- Home base upgrades (Campfire→Town Hall) inside dungeons — those are tied to world coord (0,0).
- Settlement-building auto-spawn rules adapted to dungeon biomes (will use overworld defaults).
- Migration of existing in-progress runs — first dungeon entry after deploy seeds empty snapshots.
