# Needs Vin

## Only if scheduled runs still haven't started
GitHub hasn't fired any `schedule` trigger in this repo since it was created on 2026-11-15, even after the workflow was re-registered. Manual runs work. To fix:
1. Open https://github.com/vincentwesley/sg-time-machine/actions/workflows/snapshot.yml while signed in. GitHub sometimes starts schedules on a new repo only after the owner visits it.
2. A day later, check `gh run list -R vincentwesley/sg-time-machine --workflow snapshot.yml --event schedule`. If it's still empty, contact GitHub Support ("scheduled workflows never trigger on a new public repo") and link this repo.
Until then, each `gh workflow run snapshot.yml -R vincentwesley/sg-time-machine` adds one snapshot.

## Later
- Repo-size ceiling: if the repo nears 1 GB, decide whether to move to a per-year data repo.
- Optional: add the project to the portfolio and the tracking sheet (DASH-31).
