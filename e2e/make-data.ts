// Builds a small archive from the real fixtures for e2e: node e2e/make-data.ts <outDir>
import { copyFileSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { normCarpark, normDengue, normFlood, normPm25, normPsi, normTaxi } from "../scripts/feeds.ts";
import type { State } from "../scripts/diff.ts";
import { append } from "../scripts/store.ts";

const fx = (n: string) => readFileSync(new URL(`../tests/fixtures/${n}`, import.meta.url), "utf8");
const out = process.argv[2] ?? join(import.meta.dirname, "..", "qa-output", "e2e-data");
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "ref"), { recursive: true });
copyFileSync(new URL("../data/ref/hdb-carparks.json", import.meta.url), join(out, "ref", "hdb-carparks.json")); // real reference file

const sgt = (iso: string) => new Date(`${iso}+08:00`);
const bump = (s: State, f: (v: unknown, i: number) => unknown): State => Object.fromEntries(Object.entries(s).map(([k, v], i) => [k, f(v, i)]));
const num = (v: unknown, d: number) => (typeof v === "number" ? v + d : v);

const psi = normPsi(JSON.parse(fx("psi.json")));
const pm25 = normPm25(JSON.parse(fx("pm25.json")));
const flood = normFlood(JSON.parse(fx("flood-alert.synthetic.json")));
const carpark = normCarpark(JSON.parse(fx("carpark.json")));
const taxi = normTaxi(JSON.parse(fx("taxi.json")));
const dengue = normDengue(JSON.parse(fx("dengue.geojson")));

["08:00:30", "08:30:30", "09:00:30"].forEach((t, i) => {
  const at = sgt(`2026-11-15T${t}`);
  append(out, "psi", at, bump(psi, (v) => (v as { psi24: number }) && { ...(v as object), psi24: (v as { psi24: number }).psi24 + i * 40 }));
  append(out, "pm25", at, bump(pm25, (v) => ({ ...(v as object), pm25: (v as { pm25: number }).pm25 + i * 30 })));
  append(out, "flood", at, i ? flood : {});
});
["08:00:30", "09:00:30"].forEach((t, i) => {
  const at = sgt(`2026-11-15T${t}`);
  append(out, "carpark", at, bump(carpark, (v) => { const [a, tot] = v as [number, number]; return [Math.max(0, a - i * 20), tot]; }));
  append(out, "taxi", at, bump(taxi, (v) => num(v, i * 2)));
});
append(out, "dengue", sgt("2026-11-15T06:00:30"), dengue);
append(out, "psi", sgt("2026-11-14T12:00:30"), psi);
console.log(`e2e data: ${out}`);
