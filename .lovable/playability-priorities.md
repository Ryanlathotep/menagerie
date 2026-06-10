---
generated_at: 2026-06-10T21:00:00Z
sources:
  bugs_considered: 11
  features_considered: 0
  planned_considered: 1
top_ids:
  - bug:5cfcdab5 — shortcuts-fire-in-text-inputs
  - bug:ccef9d63 — crafting-materials-inventory-verify
  - cluster:dockable-utility-buttons — 77efe74a + 1099eb75
---

## Playability Priorities — 2026-06-10 (re-run)
Sources: 11 bugs still open · 0 feature requests · 1 planned doc · prev list: yes (2026-06-10 20:00Z)

### 🎯 Top 3 — ship these next

1. **Keyboard shortcuts fire while typing in text inputs (can trigger Exit Dungeon on a "d")** — playability 4/5 · reach 4/5 · effort 1/5 · priority **16.0**
   Source: bug `5cfcdab5`
   Why it matters: A stray keystroke in a rename/chat/admin field can end a run or open a destructive modal — that's silent run-loss territory. The fix is one global guard and prevents a whole class of accidents across every text input in the app.
   Suggested first step: In the global keydown handler (likely the one in `src/pages/Index.tsx` that powers Shift+1-9 hotbar and movement keys), early-return when `document.activeElement` is `INPUT`, `TEXTAREA`, or has `contentEditable`. One block, applies everywhere.

2. **Verify (or finish) the crafting-materials inventory/tooltip fix** — playability 3/5 · reach 5/5 · effort 1/5 · priority **15.0**
   Source: bug `ccef9d63`
   Why it matters: Crafting is the gateway from materials to gear, which is the gateway to climbing higher floors. The recent inventory/tooltip pass should have addressed this, but no one has confirmed and the bug is still flagged `open` in the DB. Five minutes of verify-or-close keeps the backlog honest.
   Suggested first step: Open the inventory on mobile + desktop with a fresh save that contains at least one crafting material; confirm the material card renders, shows the rarity-colored tooltip, and the new "Used in N recipes" block populates. If green, mark the report `resolved`. If still broken, the gap is almost certainly in the materials → `InventoryItemCard` render path in `GameSidebar.tsx`.

3. **Make Unstuck (and Feature Request / Bug Report) buttons draggable + dockable** — playability 3/5 · reach 4/5 · effort 2/5 · priority **6.0**
   Source: bugs `77efe74a` + `1099eb75` (duplicate reports)
   Why it matters: Two reports about the same thing means it's actively in the way during real play, especially on mobile where it overlaps combat controls. Not a crash, but the highest-reach UX papercut still open.
   Suggested first step: Mirror the drag/dock logic already used by the Bug Report button onto the Unstuck button, then refactor both into a shared `<FloatingActionButton>` so the Feature Request button can opt in too. Persist position to localStorage keyed by button id.

### Honorable mentions
| # | Item | Source | Pri | Why it's close |
|---|---|---|---|---|
| 4 | Movement-type custom moves silently no-op (dash/blink) | plan.md §4 + bug `2f91909c` | 5.0 | Unblocks designer iteration; was in the original plan — confirm it was actually shipped in the movement cluster pass, otherwise it should jump back into the top 3. |
| 5 | Harvestables can fully block 1-wide corridors | plan.md §6 | 4.0 | Rare but unrecoverable when it hits. Cheap chunk-gen post-pass — also confirm whether it shipped. |

### Changes from previous list
- **Dropped (user says shipped):**
  - `ffcffd41` — Mobile long-press dungeon tooltips
  - Overworld movement cluster (`b4c013f2`, `03cd6bec`, `69a179cd` + `.lovable/plan.md` §1, §3)
  - `a712c559` — One-hit KO revive prompt
- **Carried over (still open):** none — all three prior priorities are out.
- **New entrants:** `5cfcdab5` (typing-shortcut guard), `ccef9d63` (verify crafting inventory), `77efe74a`/`1099eb75` (dockable buttons). Promoted from honorable-mentions in the previous list.
- ⚠️ Note: every bug row in the DB is still marked `open`. Once the prior top 3 are verified live, flipping their `status` keeps future re-runs accurate without leaning on memory.

### Out of scope / blocked
- Admin-only bugs: `39e002c9` (panel off-screen mobile), `49c0b24b` (panel minimizes on bug select), `759910f0` (copy-move function), `35c295e6` (accuracy tier direction) — don't affect player-facing playability. Worth a dedicated admin-polish pass, not this list.
- Anything that would re-introduce the Sprite Editor or branch menu content by viewport — excluded by Core memory rules.
