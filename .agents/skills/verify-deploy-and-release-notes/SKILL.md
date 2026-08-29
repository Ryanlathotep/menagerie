---
name: verify-deploy-and-release-notes
description: Verify that a Menagerie push actually deployed to GitHub (Actions + Pages) and itch.io, then generate release highlights and publish them as a GitHub Release plus an itch.io devlog draft. Use when the user asks "did my push go through", "check the itch/GitHub deploy", or "write release notes / changelog / patch notes".
---

# Verify deploys + publish release highlights

Two jobs, always in this order: **prove the build shipped**, then **describe what shipped**.

Never claim a deploy succeeded from a green local build. Only workflow conclusions and live URLs count.

## Setup facts for this project

- Deploy workflows: `.github/workflows/build.yml` (itch.io via butler, channel `maligore/menagerie:html5`) and the GitHub Pages workflow in the same folder.
- itch.io build labels use `${GITHUB_SHA::7}-<UTC timestamp>` as `--userversion`.
- The project's git `origin` is Lovable's internal remote, **not** GitHub. So `git`/`gh` cannot read Actions state — use the **GitHub connector** for all GitHub API reads/writes.
- Public URLs: itch page `https://maligore.itch.io/menagerie`, published web app `https://menagerie.lovable.app`.

## Step 1 — Verify GitHub

1. `standard_connectors--list_connections` → find a GitHub connection with `has access: yes`. If none, call `standard_connectors--connect` with `connector_id: github` and stop until it is linked.
2. Read the latest runs for each deploy workflow:
   `GET /repos/{owner}/{repo}/actions/runs?per_page=10&branch=main`
   Record for each: `name`, `head_sha`, `status`, `conclusion`, `created_at`, `html_url`.
3. A workflow only passes when `status: completed` and `conclusion: success`. `in_progress`/`queued` = not verified yet; say so and offer to re-check.
4. On failure, pull the failing job:
   `GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs` → report the failed step name, then read logs if needed. Common causes are documented in `references/failure-modes.md`.

## Step 2 — Verify itch.io

1. From the itch build workflow log (or run conclusion), confirm the `Verify Butler credentials` and `Push build to itch.io` steps both succeeded.
2. Live check the playable page — the HTML5 embed must load, not 404:
   `scripts/check_live.sh` (curls the itch page and the published app, asserts HTTP 200 and that the itch page contains an embed/`html-classic.itch.zone` reference).
3. If butler pushed but the page 404s inside the iframe, the cause is almost always base-path/route handling, not the upload — check `src/App.tsx` route normalization and the `--base ./` build flag.

## Step 3 — Build the highlights list

Run `scripts/release_notes.sh [<since-ref>]`. It collects commits since the last tag (or the given ref), groups them, and writes `docs/releases/<version>.md`.

Then **rewrite the generated draft by hand** — raw commit subjects in this repo are often `Changes`, so:
- Read the actual diff (`git log --stat`, `git diff <since>..HEAD --name-only`) and describe player-visible impact, not files touched.
- Group under: `New`, `Improved`, `Fixed`, `Balance`, `Under the hood`.
- Max ~8 bullets, one line each, player-facing language (no file paths, no internal type names).
- Drop pure refactors and QA fixtures from the player list; fold them into a single `Under the hood` line.

## Step 4 — Publish

1. GitHub Release via connector:
   `POST /repos/{owner}/{repo}/releases` with `{ tag_name, name, body, draft: false }` using the verified `head_sha`'s tag/version.
2. itch.io devlog: butler cannot post devlogs, and the itch API has no devlog endpoint. So print the finished markdown in chat under a clearly labelled block and tell the user to paste it at `https://maligore.itch.io/menagerie/devlog/new`. Also state the itch build label (`<sha7>-<timestamp>`) so they can match it to the upload.

## Report format

Always close with this table, one row per surface:

| Surface | Status | Evidence |
|---|---|---|
| GitHub Actions (itch build) | ✅ / ❌ / ⏳ | run URL + conclusion |
| GitHub Pages | ✅ / ❌ / ⏳ | run URL + live HTTP status |
| itch.io html5 channel | ✅ / ❌ | butler step + live page check |
| Release notes | published / draft | release URL, devlog paste pending |

Do not mark a row ✅ without the evidence cell filled in.
