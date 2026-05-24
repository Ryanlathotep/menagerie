---
name: menagerie-smoke-test
description: "Run a full smoke test of the Menagerie game in the preview browser after any code change. Drives the preview (overworld, dungeon, combat, flee, end-run), watches console logs and game_saves, and verifies the project's known-fragile invariants (XP/mastery persistence, unified inventory, pre-run gear recovery, persistent floors). Trigger phrases include smoke test, test the game, QA the build, regression pass, check for bugs, did I break anything."
---

# Menagerie smoke test

Use this skill ANY time the user asks to smoke-test, regression-test, or "see if anything broke" in Menagerie. Browser-driven. Do not skip steps unless the user names a narrower scope.

## 0. Setup

1. `browser--navigate_to_sandbox` to `/` (NOT `/index` — that 404s) at viewport 1280×800. Stagehand snaps to 1280×720; that's fine.
2. `browser--read_console_logs` baseline — note any pre-existing errors so you don't blame the change for them.
3. If a login wall appears, stop and ask the user to sign in. Do not fill auth.

## 1. Main menu

- Verify the dungeon list renders, Overworld button is at the top, no `Start Run` button (memory: Main Menu Dungeon List).
- Verify Tower of the Infinite is always listed; themed towers only appear if discovered (memory: Major Tower Discovery).
- Click Settings → confirm Manage Waypoints + Rebuild Overworld present.

## 2. Overworld pass

1. Enter Overworld. Verify spawn near (0,0), HUD shows X/Y/Z.
2. Move 4 tiles in any cardinal direction. Confirm: tile counter increments, no enemy spawn within ~8 tiles of home (difficulty cap memory).
3. Right-click an empty tile → unified menu must show "Move here" + "Set waypoint". Right-click a tree/rock → "Harvest" or "Chop"/"Mine" appears. Right-click a building → tooltip + context menu (assign/repair/disassemble).
4. **Critical menu parity check**: switch viewport to 440×782 (mobile) WITHOUT reloading; long-press the same tile and confirm the menu contents are IDENTICAL to the desktop right-click (core rule: never branch menu by viewport).
5. Switch back to 1280×800.

## 3. Dungeon entry + run

1. Walk to nearest dungeon entrance OR open Tower of the Infinite from main menu.
2. Pre-run screen: equip a piece of gear that's in storage; withdraw a consumable; THEN unequip something previously persisted from a prior run and confirm it returns to storage on START_RUN (memory: Pre-Run Unequip Recovery — silent bug class).
3. Enter dungeon. Verify floor renders, party HP/Stamina visible, log panel reversed (newest at top).
4. Engage an enemy: click on it to auto-target. Use one melee, one ranged move. Verify ranged ~50% damage of melee (memory: Melee vs Ranged Balance) and Stamina drains.
5. Take at least one full party turn cycle: confirm enemies also pay stamina (~8/attack) and rest when out (memory: Enemy Stamina).
6. Mine a wall (5 pickaxe hits) — verify wall is gone and persists.
7. Place a waypoint on the current floor. Go up stairs, come back down — waypoint and mined wall must still be there (memory: Persistent Dungeon Floors).

## 4. Persistence — the highest-bug-risk area

Before fleeing, note in chat: current floor, party member levels + XP bars, one move's mastery uses, equipped gear list, gold/material counts.

1. Use a Town Portal Scroll OR flee via Settings → Flee. Confirm prompt appears.
2. Back in Overworld/main menu, open the same monster's character sheet.
3. **Verify all four** (memory: Persistent XP & Mastery, core rule):
   - level retained
   - experience bar at same %
   - moveMastery uses incremented and persisted
   - equipment unchanged
4. Verify gold/materials/items match (memory: No Death Losses — flee and END_RUN behave identically).
5. If user is signed in, `supabase--read_query` `select updated_at, save_data->'unlockedMonsters'->0->'experience' from game_saves where user_id = auth.uid() order by updated_at desc limit 1` to confirm cloud save wrote the XP.

## 5. End-run path

Repeat steps 3–4 but let the full party faint instead of fleeing. END_RUN must preserve the same four fields. This is the #1 historical regression site — never skip.

## 6. Final sweep

- `browser--read_console_logs` filter `error` and `warn` — diff against the baseline from step 0.2. Report only NEW entries.
- `browser--list_network_requests` — look for failed Supabase calls (4xx/5xx on `/rest/v1/game_saves`, `/rest/v1/rpc/submit_*`).
- `code--read_runtime_errors` for any uncaught React errors.

## Reporting

End with a short table:

| Step | Result | Notes |
|------|--------|-------|
| Menu parity | ✅/❌ | … |
| Pre-run unequip recovery | ✅/❌ | … |
| Flee preserves XP/mastery/gear/items | ✅/❌ | … |
| END_RUN preserves XP/mastery/gear/items | ✅/❌ | … |
| Persistent floor (mined wall + waypoint) | ✅/❌ | … |
| New console errors | count | first error message |

If anything failed, name the suspected file/reducer (state.ts END_RUN / FLEE_DUNGEON handlers are the usual culprits) and STOP before fixing — confirm with user first.

## Don't do

- Don't run this skill speculatively when the user only asked a code question.
- Don't fill login forms.
- Don't sign up for new accounts to "test fresh state" — use existing session.
- Don't claim a bug is fixed without re-running steps 4 and 5.
