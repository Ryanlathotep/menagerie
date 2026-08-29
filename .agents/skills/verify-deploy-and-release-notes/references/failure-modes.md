# Known deploy failure modes

## itch build workflow (`build.yml`)

| Symptom in logs | Cause | Fix |
|---|---|---|
| `BUTLER_API_KEY secret is missing` | Secret not set on the GitHub repo | User adds it in GitHub → Settings → Secrets and variables → Actions |
| `butler status` fails / 401 | Key invalid, revoked, or lacks upload rights on `maligore/menagerie` | Regenerate the key at itch.io → Settings → API keys, update the GitHub secret |
| `butler push` succeeds but iframe 404s | Wrong base path or SPA route handling in the embed | Build must use `--base ./`; check `src/App.tsx` route normalization (strips `index.html`, handles itch iframe paths) |
| Vite build fails on type errors | `CI=true` promotes warnings | Workflow already sets `CI=false`; if a real TS error, fix source |
| Blank page, console `Failed to resolve module specifier` | Absolute asset URLs in the bundle | Re-check `--base ./` and any hardcoded `/assets/...` references |

## GitHub Pages workflow

| Symptom | Cause | Fix |
|---|---|---|
| `deploy` job skipped | Push wasn't on `main`, or concurrency cancelled it | Re-run via `workflow_dispatch` |
| 404 on deep links after deploy | Pages has no SPA fallback | Ensure hash/base handling for the Pages target (`DEPLOY_TARGET=gh-pages`) |
| Pages permissions error | Missing `pages: write` / `id-token: write` | Already declared; confirm Pages is enabled with source "GitHub Actions" in repo settings |

## Verification pitfalls

- A green local `npm run build` proves nothing about either deploy.
- `status: queued`/`in_progress` is not a pass — report ⏳ and offer to re-check.
- Two workflows run per push; both must be checked, they fail independently.
- itch.io CDN can lag a minute or two after `butler push`; on a fresh push, re-run the live check once before reporting failure.
