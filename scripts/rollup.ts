import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { diff, replay, sorted, type Line } from "./diff.ts";
import { DATA_ROOT, readLines, sg } from "./store.ts";

const FEEDS = ["psi", "pm25", "flood", "carpark", "taxi", "dengue"];
const MB = 1024 * 1024;
export const WARN_BYTES = 12 * MB;
export const FAIL_BYTES = 15 * MB;

const ls = (dir: string) => { try { return readdirSync(dir).sort(); } catch { return []; } };
const dayFiles = (root: string, feed: string, month: string) => {
  const dir = join(root, feed, month.slice(0, 4), month.slice(5));
  return ls(dir).filter((f) => /^\d\d\.ndjson$/.test(f)).map((f) => join(dir, f));
};

/** Validate a YYYY-MM month: well-formed and strictly before the current SG month. */
export function parseMonth(m: string, now: Date): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(m)) throw new Error(`invalid month: ${m}`);
  if (m >= sg(now).date.slice(0, 7)) throw new Error(`month must be before the current month: ${m}`);
  return m;
}

export const previousMonth = (now: Date) => {
  const [y, mo] = sg(now).date.split("-").map(Number);
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
};

/** gzip each feed's month (day files concatenated in date order) into outDir, plus SHA256SUMS. Returns the file paths. */
export function packMonth(root: string, month: string, outDir: string): string[] {
  mkdirSync(outDir, { recursive: true });
  const out: string[] = [];
  const sums: string[] = [];
  for (const feed of FEEDS) {
    const files = dayFiles(root, feed, month);
    if (!files.length) continue;
    const gz = gzipSync(Buffer.concat(files.map((f) => readFileSync(f))));
    const name = `${feed}-${month}.ndjson.gz`;
    writeFileSync(join(outDir, name), gz);
    sums.push(`${createHash("sha256").update(gz).digest("hex")}  ${name}`);
    out.push(join(outDir, name));
  }
  const sumsFile = join(outDir, "SHA256SUMS");
  writeFileSync(sumsFile, sums.map((s) => s + "\n").join(""));
  return [...out, sumsFile];
}

export interface DownsampleOpts { feeds: string[]; olderThanDays: number; everyHours: number }

/** Rewrite day files older than the cutoff as keyframe + deltas at the first snapshot after each N-hour SG mark. Idempotent. Returns rewritten files. */
export function downsample(root: string, now: Date, o: DownsampleOpts): string[] {
  const cutoff = sg(new Date(now.getTime() - o.olderThanDays * 86400_000)).date;
  const tag = `${o.everyHours}h`;
  const marks: string[] = [];
  for (let h = o.everyHours; h < 24; h += o.everyHours) marks.push(String(h).padStart(2, "0"));
  const done: string[] = [];
  for (const feed of o.feeds) {
    for (const ym of ls(join(root, feed)).flatMap((y) => ls(join(root, feed, y)).map((m) => `${y}-${m}`))) {
      for (const file of dayFiles(root, feed, ym)) {
        const date = `${ym}-${file.slice(-9, -7)}`;
        if (date >= cutoff) continue;
        const lines = readLines(file);
        if (!lines.length || (lines[0] as Line & { r?: string }).r) continue;
        const keep = new Set<number>();
        for (const h of marks) {
          const i = lines.findIndex((l) => l.t >= `${date}T${h}:00:00+08:00`);
          if (i > 0) keep.add(i);
        }
        let prev = replay(lines.slice(0, 1));
        const out: object[] = [{ t: lines[0].t, k: 1, r: tag, v: sorted(prev) }];
        for (const i of [...keep].sort((a, b) => a - b)) {
          const next = replay(lines, lines[i].t);
          const d = diff(prev, next);
          if (d) out.push({ t: lines[i].t, ...(d.set && { set: sorted(d.set) }), ...(d.del && { del: [...d.del].sort() }) });
          prev = next;
        }
        writeFileSync(file, out.map((l) => JSON.stringify(l) + "\n").join(""));
        done.push(file);
      }
    }
  }
  return done;
}

export interface SizeReport { rows: { feed: string; month: string; bytes: number }[]; months: Record<string, number>; level: "ok" | "warn" | "fail" }

/** Raw bytes per feed per month; a month's total over 12 MB warns, over 15 MB fails. */
export function sizeReport(root: string): SizeReport {
  const rows: SizeReport["rows"] = [];
  const months: Record<string, number> = {};
  for (const feed of FEEDS) {
    for (const y of ls(join(root, feed))) {
      for (const m of ls(join(root, feed, y))) {
        const month = `${y}-${m}`;
        const bytes = dayFiles(root, feed, month).reduce((n, f) => n + statSync(f).size, 0);
        rows.push({ feed, month, bytes });
        months[month] = (months[month] ?? 0) + bytes;
      }
    }
  }
  const max = Math.max(0, ...Object.values(months));
  return { rows, months, level: max > FAIL_BYTES ? "fail" : max > WARN_BYTES ? "warn" : "ok" };
}

function main(argv: string[]) {
  const arg = (name: string) => { const i = argv.indexOf(name); return i < 0 ? undefined : argv[i + 1]; };
  const now = new Date();
  const month = parseMonth(arg("--month") ?? previousMonth(now), now);
  const packed = packMonth(DATA_ROOT, month, arg("--out") ?? "out");
  const slim = downsample(DATA_ROOT, now, { feeds: ["carpark", "taxi"], olderThanDays: 90, everyHours: 6 });
  const size = sizeReport(DATA_ROOT);
  const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;
  const text = [
    `## Rollup ${month}`,
    `Packed ${packed.length - 1} feed files; downsampled ${slim.length} day files.`,
    "",
    "| Month | Feed | Raw size |", "|---|---|---|",
    ...size.rows.map((r) => `| ${r.month} | ${r.feed} | ${kb(r.bytes)} |`),
    "",
    ...Object.entries(size.months).map(([m, b]) => `${m} total: ${kb(b)}`),
    `Size status: ${size.level}`,
  ].join("\n");
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + "\n");
  // In CI the size gate fails a final step, so the release and commit still happen first.
  if (size.level === "fail") {
    if (process.env.GITHUB_ENV) appendFileSync(process.env.GITHUB_ENV, "SIZE_LEVEL=fail\n");
    else process.exitCode = 1;
  }
}

if (import.meta.main) main(process.argv.slice(2));
