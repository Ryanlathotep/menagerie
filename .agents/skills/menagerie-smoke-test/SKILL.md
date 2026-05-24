# Menagerie smoke test

Use this skill ANY time the user asks to smoke-test, regression-test, or "see if anything broke" in Menagerie. The skill has two phases — **a deterministic in-app QA suite** (the meat) and a **lightweight browser visual sanity pass** (best-effort, browser-tool limited). Always do both. Always end with the Suggested-Fixes addendum.

## 0. Pre-flight

1. Confirm the user is signed in (the QA suite writes to `qa_runs`, which is admin-only).
2. `browser--navigate_to_sandbox` to `/` at viewport 1280×800. Note baseline console errors.
3. If admin auth wall appears, stop and ask the user to log in.

## 1. Deterministic invariant suite (PRIMARY — never skip)

This is the only reliable persistence check. Browser tile-clicks and right-clicks cannot reach these reducers.

### Option A — call the bridge directly
1. In the running game (any phase), open DevTools and run:
   ```js
   window.__menagerie.runSmokeTest()
   ```
2. Collect the returned array. Each entry has `{id, name, pass, severity, detail, memoryRef}`.

### Option B — drive the Admin QA panel
1. `browser--navigate_to_url` → preview origin + `/admin/qa`.
2. Click **Run Smoke Test**. Read the results table and Suggested-Fixes panel.
3. The panel persists each run to `qa_runs` for history.

Both options run the same invariants:

| ID | Memory rule | What it proves |
|---|---|---|
| `end-run-persists-four` | persistent-monster-xp-and-mastery | END_RUN writes level + xp + mastery + equipment via the canonical helper |
| `flee-persists-four` | no-death-losses | FLEE_DUNGEON is symmetric and banks gold |
| `pre-run-unequip-recovery` | pre-run-unequip-recovery | Gear unequipped in Pre-Run returns to storedEquipment |
| `mastery-merge-max` | move-mastery-thresholds | Helper keeps the higher mastery uses, never regresses |
| `unified-inventory-live` | unified-inventory | run.inventory and saveData.storedItems mirror live |
| `corrupt-save-tolerance` | — | Helper survives a save missing moveMastery |

A `critical` ❌ means a memory-level regression — STOP and report before doing anything else.

## 2. Browser visual sanity (SECONDARY — best effort)

Only after the suite passes. The browser tool can't reliably interact with the canvas; treat anything below this line as a smoke test of UI shell, not behavior.

1. `/` — main menu loads, Overworld button top, Tower of the Infinite present, no `Start Run` button.
2. Settings → Manage Waypoints + Rebuild Overworld present.
3. Enter Overworld via keyboard if needed. Confirm HUD shows X/Y/Z.
4. Move 4 tiles with `press` ArrowUp/Down/Left/Right on `body`. Confirm tile counter increments.
5. `browser--read_console_logs` filter `error` — diff against pre-flight baseline. Report only NEW entries.
6. `browser--list_network_requests` — flag any 4xx/5xx on `/rest/v1/game_saves` or `/rest/v1/rpc/submit_*`.
7. `code--read_runtime_errors` — surface uncaught React errors.

## 3. Known browser-tool limitations (mark as deferred, not failed)

Stagehand cannot:
- Right-click the unified context menu → **deferred to manual QA**
- Long-press for mobile menu → **deferred to manual QA** (but covered by the cross-platform-menu-parity memory)
- Click individual SVG dungeon/overworld tiles reliably → **deferred to manual QA**
- Drag-resize bottom bars → **deferred to manual QA**

Do NOT mark these ❌. Mark them ⏭️ in the report and direct the user to the Admin QA panel + manual right-click test.

## Reporting

End with this table, then a Suggested-Fixes addendum, then a one-line verdict.

| Step | Result | Notes |
|------|--------|-------|
| Invariant: end-run-persists-four | ✅/❌ | detail |
| Invariant: flee-persists-four | ✅/❌ | detail |
| Invariant: pre-run-unequip-recovery | ✅/❌ | detail |
| Invariant: mastery-merge-max | ✅/❌ | detail |
| Invariant: unified-inventory-live | ✅/❌/⏭️ | "no active run" → ⏭️ |
| Invariant: corrupt-save-tolerance | ✅/❌ | detail |
| Visual: main menu shell | ✅/❌ | |
| Visual: overworld HUD + movement | ✅/❌/⏭️ | |
| New console errors | count | first error |
| Right-click / long-press menus | ⏭️ | deferred to manual QA |

### Suggested-Fixes addendum (MANDATORY)

For every ❌ or ⏭️ in the table, emit a concrete next action. Use this mapping as the starting point — the Admin QA panel produces the same suggestions, treat them as authoritative:

- `end-run-persists-four` → `src/game/state.ts` END_RUN case (~line 362); verify it calls `persistRunPartyProgress`. Don't inline the write.
- `flee-persists-four` → FLEE_DUNGEON case (~line 465); same helper. Both reducers must be symmetric.
- `pre-run-unequip-recovery` → START_RUN recovery block (~line 292-320); diff `member.equipment` against final selection, push diff to `mergedStorage`.
- `mastery-merge-max` → `persistRunPartyProgress` (~line 95); max-uses comparison regressed.
- `unified-inventory-live` → review the most recent `ADD_ITEM`/`USE_ITEM`/`DROP_ITEM` change; both `run.inventory` and `saveData.storedItems` must be mirrored in the same case.
- `corrupt-save-tolerance` → guard mastery iteration with `(existing.moveMastery || {})`.
- Visual failure → identify the failing component before guessing; run `browser--screenshot` and `code--read_runtime_errors`.
- Browser-tool ⏭️ → ask the user to manually right-click on desktop and long-press on mobile to confirm menu parity; never claim parity passed without a human verifying.

Always conclude with a one-line verdict: **"Safe to ship"** (all critical ✅), **"Investigate before shipping"** (any critical ❌), or **"Visual issues only"** (critical ✅ but visual ❌).

## Don't do

- Don't run this skill speculatively when the user only asked a code question.
- Don't claim persistence works because the visual pass passed — the invariants are the only proof.
- Don't fill auth forms. Don't sign up new accounts.
- Don't claim a bug is fixed without re-running the invariant suite afterward.

## Debug bridge reference

Available on `window.__menagerie` whenever the game tree is mounted (any route under `/`):

```js
window.__menagerie.help()           // logs the API
window.__menagerie.getState()       // full GameState
window.__menagerie.snapshot()       // compact persisted-progress snapshot
window.__menagerie.dispatch(action) // dispatch any GameAction against the live store
window.__menagerie.runSmokeTest()   // runs all invariants, logs + returns results
```

Pair `snapshot()` before and after a suspected-regression action to manually diff persisted XP/mastery/gear without rerunning the full suite.
