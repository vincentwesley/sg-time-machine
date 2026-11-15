import { describe, expect, it } from "vitest";
import { svy21ToWgs84 } from "../scripts/svy21.ts";

describe("svy21ToWgs84", () => {
  it("maps the SVY21 origin (N 38744.572, E 28001.642) to 1.366666 N, 103.833333 E", () => {
    const [lon, lat] = svy21ToWgs84(28001.642, 38744.572);
    expect(lon).toBeCloseTo(103.833333, 6);
    expect(lat).toBeCloseTo(1.366666, 6);
  });
  it("places HDB carpark ACB (Albert Centre) where Albert Centre is", () => {
    const [lon, lat] = svy21ToWgs84(30314.7936, 31490.4942);
    expect(lon).toBeCloseTo(103.8541, 3);
    expect(lat).toBeCloseTo(1.3011, 3);
  });
  it("is monotonic: +1000 m east / north moves ~0.009 degrees", () => {
    const [lon0, lat0] = svy21ToWgs84(30000, 30000);
    const [lon1, lat1] = svy21ToWgs84(31000, 31000);
    expect(lon1 - lon0).toBeCloseTo(0.00899, 4);
    expect(lat1 - lat0).toBeCloseTo(0.00905, 4);
  });
});
