import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface SiteIndex { generated: string; feeds: Record<string, { days: string[]; first: string; last: string }> }

const dirs = (p: string) => (existsSync(p) ? readdirSync(p, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) : []);

/** Copies data/<feed>/YYYY/MM/DD.ndjson (+ ref + health) into `out` and writes out/index.json. */
export function buildSiteData(root: string, out: string, now = new Date()): SiteIndex {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const index: SiteIndex = { generated: now.toISOString(), feeds: {} };
  for (const feed of dirs(root)) {
    if (feed === "ref") continue;
    const days: string[] = [];
    for (const y of dirs(join(root, feed)).filter((n) => /^\d{4}$/.test(n))) {
      for (const m of dirs(join(root, feed, y)).filter((n) => /^\d{2}$/.test(n))) {
        for (const f of readdirSync(join(root, feed, y, m))) {
          const d = /^(\d{2})\.ndjson$/.exec(f)?.[1];
          if (!d) continue;
          mkdirSync(join(out, feed, y, m), { recursive: true });
          copyFileSync(join(root, feed, y, m, f), join(out, feed, y, m, f));
          days.push(`${y}-${m}-${d}`);
        }
      }
    }
    if (days.length) {
      days.sort();
      index.feeds[feed] = { days, first: days[0], last: days[days.length - 1] };
    }
  }
  for (const f of ["ref/hdb-carparks.json", "health.json"]) {
    if (!existsSync(join(root, f))) continue;
    mkdirSync(join(out, f, ".."), { recursive: true });
    copyFileSync(join(root, f), join(out, f));
  }
  writeFileSync(join(out, "index.json"), JSON.stringify(index) + "\n");
  return index;
}

if (import.meta.main) {
  const root = process.env.DATA_ROOT ?? join(import.meta.dirname, "..", "data");
  const idx = buildSiteData(root, join(import.meta.dirname, "..", "site", "public", "data"));
  console.log(`site data: ${Object.keys(idx.feeds).length} feeds, ${Object.values(idx.feeds).reduce((n, f) => n + f.days.length, 0)} day files`);
}
