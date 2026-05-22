## Goal

One consistent menu for any tile on any platform. Right-click (PC) and long-press (touch) on any tile opens a single centered modal that shows tile + creature info AND every action available for that tile. Left-click / short tap stays as movement (existing behavior). Hover tooltips on desktop stay; the same info also lives inside the menu.

## What's broken today

- PC: right-click on dungeons opens a waypoint menu that's been flaky.
- Android: long-press fires tooltips that conflict with the context menu.
- Dispatch is fragmented: 6 different menu components (TileContextMenu, WaterTileContextMenu, RoadContextMenu, DungeonWaypointMenu, BuildingContextMenu, AttackPicker) each opened from a different branch in `handleTileRightClick`. Overworld and dungeon use different patterns.

## Design

### New component: `UnifiedTileMenu`

Centered modal (matches existing `DungeonWaypointMenu` shell), one screen:

```
┌──────────────────────────────────────────┐
│ 🍃 Tile name           (x, y) · biome    │
│ ─────────────────────────────────────── │
│ Tile info block (terrain, elevation,     │
│   passable, building, resource node)     │
│                                          │
│ Creature info block (only if occupant):  │
│   name · lvl · element/class · HP bar    │
│   matchup warning (1.5x / 1.3x)          │
│                                          │
│ ── Actions ──                            │
│ [⚔ Attack]    (opens existing AttackPicker)
│ [👣 Move here] (one-step or auto-walk path) │
│ [🏰 Enter dungeon] (if entrance)         │
│ [📍 Waypoint pin] (if dungeon/major loc) │
│ [🔨 Build here] (if buildable)           │
│ [⛏ Mine / 🪓 Chop / 🌾 Harvest] (if resource)
│ [💧 Fill water] / [🛤 Remove road]       │
│ [👥 Assign monster] (player building)    │
│ [✕ Close]                                │
└──────────────────────────────────────────┘
```

Action rows are dynamically built from a `getTileActions(tile, ctx)` helper so the modal stays dumb. Disabled rows still show with a reason ("No target in range").

### Dispatch changes

- `OverworldView.handleTileRightClick` — replace the 6-way branch with `setUnifiedMenu({ x, y })`. Existing specialized menus stay mounted as secondary screens that `UnifiedTileMenu` can open (e.g. AttackPicker, BuildPanel) so we don't re-implement them.
- `DungeonRenderer` / `Index.tsx` dungeon side — same: route `onTileRightClick` into the unified menu.
- Long-press (already wired in `DungeonRenderer.tsx:887+` and `OverworldRenderer.tsx:327+`) opens the same unified menu.

### Tooltip conflict on Android

The `Building Tooltips & Menu` rule (hover tooltip on desktop + right-click menu) currently leaks onto touch because hover events fire on tap. Fix: gate hover tooltips with `@media (hover: hover)` / a `pointer: fine` check so touch devices never see hover tooltips. The unified menu carries the same info, so touch users lose nothing.

## Files

New:
- `src/game/UnifiedTileMenu.tsx` — the modal shell + action list builder.
- `src/game/tileActions.ts` — pure `getTileActions(tile, ctx) → Action[]` helper. Centralizes "what can I do here?".

Edited:
- `src/game/OverworldView.tsx` — replace `handleTileRightClick` branching with one `setUnifiedMenu` call; mount `UnifiedTileMenu`; keep existing AttackPicker/BuildPanel/etc. as downstream targets.
- `src/pages/Index.tsx` (dungeon) — same treatment for `onTileRightClick`.
- `src/game/OverworldRenderer.tsx`, `src/game/DungeonRenderer.tsx` — gate hover tooltip with `(hover: hover)` media query.
- `src/game/DungeonWaypointMenu.tsx`, `src/game/TileContextMenu.tsx`, `src/game/WaterTileContextMenu.tsx`, `src/game/RoadContextMenu.tsx` — keep for now (called via UnifiedTileMenu when needed) but most flows fold directly into the unified menu. Cleanup happens once unified flow is verified.

## Out of scope (this pass)

- Visual redesign of the existing AttackPicker / BuildPanel / Building assign UI. Those still open as secondary screens.
- Radial / popover variants. User picked centered modal.
- Removing the existing menu components. They stay until the unified flow is proven.

## Verification

- PC: right-click grass, dungeon, enemy, building, water, road, nest → unified menu shows correct actions; left-click still moves.
- Touch: long-press any of the above → unified menu; tap moves; no stray hover tooltip popping up.
- Hover tooltip on desktop still works for buildings/creatures.
