import { describe, expect, it } from "vitest";
import { buildRef, parseCsv } from "../scripts/ref-carparks.ts";
import { fixText } from "./util.ts";

describe("ref-carparks", () => {
  it("parseCsv handles quotes, escaped quotes and CRLF", () => {
    expect(parseCsv('a,b\r\n"x,1","he said ""hi"""\r\n')).toEqual([["a", "b"], ["x,1", 'he said "hi"']]);
  });
  it("buildRef converts the real CSV to sorted [lon,lat,address]", () => {
    const ref = buildRef(fixText("hdb-carparks.csv"));
    expect(Object.keys(ref)).toHaveLength(30);
    expect(Object.keys(ref)).toEqual([...Object.keys(ref)].sort());
    expect(ref.ACB).toEqual([103.85412, 1.30106, "BLK 270/271 ALBERT CENTRE BASEMENT CAR PARK"]);
    for (const [lon, lat] of Object.values(ref)) expect(lon > 103.6 && lon < 104.1 && lat > 1.2 && lat < 1.5).toBe(true);
  });
  it("rejects a CSV with the wrong columns", () => {
    expect(() => buildRef("a,b\n1,2\n")).toThrow("columns");
  });
});
