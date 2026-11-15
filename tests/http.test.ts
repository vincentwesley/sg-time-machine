import { describe, expect, it } from "vitest";
import { getJson, pollDownload, UA, type Http } from "../scripts/http.ts";
import { noPause, resp } from "./util.ts";

function fake(...responses: (Response | Error)[]) {
  const calls: { url: string; ua: string | null }[] = [];
  const pauses: number[] = [];
  const http: Http = {
    ...noPause(pauses),
    fetch: async (url, init) => {
      calls.push({ url: String(url), ua: new Headers(init?.headers).get("user-agent") });
      const r = responses.shift()!;
      if (r instanceof Error) throw r;
      return r;
    },
  };
  return { http, calls, pauses };
}

describe("http", () => {
  it("sends the UA and returns json", async () => {
    const f = fake(resp(200, { x: 1 }));
    expect(await getJson("https://x/y", f.http)).toEqual({ x: 1 });
    expect(f.calls[0].ua).toBe(UA);
  });
  it("retries once after 10 s on 429", async () => {
    const f = fake(resp(429, {}), resp(200, { ok: 1 }));
    expect(await getJson("https://x", f.http)).toEqual({ ok: 1 });
    expect(f.pauses).toEqual([10_000]);
    expect(f.calls).toHaveLength(2);
  });
  it("retries on 5xx and network errors, then throws after the second failure", async () => {
    const f = fake(resp(503, {}), resp(500, {}));
    await expect(getJson("https://x", f.http)).rejects.toThrow("HTTP 500");
    expect(f.calls).toHaveLength(2);
    const g = fake(new TypeError("fetch failed"), resp(200, {}));
    await getJson("https://x", g.http);
    expect(g.calls).toHaveLength(2);
  });
  it("does not retry other 4xx", async () => {
    const f = fake(resp(404, {}));
    await expect(getJson("https://x", f.http)).rejects.toThrow("HTTP 404");
    expect(f.calls).toHaveLength(1);
  });
  it("pollDownload follows the signed url", async () => {
    const f = fake(resp(201, { code: 0, data: { url: "https://s3/file.csv" } }), new Response("a,b\n1,2\n"));
    expect(await pollDownload("d_abc", f.http)).toBe("a,b\n1,2\n");
    expect(f.calls.map((c) => c.url)).toEqual(["https://api-open.data.gov.sg/v1/public/api/datasets/d_abc/poll-download", "https://s3/file.csv"]);
    await expect(pollDownload("d", fake(resp(200, { code: 1 })).http)).rejects.toThrow("no url");
  });
});
