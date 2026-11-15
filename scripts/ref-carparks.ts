import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { sorted } from "./diff.ts";
import { pollDownload, realHttp, type Http } from "./http.ts";
import { DATA_ROOT } from "./store.ts";
import { svy21ToWgs84 } from "./svy21.ts";

/** Minimal RFC 4180 CSV parser (quoted fields, "" escapes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/** HDB Carpark Information CSV (SVY21 x/y) to { id: [lon, lat, address] }, WGS84, 5 dp, sorted keys. */
export function buildRef(csv: string): Record<string, [number, number, string]> {
  const [head, ...rows] = parseCsv(csv);
  const col = (n: string) => head.indexOf(n);
  const [iNo, iAddr, iX, iY] = ["car_park_no", "address", "x_coord", "y_coord"].map(col);
  if ([iNo, iAddr, iX, iY].includes(-1)) throw new Error("hdb csv: unexpected columns");
  const out: Record<string, [number, number, string]> = {};
  for (const r of rows) {
    const [x, y] = [Number(r[iX]), Number(r[iY])];
    if (!r[iNo] || !Number.isFinite(x) || !Number.isFinite(y)) continue;
    const [lon, lat] = svy21ToWgs84(x, y);
    if (lat < 1.1 || lat > 1.5 || lon < 103.5 || lon > 104.2) continue;
    out[r[iNo]] = [Math.round(lon * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5, r[iAddr]];
  }
  if (!Object.keys(out).length) throw new Error("hdb csv: no usable rows");
  return sorted(out) as typeof out;
}

export async function refreshCarparks(file: string, http: Http = realHttp): Promise<number> {
  const ref = buildRef(await pollDownload("d_23f946fa557947f93a8043bbef41dd09", http));
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(ref) + "\n");
  return Object.keys(ref).length;
}

if (import.meta.main) {
  console.log(`ref: wrote ${await refreshCarparks(join(DATA_ROOT, "ref", "hdb-carparks.json"))} carparks`);
}
