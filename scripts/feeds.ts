import type { State } from "./diff.ts";
import { getJson, pollDownload, type Http } from "./http.ts";
import { sg } from "./store.ts";

export interface Feed {
  name: string;
  /** Uses poll-download (stricter rate limit: needs a longer gap). */
  poll?: boolean;
  /** `last` = time of the feed's most recent written line (null if none in 7 days). */
  due(now: Date, last: Date | null): boolean;
  get(http: Http): Promise<unknown>;
  norm(raw: unknown): State;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === "string" && v !== "";
const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const r5 = (n: number) => Math.round(n * 1e5) / 1e5;
const arr = (v: unknown, what: string): unknown[] => {
  if (!Array.isArray(v)) throw new Error(`${what}: not an array`);
  return v;
};
const inSg = (lat: number, lon: number) => lat > 1.1 && lat < 1.5 && lon > 103.5 && lon < 104.2;

/** PSI / PM2.5 v2 shape: latest item, readings[key] = { region: n }. */
function regional(raw: unknown, key: string, field: string): State {
  const items = arr((raw as { data?: { items?: unknown } })?.data?.items, "items").filter(isObj);
  const latest = items.reduce<Obj | undefined>((a, b) => (!a || String(b.timestamp) > String(a.timestamp) ? b : a), undefined);
  const readings = isObj(latest?.readings) ? latest.readings[key] : undefined;
  if (!latest || !isObj(readings) || !str(latest.timestamp)) throw new Error(`no ${key} readings`);
  const out: State = {};
  for (const [region, n] of Object.entries(readings)) if (num(n)) out[region] = { [field]: n, src: latest.timestamp };
  if (!Object.keys(out).length) throw new Error(`no valid ${key} values`);
  return out;
}
export const normPsi = (raw: unknown) => regional(raw, "psi_twenty_four_hourly", "psi24");
export const normPm25 = (raw: unknown) => regional(raw, "pm25_one_hourly", "pm25");

/**
 * Flood alerts (v2 flood-alerts endpoint). Alert messages minus any later cancelled by a Cancel message's `references`.
 * The empty case is verified against the live API; populated records follow the documented schema (not yet seen live).
 */
export function normFlood(raw: unknown): State {
  const records = arr((raw as { data?: { records?: unknown } })?.data?.records, "records").filter(isObj);
  records.sort((a, b) => String(a.datetime).localeCompare(String(b.datetime)));
  const alerts: State = {};
  const cancelled = new Set<string>();
  for (const rec of records) {
    const item = rec.item;
    if (!isObj(item) || !str(item.identifier) || !Array.isArray(item.readings)) continue;
    const id = item.identifier;
    if (item.msgType === "Cancel" && str(item.references)) {
      for (const tok of item.references.split(/[,\s]+/)) cancelled.add(tok);
    } else if (item.msgType === "Alert") {
      item.readings.forEach((r: unknown, i: number) => {
        const circle = isObj(r) && isObj(r.area) ? r.area.circle : undefined;
        if (!isObj(r) || !Array.isArray(circle) || !num(circle[0]) || !num(circle[1]) || !inSg(circle[0], circle[1]) || !str(r.description) || !str(rec.datetime)) return;
        const rad = circle[2];
        alerts[i ? `${id}#${i}` : id] = { lon: r5(circle[1]), lat: r5(circle[0]), desc: r.description, src: rec.datetime, ...(num(rad) && rad >= 0 ? { r: Math.round(rad * 1000) / 1000 } : {}) };
      });
    }
  }
  for (const k of Object.keys(alerts)) if (cancelled.has(k.split("#")[0])) delete alerts[k];
  return alerts;
}

/** HDB carparks: car lots (type C) only, [available, total]. */
export function normCarpark(raw: unknown): State {
  const items = arr((raw as { items?: unknown })?.items, "items");
  const first = items[0];
  const out: State = {};
  for (const cp of arr(isObj(first) ? first.carpark_data : undefined, "carpark_data")) {
    if (!isObj(cp) || !str(cp.carpark_number) || !Array.isArray(cp.carpark_info)) continue;
    const lot = cp.carpark_info.find((i) => isObj(i) && i.lot_type === "C");
    const avail = isObj(lot) ? Number(lot.lots_available) : NaN;
    const total = isObj(lot) ? Number(lot.total_lots) : NaN;
    if (Number.isInteger(avail) && Number.isInteger(total) && avail >= 0 && total >= 0) out[cp.carpark_number] = [avail, total];
  }
  if (!Object.keys(out).length) throw new Error("no carparks");
  return out;
}

/** Taxi GeoJSON MultiPoint to counts per 0.01 degree cell "<latIdx>_<lonIdx>". */
export function normTaxi(raw: unknown): State {
  const feat = arr((raw as { features?: unknown })?.features, "features")[0];
  const coords = arr(isObj(feat) && isObj(feat.geometry) ? feat.geometry.coordinates : undefined, "coordinates");
  const out: Record<string, number> = {};
  for (const c of coords) {
    if (!Array.isArray(c) || !num(c[0]) || !num(c[1]) || !inSg(c[1], c[0])) continue;
    const cell = `${Math.floor(Math.round(c[1] * 1e5) / 1000)}_${Math.floor(Math.round(c[0] * 1e5) / 1000)}`;
    out[cell] = (out[cell] ?? 0) + 1;
  }
  if (!Object.keys(out).length) throw new Error("no taxis");
  return out;
}

const roundCoords = (c: unknown): unknown => (Array.isArray(c) ? c.map(roundCoords) : num(c) ? r5(c) : c);

/** Dengue clusters: id = trimmed locality (suffixed #n if repeated), value { cases, geom }. */
export function normDengue(raw: unknown): State {
  const out: State = {};
  for (const f of arr((raw as { features?: unknown })?.features, "features")) {
    if (!isObj(f) || !isObj(f.properties) || !isObj(f.geometry)) continue;
    const { LOCALITY: loc, CASE_SIZE: cases } = f.properties;
    const { type, coordinates } = f.geometry;
    if (!str(loc) || !loc.trim() || !Number.isInteger(cases) || (type !== "Polygon" && type !== "MultiPolygon") || !Array.isArray(coordinates)) continue;
    let id = loc.trim();
    for (let n = 2; id in out; n++) id = `${loc.trim()} #${n}`;
    out[id] = { cases, geom: { type, coordinates: roundCoords(coordinates) } };
  }
  return out;
}

const RT = "https://api-open.data.gov.sg/v2/real-time/api";
const MIN = 60_000;
// Interval-since-last-line, not clock windows: GitHub cron runs are often delayed or dropped.
const every = (ms: number) => (now: Date, last: Date | null) => !last || now.getTime() - last.getTime() >= ms;
const everyRun = every(0);
const hourly = every(50 * MIN);
const dengueGap = every(350 * MIN);

export const feeds: Feed[] = [
  { name: "psi", due: everyRun, get: (h) => getJson(`${RT}/psi`, h), norm: normPsi },
  { name: "pm25", due: everyRun, get: (h) => getJson(`${RT}/pm25`, h), norm: normPm25 },
  { name: "flood", due: everyRun, get: (h) => getJson(`${RT}/weather/flood-alerts`, h), norm: normFlood },
  { name: "carpark", due: hourly, get: (h) => getJson("https://api.data.gov.sg/v1/transport/carpark-availability", h), norm: normCarpark },
  { name: "taxi", due: hourly, get: (h) => getJson("https://api.data.gov.sg/v1/transport/taxi-availability", h), norm: normTaxi },
  {
    name: "dengue",
    poll: true,
    // Unchanged runs write no line, so gate on the 6 h SG hour to avoid a download every run once stale.
    due: (now, last) => dengueGap(now, last) && (!last || sg(now).hour % 6 === 0 || now.getTime() - last.getTime() >= 410 * MIN),
    get: async (h) => JSON.parse(await pollDownload("d_dbfabf16158d1b0e1c420627c0819168", h)),
    norm: normDengue,
  },
];
