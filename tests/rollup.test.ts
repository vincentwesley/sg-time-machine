import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { gunzipSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { replay } from "../scripts/diff.ts";
import { downsample, packMonth, parseMonth, sizeReport } from "../scripts/rollup.ts";
import { append, dayFile, readLines } from "../scripts/store.ts";

let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "sgtm-roll-")); });
afterEach(() => rmSync(root, { recursive: true, force: true }));

/** Hourly snapshots for an SG day (hour 0..23), state changes every hour. */
function fillDay(feed: string, date: string) {
  for (let h = 0; h < 24; h++) {
    const t = new Date(`${date}T${String(h).padStart(2, "0")}:11:00+08:00`);
    append(root, feed, t, { a: h, [`k${h % 5}`]: h, ...(h < 20 && { gone: 1 }) });
  }
}
const opts = { feeds: ["carpark", "taxi"], olderThanDays: 90, everyHours: 6 };
const now = new Date("2026-11-15T12:00:00+08:00");

describe("packMonth", () => {
  it("gunzip equals day files concatenated in date order, with SHA256SUMS", () => {
    append(root, "psi", new Date("2026-10-02T10:00:00+08:00"), { a: 2 });
    append(root, "psi", new Date("2026-10-01T10:00:00+08:00"), { a: 1 });
    const files = packMonth(root, "2026-10", join(root, "out"));
    expect(files.map((f) => f.replaceAll("\\", "/").split("/").pop())).toEqual(["psi-2026-10.ndjson.gz", "SHA256SUMS"]);
    const want = readFileSync(dayFile(root, "psi", "2026-10-01"), "utf8") + readFileSync(dayFile(root, "psi", "2026-10-02"), "utf8");
    expect(gunzipSync(readFileSync(files[0])).toString()).toBe(want);
    expect(readFileSync(files[1], "utf8")).toMatch(/^[0-9a-f]{64} {2}psi-2026-10\.ndjson\.gz\n$/);
  });
});

describe("downsample", () => {
  it("matches the original at kept times, is marked, and is idempotent", () => {
    fillDay("carpark", "2026-06-01");
    const file = dayFile(root, "carpark", "2026-06-01");
    const orig = readLines(file);
    expect(downsample(root, now, opts)).toEqual([file]);
    const slim = readLines(file);
    expect(slim).toHaveLength(4);
    expect(slim[0]).toMatchObject({ k: 1, r: "6h", t: orig[0].t });
    expect(slim.slice(1).map((l) => l.t.slice(11, 13))).toEqual(["06", "12", "18"]);
    for (const l of slim) expect(replay(slim, l.t)).toEqual(replay(orig, l.t));
    const bytes = readFileSync(file, "utf8");
    expect(downsample(root, now, opts)).toEqual([]);
    expect(readFileSync(file, "utf8")).toBe(bytes);
  });
  it("leaves recent days and other feeds untouched", () => {
    fillDay("carpark", "2026-10-01");
    fillDay("psi", "2026-06-01");
    const files = [dayFile(root, "carpark", "2026-10-01"), dayFile(root, "psi", "2026-06-01")];
    const before = files.map((f) => readFileSync(f, "utf8"));
    expect(downsample(root, now, opts)).toEqual([]);
    expect(files.map((f) => readFileSync(f, "utf8"))).toEqual(before);
  });
});

describe("parseMonth", () => {
  it("accepts past months, rejects malformed, current and future", () => {
    expect(parseMonth("2026-10", now)).toBe("2026-10");
    for (const bad of ["2026-13", "2026-00", "26-10", "2026-1", "2026-10 ", "2026-11", "2027-01"]) expect(() => parseMonth(bad, now)).toThrow();
  });
});

describe("sizeReport", () => {
  const put = (feed: string, bytes: number) => {
    const f = dayFile(root, feed, "2026-10-01");
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, "x".repeat(bytes));
  };
  it("reports per feed per month and applies thresholds", () => {
    put("carpark", 1000);
    expect(sizeReport(root)).toMatchObject({ level: "ok", rows: [{ feed: "carpark", month: "2026-10", bytes: 1000 }] });
    put("carpark", 13 * 1024 * 1024);
    expect(sizeReport(root).level).toBe("warn");
    put("carpark", 16 * 1024 * 1024);
    expect(sizeReport(root).level).toBe("fail");
  });
});
