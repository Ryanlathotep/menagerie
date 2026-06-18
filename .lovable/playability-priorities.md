---
generated_at: 2026-06-18T01:30:00Z
sources:
  bugs_considered: 9
  features_considered: 0
  planned_considered: 1
top_ids:
  - bug:03cd6bec — pathing-edge-cases
  - bug:69a179cd — auto-harvest-issue
  - bug:2f91909c — custom-moves-missing-admin
---


## Playability Priorities — 2026-06-18 (post-tooltip)
Sources: 9 open bugs · 0 open feature requests · 1 planned doc · prev list: yes (2026-06-18 01:00Z) · completed log: `.lovable/playability-completed.md`

### ✅ Completed since last run
- `ffcffd41` — Tower of the Infinite tooltip empty on mobile long-press → **resolved** (added shared `getDungeonTooltip` + ⓘ Popover; parity preserved).
- Earlier today: `a712c559` (revive prompt), `b4c013f2` (invisible enemies), wall-blocking pass.

> Full shipped history lives in `.lovable/playability-completed.md` — diff against it before proposing new work.

### 🎯 Top 3 — ship these next

1. **Pathing edge cases on overworld** — playability 3/5 · reach 4/5 · effort 2/5 · priority **3.5**
   Source: bug `03cd6bec`
   Why it matters: Movement cluster shipped earlier and just got further hardened by the invisible-enemy + wall-block fixes. Worth a fresh repro to confirm it's actually still failing.
   Suggested first step: Walk the reporter's repro path through dense tile mixes (trees, water, cliffs, walls) on mobile. If clean, mark resolved and log. Otherwise capture the new case in `findOverworldPath` (`src/game/overworldPathfinding.ts`).

2. **Auto-harvest stops/starts oddly** — playability 3/5 · reach 4/5 · effort 2/5 · priority **3.0**
   Source: bug `69a179cd`
   Why it matters: Likely partially fixed by the auto-mine pass; one of the remaining causes is probably enemy-detection halting mid-swing.
   Suggested first step: Long-press a tree/rock cluster on mobile, confirm auto-harvest exits cleanly on out-of-stamina, out-of-fuel, and enemy-spotted. Compare to `src/game/autoShovel.ts` for the canonical halt pattern.

3. **Custom moves missing from admin panel** — playability 2/5 · reach 4/5 · effort 2/5 · priority **3.0**
   Source: bug `2f91909c` + plan §4
   Why it matters: Blocks designer iteration but not direct play. Cheap to verify; if the moveOverrides hydration is broken, every admin-made move disappears between sessions.
   Suggested first step: Open `src/admin/MovesEditor.tsx`, save a new custom move, refresh — confirm it persists via `moveOverrides`. If not, trace the hydration path.

### Honorable mentions
| # | Item | Source | Pri | Why it's close |
|---|---|---|---|---|
| 4 | (none open, non-admin) | — | — | All other open rows are admin-only and batched separately. |

### Changes from previous list
- **Dropped (shipped + logged):** `ffcffd41` (tower tooltip).
- **Promoted:** `03cd6bec` → #1, `69a179cd` → #2, `2f91909c` (admin-but-cheap) → #3.

### Out of scope / blocked
- Admin-only: `39e002c9`, `49c0b24b`, `759910f0`, `35c295e6` — batch into a dedicated admin-polish pass.
- Anything that would re-introduce the Sprite Editor or branch menu content by viewport (Core memory).


