# Code-Quality Refactor Plan

Goal: shrink the five biggest files and decouple data access, without regressing any of the memory-locked invariants (END_RUN / FLEE_DUNGEON persistence, movement timing, world-seed hashing, unified inventory).

Each phase is independently shippable and ends with `window.__menagerie.runSmokeTest()` + a quick visual sanity pass. If any invariant turns red, STOP and roll that phase back before continuing.

---

## Phase 1 — Split `src/game/state.ts` (1,980 lines, 61 cases)
**Why first:** Index.tsx and OverworldView import from it; refactoring them on top of a clean reducer is easier than the reverse.

- New folder `src/game/reducers/`:
  - `runReducer.ts` — START_RUN, END_RUN, FLEE_DUNGEON, party/monster/XP cases
  - `inventoryReducer.ts` — ADD_ITEM, USE_ITEM, DROP_ITEM, equipment cases (mirror to storedItems stays here)
  - `overworldReducer.ts` — overworld movement, build, road, base cases
  - `dungeonReducer.ts` — dungeon movement, tile, combat-resolution cases
  - `metaReducer.ts` — settings, waypoints, UI flags
- `state.ts` keeps `GameProvider`, `useGame`, `gameReducer` (now just a `switch(action.type)` that delegates), `persistRunPartyProgress`, `buildProgressSnapshot`.
- No action-shape changes. No behavior changes.

**Risk:** cross-domain actions (END_RUN touches party + inventory + overworld). Keep those in `runReducer` and have it call helpers from the others — do NOT split END_RUN across files.

**Gate:** all 6 invariants ✅.

---

## Phase 2 — Extract data hooks (`src/hooks/data/`)
**Why second:** small, isolated, gives us testable seams before touching the big UI files.

- `useBugReports.ts` — wraps `ReportBugDialog` + `BugReportsEditor` queries
- `useFeatureRequests.ts` — wraps `FeatureRequestDialog` + `FeatureRequestsEditor`
- `useGameDataOverrides.ts` — central read of overrides used at boot
- `useAuthSession.ts` — single subscriber for `auth.onAuthStateChange`

Replace direct `supabase.*` calls in 9 components. Admin editors keep their write logic but call shared hooks for reads.

**Risk:** RLS-scoped queries differ slightly per call site — verify each migration preserves filters.

**Gate:** sign in, submit a bug report, submit a feature request, load admin panel.

---

## Phase 3 — Split `src/pages/Index.tsx` (5,780 lines) → `src/pages/DungeonView/`
**Why third:** biggest payoff, but needs Phase 1 done so extracted hooks dispatch against a clean reducer.

- `DungeonView/index.tsx` — composition root (~400 lines target)
- `useDungeonInput.ts` — keyboard handler, tap/click targeting, attack menu
- `useDungeonAutoRun.ts` — auto-run state + step throttling
- `useDungeonRecruitment.ts` — recruit queue, defeated-enemy modal flow
- `useDungeonRevive.ts` — revive prompt + last-stand flow
- `useDungeonBuild.ts` — build panel + dungeon build mode
- `DungeonOverlays.tsx` — modal stack (revive, stair, recruit, level-up)
- `DungeonContext.tsx` — shared refs (isMovingRef, targetPath, etc.) so hooks aren't prop-drilled

**Risk:** `isMovingRef` and the rAF movement loop are timing-sensitive (movement-sync memory). Keep them in ONE hook (`useDungeonInput`) and pass the ref via context — do not duplicate.

**Gate:** all 6 invariants ✅ + manual: move 10 tiles, auto-run, attack an enemy, recruit, level-up, stair down.

---

## Phase 4 — Split `src/game/OverworldView.tsx` (2,860 lines) → `src/game/OverworldView/`
Mirror of Phase 3 for overworld:
- `useOverworldInput.ts`, `useOverworldBuild.ts`, `useOverworldRoads.ts`, `OverworldOverlays.tsx`, shared `OverworldContext.tsx`.

**Risk:** world-seed mixing (memory: `_worldSeed` at every hash site). Do NOT touch `overworld.ts` in this phase.

**Gate:** invariants ✅ + manual: move, gather, build a structure, enter a dungeon entrance.

---

## Phase 5 — Split `src/game/equipment.ts` (1,929 lines)
- `equipment/data.ts` — base tables
- `equipment/stats.ts` — modifier math
- `equipment/sets.ts` — set bonuses (2/3/4 pc)
- `equipment/affinity.ts` — element/class affinity
- `equipment.ts` re-exports for back-compat (zero call-site changes).

**Gate:** invariants ✅ + equip/unequip a 3-piece set and confirm bonus shows.

---

## Phase 6 — Split `src/game/overworld.ts` (1,500 lines)
- `overworld/generation.ts` (world-seed-mixed hashes stay here, untouched)
- `overworld/chunks.ts` (load/unload)
- `overworld/biomes.ts`
- `overworld/roads.ts`
- `overworld.ts` re-exports.

**Risk:** highest seed-fragility. Do this last and review every `hash(...)` call site for an unchanged `_worldSeed` argument.

**Gate:** Settings → Rebuild Overworld produces the same map for the same seed before vs after.

---

## Out of scope for this pass
- Admin editors (MovesEditor, ShapeDesigner) — internal tooling, lower priority
- DungeonRenderer / OverworldTileGraphics — performance-sensitive; needs profiling first, separate effort
- CraftingWorkshop / Settings / GameSidebar / UnifiedMovePanel — 900-line range, can wait

## Verification after every phase
1. `bun run build` (harness does this automatically after edits)
2. `window.__menagerie.runSmokeTest()` — all 6 invariants must be ✅
3. Targeted manual check listed under each phase's Gate
4. `code--read_runtime_errors` clean

## What I need from you
- **Approve the plan** to start with Phase 1, OR
- **Approve a subset** (e.g. just Phases 1+2 for now), OR
- **Adjust scope** if you want a different file first

Given the scale, I'd recommend approving phase-by-phase rather than all six at once.
