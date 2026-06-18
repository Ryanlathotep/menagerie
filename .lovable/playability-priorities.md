---
generated_at: 2026-06-18T01:00:00Z
sources:
  bugs_considered: 9
  features_considered: 0
  planned_considered: 1
top_ids:
  - bug:ffcffd41 — tower-infinite-tooltip-empty
  - bug:03cd6bec — pathing-edge-cases
  - bug:69a179cd — auto-harvest-issue
---


## Playability Priorities — 2026-06-18 (post-revive-prompt)
Sources: 9 open bugs · 0 open feature requests · 1 planned doc · prev list: yes (2026-06-18 00:30Z) · completed log: `.lovable/playability-completed.md`

### ✅ Completed since last run
- `a712c559` — One-hit KO ended run with no revive prompt → **resolved** (see completed log; fixed BattleView + OverworldView END_RUN paths).
- Earlier: `b4c013f2` (invisible enemies), wall-blocking pass.

> Full shipped history lives in `.lovable/playability-completed.md` — diff against it before proposing new work.

### 🎯 Top 3 — ship these next

1. **Tower of the Infinite tooltip is empty on mobile long-press** — playability 3/5 · reach 4/5 · effort 1/5 · priority **4.0**
   Source: bug `ffcffd41`
   Why it matters: Players can't see floor / level / difficulty before committing on mobile.
   Suggested first step: Open the main-menu dungeon list on a touch device, long-press the Tower row, confirm the same `getDungeonTooltip()` body renders. If empty, the touch handler in `DungeonListPanel.tsx` isn't reading the same payload.

2. **Pathing edge cases on overworld** — playability 3/5 · reach 4/5 · effort 2/5 · priority **3.5**
   Source: bug `03cd6bec`
   Why it matters: Movement cluster shipped earlier and just got further hardened. Worth a fresh repro pass through dense tile mixes (trees, water, cliffs, walls) on mobile.
   Suggested first step: Walk the reporter's repro path; if clean, mark resolved. Otherwise capture in `findOverworldPath` (`src/game/overworldPathfinding.ts`).

3. **Auto-harvest issue** — playability 3/5 · reach 4/5 · effort 2/5 · priority **3.0**
   Source: bug `69a179cd`
   Why it matters: Likely fixed in the auto-mine pass; needs a touch repro to confirm or capture the new failure mode.
   Suggested first step: Hold long-press over a tree/rock cluster on mobile, confirm auto-harvest stops cleanly when out of stamina / out of fuel / on enemy detection.

### Honorable mentions
| # | Item | Source | Pri | Why it's close |
|---|---|---|---|---|
| 4 | Custom moves disappeared from admin panel (`2f91909c`) | bug + plan §4 | 3.0 | Blocks designer iteration, not direct play; bump if still reproducible. |

### Changes from previous list
- **Dropped (shipped + logged):** `a712c559` (revive prompt).
- **Promoted:** `ffcffd41` → #1, `03cd6bec` → #2, `69a179cd` from honorable mentions → #3.

### Out of scope / blocked
- Admin-only: `39e002c9`, `49c0b24b`, `759910f0`, `35c295e6` — batch into a dedicated admin-polish pass.
- Anything that would re-introduce the Sprite Editor or branch menu content by viewport (Core memory).

