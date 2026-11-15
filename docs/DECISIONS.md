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
- **Monthly rollup (2026-11-15).** `scripts/rollup.ts` (zero-dep) gzips the previous month per feed to a release `data-YYYY-MM` and downsamples carpark/taxi day files older than 90 days to 6-hourly (keyframe marked `"r":"6h"`). It shares the `snapshot` concurrency group so the two never push at once. The size gate is per month across feeds (warn 12 MB, fail 15 MB).
- **Site is static and reads day files directly.** `scripts/build-site-data.ts` copies `data/` into `site/public/data/` and writes `index.json`; the browser replays keyframe+delta with the same `replay()` as the fetcher, so there is one implementation.
- **CSP for the site:** `style-src 'self'` (no inline styles needed; MapLibre sets styles through CSSOM), MapLibre's worker is a same-origin file via `setWorkerUrl`, so `worker-src` needs only `'self' blob:`. Only third-party host is `tiles.openfreemap.org`.
- **Region bubbles use hardcoded NEA region centroids** (upstream metadata is not archived) and are labelled "region centre". Flood alert radius is not in the archive, so alerts are drawn as fixed-size markers.
- **e2e stubs the basemap style** (a blank style served for `tiles.openfreemap.org/styles/*`, tiles aborted) so tests are offline-deterministic; data comes from real fixtures (`e2e/make-data.ts`).
- **Pages workflow** deploys on push to main (code only), every 3 hours (fresh data), and manually.
