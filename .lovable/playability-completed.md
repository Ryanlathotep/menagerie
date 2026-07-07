# Playability — Completed Tasks

Append-only log of player-facing bugs and features that have actually shipped. New entries go at the **top**. Each entry lists the date, source id, root cause in one or two sentences, the file(s) touched, and how it was verified — so the next priorities re-run never re-suggests work that's already done.

Format:
```
## YYYY-MM-DD — short title
- **Source**: bug `<id>` / feature `<id>` / plan §N
- **Root cause**: …
- **Fix**: file paths + one-line summary per file
- **Verified by**: build/smoke-test/manual repro/…
```

---

## 2026-06-18 — Tooltips/HoverCards unusable on mobile (no hover, no long-press)
- **Source**: bug `ffcffd41` — originally filed as "Tower of the Infinite tooltip empty on mobile long-press" but the real scope is app-wide: every Radix `Tooltip` and `HoverCard` was suppressed on touch devices via `if (isTouch) return null`, so mobile users had no way to read them.
- **First attempt (rejected by user)**: Added an ⓘ Popover to dungeon rows only. User feedback: not helpful — they want the actual mobile equivalent of desktop hover (long-press) working across the whole app.
- **Real fix**:
  - `src/components/ui/tooltip.tsx`: Stopped null-returning `TooltipContent` on touch. Made `Tooltip` root controlled on touch devices via a `TouchTooltipContext`. `TooltipTrigger` now attaches touch handlers — a ~400ms long-press opens the tooltip, tap-move cancels, and the trigger's synthetic click is swallowed if long-press fired so the underlying button doesn't also activate. `contextmenu` is suppressed on touch so the OS's native long-press menu doesn't win.
  - `src/components/ui/hover-card.tsx`: Same treatment for `HoverCard` / `HoverCardTrigger`.
  - Existing `useDismissTooltipsOnTap` global handler already closes them on tap-elsewhere, so no new dismiss code needed.
  - Left the ⓘ Popover in `DungeonListPanel.tsx` in place — it's redundant now that tooltips work, but it doesn't hurt and gives an explicit affordance.
- **Verified by**: TS build clean, preview healthy. Behavior: on desktop nothing changes (hover/focus still triggers); on mobile long-press summons the tooltip/hover-card, tap anywhere else dismisses.
- **Cross-Platform Menu Parity preserved**: menu bodies remain identical across viewports — only the trigger gesture (hover vs long-press) differs, per Core memory.



## 2026-06-18 — One-hit KO ended run with no revive prompt
- **Source**: bug `a712c559` — one-hit-ko-ended-run
- **Root cause**: The dungeon-map path (`handleActiveMonsterDownOnMap`) was already offering the revive prompt, but two other END_RUN call sites still went straight to game over even when the player was carrying a Revive Herb / Phoenix Flower:
  1. `BattleView.tsx` `handleActiveMonsterDefeated` — dispatched `END_RUN` the moment the last party member fell in turn-based combat, never checking inventory.
  2. `OverworldView.tsx` overworld-enemy damage block — when the active monster's HP hit 0 from an overworld attack it skipped the alive-party-member swap AND the revive prompt, jumping straight to `END_RUN` + `SET_PHASE run_summary`.
- **Fix**:
  - `src/pages/BattleView.tsx` (`handleActiveMonsterDefeated`): before END_RUN, scan `run.inventory` for an item with `effect === 'revive' || 'revive_full'`; if found, set `pendingReviveItem` + `showReviveModal` (the existing modal wiring already handles the rest).
  - `src/game/OverworldView.tsx` (overworld combat damage block): when active monster falls, (1) try to switch to the next conscious party member via `SWITCH_ACTIVE_MONSTER`; (2) else look for a revive item and open the existing `ReviveTargetModal`; (3) only then END_RUN.
- **Verified by**: clean build, preview healthy. Symmetric with the dungeon-map path so all three combat surfaces (dungeon-map, battle-window, overworld) now offer the prompt before silent run-loss.



## 2026-06-18 — Attacks passing through dungeon walls (player + enemy)
- **Source**: user chat report (no bug-DB row filed yet)
- **Root cause**: Multiple wall-blocking failures in the dungeon combat pipeline:
  1. `DungeonView.tsx` called `getAffectedTiles(...)` without the `tiles` argument at damage-commit time *and* in the hover preview. Every branch inside `getAffectedTiles` guards its wall check with `if (tiles && !config.wallPenetrate)` — so omitting `tiles` silently turned every attack into `wallPenetrate: true`.
  2. `hasLineOfSight` and the `cross` arm-stop in `dungeonCombat.ts` only blocked on tile type `'wall'`, never on `'mineable_wall'`. Cavestone/deepstone walls were transparent to ranged attacks until physically mined.
  3. `canSeePlayer` used a simplified axial walk instead of Bresenham — diagonal walls could be missed and enemies could "see" through cover, then keep attacking with no LOS re-verification at fire time.
  4. `calculateDungeonEnemyAction` only gated ranged attacks on Manhattan distance; once aggroed, an enemy would fire through any wall within range 4.
- **Fix**:
  - `src/pages/DungeonView.tsx`: pass `dungeon.tiles` to `getAffectedTiles` in both the targeting commit (line ~2014) and the hover preview (line ~1855). One-line each; turns on the wall checks that already existed.
  - `src/game/dungeonCombat.ts` `hasLineOfSight`: block on both `'wall'` and `'mineable_wall'`.
  - `src/game/dungeonCombat.ts` `cross` pattern arm-stop: same — both wall types stop the cross arm.
  - `src/game/dungeonCombat.ts` `calculateDungeonEnemyAction`: re-verify `hasLineOfSight` before committing a ranged attack; if blocked, move toward the player instead. `wallPenetrate` moves and melee (range 1) skip the gate.
  - `src/game/dungeonCombat.ts` `canSeePlayer`: replaced the simplified walk with a delegation to `hasLineOfSight`, so aggro respects diagonal walls and mineable walls.
- **Verified by**: clean build, preview healthy. `wallPenetrate: true` moves (haunt, soul_drain, shadow_bolt, void_collapse, etc.) still bypass walls as designed. Overworld unaffected (its `overworldHasLineOfSight` was already correct).

---



## 2026-06-18 — Invisible enemies + movement appears locked on overworld
- **Source**: bug `b4c013f2-13db-4b5c-a9da-78b0dac78955` (mobile iPhone, Combat)
- **Root cause**: Nest spawn placed an `enemy` tile with an `enemyId` even when its parent chunk wasn't loaded, so the enemy itself was never added to any `chunk.enemies` list. The renderer drew a blank sprite (invisible) and the overworld click handler intercepted any tap on the orphan tile as an attack-attempt that was instantly returned as "out of range" — so the player saw nothing happen no matter where they tapped near it. With mobile having no keyboard fallback, this felt like a total movement lock.
- **Fix**:
  - `src/game/OverworldView.tsx` (nest tick): only call `setOverworldTile` for the spawned enemy when the parent chunk exists *and* the enemy was actually pushed. No more orphan tiles at the source.
  - `src/game/OverworldRenderer.tsx`: when an `enemy` tile's `enemyId` doesn't resolve, render the tile as grass (preserves walkability for old saves).
  - `src/game/OverworldView.tsx` (`handleTileClick`): require the enemy to resolve to a live Monster before intercepting the tap as an attack. Falls through to A* path-walk otherwise.
  - `src/game/overworld.ts` (`movePlayer` enemy case) already self-heals stale tiles on entry — left as the final safety net.
- **Verified by**: clean build, preview healthy, three independent fix sites so any one path saves the player.

---

## 2026-06-10 — Dockable Unstuck / Bug Report / Feature Request buttons
- **Source**: bugs `77efe74a-18ec-4b85-819a-59efd491b47e`, `1099eb75-e43e-4c5a-9f2e-290e515b9372`
- **Root cause**: Each floating button had its own fixed position and overlapped combat controls on mobile.
- **Fix**: Extracted shared `src/game/FloatingActionButton.tsx` (drag detection, pointer-capture, clamp-to-viewport, localStorage persistence). `FloatingBugButton`, `FloatingFeatureButton`, and the Unstuck button in `DungeonView.tsx` are now thin wrappers over it.
- **Verified by**: drag-then-tap distinction (4 px threshold) keeps single-taps clean; positions persist across reloads.

## 2026-06-10 — Crafting materials not visible in inventory
- **Source**: bug `ccef9d63-e98d-4df9-b0d0-6a44e8590f79`
- **Root cause**: Sidebar inventory pane skipped run-acquired materials.
- **Fix**: `src/game/GameSidebar.tsx` renders a "Crafting Materials (kept on flee)" block with rarity-colored tooltip, affinity callout, and a "Used in N recipes" line via `getRecipesUsingMaterial`.
- **Verified by**: materials appear with full tooltip on both desktop and mobile.

## 2026-06-10 — Keyboard shortcuts fire while typing in text inputs
- **Source**: bug `5cfcdab5-4b5b-4db2-ab48-b58554a19a31`
- **Root cause**: Global keydown listeners ran regardless of focus, so typing a letter in any rename / chat / admin field could fire a hotkey (worst case: ending a run).
- **Fix**: `isTypingTarget(e.target)` guard (defined in `src/game/keybinds.ts`) added to every player-facing keydown handler in `src/game/OverworldView.tsx`, `src/pages/DungeonView.tsx`, and `src/pages/BattleView.tsx`. The only un-guarded listeners are intentional: the keybind-capture in `UnifiedMovePanel.tsx` (literally recording a key) and an Esc-only handler in `DungeonView.tsx` (Esc is safe inside text inputs).
- **Verified by**: typing into the admin panel and bug-report dialog no longer triggers movement or hotbar items.
