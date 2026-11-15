# Decisions

All dated 2026-11-15.

- **Git scraping via GitHub Actions.** Free, public, and git history is the time series.
- **Feeds and sampling.** PSI/PM2.5/flood every 30 min, carpark/taxi hourly, dengue every 6 h: matches how often each upstream changes while bounding growth.
- **v1 endpoints for carpark and taxi.** No v2 equivalent exists; the upstream-change risk is documented in the README.
- **Rate-limit budget.** At most 6 calls per run, 3 s apart (downloads 6 s), one retry on 429: stays under the anonymous 6 and 2 per 10 s limits.
- **Keyframe + delta ndjson day files.** Each day is self-contained and there is no churning state file to rewrite.
- **Taxi grid aggregation.** Raw taxi coordinates are large; 0.01 degree cell counts keep size small and avoid per-vehicle data.
- **Dengue geometry only when changed.** Polygons are big and rarely change.
- **OpenFreeMap basemap.** Keyless; CARTO needs a key and OneMap terms are unverified.
- **MapLibre.** Open-source vector renderer that works with OpenFreeMap tiles.
- **Zero-dependency fetcher via Node type stripping.** Nothing to install or audit for the scheduled job.
- **GitHub Pages via Actions with a 3-hourly deploy cron.** Bot pushes with GITHUB_TOKEN do not trigger workflows, so the site is redeployed on a schedule.
- **CSP via meta tag.** GitHub Pages cannot set response headers.
- **Retention and rollup.** History is permanent and growth is bounded by sampling; monthly release assets hold full resolution; the working tree is downsampled after 90 days. About 1 GB is the ceiling, beyond which a per-year data repo is needed (owner decision).
- **`data/` is tracked** despite the house gitignore template: it is the product.
- **No keepalive workflow.** Bot data commits keep the repo active, so scheduled workflows are not disabled for inactivity.
