import { Map as MlMap, Marker, NavigationControl, Popup, setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  BAND_NAMES, FEEDS, PM25_NAMES, REGIONS, carparkPoints, counts, formatHash, hm, nearest, parseHash, parseNdjson, pm25Band, psiBand,
  regionList, regionValue, secOfDay, series, stateAt, unionTimes,
  type Feed, type Health, type Index, type Line, type Ref, type State,
} from "./data.ts";

setWorkerUrl(workerUrl); // same-origin worker file, so CSP needs no blob workers
const BASE = import.meta.env.BASE_URL;
const ex = (e: unknown[]) => e as never; // MapLibre expression arrays are untyped here
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

const LABELS: Record<Feed, string> = { dengue: "Dengue", psi: "PSI", pm25: "PM2.5", flood: "Floods", carpark: "Carparks", taxi: "Taxis" };
const DEFAULT_LAYERS: Feed[] = ["dengue", "psi", "carpark"];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
const css = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const fmtDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

// ---------- state ----------
let index: Index | null = null;
let health: Health = {};
let ref: Ref | null = null;
const layers = new Set<Feed>();
let date = "";
let time = ""; // full ISO +08:00 of the snapshot in view
let times: string[] = [];
let files: Partial<Record<Feed, Line[] | null>> = {};
let playTimer: number | undefined;
let basemapFailed = false;
const cache = new Map<string, Promise<Line[] | null>>();
const seriesMemo = new Map<string, { t: string; v: number }[]>();

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(`${BASE}data/${path}`, { cache: "no-cache" });
    return r.ok ? ((await r.json()) as T) : null;
  } catch { return null; }
}

function loadDay(feed: Feed, d: string): Promise<Line[] | null> {
  const key = `${feed}|${d}`;
  let p = cache.get(key);
  if (!p) {
    p = !index?.feeds[feed]?.days.includes(d)
      ? Promise.resolve(null)
      : fetch(`${BASE}data/${feed}/${d.slice(0, 4)}/${d.slice(5, 7)}/${d.slice(8)}.ndjson`)
          .then(async (r) => { const l = r.ok ? parseNdjson(await r.text()) : []; return l.length ? l : null; })
          .catch(() => null);
    cache.set(key, p);
  }
  return p;
}

async function loadActive() {
  await Promise.all([...layers].filter((f) => !(f in files) || files[f] === undefined).map(async (f) => { files[f] = await loadDay(f, date); }));
  times = unionTimes([...layers].map((f) => files[f] ?? null));
}

// ---------- map ----------
const map = new MlMap({
  container: "map",
  style: styleUrl(),
  center: [103.82, 1.352],
  zoom: innerWidth < 640 ? 9.8 : 10.9,
  minZoom: 9.4,
  maxBounds: [[103.5, 1.12], [104.2, 1.52]],
  attributionControl: { compact: true },
  fadeDuration: reduceMotion.matches ? 0 : 300,
});
// keep Singapore clear of the panel and timeline
map.once("load", () => map.jumpTo({ padding: innerWidth < 960 ? { top: 170, bottom: 250, left: 0, right: 0 } : { top: 0, bottom: 170, left: 0, right: 360 } }));
map.addControl(new NavigationControl({ showCompass: false }), "bottom-left");
const popup = new Popup({ closeButton: false, closeOnClick: true, maxWidth: "16rem" });
const markers = new Map<string, Marker>();
let fcs: Record<string, FeatureCollection> = {};
let styleReady = false;

function styleUrl() {
  return `https://tiles.openfreemap.org/styles/${document.documentElement.getAttribute("data-theme") === "light" ? "positron" : "dark"}`;
}
const blank = () => ({ version: 8 as const, sources: {}, layers: [{ id: "bg", type: "background" as const, paint: { "background-color": css("--bg") } }] });
const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };

function addLayers() {
  const [peach, lav, blue, ok, warn, danger, bg] = ["--fx-2", "--fx-3", "--series-4", "--ok", "--warn", "--danger", "--bg"].map(css);
  for (const id of ["taxi", "dengue", "flood", "carpark"]) map.addSource(id, { type: "geojson", data: fcs[id] ?? EMPTY });
  map.addLayer({ id: "taxi", type: "fill", source: "taxi", paint: { "fill-color": lav, "fill-opacity": ex(["interpolate", ["linear"], ["get", "n"], 1, 0.15, 25, 0.75]), "fill-outline-color": lav } });
  map.addLayer({ id: "dengue-fill", type: "fill", source: "dengue", paint: { "fill-color": peach, "fill-opacity": ex(["interpolate", ["linear"], ["get", "cases"], 1, 0.2, 30, 0.65]) } });
  map.addLayer({ id: "dengue-line", type: "line", source: "dengue", paint: { "line-color": peach, "line-width": 1.5 } });
  map.addLayer({ id: "carpark", type: "circle", source: "carpark", paint: {
    "circle-radius": ex(["interpolate", ["linear"], ["zoom"], 10, 2, 15, 7]),
    "circle-color": ex(["interpolate", ["linear"], ["get", "pct"], 0, danger, 0.2, warn, 0.55, ok]),
    "circle-stroke-color": bg, "circle-stroke-width": 0.5, "circle-opacity": 0.9,
  } });
  map.addLayer({ id: "flood-halo", type: "circle", source: "flood", paint: { "circle-radius": 24, "circle-color": blue, "circle-opacity": 0.25 } });
  map.addLayer({ id: "flood", type: "circle", source: "flood", paint: { "circle-radius": 7, "circle-color": blue, "circle-stroke-color": bg, "circle-stroke-width": 2 } });
}

const hoverable = ["taxi", "dengue-fill", "carpark", "flood"];
function popupFor(layer: string, p: Record<string, unknown>): [string, string] {
  if (layer === "dengue-fill") return [String(p.id), `${p.cases} cases in this cluster`];
  if (layer === "carpark") return [String(p.addr || p.id), `${p.avail} of ${p.total} car lots free`];
  if (layer === "flood") return ["Flood alert", String(p.desc)];
  return ["Taxi grid square", `${p.n} taxis`];
}
function showPopup(e: { lngLat: { lng: number; lat: number }; point: { x: number; y: number } }) {
  const f = map.queryRenderedFeatures([e.point.x, e.point.y], { layers: hoverable.filter((l) => map.getLayer(l)) })[0];
  if (!f) { popup.remove(); return; }
  const [title, body] = popupFor(f.layer.id, f.properties ?? {});
  const box = el("div", "pop");
  box.append(el("b", undefined, title), el("span", undefined, body));
  popup.setLngLat(e.lngLat).setDOMContent(box).addTo(map);
}
map.on("mousemove", (e) => { map.getCanvas().style.cursor = map.queryRenderedFeatures([e.point.x, e.point.y], { layers: hoverable.filter((l) => map.getLayer(l)) }).length ? "pointer" : ""; });
map.on("click", showPopup);

map.on("style.load", () => { styleReady = true; addLayers(); pushData(); });
map.on("error", () => {
  if (styleReady || basemapFailed) return;
  basemapFailed = true; // basemap host unreachable: keep the data layers on a plain background
  map.setStyle(blank());
  $("map").dataset.basemap = "offline";
  renderPanel();
});
new MutationObserver(() => { if (!basemapFailed) { styleReady = false; map.setStyle(styleUrl()); } }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

function pushData() {
  if (!styleReady) return;
  for (const id of ["taxi", "dengue", "flood", "carpark"]) (map.getSource(id) as { setData(d: unknown): void } | undefined)?.setData(fcs[id] ?? EMPTY);
  map.getContainer().dataset.ready = "1";
}

// ---------- feature builders ----------
function buildFeatures(s: Partial<Record<Feed, State>>) {
  const dengue: Feature[] = [];
  for (const [id, v] of Object.entries(s.dengue ?? {})) {
    if (isObj(v) && isObj(v.geom) && typeof v.geom.type === "string") dengue.push({ type: "Feature", properties: { id, cases: Number(v.cases) || 0 }, geometry: v.geom as unknown as Geometry });
  }
  const flood: Feature[] = [];
  for (const v of Object.values(s.flood ?? {})) {
    if (isObj(v) && typeof v.lon === "number" && typeof v.lat === "number") flood.push({ type: "Feature", properties: { desc: String(v.desc ?? "") }, geometry: { type: "Point", coordinates: [v.lon, v.lat] } });
  }
  const carpark = carparkPoints(s.carpark ?? {}, ref).map((c): Feature => ({
    type: "Feature", properties: { id: c.id, addr: c.addr, avail: c.avail, total: c.total, pct: c.total ? c.avail / c.total : 0 }, geometry: { type: "Point", coordinates: [c.lon, c.lat] },
  }));
  const taxi: Feature[] = [];
  for (const [k, n] of Object.entries(s.taxi ?? {})) {
    const m = /^(\d+)_(\d+)$/.exec(k);
    if (!m || typeof n !== "number") continue;
    const [la, lo] = [Number(m[1]) / 100, Number(m[2]) / 100];
    taxi.push({ type: "Feature", properties: { n }, geometry: { type: "Polygon", coordinates: [[[lo, la], [lo + 0.01, la], [lo + 0.01, la + 0.01], [lo, la + 0.01], [lo, la]]] } });
  }
  const fc = (features: Feature[]): FeatureCollection => ({ type: "FeatureCollection", features });
  return { dengue: fc(dengue), flood: fc(flood), carpark: fc(carpark), taxi: fc(taxi) };
}

function syncBubbles(states: Partial<Record<Feed, State>>) {
  const want = new Set<string>();
  for (const [feed, key, band, off] of [["psi", "psi24", psiBand, -22], ["pm25", "pm25", pm25Band, 22]] as const) {
    if (!layers.has(feed)) continue;
    for (const r of regionList) {
      const v = regionValue(states[feed], r, key);
      if (v === undefined) continue;
      const id = `${feed}:${r}`;
      want.add(id);
      let m = markers.get(id);
      if (!m) {
        const host = el("div");
        host.setAttribute("aria-hidden", "true");
        host.append(el("div"));
        m = new Marker({ element: host, offset: [off, 0] }).setLngLat([...REGIONS[r]] as [number, number]).addTo(map);
        markers.set(id, m);
      }
      const b = m.getElement().firstElementChild as HTMLElement;
      b.className = `bubble ${feed === "pm25" ? "pm" : "ps"} b${band(v)}`;
      b.textContent = String(v);
      b.title = `${LABELS[feed]} ${v}, ${r} region centre`;
    }
  }
  for (const [id, m] of markers) if (!want.has(id)) { m.remove(); markers.delete(id); }
}

// ---------- panel ----------
function spark(feed: Feed, region: string, key: "psi24" | "pm25", at: string | undefined): SVGElement {
  const k = `${feed}|${date}|${region}`;
  let pts = seriesMemo.get(k);
  if (!pts) { pts = series(files[feed] ?? [], (s) => regionValue(s, region, key)); seriesMemo.set(k, pts); }
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "spark-svg");
  svg.setAttribute("viewBox", "0 0 60 24");
  svg.setAttribute("role", "img");
  const vals = pts.map((p) => p.v);
  svg.setAttribute("aria-label", pts.length ? `${LABELS[feed]} ${region} over the day, ${Math.min(...vals)} to ${Math.max(...vals)}` : "no data");
  if (!pts.length) return svg;
  const [lo, hi] = [Math.min(...vals), Math.max(...vals)];
  const [t0, t1] = [secOfDay(pts[0].t), secOfDay(pts[pts.length - 1].t)];
  const xy = (p: { t: string; v: number }) => [t1 === t0 ? 30 : ((secOfDay(p.t) - t0) / (t1 - t0)) * 56 + 2, hi === lo ? 12 : 21 - ((p.v - lo) / (hi - lo)) * 18] as const;
  if (pts.length > 1) {
    const line = document.createElementNS(svg.namespaceURI, "polyline");
    line.setAttribute("points", pts.map((p) => xy(p).map((n) => n.toFixed(1)).join(",")).join(" "));
    svg.append(line);
  }
  const cur = [...pts].reverse().find((p) => p.t <= (at ?? ""));
  if (cur) {
    const dot = document.createElementNS(svg.namespaceURI, "circle");
    const [x, y] = xy(cur);
    dot.setAttribute("cx", String(x)); dot.setAttribute("cy", String(y)); dot.setAttribute("r", "2.5");
    svg.append(dot);
  }
  return svg;
}

function renderPanel() {
  const body = $("panel-body");
  const snap = (f: Feed) => { const l = files[f]; return l ? stateAt(l, time) : null; };
  const s: Partial<Record<Feed, State>> = {};
  for (const f of layers) { const r = snap(f); if (r) s[f] = r.state; }
  const kids: Node[] = [];

  if (layers.has("psi") || layers.has("pm25")) {
    kids.push(el("h3", undefined, "Air quality"));
    kids.push(el("p", "note", "Drawn at each NEA region centre, not at a sensor."));
    const t = el("table", "air");
    const head = t.createTHead().insertRow();
    for (const h of ["Region", ...(layers.has("psi") ? ["PSI"] : []), ...(layers.has("pm25") ? ["PM2.5"] : [])]) { const th = el("th", undefined, h); th.scope = "col"; head.append(th); }
    const tb = t.createTBody();
    for (const r of regionList) {
      const row = tb.insertRow();
      const th = el("th", undefined, r); th.scope = "row"; row.append(th);
      for (const [feed, key, band, names] of [["psi", "psi24", psiBand, BAND_NAMES], ["pm25", "pm25", pm25Band, PM25_NAMES]] as const) {
        if (!layers.has(feed)) continue;
        const v = regionValue(s[feed], r, key);
        const td = row.insertCell();
        if (v === undefined) { td.textContent = "none"; continue; }
        const c = el("div", "cell");
        c.append(el("span", "val", String(v)), spark(feed, r, key, snap(feed)?.at), el("span", "band", names[band(v)]));
        td.append(c);
      }
    }
    kids.push(t);
  }

  const c = counts(s);
  const rows: [string, string, string?][] = [];
  if (layers.has("dengue") && s.dengue) rows.push(["Dengue clusters", String(c.dengueClusters), `${c.dengueCases} cases`]);
  if (layers.has("flood") && s.flood) rows.push(["Flood alerts", String(c.flood)]);
  if (layers.has("carpark") && s.carpark) rows.push(["Carparks reporting", c.carparks.toLocaleString("en-SG"), c.carparkFree === null ? undefined : `${Math.round(c.carparkFree * 100)}% of car lots free`]);
  if (layers.has("taxi") && s.taxi) rows.push(["Taxis", c.taxis.toLocaleString("en-SG"), "in grid squares"]);
  if (rows.length) {
    kids.push(el("h3", undefined, "Counts"));
    const dl = el("dl", "counts");
    for (const [k, v, sub] of rows) {
      const dd = el("dd", undefined, v);
      if (sub) dd.append(el("span", "sub", sub));
      dl.append(el("dt", undefined, k), dd);
    }
    kids.push(dl);
  }

  if (layers.size && index?.feeds && Object.keys(index.feeds).length) {
    kids.push(el("h3", undefined, "Snapshots"));
    const ul = el("ul", "snaps");
    for (const f of FEEDS.filter((x) => layers.has(x))) {
      const r = snap(f);
      const h = health[f];
      const li = el("li");
      const failing = h?.error && (!h.ok || h.error > h.ok);
      li.append(el("span", undefined, LABELS[f]));
      const right = el("span", failing ? "bad" : undefined,
        r ? `as of ${hm(r.at)}${failing ? ", fetch failing" : ""}` : files[f] ? "none yet at this time" : "no snapshot for this feed on this day");
      right.title = index.feeds[f] ? `Archive: ${index.feeds[f].first} to ${index.feeds[f].last}` : "Not in the archive yet";
      li.append(right);
      ul.append(li);
    }
    kids.push(ul);
  }
  if (!layers.size) kids.push(el("p", "hint", "Turn on a layer to see its readings."));
  if (basemapFailed) kids.push(el("p", "hint", "The basemap could not be loaded. Data layers are still shown."));
  body.replaceChildren(...kids);
}

// ---------- timeline ----------
const dateIn = $<HTMLInputElement>("date");
const slider = $<HTMLInputElement>("slider");
const playBtn = $<HTMLButtonElement>("play");
const prevBtn = $<HTMLButtonElement>("prev");
const nextBtn = $<HTMLButtonElement>("next");

function renderTimeline() {
  const idx = time ? times.indexOf(time) : -1;
  const has = times.length > 0;
  slider.max = String(Math.max(0, times.length - 1));
  slider.value = String(Math.max(0, idx));
  slider.disabled = times.length < 2;
  prevBtn.disabled = idx <= 0;
  nextBtn.disabled = !has || idx >= times.length - 1;
  playBtn.disabled = times.length < 2 || reduceMotion.matches;
  playBtn.title = reduceMotion.matches ? "Autoplay is off because your system prefers reduced motion. Use the step buttons." : "";
  const lab = $("time-label");
  lab.replaceChildren(has ? hm(time) : "--:--");
  if (has) lab.append(el("small", undefined, `SGT ${fmtDate(date)}`));
  slider.setAttribute("aria-valuetext", has ? `${hm(time)} Singapore time` : "no snapshots");
  const note = $("tl-note");
  if (!layers.size) note.textContent = "Turn on a layer to choose a snapshot time.";
  else if (!has) note.textContent = "No snapshot for the selected layers on this day. Pick another date or layer.";
  else note.textContent = `${times.length} snapshot${times.length === 1 ? "" : "s"} on this day. Steps follow the layers you have on.`;
}

function render() {
  renderTimeline();
  const s: Partial<Record<Feed, State>> = {};
  for (const f of layers) { const l = files[f]; const r = l && time ? stateAt(l, time) : null; if (r) s[f] = r.state; }
  fcs = buildFeatures(s);
  pushData();
  syncBubbles(s);
  renderPanel();
  document.querySelectorAll<HTMLButtonElement>(".layer").forEach((b) => b.setAttribute("aria-pressed", String(layers.has(b.dataset.feed as Feed))));
  if (date && time) history.replaceState(null, "", formatHash({ date, time: time.slice(11, 19), layers: [...layers] }));
}

function pickTime(wantTod: string) {
  times = unionTimes([...layers].map((f) => files[f] ?? null));
  time = times.length ? nearest(times, `${date}T${wantTod}+08:00`) : "";
}

async function setDate(d: string, wantTod = time.slice(11, 19) || "23:59:59") {
  stop();
  date = d;
  files = {};
  seriesMemo.clear();
  await loadActive();
  pickTime(wantTod);
  render();
}

async function toggleLayer(f: Feed) {
  if (layers.has(f)) layers.delete(f); else layers.add(f);
  if (layers.has(f)) await loadActive();
  pickTime(time.slice(11, 19) || "23:59:59");
  render();
}

function step(d: number) {
  const i = times.indexOf(time) + d;
  if (i < 0 || i >= times.length) { stop(); return; }
  time = times[i];
  render();
}
function stop() {
  window.clearInterval(playTimer);
  playTimer = undefined;
  playBtn.setAttribute("aria-label", "Play");
  playBtn.firstElementChild?.setAttribute("class", "hs-icon i-play");
}
playBtn.addEventListener("click", () => {
  if (playTimer !== undefined) { stop(); return; }
  if (times.indexOf(time) >= times.length - 1) { time = times[0]; render(); }
  playBtn.setAttribute("aria-label", "Pause");
  playBtn.firstElementChild?.setAttribute("class", "hs-icon i-pause");
  playTimer = window.setInterval(() => step(1), 700);
});
prevBtn.addEventListener("click", () => { stop(); step(-1); });
nextBtn.addEventListener("click", () => { stop(); step(1); });
slider.addEventListener("input", () => { stop(); time = times[Number(slider.value)] ?? time; render(); });
dateIn.addEventListener("change", () => {
  if (dateIn.validity.valid && dateIn.value) void setDate(dateIn.value);
  else dateIn.value = date;
});
reduceMotion.addEventListener("change", () => { stop(); renderTimeline(); });

// ---------- chips, panel toggle, theme ----------
function buildChips() {
  const box = $("layers");
  for (const f of FEEDS) {
    const b = el("button", `hs-chip layer l-${f}`);
    b.type = "button";
    b.dataset.feed = f;
    b.setAttribute("aria-pressed", "false");
    b.append(el("span", "layer__sw"), el("span", undefined, LABELS[f]));
    b.addEventListener("click", () => void toggleLayer(f));
    box.append(b);
  }
}
const panelBtn = $<HTMLButtonElement>("panel-toggle");
function setPanel(open: boolean) {
  panelBtn.setAttribute("aria-expanded", String(open));
  $("panel-body").hidden = !open;
}
panelBtn.addEventListener("click", () => setPanel(panelBtn.getAttribute("aria-expanded") !== "true"));
setPanel(innerWidth >= 640);

import(/* @vite-ignore */ `${BASE}js/theme.js`).then((m) => m.initThemeToggle($("theme-toggle"))).catch(() => undefined);
import(/* @vite-ignore */ `${BASE}credits/credits.js`).catch(() => undefined);

// ---------- boot ----------
async function boot() {
  buildChips();
  [index, health] = await Promise.all([getJson<Index>("index.json"), getJson<Health>("health.json").then((h) => h ?? {})]);
  ref = await getJson<Ref>("ref/hdb-carparks.json");
  const feedsIdx = index?.feeds ?? {};
  const firsts = Object.values(feedsIdx).map((f) => f.first).sort();
  const lasts = Object.values(feedsIdx).map((f) => f.last).sort();
  if (!index || !firsts.length) {
    $("since").textContent = "Archive starts with the next scheduled run";
    $("empty").hidden = false;
    for (const e of document.querySelectorAll<HTMLElement>(".layer, #timeline input, #timeline button")) (e as HTMLButtonElement).disabled = true;
    renderTimeline();
    renderPanel();
    return;
  }
  $("since").textContent = `Archive since ${fmtDate(firsts[0])}`;
  dateIn.min = firsts[0];
  dateIn.max = lasts[lasts.length - 1];
  await applyHash();
  addEventListener("hashchange", () => { if (location.hash !== formatHash({ date, time: time.slice(11, 19), layers: [...layers] })) void applyHash(); });
}
async function applyHash() {
  const v = parseHash(location.hash);
  layers.clear();
  for (const f of v.layers ?? DEFAULT_LAYERS) layers.add(f);
  const d = v.date && v.date >= dateIn.min && v.date <= dateIn.max ? v.date : dateIn.max;
  dateIn.value = d;
  await setDate(d, v.time ?? "23:59:59");
}
void boot();
