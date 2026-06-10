# Overworld Movement & Targeting Repairs

Six related bugs are making the overworld nearly unplayable on mobile. Fixes are grouped by root cause so I can verify each one independently.

## 1. Player locked out when a visible enemy is on screen

**Cause:** `handleMove` returns `prev` on `result.type === 'enemy'`, refusing to step into the enemy. That is correct for the bumped tile, but `startAutoWalk` *also* bails the moment any enemy is visible within 6 tiles, AND tap-to-move on an empty tile away from the enemy still routes through `findOverworldPath` → `startAutoWalk`, so the player can't move at all while an enemy is on-screen.

**Fix:** Loosen `startAutoWalk`'s halt condition: only stop when the next queued step is adjacent to a visible enemy (or the enemy is within 2 tiles of the player), not just "any enemy visible anywhere on screen." Also allow a single-tile manual tap (already adjacent path) to bypass the halt entirely. Show a single toast on halt instead of repeated logs.

## 2. "Move" missing from the universal (long-press) menu

**Cause:** In `OverworldView.tsx` the per-tile branches (`grass`, road) add a `Move here` action only when `isAdjacent`. For non-adjacent tiles the fallback "Walk here (N steps)" is added only when `findOverworldPath` succeeds AND the tile is grass/road. For `tree`/`rock`/`water`/`dungeon_entrance`/`enemy`/`nest` the walk fallback is skipped entirely, so the player has no Move/Walk affordance.

**Fix:** Move the universal "Walk here" affordance out of the type-specific blocks and into the shared `tile.explored` block already at the bottom (~line 2509). Allow it for any tile that pathfinding can reach OR whose neighbor is reachable (so you can walk *to* a tree/rock/enemy and let the final step interact). Always include `Move here` (1-step) for any adjacent reachable tile, regardless of type.

## 3. Tap-to-move often not working on mobile

**Causes:**
- `handleTileClick` requires the tap to land on a tile whose dest is walkable; taps on harvestables fall through silently in some branches.
- Long-press detection on mobile fires the unified menu *and* a click — the click then dismisses the menu before the user sees it (and no move starts).
- `findOverworldPath` requires `tile.explored` for every path tile, so a tap one square past the fog boundary returns `null` and is silently ignored.

**Fix:**
- In `handleTileClick`, when the target tile is a harvestable or enemy more than 1 step away, run the A* path to the tile *adjacent* to it and auto-walk to that tile (then the next tap interacts).
- Suppress the synthetic click that follows a long-press (use a `suppressNextClickRef` set in `handleTileRightClick`, cleared after 300ms).
- Allow A* to traverse the last 1-2 unexplored tiles next to the destination (relaxed `tile.explored` check for the goal's immediate neighborhood) so taps right at the fog edge succeed.

## 4. Movement-only moves (dash/blink/etc.) don't fire

**Cause:** The targeting branch in `Index.tsx` (line 1629-1666) correctly enters targeting for `isMovementSkill`, but `getAttackConfig` returns `pattern: 'movement'` only when the move has a `movement.offsets` array. Admin-panel-created moves with `type: 'movement'` but an empty/undefined `movement` object fall back to the melee/ranged path and either error or do nothing.

**Fix:**
- In `MovesEditor.tsx`, when saving a move with `type === 'movement'` and no `movement.offsets`, auto-attach a default 1-tile orthogonal `movement.offsets` block so the move is executable. Surface a small inline warning if the designer set type=movement but never opened the Shapes tab.
- In `getAttackConfig` (or the executor), treat `type === 'movement'` without offsets as a single-step dash toward the targeted tile rather than crashing.
- Ensure overworld targeting (not just dungeon) handles `pattern === 'movement'` — currently the movement branch is dungeon-only (Index.tsx:1876). Add an equivalent in `OverworldView.handleTargetingClick`.

## 5. Pathing improvements

**Fix:**
- Increase A* node budget from 4000 to 8000 so long taps across explored land succeed.
- Add diagonal-aware tie-breaking (still 4-connected steps, but prefer the path that hugs roads — roads currently aren't preferred, so the walker often takes the grass parallel to a road).
- When pathfinding to an interactable tile, return the path *up to and including* the adjacent tile, then mark the interaction step as a separate "final tap" the caller can fire after auto-walk completes.

## 6. Map generation lets harvestables block the only path

**Cause:** Trees/rocks/water can spawn in 1-wide corridors between cliffs/walls, fully blocking traversal. The generator (`overworld.ts`) doesn't validate that each tile has at least one walkable neighbor.

**Fix:** After chunk generation, run a quick local sweep: for every harvestable tile (tree/rock), check the 4-neighborhood. If removing this tile would disconnect a chokepoint (i.e., both sides are walkable and there's no alternative within a small radius), demote it to plain grass. Implementation: in `overworld.ts` `generateChunk` post-pass, iterate tree/rock tiles and if `walkableNeighbors === 2` and those two neighbors are opposite sides AND no diagonal walkable exists, replace with grass. Cheap and only runs once per chunk.

## Bonus: render-phase setState warning

The console shows `Cannot update a component (GameProvider) while rendering a different component (OverworldView)` from line ~199. This is the `setOverworld(prev => { … dispatch(…) … })` pattern — dispatching during a state updater. Wrap the cross-component dispatches in `queueMicrotask(() => dispatch(...))` or move them into a `useEffect` keyed off the relevant overworld field. Low-risk and removes the warning.

## Files touched

- `src/game/OverworldView.tsx` — auto-walk halt rules, unified menu walk affordance, click handler, suppress-click-after-longpress, movement targeting
- `src/game/overworldPathfinding.ts` — node budget, fog-edge relaxation, road preference
- `src/game/overworld.ts` — chokepoint sweep in `generateChunk`
- `src/game/overworldCombat.ts` — movement pattern handling
- `src/pages/Index.tsx` — movement-skill fallback when offsets missing
- `src/admin/MovesEditor.tsx` — auto-attach default movement offsets + warning
- `src/game/moves.ts` (small) — helper for default movement offsets

No DB / schema changes. No new dependencies.
