import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { diff, replay, sorted, type Line, type State } from "./diff.ts";

export const DATA_ROOT = join(import.meta.dirname, "..", "data");

const p2 = (n: number) => String(n).padStart(2, "0");

/** Singapore wall-clock (UTC+8, no DST) parts for an instant. */
export function sg(now: Date) {
  const d = new Date(now.getTime() + 8 * 3600_000);
  const date = `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
  const hour = d.getUTCHours();
  const minute = d.getUTCMinutes();
  return { date, day: d.getUTCDate(), hour, minute, iso: `${date}T${p2(hour)}:${p2(minute)}:${p2(d.getUTCSeconds())}+08:00` };
}

export const dayFile = (root: string, feed: string, date: string) => join(root, feed, date.slice(0, 4), date.slice(5, 7), `${date.slice(8)}.ndjson`);

export function readLines(file: string): Line[] {
  return readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Line);
}

/** Today's state, else the most recent day file within the last 7 days, else null. */
export function lastState(root: string, feed: string, now: Date): State | null {
  for (let i = 0; i <= 7; i++) {
    const f = dayFile(root, feed, sg(new Date(now.getTime() - i * 86400_000)).date);
    if (existsSync(f)) return replay(readLines(f));
  }
  return null;
}

/** Time of the most recent written line within the last 7 days, else null. */
export function lastLineTime(root: string, feed: string, now: Date): Date | null {
  for (let i = 0; i <= 7; i++) {
    const f = dayFile(root, feed, sg(new Date(now.getTime() - i * 86400_000)).date);
    if (!existsSync(f)) continue;
    const l = readLines(f).at(-1);
    if (l) return new Date(l.t);
  }
  return null;
}

/** First write of a day is a keyframe; later writes are deltas, only when something changed. Returns whether written. */
export function append(root: string, feed: string, now: Date, next: State): boolean {
  const { date, iso } = sg(now);
  const file = dayFile(root, feed, date);
  if (!existsSync(file)) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify({ t: iso, k: 1, v: sorted(next) }) + "\n");
    return true;
  }
  const d = diff(replay(readLines(file)), next);
  if (!d) return false;
  appendFileSync(file, JSON.stringify({ t: iso, ...(d.set && { set: sorted(d.set) }), ...(d.del && { del: [...d.del].sort() }) }) + "\n");
  return true;
}
