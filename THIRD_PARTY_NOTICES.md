# Third-party notices

## Data (Singapore Open Data Licence v1.0)
All datasets are published by Singapore government agencies on data.gov.sg under the [SODL v1.0](https://data.gov.sg/open-data-licence). Exact attribution text per dataset is in `NOTICE.md`.

| Dataset | Agency | Id / source |
|---|---|---|
| PSI, PM2.5 (Real-time API) | NEA | data.gov.sg real-time API |
| Flood Alerts across Singapore | PUB | real-time API `v2/real-time/api/weather/flood-alerts` |
| Carpark Availability | HDB | data.gov.sg (v1 real-time) |
| Taxi Availability | LTA | data.gov.sg (v1 real-time) |
| Dengue Clusters GEOJSON | NEA | d_dbfabf16158d1b0e1c420627c0819168 |
| HDB Carpark Information | HDB | d_23f946fa557947f93a8043bbef41dd09 |

## data.gov.sg rate limits
Anonymous limits per 10 seconds: real-time API 6 calls, downloads 2 calls ([API rate limits](https://guide.data.gov.sg/developer-guide/api-overview/api-rate-limits)). The fetcher stays under them: at most 6 calls per run, spaced at least 3 s apart, downloads at least 6 s apart, and one retry on HTTP 429.

## Basemap
Tiles from [OpenFreeMap](https://openfreemap.org): "OpenFreeMap © OpenMapTiles Data from OpenStreetMap". Map data © OpenStreetMap contributors, ODbL 1.0.

## Code and assets
| Item | Licence | Source |
|---|---|---|
| maplibre-gl | BSD-3-Clause | https://github.com/maplibre/maplibre-gl-js |
| Space Grotesk, Inter, Silkscreen, JetBrains Mono (self-hosted, `OFL.txt` alongside) | SIL OFL 1.1 | Google Fonts / upstream authors |
| Pixelarticons | MIT | https://github.com/halfmage/pixelarticons |
| Kenney assets | CC0 1.0 | https://kenney.nl |

## Site (added with the map)
| Item | Licence | Notes |
|---|---|---|
| Vite, Playwright, axe-core (dev only) | MIT / MPL-2.0 | build and test tooling, not shipped |
| House kit CSS/JS, fonts, `icons/` (play, pause, arrows, sun, moon; Pixelarticons MIT, `site/public/icons/LICENSE`) | MIT / OFL 1.1 | copied into `site/public/` |
| Logo (`brand/svg`) and `credits/creator.webp` | all rights reserved | see `NOTICE.md`; art by Portus Workstation (@portus_workstation, @wason25_pz) |
