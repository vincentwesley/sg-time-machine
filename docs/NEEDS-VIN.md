# Needs Vin

## Optional: denser snapshots
Scheduled runs fire now but GitHub throttles them to a few per day (best-effort on a new repo; the workflow is correct). For 30-minute data, an external pinger (e.g. a Cloudflare Worker cron calling `workflow_dispatch` with a fine-grained token, Actions: write on this repo only) would be needed. Otherwise nothing to do.

## Later
- Repo-size ceiling: if the repo nears 1 GB, decide whether to move to a per-year data repo.
- Optional: add the project to the portfolio and the tracking sheet (DASH-31).
