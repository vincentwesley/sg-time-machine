# Handover

Live: https://vincentwesley.github.io/sg-time-machine/ · Repo: https://github.com/vincentwesley/sg-time-machine (public)

## Resume
1. Pull `main` first. The snapshot bot commits to it every 30 minutes.
2. Read `README.md`, `data/SCHEMA.md`, `docs/DECISIONS.md`, `docs/NEEDS-VIN.md`.
3. Never rewrite, force-push or hand-edit anything under `data/`; it is the archive and can't be recreated.
4. Work on a branch, open a PR, merge when CI is green. Bot pushes don't trigger CI or Pages; Pages redeploys every 3 hours on its own cron.

## Milestones
- [x] M0 scaffold: licence, docs, CI, data contract, public repo
- [x] M1 fetcher + scheduled snapshot workflow (first snapshot 2026-11-15 14:01 SGT)
- [x] M2 time-slider site + Pages deploy
- [x] M3 monthly rollup: releases, downsampling, size gate
- [x] M4 self-check: fresh clone, live headless check, README pass, security review

## Commands
```
npm ci --ignore-scripts
npm run check                       # typecheck + lint + unit (51 tests)
npm run build                       # site/dist, data copied from data/
npx playwright install chromium     # once
npm run test:e2e                    # headless, serial
npm run snapshot                    # real run, ~6 keyless calls; writes data/
gh workflow run snapshot.yml -f all=true   # manual snapshot on GitHub
gh run list --workflow snapshot.yml --event schedule
```

## How it runs
- `snapshot.yml`, cron `7,37 * * * *`: psi, pm25 and flood every run; carpark and taxi when the last line is ≥ 50 min old; dengue roughly every 6 h. Each run commits only when something changed.
- `pages.yml`: deploys on push to main (code) and every 3 h (data).
- `rollup.yml`: on the 2nd of each month, publishes release `data-YYYY-MM` and thins carpark/taxi files older than 90 days.
- `ci.yml`: runs on PRs and on code pushes.

## Done & verified (2026-11-15)
- Live site: https://vincentwesley.github.io/sg-time-machine/ serves real snapshots (14:01 and 19:44 SGT on day one). Checked headless at 375 and 1280 px in dark and light: no console errors, no failed requests, no horizontal overflow.
- Snapshot workflow: two runs (manual dispatch) fetched all feeds keylessly and committed `data: snapshot …` as github-actions[bot].
- Fresh clone: `npm ci --ignore-scripts` (0 vulnerabilities), `npm run check` (50+ tests) and `npm run build` all green. CI (including e2e and axe) green on every PR.
- Security review of the site, workflows and fetcher found nothing.
- Pages deploys from Actions; the deploy succeeded after the Pages action major bumps.

## Not done & why
- **No cron-triggered snapshot has run yet.** This is the one open done-criterion. Every `schedule` slot from 06:41 to 13:03 UTC on 2026-11-15 was skipped by GitHub, and the Pages cron didn't fire either. The workflows are `active`, Actions are enabled, the YAML is valid, manual dispatch works, and githubstatus showed no incident. Already tried: touching the workflow file, disabling and re-enabling the workflow, and changing the cron to `7,37 * * * *`. Next session, first check `gh run list --workflow snapshot.yml --event schedule`. If it's still empty, see NEEDS-VIN.
- Flood alerts with real readings haven't been seen live yet (no flooding since the start). The parser follows the documented schema and is tested on a synthetic fixture only.
- The first monthly release (`data-2026-11`) will come from rollup.yml on 2026-12-02; that workflow has only been tested locally.
- Repo-size ceiling (~1 GB, years away) needs an owner decision when it gets close.

## Needs Vin
See `docs/NEEDS-VIN.md`: one step, only if scheduled runs still haven't started.
