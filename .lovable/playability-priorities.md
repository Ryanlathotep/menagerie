---
generated_at: 2026-07-07T00:00:00Z
sources:
  bugs_considered: 9
  features_considered: 0
  planned_considered: 1
top_ids:
  - todo:long-press-quickcast — player-avatar-quick-cast
  - todo:damage-type-clarity — melee-vs-ranged-tooltip-tags
  - todo:move-panel-aoe-filter — search-filter-for-aoe
---


## Playability Priorities — 2026-07-07 (post pathing + auto-harvest)
Sources: 9 open bugs in DB (4 already resolved but flagged open — see note) · 0 feature requests · 1 planned doc · completed log: `.lovable/playability-completed.md`

### ✅ Completed since last run
- `03cd6bec` — pathing walks through mineable walls (dungeon A* now gates `mineable_wall` on `settings.autoMine`).
- `69a179cd` — auto-harvest chains to adjacent same-type + auto-starts after far-tap arrival.
- Earlier: `ffcffd41` (mobile long-press tooltips app-wide), `a712c559` (revive prompt), wall-blocking pass, invisible-enemy fix.

> DB rows for `ffcffd41`, `a712c559`, `03cd6bec`, `69a179cd` are still `status='open'` in `bug_reports` because the priorities skill only has read-only SQL. Next admin bug-triage pass should close them.

### 🎯 Top 3 — ship these next

1. **Long-press player avatar → quick-cast self-buff / movement menu** — playability 3/5 · reach 5/5 · effort 2/5 · priority **3.8**
   Source: `docs/todo/menagerie-todos.md` → Unified Context Menu · Long-Press Interaction
   Why it matters: Now that long-press works everywhere (yesterday's tooltip fix), the active-monster avatar is the last obvious spot with no menu. Casting dash / heal / haste today requires the full move panel — big friction on mobile.
   First step: In `PartyPanel.tsx`, wrap the active-member button with a long-press handler that opens `UnifiedMovePanel` pre-filtered to `target === 'self' || movement === true`. Reuse the tooltip long-press timing (~400ms) so the gesture is consistent.

2. **Damage-type clarity in move tooltips (Melee ST vs Physical AoE, Ranged ST vs Ranged AoE)** — playability 3/5 · reach 4/5 · effort 2/5 · priority **3.0**
   Source: todos → Combat & Core Systems · Damage Type Refactor
   Why it matters: After the wall-blocking + LOS fixes players still can't tell at a glance which of their moves are ranged vs melee vs AoE. Cheap: add labels + colored chips in the move list.
   First step: `src/game/UnifiedMovePanel.tsx` — surface `getAttackConfig(move)` shape/range as a badge on each row.

3. **AoE-only search filter in move panel** — playability 2/5 · reach 4/5 · effort 1/5 · priority **2.4**
   Source: todos → Search Engine
   Why it matters: Small filter add to `MoveSortFilter.tsx`; huge win for team-building against groups.
   First step: Add a "AoE only" toggle that filters via `getAttackConfig(move).shape !== 'single'`.

### Honorable mentions
| # | Item | Source | Pri | Why it's close |
|---|---|---|---|---|
| 4 | Fog of War rendering on overworld | todos → World Elements | 2.2 | Makes discovery/exploration leaderboards meaningful. Bigger effort. |
| 5 | Shiny variant generator (color shift + hidden IVs) | project intent | 2.0 | Discussed since day 1, still not shipped. Core-loop hook. |
| 6 | Evolution / Reincarnation prestige lifecycle | todos | 1.8 | Long-term; needs a plan doc first. |

### Out of scope right now
- Admin-only bugs `39e002c9`, `49c0b24b`, `759910f0`, `35c295e6`, `2f91909c` — batch into a single admin-polish pass; none block players.
- Arena system, Forge Dungeon System — large multi-week features, need their own plan doc before ranking.
- Anything that reintroduces the Sprite Editor or branches menu content by viewport (Core memory).
