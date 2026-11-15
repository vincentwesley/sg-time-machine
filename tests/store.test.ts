import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { append, dayFile, lastState, readLines, sg } from "../scripts/store.ts";

let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "sgtm-")); });
afterEach(() => rmSync(root, { recursive: true, force: true }));
const at = (s: string) => new Date(s);

describe("sg()", () => {
  it("UTC+8 date and ISO", () => {
    expect(sg(at("2026-11-14T16:05:09Z"))).toMatchObject({ date: "2026-11-15", day: 15, hour: 0, minute: 5, iso: "2026-11-15T00:05:09+08:00" });
    expect(sg(at("2026-12-31T15:59:59Z")).date).toBe("2026-12-31");
    expect(sg(at("2026-12-31T16:00:00Z")).date).toBe("2027-01-01");
  });
});

describe("append", () => {
  const t1 = at("2026-11-15T04:11:00Z");
  const file = () => dayFile(root, "psi", "2026-11-15");
  it("lays out data/<feed>/YYYY/MM/DD.ndjson", () => {
    expect(file().replaceAll("\\", "/")).toMatch(/psi\/2026\/11\/15\.ndjson$/);
  });
  it("first write is a keyframe; identical state writes nothing; change writes a delta", () => {
    expect(append(root, "psi", t1, { b: 1, a: 2 })).toBe(true);
    expect(readFileSync(file(), "utf8")).toBe('{"t":"2026-11-15T12:11:00+08:00","k":1,"v":{"a":2,"b":1}}\n');
    expect(append(root, "psi", at("2026-11-15T04:41:00Z"), { a: 2, b: 1 })).toBe(false);
    expect(readLines(file())).toHaveLength(1);
    expect(append(root, "psi", at("2026-11-15T05:11:00Z"), { a: 3, c: 1 })).toBe(true);
    expect(readLines(file())[1]).toEqual({ t: "2026-11-15T13:11:00+08:00", set: { a: 3, c: 1 }, del: ["b"] });
  });
  it("day rollover writes a new keyframe even if unchanged", () => {
    append(root, "psi", t1, { a: 1 });
    expect(append(root, "psi", at("2026-11-15T16:11:00Z"), { a: 1 })).toBe(true); // 2026-11-16 00:11 SG
    expect(readLines(dayFile(root, "psi", "2026-11-16"))).toEqual([{ t: "2026-11-16T00:11:00+08:00", k: 1, v: { a: 1 } }]);
  });
  it("lastState: today, else latest previous day within 7 days, else null", () => {
    expect(lastState(root, "psi", t1)).toBeNull();
    append(root, "psi", at("2026-11-10T04:00:00Z"), { a: 1 });
    expect(lastState(root, "psi", t1)).toEqual({ a: 1 });
    append(root, "psi", t1, { a: 2 });
    expect(lastState(root, "psi", t1)).toEqual({ a: 2 });
    expect(lastState(root, "psi", at("2026-11-25T04:00:00Z"))).toBeNull();
  });
});
