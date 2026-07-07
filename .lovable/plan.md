
# Arena fixes + Room Editor v2 (arena AND dungeon prefabs)

Three separate things the user reported, tackled in order.

## 1. Arena — team entry + betting bugs

**Bugs observed**
- "Entering a team doesn't seem to do anything" — the Tournaments-tab dropdown adds the team to `t.teams` but there's no visible roster on the card, so it looks like nothing happened. Also `fillTournamentWithNpcs` runs on every render in BetsTab but the *entered* team is never rendered as a separate labeled entry.
- "My team isn't showing up in bets" — happens when the player enters a team but the R1 preview pairs it against an NPC in slot 1. Confirmed the team IS in `filled.teams[0]`; the label is just missing. Also, if you enter *after* NPCs are auto-added, your team may not slot into R1.
- "Doesn't keep the selection" — the strategy dropdown in Teams tab uses `defaultValue` and never re-hydrates, and the `Enter team…` select also uses `defaultValue=""`. State persists to `localStorage`, but the UI resets on remount.

**Fixes**
- `TournamentCard`: after the entry dropdown, render the tournament roster as a chip list (`t.teams.map(...)`) with a ✓ marker on the player's team. Show "Your team: X" prominently when `playerHasEntry`.
- Force the player team into slot 0 of `fillTournamentWithNpcs` so it's always in R1 match 0.
- Convert `defaultValue` → controlled `value` state on strategy + entry selects. Persist last-selected `strategyId` per team in `playerTeams`.
- `BetsTab`: label each team card row with a badge (`⭐ You` / `🤖 NPC`) so the player team is visually obvious.
- Verify: enter team → see chip → open Bets → confirm ⭐ badge appears in R1 match 0.

## 2. Arena — 6×6 → 24×24 grid

- `arenaCombat/engine.ts`: change default `gridWidth`/`gridHeight` from 6 to 24 and `maxTurns` from 240 → 480 (bigger board needs more turns to close).
- `ArenaBoard.tsx`: change default `width`/`height` props from 6 to 24. Reduce `CELL` from 48 → 22 px so 26×26 framed grid still fits in the modal.
- `initialPositions`: keep A on x=0, B on x=width-1 but distribute members vertically across the taller field.
- Verify replay renders and existing replays with `width=6` still play (props accept override).

## 3. Room Editor v2 — general-purpose prefab painter (arena + dungeon)

Replaces the tiny arena-only `ArenaRoomEditor`. New standalone editor mounted at `/admin/rooms`, plus the arena editor stays as a thin wrapper that filters to arena-tagged rooms.

### Data model — `Room` (supersedes `ArenaRoom`)

```ts
type CellKind = 'floor' | 'wall' | 'door' | 'stairs_up' | 'stairs_down' | 'lever' | 'box' | 'trap_spike' | 'trap_dart' | 'entry' | 'exit';

interface RoomCell {
  x: number; y: number;
  kind: CellKind;
  tileKey?: string;        // reference to admin-uploaded sliced tile
  enemySpawn?: { species?: SpeciesType; element?: ElementType; class?: ClassType; levelBias?: number };
  itemDrop?: { itemId: string; chance: number };
}

interface Room {
  id: string;
  name: string;
  width: number;                 // 4..48
  height: number;                // 4..48
  cells: RoomCell[];             // sparse; missing = floor
  tags: string[];                // 'arena' | 'dungeon' | 'boss' | 'treasure' | ...
  towerIds: string[];            // which towers can spawn this room; empty = all with matching tag
  // Arena-only visual bits (ignored in dungeons)
  arena?: { floorColor: string; rimColor: string; crowdDensity: number; crowdSpecies?: SpeciesType[] };
  createdAt: number;
  updatedAt: number;
}
```

Storage: Supabase `game_data_overrides` (`data_type='room'`, `data_key=id`). Same hook pattern as `TilePatternPainter`. Falls back to localStorage while offline.

### Editor UI — `RoomEditor.tsx`

Layout: three columns.

- **Left palette**: cell kinds (floor/wall/door/stairs/lever/box/trap/entry/exit) + eraser + a searchable sliced-tile picker (reuse `TilePatternPainter`'s tile source). Selecting a cell kind + optional tile paints both.
- **Center grid**: click-and-drag to paint. Sliders for width/height (4..48). Zoom slider (16..48 px/cell). Ghost preview of a placed enemy (species emoji) or trap icon on top of tiles.
- **Right sidebar**:
  - Room name (rename inline)
  - Tags: multi-select chips (`arena`, `dungeon`, `boss`, `treasure`, `puzzle`)
  - Tower assignments: **checkboxes for every registered tower** (Infinite, elemental, class, species towers). Empty = "all matching tag". A "Preview towers list" refresh button re-pulls tower registry.
  - Buttons: New, Duplicate (copy with `-copy` suffix), Save, Delete, Export JSON, Import JSON
  - Enemy/trap inspector: click a cell that has an enemy/trap → edit species/level/chance in place.
- **Saved rooms list** (bottom or a second tab): filter by tag; each row shows name, size, tags, tower count; Load/Duplicate/Delete/Rename actions.

Route: add `/admin/rooms` in `App.tsx` mirroring `/admin/tiles`. Add a link from `AdminTiles.tsx` header.

### Runtime integration — rooms as dungeon prefabs

Wire rooms into dungeon generation without regressing existing seeded layouts.

- In `src/game/dungeon.ts` (or wherever floor generation lives), after the standard maze/room carving pass, run a `stampRooms(floor, dungeonId, floorNum, rng)` pass:
  1. Load all rooms tagged `dungeon` whose `towerIds` includes this tower (or is empty).
  2. Weighted pick: 0–2 rooms per floor for normal towers; boss rooms only on `%5 == 0` floors.
  3. Find a random unoccupied rectangle of matching size; overwrite tiles with the room's `cells`. Preserve player/exit distance guarantees; if no fit after 8 tries, skip.
  4. For each cell with `enemySpawn`, create an enemy via existing enemy factory using the tower's level curve + `levelBias`. For `trap_*` cells, create a trap using the existing trap system. `lever`/`box`/`door` are recorded on the tile with a `feature` field the renderer already reads (add if missing).
- Arena replays keep using `arena` block; if a room has no `arena` block, arena hub filters it out.

Persistent floor snapshots (see memory) automatically pick up the stamped features because stamping happens before the snapshot is written.

### Wire arena hub to the new schema

- `arenaRooms.ts` becomes a filter layer over the general room store: `getArenaRooms() = allRooms.filter(r => r.tags.includes('arena'))`.
- `ArenaRoomEditor.tsx` shrinks to a "quick create arena room" button that opens the full editor with `arena` tag pre-checked.
- Existing default `oval_sand` becomes a seeded arena room with `tags=['arena']`, `width=24`, `height=24`.

## Files touched

- `src/game/arena/types.ts` — extend `ArenaRoom` → `Room` (backwards-compatible getters)
- `src/game/arena/arenaRooms.ts` — filter over new store
- `src/game/arena/ArenaHub.tsx` — team roster chips, ⭐ badge in bets, controlled selects
- `src/game/arena/ArenaBoard.tsx` — 24×24 default, smaller cells
- `src/game/arenaCombat/engine.ts` — 24×24 default, 480-turn cap
- `src/game/arena/state.ts` — force player team into slot 0
- `src/admin/RoomEditor.tsx` — **new**, full painter
- `src/admin/ArenaRoomEditor.tsx` — shrink to launcher
- `src/pages/AdminRooms.tsx` — **new**, route wrapper
- `src/App.tsx` — register `/admin/rooms`
- `src/pages/AdminTiles.tsx` — add nav link
- `src/game/dungeon.ts` — `stampRooms` pass on floor gen
- `src/game/types.ts` — extend `Tile` with optional `feature: 'lever' | 'box' | 'door' | ...`

## Out of scope (call out to user)

- New tile art for lever/box/door (I'll use emoji placeholders until you paint tiles for them).
- Full puzzle logic for levers (opens nearest door within N tiles) — I'll add a stub the editor writes but the runtime just treats it as a decorative feature for now; wiring the lever→door state machine can be a follow-up.
- Multiplayer sharing of rooms — everything lives in `game_data_overrides` accessible to all players once you save, no per-player rooms yet.

## Verification

- Type-check.
- Manual: enter team, see roster chip; open Bets, see ⭐ on your team in R1 match 0.
- Manual: open `/admin/rooms`, paint a 12×8 room with a spike trap + a spawn, save, tag `dungeon`, enter a tower, confirm the room appears within a few floors.
- Manual: open Arena replay, board is 24×24 with visible tile framing.

Approve and I'll build it in one pass.
