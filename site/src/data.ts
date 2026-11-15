import { replay, type Line, type State } from "../../scripts/diff.ts";

export type { Line, State };
export const FEEDS = ["dengue", "psi", "pm25", "flood", "carpark", "taxi"] as const;
export type Feed = (typeof FEEDS)[number];
export interface Index { generated: string; feeds: Record<string, { days: string[]; first: string; last: string }> }
export type Health = Record<string, { ok?: string; error?: string; message?: string }>;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const T = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+08:00$/;

/** Parses a day file. Skips malformed lines and anything before the first valid keyframe; times must be ascending. */
export function parseNdjson(text: string): Line[] {
  const out: Line[] = [];
  for (const raw of text.split("\n")) {
    if (!raw.trim()) continue;
    let o: unknown;
    try { o = JSON.parse(raw); } catch { continue; }
    if (!isObj(o) || typeof o.t !== "string" || !T.test(o.t)) continue;
    if (out.length && o.t < out[out.length - 1].t) continue;
    if (o.k === 1) {
      if (isObj(o.v)) out.push({ t: o.t, k: 1, v: o.v });
    } else if (out.length) {
      const set = isObj(o.set) ? o.set : undefined;
      const del = Array.isArray(o.del) ? o.del.filter((x): x is string => typeof x === "string") : undefined;
      if (set || del) out.push({ t: o.t, set, del });
    }
  }
  return out;
}

/** State in effect at `t` (ISO +08:00), or null when the day's first snapshot is later than `t`. */
export function stateAt(lines: Line[], t: string): { state: State; at: string } | null {
  const last = [...lines].reverse().find((l) => l.t <= t);
  return last ? { state: replay(lines, t), at: last.t } : null;
}

/** Sorted union of snapshot times across files. */
export const unionTimes = (files: (Line[] | null)[]): string[] =>
  [...new Set(files.flatMap((f) => f?.map((l) => l.t) ?? []))].sort();

/** Largest time <= t, else the first one. */
export const nearest = (times: string[], t: string): string => [...times].reverse().find((x) => x <= t) ?? times[0];

/** Value of one key across every snapshot of the day, for sparklines. */
export function series(lines: Line[], pick: (s: State) => number | undefined): { t: string; v: number }[] {
  const pts: { t: string; v: number }[] = [];
  lines.forEach((l, i) => {
    const v = pick(replay(lines.slice(0, i + 1)));
    if (v !== undefined) pts.push({ t: l.t, v });
  });
  return pts;
}

/** Seconds since local midnight from an ISO +08:00 string. */
export const secOfDay = (t: string) => Number(t.slice(11, 13)) * 3600 + Number(t.slice(14, 16)) * 60 + Number(t.slice(17, 19));

export const REGIONS = {
  north: [103.82, 1.41803], south: [103.82, 1.29587], east: [103.94, 1.35735], west: [103.7, 1.35735], central: [103.82, 1.35735],
} as const;
export type Region = keyof typeof REGIONS;
export const regionList = Object.keys(REGIONS) as Region[];

/** Band index 0..3 for colouring (NEA PSI and 1-hour PM2.5 bands). */
export const psiBand = (n: number) => (n <= 50 ? 0 : n <= 100 ? 1 : n <= 200 ? 2 : 3);
export const pm25Band = (n: number) => (n <= 55 ? 0 : n <= 150 ? 1 : n <= 250 ? 2 : 3);
export const BAND_NAMES = ["Good", "Moderate", "Unhealthy", "Very unhealthy"];
export const PM25_NAMES = ["Normal", "Elevated", "High", "Very high"];

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function regionValue(state: State | undefined, region: string, key: "psi24" | "pm25"): number | undefined {
  const v = state?.[region];
  return isObj(v) && num(v[key]) ? v[key] : undefined;
}

export type Ref = Record<string, [number, number, string]>;
export interface Counts { dengueClusters: number; dengueCases: number; flood: number; carparks: number; carparkFree: number | null; taxis: number }

export function carparkPoints(state: State, ref: Ref | null) {
  const pts: { id: string; lon: number; lat: number; addr: string; avail: number; total: number }[] = [];
  for (const [id, v] of Object.entries(state)) {
    const r = ref?.[id];
    if (!r || !Array.isArray(v) || !num(v[0]) || !num(v[1])) continue;
    pts.push({ id, lon: r[0], lat: r[1], addr: r[2], avail: v[0], total: v[1] });
  }
  return pts;
}

export function counts(s: Partial<Record<Feed, State>>): Counts {
  const dengue = Object.values(s.dengue ?? {}).filter(isObj);
  const cp = Object.values(s.carpark ?? {}).filter((v): v is [number, number] => Array.isArray(v) && num(v[0]) && num(v[1]));
  const lots = cp.reduce((n, v) => n + v[1], 0);
  return {
    dengueClusters: dengue.length,
    dengueCases: dengue.reduce((n, v) => n + (num(v.cases) ? v.cases : 0), 0),
    flood: Object.keys(s.flood ?? {}).length,
    carparks: cp.length,
    carparkFree: lots ? cp.reduce((n, v) => n + v[0], 0) / lots : null,
    taxis: Object.values(s.taxi ?? {}).reduce<number>((n, v) => n + (num(v) ? v : 0), 0),
  };
}

/** Singapore time string "HH:MM" from an ISO time. */
export const hm = (t: string) => t.slice(11, 16);

/** URL hash state. */
export interface View { date?: string; time?: string; layers?: Feed[] }
export function parseHash(h: string): View {
  const q = new URLSearchParams(h.replace(/^#/, ""));
  const date = q.get("d");
  const time = q.get("t");
  const l = q.get("l");
  return {
    date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined,
    time: time && /^\d{2}:\d{2}:\d{2}$/.test(time) ? time : undefined,
    layers: l === null ? undefined : l.split(",").filter((x): x is Feed => (FEEDS as readonly string[]).includes(x)),
  };
}
export const formatHash = (v: Required<View>) => `#d=${v.date}&t=${v.time}&l=${v.layers.join(",")}`;
