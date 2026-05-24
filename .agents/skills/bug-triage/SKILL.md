---
name: bug-triage
description: Triage Menagerie bug reports from the bug_reports table — pull open reports, group them into related clusters, score severity vs. effort, and recommend which to tackle next. Use when the user says "check bug reports", "triage bugs", "what bugs should I fix", "prioritize bug reports", or similar.
---

# Bug Triage

Goal: turn the open backlog in `public.bug_reports` into a short, ranked, deduped action list the user can act on in one sitting.

## 1. Pull the data

Use `supabase--read_query`. Default scope: `status = 'open'`. If the user says "all", include `in_progress` too. Skip `closed`/`resolved`.

```sql
select id, title, description, category, status, username,
       created_at, context, admin_notes
from public.bug_reports
where status in ('open')
order by created_at desc
limit 200;
```

If >200 rows, page by `created_at`. Note total count to the user.

`context` is JSONB — typically contains route, viewport, gameVersion, lastActions. Use it for dedup signals and repro hints; do not dump it raw to the user.

## 2. Classify

Assign every report exactly one **category** and any number of **tags**.

Categories (pick one):
- `combat` — damage, turn order, stamina, status effects, AI
- `movement` — pathing, auto-run, stairs, collision, stuck
- `overworld` — generation, biomes, buildings, roads, elevation
- `dungeon` — floor gen, persistence, staircase, nests, traps
- `inventory-equipment` — items, slots, sets, drops, crafting
- `ui-menu` — unified tile menu, tooltips, modals, hotbar, mobile controls
- `progression` — XP, mastery, leveling, monster persistence, leaderboards
- `economy` — gold, shop, recipes, materials
- `particles-fx` — particle effects, sprite rendering, visuals
- `auth-cloud` — login, save sync, admin
- `performance` — fps, freezes, memory
- `crash` — runtime error, white screen
- `other` — anything that doesn't fit

Tags (free-form, e.g. `regression`, `mobile`, `tablet`, `admin-only`, `data-loss`, `blocks-play`, `cosmetic`, `needs-repro`, `flaky`).

Pull category from the column when set; otherwise infer from title + description + context.route.

## 3. Cluster

Group reports that describe the same underlying issue. Signals:
- High title/description similarity (paraphrase the symptom and compare).
- Same `context.route` + same category + overlapping keywords.
- Same error string in `context`.

Output one cluster per root cause. Cite member report IDs (short — first 8 chars of UUID). The cluster's severity = max member severity; effort = single fix.

## 4. Score

For each cluster compute:

- **Severity** (1–5):
  - 5 = crash, data loss, save corruption, blocks all play
  - 4 = blocks a major loop (run, combat, overworld) for many users; no workaround
  - 3 = feature broken but workaround exists, or affects one platform
  - 2 = minor bug, wrong number/visual, annoying but playable
  - 1 = cosmetic / typo / nitpick
- **Reach** (1–5): how many reports back it × likelihood every player hits it. Lone cosmetic report = 1; 4 reports about the same crash = 5.
- **Effort** (1–5): rough fix size. 1 = one-line / token change. 5 = cross-cutting refactor.
- **Priority** = `severity * reach / effort`, rounded to 1 decimal.

Apply project-aware bumps:
- `crash`, `data-loss`, `blocks-play` → severity floor 4.
- Anything in `src/pages/Index.tsx` cluster — flag `large-file-risk` because that file is 6k+ lines (see audit memory). Don't lower priority, but warn.
- Memory constraints win: never propose work that violates a Core memory rule (e.g. reintroducing Sprite Editor, branching menus by viewport). Flag those clusters as `out-of-scope` and exclude from "tackle next".

## 5. Recommend

Produce the report in this exact shape:

```
## Bug Triage — {N open reports → M clusters}

### 🔥 Tackle next (top 3)
1. **{cluster title}** — sev {S} · reach {R} · effort {E} · priority {P}
   {one-sentence summary}
   Reports: {id1, id2, …}
   Suggested fix: {1–2 sentences, point to the file/area}

### Full ranking
| # | Cluster | Cat | Sev | Reach | Effort | Pri | IDs |
|---|---|---|---|---|---|---|---|
| 1 | … | combat | 5 | 4 | 2 | 10.0 | a1b2c3d4, … |

### Needs more info
- {cluster} — missing repro / route / screenshot. Reports: {ids}

### Out of scope / won't fix
- {cluster} — reason (violates memory rule X, duplicate of closed #…, etc.)
```

Keep the whole reply scannable. No raw JSONB dumps. Don't paste full descriptions — paraphrase.

## 6. Optional follow-ups

Only offer these if the user asks or the list is short enough to act on now:
- Mark a cluster's reports as `in_progress` via `supabase--insert` (UPDATE on `bug_reports.status`).
- Open the top cluster's first report ID for the user to inspect.
- Create task-tracker tasks for the top 3 clusters.

Never auto-close or auto-resolve reports.
