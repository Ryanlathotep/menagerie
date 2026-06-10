---
name: playability-priorities
description: Cross-source prioritization for Menagerie — searches open bug_reports, feature_requests, and planned/roadmap notes (including the previously saved priority list), then recommends the 3 most playability-impactful changes. Use when the user says "what should I work on", "prioritize everything", "top priorities", "playability priorities", "what affects playability most", or similar cross-cutting planning asks. For bug-only triage, defer to the bug-triage skill.
---

# Playability Priorities

Goal: a single ranked view of everything competing for dev time — open bugs, requested features, and planned work — filtered through one lens: **what most improves the player's ability to actually play and enjoy the game right now**. Output the top 3 with reasoning, then overwrite the saved priority list so the next run can compare and re-rank.

## 1. Gather all sources (in parallel)

a) **Bug reports** — `supabase--read_query`:
```sql
select id, title, description, category, status, username, created_at, context
from public.bug_reports
where status in ('open','in_progress')
order by created_at desc
limit 200;
```

b) **Feature requests** — `supabase--read_query`:
```sql
select id, title, description, category, status, vote_count, username, created_at
from public.feature_requests
where status in ('open','planned','in_progress')
order by vote_count desc nulls last, created_at desc
limit 200;
```

c) **Planned / roadmap notes** — read in parallel:
- `.lovable/plan.md` (current plan, if present)
- `mem://index.md` Core rules and any `expansion-roadmap` / roadmap memories referenced there (e.g. `gameplay/overworld/expansion-roadmap`)
- `docs/intent/` if present (design bible items not yet shipped)

d) **Previous priority list** — read `.lovable/playability-priorities.md` if it exists. Use it to detect:
- carry-overs (still unresolved after last run → bump urgency)
- resolved items (drop)
- newly-surfaced higher-impact items (note the shift)

If a source is empty or unreadable, note it and continue.

## 2. Score every item on PLAYABILITY IMPACT

This skill optimizes for playability, not novelty or vote count alone. Score each candidate:

- **Playability (1–5)** — does fixing/shipping this let more players reach more of the game?
  - 5 = unblocks core loop (crash, save loss, can't enter run, broken combat, stuck movement)
  - 4 = degrades a daily-use system (inventory, equipment, tile menu, mobile controls)
  - 3 = friction in a major optional system (crafting, leaderboards, building)
  - 2 = QoL / polish that compounds over a long session
  - 1 = cosmetic, niche, or admin-only
- **Reach (1–5)** — share of active players affected. Multiple matching reports / high vote count → higher.
- **Effort (1–5)** — rough size. 1 = small targeted change. 5 = cross-cutting refactor.
- **Priority = playability × reach / effort**, rounded to 1 decimal.

Mandatory bumps:
- Crash / data-loss / save-corruption / blocks-play → playability floor 5.
- Mobile-only break while desktop works → reach +1 (mobile is a first-class target).
- Item appears in previous priority list AND still open → priority × 1.2 (staleness penalty against the backlog).
- Violates a Core memory rule (e.g. reintroducing Sprite Editor, branching menus by viewport) → exclude, list under "Out of scope".

## 3. Pick the top 3

Choose the 3 highest-priority items across ALL sources combined. Prefer diversity: don't ship 3 variants of the same cluster — collapse duplicates first (same dedup approach as bug-triage). If two items tie, prefer the one with a smaller effort.

## 4. Write the report AND save it

Print this exact shape to the user:

```
## Playability Priorities — {date}
Sources: {B} bugs · {F} feature requests · {P} planned items · prev list: {yes/no, date}

### 🎯 Top 3 — ship these next
1. **{title}** — playability {X}/5 · reach {Y}/5 · effort {Z}/5 · priority {P}
   Source: {bug #id | feature #id | plan/{file} | memory/{path}}
   Why it matters: {1–2 sentences tying directly to player experience — what they can't do today, or what becomes possible.}
   Suggested first step: {one concrete action — file/area to touch, or migration to add.}

2. …
3. …

### Honorable mentions (4–8)
| # | Item | Source | Pri | Why it's close |
|---|---|---|---|---|

### Changes from previous list
- Dropped: {items resolved or superseded}
- Carried over (still open): {items}
- New entrants: {items}

### Out of scope / blocked
- {item} — reason
```

Then **overwrite** `.lovable/playability-priorities.md` with the same content (plus a YAML frontmatter block at top for future diffing):

```yaml
---
generated_at: {ISO timestamp}
sources:
  bugs_considered: {B}
  features_considered: {F}
  planned_considered: {P}
top_ids:
  - {stable id or short slug for #1}
  - {…#2}
  - {…#3}
---
```

Use `code--write` to overwrite — never append. The file is a rolling snapshot, not a log.

## 5. Don't do these

- Don't modify bug or feature-request rows (no status changes here — that's `bug-triage`'s job).
- Don't recommend work that violates Core memory rules.
- Don't pad the top 3 — if only 1 or 2 items clear playability ≥ 4, say so and list fewer.
- Don't dump raw descriptions or JSONB; paraphrase.
