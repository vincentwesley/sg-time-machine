import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildSiteData } from "../scripts/build-site-data.ts";
import { normCarpark, normPsi, normTaxi } from "../scripts/feeds.ts";
import { append } from "../scripts/store.ts";
import { counts, formatHash, nearest, parseHash, parseNdjson, series, stateAt, unionTimes, carparkPoints } from "../site/src/data.ts";
import { fix } from "./util.ts";

let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "sgtm-")); });
afterEach(() => rmSync(root, { recursive: true, force: true }));
const sgt = (iso: string) => new Date(`${iso}+08:00`);

describe("buildSiteData", () => {
  it("writes an empty index when there are no day files", () => {
    const out = join(root, "out");
    const idx = buildSiteData(join(root, "none"), out, new Date("2026-11-15T00:00:00Z"));
    expect(idx).toEqual({ generated: "2026-11-15T00:00:00.000Z", feeds: {} });
    expect(JSON.parse(readFileSync(join(out, "index.json"), "utf8"))).toEqual(idx);
  });

  it("indexes days per feed, copies files, ref and health", () => {
    const data = join(root, "data");
    append(data, "psi", sgt("2026-11-14T10:00:00"), normPsi(fix("psi.json")));
    append(data, "psi", sgt("2026-11-15T10:00:00"), normPsi(fix("psi.json")));
    append(data, "taxi", sgt("2026-11-15T10:00:00"), normTaxi(fix("taxi.json")));
    mkdirSync(join(data, "ref"), { recursive: true });
    writeFileSync(join(data, "ref", "hdb-carparks.json"), "{}");
    writeFileSync(join(data, "psi", "stray.txt"), "x");
    const out = join(root, "out");
    const idx = buildSiteData(data, out);
    expect(idx.feeds.psi).toEqual({ days: ["2026-11-14", "2026-11-15"], first: "2026-11-14", last: "2026-11-15" });
    expect(idx.feeds.taxi.days).toEqual(["2026-11-15"]);
    expect(idx.feeds.ref).toBeUndefined();
    expect(existsSync(join(out, "psi", "2026", "11", "15.ndjson"))).toBe(true);
    expect(existsSync(join(out, "psi", "stray.txt"))).toBe(false);
    expect(existsSync(join(out, "ref", "hdb-carparks.json"))).toBe(true);
    expect(existsSync(join(out, "health.json"))).toBe(false);
  });
});

describe("site data helpers", () => {
  const day = (): string => {
    const data = join(root, "d");
    const psi = normPsi(fix("psi.json"));
    append(data, "psi", sgt("2026-11-15T08:00:00"), psi);
    append(data, "psi", sgt("2026-11-15T08:30:00"), { ...psi, north: { psi24: 99, src: "x" } });
    append(data, "psi", sgt("2026-11-15T09:00:00"), { ...psi, north: { psi24: 120, src: "y" } });
    return readFileSync(join(data, "psi", "2026", "11", "15.ndjson"), "utf8");
  };

  it("parses real day files and skips malformed or out-of-order lines", () => {
    const text = day();
    expect(parseNdjson(text)).toHaveLength(3);
    const bad = `garbage\n{"t":"nope"}\n{"t":"2026-11-15T07:00:00+08:00","set":{"a":1}}\n${text}{"t":"2026-11-15T01:00:00+08:00","set":{}}\n{"t":"2026-11-15T09:30:00+08:00","set":5}\n`;
    expect(parseNdjson(bad)).toHaveLength(3); // delta before the first keyframe, out-of-order and invalid lines dropped
  });

  it("stateAt replays up to a time and is null before the first snapshot", () => {
    const lines = parseNdjson(day());
    expect(stateAt(lines, "2026-11-15T07:59:00+08:00")).toBeNull();
    const mid = stateAt(lines, "2026-11-15T08:45:00+08:00");
    expect(mid?.at).toBe("2026-11-15T08:30:00+08:00");
    expect((mid?.state.north as { psi24: number }).psi24).toBe(99);
    expect((stateAt(lines, "2026-11-15T23:00:00+08:00")?.state.north as { psi24: number }).psi24).toBe(120);
  });

  it("unions times, snaps to the nearest earlier one, and builds series", () => {
    const lines = parseNdjson(day());
    const times = unionTimes([lines, null, [{ t: "2026-11-15T08:15:00+08:00", k: 1, v: {} }]]);
    expect(times).toEqual(["2026-11-15T08:00:00+08:00", "2026-11-15T08:15:00+08:00", "2026-11-15T08:30:00+08:00", "2026-11-15T09:00:00+08:00"]);
    expect(nearest(times, "2026-11-15T08:20:00+08:00")).toBe(times[1]);
    expect(nearest(times, "2026-11-15T01:00:00+08:00")).toBe(times[0]);
    expect(series(lines, (s) => (s.north as { psi24: number } | undefined)?.psi24).map((p) => p.v)).toEqual([(normPsi(fix("psi.json")).north as { psi24: number }).psi24, 99, 120]);
  });

  it("derives counts and carpark points from real fixtures", () => {
    const cp = normCarpark(fix("carpark.json"));
    const first = Object.keys(cp)[0];
    const c = counts({ carpark: cp, taxi: normTaxi(fix("taxi.json")) });
    expect(c.carparks).toBe(Object.keys(cp).length);
    expect(c.carparkFree).toBeGreaterThanOrEqual(0);
    expect(c.carparkFree).toBeLessThanOrEqual(1);
    expect(c.taxis).toBeGreaterThan(0);
    const pts = carparkPoints(cp, { [first]: [103.8, 1.3, "BLK 1"] });
    expect(pts).toHaveLength(1);
    expect(pts[0]).toMatchObject({ id: first, lon: 103.8, lat: 1.3 });
  });

  it("round-trips the URL hash and ignores junk", () => {
    const v = { date: "2026-11-15", time: "08:30:00", layers: ["psi", "taxi"] as ("psi" | "taxi")[] };
    expect(parseHash(formatHash(v))).toEqual(v);
    expect(parseHash("#d=<script>&t=9&l=psi,evil")).toEqual({ date: undefined, time: undefined, layers: ["psi"] });
  });
});
