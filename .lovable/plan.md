## Why the smoke test underperformed

The browser tool can't right-click, can't reliably hit SVG tiles, and can't reach combat/persistence — which is **exactly** where the historical bugs live (END_RUN / FLEE_DUNGEON / unequip recovery). So a "successful" smoke test today only proves the boot path works. Fixing this needs three layers working together.

---

## Layer 1 — Static persistence audit (the work you said yes to)

Read `src/state.ts` (or wherever the reducer lives) and verify, line-by-line:

- `END_RUN` writes **all four**: `level`, `experience`, `moveMastery`, `equipment` back to `unlockedMonsters`
- `FLEE_DUNGEON` does the same (must be symmetric)
- `START_RUN` re-hydrates those four on `createMonster`, AND returns unequipped persisted gear to `storedEquipment` (Pre-Run Unequip Recovery)
- Inventory mirroring: `ADD_ITEM`/`USE_ITEM`/`DROP_ITEM` keep `run.inventory` and `saveData.storedItems` in sync
- Cloud save write path triggered by END_RUN/FLEE_DUNGEON

Deliverable: a findings table (file:line, what's missing, severity). **No code changes** unless you greenlight them after.

---

## Layer 2 — Make the skill actually work (test hooks + addendum)

The root cause is the skill has no way to drive the game past the canvas wall. Fix it by exposing a tiny **dev debug bridge** the skill can call:

**Add `src/dev/debugBridge.ts`** (only registers when `import.meta.env.DEV` or admin flag):
```ts
window.__menagerie = {
  store: { getState, dispatch },        // direct reducer access
  scenarios: {
    enterDungeon(towerId='infinite'),
    simulateCombat({wins:1}),
    flee(),
    endRun(),
    snapshot(): { level, xp, mastery, gear, items, gold }
  }
}
```

Skill then becomes: nav → `snapshot pre` → `enterDungeon` → `simulateCombat` → `flee` → `snapshot post` → diff the four persisted fields. No more clicking tiles. Deterministic. Fast.

**Update SKILL.md:**
- Reorder steps: static check → debug-bridge scenarios → browser visual sanity last
- Document the bridge API
- Add the limitations section (already drafted)
- Add the **Suggestions-from-Results addendum** you asked for: after the report table, the skill must emit a "Suggested fixes" section with concrete next actions for each ❌/⏭️ row (e.g. "FLEE_DUNGEON missing moveMastery write → patch reducer at state.ts:LINE", "Browser couldn't enter dungeon → use debug bridge `scenarios.enterDungeon()` instead")

---

## Layer 3 — In-app Admin QA panel

New admin-only route `/admin/qa` (gated by existing `has_role('admin')`):

**UI:**
- "Run Smoke Test" button → executes the same scenario suite the skill uses (reuses `debugBridge.scenarios`)
- Live results table: each invariant as a row (✅/❌ + diff details)
- "History" tab: last 20 runs

**Logging:**
- New table `qa_runs` (user_id, ran_at, results jsonb, app_version, world_seed)
- RLS: admins read all; original admin only writes
- Each run captures: scenario results, console errors during run, cloud-save delta

**Asserted invariants** (each maps 1:1 to a memory rule):
1. END_RUN preserves level/xp/mastery/equipment
2. FLEE_DUNGEON preserves the same four + gold/materials
3. Pre-Run unequip returns gear to storage
4. ADD_ITEM mirrors to storedItems
5. Persistent dungeon floors snapshot survives flee→re-enter
6. Cloud save row updated_at advances after END_RUN

This gives you a button-press regression suite that runs in <5s and survives browser-tool limits entirely.

---

## Build order if approved

1. Layer 1 audit, report findings, stop for review
2. If reducers are clean: build the debug bridge + Admin QA page + `qa_runs` table together (one feature)
3. Update SKILL.md to use the bridge and add the addendum
4. Re-run the smoke test through the bridge to prove it works

## What I'd skip / defer

- Building a way around right-click in the real game — the in-game right-click works fine for humans; only Stagehand can't do it. Not worth working around in production code.
- Auto-running the QA suite on every publish — overkill until the panel is proven.

## Open question

For Layer 3, do you want the QA panel to also support **simulating a corrupted save** (manual fixture injection — "load this fake state then assert reducer recovers")? Powerful for regression hunting but adds ~half the build size.
