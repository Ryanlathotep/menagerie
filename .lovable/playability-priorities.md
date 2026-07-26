---
generated_at: 2026-07-26T00:00:00Z
sources:
  bugs_considered: 9
  features_considered: 1
  planned_considered: 2
top_ids:
  - todo:modal-scroll-close-sweep — players-stuck-on-fullscreen-panels
  - todo:movement-move-range-preview — rotate-and-show-reachable-tiles
  - todo:move-panel-aoe-filter — search-filter-for-aoe
---

## Playability Priorities — 2026-07-26
Sources: 9 open bugs in DB (5 admin-only, 4 already fixed but still flagged open) · 1 feature request (`c42e97c2` GM room tool) · 2 planned docs (`.lovable/plan.md` phases 2–3, `docs/todo/menagerie-todos.md`) · prev list: yes, 2026-07-07

### 🎯 Top 3 — ship these next

1. **Modal scroll + top close-button sweep across every full-screen panel** — playability 5/5 · reach 5/5 · effort 2/5 · priority **12.5**
   Source: this session's report ("players are getting stuck on this screen") — `LevelUpScreen` fixed, rest of the app not
   Why it matters: A panel with no close button and no scroll is a hard softlock on a 440px phone — the run can't continue and the only exit is a reload, which risks save state. Only `LevelUpScreen` got the fix; `RecruitmentModal`, `PreRunEquipment`, `CraftingWorkshop`, `EquipmentView`, `CharacterSheet`, `ElevatorModal`, `TeamDetailModal` and the arena panels share the same layout risk.
   First step: Audit every component rendering a `fixed inset-0` card, then apply the `LevelUpScreen` pattern — `max-h-full`/`overflow-y-auto` body plus a top-right `X` — ideally via one shared `FullScreenPanel` wrapper so future screens inherit it.

2. **Movement moves: rotate direction + preview every reachable tile** — playability 4/5 · reach 5/5 · effort 2/5 · priority **10.0**
   Source: this session's mobile-combat report (only the attack half was fixed)
   Why it matters: The attack two-tap flow now works, but movement skills (dash/leap/shift) still don't rotate their pattern or highlight legal destinations, so players can't tell where a dash will land and often feel stuck with an enemy adjacent. This is the other half of the "feels stuck in combat" complaint.
   First step: In `src/game/AttackTargeting.tsx`, treat `config.pattern === 'self'`/movement moves as a destination picker — feed `getValidTargets` walkable tiles and render them like the range overlay, with cursor-relative rotation for directional patterns.

3. **AoE-only filter in the move panel** — playability 2/5 · reach 4/5 · effort 1/5 · priority **9.6** (8.0 × 1.2 staleness)
   Source: `docs/todo/menagerie-todos.md` → Unified Context Menu · Search Engine · carried over from 2026-07-07
   Why it matters: Cheapest item on the board and it makes the crowded 100+ move list usable when fighting groups. Third run in a row it has been listed.
   First step: Add an "AoE only" toggle to `src/game/MoveSortFilter.tsx` filtering on `getAttackConfig(move).shape !== 'single'`; it inherits into `EnemyAttackMenu` automatically via `persistedFilters`.

### Honorable mentions (4–8)
| # | Item | Source | Pri | Why it's close |
|---|---|---|---|---|
| 4 | Long-press player avatar → quick-cast self-buff/movement menu | todos → Long-Press Interaction | 9.0 | Carried over twice; overlaps heavily with #2, ship right after it |
| 5 | Damage-type clarity chips in move tooltips (melee/ranged × ST/AoE) | todos → Damage Type Refactor | 7.2 | Carried over; small badge work in `UnifiedMovePanel` |
| 6 | Arena team entry not persisting / not appearing in Bets | this session's arena reports | 4.0 | Partially patched; needs a verification pass before re-ranking |
| 7 | GM Room tool palette (empty cells, cliffs, levers, spawn markers) | feature `c42e97c2` + plan Phase 2 | 2.4 | High player-authoring value but multi-turn, cross-system effort |
| 8 | Fog of War rendering on overworld | todos → World Elements | 2.2 | Makes exploration leaderboards meaningful; medium effort |

### Changes from previous list
- Dropped: nothing resolved from the previous top 3 — but two new higher-impact items (modal softlock, movement targeting) surfaced above them.
- Carried over (still open): AoE-only filter (now #3, staleness-bumped), avatar quick-cast (#4), damage-type clarity (#5).
- New entrants: modal scroll/close sweep (#1), movement-move targeting preview (#2), arena entry persistence (#6), GM room tool feature request (#7).

### Out of scope / blocked
- Admin-only bugs `39e002c9`, `49c0b24b`, `759910f0`, `35c295e6`, `2f91909c` — batch into one admin-polish pass; none block players.
- Bugs `ffcffd41`, `a712c559`, `03cd6bec`, `69a179cd` — fixed in code, DB rows still `open`; needs a bug-triage pass to close (this skill is read-only on those tables).
- Plan Phase 3 items (torches, pressure plates, secret doors, pushable boxes) — blocked on Phase 2 room-editor palette landing first.
- Arena System / Forge Dungeon expansions — multi-week, need their own plan doc before ranking.
- Anything reintroducing the Sprite Editor or branching menu content by viewport (Core memory).
