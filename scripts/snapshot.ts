import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { feeds, type Feed } from "./feeds.ts";
import { realHttp, type Http } from "./http.ts";
import { refreshCarparks } from "./ref-carparks.ts";
import { append, DATA_ROOT, lastLineTime, sg } from "./store.ts";

interface Health { ok?: string; error?: string; message?: string }
type HealthFile = Record<string, Health>;
interface Task { name: string; poll?: boolean; scheduledOnly?: boolean; due(now: Date): boolean; run(): Promise<string> }
export interface Result { name: string; ok: boolean; note: string }
export interface Options { root?: string; now?: Date; http?: Http; all?: boolean; feedList?: Feed[]; summaryFile?: string }

/** Record a status flip only; returns true if the health file changed. */
function updateHealth(h: HealthFile, name: string, ok: boolean, iso: string, message: string): boolean {
  const e = h[name];
  const failing = !!e?.error && (!e.ok || e.error >= e.ok);
  if (ok ? e && !failing : e && failing) return false;
  h[name] = ok ? { ...e, ok: iso } : { ...e, error: iso, message: message.slice(0, 200) };
  return true;
}

export async function run(opts: Options = {}): Promise<{ results: Result[]; exitCode: number }> {
  const root = opts.root ?? DATA_ROOT;
  const now = opts.now ?? new Date();
  const http = opts.http ?? realHttp;
  const { iso, day, hour, minute } = sg(now);
  const tasks: Task[] = (opts.feedList ?? feeds).map((f) => ({
    name: f.name,
    poll: f.poll,
    due: (n) => f.due(n, lastLineTime(root, f.name, n)),
    run: async () => (append(root, f.name, now, f.norm(await f.get(http))) ? "changed" : "unchanged"),
  }));
  // Monthly HDB carpark coordinates refresh (day 1, 03:00-03:29 SG), outside the feed archive.
  // Clock-windowed on purpose: a delayed run just skips it, and a miss is harmless.
  if (!opts.feedList) {
    tasks.push({
      name: "ref",
      scheduledOnly: true, // --all does not force it
      poll: true,
      due: () => day === 1 && hour === 3 && minute < 30,
      run: async () => `${await refreshCarparks(join(root, "ref", "hdb-carparks.json"), http)} carparks`,
    });
  }

  const healthFile = join(root, "health.json");
  const health: HealthFile = existsSync(healthFile) ? JSON.parse(readFileSync(healthFile, "utf8")) : {};
  let healthDirty = false;
  const results: Result[] = [];
  for (const t of tasks) {
    if (!(opts.all && !t.scheduledOnly) && !t.due(now)) continue;
    if (results.length) await http.pause(t.poll ? 6000 : 3000);
    let r: Result;
    try {
      r = { name: t.name, ok: true, note: await t.run() };
    } catch (e) {
      r = { name: t.name, ok: false, note: e instanceof Error ? e.message : String(e) };
    }
    results.push(r);
    healthDirty = updateHealth(health, r.name, r.ok, iso, r.note) || healthDirty;
    console.log(`${r.name}: ${r.ok ? "ok" : "ERROR"} ${r.note}`);
  }
  if (healthDirty) writeFileSync(healthFile, JSON.stringify(health, null, 2) + "\n");

  const summary = opts.summaryFile ?? process.env.GITHUB_STEP_SUMMARY;
  if (summary) {
    const rows = results.map((r) => `| ${r.name} | ${r.ok ? "ok" : "error"} | ${r.note.replaceAll("|", "/")} |`);
    appendFileSync(summary, `### Snapshot ${iso}\n\n| feed | status | note |\n|---|---|---|\n${rows.join("\n")}\n`);
  }
  return { results, exitCode: results.length > 0 && results.every((r) => !r.ok) ? 1 : 0 };
}

if (import.meta.main) {
  const { exitCode } = await run({ all: process.argv.includes("--all"), root: process.env.DATA_ROOT });
  process.exitCode = exitCode;
}
