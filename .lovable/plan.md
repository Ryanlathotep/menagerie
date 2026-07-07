# Max-Level QA Fixture, Town-Build Invariant, and Autobattle Engine

Three linked deliverables. Each is independently useful; together they give the smoke test real coverage of endgame content and lay the groundwork for the future Arena building + cross-server tournaments.

## 1. Max-level "everything unlocked" fixture

**Goal:** a deterministic, in-memory `GameState` the invariant suite can spin up in one call so tests exercise endgame code paths (mastered moves, full sets, all species, deep inventory) without touching cloud saves.

- New `src/dev/fixtures/maxLevelSave.ts` exporting `buildMaxLevelSave(seed = 1)` → `SaveData`:
  - All 20 species × 5 classes × 6 elements (+ shiny variants) as `UnlockedMonster`s at level 100.
  - Each monster: full `moveMastery` at Omega, `equipment` filled with a matched set (uses the same helpers `createMonster`/`createEmptyEquipment` the game uses).
  - `storedItems`: one of every consumable + 3 Portal Stairs Kits + 5 Town Portal Scrolls.
  - `storedEquipment`: a rotating slate of tier-5 gear per slot for diff testing.
  - `dungeonEntrances`: HOME_TOWER_ID + one of each themed tower (element/class/species), all `discovered: true`, `deepestFloor: 100`.
  - `overworldState`: pre-explored 40×40 chunk around (0,0) with a mixed biome sample.
  - `unlockedRecipes`: every recipe in `recipeBook.ts`.
- New `buildMaxLevelParty(save)` → `Monster[]` returning 4 balanced picks (tank/dps/support/ranger) fully equipped.
- Add `window.__menagerie.loadMaxLevelSave()` bridge helper (dev bridge, guarded by admin role) that dispatches `LOAD_SAVE` with the fixture. Handy for manual smoke and for the browser-driven QA panel.

## 2. Town-build QA invariant

**Goal:** prove the settlement-building system still lets a max-level save construct a canonical town without violating placement rules, and that everything is refunded when disassembled.

- New `src/dev/fixtures/canonicalTownLayout.ts`: an ordered list of `{type, dx, dy}` builds relative to home (Campfire → Log Cabin → Town Hall → Storehouse → Farm → Watchtower → Workbench → Elevator → 2 road spokes). ~10 buildings, all within the 10-Manhattan build radius chain.
- New invariant `town-build-and-refund` in `src/dev/qaInvariants.ts`:
  1. Load the max-level fixture.
  2. For each entry, dispatch `BUILD_STRUCTURE`; assert placement succeeded + materials debited.
  3. Snapshot resulting `overworldState.playerBuildings`.
  4. Dispatch `DISASSEMBLE_STRUCTURE` on each in reverse order; assert materials returned within refund tolerance and no orphan buildings remain.
  5. Rebuild once more to prove the placement chain still works after teardown.
- Suggested-fix mapping: → `src/game/overworld.ts` BUILD_STRUCTURE + DISASSEMBLE_STRUCTURE handlers; check placement-radius rule + `getDisassembleRefund`.
- Wire the new invariant into `runSmokeTest()` and the Admin QA panel's summary table.

## 3. Autobattle engine (arena foundation)

**Goal:** headless, deterministic combat resolver that plays two parties against each other with no UI, seeded RNG, and a compact result payload. Reused by (a) the new QA invariant, (b) the future Arena building, (c) daily/weekly/monthly tournament backend jobs.

New module `src/game/autobattle/`:

```text
autobattle/
  types.ts        AutobattleTeam, AutobattleResult, AutobattleLogEntry
  ai.ts           chooseMove(monster, enemies, allies, rng) — reuses enemyAI archetype scoring
  resolver.ts     runAutobattle(teamA, teamB, opts) — turn loop, status ticks, faint handling
  seeded.ts       mulberry32-backed RNG (same family as dungeon seeding)
  index.ts        public API
```

- `runAutobattle` returns `{winner: 'A'|'B'|'draw', turns, casualties, mvpId, log[]}` and never mutates inputs.
- Turn order = existing speed rule; move selection reuses existing `enemyAI` scoring so results feel consistent with map combat.
- Status effects, stamina, elemental/class multipliers all delegate to the existing `combat.ts` helpers — no combat-math duplication.
- Auto-battle cap: 200 turns → draw (prevents infinite ping-pong).

New QA invariant `autobattle-deterministic`:
- Runs `runAutobattle(partyA, partyB, {seed: 42})` three times and asserts identical results.
- Runs it with seed 42 vs 43 and asserts *different* logs (proves seed actually threads through).

Admin QA panel gains a small "Auto-battle sandbox" section: pick two saved parties, seed, click **Simulate** → shows result summary + collapsible log. Uses the max-level fixture as default opponents.

## Out of scope (explicitly)

- **No Arena building yet** — this plan ships the engine and QA hooks. Placing an Arena on the overworld, betting UI, cross-server matchmaking, and the tournament scheduler are follow-up work, gated on the engine being stable.
- No new Supabase tables. Tournament persistence (`tournament_entries`, `arena_matches`, betting ledger) will be a separate plan once the engine is proven and you've decided the payout economy.
- No balance changes to existing combat math.

## Technical notes

- Fixture uses the real `createMonster` / `equipment` helpers so any future breaking change to those signatures fails loudly instead of drifting.
- All new dev-only code lives under `src/dev/` and `src/game/autobattle/` — nothing ships to the player build unless the Arena feature explicitly imports the resolver.
- Bridge helpers (`loadMaxLevelSave`, autobattle sandbox) check `has_role('admin')` before doing anything destructive to the current save.
- The town-build invariant runs against a *cloned* fixture per invocation so it can't corrupt the caller's live game.

## Files touched / created

Created:
- `src/dev/fixtures/maxLevelSave.ts`
- `src/dev/fixtures/canonicalTownLayout.ts`
- `src/game/autobattle/{types,ai,resolver,seeded,index}.ts`

Edited:
- `src/dev/qaInvariants.ts` — add `town-build-and-refund`, `autobattle-deterministic`
- `src/dev/DebugBridgeMount.tsx` (or wherever `window.__menagerie` is assembled) — expose `loadMaxLevelSave`, `runAutobattle`
- `src/pages/AdminQA.tsx` — new invariant rows + optional Auto-battle sandbox card
- `.workspace/skills/menagerie-smoke-test/SKILL.md` (if the workspace copy is writable) — mention the two new invariants and the fixture; suggested-fix mapping entries added

No DB migrations. No RLS changes.
