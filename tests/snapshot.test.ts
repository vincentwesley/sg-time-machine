import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Feed } from "../scripts/feeds.ts";
import { run } from "../scripts/snapshot.ts";
import { dayFile, readLines } from "../scripts/store.ts";
import { noPause } from "./util.ts";

let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "sgtm-")); });
afterEach(() => rmSync(root, { recursive: true, force: true }));

const pauses: number[] = [];
const http = { ...noPause(pauses), fetch: (() => { throw new Error("no network in tests"); }) as typeof fetch };
const feed = (name: string, fn: () => unknown, extra: Partial<Feed> = {}): Feed => ({ name, due: () => true, get: async () => fn(), norm: (r) => r as Record<string, unknown>, ...extra });
const bad = (n: string) => feed(n, () => { throw new Error("upstream 500"); });
const t1 = new Date("2026-11-15T04:11:00Z");
const health = () => JSON.parse(readFileSync(join(root, "health.json"), "utf8"));

describe("snapshot run", () => {
  it("isolates a failing feed: others are still written, exit 0", async () => {
    const { results, exitCode } = await run({ root, now: t1, http, feedList: [feed("a", () => ({ x: 1 })), bad("boom"), feed("c", () => ({ y: 2 }))] });
    expect(results.map((r) => [r.name, r.ok])).toEqual([["a", true], ["boom", false], ["c", true]]);
    expect(exitCode).toBe(0);
    expect(readLines(dayFile(root, "a", "2026-11-15"))).toHaveLength(1);
    expect(readLines(dayFile(root, "c", "2026-11-15"))).toHaveLength(1);
    expect(existsSync(dayFile(root, "boom", "2026-11-15"))).toBe(false);
  });
  it("exit 1 only when every attempted feed failed", async () => {
    expect((await run({ root, now: t1, http, feedList: [bad("a"), bad("b")] })).exitCode).toBe(1);
    expect((await run({ root, now: t1, http, feedList: [feed("n", () => 1, { due: () => false })] })).exitCode).toBe(0); // nothing attempted
  });
  it("skips feeds that are not due unless --all", async () => {
    const f = feed("late", () => ({ x: 1 }), { due: () => false });
    expect((await run({ root, now: t1, http, feedList: [f] })).results).toHaveLength(0);
    expect((await run({ root, now: t1, http, feedList: [f], all: true })).results).toHaveLength(1);
  });
  it("health.json only changes when a status flips", async () => {
    let fail = false;
    const f = feed("f", () => { if (fail) throw new Error("down"); return { x: 1 }; });
    const go = (iso: string) => run({ root, now: new Date(iso), http, feedList: [f] });
    await go("2026-11-15T04:11:00Z");
    expect(health().f).toEqual({ ok: "2026-11-15T12:11:00+08:00" });
    await go("2026-11-15T04:41:00Z");
    expect(health().f.ok).toBe("2026-11-15T12:11:00+08:00"); // still ok: no rewrite
    fail = true;
    await go("2026-11-15T05:11:00Z");
    expect(health().f).toMatchObject({ error: "2026-11-15T13:11:00+08:00", message: "down" });
    await go("2026-11-15T05:41:00Z");
    expect(health().f.error).toBe("2026-11-15T13:11:00+08:00"); // still failing: no rewrite
    fail = false;
    await go("2026-11-15T06:11:00Z");
    expect(health().f.ok).toBe("2026-11-15T14:11:00+08:00");
  });
  it("waits 3 s between feeds and 6 s before a poll-download feed; writes the step summary", async () => {
    pauses.length = 0;
    const summaryFile = join(root, "summary.md");
    await run({ root, now: t1, http, summaryFile, feedList: [feed("a", () => ({ x: 1 })), feed("b", () => ({ x: 1 })), feed("p", () => ({ x: 1 }), { poll: true })] });
    expect(pauses).toEqual([3000, 6000]);
    expect(readFileSync(summaryFile, "utf8")).toContain("| p | ok | changed |");
  });
});
