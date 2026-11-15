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
- **Monthly rollup (2026-11-15).** `scripts/rollup.ts` (zero-dep) gzips the previous month per feed to a release `data-YYYY-MM` and downsamples carpark/taxi day files older than 90 days to 6-hourly (keyframe marked `"r":"6h"`). It has its own `rollup` concurrency group (a shared group would let a queued snapshot cancel a pending rollup); the pull-rebase push loop handles races. The size gate runs last so an oversized month still gets its release. The size gate is per month across feeds (warn 12 MB, fail 15 MB).
- **Site is static and reads day files directly.** `scripts/build-site-data.ts` copies `data/` into `site/public/data/` and writes `index.json`; the browser replays keyframe+delta with the same `replay()` as the fetcher, so there is one implementation.
- **CSP for the site:** `style-src 'self'` (no inline styles needed; MapLibre sets styles through CSSOM), MapLibre's worker is a same-origin file via `setWorkerUrl`, so `worker-src` needs only `'self' blob:`. Only third-party host is `tiles.openfreemap.org`.
- **Region bubbles use hardcoded NEA region centroids** (upstream metadata is not archived) and are labelled "region centre". Flood alert radius is archived (`r`, km) from 2026-11-15; alerts with `r` are drawn at true metre size (zoom-scaled circle-radius), older ones as fixed markers.
- **e2e stubs the basemap style** (a blank style served for `tiles.openfreemap.org/styles/*`, tiles aborted) so tests are offline-deterministic; data comes from real fixtures (`e2e/make-data.ts`).
- **Pages workflow** deploys on push to main (code only), every 3 hours (fresh data), and manually.

## 2026-11-15 (afternoon)
- **Flood source switched** to `v2/real-time/api/weather/flood-alerts`: dataset `d_f1404e…` is only the API's OpenAPI document. Populated alerts are parsed per the documented schema; not yet seen live (no flooding since the archive started).
- **Feeds are due by the age of their last saved line**, not by a clock window: carpark/taxi ≥ 50 min, dengue ≥ 5 h 50 min (hour-gated to 00/06/12/18 SG unless > 6 h 50 min stale, to keep download calls low). GitHub delays or drops cron runs often, and a missed clock window used to skip a feed for 1–6 h.
- **Dependabot holds TypeScript and @types/node majors** (TS 7 is the native compiler; Node runtime is 24). PRs #2/#3 closed.
- **Pages action majors accepted** (configure-pages v6, upload-pages-artifact v5, deploy-pages v5, SHA-pinned) via Dependabot PR #6, merged by mistake instead of #7; the next deploy succeeded, so it was kept.
- **e2e runs with one worker**: MapLibre on SwiftShader is CPU-heavy and parallel workers timed out.
