import { describe, expect, it } from "vitest";
import { feeds, normCarpark, normDengue, normFlood, normPm25, normPsi, normTaxi } from "../scripts/feeds.ts";
import { fix } from "./util.ts";

describe("normalisers (real fixtures)", () => {
  it("psi: per region", () => {
    expect(normPsi(fix("psi.json"))).toEqual({
      north: { psi24: 32, src: "2026-11-15T13:00:00+08:00" },
      south: { psi24: 33, src: "2026-11-15T13:00:00+08:00" },
      east: { psi24: 33, src: "2026-11-15T13:00:00+08:00" },
      west: { psi24: 34, src: "2026-11-15T13:00:00+08:00" },
      central: { psi24: 33, src: "2026-11-15T13:00:00+08:00" },
    });
  });
  it("pm25: per region", () => {
    const s = normPm25(fix("pm25.json")) as Record<string, { pm25: number }>;
    expect(Object.keys(s).sort()).toEqual(["central", "east", "north", "south", "west"]);
    expect(s.east.pm25).toBe(3);
  });
  it("psi/pm25 reject a wrong shape instead of returning empty", () => {
    expect(() => normPsi({ data: { items: [] } })).toThrow();
    expect(() => normPm25(fix("psi.json"))).toThrow();
  });
  it("carpark: car lots only, [avail,total], drops carparks without type C", () => {
    const s = normCarpark(fix("carpark.json")) as Record<string, [number, number]>;
    expect(s.HE12).toEqual([103, 105]);
    expect(Object.keys(s)).toHaveLength(29); // 30 kept in fixture, 1 has no C lot
  });
  it("taxi: 0.01 degree grid counts add up", () => {
    const raw = fix("taxi.json") as { features: { geometry: { coordinates: number[][] } }[] };
    const s = normTaxi(raw) as Record<string, number>;
    expect(Object.values(s).reduce((a, b) => a + b, 0)).toBe(raw.features[0].geometry.coordinates.length);
    expect(Object.keys(s).every((k) => /^1\d\d_10[34]\d\d$/.test(k))).toBe(true);
    expect(s["128_10362"]).toBe(3); // 3 taxis at 1.2893 N, 103.6254 E
  });
  it("taxi: drops malformed and out-of-Singapore points", () => {
    const s = normTaxi({ features: [{ geometry: { coordinates: [[103.8, 1.3], [0, 0], ["a", 1], null, [103.8, 1.3]] } }] });
    expect(s).toEqual({ "130_10380": 2 });
  });
  it("dengue: cluster id, cases, rounded geometry", () => {
    const s = normDengue(fix("dengue.geojson")) as Record<string, { cases: number; geom: { type: string; coordinates: number[][][] } }>;
    expect(Object.keys(s)).toHaveLength(6);
    const c = s["Lentor Gdns / Munshi Abdullah Ave / Tung Po Ave / Yio Chu Kang Dr"];
    expect(c.cases).toBe(23);
    expect(c.geom.type).toBe("Polygon");
    expect(c.geom.coordinates[0][0]).toEqual([103.83295, 1.38407]);
    expect(s["Lentor Ctrl / Lentor Ctrl (Lentor Modern)"].cases).toBe(9); // trailing space trimmed
  });
  it("dengue: skips malformed features, disambiguates repeated localities", () => {
    const poly = { type: "Polygon", coordinates: [[[103.8, 1.3]]] };
    const f = (LOCALITY: unknown, CASE_SIZE: unknown, geometry: unknown = poly) => ({ properties: { LOCALITY, CASE_SIZE }, geometry });
    const s = normDengue({ features: [f("A", 2), f("A", 3), f("", 1), f("B", "x"), f("C", 1, { type: "Point" }), "junk"] });
    expect(Object.keys(s)).toEqual(["A", "A #2"]);
  });
  it("flood: empty live response is a valid empty state", () => {
    expect(normFlood(fix("flood-empty.json"))).toEqual({});
  });
  it("flood (synthetic, documented schema): cancelled and malformed alerts dropped", () => {
    expect(normFlood(fix("flood-alert.synthetic.json"))).toEqual({
      "2.49.0.0.702.2-BCM-3-X": { lon: 103.83555, lat: 1.30412, desc: "Flash flood at Orchard Rd. Please avoid the area. Issued 1330 hrs.", src: "2026-11-15T13:30:22+08:00", r: 1 },
    });
  });
});

describe("due()", () => {
  const at = (hhmm: string) => new Date(`2026-11-15T${hhmm}:00+08:00`);
  const due = (name: string, hhmm: string) => feeds.find((f) => f.name === name)!.due(at(hhmm));
  it("psi, pm25, flood every run", () => {
    for (const n of ["psi", "pm25", "flood"]) expect([due(n, "13:11"), due(n, "13:41")]).toEqual([true, true]);
  });
  it("carpark and taxi once an hour", () => {
    for (const n of ["carpark", "taxi"]) expect([due(n, "13:11"), due(n, "13:41")]).toEqual([true, false]);
  });
  it("dengue at hours divisible by 6, first half hour", () => {
    expect([due("dengue", "12:11"), due("dengue", "12:41"), due("dengue", "13:11"), due("dengue", "00:11")]).toEqual([true, false, false, true]);
  });
});
