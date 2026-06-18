---
generated_at: 2026-06-18T00:30:00Z
sources:
  bugs_considered: 9
  features_considered: 0
  planned_considered: 1
top_ids:
  - bug:a712c559 — one-hit-ko-ended-run
  - bug:ffcffd41 — tower-infinite-tooltip-empty
  - bug:03cd6bec — pathing-edge-cases
---


## Playability Priorities — 2026-06-18 (post-fix re-run)
Sources: 9 open bugs · 0 open feature requests · 1 planned doc · prev list: yes (2026-06-18 00:00Z) · completed log: `.lovable/playability-completed.md`

### ✅ Completed since last run
- `b4c013f2` — Invisible enemies + movement locked → **resolved** (see completed log for root cause + 3-site fix).

> Full history of shipped items now lives in `.lovable/playability-completed.md` — re-runs should diff against that file before proposing work.



### 🎯 Top 3 — ship these next

1. **Invisible enemies + movement lock in combat** — playability 5/5 · reach 4/5 · effort 3/5 · priority **6.7**
   Source: bug `b4c013f2`
   Why it matters: Reported after the overworld movement cluster shipped. Enemies render as empty sprites and the player can't move — that's a hard run-stopper. Highest-severity open report.
   Suggested first step: Repro on overworld first (where the report originated), then check whether the enemy `monster` payload survives the new movement-sync path in `OverworldView.tsx` (isMovingRef lock + rAF timing). Likely cause: stale enemy reference after async chunk regen, or the movement lock not releasing on combat trigger.

2. **Dungeon run ended from a one-hit KO with no revive prompt** — playability 5/5 · reach 3/5 · effort 2/5 · priority **5.0**
   Source: bug `a712c559`
   Why it matters: Previous list claimed the Last-Stand revive prompt shipped, but the bug row is still `open` and no follow-up confirms the prompt fires on full-party faint in the exact path the reporter used. Silent run-loss = the worst possible bug class for a roguelike.
   Suggested first step: Trace `END_RUN` callers in `DungeonView.tsx` / battle resolution; verify `ReviveTargetModal` is offered *before* dispatching END_RUN whenever inventory has a revive item. Add a regression assert to `menagerie-smoke-test`.

3. **Tower of the Infinite tooltip is empty on mobile long-press** — playability 3/5 · reach 4/5 · effort 1/5 · priority **4.0**
   Source: bug `ffcffd41`
   Why it matters: Players can't see floor / level / difficulty before committing — they enter blind on mobile. Marked shipped previously, but the row is still `open`, suggesting the long-press path didn't cover the main-menu dungeon list. Cheap to verify and patch.
   Suggested first step: Open the main-menu dungeon list on a touch device, long-press the Tower of the Infinite row, and confirm the same tooltip body renders as on hover. If empty, the touch handler in `DungeonListPanel.tsx` isn't reading the same `getDungeonTooltip()` payload.

### Honorable mentions
| # | Item | Source | Pri | Why it's close |
|---|---|---|---|---|
| 4 | Pathing edge cases (`03cd6bec`) | bug | 3.5 | Movement cluster shipped, but reporter never confirmed. Verify-or-close. |
| 5 | Auto-harvest issue (`69a179cd`) | bug | 3.0 | Same — likely fixed in the auto-mine pass; needs a touch repro. |
| 6 | Custom moves disappeared from admin panel (`2f91909c`) | bug + plan §4 | 3.0 | Blocks designer iteration, not direct play; bump if it's still reproducible. |

### Changes from previous list
- **Dropped (shipped + verified in DB):** `5cfcdab5`, `ccef9d63`, `77efe74a`, `1099eb75`. All three previous top items are out.
- **Carried over (still open):** none from the previous top 3.
- **New entrants in top 3:** `b4c013f2`, `a712c559`, `ffcffd41` — all promoted from older "carry-over suspect" status because they're still flagged `open` despite related work shipping.

### Out of scope / blocked
- Admin-only: `39e002c9`, `49c0b24b`, `759910f0`, `35c295e6` — not player-facing playability. Batch into a dedicated admin-polish pass.
- Anything that would re-introduce the Sprite Editor or branch menu content by viewport (Core memory).
