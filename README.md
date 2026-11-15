# SG Time Machine

A growing archive of Singapore's live open-data feeds (air quality, flood alerts, HDB carparks, taxis, dengue clusters), saved on a schedule by GitHub Actions and browsable on a time-slider map. The data is plain text in this repository, so you can download it, diff it and build on it.

**Live site:** https://vincentwesley.github.io/sg-time-machine/

## What is archived
| Feed | Source agency | Sampling |
|---|---|---|
| PSI | NEA | every 30 min |
| PM2.5 | NEA | every 30 min |
| Flood alerts | PUB | every 30 min |
| Carpark availability | HDB | hourly |
| Taxi availability | LTA | hourly, aggregated to 0.01 degree grid counts |
| Dengue clusters | NEA | every 6 h |

## Limits
- The archive starts on the first run date: <!-- START_DATE -->. There is no earlier history.
- GitHub scheduled runs can be delayed or skipped, so gaps happen.
- Flood alerts change every couple of minutes upstream; short alerts between samples can be missed.
- Carpark and taxi data come from v1 endpoints whose status is undocumented and could change or disappear.

## Download the data
- Day files: `data/<feed>/YYYY/MM/DD.ndjson` in this repository.
- Monthly GitHub Releases (`data-YYYY-MM`, the first one on 2 December 2026) attach each month's full-resolution `.ndjson.gz` files with SHA256 sums. Carpark and taxi files older than 90 days are thinned to 6-hourly in `data/`; the releases keep every sample.
- Line format (keyframes and deltas): [`data/SCHEMA.md`](data/SCHEMA.md).

## Develop
```
npm ci --ignore-scripts
npm run check        # typecheck + lint + unit
npm run build
npx playwright install chromium   # once, for e2e
npm run test:e2e
npm run snapshot     # makes ~6 real network calls
```
Needs Node 24 (`.nvmrc`).

## Network calls and data storage
- The fetcher calls `api-open.data.gov.sg` and `api.data.gov.sg`, only from GitHub Actions.
- The site loads its own static files plus map tiles from `tiles.openfreemap.org`.
- No analytics, no cookies, no personal data. Your theme choice is stored in `localStorage`.
- No secrets are needed.

## Attribution
Data: contains information from the datasets listed in [`NOTICE.md`](NOTICE.md), made available under the [Singapore Open Data Licence v1.0](https://data.gov.sg/open-data-licence). Not affiliated with or endorsed by any Singapore government agency. Other credits: [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

## Removal requests
See [`SECURITY.md`](SECURITY.md).

## Licence
Code: MIT, see `LICENSE`. Data: SODL v1.0. Logo and credits art: all rights reserved (`NOTICE.md`).

Provided as is, without warranty.
