# Third-party notices

## Data (Singapore Open Data Licence v1.0)
All datasets are published by Singapore government agencies on data.gov.sg under the [SODL v1.0](https://data.gov.sg/open-data-licence). Exact attribution text per dataset is in `NOTICE.md`.

| Dataset | Agency | Id / source |
|---|---|---|
| PSI, PM2.5 (Real-time API) | NEA | data.gov.sg real-time API |
| Flood Alerts across Singapore | PUB | d_f1404e08587ce555b9ea3f565e2eb9a3 |
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
