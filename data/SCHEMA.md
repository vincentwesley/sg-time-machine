# Archive format

Everything under `data/` is plain text so diffs stay readable and git can delta-compress it.

## Layout
```
data/<feed>/YYYY/MM/DD.ndjson   one file per feed per day (UTC+8, Singapore date)
data/ref/hdb-carparks.json      { "<carpark id>": [lon, lat, "address"] }, WGS84, from HDB Carpark Information
data/health.json                { "<feed>": { "ok": "<iso>", "error": "<iso>", "message": "..." } }, written only when a feed's status flips
```
Feeds: `psi`, `pm25`, `flood`, `carpark`, `taxi`, `dengue`.

## Lines
Each line is one JSON object. `t` is the snapshot time as an ISO 8601 string with `+08:00`.
- **Keyframe** (always the first line of a day file): `{"t":"...","k":1,"v":{ "<id>": <value>, ... }}`, the full state.
- **Delta**: `{"t":"...","set":{ "<id>": <value> },"del":["<id>", ...]}`, only what changed since the previous line. `set` and `del` are omitted when empty. A line is written only when something changed.

State at time T = the keyframe + every delta with `t <= T`, applied in order.

## Values per feed
| Feed | id | value |
|---|---|---|
| `psi` | region (`national`, `north`, `south`, `east`, `west`, `central`) | `{"psi24": n, "src": "<upstream timestamp>"}` |
| `pm25` | region | `{"pm25": n, "src": "<upstream timestamp>"}` |
| `flood` | upstream alert id | `{"lon": n, "lat": n, "desc": "...", "src": "...", "r": km}` (`r` = alert radius in km, 3 dp, omitted when upstream gives none; archived from 15 Nov 2026 onward) (fields confirmed against the real feed; see docs/DECISIONS.md) |
| `carpark` | HDB carpark number | `[lotsAvailable, totalLots]` (car lots, type `C`) |
| `taxi` | 0.01° grid cell `"<latIdx>_<lonIdx>"`, where `latIdx = floor(lat*100)`, `lonIdx = floor(lon*100)` | taxi count in that cell |
| `dengue` | cluster locality + first case code (upstream name) | `{"cases": n, "geom": <GeoJSON geometry>}` |

Numbers are rounded: coordinates to 5 decimals, readings to integers as published.

## Sampling
PSI, PM2.5 and flood every 30 minutes; carpark and taxi hourly; dengue every 6 hours. Flood alerts upstream change every 2 minutes, so alerts that start and end between samples are not captured.

## Licence
Contains information from the datasets listed in `NOTICE.md`, from the National Environment Agency, PUB, Housing & Development Board and Land Transport Authority, made available under the terms of the [Singapore Open Data Licence version 1.0](https://data.gov.sg/open-data-licence).

## Corrections after the first real responses (2026-11-15)
- `flood`: dataset `d_f1404e08587ce555b9ea3f565e2eb9a3` is only the API's OpenAPI document, not alert data. The feed is `https://api-open.data.gov.sg/v2/real-time/api/weather/flood-alerts` (keyless). Each record is a 2-minute poll: `item.readings[]` is empty when there is no flooding (verified live). Per the documented schema, an `Alert` message has `item.identifier`, `readings[].area.circle = [lat, lon, radiusKm]` (radius archived as `r` from 15 Nov 2026) and `readings[].description`; a `Cancel` message lists the cancelled identifiers in `item.references`. State = alerts in the returned window minus cancelled ones. Populated alerts are not yet verified against live data.
- `dengue`: upstream has no case code. The id is the trimmed `LOCALITY` (repeats get ` #2`, ` #3`...); `cases` = `CASE_SIZE`; `geom` is the Polygon/MultiPolygon with coordinates rounded to 5 decimals.
- `psi` / `pm25`: the live v2 response has regions `north`, `south`, `east`, `west`, `central` (no `national`). `src` is the reading hour (`items[].timestamp`).

## Retention
- Full-resolution day files stay in the working tree for 90 days. Monthly gzip bundles of every feed (`<feed>-YYYY-MM.ndjson.gz`, with `SHA256SUMS`) are attached to the GitHub release `data-YYYY-MM`.
- After 90 days the `carpark` and `taxi` day files are downsampled: the keyframe stays and carries `"r":"6h"`, and deltas are kept only at the first snapshot at or after 06:00, 12:00 and 18:00 SG time (each diffed against the previous kept state). Other feeds are never downsampled. State at a kept time is identical to the original; between kept times the state is that of the previous kept time.
- A month above 12 MB raw warns and above 15 MB fails the rollup workflow.
