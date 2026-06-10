---
generated_at: 2026-06-10T20:00:00Z
sources:
  bugs_considered: 14
  features_considered: 0
  planned_considered: 1
top_ids:
  - bug:ffcffd41 — mobile-longpress-tooltips
  - cluster:overworld-movement — b4c013f2 + 03cd6bec + 69a179cd + plan.md
  - bug:a712c559 — one-hit-ko-ends-run
---

## Playability Priorities — 2026-06-10
Sources: 14 bugs · 0 feature requests · 1 planned doc (`.lovable/plan.md`) · prev list: no

### 🎯 Top 3 — ship these next

1. **Mobile long-press shows no tooltip for Tower of the Infinite (and likely all dungeon entrances)** — playability 4/5 · reach 5/5 · effort 1/5 · priority **20.0**
   Source: bug `ffcffd41`
   Why it matters: Mobile is a first-class target, and the entire pre-run decision (which tower, what level, what to bring) hangs on that tooltip. Without it, mobile players are launching runs blind, which directly costs them runs and gold.
   Suggested first step: In the unified long-press handler that drives `UnifiedTileMenu` / building-tooltip on overworld, pin the tooltip card to the menu (keep it open until dismissed) — same behavior we just shipped for the menu itself. Likely a one-flag change in `src/game/OverworldView.tsx` + the tooltip component used by `dungeon_entrance` tiles.

2. **Overworld movement + targeting cluster — invisible enemies, locked movement, wall-walking pathing, broken auto-harvest** — playability 5/5 · reach 5/5 · effort 3/5 · priority **8.3** (×1.2 carry-over → **10.0**)
   Source: bugs `b4c013f2`, `03cd6bec`, `69a179cd` + `.lovable/plan.md` (Overworld Movement & Targeting Repairs)
   Why it matters: The overworld is the only path into every dungeon. Right now any visible enemy locks all movement, pathing tries to mine through walls, and auto-harvest stops after one tile — together they make the overworld "nearly unplayable on mobile" (the user's own words). A plan already exists and is unshipped; every day it sits, every other priority is being judged on a broken substrate.
   Suggested first step: Execute the existing plan in `.lovable/plan.md` — start with sections 1 (loosen `startAutoWalk` halt) and 3 (tap-to-move + suppress long-press synthetic click) in `OverworldView.tsx`, since those two unlock manual play even before pathing is perfect.

3. **Dungeon run ended on a one-hit KO without the revive/switch prompt** — playability 5/5 · reach 4/5 · effort 2/5 · priority **10.0**
   Source: bug `a712c559`
   Why it matters: Memory says `last-stand-revive-prompt` and switch-on-faint already exist, but a real run ended without either firing — that's effectively save/run data loss the player can't recover from. Roguelike runs are the headline loop; a silent dead-end here erodes trust faster than any visual bug.
   Suggested first step: Reproduce by KO'ing the active monster from full HP in one hit, then check the END_RUN gate in `Index.tsx` — the revive prompt likely only runs when HP ticks to 0 via damage step, not when a single hit overflows. Branch on "active fainted AND party not fully fainted" → force `ReviveTargetModal` or the swap modal before any END_RUN dispatch.

### Honorable mentions (4–8)
| # | Item | Source | Pri | Why it's close |
|---|---|---|---|---|
| 4 | Keyboard shortcuts fire while typing in text inputs (exit-dungeon on "d") | bug `5cfcdab5` | 9.0 | Trivial fix (guard on `document.activeElement` tag) and prevents accidental run-ending keystrokes. |
| 5 | Unstuck button should be draggable/dockable (incl. feature-request button) | bugs `77efe74a`, `1099eb75` | 6.0 | Two duplicate reports — players are tripping over the button's position; small UX win. |
| 6 | Crafting materials inventory tooltips / visibility | bug `ccef9d63` | — | Likely already addressed in the recent inventory/tooltip pass; verify and close before re-prioritizing. |
| 7 | Movement-type custom moves silently no-op (dash/blink) | plan.md §4 + bug `2f91909c` | 5.0 | Blocks designer/admin iteration on move set, but no end-user reach yet. |
| 8 | Map gen lets harvestables block 1-wide corridors | plan.md §6 | 4.0 | Rare but unrecoverable when it hits; cheap post-pass. |

### Changes from previous list
- Dropped: — (no previous list)
- Carried over (still open): — (n/a)
- New entrants: all items above

### Out of scope / blocked
- **Admin panel off-screen on mobile** (`39e002c9`), **admin minimizes on bug-report select** (`49c0b24b`), **Move tab copy/accuracy-tier issues** (`759910f0`, `35c295e6`), **custom moves disappearing from admin panel** (`2f91909c`) — admin-only surface; doesn't affect player-facing playability. Worth a separate admin-polish pass, not this list.
- Anything that would re-introduce the Sprite Editor or branch menu content by viewport — excluded by Core memory rules.
