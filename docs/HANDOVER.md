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

## Done & verified
<!-- filled at the end of the session -->

## Not done & why

## Needs Vin
